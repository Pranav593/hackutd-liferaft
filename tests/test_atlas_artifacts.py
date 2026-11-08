"""Storage-boundary faults without claiming real Atlas transaction coverage."""
import unittest
from unittest.mock import Mock

from liferaft.artifacts import IntegrityError
from liferaft.atlas import AtlasArtifacts
from test_transfers import fixture_manifest


class AtlasArtifactTests(unittest.TestCase):
    def setUp(self):
        self.manifest, self.data = fixture_manifest()
        self.collection = Mock()
        self.session = object()

    def store(self, data=None, job="test-job"):
        return AtlasArtifacts(self.collection, self.session, job,
                              (self.manifest, self.data if data is None else data))

    def test_immutable_insert_and_identical_retry(self):
        self.collection.find_one.return_value = None
        self.store().persist_upload()
        self.collection.insert_one.assert_called_once_with(
            {"_id": self.manifest.path, "job": "test-job", "data": self.data}, session=self.session)
        self.collection.insert_one.reset_mock()
        self.collection.find_one.return_value = {"job": "test-job", "data": self.data}
        self.store().persist_upload()
        self.collection.insert_one.assert_not_called()
        self.collection.find_one.return_value = {"job": "test-job", "data": b"old"}
        with self.assertRaises(IntegrityError):
            self.store().persist_upload()
        self.collection.insert_one.assert_not_called()

    def test_corrupt_bytes_and_cross_job_upload_never_reach_database(self):
        for store in (self.store(data=b"corrupt"), self.store(job="another-job")):
            with self.assertRaises(IntegrityError):
                store.persist_upload()
        self.collection.find_one.assert_not_called()
        self.collection.insert_one.assert_not_called()
        with self.assertRaises(IntegrityError):
            self.store(job="another-job").verified_bytes(self.manifest)

    def test_missing_and_corrupt_download_fail_closed(self):
        store = AtlasArtifacts(self.collection, self.session, "test-job", None)
        for row in (None, {"data": b"corrupt"}):
            self.collection.find_one.return_value = row
            with self.assertRaises(IntegrityError):
                store.verified_bytes(self.manifest)
        self.collection.find_one.return_value = {"data": self.data}
        self.assertEqual(store.verified_bytes(self.manifest), self.data)
