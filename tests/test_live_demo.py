"""Exercise the live launch and evidence surface using real CPU training on one host."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import redirect_stdout
import io
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import time
import unittest
from unittest.mock import patch
from uuid import uuid4

from liferaft.artifacts import LocalArtifactStore
from liferaft.cloud import CloudClient, CloudWorkerCoordinator, demo_job_spec
from liferaft.cloud_api import application
from liferaft.live_cockpit import snapshot
from liferaft.pi import PI_PRIMARY
from liferaft.worker import run_worker
from test_cloud import BUTTON, LocalRepository, TOKENS
from test_signed_training import WSGIOpener


class LiveDemoTests(unittest.TestCase):
    def test_scoped_start_button_and_real_handoff_projection(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            tokens = {**TOKENS, "pi_primary": "e" * 64}
            opener = WSGIOpener(application(LocalRepository(root / "host"), tokens, drills=True, live_demo=True))
            clients = {role: CloudClient("https://offline.test", token) for role, token in tokens.items()}
            for client in clients.values():
                client.opener = opener
            operator = clients["operator"]
            job = "pi-live-offline"
            spec = demo_job_spec(job, PI_PRIMARY).model_dump(mode="json")
            with self.assertRaisesRegex(RuntimeError, "HTTP 409"):
                operator.call("demo_start", job, **spec)
            instances = {role: str(uuid4()) for role in ("standby", "pi_primary", "gateway")}

            def poll(role, instance=None):
                return clients[role].call("demo_poll", instance=instance or instances[role], readiness="ready")["job"]

            for role in instances:
                self.assertIsNone(poll(role))
            with self.assertRaisesRegex(RuntimeError, "HTTP 403"):
                clients["gateway"].call("demo_start", job, **spec)
            self.assertEqual(operator.call("demo_start", job, **spec), {"job": job})
            initial = snapshot(operator)
            self.assertEqual(initial["job"], job)
            self.assertEqual(initial["health"]["state"], "CREATED")
            self.assertIsNone(initial["replay"])
            with self.assertRaisesRegex(RuntimeError, "HTTP 409"):
                operator.call("demo_start", job, **spec)
            for role in instances:
                self.assertEqual(poll(role), job)
                self.assertIsNone(poll(role, str(uuid4())))
                self.assertNotIn("instance", operator.call("demo_status")["run"]["devices"][role])
            self.assertFalse(clients["gateway"].call("demo_button_ready", job))
            with self.assertRaisesRegex(RuntimeError, "HTTP 422"):
                clients["gateway"].call("demo_report", job, instance=instances["standby"], stage="armed", reason=None)

            def worker(role, identity):
                store = LocalArtifactStore(root / role)
                bridge = CloudWorkerCoordinator(clients[role], store, adaptive=True)
                run_worker(bridge, store, job_id=job, worker_id=identity,
                           role="primary" if role == "pi_primary" else "standby",
                           step_sleep=.018, timeout=25, poll_s=.1,
                           fetch_checkpoint=bridge.fetch_checkpoint, adaptive=True, sample_loss=True)

            with (ThreadPoolExecutor(max_workers=2) as pool,
                  patch("liferaft.worker.guarded_temperature", return_value=42.0),
                  patch("liferaft.worker.platform.system", return_value="Linux"),
                  patch("liferaft.worker.platform.machine", return_value="aarch64"),
                  redirect_stdout(io.StringIO())):
                standby = pool.submit(worker, "standby", "laptop-standby")
                primary = pool.submit(worker, "pi_primary", PI_PRIMARY)
                deadline = time.monotonic() + 10
                while time.monotonic() < deadline and not clients["gateway"].call("demo_button_ready", job):
                    time.sleep(.15)
                self.assertLess(time.monotonic(), deadline, "verified checkpoint did not become ready")
                self.assertTrue(clients["gateway"].call("button", job, **BUTTON))
                primary.result(timeout=10)
                standby.result(timeout=20)

            view = snapshot(operator, job)
            recovery = view["replay"]["recovery"]
            self.assertTrue(recovery["verified_resumed"])
            self.assertTrue(recovery["completed_after_resume"])
            self.assertEqual(recovery["checkpoint"]["producer"], PI_PRIMARY)
            self.assertEqual(recovery["resumed"]["step"], recovery["checkpoint"]["step"] + 1)
            self.assertEqual(recovery["resumed"]["epoch"], 2)
            self.assertEqual(recovery["rpo_steps"], 0)
            self.assertGreater(len(view["replay"]["losses"]), 1)
            self.assertTrue(all(sample["origin"] == "journal" for sample in view["replay"]["losses"]))
            trigger = next(event for event in view["replay"]["events"] if event["kind"] == "SENSOR_EVENT_RECEIVED")
            self.assertEqual(trigger["source"], "injected")
            self.assertEqual(view["health"]["state"], "COMPLETED")

    def test_abandoned_run_frees_slot_once_every_agent_is_idle(self):
        with TemporaryDirectory() as temp:
            tokens = {**TOKENS, "pi_primary": "e" * 64}
            opener = WSGIOpener(application(LocalRepository(Path(temp)), tokens, drills=True, live_demo=True))
            clients = {role: CloudClient("https://offline.test", token) for role, token in tokens.items()}
            for client in clients.values():
                client.opener = opener
            operator = clients["operator"]
            first, second = "pi-live-abandon-001", "pi-live-abandon-002"
            instances = {role: str(uuid4()) for role in ("standby", "pi_primary", "gateway")}

            def poll(role, instance):
                return clients[role].call("demo_poll", instance=instance, readiness="ready")["job"]

            def start(job):
                return operator.call("demo_start", job, **demo_job_spec(job, PI_PRIMARY).model_dump(mode="json"))

            for role, instance in instances.items():
                poll(role, instance)
            start(first)
            for role, instance in instances.items():
                self.assertEqual(poll(role, instance), first)
            # The Pi yields and the button fires; the standby dies mid-training.
            for role, stage in (("pi_primary", "finished"), ("gateway", "triggered"), ("standby", "training")):
                clients[role].call("demo_report", first, instance=instances[role], stage=stage, reason=None)
            later = SimpleNamespace(time=lambda: time.time() + 31)
            with patch("liferaft.demo_control.time", later):
                for role in ("pi_primary", "gateway"):
                    self.assertIsNone(poll(role, str(uuid4())))
                with self.assertRaisesRegex(RuntimeError, "HTTP 409"):
                    start(second)
                self.assertIsNone(poll("standby", str(uuid4())))
                self.assertEqual(start(second), {"job": second})


if __name__ == "__main__":
    unittest.main()
