"""Run a local, bounded failover scenario and save the observed evidence."""
from contextlib import ExitStack
import json
import math
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

from .artifacts import LocalArtifactStore
from .config import log, redact, state_dir
from .contracts import IncidentEvent, utc_now
from .failover import JobSpec, LocalFailover


def install_commands(subcommands) -> None:
    demo = subcommands.add_parser("demo", help="run a real two-process local recovery")
    demo.add_argument("--scenario", choices=("cooling-test", "worker-crash"), default="cooling-test")
    demo.set_defaults(handler=run_demo)
    worker = subcommands.add_parser("worker", help="run one worker in a prepared local run directory")
    worker.add_argument("--directory", type=Path, required=True)
    worker.add_argument("--job", required=True)
    worker.add_argument("--role", choices=("primary", "standby"), required=True)
    worker.add_argument("--worker", required=True)
    worker.add_argument("--step-sleep", type=float, default=0.12)
    worker.add_argument("--timeout", type=float, default=120)
    worker.set_defaults(handler=run_child)


def run_child(args) -> int:
    from pydantic import TypeAdapter
    from .contracts import Identifier
    from .worker import run_worker

    try:
        for identity in (args.job, args.worker):
            TypeAdapter(Identifier).validate_python(identity)
        if not 0 <= args.step_sleep <= 2 or not math.isfinite(args.timeout) or not 1 <= args.timeout <= 300:
            raise ValueError("worker sleep or deadline is out of range")
        run_worker(LocalFailover(args.directory), LocalArtifactStore(args.directory), job_id=args.job,
                   worker_id=args.worker, role=args.role, step_sleep=args.step_sleep, timeout=args.timeout)
        return 0
    except (OSError, ValueError, RuntimeError, sqlite3.Error) as error:
        log("WORKER_STOPPED", worker_id=args.worker, reason=str(error))
        return 2


def _cleanup(child: subprocess.Popen) -> None:
    if child.poll() is not None:
        return
    child.terminate()
    try:
        child.wait(timeout=3)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait(timeout=3)


def run_demo(args) -> int:
    from .workload import CONFIG_FINGERPRINT, MODEL_VERSION, make_dataset

    root = state_dir()
    root.mkdir(exist_ok=True, parents=True, mode=0o700)
    directory = Path(tempfile.mkdtemp(prefix="phase2-", dir=root))
    job_id, primary_id, standby_id = "local-job", "local-primary", "local-standby"
    coordinator = LocalFailover(directory)
    coordinator.create_job(JobSpec(
        job_id=job_id, run_id=f"run-{uuid4().hex}", primary=primary_id, seed=1729,
        target=70, checkpoint_every=10, model_version=MODEL_VERSION, config_fingerprint=CONFIG_FINGERPRINT,
        dataset_fingerprint=make_dataset(1729)[2],
    ))
    log("LOCAL_DEMO_STARTED", mode="local", scenario=args.scenario, directory=str(directory))

    with ExitStack() as stack:
        def start(role, worker_id):
            stream = stack.enter_context((directory / f"{role}.jsonl").open("x"))
            child = subprocess.Popen(
                [sys.executable, "-m", "liferaft", "worker", "--directory", str(directory),
                 "--job", job_id, "--role", role, "--worker", worker_id],
                stdout=stream, stderr=subprocess.STDOUT,
            )
            stack.callback(_cleanup, child)
            return child

        standby = start("standby", standby_id)
        fired = False
        cursor = 0
        events = []
        exit_codes = {}
        try:
            ready_deadline = time.monotonic() + 15
            while not coordinator.status(job_id)["standby_ready"]:
                if standby.poll() is not None or time.monotonic() >= ready_deadline:
                    raise RuntimeError("standby did not register before the startup deadline")
                time.sleep(0.10)
            primary = start("primary", primary_id)
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline:
                status = coordinator.status(job_id)
                for event in coordinator.events(after=cursor):
                    cursor = event["seq"]
                    events.append(event)
                    print(json.dumps(event), flush=True)
                if not fired and status["state"] == "PRIMARY_RUNNING" and 20 <= status["last_step"] < 70:
                    if args.scenario == "worker-crash":
                        if primary.poll() is not None:
                            raise RuntimeError("primary exited before crash injection")
                        primary.kill()
                        exit_codes["primary"] = primary.wait(timeout=3)
                        if exit_codes["primary"] == 0:
                            raise RuntimeError("primary exited normally before the crash could be injected")
                        coordinator.record(IncidentEvent(
                            event_id=uuid4(), job_id=job_id, worker_id=primary_id, lease_epoch=status["epoch"],
                            created_utc=utc_now(), event_type="PRIMARY_PROCESS_KILLED", source_type="injected",
                            message="Crash test killed the dedicated primary training process",
                            evidence={"exit_code": exit_codes["primary"]},
                        ))
                    else:
                        coordinator.request_rescue(job_id, uuid4())
                    fired = True
                if status["state"] == "COMPLETED":
                    exit_codes.update(primary=primary.wait(timeout=3), standby=standby.wait(timeout=3))
                    if (not fired or status["owner"] != standby_id or status["resume_step"] is None
                            or exit_codes["standby"] != 0 or not coordinator.verify_chain()):
                        raise RuntimeError("job completed without verified recovery evidence")
                    report = redact({"mode": "local", "scenario": args.scenario, "status": status,
                                     "exit_codes": exit_codes, "events": events})
                    (directory / "evidence.json").write_text(json.dumps(report, indent=2) + "\n")
                    log("LOCAL_RECOVERY_VERIFIED", mode="local", scenario=args.scenario, **status,
                        exit_codes=exit_codes, evidence_path=str(directory / "evidence.json"))
                    return 0
                if standby.poll() is not None or status["state"] == "FAILED":
                    raise RuntimeError("standby stopped before completion")
                if primary.poll() not in (None, 0) and not (fired and args.scenario == "worker-crash"):
                    raise RuntimeError("primary stopped outside the crash test")
                time.sleep(0.10)
            raise TimeoutError("local recovery did not finish by the deadline")
        except (OSError, ValueError, RuntimeError, sqlite3.Error) as error:
            log("LOCAL_RECOVERY_FAILED", reason=str(error), directory=str(directory))
            return 2
