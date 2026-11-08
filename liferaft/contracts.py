"""Stable wire types shared with the future HTTPS coordinator."""
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

Identifier = Annotated[str, Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$")]
Digest = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Step = Annotated[int, Field(ge=0, strict=True)]
Source = Literal["measured", "injected", "derived", "provider", "simulated"]
MAX_CHECKPOINT_BYTES = 10 * 1024 * 1024


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, hide_input_in_errors=True)

    @field_validator("created_utc", "committed_utc", "client_utc", "bridge_received_utc", check_fields=False, mode="before")
    @classmethod
    def require_utc(cls, value: object) -> object:
        if value is None:
            return value
        if isinstance(value, str):
            if "T" not in value or not value.endswith(("Z", "+00:00")):
                raise ValueError("expected an ISO-8601 UTC timestamp")
        elif not isinstance(value, datetime) or value.utcoffset() != timedelta(0):
            raise ValueError("expected a UTC timestamp")
        return value


class IncidentEvent(WireModel):
    schema_version: Literal[1] = 1
    event_id: UUID
    incident_id: Identifier | None = None
    job_id: Identifier
    created_utc: AwareDatetime
    event_type: Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]{0,63}$")]
    source_type: Source
    trigger_event_id: UUID | None = None
    worker_id: Identifier | None = None
    lease_epoch: Step = 0
    severity: Literal["INFO", "WARNING", "ERROR"] = "INFO"
    message: Annotated[str, Field(max_length=512)]
    evidence: dict[str, JsonValue] = Field(default_factory=dict)


class WorkerSystem(WireModel):
    os: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    arch: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    pi_cpu_temp_c: Annotated[float, Field(ge=-20, le=110)] | None = None
    cpu_temp_valid: bool = False

    @model_validator(mode="after")
    def check_temperature(self):
        if self.cpu_temp_valid != (self.pi_cpu_temp_c is not None):
            raise ValueError("temperature and validity must agree")
        return self


class WorkerCheckpoint(WireModel):
    last_committed_id: Identifier | None = None


class WorkerHeartbeat(WireModel):
    protocol_version: Literal[1] = 1
    request_id: UUID
    job_id: Identifier
    worker_id: Identifier
    lease_epoch: Step
    client_utc: AwareDatetime
    step_completed: Step
    status: Literal["RUNNING", "STANDBY", "PAUSED", "STOPPED"]
    system: WorkerSystem
    checkpoint: WorkerCheckpoint


class AdaptiveHeartbeat(WorkerHeartbeat):
    checkpoint_ms: float | None = Field(default=None, ge=0, le=30_000, strict=True)
    step_wall_ms: float | None = Field(default=None, gt=0, le=30_000, strict=True)
    training_loss: float | None = Field(default=None, ge=0, le=1e20, strict=True)


class PiTelemetry(WireModel):
    client_utc: AwareDatetime
    pi_cpu_temp_c: float | None = Field(ge=0, le=110, strict=True)


class AmbientFrame(WireModel):
    model_config = ConfigDict(strict=True)
    protocol_version: Literal[1]
    device_id: Literal["esp32-s3-01"]
    seq: int = Field(ge=0, le=0xFFFFFFFF)
    uptime_ms: int = Field(ge=0, le=0xFFFFFFFF)
    ambient_temp_c: float | None = Field(ge=-55, le=125)
    ambient_valid: bool
    button_pressed: Literal[False]
    event_type: Literal["TELEMETRY"]
    source_type: Literal["measured"]

    @model_validator(mode="after")
    def check_reading(self):
        if self.ambient_valid != (self.ambient_temp_c is not None) or self.ambient_temp_c == 85:
            raise ValueError("invalid ambient reading")
        return self


class AmbientReport(AmbientFrame):
    session: UUID


class ButtonEvent(WireModel):
    model_config = ConfigDict(strict=True)

    protocol_version: Annotated[int, Field(ge=1, le=1)]
    device_id: Literal["esp32-s3-01"]
    seq: Annotated[int, Field(ge=0, le=0xFFFFFFFF)]
    uptime_ms: Annotated[int, Field(ge=0, le=0xFFFFFFFF)]
    ambient_temp_c: Annotated[float, Field(ge=-55, le=125)] | None
    ambient_valid: bool
    button_pressed: bool
    event_type: Literal["COOLING_FAILURE_TEST"]
    source_type: Literal["injected"]

    @model_validator(mode="after")
    def check_button(self):
        if not self.button_pressed:
            raise ValueError("button must be pressed")
        if self.ambient_valid != (self.ambient_temp_c is not None):
            raise ValueError("ambient temperature and validity must agree")
        return self


class CheckpointManifest(WireModel):
    schema_version: Literal[1] = 1
    checkpoint_id: Identifier
    job_id: Identifier
    run_id: Identifier
    step_completed: Annotated[int, Field(gt=0, strict=True)]
    worker_id: Identifier
    lease_epoch: Step
    path: str
    sha256: Digest
    size_bytes: Annotated[int, Field(gt=0, le=MAX_CHECKPOINT_BYTES, strict=True)]
    dataset_fingerprint: Digest
    config_fingerprint: Digest
    model_version: Identifier
    created_utc: AwareDatetime
    committed_utc: AwareDatetime | None = None
    status: Literal["VERIFIED", "COMMITTED"] = "VERIFIED"

    @model_validator(mode="after")
    def check_location(self):
        expected = f"runs/{self.run_id}/checkpoints/{self.step_completed:06d}-{self.checkpoint_id}.pt"
        if self.path != expected:
            raise ValueError("checkpoint path does not match immutable identity")
        if (self.status == "COMMITTED") != (self.committed_utc is not None):
            raise ValueError("commit time and status must agree")
        if self.committed_utc is not None and self.committed_utc < self.created_utc:
            raise ValueError("commit precedes creation")
        return self


class SensorEvent(WireModel):
    protocol_version: Literal[1] = 1
    event_id: UUID
    device_id: Identifier
    bridge_id: Identifier
    sequence: Step
    source_type: Literal["measured", "injected", "simulated"]
    event_type: Literal["TELEMETRY", "COOLING_FAILURE_TEST"]
    ambient_temp_c: Annotated[float, Field(ge=-55, le=125)] | None = None
    ambient_valid: bool
    bridge_received_utc: AwareDatetime

    @model_validator(mode="after")
    def check_source(self):
        if self.ambient_valid != (self.ambient_temp_c is not None) or self.ambient_temp_c == 85:
            raise ValueError("invalid ambient reading")
        if self.event_type == "COOLING_FAILURE_TEST" and self.source_type != "injected":
            raise ValueError("cooling test requires injected provenance")
        return self
