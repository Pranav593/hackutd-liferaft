"""Run an isolated training worker against a coordinator and artifact store."""
import platform
import time
from uuid import uuid4

from .artifacts import IntegrityError, LocalArtifactStore
from .checkpoint import restore, save
from .config import log
from .contracts import WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from .failover import HEARTBEAT_S, WorkerCoordinator
from .workload import TrainingSession


def run_worker(coordinator: WorkerCoordinator, store: LocalArtifactStore, *, job_id: str,
               worker_id: str, role: str, step_sleep: float, timeout: float,
               poll_s: float = 0.25, fetch_checkpoint=None) -> None:
    spec = coordinator.get_spec(job_id)
    deadline = time.monotonic() + timeout
    candidate = None
    if role == "primary":
        session = TrainingSession(spec.seed)
        started = time.monotonic()
        plan = coordinator.start_primary(job_id, worker_id)
        if plan.action != "RUN":
            raise RuntimeError("primary lease denied")
    else:
        next_registration = 0.0
        while time.monotonic() < deadline:
            if time.monotonic() >= next_registration:
                coordinator.register_standby(job_id, worker_id)
                next_registration = time.monotonic() + HEARTBEAT_S
            for offered in coordinator.checkpoint_candidates(job_id, worker_id):
                try:
                    path = fetch_checkpoint(offered) if fetch_checkpoint else store.path_for(offered.path)
                    session, candidate = restore(path, job_id=job_id,
                                                 run_id=spec.run_id, seed=spec.seed,
                                                 trusted_manifest=offered)
                except (IntegrityError, OSError):
                    continue
                started = time.monotonic()
                plan = coordinator.claim_standby(job_id, worker_id, offered.lease_epoch, offered.checkpoint_id)
                if plan.action == "RUN":
                    break
                candidate = None
            if candidate is not None:
                break
            time.sleep(poll_s)
        else:
            raise TimeoutError("standby deadline reached without a verified checkpoint lease")
        log("STANDBY_CHECKPOINT_RESTORED", worker_id=worker_id, job_id=job_id, step=session.step,
            sha256=candidate.sha256)

    epoch = plan.lease_epoch
    expires = started + plan.lease_remaining_s
    next_heartbeat = started + HEARTBEAT_S
    last_checkpoint = None

    def save_if_needed():
        nonlocal last_checkpoint
        if last_checkpoint is None or last_checkpoint.step_completed != session.step:
            manifest, _ = save(session, store, job_id=job_id, run_id=spec.run_id,
                               worker_id=worker_id, lease_epoch=epoch)
            if not coordinator.commit_checkpoint(manifest):
                raise RuntimeError("checkpoint commit denied")
            last_checkpoint = manifest
        return last_checkpoint

    while session.step < spec.target:
        now = time.monotonic()
        if now >= min(deadline, expires):
            raise TimeoutError("worker stopped at its lease or run deadline")
        if now >= next_heartbeat:
            plan = coordinator.heartbeat(WorkerHeartbeat(
                request_id=uuid4(), job_id=job_id, worker_id=worker_id, lease_epoch=epoch,
                client_utc=utc_now(), step_completed=session.step, status="RUNNING",
                system=WorkerSystem(os=platform.system(), arch=platform.machine()),
                checkpoint=WorkerCheckpoint(last_committed_id=last_checkpoint.checkpoint_id if last_checkpoint else None),
            ))
            if plan.action == "STOP" or plan.lease_epoch != epoch:
                raise RuntimeError("worker lease renewal denied")
            expires = now + plan.lease_remaining_s
            next_heartbeat = now + HEARTBEAT_S
            if plan.action == "PAUSE" and session.step:
                manifest = save_if_needed()
                if coordinator.yield_or_pause(job_id, worker_id, epoch, manifest.checkpoint_id):
                    return
            if time.monotonic() >= expires:
                raise TimeoutError("worker stopped at its lease deadline")
        loss, elapsed_ms = session.advance()
        if candidate is not None:
            if not coordinator.mark_first_resumed_step(job_id, worker_id, epoch, session.step, loss, candidate.sha256):
                raise RuntimeError("first resumed step rejected")
            candidate = None
        log("TRAINING_STEP_COMPLETED", source_type="measured", job_id=job_id, worker_id=worker_id,
            lease_epoch=epoch, step_completed=session.step, loss=loss, elapsed_ms=elapsed_ms)
        if session.step % spec.checkpoint_every == 0 or session.step == spec.target:
            save_if_needed()
        if step_sleep and session.step < spec.target:
            time.sleep(step_sleep)
    if not coordinator.complete(job_id, worker_id, epoch):
        raise RuntimeError("job completion denied")
