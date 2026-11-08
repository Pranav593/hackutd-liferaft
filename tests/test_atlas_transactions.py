"""Real repository algorithm with transactional doubles, not live Atlas proof."""
from contextlib import contextmanager
from copy import deepcopy
import unittest
from unittest.mock import patch

try:
    from pymongo.errors import PyMongoError
except ModuleNotFoundError:
    PyMongoError = None

from liferaft.atlas import AtlasRepository
from liferaft.failover import JobSpec
from test_transfers import fixture_manifest


class Collection:
    def __init__(self):
        self.rows = {}

    def find_one(self, query, **kwargs):
        row = self.rows.get(query["_id"])
        return deepcopy(row) if row and all(row.get(k) == v for k, v in query.items()) else None

    def insert_one(self, row, **kwargs):
        if row["_id"] in self.rows:
            raise AssertionError("unexpected overwrite")
        self.rows[row["_id"]] = deepcopy(row)

    def update_one(self, query, update, **kwargs):
        self.rows[query["_id"]].update(deepcopy(update["$set"]))


class Session:
    def __init__(self, collections):
        self.collections = collections

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    @contextmanager
    def start_transaction(self, **kwargs):
        snapshots = [deepcopy(collection.rows) for collection in self.collections]
        try:
            yield
        except BaseException:
            for collection, snapshot in zip(self.collections, snapshots):
                collection.rows = snapshot
            raise


class Client:
    def __init__(self, collections):
        self.collections = collections
        self.calls = 0

    def start_session(self):
        self.calls += 1
        return Session(self.collections)


@unittest.skipUnless(PyMongoError, "install pinned cloud dependencies for repository fault tests")
class RepositoryTransactionTests(unittest.TestCase):
    def setUp(self):
        self.manifest, self.data = fixture_manifest()
        self.repository = AtlasRepository.__new__(AtlasRepository)
        self.repository.jobs = Collection()
        self.repository.artifacts = Collection()
        self.repository.client = Client([self.repository.jobs, self.repository.artifacts])
        spec = JobSpec(job_id="test-job", run_id="test-run", primary="laptop-primary", seed=1729,
                       target=20, checkpoint_every=10, model_version="test-model",
                       dataset_fingerprint="a" * 64, config_fingerprint="b" * 64)
        self.execute(lambda policy: policy.create_job(spec), create=True)
        self.execute(lambda policy: policy.start_primary("test-job", "laptop-primary"))

    def execute(self, operation, **kwargs):
        return self.repository.execute("test-job", operation, **kwargs)

    def commit(self):
        return self.execute(lambda policy: policy.commit_checkpoint(self.manifest),
                            upload=(self.manifest, self.data))

    def test_snapshot_failure_rolls_back_artifact_and_state(self):
        before = deepcopy(self.repository.jobs.rows)
        with patch.object(self.repository.jobs, "update_one", side_effect=RuntimeError("injected failure")):
            with self.assertRaises(RuntimeError):
                self.commit()
        self.assertEqual(self.repository.jobs.rows, before)
        self.assertEqual(self.repository.artifacts.rows, {})
        self.assertTrue(self.commit())
        self.assertEqual(self.repository.artifacts.rows[self.manifest.path]["data"], self.data)
        self.assertEqual(self.execute(lambda policy: policy.status("test-job"))["last_step"], 10)

    @patch("liferaft.atlas.time.sleep")
    def test_transient_failure_retries_whole_aborted_transaction(self, sleep):
        update = self.repository.jobs.update_one
        fault = PyMongoError("injected conflict", error_labels=["TransientTransactionError"])
        with patch.object(self.repository.jobs, "update_one", side_effect=[fault, None]) as mocked:
            # Second call must actually write; keep first side effect as a fault.
            def fail_once(*args, **kwargs):
                if mocked.call_count == 1:
                    raise fault
                return update(*args, **kwargs)
            mocked.side_effect = fail_once
            self.assertTrue(self.commit())
        self.assertEqual(mocked.call_count, 2)
        sleep.assert_called_once()
        self.assertEqual(len(self.repository.artifacts.rows), 1)

    @patch("liferaft.atlas.time.sleep")
    def test_retry_limit_and_uncertain_commit_do_not_reexecute_unboundedly(self, sleep):
        before = deepcopy(self.repository.jobs.rows)
        for label, attempts in (("TransientTransactionError", 3), ("UnknownTransactionCommitResult", 1)):
            fault = PyMongoError("injected uncertainty", error_labels=[label])
            with patch.object(self.repository.jobs, "update_one", side_effect=fault) as mocked:
                with self.assertRaises(PyMongoError):
                    self.commit()
            self.assertEqual(mocked.call_count, attempts)
            self.assertEqual(self.repository.jobs.rows, before)
            self.assertEqual(self.repository.artifacts.rows, {})
