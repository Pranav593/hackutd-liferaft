"""Real CPU training through in-process WSGI transport, not hosted/TLS proof."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from urllib.error import HTTPError
from urllib.parse import urlsplit
from uuid import uuid4

import torch

from liferaft.artifacts import IntegrityError, LocalArtifactStore
from liferaft.checkpoint import restore, save
from liferaft.cloud import CloudClient, CloudWorkerCoordinator
from liferaft.cloud_api import PRIMARY, STANDBY, application
from liferaft.contracts import CheckpointManifest, WorkerCheckpoint, WorkerHeartbeat, WorkerSystem, utc_now
from liferaft.evidence import recovery_brief, verify_journal
from liferaft.failover import JobSpec, LocalFailover
from liferaft.worker import run_worker
from liferaft.workload import CONFIG_FINGERPRINT, MODEL_VERSION, TrainingSession
from test_cloud import LocalRepository, TOKENS


class WSGIOpener:
    """Keep real request serialization, auth and byte parsing; replace network only."""
    def __init__(self, app):
        self.app, self.requests, self.corrupt_download = app, [], False

    def open(self, request, *, timeout):
        self.requests.append(request)
        parts = urlsplit(request.full_url)
        data = request.data or b""
        captured = []
        chunks = self.app({"REQUEST_METHOD": request.get_method(), "PATH_INFO": parts.path,
                           "QUERY_STRING": parts.query, "HTTP_AUTHORIZATION": request.get_header("Authorization", ""),
                           "CONTENT_LENGTH": str(len(data)), "wsgi.input": io.BytesIO(data)},
                          lambda status, headers: captured.append((int(status.split()[0]), dict(headers))))
        raw = b"".join(chunks)
        code, headers = captured[0]
        if code != 200:
            raise HTTPError(request.full_url, code, "offline API response", headers, io.BytesIO(raw))
        if self.corrupt_download and request.get_method() == "GET":
            raw = bytes([raw[0] ^ 1]) + raw[1:]
        return io.BytesIO(raw)


class SignedTrainingTests(unittest.TestCase):
    def test_real_200_step_resume_and_corrupt_transfer_rejection(self):
        baseline = TrainingSession(1729)
        while baseline.step < 200:
            baseline.advance()
        session = TrainingSession(1729)
        with TemporaryDirectory() as temp:
            root = Path(temp)
            repository = LocalRepository(root / "coordinator")
            app = application(repository, TOKENS, drills=True)
            opener = WSGIOpener(app)

            def client(role):
                result = CloudClient("https://offline.test", TOKENS[role])
                result.opener = opener
                return result

            operator = client("operator")
            primary = CloudWorkerCoordinator(client("primary"), LocalArtifactStore(root / "primary"))
            standby = CloudWorkerCoordinator(client("standby"), LocalArtifactStore(root / "standby"))
            spec = JobSpec(job_id="test-job", run_id="test-run", primary=PRIMARY, seed=1729,
                           target=200, checkpoint_every=10, model_version=MODEL_VERSION,
                           dataset_fingerprint=session.dataset_fingerprint, config_fingerprint=CONFIG_FINGERPRINT)
            operator.call("create", spec.job_id, **spec.model_dump(mode="json"))
            primary.start_primary(spec.job_id, PRIMARY)
            standby.register_standby(spec.job_id, STANDBY)
            while session.step < 25:
                session.advance()
            manifest, _ = save(session, primary.store, job_id=spec.job_id, run_id=spec.run_id,
                               worker_id=PRIMARY, lease_epoch=1)
            self.assertTrue(primary.commit_checkpoint(manifest))
            operator.call("rescue", spec.job_id, request_id=str(uuid4()))
            plan = primary.heartbeat(WorkerHeartbeat(
                request_id=uuid4(), job_id=spec.job_id, worker_id=PRIMARY, lease_epoch=1,
                client_utc=utc_now(), step_completed=25, status="RUNNING",
                system=WorkerSystem(os="test", arch="test"), checkpoint=WorkerCheckpoint()))
            self.assertEqual(plan.action, "PAUSE")
            self.assertTrue(primary.yield_or_pause(spec.job_id, PRIMARY, 1, manifest.checkpoint_id))
            offered, = standby.checkpoint_candidates(spec.job_id, STANDBY)
            opener.corrupt_download = True
            with self.assertRaises(IntegrityError):
                standby.fetch_checkpoint(offered)
            self.assertFalse(standby.store.path_for(offered.path).exists())
            self.assertEqual(operator.call("status", spec.job_id)["epoch"], 1)
            opener.corrupt_download = False
            with redirect_stdout(io.StringIO()) as output:
                run_worker(standby, standby.store, job_id=spec.job_id, worker_id=STANDBY,
                           role="standby", step_sleep=0.03, timeout=40, poll_s=0.1,
                           fetch_checkpoint=standby.fetch_checkpoint)
            rows = [json.loads(line) for line in output.getvalue().splitlines()]
            steps = [r for r in rows if r["event_type"] == "TRAINING_STEP_COMPLETED"]
            self.assertEqual([r["step_completed"] for r in steps], list(range(26, 201)))
            self.assertEqual([r["loss"] for r in steps], baseline.losses[25:])
            status = operator.call("status", spec.job_id)
            self.assertEqual((status["state"], status["owner"], status["epoch"], status["last_step"]),
                             ("COMPLETED", STANDBY, 2, 200))
            policy = LocalFailover(root / "coordinator" / spec.job_id)
            with policy.transaction() as db:
                row = db.execute("SELECT manifest FROM checkpoints WHERE job_id=? AND step=200",
                                 (spec.job_id,)).fetchone()
            final = CheckpointManifest.model_validate_json(row["manifest"])
            resumed, _ = restore(standby.store.path_for(final.path), job_id=spec.job_id,
                                 run_id=spec.run_id, seed=1729, trusted_manifest=final)
            for name, tensor in baseline.model.state_dict().items():
                self.assertTrue(torch.equal(tensor, resumed.model.state_dict()[name]), name)
            journal = operator.export_events(spec.job_id)
            brief = recovery_brief(verify_journal(journal, spec.job_id), spec.job_id)
            self.assertTrue(brief["verified_resumed"])
            self.assertTrue(brief["completed_after_resume"])
            self.assertEqual(brief["rpo_steps"], 0)
            self.assertGreater(brief["rto_ms"], 0)
            methods = [r.get_method() for r in opener.requests if urlsplit(r.full_url).path == "/v1/checkpoint"]
            self.assertIn("PUT", methods)
            self.assertIn("GET", methods)
            controls = [json.loads(r.data)["action"] for r in opener.requests if r.get_method() == "POST"]
            self.assertNotIn("commit", controls)
            self.assertNotIn("download", controls)
            print(json.dumps({"mode": "same_host_in_process_wsgi", "target_step": 200,
                              "resumed_first_step": 26, "max_loss_difference": 0.0,
                              "final_weights_equal": True, "checkpoint_bytes": manifest.size_bytes,
                              "journal_events": len(journal["events"]), "rto_ms": brief["rto_ms"],
                              "rpo_steps": brief["rpo_steps"], "corrupt_download_rejected": True}))
