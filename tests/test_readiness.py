from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from liferaft.failover import JobSpec, LocalFailover
from test_transfers import fixture_manifest


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.now = time.time()
        self.policy = LocalFailover(Path(temporary.name), clock=lambda: self.now)
        self.manifest, data = fixture_manifest()
        self.policy.create_job(JobSpec(job_id="test-job", run_id="test-run", primary="laptop-primary", seed=1729,
                                      target=20, checkpoint_every=10, model_version="test-model",
                                      dataset_fingerprint="a" * 64, config_fingerprint="b" * 64))
        self.policy.start_primary("test-job", "laptop-primary")
        self.policy.store.put(self.manifest.path, lambda stream: stream.write(data))

    def test_missing_standby_checkpoint_and_expired_lease_never_show_ready(self):
        result = self.policy.readiness("test-job")
        self.assertFalse(result["ready_for_drill"])
        self.assertEqual(result["checkpoint_integrity"], "no_checkpoint")
        self.policy.commit_checkpoint(self.manifest)
        self.policy.register_standby("test-job", "standby")
        result = self.policy.readiness("test-job")
        self.assertTrue(result["ready_for_drill"])
        self.assertEqual(result["checkpoint"]["sha256_prefix"], self.manifest.sha256[:12])
        before = self.policy.database.read_bytes()
        self.now += 13
        result = self.policy.readiness("test-job")
        self.assertFalse(result["lease_valid"])
        self.assertFalse(result["standby_ready"])
        self.assertFalse(result["ready_for_drill"])
        self.assertEqual(result["state"], "PRIMARY_RUNNING")  # no watchdog mutation
        self.assertEqual(self.policy.database.read_bytes(), before)

    def test_corruption_is_reported_without_mutating_journal_or_checkpoint_state(self):
        self.policy.commit_checkpoint(self.manifest)
        self.policy.register_standby("test-job", "standby")
        self.policy.store.path_for(self.manifest.path).write_bytes(b"corrupt test copy")
        before = self.policy.database.read_bytes()
        result = self.policy.readiness("test-job")
        self.assertEqual(result["checkpoint_integrity"], "failed")
        self.assertFalse(result["ready_for_drill"])
        self.assertEqual(self.policy.database.read_bytes(), before)
