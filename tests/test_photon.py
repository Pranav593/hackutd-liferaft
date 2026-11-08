"""Signed Photon 2.0 wire fixtures. No messages leave this process."""
from base64 import b64encode
import hmac
import io
import json
import subprocess
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

from liferaft.cloud_api import application
from liferaft.failover import JobSpec
from liferaft.photon import PhotonClient, PhotonScope, PhotonSendError
import test_cloud


def provider_id(kind, n):
    return f"pho_{kind}_{n:026}"


class PhotonTests(unittest.TestCase):
    def setUp(self):
        self.harness = test_cloud.CloudTests()
        self.harness.setUp()
        self.addCleanup(self.harness.doCleanups)
        self.job = "test-job"
        self.scope = PhotonScope(provider_id("prj", 1), provider_id("spc", 1), provider_id("usr", 1),
                                 provider_id("usr", 2), self.job, b"fixture-secret" * 2)
        self.tokens = test_cloud.TOKENS | {"photon": "e" * 64}
        self.harness.app = application(self.harness.repository, self.tokens, drills=True, photon=self.scope)
        spec = JobSpec(job_id=self.job, run_id="run-fixture", primary="laptop-primary", seed=1729, target=20,
                       checkpoint_every=10, model_version="model", config_fingerprint="a" * 64,
                       dataset_fingerprint="b" * 64)
        self.harness.call("create", **spec.model_dump(mode="json"))
        self.harness.call("start", role="primary")
        self.harness.call("register", role="standby")
        self.harness.call("rescue", request_id=str(uuid4()))

    def event(self, *, status="received", eid=1, mid=1, sender=None, text="ACK"):
        p = self.scope
        return {"type": f"message.{status}", "source": "imessage.photon", "apiVersion": "2026-07-01",
                "id": provider_id("evt", eid), "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "data": {"projectId": p.project, "object": {"id": provider_id("msg", mid), "projectId": p.project,
                    "space": {"id": p.space, "kind": "direct", "participantIds": [p.agent, p.operator]},
                    "sentBy": {"id": sender or (p.operator if status == "received" else p.agent)},
                    "platform": "imessage", "status": status, "content": {"type": "text", "text": text}}}}

    def post(self, event, *, stale=False, tamper=False):
        raw = json.dumps(event).encode()
        identity = str(uuid4())
        stamp = str(int(time.time()) - (400 if stale else 0))
        signature = b64encode(hmac.digest(self.scope.secret, f"{identity}.{stamp}.".encode() + raw, "sha256")).decode()
        if tamper:
            raw += b" "
        return self.request("/v1/photon/webhook", raw, HTTP_WEBHOOK_ID=identity,
                            HTTP_WEBHOOK_TIMESTAMP=stamp, HTTP_WEBHOOK_SIGNATURE="v1," + signature)

    def request(self, path, raw, **headers):
        code = []
        response = self.harness.app({"REQUEST_METHOD": "POST", "PATH_INFO": path, "CONTENT_LENGTH": str(len(raw)),
                                     "wsgi.input": io.BytesIO(raw), **headers},
                                    lambda status, _: code.append(int(status.split()[0])))
        return code[0], json.loads(b"".join(response))

    def control(self, action, **args):
        raw = json.dumps(dict(action=action, job=self.job, sent_at=time.time(), args=args)).encode()
        code, response = self.request("/v1/control", raw, HTTP_AUTHORIZATION="Bearer " + self.tokens["photon"])
        self.assertEqual(code, 200, response)
        return response["result"]

    def test_signed_allowlisted_ack_and_provider_delivery(self):
        self.assertEqual(self.post(self.event(), tamper=True)[0], 401)
        self.assertEqual(self.post(self.event(), stale=True)[0], 401)
        self.assertEqual(self.post(self.event(sender=provider_id("usr", 3)))[0], 200)
        self.assertEqual(self.post(self.event(text="SHUTDOWN"))[0], 200)
        self.assertEqual(self.harness.request("photon_claim")[0], 403)
        self.assertEqual(self.post(self.event())[0], 200)
        self.assertEqual(self.post(self.event(eid=2))[0], 200)
        task = self.control("photon_claim")
        self.assertIn("cooling drill", task["text"])
        self.assertFalse(self.control("photon_result", task_id=task["id"], lease="0" * 32,
                                      message_id=provider_id("msg", 3)))
        self.assertEqual(self.post(self.event(status="delivered", eid=3, mid=3))[0], 503)
        self.assertTrue(self.control("photon_result", task_id=task["id"], lease=task["lease"],
                                     message_id=provider_id("msg", 3)))
        self.assertEqual(self.post(self.event(status="delivered", eid=3, mid=3))[0], 200)
        self.assertEqual(self.post(self.event(status="delivered", eid=3, mid=3))[0], 200)
        reply = self.control("photon_claim")
        self.assertIn("Acknowledged", reply["text"])
        self.assertIsNone(self.control("photon_claim"))
        kinds = [entry["event_type"] for entry in self.harness.call("events")["events"]]
        for kind in ("PHOTON_ACK", "PHOTON_COMMAND_RECEIVED", "PHOTON_ACCEPTED", "PHOTON_DELIVERED"):
            self.assertEqual(kinds.count(kind), 1)
        self.assertEqual(self.harness.call("status")["state"], "RESCUE_REQUESTED")

    def test_advisory_is_bound_to_verified_recovery_and_available_to_why(self):
        from test_transfers import fixture_manifest

        trigger = next(event for event in self.harness.call("events")["events"]
                       if event["event_type"] == "RESCUE_REQUESTED")
        context = {"incident": trigger["incident_id"], "summary": "Checkpoint and next step recorded.",
                   "refs": [trigger["event_id"]]}
        self.assertFalse(self.control("photon_context", **context))
        manifest, data = fixture_manifest()
        manifest = manifest.model_copy(update={"run_id": "run-fixture", "model_version": "model",
            "path": "runs/run-fixture/checkpoints/000010-test.pt",
            "config_fingerprint": "a" * 64, "dataset_fingerprint": "b" * 64})
        heartbeat = dict(protocol_version=1, request_id=str(uuid4()), job_id=self.job,
                         worker_id="laptop-primary", lease_epoch=1, step_completed=0, status="RUNNING",
                         client_utc=datetime.now(timezone.utc).isoformat(),
                         system={"os": "Linux", "arch": "x86_64"}, checkpoint={})
        self.assertEqual(self.harness.call("heartbeat", role="primary", **heartbeat)["action"], "PAUSE")
        self.assertTrue(self.harness.call("commit", role="primary", manifest=manifest.model_dump(mode="json"),
                                          data=b64encode(data).decode()))
        self.assertTrue(self.harness.call("yield", role="primary", checkpoint_id=manifest.checkpoint_id, epoch=1))
        self.assertEqual(self.harness.call("claim", role="standby", checkpoint_id=manifest.checkpoint_id,
                                           epoch=1)["lease_epoch"], 2)
        self.assertTrue(self.harness.call("resumed", role="standby", epoch=2, step=11, loss=0.2,
                                          sha256=manifest.sha256))
        self.assertFalse(self.control("photon_context", **(context | {"refs": [str(uuid4())]})))
        self.assertTrue(self.control("photon_context", **context))
        self.assertTrue(self.control("photon_context", **context))
        self.assertEqual(self.post(self.event(text="WHY"))[0], 200)
        queued = [self.control("photon_claim")["text"] for _ in range(4)]
        self.assertEqual(sum("Nemotron advisory:" in text for text in queued), 2)
        self.assertTrue(any(trigger["event_id"] in text for text in queued))
        self.assertIsNone(self.control("photon_claim"))
        self.assertEqual(self.harness.call("status")["state"], "VERIFIED_RESUMED")

    def test_send_body_and_uncertain_timeout(self):
        client = PhotonClient("pho_sk_" + "x" * 32)
        task = self.control("photon_claim")
        message = self.event(status="delivered", mid=7)["data"]["object"]

        def fake_run(args, *, input, stdout, stderr, timeout):
            self.assertEqual(timeout, 4)
            self.assertNotIn(client.key, " ".join(args))
            self.assertEqual(args[1:4], ["--disable", "--config", "-"])
            self.assertIn(f'Authorization: Bearer {client.key}', input.decode())
            self.assertIn(f'Idempotency-Key: {task["id"]}', input.decode())
            payload = input.decode().split("data-binary = ", 1)[1]
            self.assertEqual(json.loads(json.loads(payload))["spaceId"], self.scope.space)
            return subprocess.CompletedProcess(args, 0, json.dumps(message).encode() + b"\n202")

        with patch("liferaft.photon.subprocess.run", side_effect=fake_run):
            self.assertEqual(client.send(task), provider_id("msg", 7))
        with patch("liferaft.photon.subprocess.run", side_effect=subprocess.TimeoutExpired("curl", 4)):
            with self.assertRaises(PhotonSendError) as raised:
                client.send(task)
            self.assertTrue(raised.exception.retryable)
