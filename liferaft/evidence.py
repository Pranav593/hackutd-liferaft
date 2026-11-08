"""Local validation of journal bytes; hash integrity is not remote attestation."""
from hashlib import sha256
import json
import math
from pathlib import Path

from pydantic import TypeAdapter

from .artifacts import publish
from .config import log, state_dir
from .contracts import Digest, Identifier, IncidentEvent
from .coordinator import GENESIS, canonical

MAX_EXPORT_BYTES = 2 * 1024 * 1024


def verify_journal(result, job_id):
    try:
        events = result["events"]
        if result["chain_valid"] is not True or not isinstance(events, list) or result.get("complete") is False:
            raise ValueError
        parsed, ids = [], set()
        previous = GENESIS
        for seq, entry in enumerate(events, 1):
            body = {k: v for k, v in entry.items() if k not in ("seq", "prev_hash", "event_hash")}
            digest = sha256(f"{previous}\n{canonical(body)}".encode()).hexdigest()
            if type(entry["seq"]) is not int or entry["seq"] != seq or entry["prev_hash"] != previous or entry["event_hash"] != digest:
                raise ValueError
            event = IncidentEvent.model_validate(body)
            if event.job_id != job_id or event.event_id in ids:
                raise ValueError
            parsed.append(event)
            ids.add(event.event_id)
            previous = digest
        if ("head_seq" in result or "head_hash" in result) and (
                result.get("head_seq") != len(events) or result.get("head_hash") != previous):
            raise ValueError
        return parsed
    except (AttributeError, KeyError, TypeError, ValueError):
        raise ValueError("invalid, incomplete or tampered event journal") from None


def load_export(path: Path, job_id: str):
    with path.open("rb") as stream:
        raw = stream.read(MAX_EXPORT_BYTES + 1)
    if len(raw) > MAX_EXPORT_BYTES:
        raise ValueError("event export exceeds size limit")
    try:
        export = json.loads(raw)
        if export["event_type"] != "CLOUD_EVENTS" or export["job_id"] != job_id:
            raise ValueError
        events = verify_journal(export["result"], job_id)
        return events, export["result"]
    except (KeyError, TypeError, ValueError):
        raise ValueError("expected a valid hash-chained CLOUD_EVENTS export for this job") from None


def recovery_brief(events, job_id):
    """Derive continuity only from linked commit/transfer/first-step evidence."""
    incidents = [e.incident_id for e in events if e.incident_id]
    incident = incidents[-1] if incidents else None
    scoped = [e for e in events if incident and e.incident_id == incident]
    transfers = [e for e in scoped if e.event_type == "LEASE_TRANSFERRED"]
    transfer = transfers[-1] if transfers else None
    unknowns = ["Physical computer identity is not independently attested by this journal.",
                "Checkpoint bytes were not rehashed by this report; verification is coordinator-recorded."]
    result = {"job_id": job_id, "incident_id": incident, "generator": "deterministic_read_only",
              "verified_resumed": False, "completed_after_resume": False, "checkpoint": None,
              "resumed": None, "rto_ms": None, "rpo_steps": None,
              "source_types": sorted({e.source_type for e in scoped}),
              "evidence_event_ids": [], "unknowns": unknowns}
    if transfer is None:
        unknowns.append("No ownership transfer recorded for the latest incident.")
        return result
    t = transfer.evidence
    commits = [e for e in events if e.event_type == "CHECKPOINT_COMMITTED"
               and e.created_utc <= transfer.created_utc
               and e.worker_id == t.get("previous_owner") and e.lease_epoch == t.get("previous_epoch")
               and e.evidence.get("checkpoint_id") == t.get("checkpoint_id")
               and e.evidence.get("step") == t.get("checkpoint_step")
               and e.evidence.get("sha256") == t.get("sha256")]
    firsts = [e for e in scoped if e.event_type == "FIRST_RESUMED_STEP_COMPLETED"
              and e.created_utc >= transfer.created_utc and e.source_type == "measured"
              and e.worker_id == transfer.worker_id and e.lease_epoch == transfer.lease_epoch]
    step, digest = t.get("checkpoint_step"), t.get("sha256")
    try:
        TypeAdapter(Digest).validate_python(digest)
    except ValueError:
        unknowns.append("Transferred checkpoint digest is missing or invalid.")
        return result
    if (not commits or not firsts or type(step) is not int or step < 1
            or transfer.worker_id == t.get("previous_owner")
            or any(e.source_type == "simulated" for e in [*commits, transfer, *firsts])
            or type(t.get("previous_epoch")) is not int or transfer.lease_epoch != t["previous_epoch"] + 1):
        unknowns.append("Commit, ownership and measured first-step evidence is incomplete or inconsistent.")
        return result
    first = firsts[0]
    loss = first.evidence.get("loss")
    if (first.evidence.get("step") != step + 1 or first.evidence.get("sha256") != digest
            or type(loss) not in (int, float) or not math.isfinite(loss) or loss < 0):
        unknowns.append("First measured step does not match checkpoint continuity.")
        return result
    result.update(verified_resumed=True,
                  checkpoint={"checkpoint_id": t["checkpoint_id"], "step": step, "sha256": digest,
                              "producer": t["previous_owner"], "epoch": t["previous_epoch"]},
                  resumed={"worker_id": first.worker_id, "epoch": first.lease_epoch,
                           "step": first.evidence["step"], "loss": loss},
                  evidence_event_ids=[str(e.event_id) for e in (commits[-1], transfer, first)])
    rto = first.evidence.get("rto_ms")
    if type(rto) in (int, float) and math.isfinite(rto) and rto >= 0:
        result["rto_ms"] = rto
    else:
        unknowns.append("Coordinator-measured recovery time is unavailable.")
    yields = [e for e in scoped if e.event_type == "PRIMARY_YIELDED"
              and e.created_utc <= transfer.created_utc and e.worker_id == t["previous_owner"]
              and e.lease_epoch == t["previous_epoch"] and type(e.evidence.get("step")) is int
              and e.evidence["step"] >= step]
    if yields:
        result["rpo_steps"] = yields[-1].evidence["step"] - step
    else:
        unknowns.append("Primary's final completed step is unknown; crash RPO remains unknown.")
    result["completed_after_resume"] = any(
        e.event_type == "JOB_COMPLETED" and e.created_utc >= first.created_utc
        and e.worker_id == first.worker_id and e.lease_epoch == first.lease_epoch
        and type(e.evidence.get("step")) is int and e.evidence["step"] >= first.evidence["step"]
        for e in scoped)
    return result


def install_commands(subcommands):
    parser = subcommands.add_parser("evidence", help="verify a saved journal and derive a read-only recovery brief")
    parser.add_argument("--job", required=True)
    parser.add_argument("--events", type=Path)
    parser.add_argument("--output", type=Path, help="write a new JSON evidence file; never overwrite")
    parser.set_defaults(handler=run)


def run(args):
    try:
        job = TypeAdapter(Identifier).validate_python(args.job)
        events, metadata = load_export(args.events or state_dir() / f"{job}.jsonl", job)
        report = recovery_brief(events, job)
        report["journal"] = {"event_count": len(events), "head_hash": metadata.get("head_hash"),
                             "completeness": "anchored" if metadata.get("complete") is True else "legacy_unanchored"}
        if args.output:
            data = json.dumps(report, indent=2, allow_nan=False).encode() + b"\n"
            publish(args.output, lambda stream: stream.write(data))
        log("RECOVERY_EVIDENCE", source_type="derived", report=report)
        return 0
    except (OSError, ValueError) as error:
        log("RECOVERY_EVIDENCE_FAILED", reason=str(error))
        return 2
