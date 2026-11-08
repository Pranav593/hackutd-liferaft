"""Offline HTTP and transport contract tests. No Atlas access is implied."""
from base64 import b64encode
from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch
from uuid import uuid4
from urllib.parse import urlsplit

from liferaft.cloud import CloudClient, CloudWorkerCoordinator
from liferaft.cloud_api import PRIMARY, STANDBY, application
from liferaft.artifacts import LocalArtifactStore
from liferaft.bridge import wait_for_button
from liferaft.cli import main
from liferaft.contracts import CheckpointManifest, WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from liferaft.failover import JobSpec, LocalFailover

TOKENS = {"primary": "a" * 64, "standby": "b" * 64, "operator": "c" * 64, "gateway": "d" * 64}
BUTTON = {"protocol_version": 1, "device_id": "esp32-s3-01", "seq": 18, "uptime_ms": 30802,
          "ambient_temp_c": None, "ambient_valid": False, "button_pressed": True,
          "event_type": "COOLING_FAILURE_TEST", "source_type": "injected"}


class LocalRepository:
    """Exercise the actual policy and HTTP surface against disposable local storage."""
    def __init__(self, directory, clock=None):
        self.directory = directory
        self.clock = clock

    def ping(self):
        pass

    def execute(self, job, operation, *, create=False, upload=None):
        policy = (LocalFailover(self.directory / job, clock=self.clock) if self.clock
                  else LocalFailover(self.directory / job))
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

    def transfer(self, url, method, role="primary", data=b""):
        parts = urlsplit(url)
        captured = []
        result = self.app({"REQUEST_METHOD": method, "PATH_INFO": parts.path, "QUERY_STRING": parts.query,
                           "HTTP_AUTHORIZATION": f"Bearer {TOKENS.get(role, 'unknown')}",
                           "CONTENT_LENGTH": str(len(data)), "wsgi.input": io.BytesIO(data)},
                          lambda status, headers: captured.append(int(status.split()[0])))
        return captured[0], b"".join(result)

    def test_signed_transfer_roundtrip_revalidates_policy(self):
        from test_transfers import fixture_manifest

        manifest, data = fixture_manifest()
        spec = JobSpec(job_id=manifest.job_id, run_id=manifest.run_id, primary=PRIMARY,
                       seed=1729, target=20, checkpoint_every=10, model_version=manifest.model_version,
                       dataset_fingerprint=manifest.dataset_fingerprint, config_fingerprint=manifest.config_fingerprint)
        self.call("create", **spec.model_dump(mode="json"))
        self.call("start", role="primary")
        self.call("register", role="standby")
        upload = self.call("upload_url", role="primary", manifest=manifest.model_dump(mode="json"))["signed_url"]
        self.assertEqual(self.transfer(upload, "PUT", "unknown", data)[0], 401)
        self.assertEqual(self.transfer(upload, "PUT", "standby", data)[0], 403)
        self.assertEqual(self.transfer(upload, "GET", "primary")[0], 403)
        self.assertEqual(self.transfer(upload, "PUT", data=data[:-1])[0], 413)
        self.assertEqual(self.transfer(upload, "PUT", data=b"x" * len(data))[0], 422)
        self.assertEqual(self.call("status")["last_step"], 0)
        self.assertEqual(self.transfer(upload, "PUT", data=data)[0], 200)
        self.assertEqual(self.transfer(upload, "PUT", data=data)[0], 200)  # immutable idempotent replay
        self.call("rescue", request_id=str(uuid4()))
        heartbeat = WorkerHeartbeat(request_id=uuid4(), job_id=spec.job_id, worker_id=PRIMARY, lease_epoch=1,
                                    client_utc=utc_now(), step_completed=10, status="RUNNING",
                                    system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint())
        self.call("heartbeat", role="primary", **heartbeat.model_dump(mode="json"))
        self.call("yield", role="primary", epoch=1, checkpoint_id=manifest.checkpoint_id)
        download = self.call("download_url", role="standby", epoch=1,
                             checkpoint_id=manifest.checkpoint_id)["signed_url"]
        self.assertEqual(self.transfer(download, "GET", "standby"), (200, data))
        self.assertEqual(self.transfer(download + "x", "GET", "standby")[0], 403)
        self.call("claim", role="standby", epoch=1, checkpoint_id=manifest.checkpoint_id)
        self.assertEqual(self.transfer(download, "GET", "standby")[0], 403)
        self.assertEqual(self.transfer(upload, "PUT", data=data)[0], 409)

    def test_public_health_supports_head_monitors(self):
        def check(method):
            responses = []
            result = self.app({"REQUEST_METHOD": method, "PATH_INFO": "/healthz"},
                              lambda status, headers: responses.append((status, dict(headers))))
            status, headers = responses[0]
            return status, headers, b"".join(result)

        status, headers, body = check("GET")
        self.assertEqual(status, "200 OK")
        self.assertEqual(json.loads(body), {"ready": True})
        self.assertEqual(headers["Content-Length"], str(len(body)))
        self.assertEqual(check("HEAD"), (status, headers, b""))

    def test_auth_and_input_boundaries(self):
        self.assertEqual(self.request("doctor", None, role="unknown")[0], 401)
        self.assertEqual(self.request("doctor", None, sent_at=time.time() - 31)[0], 409)
        self.assertEqual(self.request("start", role="standby")[0], 403)
        self.assertEqual(self.request("status", role="primary")[0], 403)
        self.assertEqual(self.request("download", role="primary", checkpoint_id="abc", epoch=1)[0], 403)
        self.assertEqual(self.call("doctor", None), {"auth": True, "database": True, "role": "operator",
                                                     "checkpoint_transfer": "signed-v1", "event_export": "paged-v1",
                                                     "edge_protocol": "v1", "worker_id": None})
        with self.assertRaises(ValueError):
            CloudClient("http://example.test", TOKENS["operator"])
        with self.assertRaises(ValueError):
            application(self.repository, {role: "a" * 64 for role in TOKENS})

    def test_job_doctor_is_operator_only_and_honors_drill_flag(self):
        from test_transfers import fixture_manifest

        manifest, _ = fixture_manifest()
        spec = JobSpec(job_id=manifest.job_id, run_id=manifest.run_id, primary=PRIMARY, seed=1729,
                       target=20, checkpoint_every=10, model_version=manifest.model_version,
                       dataset_fingerprint=manifest.dataset_fingerprint, config_fingerprint=manifest.config_fingerprint)
        self.call("create", **spec.model_dump(mode="json"))
        for role in ("primary", "standby", "gateway"):
            self.assertEqual(self.request("doctor", role=role)[0], 403)
        self.app = application(self.repository, TOKENS, drills=False)
        result = self.call("doctor")
        self.assertFalse(result["ready_for_drill"])
        self.assertIn("drills_disabled", result["reasons"])
        self.assertEqual(result["checks_not_performed"], ["cross_device_transfer", "physical_sensor", "provider_delivery"])

    def test_button_requires_enabled_drill_and_scoped_gateway(self):
        for role, expected in (("unknown", 401), ("operator", 403), ("standby", 403), ("primary", 403)):
            with self.subTest(role=role):
                self.assertEqual(self.request("button", role=role, **BUTTON)[0], expected)
        for fields in ({"source_type": "measured"}, {"device_id": "other"}, {"ambient_temp_c": 25},
                       {"button_pressed": 1}, {"protocol_version": True}, {"relay": True}):
            with self.subTest(fields=fields):
                self.assertEqual(self.request("button", role="gateway", **(BUTTON | fields))[0], 422)
        for action in ("create", "status", "events", "rescue", "heartbeat", "claim", "download", "commit"):
            with self.subTest(action=action):
                self.assertEqual(self.request(action, role="gateway")[0], 403)
        self.app = application(self.repository, TOKENS)
        self.assertEqual(self.request("button", role="gateway", **BUTTON)[0], 403)
        self.app = application(self.repository, {role: token for role, token in TOKENS.items() if role != "gateway"},
                               drills=True)
        self.assertEqual(self.request("button", role="gateway", **BUTTON)[0], 401)

    def test_serial_rejects_oversized_and_unrelated_frames(self):
        frame = json.dumps(BUTTON).encode() + b"\r\n"
        chunks = iter([b"x" * 513, frame, b"LIFERAFT_BOOT_OK\n", frame[:15], b"", frame[15:]])

        class Connection:
            def read_until(self, *, size):
                return next(chunks)

        self.assertEqual(wait_for_button(Connection(), time.monotonic() + 1).model_dump(), BUTTON)
        with self.assertRaises(TimeoutError):
            wait_for_button(Connection(), time.monotonic())

    def test_create_cli_persists_workload_fingerprint(self):
        from liferaft.workload import CONFIG_FINGERPRINT

        args = ["liferaft", "cloud", "--profile", "operator", "create", "--job", "test-job"]
        profile = {"LIFERAFT_CLOUD_URL": "https://example.test", "LIFERAFT_CLOUD_TOKEN": TOKENS["operator"]}
        with (patch("sys.argv", args), patch("liferaft.cloud.dotenv_values", return_value=profile),
              patch.object(CloudClient, "call", side_effect=self.call), redirect_stdout(io.StringIO()) as output):
            self.assertEqual(main(), 0, output.getvalue())

        spec = self.call("spec", role="primary")
        self.assertEqual(spec["config_fingerprint"], CONFIG_FINGERPRINT)

    def test_standby_refreshes_presence_before_download_and_claim(self):
        # Real policy/API; simulate network/restore latency across the six-second
        # readiness boundary without weakening the coordinator's checks.
        now = [time.time()]
        self.repository = LocalRepository(self.root, clock=lambda: now[0])
        self.app = application(self.repository, TOKENS, drills=True)
        spec = JobSpec(job_id="test-job", run_id="run-delayed", primary=PRIMARY,
                       seed=1729, target=20, checkpoint_every=10, model_version="test-model",
                       dataset_fingerprint="a" * 64, config_fingerprint="b" * 64)
        self.call("create", **spec.model_dump(mode="json"))
        self.call("register", role="standby")
        self.call("start", role="primary")
        data = b"latency-test fixture; not a training checkpoint"
        manifest = CheckpointManifest(
            checkpoint_id="ckpt-delayed", job_id=spec.job_id, run_id=spec.run_id,
            step_completed=10, worker_id=PRIMARY, lease_epoch=1,
            path="runs/run-delayed/checkpoints/000010-ckpt-delayed.pt",
            sha256=hashlib.sha256(data).hexdigest(), size_bytes=len(data),
            dataset_fingerprint=spec.dataset_fingerprint, config_fingerprint=spec.config_fingerprint,
            model_version=spec.model_version, created_utc=utc_now())
        self.assertTrue(self.call("commit", role="primary",
                                  manifest=manifest.model_dump(mode="json"),
                                  data=b64encode(data).decode()))
        self.call("button", role="gateway", **BUTTON)
        heartbeat = WorkerHeartbeat(
            request_id=uuid4(), job_id=spec.job_id, worker_id=PRIMARY, lease_epoch=1,
            client_utc=utc_now(), step_completed=10, status="RUNNING",
            system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint())
        self.call("heartbeat", role="primary", **heartbeat.model_dump(mode="json"))
        self.assertTrue(self.call("yield", role="primary", epoch=1,
                                  checkpoint_id=manifest.checkpoint_id))

        class Client:
            def call(client_self, action, job, **fields):
                return self.call(action, job, role="standby", **fields)

        standby = CloudWorkerCoordinator(Client(), LocalArtifactStore(self.root / "delayed-standby"))
        offered, = standby.checkpoint_candidates(spec.job_id, STANDBY)
        now[0] += 7
        # Expired readiness remains denied by the API itself.
        self.assertEqual(self.request("download", role="standby", epoch=1,
                                      checkpoint_id=offered.checkpoint_id)[0], 403)
        self.assertEqual(standby.fetch_checkpoint(offered).read_bytes(), data)
        now[0] += 7  # Deserialization/transfer can also delay ownership claim.
        self.assertEqual(self.call("claim", role="standby", epoch=1,
                                   checkpoint_id=offered.checkpoint_id)["action"], "STOP")
        plan = standby.claim_standby(spec.job_id, STANDBY, 1, offered.checkpoint_id)
        self.assertEqual((plan.action, plan.lease_epoch), ("RUN", 2))
        self.assertEqual(self.request("download", role="primary", epoch=1,
                                      checkpoint_id=offered.checkpoint_id)[0], 403)

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
        incident = self.call("button", role="gateway", **BUTTON)
        self.assertEqual(self.call("button", role="gateway", **BUTTON), incident)
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
        journal = self.call("events")
        self.assertTrue(journal["chain_valid"])
        received, = [event for event in journal["events"] if event["event_type"] == "SENSOR_EVENT_RECEIVED"]
        rescue, = [event for event in journal["events"] if event["event_type"] == "RESCUE_REQUESTED"]
        self.assertEqual(received["source_type"], "injected")
        self.assertEqual(received["incident_id"], incident)
        self.assertEqual(rescue["trigger_event_id"], received["event_id"])
