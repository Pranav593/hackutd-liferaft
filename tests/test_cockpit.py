"""Verify cockpit projections using synthetic evidence and tampering fixtures."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from liferaft.cockpit import build_view
from liferaft.coordinator import LocalCoordinator
from liferaft.nemotron import TOOL_EVENTS, tool_events
from test_evidence import fixture_events


class CockpitTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.events = fixture_events()
        self.journal = LocalCoordinator(self.root)
        for event in self.events:
            self.journal.record(event)

    def export(self, *, legacy=False, tamper=False):
        page = self.journal.event_page()
        if legacy:
            page = {key: page[key] for key in ("events", "chain_valid")}
        else:
            page["complete"] = True
        if tamper:
            page["events"][0]["evidence"]["step"] = 24
        path = self.root / "journal.json"
        path.write_text(json.dumps({"job_id": "job", "event_type": "CLOUD_EVENTS", "result": page}))
        return path

    def test_legacy_replay_verifies_with_only_recorded_loss_and_no_raw_evidence(self):
        view = build_view("job", export=self.export(legacy=True))
        self.assertFalse(view["journal"]["anchored"])
        self.assertTrue(view["recovery"]["completed_after_resume"])
        self.assertEqual(view["recovery"]["checkpoint"]["hash_prefix"], "a" * 12)
        self.assertEqual(view["recovery"]["rpo_steps"], 0)
        self.assertEqual([(row["step"], row["origin"]) for row in view["losses"]], [(26, "journal")])
        serialized = json.dumps(view)
        self.assertNotIn("fixture private note", serialized)
        self.assertNotIn("a" * 64, serialized)

    def test_tampered_or_wrong_job_fails_before_projection(self):
        with self.assertRaises(ValueError):
            build_view("job", export=self.export(tamper=True))
        with self.assertRaises(ValueError):
            build_view("other-job", export=self.export())

    def test_provider_trace_requires_matching_observations(self):
        incident = "inc-test"
        trace = [{"tool": name, "arguments": {"incident_id": incident},
                  "events": tool_events(self.events, incident, name)} for name in TOOL_EVENTS]
        report = {"incident_id": incident, "observed_facts": [
            {"text": "Test request", "evidence_event_ids": [str(self.events[1].event_id)]},
            {"text": "First step", "evidence_event_ids": [str(self.events[4].event_id)]},
        ], "likely_failure_mode": "Test", "uncertainty": "Fixture", "recommended_software_actions": [],
            "unknowns": [], "verification_checks": [], "verified_outcome": "Fixture outcome"}
        saved = {"event_type": "NEMOTRON_INVESTIGATION", "job_id": "job", "source_type": "provider",
                 "model": "nvidia/test-model", "report": report, "tool_trace": trace}
        path = self.root / "investigation.json"
        path.write_text(json.dumps(saved))
        export = self.export()
        view = build_view("job", export=export, investigation=path)
        self.assertTrue(view["journal"]["anchored"])
        self.assertEqual(len(view["investigation"]["tools"]), 2)
        trace[0]["events"][0]["worker_id"] = "wrong-worker"
        path.write_text(json.dumps(saved))
        rejected = build_view("job", export=export, investigation=path)
        self.assertTrue(rejected["investigation_rejected"])
        self.assertIsNone(rejected["investigation"])
        self.assertTrue(rejected["recovery"]["verified_resumed"])
