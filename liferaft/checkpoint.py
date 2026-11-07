"""Save and restore project-owned training artifacts."""
import hashlib
import io
import pickle
from pathlib import Path
from uuid import uuid4

import torch

from .artifacts import IntegrityError, LocalArtifactStore, publish, verified_bytes
from .contracts import MAX_CHECKPOINT_BYTES, CheckpointManifest, utc_now
from .workload import CONFIG_FINGERPRINT, MODEL_VERSION, TrainingSession

MAX_MANIFEST_BYTES = 16_384
EXTERNAL_FIELDS = {"sha256", "size_bytes", "committed_utc", "status"}


def save(session: TrainingSession, store: LocalArtifactStore, *, job_id: str, run_id: str,
         worker_id: str, lease_epoch: int) -> tuple[CheckpointManifest, Path]:
    checkpoint_id = f"ckpt-{uuid4().hex}"
    path = f"runs/{run_id}/checkpoints/{session.step:06d}-{checkpoint_id}.pt"
    metadata = {
        "schema_version": 1, "checkpoint_id": checkpoint_id, "job_id": job_id, "run_id": run_id,
        "worker_id": worker_id, "lease_epoch": lease_epoch, "step_completed": session.step,
        "path": path, "created_utc": utc_now().isoformat(), "model_version": MODEL_VERSION,
        "dataset_fingerprint": session.dataset_fingerprint, "config_fingerprint": CONFIG_FINGERPRINT,
    }
    # Validate path components before serializing or touching the artifact store.
    manifest_data = CheckpointManifest(**metadata, sha256="0" * 64, size_bytes=1)
    stream = io.BytesIO()
    torch.save({"metadata": manifest_data.model_dump(mode="json", exclude=EXTERNAL_FIELDS),
                "state": session.state()}, stream)
    data = stream.getvalue()
    if len(data) > MAX_CHECKPOINT_BYTES:
        raise IntegrityError("checkpoint exceeds size cap")
    manifest = CheckpointManifest(**metadata, sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data))
    artifact = store.put(path, lambda output: output.write(data))
    store.verified_bytes(manifest)
    publish(artifact.with_suffix(".json"), lambda output: output.write(manifest.model_dump_json().encode()))
    return manifest, artifact


def read_manifest(path: Path) -> CheckpointManifest:
    with path.with_suffix(".json").open("rb") as stream:
        raw = stream.read(MAX_MANIFEST_BYTES + 1)
    if len(raw) > MAX_MANIFEST_BYTES:
        raise IntegrityError("checkpoint manifest exceeds size cap")
    return CheckpointManifest.model_validate_json(raw)


def restore(path: Path, *, job_id: str | None = None, run_id: str | None = None,
            seed: int | None = None, producer: str | None = None,
            lease_epoch: int | None = None,
            trusted_manifest: CheckpointManifest | None = None) -> tuple[TrainingSession, CheckpointManifest]:
    manifest = trusted_manifest if trusted_manifest is not None else read_manifest(path)
    if (manifest.model_version != MODEL_VERSION or manifest.config_fingerprint != CONFIG_FINGERPRINT
            or (job_id is not None and manifest.job_id != job_id)
            or (run_id is not None and manifest.run_id != run_id)
            or (producer is not None and manifest.worker_id != producer)
            or (lease_epoch is not None and manifest.lease_epoch != lease_epoch)
            or path.name != Path(manifest.path).name):
        raise IntegrityError("checkpoint job, run, producer, epoch or model is incompatible")
    data = verified_bytes(path, manifest)
    try:
        payload = torch.load(io.BytesIO(data), map_location="cpu", weights_only=True)
        if payload["metadata"] != manifest.model_dump(mode="json", exclude=EXTERNAL_FIELDS):
            raise IntegrityError("checkpoint embedded metadata differs from manifest")
        state = payload["state"]
        if seed is not None and state["seed"] != seed:
            raise IntegrityError("checkpoint seed is incompatible")
        session = TrainingSession(state["seed"])
        if manifest.dataset_fingerprint != session.dataset_fingerprint:
            raise IntegrityError("checkpoint dataset is incompatible")
        session.restore(state, manifest.step_completed)
    except IntegrityError:
        raise
    except (KeyError, TypeError, ValueError, IndexError, AttributeError, EOFError, RuntimeError,
            OverflowError, pickle.UnpicklingError) as error:
        raise IntegrityError("checkpoint state is invalid or incompatible") from error
    return session, manifest
