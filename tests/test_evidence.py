"""Synthetic journal fixtures test proof rules; they are not recovery evidence."""
from contextlib import redirect_stdout
from copy import deepcopy
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from uuid import uuid4

from liferaft.cli import main
from liferaft.contracts import IncidentEvent, utc_now
from liferaft.coordinator import LocalCoordinator
from liferaft.evidence import recovery_brief


def fixture_events():
    events = []
    for kind, worker, epoch, source, evidence in (
        ("CHECKPOINT_COMMITTED", "primary", 1, "derived", {"checkpoint_id": "ckpt", "step": 25, "sha256": "a" * 64}),
        ("RESCUE_REQUESTED", "primary", 1, "injected", {}),
        ("PRIMARY_YIELDED", "primary", 1, "derived", {"checkpoint_id": "ckpt", "step": 25}),
        ("LEASE_TRANSFERRED", "standby", 2, "derived", {"checkpoint_id": "ckpt", "checkpoint_step": 25,
             "sha256": "a" * 64, "previous_owner": "primary", "previous_epoch": 1}),
        ("FIRST_RESUMED_STEP_COMPLETED", "standby", 2, "measured", {"step": 26, "sha256": "a" * 64,
             "loss": 0.12, "rto_ms": 1234, "rpo_steps": 0}),
        ("JOB_COMPLETED", "standby", 2, "derived", {"step": 200}),
    ):
        events.append(IncidentEvent(event_id=uuid4(), job_id="job", incident_id="inc-test", created_utc=utc_now(),
                                    event_type=kind, worker_id=worker, lease_epoch=epoch,
                                    source_type=source, message="fixture private note", evidence=evidence))
    return events


class EvidenceTests(unittest.TestCase):
    def test_complete_continuity_and_crash_unknown_rpo(self):
        events = fixture_events()
        report = recovery_brief(events, "job")
        self.assertTrue(report["verified_resumed"])
        self.assertTrue(report["completed_after_resume"])
        self.assertEqual((report["rto_ms"], report["rpo_steps"]), (1234, 0))
        self.assertEqual(report["resumed"]["step"], 26)
        report = recovery_brief([e for e in events if e.event_type != "PRIMARY_YIELDED"], "job")
        self.assertTrue(report["verified_resumed"])
        self.assertIsNone(report["rpo_steps"])  # never trust an unexplained zero

    def test_inconsistent_or_simulated_proof_never_reports_verified(self):
        for index, changes in ((0, {"worker_id": "wrong"}), (3, {"lease_epoch": 3}),
                               (3, {"source_type": "simulated"}),
                               (4, {"evidence": {"step": 1, "loss": 0.12, "sha256": "a" * 64}}),
                               (4, {"evidence": {"step": 26, "loss": 0.12, "sha256": "b" * 64}})):
            events = fixture_events()
            events[index] = events[index].model_copy(update=changes)
            with self.subTest(index=index, changes=changes):
                self.assertFalse(recovery_brief(events, "job")["verified_resumed"])
        self.assertFalse(recovery_brief(fixture_events()[:3], "job")["verified_resumed"])
        self.assertFalse(recovery_brief([], "job")["verified_resumed"])

    def test_cli_verifies_then_writes_immutable_allowlisted_report(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            coordinator = LocalCoordinator(root)
            for event in fixture_events():
                coordinator.record(event)
            page = coordinator.event_page()
            source = root / "events.jsonl"
            source.write_text(json.dumps({"event_type": "CLOUD_EVENTS", "job_id": "job",
                                          "result": {**page, "complete": True}}))
            output = root / "evidence.json"
            argv = ["liferaft", "evidence", "--job", "job", "--events", str(source), "--output", str(output)]
            with patch("sys.argv", argv), redirect_stdout(io.StringIO()) as log:
                self.assertEqual(main(), 0, log.getvalue())
            self.assertEqual(json.loads(output.read_text())["journal"]["completeness"], "anchored")
            self.assertNotIn("fixture private note", output.read_text())
            before = output.read_bytes()
            with patch("sys.argv", argv), redirect_stdout(io.StringIO()):
                self.assertEqual(main(), 2)
            self.assertEqual(output.read_bytes(), before)
            export = json.loads(source.read_text())
            export["result"]["events"].pop()
            source.write_text(json.dumps(export))
            with patch("sys.argv", argv[:-2]), redirect_stdout(io.StringIO()):
                self.assertEqual(main(), 2)
