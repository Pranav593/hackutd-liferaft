"""Prepare disposable, genuine local evidence for the read-only story cockpit.

Run: python -m liferaft.rehearsal --all
No provider calls, network writes, GPIO or machine shutdowns.
"""
import argparse
from contextlib import ExitStack
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from uuid import uuid4

from .agent import execute_tool
from .artifacts import LocalArtifactStore, publish
from .config import state_dir
from .contracts import CheckpointManifest, IncidentEvent, utc_now
from .failover import JobSpec, LocalFailover
from .forecast import forecast_failure
from .notify import MockTransport
from .scenario import _cleanup
from .telemetry import cooling_sample

SCENARIOS = ("cooling", "crash", "corrupt", "zombie")
JOB = "local-job"


def record(coordinator, kind, evidence, source="derived"):
    status = coordinator.status(JOB)
    coordinator.record(IncidentEvent(
        event_id=uuid4(), job_id=JOB, worker_id=status["owner"], lease_epoch=status["epoch"],
        incident_id=status["incident_id"], created_utc=utc_now(), event_type=kind,
        source_type=source, message=kind.replace("_", " ").capitalize(), evidence=evidence,
    ))


def read_manifests(coordinator):
    with coordinator.transaction() as db:
        return [CheckpointManifest.model_validate_json(row[0]) for row in db.execute(
            "SELECT manifest FROM checkpoints WHERE job_id=? ORDER BY epoch, step", (JOB,))]


def tool(coordinator, name, arguments, operation):
    result = execute_tool(name, arguments, operation)
    record(coordinator, "REHEARSAL_TOOL_RESULT", result.model_dump(mode="json"))
    return result.result


def ghost_proof(coordinator, directory):
    from .checkpoint import restore
    from .workload import TrainingSession
    import torch

    spec = coordinator.get_spec(JOB)
    final = read_manifests(coordinator)[-1]
    recovered, _ = restore(LocalArtifactStore(directory).path_for(final.path),
                           job_id=JOB, run_id=spec.run_id, seed=spec.seed, trusted_manifest=final)
    baseline = TrainingSession(spec.seed)
    for _ in range(spec.target):
        baseline.advance()
    divergence = max(abs(a - b) for a, b in zip(baseline.losses, recovered.losses))
    weights_equal = all(torch.equal(a, b) for a, b in zip(baseline.model.parameters(), recovered.model.parameters()))
    if divergence != 0 or not weights_equal:
        raise RuntimeError("same-host ghost equivalence failed")
    return {"max_divergence": divergence, "weights_equal": weights_equal,
            "compared_steps": spec.target, "baseline": baseline.losses, "recovered": recovered.losses,
            "sha256": final.sha256, "scope": "same_host_cpu", "seed": spec.seed}


def prepare(scenario):
    from .workload import CONFIG_FINGERPRINT, MODEL_VERSION, make_dataset

    root = state_dir() / "rehearsal"
    root.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix=f"{scenario}-", dir=root)).resolve()
    coordinator = LocalFailover(directory)
    store = LocalArtifactStore(directory)
    coordinator.create_job(JobSpec(
        job_id=JOB, run_id=f"run-{uuid4().hex}", primary="local-primary", seed=1729,
        target=100, checkpoint_every=10, model_version=MODEL_VERSION,
        config_fingerprint=CONFIG_FINGERPRINT, dataset_fingerprint=make_dataset(1729)[2],
    ))
    record(coordinator, "REHEARSAL_STARTED", {"scenario": scenario, "scope": "same_host_two_process",
                                             "planner": "deterministic_fallback", "messaging": "mock"})
    samples, fired, zombie_tested = [], False, False
    started_trend = next_sample = None
    with ExitStack() as stack:
        def start(role):
            stream = stack.enter_context((directory / f"{role}.jsonl").open("x"))
            child = subprocess.Popen([sys.executable, "-m", "liferaft", "worker", "--directory", str(directory),
                                      "--job", JOB, "--role", role, "--worker", f"local-{role}",
                                      "--step-sleep", "0.1", "--timeout", "90"], stdout=stream, stderr=subprocess.STDOUT)
            stack.callback(_cleanup, child)
            return child

        standby = start("standby")
        deadline = time.monotonic() + 18
        while not coordinator.status(JOB)["standby_ready"]:
            if standby.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError("standby startup failed")
            time.sleep(0.1)
        primary = start("primary")
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline:
            status = coordinator.status(JOB)
            now = time.monotonic()
            if not fired and status["state"] == "PRIMARY_RUNNING" and status["last_step"] >= 10:
                if scenario == "cooling":
                    if started_trend is None:
                        started_trend = next_sample = now
                    if now >= next_sample:
                        sample = cooling_sample(now - started_trend)
                        samples.append(sample)
                        record(coordinator, "REHEARSAL_TELEMETRY", sample.model_dump(mode="json"), "injected")
                        forecast = forecast_failure(samples, now_s=now - started_trend)
                        record(coordinator, "FAILURE_FORECAST", forecast.model_dump(mode="json"))
                        next_sample = now + 1
                        if forecast.eligible:
                            tool(coordinator, "read_telemetry", {"worker": "local-primary"},
                                 lambda: {"samples": [s.model_dump() for s in samples], "source_type": "injected"})
                            tool(coordinator, "forecast_failure", {"worker": "local-primary"},
                                 lambda: forecast.model_dump())
                            tool(coordinator, "rank_workers", {"candidates": ["local-standby"]},
                                 lambda: {"selected": "local-standby", "ready": status["standby_ready"],
                                          "temperature_headroom": None, "network_latency_ms": None,
                                          "reason": "only registered fresh standby; no invented health scores"})
                            tool(coordinator, "choose_checkpoint_policy", {"risk": "elevated"},
                                 lambda: {"recommended_interval": 2, "applied": False,
                                          "reason": "advisory; this drill uses the existing 10-step worker"})
                            record(coordinator, "REHEARSAL_MESSAGE", MockTransport().send(
                                f"TEST cooling fault. Thermal limit estimate {forecast.seconds_to_limit:.0f}s; "
                                "injected readings. Plan: checkpoint, yield, verify, resume on local-standby. "
                                "Rehearsal auto-execute: 0s. APPROVE / HOLD / ROLLBACK are offline previews."
                            ).model_dump(), "simulated")
                            coordinator.request_rescue(JOB, uuid4())
                            fired = True
                elif status["last_step"] >= 20:
                    if scenario in ("crash", "corrupt"):
                        primary.kill()
                        code = primary.wait(timeout=3)
                        record(coordinator, "PRIMARY_PROCESS_KILLED", {"exit_code": code}, "injected")
                        if scenario == "corrupt":
                            manifest = read_manifests(coordinator)[-1]
                            # Only our newly created disposable test run is damaged, never external storage.
                            path = store.path_for(manifest.path)
                            data = path.read_bytes()
                            path.write_bytes(bytes([data[0] ^ 1]) + data[1:])
                            record(coordinator, "CHECKPOINT_CORRUPTION_INJECTED", {
                                "checkpoint_id": manifest.checkpoint_id, "step": manifest.step_completed,
                                "scope": "disposable_local_drill_only"}, "injected")
                    else:
                        coordinator.request_rescue(JOB, uuid4())
                    fired = True
            if scenario == "zombie" and status["epoch"] >= 2 and not zombie_tested:
                old = next(m for m in read_manifests(coordinator) if m.lease_epoch == 1)
                accepted = coordinator.commit_checkpoint(old)
                if accepted:
                    raise RuntimeError("stale-epoch checkpoint was accepted")
                record(coordinator, "ZOMBIE_PROBE_COMPLETED", {"accepted": accepted, "presented_epoch": 1,
                                                              "active_epoch": status["epoch"]}, "injected")
                zombie_tested = True
            if status["state"] == "COMPLETED":
                standby.wait(timeout=3)
                if not fired or status["owner"] != "local-standby" or standby.returncode != 0:
                    raise RuntimeError("completed without standby recovery")
                break
            if standby.poll() is not None or status["state"] == "FAILED":
                raise RuntimeError(f"worker failed; inspect private logs in {directory}")
            time.sleep(0.1)
        else:
            raise TimeoutError("rehearsal exceeded bounded deadline")
    selected = next(e for e in coordinator.events() if e["event_type"] == "CHECKPOINT_SELECTED")
    manifest = next(m for m in read_manifests(coordinator) if m.checkpoint_id == selected["evidence"]["checkpoint_id"])
    tool(coordinator, "verify_checkpoint", {"checkpoint_id": manifest.checkpoint_id},
         lambda: {"verified": bool(store.verified_bytes(manifest)), "sha256": manifest.sha256,
                  "step": manifest.step_completed})
    proof = tool(coordinator, "verify_continuity", {"seed": 1729}, lambda: ghost_proof(coordinator, directory))
    brief = tool(coordinator, "write_handoff_brief", {"job_id": JOB}, lambda: {
        "text": f"{scenario.upper()} drill: local-primary → local-standby, epoch {status['epoch']}. "
                f"Resumed at {status['resume_step']}; completed 100 real optimizer updates. "
                f"Ghost divergence {proof['max_divergence']:.6f}; "
                f"RPO {status['rpo_steps'] if status['rpo_steps'] is not None else 'unknown'} steps. "
                "Same host, two processes. Next: inspect hardware separately; retain epoch fence."})
    record(coordinator, "REHEARSAL_MESSAGE", MockTransport().send(brief["text"]).model_dump(), "simulated")
    if not coordinator.verify_chain():
        raise RuntimeError("journal chain verification failed")
    publish(directory / "evidence.json", lambda out: out.write(json.dumps({
        "mode": "local", "scenario": scenario, "status": coordinator.status(JOB),
        "events": coordinator.events(),
    }, allow_nan=False).encode()))
    # Publish only a pointer. The read API rechecks the authoritative database on every load.
    pointer = root / f".{scenario}-{uuid4().hex}.json"
    publish(pointer, lambda out: out.write(json.dumps({"directory": str(directory)}).encode()))
    pointer.replace(root / f"{scenario}.json")
    print(json.dumps({"scenario": scenario, "directory": str(directory), "rto_ms": status["rto_ms"],
                      "rpo_steps": status["rpo_steps"], "divergence": proof["max_divergence"],
                      "chain_valid": True}), flush=True)


def projection(scenario):
    root = (state_dir() / "rehearsal").resolve()
    directory = Path(json.loads((root / f"{scenario}.json").read_text())["directory"]).resolve()
    if directory.parent != root or not directory.name.startswith(f"{scenario}-"):
        raise ValueError("rehearsal pointer is outside disposable storage")
    coordinator = LocalFailover(directory)
    if not coordinator.verify_chain():
        raise ValueError("journal chain invalid")
    with coordinator.transaction() as db:
        status = dict(db.execute("SELECT state, epoch, rpo_steps, rto_ms, resume_step FROM jobs WHERE job_id=?", (JOB,)).fetchone())
    if status["state"] != "COMPLETED" or status["resume_step"] is None or status["epoch"] != 2:
        raise ValueError("rehearsal has no completed recovery")
    events = coordinator.events()
    proof_event = next(e for e in events if e["event_type"] == "REHEARSAL_TOOL_RESULT"
                       and e["evidence"]["tool"] == "verify_continuity")
    # Rehash the saved final checkpoint as well as validating the journal chain.
    final = read_manifests(coordinator)[-1]
    LocalArtifactStore(directory).verified_bytes(final)
    for event in events:
        event["event_hash"] = event["event_hash"][:12]
        event["prev_hash"] = event["prev_hash"][:12]
        for evidence in (event["evidence"], event["evidence"].get("result", {})):
            if "sha256" in evidence:
                evidence["sha256"] = evidence["sha256"][:12]
    return {"scenario": scenario, "scope": "saved_replay_same_host", "chain_valid": True,
            "events": events, "status": status,
            "proof": proof_event["evidence"]["result"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scenario", choices=SCENARIOS, default="cooling")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--project", action="store_true")
    args = parser.parse_args()
    if args.project:
        print(json.dumps(projection(args.scenario), allow_nan=False))
    else:
        for scenario in SCENARIOS if args.all else (args.scenario,):
            prepare(scenario)


if __name__ == "__main__":
    main()
