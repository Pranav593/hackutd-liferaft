"""CLI for real local training and continuation from an owned checkpoint."""
import sys
import time
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from .artifacts import IntegrityError, LocalArtifactStore
from .config import log, redact, state_dir


def install_commands(subcommands) -> None:
    for command in ("train", "resume"):
        parser = subcommands.add_parser(command, help=f"{command} a real CPU training job")
        parser.add_argument("--mode", choices=("local",), default="local")
        parser.add_argument("--steps", type=int, default=200, help="total target step")
        parser.add_argument("--checkpoint-every", type=int, default=10)
        parser.add_argument("--step-sleep", type=float, default=0)
        parser.add_argument("--seed", type=int, default=1729 if command == "train" else None)
        parser.add_argument("--job", default="demo-job-001" if command == "train" else None)
        parser.add_argument("--worker", default="local-primary" if command == "train" else "local-standby")
        if command == "resume":
            parser.add_argument("--checkpoint", type=Path, required=True)
        parser.set_defaults(handler=run)


def run(args) -> int:
    try:
        from .checkpoint import restore, save
        from .workload import MAX_STEPS, TrainingSession
    except ImportError as error:
        print(f"Training dependencies unavailable ({error.name}). See README.md.", file=sys.stderr)
        return 2

    try:
        from pydantic import TypeAdapter
        from .contracts import Identifier

        TypeAdapter(Identifier).validate_python(args.worker)
        if args.job is not None:
            TypeAdapter(Identifier).validate_python(args.job)
        if not (1 <= args.steps <= MAX_STEPS and 1 <= args.checkpoint_every <= MAX_STEPS
                and 0 <= args.step_sleep <= 2):
            raise ValueError("steps and checkpoint interval must be 1–10000, sleep must be 0–2 seconds")
        store = LocalArtifactStore(state_dir())
        if args.command == "train":
            session = TrainingSession(args.seed)
            job_id, run_id = args.job, f"run-{uuid4().hex}"
        else:
            session, manifest = restore(args.checkpoint, job_id=args.job, seed=args.seed)
            job_id, run_id = manifest.job_id, manifest.run_id
            log("CHECKPOINT_INTEGRITY_VERIFIED", job_id=job_id, worker_id=args.worker,
                step_completed=session.step, sha256=manifest.sha256)
        if session.step >= args.steps:
            raise ValueError("target step must exceed the completed checkpoint step")
        first_step = session.step + 1
        log("JOB_STARTED" if args.command == "train" else "LOCAL_RESUME_STARTED",
            job_id=job_id, run_id=run_id, worker_id=args.worker, first_step=first_step)
        while session.step < args.steps:
            loss, elapsed_ms = session.advance()
            log("TRAINING_STEP_COMPLETED", source_type="measured", job_id=job_id, run_id=run_id,
                worker_id=args.worker, step_completed=session.step, loss=loss, elapsed_ms=elapsed_ms)
            if session.step % args.checkpoint_every == 0 or session.step == args.steps:
                manifest, artifact = save(session, store, job_id=job_id, run_id=run_id,
                                          worker_id=args.worker, lease_epoch=0)
                log("CHECKPOINT_VERIFIED", job_id=job_id, run_id=run_id, worker_id=args.worker,
                    step_completed=session.step, sha256=manifest.sha256, size_bytes=manifest.size_bytes,
                    path=str(artifact))
            if args.step_sleep:
                time.sleep(args.step_sleep)
        return 0
    except (IntegrityError, ValidationError, OSError, ValueError) as error:
        message = "checkpoint manifest or arguments failed validation" if isinstance(error, ValidationError) else str(error)
        print(redact(f"Training refused: {message}"), file=sys.stderr)
        return 2
