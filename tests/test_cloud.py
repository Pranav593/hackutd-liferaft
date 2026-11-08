"""Offline HTTP and transport contract tests. No Atlas access is implied."""
from base64 import b64encode
import hashlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from uuid import uuid4

from liferaft.cloud import CloudClient, CloudWorkerCoordinator
from liferaft.cloud_api import PRIMARY, STANDBY, application
from liferaft.artifacts import LocalArtifactStore
from liferaft.contracts import CheckpointManifest, WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from liferaft.failover import JobSpec, LocalFailover

TOKENS = {"primary": "a" * 64, "standby": "b" * 64, "operator": "c" * 64}


class LocalRepository:
    """Exercise the actual policy and HTTP surface against disposable local storage."""
    def __init__(self, directory):
        self.directory = directory

    def ping(self):
        pass

    def execute(self, job, operation, *, create=False, upload=None):
        policy = LocalFailover(self.directory / job)
        if upload is not None:
            manifest, data = upload
            try:
                policy.store.put(manifest.path, lambda stream: stream.write(data))
            except FileExistsError:
                policy.store.verified_bytes(manifest)
        return operation(policy)


class CloudTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.repository = LocalRepository(self.root)
        self.app = application(self.repository, TOKENS, drills=True)

    def request(self, action, job="test-job", *, role="operator", sent_at=None, **fields):
        data = json.dumps({"action": action, "job": job, "args": fields,
                           "sent_at": time.time() if sent_at is None else sent_at}).encode()
        captured = []
        result = self.app({"REQUEST_METHOD": "POST", "PATH_INFO": "/v1/control",
                           "HTTP_AUTHORIZATION": f"Bearer {TOKENS.get(role, 'unknown')}",
                           "CONTENT_LENGTH": str(len(data)), "wsgi.input": io.BytesIO(data)},
                          lambda status, headers: captured.append(int(status.split()[0])))
        return captured[0], json.loads(b"".join(result))

    def call(self, action, job="test-job", *, role="operator", **fields):
        code, body = self.request(action, job, role=role, **fields)
        self.assertEqual(code, 200, body)
        return body["result"]

    def test_auth_and_input_boundaries(self):
        self.assertEqual(self.request("doctor", None, role="unknown")[0], 401)
        self.assertEqual(self.request("doctor", None, sent_at=time.time() - 31)[0], 409)
        self.assertEqual(self.request("start", role="standby")[0], 403)
        self.assertEqual(self.request("status", role="primary")[0], 403)
        self.assertEqual(self.request("download", role="primary", checkpoint_id="abc", epoch=1)[0], 403)
        self.assertEqual(self.call("doctor", None), {"auth": True, "database": True, "role": "operator"})
        with self.assertRaises(ValueError):
            CloudClient("http://example.test", TOKENS["operator"])
        with self.assertRaises(ValueError):
            application(self.repository, {role: "a" * 64 for role in TOKENS})

    def test_private_transfer_fencing_and_evidence(self):
        spec = JobSpec(job_id="test-job", run_id="test-run", primary=PRIMARY, seed=1729, target=20,
                       checkpoint_every=10, model_version="test-model", dataset_fingerprint="a" * 64,
                       config_fingerprint="b" * 64)
        self.call("create", **spec.model_dump(mode="json"))
        self.call("register", role="standby")
        self.assertEqual(self.call("start", role="primary")["lease_epoch"], 1)
        data = b"test fixture bytes, not a training checkpoint"
        manifest = CheckpointManifest(
            checkpoint_id="ckpt-a", job_id=spec.job_id, run_id=spec.run_id, step_completed=10,
            worker_id=PRIMARY, lease_epoch=1, path="runs/test-run/checkpoints/000010-ckpt-a.pt",
            sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data),
            dataset_fingerprint=spec.dataset_fingerprint, config_fingerprint=spec.config_fingerprint,
            model_version=spec.model_version, created_utc=utc_now(),
        )

        class Client:
            def __init__(self, test, role):
                self.test, self.role = test, role

            def call(self, action, job, **fields):
                return self.test.call(action, job, role=self.role, **fields)

        primary_store = LocalArtifactStore(self.root / "primary")
        primary_store.put(manifest.path, lambda stream: stream.write(data))
        primary = CloudWorkerCoordinator(Client(self, "primary"), primary_store)
        self.assertEqual(self.request("commit", role="standby", manifest=manifest.model_dump(mode="json"),
                                      data=b64encode(data).decode())[0], 403)
        self.assertEqual(self.request("commit", role="primary", manifest=manifest.model_dump(mode="json"),
                                      data=b64encode(b"bad").decode())[0], 422)
        self.assertTrue(primary.commit_checkpoint(manifest))
        self.assertEqual(self.request("download", role="standby", checkpoint_id=manifest.checkpoint_id, epoch=1)[0], 403)
        self.call("rescue", request_id=str(uuid4()))
        heartbeat = WorkerHeartbeat(request_id=uuid4(), job_id=spec.job_id, worker_id=PRIMARY, lease_epoch=1,
                                    client_utc=utc_now(), step_completed=10, status="RUNNING",
                                    system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint())
        self.assertEqual(primary.heartbeat(heartbeat).action, "PAUSE")
        self.assertTrue(primary.yield_or_pause(spec.job_id, PRIMARY, 1, manifest.checkpoint_id))
        standby = CloudWorkerCoordinator(Client(self, "standby"), LocalArtifactStore(self.root / "standby"))
        offered, = standby.checkpoint_candidates(spec.job_id, STANDBY)
        self.assertEqual(standby.fetch_checkpoint(offered).read_bytes(), data)
        self.assertEqual(standby.claim_standby(spec.job_id, STANDBY, 1, offered.checkpoint_id).lease_epoch, 2)
        self.assertEqual(standby.claim_standby(spec.job_id, STANDBY, 1, offered.checkpoint_id).action, "STOP")
        self.assertEqual(primary.heartbeat(heartbeat).action, "STOP")
        self.assertFalse(primary.commit_checkpoint(manifest))
        self.assertFalse(standby.mark_first_resumed_step(spec.job_id, STANDBY, 2, 10, 0.5, offered.sha256))
        self.assertTrue(standby.mark_first_resumed_step(spec.job_id, STANDBY, 2, 11, 0.5, offered.sha256))
        self.assertEqual(self.call("status")["resume_step"], 11)
        self.assertTrue(self.call("events")["chain_valid"])
