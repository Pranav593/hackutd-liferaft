"""Run an isolated training worker against a coordinator and artifact store."""
from concurrent.futures import ThreadPoolExecutor
import platform
import time
from uuid import uuid4

from .artifacts import IntegrityError, LocalArtifactStore
from .checkpoint import restore, save
from .config import log
from .contracts import AdaptiveHeartbeat, WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from .failover import HEARTBEAT_S, WorkerCoordinator
from .pi import PI_PRIMARY, guarded_temperature
from .risk import MIN_INTERVAL
from .workload import TrainingSession


def run_worker(coordinator: WorkerCoordinator, store: LocalArtifactStore, *, job_id: str,
               worker_id: str, role: str, step_sleep: float, timeout: float,
               poll_s: float = 0.25, fetch_checkpoint=None, adaptive=False) -> None:
    spec = coordinator.get_spec(job_id)
    deadline = time.monotonic() + timeout
    candidate = None
    pi_worker = worker_id == PI_PRIMARY
    if pi_worker:
        guarded_temperature()
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
    last_checkpoint_step = session.step
    checkpoint_ms = step_wall_ms = None
    checkpoint_interval = spec.checkpoint_every
    optimizer_ms = 0.0
    measured_steps = 0

    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="checkpoint") if adaptive else None
    pending = None

    def commit_saved(manifest, started_save):
        if not coordinator.commit_checkpoint(manifest):
            raise RuntimeError("checkpoint commit denied")
        return manifest, (time.monotonic() - started_save) * 1000

    def record_commit(result):
        nonlocal last_checkpoint, checkpoint_ms
        last_checkpoint, checkpoint_ms = result
        log("CHECKPOINT_COST", source_type="measured", job_id=job_id, worker_id=worker_id,
            step_completed=last_checkpoint.step_completed, checkpoint_ms=checkpoint_ms, interval=checkpoint_interval)

    def settle(*, block=False):
        nonlocal pending
        if pending is not None and (block or pending.done()):
            remaining = min(deadline, expires) - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("worker lease or run deadline expired during checkpoint")
            record_commit(pending.result(timeout=remaining))
            pending = None

    def save_if_needed(*, block=False):
        nonlocal pending, last_checkpoint_step
        settle(block=block)
        if pending is None and (last_checkpoint is None or last_checkpoint.step_completed != session.step):
            started_save = time.monotonic()
            if started_save >= min(deadline, expires):
                raise TimeoutError("worker stopped before starting a checkpoint outside its lease")
            # Serialize the exact model/RNG snapshot on the training thread.
            manifest, _ = save(session, store, job_id=job_id, run_id=spec.run_id,
                               worker_id=worker_id, lease_epoch=epoch)
            last_checkpoint_step = session.step
            if executor is not None and not block:
                pending = executor.submit(commit_saved, manifest, started_save)
            else:
                record_commit(commit_saved(manifest, started_save))
        return last_checkpoint

    try:
        while session.step < spec.target:
            now = time.monotonic()
            if now >= min(deadline, expires):
                raise TimeoutError("worker stopped at its lease or run deadline")
            settle()
            if now >= next_heartbeat:
                # A commit from an earlier step must settle before publishing later progress.
                settle(block=True)
                now = time.monotonic()
                if now >= min(deadline, expires):
                    raise TimeoutError("worker stopped before renewing an expired lease")
                temp = guarded_temperature() if pi_worker else None
                if measured_steps:
                    step_wall_ms = min(30_000, max(0.001, optimizer_ms / measured_steps + step_sleep * 1000))
                heartbeat_type = AdaptiveHeartbeat if adaptive else WorkerHeartbeat
                metrics = {"checkpoint_ms": min(30_000, checkpoint_ms) if checkpoint_ms is not None else None,
                           "step_wall_ms": step_wall_ms} if adaptive else {}
                plan = coordinator.heartbeat(heartbeat_type(
                    request_id=uuid4(), job_id=job_id, worker_id=worker_id, lease_epoch=epoch,
                    client_utc=utc_now(), step_completed=session.step, status="RUNNING",
                    system=WorkerSystem(os=platform.system(), arch=platform.machine(),
                                        pi_cpu_temp_c=temp, cpu_temp_valid=temp is not None),
                    checkpoint=WorkerCheckpoint(last_committed_id=last_checkpoint.checkpoint_id if last_checkpoint else None),
                    **metrics,
                ))
                if plan.action == "STOP" or plan.lease_epoch != epoch:
                    raise RuntimeError("worker lease renewal denied")
                expires = now + plan.lease_remaining_s
                next_heartbeat = now + HEARTBEAT_S
                optimizer_ms, measured_steps = 0.0, 0
                if adaptive and plan.checkpoint_interval is not None:
                    if not min(MIN_INTERVAL, spec.checkpoint_every) <= plan.checkpoint_interval <= spec.checkpoint_every:
                        raise RuntimeError("coordinator returned an unsafe checkpoint interval")
                    checkpoint_interval = plan.checkpoint_interval
                if plan.action == "PAUSE" and session.step:
                    manifest = save_if_needed(block=True)
                    if not coordinator.yield_or_pause(job_id, worker_id, epoch, manifest.checkpoint_id):
                        raise RuntimeError("coordinator rejected the requested yield")
                    return
                if time.monotonic() >= expires:
                    raise TimeoutError("worker stopped at its lease deadline")
            loss, elapsed_ms = session.advance()
            optimizer_ms += elapsed_ms
            measured_steps += 1
            if candidate is not None:
                if not coordinator.mark_first_resumed_step(job_id, worker_id, epoch, session.step, loss, candidate.sha256):
                    raise RuntimeError("first resumed step rejected")
                candidate = None
            log("TRAINING_STEP_COMPLETED", source_type="measured", job_id=job_id, worker_id=worker_id,
                lease_epoch=epoch, step_completed=session.step, loss=loss, elapsed_ms=elapsed_ms)
            due = (session.step - last_checkpoint_step >= checkpoint_interval if adaptive
                   else session.step % spec.checkpoint_every == 0)
            if due or session.step == spec.target:
                save_if_needed(block=session.step == spec.target)
            if step_sleep and session.step < spec.target:
                time.sleep(step_sleep)
        if not coordinator.complete(job_id, worker_id, epoch):
            raise RuntimeError("job completion denied")
    finally:
        if executor is not None:
            executor.shutdown(wait=True, cancel_futures=True)
