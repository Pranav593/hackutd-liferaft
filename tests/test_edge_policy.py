"""Software fixtures only. No board or thermal loading."""
from datetime import datetime, timezone
import unittest
from unittest.mock import ANY, patch
from uuid import uuid4

from liferaft.bridge import display_state, monitor
from liferaft.cloud_api import application
from liferaft.contracts import AmbientFrame
from liferaft.failover import JobSpec
from liferaft.pi import guarded_temperature
from liferaft.risk import decide
import test_cloud
from test_transfers import fixture_manifest


class EdgePolicyTests(unittest.TestCase):
    def test_risk_gates_and_hysteresis(self):
        inputs = dict(normal=10, active=False, cpu=51, previous_cpu=48, ambient=32, heartbeat_gap=2,
                      standby_ready=True, lease_valid=True, checkpoint_age=3, checkpoint_ms=15,
                      step_wall_ms=100, injected=False)
        self.assertEqual(decide(**inputs).interval, 5)
        for changes in ({"cpu": None, "injected": True}, {"standby_ready": False}, {"lease_valid": False},
                        {"checkpoint_ms": 110}, {"step_wall_ms": None}, {"cpu": 48}):
            self.assertEqual(decide(**(inputs | changes)).interval, 10)
        self.assertEqual(decide(**(inputs | {"cpu": 53, "previous_cpu": 53, "active": True})).interval, 5)
        self.assertEqual(decide(**(inputs | {"cpu": 53, "previous_cpu": 53})).interval, 10)

    def test_display_requires_matching_incident_and_measured_resume_marker(self):
        base = {"incident_id": "inc-one", "resume_step": None, "block_reason": None}
        self.assertEqual(display_state(base | {"state": "PREEMPTING"}, "inc-one"), "SAVING")
        self.assertEqual(display_state(base | {"state": "COMPLETED"}, "inc-one"), "PENDING")
        self.assertEqual(display_state(base | {"state": "COMPLETED", "resume_step": 10}, "inc-two"), "PENDING")
        self.assertEqual(display_state(base | {"state": "COMPLETED", "resume_step": 10}, "inc-one"), "RECOVERED")

    def test_serial_monitor_forwards_measurements_and_arms_only_one_drill(self):
        from contextlib import redirect_stdout
        import io
        import json
        from unittest.mock import Mock

        base = dict(protocol_version=1, device_id="esp32-s3-01", seq=1, uptime_ms=1000,
                    ambient_temp_c=24.5, ambient_valid=True, button_pressed=False,
                    event_type="TELEMETRY", source_type="measured")
        button = base | dict(seq=2, uptime_ms=2000, ambient_temp_c=None, ambient_valid=False,
                             button_pressed=True, event_type="COOLING_FAILURE_TEST", source_type="injected")
        frames = [base, base, button, button | {"seq": 3, "uptime_ms": 2500}]
        device = Mock()
        tick = 0

        def read_until(size):
            nonlocal tick
            tick += 2
            if frames:
                return (json.dumps(frames.pop(0)) + "\n").encode()
            tick = 240
            return b""

        device.read_until.side_effect = read_until
        gateway = Mock()
        requested = False

        def call(action, job, **data):
            nonlocal requested
            self.assertEqual(job, "test-job-05")
            if action == "ambient":
                self.assertEqual(data["ambient_temp_c"], 24.5)
                return True
            if action == "button":
                requested = True
                return "inc-one"
            return {"state": "VERIFIED_RESUMED" if requested else "PRIMARY_RUNNING",
                    "incident_id": "inc-one" if requested else None, "resume_step": 11 if requested else None}

        gateway.call.side_effect = call
        with redirect_stdout(io.StringIO()):
            monitor(gateway, "test-job-05", device, clock=lambda: tick)
        actions = [item.args[0] for item in gateway.call.call_args_list]
        self.assertEqual(actions.count("ambient"), 1)
        self.assertEqual(actions.count("button"), 1)
        messages = [json.loads(item.args[0]) for item in device.write.call_args_list]
        self.assertEqual([item["id"] for item in messages if item["type"] == "DISPLAY_TRAINING"],
                         ["005"] * (len(messages) // 2))
        displayed = [item["state"] for item in messages if item["type"] == "DISPLAY_STATUS"]
        self.assertIn("RECOVERED", displayed)
        self.assertEqual(displayed[-1], "OFFLINE")

    def test_pi_guard_uses_only_read_interfaces_and_fails_closed(self):
        with patch("liferaft.pi.is_pi5", return_value=True), patch("liferaft.pi.cpu_temperature", return_value=56), patch(
                "liferaft.pi.subprocess.run") as run:
            run.return_value.stdout = "throttled=0x0\n"
            self.assertEqual(guarded_temperature(), 56)
            self.assertEqual(run.call_args.args[0], ["vcgencmd", "get_throttled"])
            run.return_value.stdout = "throttled=0x10000"
            with self.assertRaises(RuntimeError):
                guarded_temperature()
        with patch("liferaft.pi.is_pi5", return_value=True), patch("liferaft.pi.cpu_temperature", return_value=60):
            with self.assertRaises(RuntimeError):
                guarded_temperature()

    def test_ambient_wire_rejects_startup_sentinel(self):
        frame = dict(protocol_version=1, device_id="esp32-s3-01", seq=1, uptime_ms=1000,
                     ambient_temp_c=85, ambient_valid=True, button_pressed=False,
                     event_type="TELEMETRY", source_type="measured")
        with self.assertRaises(ValueError):
            AmbientFrame.model_validate(frame)

    def test_cloud_pi_scope_and_adaptive_heartbeat(self):
        harness = test_cloud.CloudTests()
        harness.setUp()
        self.addCleanup(harness.doCleanups)
        with patch.dict(test_cloud.TOKENS, {"pi_primary": "e" * 64}):
            self.exercise_pi(harness)

    def exercise_pi(self, harness):
        harness.app = application(harness.repository, test_cloud.TOKENS)
        manifest, data = fixture_manifest()
        manifest = manifest.model_copy(update={"worker_id": "pi-primary"})
        job = manifest.job_id
        spec = JobSpec(job_id=job, run_id=manifest.run_id, primary="pi-primary", seed=1729,
                       target=20, checkpoint_every=10, model_version=manifest.model_version,
                       dataset_fingerprint=manifest.dataset_fingerprint, config_fingerprint=manifest.config_fingerprint)
        harness.call("create", job, **spec.model_dump(mode="json"))
        self.assertEqual(harness.call("doctor", None, role="pi_primary")["worker_id"], "pi-primary")
        harness.call("start", job, role="pi_primary")
        harness.call("register", job, role="standby")
        upload = harness.call("upload_url", job, role="pi_primary", manifest=manifest.model_dump(mode="json"))["signed_url"]
        self.assertEqual(harness.transfer(upload, "PUT", role="pi_primary", data=data)[0], 200)
        sample = dict(protocol_version=1, device_id="esp32-s3-01", seq=1, uptime_ms=1000,
                      ambient_temp_c=24.5, ambient_valid=True, button_pressed=False,
                      event_type="TELEMETRY", source_type="measured", session=str(uuid4()))
        self.assertEqual(harness.request("ambient", job, **sample)[0], 403)
        self.assertTrue(harness.call("ambient", job, role="gateway", **sample))
        self.assertFalse(harness.call("ambient", job, role="gateway", **sample))
        heartbeat = dict(protocol_version=1, request_id=str(uuid4()), job_id=job, worker_id="pi-primary",
                         lease_epoch=1, step_completed=manifest.step_completed, status="RUNNING",
                         client_utc=datetime.now(timezone.utc).isoformat(),
                         system={"os": "Linux", "arch": "aarch64", "pi_cpu_temp_c": 56, "cpu_temp_valid": True},
                         checkpoint={"last_committed_id": manifest.checkpoint_id})
        self.assertEqual(harness.request("heartbeat", job, role="pi_primary",
                                        **(heartbeat | {"worker_id": "laptop-primary"}))[0], 403)
        adaptive = heartbeat | {"checkpoint_ms": 15, "step_wall_ms": 400}
        plan = harness.call("heartbeat_edge", job, role="pi_primary", **adaptive)
        self.assertEqual((plan["action"], plan["checkpoint_interval"]), ("RUN", 5))
        self.assertEqual(harness.call("heartbeat_edge", job, role="pi_primary", **adaptive), plan | {
            "lease_remaining_s": ANY})
        report = harness.call("doctor", job)
        self.assertEqual(report["risk_policy"]["ambient_c"], 24.5)
        self.assertEqual(report["risk_policy"]["cpu_c"], 56)
        self.assertIsNotNone(report["lifeboat_score"])
        reading = {"client_utc": datetime.now(timezone.utc).isoformat(), "pi_cpu_temp_c": 42.5}
        self.assertEqual(harness.request("pi_telemetry", job, **reading)[0], 403)
        self.assertTrue(harness.call("pi_telemetry", job, role="pi_primary", **reading))
        self.assertEqual(harness.call("edge_status", job, role="gateway")["state"], "PRIMARY_RUNNING")
        self.assertEqual(harness.request("edge_status", job)[0], 403)


class AdaptiveTrainingTests(unittest.TestCase):
    def test_real_training_matches_fixed_schedule_with_injected_policy_inputs(self):
        from contextlib import redirect_stdout
        import io
        import json
        from pathlib import Path
        from tempfile import TemporaryDirectory
        import time

        from liferaft.checkpoint import restore
        from liferaft.failover import LocalFailover
        from liferaft.worker import run_worker
        from liferaft.workload import CONFIG_FINGERPRINT, MODEL_VERSION, make_dataset

        fingerprint = make_dataset(1729)[2]
        summaries = {}
        losses = {}
        for label, adaptive in (("fixed", False), ("adaptive", True)):
            with TemporaryDirectory() as directory, redirect_stdout(io.StringIO()) as output:
                coordinator = LocalFailover(Path(directory))
                coordinator.create_job(JobSpec(job_id="bench", run_id=f"run-{label}", primary="pi-primary",
                                               seed=1729, target=44, checkpoint_every=10,
                                               model_version=MODEL_VERSION, config_fingerprint=CONFIG_FINGERPRINT,
                                               dataset_fingerprint=fingerprint))
                coordinator.register_standby("bench", "standby")
                started = time.monotonic()
                with patch("liferaft.worker.guarded_temperature", return_value=56):
                    run_worker(coordinator, coordinator.store, job_id="bench", worker_id="pi-primary",
                               role="primary", step_sleep=0.09, timeout=20, adaptive=adaptive)
                elapsed = time.monotonic() - started
                logs = [json.loads(line) for line in output.getvalue().splitlines()]
                commits = [row for row in logs if row["event_type"] == "CHECKPOINT_COST"]
                losses[label] = [row["loss"] for row in logs if row["event_type"] == "TRAINING_STEP_COMPLETED"]
                summaries[label] = {"steps": [row["step_completed"] for row in commits],
                                    "checkpoint_ms": round(sum(row["checkpoint_ms"] for row in commits), 2),
                                    "elapsed_s": round(elapsed, 3)}
                self.assertEqual(coordinator.status("bench")["state"], "COMPLETED")
                checkpoint = next(coordinator.store.root.glob("runs/*/checkpoints/000044-*.pt"))
                session, _ = restore(checkpoint, job_id="bench")
                self.assertEqual(session.losses, losses[label])
        self.assertEqual(losses["fixed"], losses["adaptive"])
        self.assertGreater(len(summaries["adaptive"]["steps"]), len(summaries["fixed"]["steps"]))
        print(json.dumps({"policy_input": "injected Pi guard fixture", "measured_training": summaries,
                          "max_loss_delta": 0.0}))
