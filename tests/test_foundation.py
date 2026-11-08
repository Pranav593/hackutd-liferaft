import hashlib
import json
import re
import os
import sqlite3
from contextlib import closing
import subprocess
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

from liferaft.artifacts import IntegrityError, LocalArtifactStore
from liferaft.auth import require_operator
from liferaft.config import redact
from liferaft.contracts import CheckpointManifest, IncidentEvent, utc_now
from liferaft.coordinator import LocalCoordinator, ReplayError
from liferaft.fixtures import MODELS, event_fixture, schema_snapshot


class FoundationTests(unittest.TestCase):
    def test_round_trip_and_schema_snapshot(self):
        event = event_fixture()
        self.assertEqual(event, IncidentEvent.model_validate_json(event.model_dump_json()))
        self.assertEqual(Path("contracts/v1.schema.json").read_text(), schema_snapshot())
        ts = Path("web/src/lib/contracts.ts").read_text()
        def interface_fields(name):
            match = re.search(rf"interface {name}(?: extends (\w+))? \{{([^}}]*)\}}", ts)
            self.assertIsNotNone(match, name)
            parent, body = match.groups()
            inherited = interface_fields(parent) if parent else set()
            return inherited | {line.strip().split(":")[0].removesuffix("?")
                                for line in body.splitlines() if line.strip()}

        for model in MODELS:
            self.assertEqual(interface_fields(model.__name__), set(model.model_fields))

    def test_invalid_timestamps(self):
        for value in ("2026-11-07T15:31:02", "2026-11-07T15:31:02-06:00", 123456789, "2026-02-30T15:31:02Z"):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                event_fixture(created_utc=value)

    def test_offline_sqlite_and_replays(self):
        with tempfile.TemporaryDirectory() as tmp, patch("socket.create_connection", side_effect=AssertionError("offline")):
            coordinator = LocalCoordinator(Path(tmp))
            event = event_fixture(evidence={"api_key": "secret"})
            first = coordinator.record(event)
            coordinator.record(event_fixture())
            with self.assertRaises(ReplayError):
                coordinator.record(event)
            with self.assertRaises(ReplayError):
                coordinator.record(event_fixture(created_utc=utc_now() - timedelta(hours=1)))
            rows = coordinator.events()
            self.assertEqual(rows[1]["prev_hash"], first)
            self.assertEqual(rows[0]["evidence"]["api_key"], "[REDACTED]")
            self.assertTrue(coordinator.verify_chain())
            with closing(sqlite3.connect(coordinator.database)) as db, db:
                db.execute("UPDATE events SET body = '{}' WHERE seq = 1")
            self.assertFalse(coordinator.verify_chain())

    def test_operator_and_redaction(self):
        with self.assertRaises(PermissionError):
            require_operator("local-example", "wrong")
        with self.assertRaises(PermissionError):
            require_operator("", "")
        require_operator("local-example", "local-example")
        with patch.dict(os.environ, {"NVIDIA_API_KEY": "private-test-value"}):
            result = redact({"authorization": "secret", "data": ["private-test-value",
                            "https://example.invalid/object?token=123", "+15555550100"]})
            self.assertEqual(result, {"authorization": "[REDACTED]", "data": ["[REDACTED]"] * 3})

    def test_store_immutable_and_integrity(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = LocalArtifactStore(Path(tmp))
            data = b"owned test bytes"
            key = "runs/run-1/checkpoints/000001-demo.pt"
            manifest = CheckpointManifest(
                checkpoint_id="demo", job_id="job-1", run_id="run-1", step_completed=1,
                worker_id="worker-1", lease_epoch=0, path=key, sha256=hashlib.sha256(data).hexdigest(),
                size_bytes=len(data), dataset_fingerprint="1" * 64, config_fingerprint="2" * 64,
                model_version="tinymlp-v1", created_utc=utc_now(),
            )
            artifact = store.put(key, lambda stream: stream.write(data))
            with self.assertRaises(FileExistsError):
                store.put(key, lambda stream: stream.write(b"rewrite"))
            self.assertEqual(store.verified_bytes(manifest), data)
            artifact.write_bytes(b"x" * len(data))
            with self.assertRaisesRegex(IntegrityError, "SHA-256"):
                store.verified_bytes(manifest)
            with self.assertRaises(IntegrityError):
                store.path_for("../outside")

    def test_doctor_process_and_critical_exit(self):
        env = {**os.environ, "NVIDIA_API_KEY": "private-test-value"}
        cmd = [sys.executable, "-m", "liferaft", "doctor", "--json", "--redact"]
        result = subprocess.run(cmd, env=env, text=True, capture_output=True, check=True, timeout=30)
        self.assertNotIn("private-test-value", result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)["https_egress"], "not_requested")
        result = subprocess.run([*cmd, "--cloud"], env=env, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 1)
