"""Opt-in HTTPS authorization and isolated Atlas transaction checks."""
import hashlib
import json
import os
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request
from uuid import uuid4

from dotenv import dotenv_values

from liferaft.artifacts import IntegrityError
from liferaft.atlas import AtlasRepository
from liferaft.cloud import CloudClient
from liferaft.cloud_api import PRIMARY
from liferaft.contracts import CheckpointManifest, WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from liferaft.failover import JobSpec


@unittest.skipUnless(os.environ.get("LIFERAFT_TEST_HOSTED") == "1", "hosted HTTPS check is opt-in")
class HostedAccessTests(unittest.TestCase):
    def test_anonymous_download_and_forged_worker_denied(self):
        profile = dotenv_values(".env.standby", interpolate=False)
        standby = CloudClient(profile.get("LIFERAFT_CLOUD_URL") or "", profile.get("LIFERAFT_CLOUD_TOKEN") or "")
        self.assertEqual(standby.call("doctor")["role"], "standby")

        job = f"auth-probe-{uuid4().hex}"
        body = json.dumps({"action": "download", "job": job, "sent_at": time.time(),
                           "args": {"checkpoint_id": "probe", "epoch": 1}}).encode()
        request = Request(standby.endpoint, data=body, headers={"Content-Type": "application/json"})
        with self.assertRaises(HTTPError) as denied:
            standby.opener.open(request, timeout=6).close()
        with denied.exception as response:
            self.assertEqual(response.code, 401)

        forged = WorkerHeartbeat(request_id=uuid4(), job_id=job, worker_id=PRIMARY, lease_epoch=1,
                                 client_utc=utc_now(), step_completed=0, status="RUNNING",
                                 system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint())
        with self.assertRaisesRegex(RuntimeError, r"HTTP 403\)"):
            standby.call("heartbeat", job, **forged.model_dump(mode="json"))


@unittest.skipUnless(os.environ.get("LIFERAFT_ATLAS_TEST_URI"), "isolated Atlas check is opt-in")
class AtlasTransactionTests(unittest.TestCase):
    def test_checkpoint_bytes_and_job_state_commit_together(self):
        repository = AtlasRepository(os.environ["LIFERAFT_ATLAS_TEST_URI"])
        self.addCleanup(repository.client.close)
        run_id = f"test-{uuid4().hex}"
        spec = JobSpec(job_id=run_id, run_id=run_id, primary=PRIMARY, seed=1729, target=20, checkpoint_every=10,
                       model_version="test-model", dataset_fingerprint="a" * 64, config_fingerprint="b" * 64)
        data = b"disposable Atlas transaction fixture"
        manifest = CheckpointManifest(
            checkpoint_id="fixture", job_id=run_id, run_id=run_id, step_completed=10,
            worker_id=PRIMARY, lease_epoch=1, path=f"runs/{run_id}/checkpoints/000010-fixture.pt",
            sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data),
            dataset_fingerprint=spec.dataset_fingerprint, config_fingerprint=spec.config_fingerprint,
            model_version=spec.model_version, created_utc=utc_now(),
        )
        self.addCleanup(repository.jobs.delete_one, {"_id": run_id})
        self.addCleanup(repository.artifacts.delete_one, {"_id": manifest.path, "job": run_id})
        repository.execute(run_id, lambda policy: policy.create_job(spec), create=True)
        repository.execute(run_id, lambda policy: policy.start_primary(run_id, PRIMARY))
        before = repository.jobs.find_one({"_id": run_id})["state"]

        # Abort after the artifact insert, immediately before the snapshot update.
        with patch.object(repository, "jobs", wraps=repository.jobs) as jobs:
            jobs.update_one.side_effect = RuntimeError("injected snapshot write failure")
            with self.assertRaisesRegex(RuntimeError, "injected snapshot write failure"):
                repository.execute(run_id, lambda policy: policy.commit_checkpoint(manifest), upload=(manifest, data))
        self.assertIsNone(repository.artifacts.find_one({"_id": manifest.path}))
        self.assertEqual(repository.jobs.find_one({"_id": run_id})["state"], before)

        self.assertTrue(repository.execute(run_id, lambda policy: policy.commit_checkpoint(manifest),
                                           upload=(manifest, data)))
        self.assertEqual(repository.artifacts.find_one({"_id": manifest.path})["data"], data)
        self.assertEqual(repository.execute(run_id, lambda policy: policy.status(run_id))["last_step"], 10)
        with self.assertRaises(IntegrityError):
            repository.execute(run_id, lambda policy: True, upload=(manifest, b"replacement bytes"))
        self.assertEqual(repository.artifacts.find_one({"_id": manifest.path})["data"], data)
