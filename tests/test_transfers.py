import hashlib
import unittest

from liferaft.contracts import CheckpointManifest, utc_now
from liferaft.transfers import issue_ticket, verify_ticket


def fixture_manifest():
    data = b"private checkpoint fixture, not a training model"
    return CheckpointManifest(
        checkpoint_id="test", job_id="test-job", run_id="test-run", step_completed=10,
        worker_id="laptop-primary", lease_epoch=1,
        path="runs/test-run/checkpoints/000010-test.pt", sha256=hashlib.sha256(data).hexdigest(),
        size_bytes=len(data), dataset_fingerprint="a" * 64, config_fingerprint="b" * 64,
        model_version="test-model", created_utc=utc_now()), data


class TransferTicketTests(unittest.TestCase):
    def test_exact_identity_and_expiry(self):
        manifest, _ = fixture_manifest()
        credential = "a" * 64
        ticket = issue_ticket(manifest, "primary", "PUT", credential, now=100)
        self.assertNotIn(credential, ticket)
        self.assertEqual(verify_ticket(ticket, "primary", "PUT", credential, now=119.9), manifest)
        for role, method, secret, now in (
                ("standby", "PUT", credential, 101), ("primary", "GET", credential, 101),
                ("primary", "PUT", "b" * 64, 101), ("primary", "PUT", credential, 99),
                ("primary", "PUT", credential, 120)):
            with self.subTest(role=role, method=method, now=now), self.assertRaises(ValueError):
                verify_ticket(ticket, role, method, secret, now=now)

    def test_tampered_or_malformed_capabilities_fail_closed(self):
        manifest, _ = fixture_manifest()
        ticket = issue_ticket(manifest, "primary", "PUT", "a" * 64, now=100)
        for value in (ticket[:-1], "x" + ticket, "", "a.b.c", "x" * 9000, None, "é.a"):
            with self.subTest(value=str(value)[:20]), self.assertRaises(ValueError):
                verify_ticket(value, "primary", "PUT", "a" * 64, now=101)
