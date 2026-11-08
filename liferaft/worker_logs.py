"""Read-only device activity. Terminal mirrors never establish recovery proof."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import re
import sqlite3
import subprocess
import time
from uuid import uuid4

from dotenv import dotenv_values
from pydantic import TypeAdapter

from .config import capture_worker_logs, log, state_dir
from .contracts import Identifier, utc_now
from .evidence import load_export, verify_journal

IDENTITY = TypeAdapter(Identifier)
KINDS = {"WORKER_SESSION_STARTED", "WORKER_SESSION_ENDED", "WORKER_SESSION_FAILED",
         "TRAINING_STEP_COMPLETED", "CHECKPOINT_COST", "STANDBY_CHECKPOINT_RESTORED",
         "JOB_STARTED", "STANDBY_REGISTERED", "WORKER_HEARTBEAT", "PI_CPU_TELEMETRY",
         "CHECKPOINT_COMMITTED", "CHECKPOINT_REJECTED", "PRIMARY_PAUSE_REQUESTED",
         "PRIMARY_YIELDED", "LEASE_TRANSFERRED", "FIRST_RESUMED_STEP_COMPLETED",
         "STALE_LEASE_REJECTED", "JOB_COMPLETED", "PRIMARY_UNREACHABLE"}


@contextmanager
def capture_session(job, worker):
    root = state_dir() / "worker-logs"
    try:
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = root / f"{worker}-{uuid4().hex}.jsonl"
        # Create privately before the logger opens its append handle.
        path.touch(mode=0o600, exist_ok=False)
    except OSError:
        yield
        return
    with capture_worker_logs(path):
        log("WORKER_SESSION_STARTED", job_id=job, worker_id=worker,
            os=platform.system(), arch=platform.machine())
        try:
            yield
        except BaseException:
            log("WORKER_SESSION_FAILED", job_id=job, worker_id=worker)
            raise
        else:
            log("WORKER_SESSION_ENDED", job_id=job, worker_id=worker)


def read_lines(path):
    """Bounded tail, tolerant of a partially written final line."""
    with path.open("rb") as stream:
        size = stream.seek(0, 2)
        offset = max(0, size - 128 * 1024)
        stream.seek(offset)
        raw = stream.read(128 * 1024)
    lines = raw.splitlines()
    if offset and lines:
        lines = lines[1:]
    rows = []
    for line in lines[-500:]:
        try:
            row = json.loads(line)
            if isinstance(row, dict):
                rows.append(row)
        except (ValueError, UnicodeDecodeError):
            continue
    return rows


def activity(row, *, origin):
    """Whitelist fields; never relay raw terminal text or provider payloads."""
    kind = row.get("event_type")
    if kind not in KINDS:
        return None
    if kind in {"TRAINING_STEP_COMPLETED", "FIRST_RESUMED_STEP_COMPLETED", "PI_CPU_TELEMETRY"} and row.get("source_type") != "measured":
        return None
    try:
        worker = IDENTITY.validate_python(row.get("worker_id"))
        job = IDENTITY.validate_python(row.get("job_id"))
        at = datetime.fromisoformat(row["created_utc"])
        if at.utcoffset() is None:
            return None
    except (ValueError, TypeError, KeyError):
        return None
    evidence = row.get("evidence", row)
    if not isinstance(evidence, dict):
        return None
    metrics = {}
    for key in ("step", "step_completed", "loss", "elapsed_ms", "checkpoint_ms", "pi_cpu_temp_c"):
        value = evidence.get(key)
        if type(value) in (int, float) and 0 <= value <= 1e10:
            metrics[key] = value
    system = evidence.get("os")
    if system in {"Linux", "Windows", "Darwin"}:
        metrics["os"] = system
    epoch = row.get("lease_epoch")
    if type(epoch) is int and 0 <= epoch <= 2**53 - 1:
        metrics["epoch"] = epoch
    return {"job": job, "worker": worker, "at": at.astimezone(timezone.utc).isoformat(),
            "kind": kind, "source": row.get("source_type") if row.get("source_type") in
            {"measured", "derived", "injected", "simulated", "provider"} else "unknown",
            "origin": origin, "metrics": metrics}


def local_sessions(root):
    directory = root / "worker-logs"
    if not directory.is_dir():
        return []
    files = sorted(directory.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:12]
    return [item for path in files for row in read_lines(path)
            if (item := activity(row, origin="local worker log"))]


def choose_job(rows, explicit=None):
    if explicit:
        return IDENTITY.validate_python(explicit)
    newest = sorted(rows, key=lambda row: row["at"], reverse=True)
    return newest[0]["job"] if newest else None


def active_process_job():
    """Inspect only worker commands, retain only the validated job ID, never log argv."""
    try:
        if os.name == "nt":
            result = subprocess.run([
                "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name LIKE 'python%.exe'\" | "
                "Where-Object { $_.CommandLine -match '-m\\s+liferaft\\s+cloud' } | "
                "Sort-Object CreationDate -Descending | Select-Object -First 16 -ExpandProperty CommandLine",
            ], capture_output=True, timeout=2, creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            result = subprocess.run(["ps", "-u", str(os.getuid()), "-o", "args="], capture_output=True, timeout=2)
        if len(result.stdout) > 1024 * 1024:
            return None
        for command in result.stdout.decode(errors="replace").splitlines():
            if not re.search(r"-m\s+liferaft\s+cloud\s+", command) or not re.search(r"\sworker(?:\s|$)", command):
                continue
            match = re.search(r"(?:^|\s)--job(?:\s+|=)[\"']?([a-zA-Z0-9][a-zA-Z0-9_-]{0,95})(?=[\"']?(?:\s|$))", command)
            if match:
                return IDENTITY.validate_python(match[1])
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return None


def discover_exports(root):
    files = list(root.glob("*.jsonl"))[:100]
    for path in sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)[:12]:
        try:
            for row in read_lines(path):
                if row.get("event_type") == "CLOUD_EVENTS":
                    job = IDENTITY.validate_python(row.get("job_id"))
                    events, _ = load_export(path, job)
                    return job, [a for e in events if (a := activity(e.model_dump(mode="json"), origin="saved coordinator journal"))]
        except (OSError, ValueError):
            continue
    return None, []


def pane(worker, title, rows, *, now, live):
    selected = sorted((row for row in rows if row["worker"] == worker), key=lambda r: r["at"])[-100:]
    last = selected[-1] if selected else None
    age = max(0, now - datetime.fromisoformat(last["at"]).timestamp()) if last else None
    ended = last and last["kind"] in {"WORKER_SESSION_ENDED", "JOB_COMPLETED", "PRIMARY_YIELDED"}
    failed = last and last["kind"] == "WORKER_SESSION_FAILED"
    state = "waiting" if not last else "saved" if not live else "finished" if ended else "active" if age <= 15 else "stale"
    if live and failed:
        state = "failed"
    return {"worker": worker, "title": title, "state": state, "age_s": age, "rows": selected}


def build_feed(*, root=None, now=None, client=None):
    root = Path(root) if root is not None else state_dir()
    now = time.time() if now is None else now
    rows = local_sessions(root)
    job = choose_job([], os.environ.get("LIFERAFT_LOG_JOB")) or active_process_job() or choose_job(rows)
    mode, notice = "waiting", "Waiting for a worker to start. Job selection is automatic."
    live = bool(rows)
    if rows:
        mode, notice = "local", "Local terminal output. Remote activity requires the coordinator read credential."
    if job and not rows:
        notice = "Job detected from a running worker or explicit setting. Waiting for authenticated device activity."
    if not job:
        job, saved = discover_exports(root)
        rows.extend(saved)
        if saved:
            mode, notice = "saved", "Saved coordinator events, not a running training session."
    settings = dotenv_values(".env.operator", interpolate=False)
    url = settings.get("LIFERAFT_CLOUD_URL") or os.environ.get("LIFERAFT_CLOUD_URL", "")
    credential = settings.get("LIFERAFT_CLOUD_TOKEN") or os.environ.get("LIFERAFT_OPERATOR_READ_TOKEN", "")
    if job and (client is not None or (url and credential)):
        try:
            if client is None:
                from .cloud import CloudClient
                client = CloudClient(url, credential)
            export = client.export_events(job)
            events = verify_journal(export, job)
            remote = [a for e in events if (a := activity(e.model_dump(mode="json"), origin="coordinator journal"))]
            rows.extend(remote)
            live, mode = True, "cloud"
            notice = "Polling authenticated coordinator activity. Heartbeats report training progress every ~2 seconds; this is not remote shell output."
        except (RuntimeError, OSError, ValueError):
            notice = "Coordinator unavailable or read permission denied. Available local/saved logs remain visible."
    else:
        notice += " Remote Pi activity needs the operator read credential in .env.operator."
    rows = [row for row in rows if row["job"] == job]
    unique = {(r["worker"], r["at"], r["kind"], r["origin"]): r for r in rows}
    rows = list(unique.values())
    windows = os.environ.get("LIFERAFT_LOG_WINDOWS_WORKER", "laptop-standby")
    IDENTITY.validate_python(windows)
    return {"job": job, "mode": mode, "notice": notice, "checked_at": utc_now().isoformat(),
            "devices": [pane("pi-primary", "Raspberry Pi", rows, now=now, live=live),
                        pane(windows, "Windows computer", rows, now=now, live=live)],
            "other_workers": sorted({r["worker"] for r in rows} - {"pi-primary", windows})}


if __name__ == "__main__":
    try:
        print(json.dumps(build_feed(), allow_nan=False))
    except (OSError, ValueError, sqlite3.Error):
        print(json.dumps({"error": "Worker activity unavailable; no logs were verified."}))
        raise SystemExit(2)
