"""Phase 1 gate: real CPU PyTorch is required to run this file."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import torch
from pydantic import ValidationError

from liferaft.artifacts import IntegrityError, LocalArtifactStore
from liferaft.checkpoint import read_manifest, restore, save
from liferaft.workload import TrainingSession


class TrainingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.store = LocalArtifactStore(self.root)

    def run_training(self, state_name, *args):
        result = subprocess.run(
            [sys.executable, "-m", "liferaft", *args], text=True,
            env={**os.environ, "LIFERAFT_STATE_DIR": str(self.root / state_name)},
            capture_output=True, timeout=60,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return [json.loads(line) for line in result.stdout.splitlines()]

    def test_independent_process_resume_matches_baseline(self):
        common = ["--checkpoint-every", "10", "--job", "proof-job", "--seed", "1729"]
        baseline = self.run_training("baseline", "train", "--steps", "200", *common)
        primary = self.run_training("rescue", "train", "--steps", "120", *common)
        resumed = self.run_training(
            "rescue", "resume", "--checkpoint", primary[-1]["path"], "--steps", "200", *common,
        )
        baseline_steps = [row for row in baseline if row["event_type"] == "TRAINING_STEP_COMPLETED"]
        primary_steps = [row for row in primary if row["event_type"] == "TRAINING_STEP_COMPLETED"]
        resumed_steps = [row for row in resumed if row["event_type"] == "TRAINING_STEP_COMPLETED"]
        self.assertEqual(len(baseline_steps), 200)
        self.assertEqual(len(primary_steps), 120)
        self.assertEqual([row["step_completed"] for row in resumed_steps], list(range(121, 201)))
        self.assertEqual(resumed_steps[0]["worker_id"], "local-standby")
        self.assertEqual([row["loss"] for row in baseline_steps], [row["loss"] for row in primary_steps + resumed_steps])
        baseline_final, _ = restore(Path(baseline[-1]["path"]), job_id="proof-job", seed=1729)
        resumed_final, _ = restore(Path(resumed[-1]["path"]), job_id="proof-job", seed=1729)
        for name, value in baseline_final.model.state_dict().items():
            torch.testing.assert_close(value, resumed_final.model.state_dict()[name], rtol=0, atol=0)
        expected = baseline_final.optimizer.state_dict()
        observed = resumed_final.optimizer.state_dict()
        self.assertEqual(expected["param_groups"], observed["param_groups"])
        for key, slot in expected["state"].items():
            for name, value in slot.items():
                torch.testing.assert_close(value, observed["state"][key][name], rtol=0, atol=0)
        self.assertLess(baseline_steps[-1]["loss"], baseline_steps[0]["loss"])
        self.assertLess(primary[-1]["size_bytes"], 10 * 1024 * 1024)
        print(json.dumps({
            "baseline_steps": 200, "resumed_first_step": 121,
            "initial_loss": baseline_steps[0]["loss"], "resumed_loss": resumed_steps[0]["loss"],
            "final_loss": baseline_steps[-1]["loss"], "same_host_max_loss_difference": 0.0,
            "checkpoint_size_bytes": primary[-1]["size_bytes"], "checkpoint_sha256": primary[-1]["sha256"],
        }), flush=True)

    def save_one(self):
        session = TrainingSession(1729)
        session.advance()
        manifest, path = save(session, self.store, job_id="proof-job", run_id="test-run",
                              worker_id="test-primary", lease_epoch=4)
        return session, manifest, path

    def test_rng_restored(self):
        session, _, path = self.save_one()
        original = session.state()
        TrainingSession(9)
        resumed, _ = restore(path)
        actual = resumed.state()
        for name in ("numpy_rng", "python_rng", "cursor", "seed"):
            self.assertEqual(original[name], actual[name])
        torch.testing.assert_close(original["torch_rng"], actual["torch_rng"], rtol=0, atol=0)

    def test_identity_and_seed_rejected(self):
        _, _, path = self.save_one()
        for field, value in (("job_id", "wrong"), ("run_id", "wrong"), ("seed", 9),
                             ("producer", "wrong"), ("lease_epoch", 3)):
            with self.subTest(field=field), self.assertRaises(IntegrityError):
                restore(path, **{field: value})

    def test_bad_artifact_hash_rejected_before_loading_and_previous_good_remains(self):
        _, _, path = self.save_one()
        copy = self.root / "corrupt" / path.name
        copy.parent.mkdir()
        shutil.copyfile(path.with_suffix(".json"), copy.with_suffix(".json"))
        data = path.read_bytes()
        copy.write_bytes(data[:-1] + bytes([data[-1] ^ 1]))
        with patch("torch.load", side_effect=AssertionError("must hash first")):
            with self.assertRaisesRegex(IntegrityError, "SHA-256"):
                restore(copy)
            copy.write_bytes(data[:-1])
            with self.assertRaisesRegex(IntegrityError, "byte count"):
                restore(copy)
        self.assertEqual(restore(path)[0].step, 1)

    def test_schema_model_dataset_and_embedded_metadata_rejected(self):
        _, manifest, path = self.save_one()
        for field, value, error in (
            ("schema_version", 2, ValidationError),
            ("model_version", "wrong-model", IntegrityError),
            ("dataset_fingerprint", "a" * 64, IntegrityError),
            ("worker_id", "forged-producer", IntegrityError),
        ):
            with self.subTest(field=field):
                data = manifest.model_dump(mode="json")
                data[field] = value
                path.with_suffix(".json").write_text(json.dumps(data))
                with self.assertRaises(error):
                    restore(path)
        path.with_suffix(".json").write_text(manifest.model_dump_json())
        self.assertEqual(read_manifest(path), manifest)

    def test_partial_write_preserves_previous_checkpoint(self):
        _, _, previous = self.save_one()

        def interrupted(stream):
            stream.write(b"partial")
            raise OSError("injected write interruption")

        key = "runs/test-run/checkpoints/000002-test.pt"
        with self.assertRaises(OSError):
            self.store.put(key, interrupted)
        self.assertFalse(self.store.path_for(key).exists())
        self.assertEqual(restore(previous)[0].step, 1)
