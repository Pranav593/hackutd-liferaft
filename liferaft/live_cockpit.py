"""Local dashboard commands. Only validated coordinator evidence enters the live view."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
import secrets
import subprocess
import sys
import time
from uuid import uuid4

from dotenv import dotenv_values

from .cloud import demo_job_spec, profile_client
from .cockpit import build_view
from .config import load_environment, log, redact, state_dir
from .evidence import recovery_brief, verify_journal
from .nemotron import DEFAULT_MODEL, NemotronClient, investigate
from .photon import PhotonClient, drain
from .pi import PI_PRIMARY
from .worker_logs import activity, pane


def run_dir(job):
    return state_dir() / "live" / job


def save_json(path, payload):
    temp = path.with_suffix(".tmp")
    with temp.open("w", encoding="utf-8") as stream:
        json.dump(redact(payload), stream, allow_nan=False)
    temp.replace(path)


def provider_state(job):
    path = run_dir(job) / "providers.json"
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def snapshot(client, historical=None):
    if historical:
        launch = {"ready": {}, "run": None}
        job = historical
    else:
        try:
            launch = client.call("demo_status")
        except RuntimeError as error:
            if "HTTP 404" in str(error) or "HTTP 422" in str(error):
                raise RuntimeError("Live launch is unavailable. Deploy this coordinator revision and enable LIFERAFT_ENABLE_LIVE_DEMO and LIFERAFT_ENABLE_DRILLS on Render.") from None
            raise
        current = launch["run"]
        job = current["job"] if current and current["phase"] == "assigned" else None
    if not job:
        return {**launch, "job": None, "replay": None, "devices": [], "health": None, "providers": {}}
    with ThreadPoolExecutor(max_workers=2) as pool:
        journal_future = pool.submit(client.export_events, job)
        doctor_future = pool.submit(client.call, "doctor", job)
        journal = journal_future.result()
        health = doctor_future.result()
    trace = run_dir(job) / "investigation.json"
    view = build_view(job, journal=journal) if journal["events"] else None
    if view is not None and trace.is_file():
        try:
            advisory = json.loads(trace.read_text())
            # New records can arrive during investigation. Verify the exact
            # anchored prefix the provider used before adding its advisory.
            head = advisory["head_seq"]
            rows = journal["events"][:head]
            if not rows or rows[-1]["event_hash"] != advisory["head_hash"]:
                raise ValueError("investigation journal head does not match")
            prefix = {"events": rows, "chain_valid": True}
            verified = build_view(job, journal=prefix, investigation=trace)
            if verified["recovery"]["incident_id"] != view["recovery"]["incident_id"]:
                raise ValueError("investigation is for a different incident")
            view["investigation"] = verified["investigation"]
            view["investigation_rejected"] = verified["investigation_rejected"]
        except (OSError, ValueError, KeyError, TypeError):
            view["investigation_rejected"] = True
    rows = [item for event in journal["events"] if
            (item := activity(event, origin="verified coordinator journal"))]
    devices = [pane(worker, title, rows, now=time.time(), live=not historical) for worker, title in
               ((PI_PRIMARY, "Raspberry Pi"), ("laptop-standby", "Windows computer"))]
    return {**launch, "job": job, "replay": view, "devices": devices, "health": health,
            "providers": provider_state(job) if not historical else {}}


def start(client):
    # The trailing three digits are the training number shown on the ESP32 OLED.
    job = f"pi-live-{uuid4().hex[:8]}-{secrets.randbelow(1000):03d}"
    spec = demo_job_spec(job, PI_PRIMARY)
    try:
        result = client.call("demo_start", job, **spec.model_dump(mode="json"))
    except RuntimeError as error:
        if "HTTP 409" in str(error):
            raise RuntimeError("Start rejected: a run is active or at least one device agent stopped checking in. Check device readiness and the active job.") from None
        raise
    folder = run_dir(job)
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    try:
        with (folder / "providers.log").open("ab") as output:
            subprocess.Popen([sys.executable, "-m", "liferaft.live_cockpit", "follow", "--job", job],
                             stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                             start_new_session=True)
    except OSError:
        save_json(folder / "providers.json", {"nemotron": "Provider runner failed to start",
                                              "photon": "Provider runner failed to start"})
    return result


def follow(client, job):
    folder = run_dir(job)
    nvidia_key = os.environ.get("NVIDIA_API_KEY", "").strip()
    settings = dotenv_values(".env.photon", interpolate=False)
    photon_key = settings.get("PHOTON_API_KEY") or os.environ.get("PHOTON_API_KEY")
    states = {"nemotron": "Waiting for an incident" if nvidia_key else "NVIDIA key is missing",
              "photon": "Starting runner" if photon_key else "Photon key is missing"}
    save_json(folder / "providers.json", states)
    deadline = time.monotonic() + 300

    def run_photon():
        provider = PhotonClient(photon_key)
        photon_client = profile_client("photon")
        drain(photon_client, provider, job, deadline)

    trace = None
    attached = False
    attempted = False
    with ThreadPoolExecutor(max_workers=1) as pool:
        outgoing = pool.submit(run_photon) if photon_key else None
        while time.monotonic() < deadline:
            try:
                if outgoing:
                    if outgoing.done():
                        error = outgoing.exception()
                        states["photon"] = (str(error) or type(error).__name__) if error else "Runner ended"
                        outgoing = None
                    else:
                        states["photon"] = "Runner active. Delivery requires a signed receipt."
                if (nvidia_key and not attempted) or (trace and not attached and outgoing):
                    journal = client.export_events(job)
                    events = verify_journal(journal, job)
                    proof = recovery_brief(events, job)
                    if not attempted and proof["incident_id"]:
                        attempted = True
                        states["nemotron"] = "Investigating the verified incident"
                        save_json(folder / "providers.json", states)
                        model = os.environ.get("NVIDIA_MODEL_ID") or DEFAULT_MODEL
                        report, tools = investigate(NemotronClient(nvidia_key, model), job, events)
                        trace = {"event_type": "NEMOTRON_INVESTIGATION", "source_type": "provider", "job_id": job,
                                 "model": model, "report": report.model_dump(mode="json"), "tool_trace": tools,
                                 "head_seq": journal["head_seq"], "head_hash": journal["head_hash"]}
                        save_json(folder / "investigation.json", trace)
                        states["nemotron"] = "Investigation available"
                    if trace and not attached and outgoing and proof["verified_resumed"]:
                        incident = proof["incident_id"]
                        scoped = {str(event.event_id) for event in events if event.incident_id == incident}
                        refs = list(dict.fromkeys(ref for fact in trace["report"]["observed_facts"]
                                                 for ref in fact["evidence_event_ids"] if ref in scoped))[:4]
                        if refs:
                            # The early report is advisory. The recovery text is sourced from the proof.
                            trigger = next(event for event in events if event.incident_id == incident
                                           and event.event_type in {"RESCUE_REQUESTED", "PRIMARY_UNREACHABLE"})
                            trigger_ref = str(trigger.event_id)
                            facts = trace["report"]["observed_facts"]
                            explanation = next((fact["text"] for fact in facts
                                                if trigger_ref in fact["evidence_event_ids"]), None)
                            summary = (f"Verified resume on {proof['resumed']['worker_id']} at step "
                                       f"{proof['resumed']['step']}.")
                            if explanation:
                                summary = f"{summary} Nemotron: {explanation}"[:400]
                            attached = bool(profile_client("photon").call(
                                "photon_context", job, incident=incident, summary=summary, refs=refs))
                save_json(folder / "providers.json", states)
            except (OSError, RuntimeError, ValueError) as error:
                log("LIVE_PROVIDER_CHECK_FAILED", job_id=job, reason=str(error) or type(error).__name__)
                states["nemotron" if attempted and trace is None else "diagnostic"] = str(error) or type(error).__name__
                save_json(folder / "providers.json", states)
            if (attempted or not nvidia_key) and not outgoing:
                break
            time.sleep(3)


def main():
    load_environment()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("snapshot", "start", "follow"))
    parser.add_argument("--job")
    args = parser.parse_args()
    try:
        from .cockpit import identifier
        job = identifier.validate_python(args.job) if args.job else None
        client = profile_client("operator")
        if args.command == "follow":
            follow(client, job)
        else:
            value = snapshot(client, job) if args.command == "snapshot" else start(client)
            print(json.dumps(redact(value), allow_nan=False))
    except (OSError, RuntimeError, ValueError) as error:
        print(json.dumps({"error": redact(str(error)) or type(error).__name__}))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
