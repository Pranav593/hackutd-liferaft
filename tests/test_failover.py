"""Exercise the SQLite authority and the real two-process entry point."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from threading import Barrier
import time
import unittest
from uuid import uuid4

from liferaft.checkpoint import restore, save
from liferaft.contracts import WorkerCheckpoint, WorkerHeartbeat, WorkerSystem
from liferaft.failover import JobSpec, LocalFailover
from liferaft.workload import CONFIG_FINGERPRINT, MODEL_VERSION, TrainingSession


class FailoverTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.now = time.time()
        self.coordinator = LocalFailover(Path(tmp.name), clock=lambda: self.now)
        self.session = TrainingSession(1729)
        self.spec = JobSpec(
            job_id="job", run_id="run", primary="primary", seed=1729, target=10, checkpoint_every=2,
            model_version=MODEL_VERSION, dataset_fingerprint=self.session.dataset_fingerprint,
            config_fingerprint=CONFIG_FINGERPRINT,
        )
        self.coordinator.create_job(self.spec)
        self.assertEqual(self.coordinator.start_primary("job", "primary").lease_epoch, 1)

    def checkpoint(self, *, commit=True):
        self.session.advance()
        manifest, path = save(self.session, self.coordinator.store, job_id="job", run_id="run",
                              worker_id="primary", lease_epoch=1)
        if commit:
            self.assertTrue(self.coordinator.commit_checkpoint(manifest))
        return manifest, path

    def heartbeat_request(self):
        return WorkerHeartbeat(
            request_id=uuid4(), job_id="job", worker_id="primary", lease_epoch=1,
            step_completed=self.session.step, client_utc=datetime.fromtimestamp(self.now, timezone.utc),
            status="RUNNING", system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint(),
        )

    def events(self, kind):
        return [event for event in self.coordinator.events() if event["event_type"] == kind]

    def test_graceful_yield_and_idempotent_request(self):
        manifest, _ = self.checkpoint()
        coordinator = self.coordinator
        coordinator.register_standby("job", "backup")
        request_id = uuid4()
        incident = coordinator.request_rescue("job", request_id)
        self.assertEqual(coordinator.request_rescue("job", request_id), incident)
        self.assertEqual(len(self.events("RESCUE_REQUESTED")), 1)
        self.assertEqual(coordinator.claim_standby("job", "backup", 1, manifest.checkpoint_id).action, "STOP")
        self.assertEqual(coordinator.heartbeat(self.heartbeat_request()).action, "PAUSE")
        self.assertFalse(coordinator.yield_or_pause("job", "primary", 1, "wrong"))
        self.assertTrue(coordinator.yield_or_pause("job", "primary", 1, manifest.checkpoint_id))
        self.assertEqual(coordinator.claim_standby("job", "backup", 1, manifest.checkpoint_id).lease_epoch, 2)
        self.assertEqual(coordinator.status("job")["state"], "STANDBY_STARTING")
        self.assertFalse(coordinator.mark_first_resumed_step("job", "backup", 2, 3, 0.1, manifest.sha256))
        self.assertFalse(coordinator.mark_first_resumed_step("job", "primary", 1, 2, 0.1, manifest.sha256))
        self.assertFalse(coordinator.mark_first_resumed_step("job", "backup", 2, 2, 0.1, "0" * 64))
        self.assertTrue(coordinator.verify_chain())

    def test_standby_absent_or_disappears_during_pause(self):
        manifest, _ = self.checkpoint()
        coordinator = self.coordinator
        request_id = uuid4()
        incident = coordinator.request_rescue("job", request_id)
        self.assertEqual(coordinator.request_rescue("job", request_id), incident)
        self.assertEqual(coordinator.status("job")["state"], "PRIMARY_RUNNING")
        self.assertEqual(len(self.events("STANDBY_UNAVAILABLE")), 1)
        coordinator.register_standby("job", "backup")
        coordinator.request_rescue("job", uuid4())
        self.assertEqual(coordinator.heartbeat(self.heartbeat_request()).action, "PAUSE")
        self.now += 7
        self.assertFalse(coordinator.yield_or_pause("job", "primary", 1, manifest.checkpoint_id))
        self.assertEqual(coordinator.heartbeat(self.heartbeat_request()).action, "RUN")

    def test_corrupt_newest_falls_back_and_resumes_from_last_good(self):
        previous, _ = self.checkpoint()
        latest, path = self.checkpoint()
        path.write_bytes(b"corrupt")
        self.now += 12
        coordinator = self.coordinator
        coordinator.register_standby("job", "backup")
        self.assertEqual(coordinator.claim_standby("job", "backup", 1, latest.checkpoint_id).action, "STOP")
        for _ in range(2):
            candidates = coordinator.checkpoint_candidates("job", "backup")
            self.assertEqual([manifest.checkpoint_id for manifest in candidates], [previous.checkpoint_id])
        self.assertEqual(len(self.events("CHECKPOINT_REJECTED")), 1)
        self.assertEqual(coordinator.claim_standby("job", "backup", 1, latest.checkpoint_id).action, "STOP")
        candidate = candidates[0]
        session, _ = restore(coordinator.store.path_for(candidate.path), job_id="job", run_id="run",
                             seed=1729, trusted_manifest=candidate)
        plan = coordinator.claim_standby("job", "backup", 1, candidate.checkpoint_id)
        self.assertEqual(plan.action, "RUN")
        loss, _ = session.advance()
        self.assertTrue(coordinator.mark_first_resumed_step("job", "backup", plan.lease_epoch,
                                                            session.step, loss, candidate.sha256))
        self.assertEqual(session.step, previous.step_completed + 1)

    def test_uncommitted_artifact_is_never_a_candidate(self):
        pending, _ = self.checkpoint(commit=False)
        self.now += 12
        self.coordinator.register_standby("job", "backup")
        self.assertEqual(self.coordinator.checkpoint_candidates("job", "backup"), [])
        self.assertEqual(self.coordinator.claim_standby("job", "backup", 1, pending.checkpoint_id).action, "STOP")
        self.assertEqual(self.coordinator.status("job")["block_reason"], "NO_VALID_CHECKPOINT")
        self.assertFalse(self.events("LEASE_TRANSFERRED"))

    def test_two_racing_standbys_and_returning_primary(self):
        manifest, _ = self.checkpoint()
        stale, _ = self.checkpoint(commit=False)
        self.now += 12
        coordinator = self.coordinator
        self.assertEqual(coordinator.status("job")["block_reason"], "STANDBY_UNAVAILABLE")
        for worker in ("backup-a", "backup-b"):
            coordinator.register_standby("job", worker)
        barrier = Barrier(2)

        def claim(worker):
            barrier.wait(timeout=5)
            return coordinator.claim_standby("job", worker, 1, manifest.checkpoint_id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            plans = list(pool.map(claim, ("backup-a", "backup-b")))
        self.assertEqual(sorted(plan.action for plan in plans), ["RUN", "STOP"])
        self.assertEqual(coordinator.status("job")["epoch"], 2)
        self.assertEqual(coordinator.heartbeat(self.heartbeat_request()).action, "STOP")
        self.assertFalse(coordinator.commit_checkpoint(stale))
        self.assertEqual(len(self.events("LEASE_TRANSFERRED")), 1)
        self.assertEqual(len(self.events("CHECKPOINT_COMMITTED")), 1)
        self.assertEqual(len(self.events("STALE_LEASE_REJECTED")), 2)
        self.assertTrue(coordinator.verify_chain())

    def test_duplicate_heartbeat_does_not_extend_lease(self):
        coordinator = self.coordinator
        request = self.heartbeat_request()
        self.assertEqual(coordinator.heartbeat(request).lease_remaining_s, 12)
        self.now += 4
        self.assertEqual(coordinator.heartbeat(request).lease_remaining_s, 8)
        self.now += 8
        self.assertEqual(coordinator.heartbeat(request).action, "STOP")
        self.assertEqual(coordinator.status("job")["state"], "RECOVERY_PENDING")


class LocalDemoTests(unittest.TestCase):
    def test_graceful_and_crash_runs_match_real_training_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            baseline = TrainingSession(1729)
            expected = [baseline.advance()[0] for _ in range(70)]
            for scenario in ("cooling-test", "worker-crash"):
                with self.subTest(scenario=scenario):
                    report = self.run_demo(tmp, scenario)
                    status = report["status"]
                    events = {event["event_type"]: event for event in report["events"]}
                    self.assertEqual(status["state"], "COMPLETED")
                    self.assertEqual(status["epoch"], 2)
                    self.assertEqual(status["last_step"], 70)
                    self.assertGreater(status["rto_ms"], 0)
                    self.assertEqual(report["exit_codes"]["standby"], 0)
                    transfer = events["LEASE_TRANSFERRED"]["evidence"]
                    self.assertEqual(status["resume_step"], transfer["checkpoint_step"] + 1)
                    self.assertEqual(events["FIRST_RESUMED_STEP_COMPLETED"]["evidence"]["sha256"], transfer["sha256"])
                    if scenario == "cooling-test":
                        self.assertEqual(events["RESCUE_REQUESTED"]["source_type"], "injected")
                        self.assertIn("PRIMARY_YIELDED", events)
                        self.assertNotIn("LEASE_EXPIRED", events)
                        self.assertEqual(status["rpo_steps"], 0)
                    else:
                        self.assertEqual(events["PRIMARY_PROCESS_KILLED"]["source_type"], "injected")
                        self.assertNotEqual(report["exit_codes"]["primary"], 0)
                        self.assertLess(events["LEASE_EXPIRED"]["seq"], events["LEASE_TRANSFERRED"]["seq"])
                        self.assertIsNone(status["rpo_steps"])
                    lines = (Path(report["directory"]) / "standby.jsonl").read_text().splitlines()
                    steps = [row for row in map(json.loads, lines) if row["event_type"] == "TRAINING_STEP_COMPLETED"]
                    self.assertEqual([row["step_completed"] for row in steps], list(range(status["resume_step"], 71)))
                    self.assertEqual([row["loss"] for row in steps], expected[status["resume_step"] - 1:])

    def run_demo(self, tmp, scenario):
        run = subprocess.run(
            [sys.executable, "-m", "liferaft", "demo", "--scenario", scenario],
            capture_output=True, text=True, timeout=60, env={**os.environ, "LIFERAFT_STATE_DIR": tmp},
        )
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        summary = json.loads(run.stdout.splitlines()[-1])
        path = Path(summary["evidence_path"])
        report = json.loads(path.read_text())
        report["directory"] = str(path.parent)
        return report
