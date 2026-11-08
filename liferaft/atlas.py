"""Atlas persistence for the same bounded recovery policy used in local mode."""
from pathlib import Path
from tempfile import TemporaryDirectory
import time

from .artifacts import IntegrityError, verify_data
from .failover import LocalFailover

MAX_STATE_BYTES = 2 * 1024 * 1024


class AtlasArtifacts:
    def __init__(self, collection, session, job_id, upload):
        self.collection = collection
        self.session = session
        self.job_id = job_id
        self.upload = upload

    def verified_bytes(self, manifest):
        if manifest.job_id != self.job_id:
            raise IntegrityError("checkpoint belongs to another job")
        if self.upload is not None and self.upload[0] == manifest:
            return verify_data(self.upload[1], manifest)
        row = self.collection.find_one(
            {"_id": manifest.path, "job": self.job_id}, session=self.session,
        )
        if row is None:
            raise IntegrityError("checkpoint object is missing")
        return verify_data(row["data"], manifest)

    def persist_upload(self):
        manifest, data = self.upload
        if manifest.job_id != self.job_id:
            raise IntegrityError("checkpoint belongs to another job")
        verify_data(data, manifest)
        row = self.collection.find_one({"_id": manifest.path}, session=self.session)
        if row is None:
            self.collection.insert_one(
                {"_id": manifest.path, "job": self.job_id, "data": data}, session=self.session,
            )
        elif row["job"] != self.job_id or row["data"] != data:
            raise IntegrityError("checkpoint object cannot be overwritten")


class AtlasRepository:
    def __init__(self, uri):
        from pymongo import MongoClient

        self.client = MongoClient(uri, timeoutMS=4000, serverSelectionTimeoutMS=3000,
                                  maxPoolSize=8, tls=True, tlsAllowInvalidCertificates=False,
                                  tlsAllowInvalidHostnames=False, appname="liferaft")
        db = self.client["liferaft"]
        self.jobs = db["job_state_v1"]
        self.artifacts = db["checkpoint_objects_v1"]

    def ping(self):
        self.client.admin.command("ping")

    def execute(self, job_id, operation, *, create=False, upload=None):
        from pymongo import timeout
        from pymongo.errors import DuplicateKeyError, PyMongoError
        from pymongo.read_concern import ReadConcern
        from pymongo.write_concern import WriteConcern

        with timeout(5):
            for attempt in range(3):
                try:
                    with self.client.start_session() as session, session.start_transaction(
                        read_concern=ReadConcern("snapshot"), write_concern=WriteConcern("majority"),
                    ):
                        row = self.jobs.find_one({"_id": job_id}, session=session)
                        if create == (row is not None):
                            raise ValueError("job already exists or is unavailable")
                        with TemporaryDirectory(prefix="liferaft-atlas-") as temp:
                            directory = Path(temp)
                            original = row["state"] if row else None
                            if original is not None:
                                if len(original) > MAX_STATE_BYTES:
                                    raise RuntimeError("job state exceeds size cap")
                                (directory / "coordinator.sqlite3").write_bytes(original)
                            policy = LocalFailover(directory)
                            store = AtlasArtifacts(self.artifacts, session, job_id, upload)
                            policy.store = store
                            result = operation(policy)
                            updated = policy.database.read_bytes()
                        if len(updated) > MAX_STATE_BYTES:
                            raise RuntimeError("job state exceeds size cap")
                        if upload is not None and result is True:
                            store.persist_upload()
                        if row is None:
                            self.jobs.insert_one({"_id": job_id, "state": updated}, session=session)
                        elif updated != original:
                            self.jobs.update_one({"_id": job_id}, {"$set": {"state": updated}},
                                                 session=session)
                    return result
                except DuplicateKeyError:
                    raise ValueError("job or checkpoint already exists") from None
                except PyMongoError as error:
                    if attempt == 2 or not error.has_error_label("TransientTransactionError"):
                        raise
                    time.sleep(0.025 * (attempt + 1))
