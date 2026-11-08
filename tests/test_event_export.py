from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock
from uuid import uuid4

from liferaft.cloud import CloudClient
from liferaft.contracts import IncidentEvent, utc_now
from liferaft.coordinator import LocalCoordinator
from liferaft.evidence import verify_journal


class EventExportTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.coordinator = LocalCoordinator(Path(temporary.name))
        self.client = CloudClient("https://coordinator.test", "c" * 64)

    def append(self, count):
        with self.coordinator.transaction() as db:
            for _ in range(count):
                self.coordinator.append(db, IncidentEvent(
                    event_id=uuid4(), job_id="job", created_utc=utc_now(),
                    event_type="TEST_OBSERVATION", source_type="simulated", message="test fixture"))

    def test_export_over_500_events_freezes_head_during_append(self):
        self.append(515)
        calls = []

        def call(action, job, **args):
            calls.append(args)
            page = self.coordinator.event_page(**args)
            if len(calls) == 1:
                self.append(1)
            return page

        self.client.call = call
        result = self.client.export_events("job")
        self.assertEqual(len(verify_journal(result, "job")), 515)
        self.assertEqual(result["head_seq"], 515)
        self.assertEqual(calls, [{}, {"after": 500, "through": 515}])
        self.assertEqual(self.coordinator.event_page()["head_seq"], 516)

    def test_truncation_reordering_and_wrong_scope_are_rejected(self):
        self.append(2)
        page = self.coordinator.event_page()
        result = {**page, "complete": True}
        for mutate in (lambda r: r["events"].pop(), lambda r: r["events"].reverse(),
                       lambda r: r.update(complete=False), lambda r: r.update(head_hash="a" * 64)):
            changed = deepcopy(result)
            mutate(changed)
            with self.assertRaises(ValueError):
                verify_journal(changed, "job")
        with self.assertRaises(ValueError):
            verify_journal(result, "another-job")

    def test_pagination_must_advance_and_keep_the_same_head(self):
        self.append(2)
        first = self.coordinator.event_page(limit=1)
        for second in (first, {**first, "head_hash": "b" * 64}):
            self.client.call = Mock(side_effect=[first, second])
            with self.assertRaises(ValueError):
                self.client.export_events("job")
        self.client.call = Mock(return_value={"events": [], "chain_valid": True})
        with self.assertRaisesRegex(ValueError, "paged-v1"):
            self.client.export_events("job")

    def test_empty_export_and_invalid_cursors(self):
        self.client.call = lambda action, job, **args: self.coordinator.event_page(**args)
        result = self.client.export_events("job")
        self.assertEqual(verify_journal(result, "job"), [])
        for args in ({"after": 1}, {"through": 1}, {"after": -1}, {"limit": 501}):
            with self.subTest(args=args), self.assertRaises(ValueError):
                self.coordinator.event_page(**args)
