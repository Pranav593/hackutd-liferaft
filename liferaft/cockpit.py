"""Build a bounded, read-only browser view from saved recovery evidence."""
from datetime import datetime
import json
from pathlib import Path
from typing import Annotated

from pydantic import Field, TypeAdapter

from .config import redact, state_dir
from .contracts import Digest, Identifier
from .evidence import MAX_EXPORT_BYTES, load_export, recovery_brief, verify_journal
from .nemotron import InvestigationReport, TOOL_EVENTS, tool_events

identifier = TypeAdapter(Identifier)
digest = TypeAdapter(Digest)
model_name = TypeAdapter(Annotated[str, Field(pattern=r"^[\w.-]+/[\w.-]+$", max_length=128)])
TRIGGERS = {"RESCUE_REQUESTED", "PRIMARY_PROCESS_KILLED", "PRIMARY_UNREACHABLE", "SENSOR_EVENT_RECEIVED"}
PROGRESS = {"WORKER_HEARTBEAT", "FIRST_RESUMED_STEP_COMPLETED", "JOB_COMPLETED"}


def read_json(path):
    with path.open("rb") as stream:
        content = stream.read(MAX_EXPORT_BYTES + 1)
    if len(content) > MAX_EXPORT_BYTES:
        raise ValueError("saved file exceeds limit")
    return json.loads(content)


def step_number(value):
    return value if type(value) is int and 0 <= value <= 2**53 - 1 else None


def number(value, low=0, high=1e20):
    return value if type(value) in (int, float) and low <= value <= high else None


def checkpoint_fields(data):
    try:
        return {"checkpoint_id": identifier.validate_python(data["checkpoint_id"]),
                "hash_prefix": digest.validate_python(data["sha256"])[:12]}
    except (KeyError, ValueError):
        return {}


def project_event(event, row):
    data = event.evidence
    step = step_number(data.get("checkpoint_step" if event.event_type == "LEASE_TRANSFERRED" else "step"))
    loss = number(data.get("loss")) if event.source_type == "measured" else None
    sensor = None
    if event.event_type == "SENSOR_EVENT_RECEIVED" and data.get("device_id") == "esp32-s3-01":
        ambient = number(data.get("ambient_temp_c"), -55, 125) if data.get("ambient_valid") is True else None
        sensor = {"device": "esp32-s3-01", "button": data.get("button_pressed") is True,
                  "ambient": ambient if event.source_type == "measured" else None}
    return {"seq": row["seq"], "id": str(event.event_id), "incident": event.incident_id,
            "kind": event.event_type, "source": event.source_type, "at": event.created_utc.isoformat(),
            "worker": event.worker_id, "epoch": event.lease_epoch, "step": step, "loss": loss,
            "hash": row["event_hash"][:12], "previous_hash": row["prev_hash"][:12], "sensor": sensor,
            **checkpoint_fields(data)}


def local_losses(directory, job, rows, brief):
    """Local worker logs complement the journal; never use them to verify a rescue."""
    ranges = {}
    for row in rows:
        key = (row["worker"], row["epoch"])
        if row["kind"] == "JOB_STARTED":
            ranges[key] = (1, None)
        elif row["kind"] == "LEASE_TRANSFERRED" and brief["verified_resumed"] and row["id"] in brief["evidence_event_ids"]:
            ranges[key] = (brief["resumed"]["step"], None)
            checkpoint = brief["checkpoint"]
            old = (checkpoint["producer"], checkpoint["epoch"])
            if old in ranges:
                ranges[old] = (ranges[old][0], checkpoint["step"])
        if row["kind"] == "JOB_COMPLETED" and key in ranges and row["step"] is not None:
            ranges[key] = (ranges[key][0], row["step"])
    result = {}
    for filename in ("primary.jsonl", "standby.jsonl"):
        path = directory / filename
        if not path.is_file():
            continue
        with path.open("rb") as stream:
            content = stream.read(MAX_EXPORT_BYTES + 1)
        if len(content) > MAX_EXPORT_BYTES:
            raise ValueError("worker log exceeds limit")
        for line in content.splitlines():
            entry = json.loads(line)
            if not isinstance(entry, dict) or (entry.get("event_type"), entry.get("source_type"), entry.get("job_id")) != (
                    "TRAINING_STEP_COMPLETED", "measured", job):
                continue
            worker = identifier.validate_python(entry.get("worker_id"))
            epoch = step_number(entry.get("lease_epoch"))
            step, loss = step_number(entry.get("step_completed")), number(entry.get("loss"))
            limits = ranges.get((worker, epoch))
            if limits is None or step is None or loss is None:
                continue
            first, last = limits
            if step < first or (last is not None and step > last):
                continue
            at = datetime.fromisoformat(entry["created_utc"])
            if at.tzinfo is None:
                raise ValueError("worker log timestamp has no timezone")
            key = (worker, epoch, step)
            if key in result:
                raise ValueError("duplicate worker loss sample")
            result[key] = {"step": step, "loss": loss, "at": at.isoformat(), "worker": worker,
                           "epoch": epoch, "origin": "worker log"}
    return result


def investigation_view(path, job, events, incident):
    saved = read_json(path)
    report = InvestigationReport.model_validate(saved["report"])
    trace = saved["tool_trace"]
    if ((saved.get("event_type"), saved.get("job_id"), saved.get("source_type"), report.incident_id) !=
            ("NEMOTRON_INVESTIGATION", job, "provider", incident)
            or not isinstance(trace, list) or len(trace) != len(TOOL_EVENTS)):
        raise ValueError("investigation does not match this replay")
    tools = []
    for name, call in zip(TOOL_EVENTS, trace):
        expected = redact(tool_events(events, incident, name))
        if (call["tool"] != name or call["arguments"] != {"incident_id": incident} or call["events"] != expected):
            raise ValueError("investigation tool results differ from the journal")
        tools.append({"name": name, "event_ids": [e["event_id"] for e in expected]})
    seen = {ref for tool in tools for ref in tool["event_ids"]}
    facts = [fact.model_dump(mode="json") for fact in report.observed_facts]
    if any(ref not in seen for fact in facts for ref in fact["evidence_event_ids"]):
        raise ValueError("investigation cites unobserved evidence")
    return redact({"model": model_name.validate_python(saved["model"]), "tools": tools, "facts": facts,
                   "uncertainty": report.uncertainty, "outcome": report.verified_outcome})


def build_view(job, *, export=None, local_run=None, investigation=None):
    if local_run is not None:
        saved = read_json(local_run / "evidence.json")
        if saved["mode"] != "local" or saved["status"]["job_id"] != job:
            raise ValueError("local run does not match this job")
        entries = saved["events"]
        # Local demo saves the full report after checking the coordinator chain.
        metadata = {"events": entries, "chain_valid": True}
        events = verify_journal(metadata, job)
    else:
        events, metadata = load_export(export, job)
    rows = [project_event(event, row) for event, row in zip(events, metadata["events"])]
    if not rows:
        raise ValueError("journal contains no events")
    brief = recovery_brief(events, job)
    checkpoint = brief["checkpoint"]
    if checkpoint is not None:
        checkpoint["hash_prefix"] = checkpoint.pop("sha256")[:12]
    losses = local_losses(local_run, job, rows, brief) if local_run is not None else {}
    for row in rows:
        if row["step"] is not None and row["loss"] is not None and row["kind"] == "FIRST_RESUMED_STEP_COMPLETED":
            key = (row["worker"], row["epoch"], row["step"])
            losses[key] = {**{key: row[key] for key in ("worker", "epoch", "step", "loss", "at")}, "origin": "journal"}
    trace = None
    investigation_rejected = False
    if investigation is not None:
        try:
            trace = investigation_view(investigation, job, events, brief["incident_id"])
        except (OSError, ValueError, KeyError, TypeError, AttributeError, RecursionError):
            investigation_rejected = True
    scope = [row for row in rows if row["incident"] == brief["incident_id"]] if brief["incident_id"] else []
    trigger = next((row for row in scope if row["kind"] in TRIGGERS), None)
    progress = next((row for row in reversed(rows) if row["kind"] in PROGRESS and row["step"] is not None), None)
    return redact({"job": job, "mode": "local" if local_run is not None else "cloud",
                   "journal": {"count": len(rows), "head": rows[-1]["hash"], "at": rows[-1]["at"],
                               "anchored": metadata.get("complete") is True},
                   "recovery": brief, "events": rows, "trigger": trigger, "progress": progress,
                   "losses": sorted(losses.values(), key=lambda row: (row["epoch"], row["step"])),
                   "investigation": trace, "investigation_rejected": investigation_rejected})


def install_commands(subcommands):
    command = subcommands.add_parser("cockpit-data", help="project a saved, verified journal for the local cockpit")
    command.add_argument("--job", required=True)
    source = command.add_mutually_exclusive_group()
    source.add_argument("--events", type=Path)
    source.add_argument("--local-run", type=Path)
    command.add_argument("--investigation", type=Path)
    command.set_defaults(handler=run)


def run(args):
    try:
        job = identifier.validate_python(args.job)
        result = build_view(job, export=args.events or state_dir() / f"{job}.jsonl",
                            local_run=args.local_run, investigation=args.investigation)
        print(json.dumps(result, allow_nan=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, AttributeError, RecursionError):
        print("Saved cockpit evidence is missing, invalid, or does not match the selected job.")
        return 2
