"""Additive rehearsal payloads; stable v1 recovery wire models are unchanged."""
from typing import Literal

from pydantic import Field

from .contracts import WireModel


class ThermalSample(WireModel):
    elapsed_s: float = Field(ge=0)
    cpu_c: float = Field(ge=0, le=110)
    source_type: Literal["injected", "measured"]


class FailureForecast(WireModel):
    seconds_to_limit: float | None = Field(default=None, ge=0)
    slope_c_per_s: float | None = None
    fit_quality: float | None = Field(default=None, ge=0, le=1)
    threshold_c: float = 80.0
    eligible: bool = False
    reason: str


class ToolResult(WireModel):
    tool: str
    arguments: dict
    result: dict
    planner: Literal["deterministic_fallback"] = "deterministic_fallback"
    authority: Literal["read_only"] = "read_only"


class RehearsalMessage(WireModel):
    transport: Literal["mock"] = "mock"
    direction: Literal["outbound", "inbound"]
    text: str = Field(max_length=2000)
    delivery: Literal["simulated"] = "simulated"
