"""Check the CLI's evidence and tool exchange without calling NVIDIA."""
from contextlib import redirect_stdout
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
from liferaft.nemotron import NVIDIA_ENDPOINT, load_events


class NemotronTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        coordinator = LocalCoordinator(root)
        self.path = root / "events.jsonl"
        with coordinator.transaction() as db:
            for kind, source, evidence in (
                ("RESCUE_REQUESTED", "injected", {"reason": "cooling_drill", "private_note": "do not share"}),
                ("FIRST_RESUMED_STEP_COMPLETED", "measured", {"step": 26, "rpo_steps": 0}),
            ):
                coordinator.append(db, IncidentEvent(event_id=uuid4(), job_id="test-job", incident_id="inc-test",
                                                      event_type=kind, source_type=source, created_utc=utc_now(),
                                                      message="local-only event message", evidence=evidence))
        self.events = coordinator.events()
        self.export = {"event_type": "CLOUD_EVENTS", "job_id": "test-job",
                       "result": {"chain_valid": True, "events": self.events}}
        self.path.write_text(json.dumps(self.export))

    def test_cli_exchanges_two_tools_and_validates_report(self):
        for invalid_citation in (False, True):
            with self.subTest(invalid_citation=invalid_citation):
                requests = []

                def open_request(request, *, timeout):
                    self.assertEqual(request.full_url, NVIDIA_ENDPOINT)
                    payload = json.loads(request.data)
                    self.assertLessEqual(timeout, 20)
                    self.assertNotIn("local-only event message", request.data.decode())
                    self.assertNotIn("private_note", request.data.decode())
                    requests.append(payload)
                    choice = payload["tool_choice"]
                    if choice == "none":
                        self.assertEqual(payload["response_format"], {"type": "json_object"})
                        results = [json.loads(msg["content"]) for msg in payload["messages"] if msg["role"] == "tool"]
                        self.assertEqual([events[0]["event_id"] for events in results],
                                         [event["event_id"] for event in self.events])
                        report = {"incident_id": "inc-test", "observed_facts": [
                            {"text": "Injected drill", "evidence_event_ids": [self.events[0]["event_id"]]},
                            {"text": "Resumed at step 26", "evidence_event_ids": [
                                str(uuid4()) if invalid_citation else self.events[1]["event_id"]]},
                        ], "likely_failure_mode": "Injected drill", "uncertainty": "Temperature unavailable",
                            "recommended_software_actions": [], "unknowns": ["Temperature"],
                            "verification_checks": ["Measured resume event"], "verified_outcome": "Resumed"}
                        message = {"content": json.dumps(report)}
                    else:
                        expected = ["get_incident", "get_rescue_verification"][len(requests) - 1]
                        self.assertEqual(choice["function"]["name"], expected)
                        message = {"tool_calls": [{"id": f"call-{len(requests)}", "type": "function",
                                                   "function": {"name": expected, "arguments": '{"incident_id":"inc-test"}'}}]}
                    return io.BytesIO(json.dumps({"choices": [{"message": message}]}).encode())

                args = ["liferaft", "investigate", "--job", "test-job", "--events", str(self.path)]
                with (patch("sys.argv", args), patch.dict("os.environ", {"NVIDIA_API_KEY": "test-secret"}),
                      patch("liferaft.nemotron.build_opener") as opener, redirect_stdout(io.StringIO()) as output):
                    opener.return_value.open.side_effect = open_request
                    self.assertEqual(main(), 2 if invalid_citation else 0, output.getvalue())
                result = json.loads(output.getvalue())
                self.assertEqual(len(requests), 3)
                if invalid_citation:
                    self.assertEqual(result["event_type"], "NEMOTRON_INVESTIGATION_FAILED")
                else:
                    self.assertEqual(result["source_type"], "provider")
                    self.assertEqual(len(result["tool_trace"]), 2)

    def test_rejects_tampered_export(self):
        self.events[0]["source_type"] = "measured"
        self.path.write_text(json.dumps(self.export))
        with self.assertRaisesRegex(ValueError, "hash-chained"):
            load_events(self.path, "test-job")
