"""Synthetic contract fixtures. Running this module emits JSON Schema."""
import json
from uuid import uuid4

from .contracts import CheckpointManifest, IncidentEvent, SensorEvent, WorkerHeartbeat, utc_now

MODELS = (CheckpointManifest, IncidentEvent, SensorEvent, WorkerHeartbeat)


def event_fixture(**overrides) -> IncidentEvent:
    return IncidentEvent(**{
        "event_id": uuid4(), "job_id": "test-job", "created_utc": utc_now(),
        "event_type": "TEST_EVENT", "source_type": "simulated", "message": "Fixture",
        **overrides,
    })


def schema_snapshot() -> str:
    return json.dumps({model.__name__: model.model_json_schema() for model in MODELS}, indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    print(schema_snapshot(), end="")
