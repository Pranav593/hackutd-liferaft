from datetime import timedelta
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from liferaft.config import log
from liferaft.contracts import IncidentEvent, utc_now
from liferaft.coordinator import LocalCoordinator
from liferaft.worker_logs import activity, build_feed, capture_session, pane, read_lines


class WorkerLogsTests(unittest.TestCase):
    def test_real_optimizer_updates_appear_on_successive_reads(self):
        from liferaft.workload import TrainingSession
        with capture_session("real-training-check", "laptop-standby"):
            session = TrainingSession(1729)
            for expected in range(1, 4):
                loss, elapsed = session.advance()
                log("TRAINING_STEP_COMPLETED", source_type="measured", job_id="real-training-check",
                    worker_id="laptop-standby", step_completed=session.step, loss=loss, elapsed_ms=elapsed)
                device = build_feed(root=self.root)["devices"][1]
                self.assertEqual(device["state"], "active")
                self.assertEqual(device["rows"][-1]["metrics"]["step_completed"], expected)
                self.assertEqual(device["rows"][-1]["metrics"]["loss"], loss)
        self.assertEqual(build_feed(root=self.root)["devices"][1]["state"], "finished")

    def test_injected_training_cannot_appear_as_real_progress(self):
        self.assertIsNone(activity({"event_type": "TRAINING_STEP_COMPLETED", "source_type": "injected"}, origin="test"))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {"LIFERAFT_STATE_DIR": str(self.root),
            "LIFERAFT_LOG_JOB": "", "LIFERAFT_LOG_WINDOWS_WORKER": "laptop-standby",
            "LIFERAFT_CLOUD_URL": "", "LIFERAFT_OPERATOR_READ_TOKEN": ""})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.settings = patch("liferaft.worker_logs.dotenv_values", return_value={})
        self.settings.start()
        self.addCleanup(self.settings.stop)
        self.processes = patch("liferaft.worker_logs.active_process_job", return_value=None)
        self.processes.start()
        self.addCleanup(self.processes.stop)

    def test_running_session_automatically_selects_job_and_captures_real_step(self):
        with capture_session("auto-job", "laptop-standby"):
            log("TRAINING_STEP_COMPLETED", source_type="measured", job_id="auto-job",
                worker_id="laptop-standby", step_completed=37, loss=.0123, lease_epoch=2)
            feed = build_feed(root=self.root)
            self.assertEqual(feed["job"], "auto-job")
            self.assertEqual(feed["devices"][1]["state"], "active")
            self.assertEqual(feed["devices"][1]["rows"][-1]["metrics"]["step_completed"], 37)
            self.assertEqual(feed["devices"][0]["rows"], [])
        self.assertEqual(build_feed(root=self.root)["devices"][1]["state"], "finished")

    def test_remote_journal_projects_both_workers_and_never_exposes_secrets(self):
        c = LocalCoordinator(self.root / "coordinator")
        for worker in ("pi-primary", "laptop-standby"):
            c.record(IncidentEvent(event_id=uuid4(), job_id="shared-job", worker_id=worker,
                created_utc=utc_now(), event_type="WORKER_HEARTBEAT", source_type="derived",
                message="heartbeat", evidence={"step": 20, "authorization": "private-value", "os": "Windows" if worker.startswith("laptop") else "Linux"}))
        class Client:
            def export_events(self, job):
                return {"events": c.events(), "chain_valid": True}
        with patch.dict(os.environ, {"LIFERAFT_LOG_JOB": "shared-job"}):
            feed = build_feed(root=self.root, client=Client())
        self.assertEqual(feed["mode"], "cloud")
        self.assertTrue(all(device["rows"] for device in feed["devices"]))
        self.assertNotIn("authorization", json.dumps(feed))
        self.assertNotIn("private-value", json.dumps(feed))

    def test_failed_cloud_preserves_local_logs_without_claiming_remote_success(self):
        class Client:
            def export_events(self, job):
                raise RuntimeError("private provider detail")
        with capture_session("auto-job", "laptop-standby"):
            feed = build_feed(root=self.root, client=Client())
        self.assertEqual(feed["mode"], "local")
        self.assertIn("unavailable", feed["notice"])
        self.assertNotIn("private provider detail", json.dumps(feed))

    def test_unverified_remote_events_are_rejected(self):
        class Client:
            def export_events(self, job):
                return {"events": [{"seq": 1}], "chain_valid": True}
        with patch.dict(os.environ, {"LIFERAFT_LOG_JOB": "shared-job"}):
            feed = build_feed(root=self.root, client=Client())
        self.assertNotEqual(feed["mode"], "cloud")
        self.assertTrue(all(not device["rows"] for device in feed["devices"]))

    def test_partial_lines_and_unrecognized_output_are_not_relayed(self):
        path = self.root / "partial.jsonl"
        path.write_text('{"event_type":"anything","secret":"private"}\n{"partial":')
        self.assertEqual(len(read_lines(path)), 1)
        self.assertIsNone(activity(read_lines(path)[0], origin="test"))

    def test_staleness_and_saved_labels(self):
        row = activity({"job_id": "job", "worker_id": "pi-primary", "created_utc": (utc_now()-timedelta(seconds=60)).isoformat(),
                        "event_type": "WORKER_HEARTBEAT", "step": 9}, origin="journal")
        now = utc_now().timestamp()
        self.assertEqual(pane("pi-primary", "Pi", [row], now=now, live=True)["state"], "stale")
        self.assertEqual(pane("pi-primary", "Pi", [row], now=now, live=False)["state"], "saved")

    def test_capture_failure_does_not_stop_training(self):
        with capture_session("disk-check", "laptop-standby"):
            with patch("pathlib.Path.open", side_effect=OSError("disk unavailable")):
                log("TEST_EVENT")

    def test_no_device_or_job_is_fabricated(self):
        feed = build_feed(root=self.root)
        self.assertIsNone(feed["job"])
        self.assertEqual(feed["mode"], "waiting")
        self.assertTrue(all(device["state"] == "waiting" for device in feed["devices"]))


if __name__ == "__main__":
    unittest.main()
