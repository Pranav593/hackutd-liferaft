"""Local coordinator for a single primary-to-standby recovery per job."""
from dataclasses import dataclass
from datetime import datetime, timezone
import math
from pathlib import Path
import sqlite3
import time
from typing import Callable, Literal, Protocol
from uuid import UUID, uuid4

from pydantic import Field

from .artifacts import IntegrityError, LocalArtifactStore
from .contracts import CheckpointManifest, Digest, Identifier, IncidentEvent, WireModel, WorkerHeartbeat, utc_now
from .coordinator import LocalCoordinator

HEARTBEAT_S = 2.0
LEASE_TTL_S = 12.0
STANDBY_FRESH_S = 3 * HEARTBEAT_S


class JobSpec(WireModel):
    job_id: Identifier
    run_id: Identifier
    primary: Identifier
    seed: int = Field(ge=0, lt=2**32)
    target: int = Field(ge=2, le=10_000)
    checkpoint_every: int = Field(ge=1, le=10_000)
    model_version: Identifier
    dataset_fingerprint: Digest
    config_fingerprint: Digest


@dataclass(frozen=True)
class JobPlan:
    action: Literal["RUN", "PAUSE", "STOP"]
    lease_epoch: int
    lease_remaining_s: float


class WorkerCoordinator(Protocol):
    """Transport boundary. Workers receive plans and submit typed evidence."""
    def get_spec(self, job_id: str) -> JobSpec: ...
    def start_primary(self, job_id: str, worker_id: str) -> JobPlan: ...
    def heartbeat(self, request: WorkerHeartbeat) -> JobPlan: ...
    def register_standby(self, job_id: str, worker_id: str) -> None: ...
    def checkpoint_candidates(self, job_id: str, worker_id: str) -> list[CheckpointManifest]: ...
    def claim_standby(self, job_id: str, worker_id: str, expected_epoch: int, checkpoint_id: str) -> JobPlan: ...
    def commit_checkpoint(self, manifest: CheckpointManifest) -> bool: ...
    def yield_or_pause(self, job_id: str, worker_id: str, epoch: int, checkpoint_id: str) -> bool: ...
    def mark_first_resumed_step(self, job_id: str, worker_id: str, epoch: int,
                                step: int, loss: float, sha256: str) -> bool: ...
    def complete(self, job_id: str, worker_id: str, epoch: int) -> bool: ...


class LocalFailover(LocalCoordinator):
    def __init__(self, directory: Path, *, clock: Callable[[], float] = time.time,
                 lease_ttl_s: float = LEASE_TTL_S, standby_fresh_s: float = STANDBY_FRESH_S):
        super().__init__(directory)
        self.store = LocalArtifactStore(directory)
        self.clock = clock
        self.lease_ttl_s = lease_ttl_s
        self.standby_fresh_s = standby_fresh_s
        with self.transaction() as db:
            for sql in (
                """CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY, spec TEXT NOT NULL, state TEXT NOT NULL,
                    owner TEXT, epoch INTEGER NOT NULL DEFAULT 0, lease_until REAL,
                    last_step INTEGER NOT NULL DEFAULT 0, incident_id TEXT, detected REAL,
                    yielded_step INTEGER, chosen_id TEXT, block_reason TEXT,
                    rto_ms REAL, rpo_steps INTEGER, resume_step INTEGER
                )""",
                """CREATE TABLE IF NOT EXISTS standby (
                    job_id TEXT NOT NULL, worker_id TEXT NOT NULL, seen REAL NOT NULL,
                    PRIMARY KEY(job_id, worker_id)
                )""",
                """CREATE TABLE IF NOT EXISTS checkpoints (
                    checkpoint_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, epoch INTEGER NOT NULL,
                    step INTEGER NOT NULL, manifest TEXT NOT NULL,
                    UNIQUE(job_id, epoch, step)
                )""",
                """CREATE TABLE IF NOT EXISTS rejected_checkpoints (
                    checkpoint_id TEXT PRIMARY KEY
                )""",
                """CREATE TABLE IF NOT EXISTS rescue_requests (
                    request_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, incident_id TEXT NOT NULL
                )""",
                """CREATE TABLE IF NOT EXISTS heartbeat_requests (
                    request_id TEXT PRIMARY KEY, received REAL NOT NULL
                )""",
            ):
                db.execute(sql)

    @staticmethod
    def _job(db, job_id: str) -> sqlite3.Row:
        job = db.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if job is None:
            raise ValueError("unknown local job")
        return job

    @staticmethod
    def _spec(job) -> JobSpec:
        return JobSpec.model_validate_json(job["spec"])

    def _event(self, db, job, kind: str, *, worker=None, source="derived", event_id=None, **evidence):
        self.append(db, IncidentEvent(
            event_id=event_id or uuid4(), job_id=job["job_id"], incident_id=job["incident_id"],
            created_utc=utc_now(), event_type=kind, source_type=source,
            worker_id=worker if worker is not None else job["owner"], lease_epoch=job["epoch"],
            message=kind.replace("_", " ").capitalize(), evidence=evidence,
        ))

    def _ready(self, db, job, now, worker_id=None) -> bool:
        return db.execute(
            """SELECT 1 FROM standby WHERE job_id = ? AND seen > ?
               AND (? IS NULL OR worker_id = ?) LIMIT 1""",
            (job["job_id"], now - self.standby_fresh_s, worker_id, worker_id),
        ).fetchone() is not None

    @staticmethod
    def _owns(job, worker_id, epoch, now) -> bool:
        return (job["owner"] == worker_id and job["epoch"] == epoch
                and job["lease_until"] is not None and job["lease_until"] > now)

    def _plan(self, job, action, now) -> JobPlan:
        return JobPlan(action, job["epoch"], max(0.0, (job["lease_until"] or now) - now))

    def _block(self, db, job, reason):
        if job["block_reason"] != reason:
            db.execute("UPDATE jobs SET block_reason = ? WHERE job_id = ?", (reason, job["job_id"]))
            self._event(db, job, reason)

    def create_job(self, spec: JobSpec) -> None:
        with self.transaction() as db:
            db.execute("INSERT INTO jobs(job_id, spec, state) VALUES(?, ?, 'CREATED')",
                       (spec.job_id, spec.model_dump_json()))

    def get_spec(self, job_id: str) -> JobSpec:
        with self.transaction() as db:
            return self._spec(self._job(db, job_id))

    def start_primary(self, job_id: str, worker_id: str) -> JobPlan:
        with self.transaction() as db:
            job = self._job(db, job_id)
            now = self.clock()
            if job["state"] != "CREATED" or self._spec(job).primary != worker_id:
                return self._plan(job, "STOP", now)
            db.execute("""UPDATE jobs SET state='PRIMARY_RUNNING', owner=?, epoch=1, lease_until=?
                          WHERE job_id=?""", (worker_id, now + self.lease_ttl_s, job_id))
            job = self._job(db, job_id)
            self._event(db, job, "JOB_STARTED")
            return self._plan(job, "RUN", now)

    def register_standby(self, job_id: str, worker_id: str) -> None:
        with self.transaction() as db:
            job = self._job(db, job_id)
            if self._spec(job).primary == worker_id:
                raise ValueError("primary cannot register as standby")
            db.execute("""INSERT INTO standby VALUES(?, ?, ?) ON CONFLICT(job_id, worker_id)
                          DO UPDATE SET seen=excluded.seen""", (job_id, worker_id, self.clock()))

    def heartbeat(self, request: WorkerHeartbeat) -> JobPlan:
        with self.transaction() as db:
            job = self._job(db, request.job_id)
            now = self.clock()
            if not self._owns(job, request.worker_id, request.lease_epoch, now):
                self._event(db, job, "STALE_LEASE_REJECTED", worker=request.worker_id,
                            presented_epoch=request.lease_epoch, operation="heartbeat")
                return self._plan(job, "STOP", now)
            action = "PAUSE" if job["state"] in ("RESCUE_REQUESTED", "PREEMPTING") else "RUN"
            if (request.status != "RUNNING" or abs(now - request.client_utc.timestamp()) > 60
                    or not job["last_step"] <= request.step_completed <= self._spec(job).target):
                return self._plan(job, "STOP", now)
            db.execute("DELETE FROM heartbeat_requests WHERE received < ?", (now - 120,))
            if not db.execute("INSERT OR IGNORE INTO heartbeat_requests VALUES(?, ?)",
                              (str(request.request_id), now)).rowcount:
                return self._plan(job, action, now)
            db.execute("UPDATE jobs SET lease_until=?, last_step=? WHERE job_id=?",
                       (now + self.lease_ttl_s, request.step_completed, request.job_id))
            self._event(db, job, "WORKER_HEARTBEAT", step=request.step_completed)
            if job["state"] == "RESCUE_REQUESTED":
                db.execute("UPDATE jobs SET state='PREEMPTING' WHERE job_id=?", (request.job_id,))
                self._event(db, job, "PRIMARY_PAUSE_REQUESTED", step=request.step_completed)
            return self._plan(self._job(db, request.job_id), action, now)

    def request_rescue(self, job_id: str, request_id: UUID) -> str:
        with self.transaction() as db:
            job = self._job(db, job_id)
            prior = db.execute("SELECT * FROM rescue_requests WHERE request_id=?",
                               (str(request_id),)).fetchone()
            if prior is not None:
                if prior["job_id"] != job_id:
                    raise ValueError("request ID belongs to another job")
                return prior["incident_id"]
            if job["state"] != "PRIMARY_RUNNING":
                raise ValueError("job has no running primary available for a new drill")
            now = self.clock()
            if not self._owns(job, job["owner"], job["epoch"], now):
                raise ValueError("primary lease already expired")
            incident = f"inc-{uuid4().hex}"
            db.execute("INSERT INTO rescue_requests VALUES(?, ?, ?)", (str(request_id), job_id, incident))
            if not self._ready(db, job, now):
                db.execute("UPDATE jobs SET block_reason='STANDBY_UNAVAILABLE' WHERE job_id=?", (job_id,))
                evidence_job = {**dict(job), "incident_id": incident}
                self._event(db, evidence_job, "STANDBY_UNAVAILABLE", source="injected",
                            event_id=request_id, reason="cooling_drill")
                return incident
            db.execute("""UPDATE jobs SET state='RESCUE_REQUESTED', incident_id=?, detected=?,
                          block_reason=NULL WHERE job_id=?""", (incident, now, job_id))
            self._event(db, self._job(db, job_id), "RESCUE_REQUESTED",
                        source="injected", event_id=request_id, reason="cooling_drill")
            return incident

    def _watchdog(self, db, job, now):
        if job["state"] == "RECOVERY_PENDING" and not self._ready(db, job, now):
            self._block(db, job, "STANDBY_UNAVAILABLE")
            return self._job(db, job["job_id"])
        if job["lease_until"] is None or job["lease_until"] > now:
            return job
        if job["state"] in ("STANDBY_STARTING", "VERIFIED_RESUMED"):
            db.execute("UPDATE jobs SET state='FAILED', lease_until=NULL WHERE job_id=?", (job["job_id"],))
            self._event(db, job, "STANDBY_LEASE_EXPIRED")
            return self._job(db, job["job_id"])
        incident = job["incident_id"] or f"inc-{uuid4().hex}"
        detected = job["detected"] if job["detected"] is not None else now
        db.execute("""UPDATE jobs SET state='RECOVERY_PENDING', lease_until=NULL,
                      incident_id=?, detected=?, yielded_step=NULL WHERE job_id=?""",
                   (incident, detected, job["job_id"]))
        job = self._job(db, job["job_id"])
        self._event(db, job, "PRIMARY_UNREACHABLE", last_reported_step=job["last_step"])
        self._event(db, job, "LEASE_EXPIRED")
        if not self._ready(db, job, now):
            self._block(db, job, "STANDBY_UNAVAILABLE")
        return self._job(db, job["job_id"])

    def status(self, job_id: str) -> dict:
        with self.transaction() as db:
            now = self.clock()
            job = self._watchdog(db, self._job(db, job_id), now)
            return {**{key: job[key] for key in job.keys() if key != "spec"},
                    "standby_ready": self._ready(db, job, now)}

    def commit_checkpoint(self, manifest: CheckpointManifest) -> bool:
        with self.transaction() as db:
            job = self._job(db, manifest.job_id)
            now = self.clock()
            if not self._owns(job, manifest.worker_id, manifest.lease_epoch, now):
                self._event(db, job, "STALE_LEASE_REJECTED", worker=manifest.worker_id,
                            presented_epoch=manifest.lease_epoch, operation="commit_checkpoint")
                return False
            spec = self._spec(job)
            if (manifest.run_id != spec.run_id or manifest.model_version != spec.model_version
                    or manifest.dataset_fingerprint != spec.dataset_fingerprint
                    or manifest.config_fingerprint != spec.config_fingerprint
                    or manifest.step_completed > spec.target or manifest.status != "VERIFIED"
                    or abs(now - manifest.created_utc.timestamp()) > 60):
                return False
            existing = db.execute("SELECT manifest FROM checkpoints WHERE checkpoint_id=?",
                                  (manifest.checkpoint_id,)).fetchone()
            if existing is not None:
                committed = CheckpointManifest.model_validate_json(existing["manifest"])
                return manifest == committed.model_copy(update={"status": "VERIFIED", "committed_utc": None})
            if manifest.step_completed < job["last_step"]:
                return False
            try:
                self.store.verified_bytes(manifest)
            except (IntegrityError, OSError):
                self._event(db, job, "CHECKPOINT_REJECTED", checkpoint_id=manifest.checkpoint_id)
                return False
            now = self.clock()
            if not self._owns(job, manifest.worker_id, manifest.lease_epoch, now):
                return False
            committed = manifest.model_copy(update={
                "status": "COMMITTED",
                "committed_utc": max(manifest.created_utc, datetime.fromtimestamp(now, timezone.utc)),
            })
            inserted = db.execute("INSERT OR IGNORE INTO checkpoints VALUES (?, ?, ?, ?, ?)", (
                committed.checkpoint_id, committed.job_id, committed.lease_epoch,
                committed.step_completed, committed.model_dump_json(),
            )).rowcount
            if not inserted:
                return False
            db.execute("UPDATE jobs SET last_step=? WHERE job_id=?", (manifest.step_completed, manifest.job_id))
            self._event(db, job, "CHECKPOINT_COMMITTED", checkpoint_id=manifest.checkpoint_id,
                        step=manifest.step_completed, sha256=manifest.sha256)
            return True

    def yield_or_pause(self, job_id: str, worker_id: str, epoch: int, checkpoint_id: str) -> bool:
        with self.transaction() as db:
            job = self._job(db, job_id)
            now = self.clock()
            if job["state"] != "PREEMPTING" or not self._owns(job, worker_id, epoch, now):
                return False
            if not self._ready(db, job, now):
                self._block(db, job, "STANDBY_UNAVAILABLE")
                db.execute("""UPDATE jobs SET state='PRIMARY_RUNNING', incident_id=NULL, detected=NULL
                              WHERE job_id=?""", (job_id,))
                return False
            row = db.execute("""SELECT step, manifest FROM checkpoints WHERE job_id=? AND checkpoint_id=?
                                AND epoch=? AND step=?""",
                             (job_id, checkpoint_id, epoch, job["last_step"])).fetchone()
            if row is None or not self._verify_artifact(db, job, CheckpointManifest.model_validate_json(row["manifest"])):
                return False
            if not self._owns(job, worker_id, epoch, self.clock()):
                return False
            db.execute("UPDATE jobs SET state='RECOVERY_PENDING', yielded_step=?, lease_until=NULL WHERE job_id=?",
                       (row["step"], job_id))
            self._event(db, job, "PRIMARY_YIELDED", step=row["step"], checkpoint_id=checkpoint_id)
            return True

    def _verify_artifact(self, db, job, manifest: CheckpointManifest) -> bool:
        if db.execute("SELECT 1 FROM rejected_checkpoints WHERE checkpoint_id=?",
                      (manifest.checkpoint_id,)).fetchone():
            return False
        try:
            self.store.verified_bytes(manifest)
        except (IntegrityError, OSError):
            db.execute("INSERT INTO rejected_checkpoints VALUES (?)", (manifest.checkpoint_id,))
            self._event(db, job, "CHECKPOINT_REJECTED", checkpoint_id=manifest.checkpoint_id,
                        step=manifest.step_completed)
            return False
        return True

    def checkpoint_candidates(self, job_id: str, worker_id: str) -> list[CheckpointManifest]:
        with self.transaction() as db:
            now = self.clock()
            job = self._watchdog(db, self._job(db, job_id), now)
            if job["state"] != "RECOVERY_PENDING" or not self._ready(db, job, now, worker_id):
                return []
            manifests = []
            for row in db.execute("""SELECT manifest FROM checkpoints WHERE job_id=? AND epoch=? AND step<?
                                     ORDER BY step DESC""", (job_id, job["epoch"], self._spec(job).target)):
                manifest = CheckpointManifest.model_validate_json(row["manifest"])
                if self._verify_artifact(db, job, manifest):
                    manifests.append(manifest)
                if len(manifests) == 3:
                    break
            if not manifests:
                self._block(db, job, "NO_VALID_CHECKPOINT")
            return manifests

    def claim_standby(self, job_id: str, worker_id: str, expected_epoch: int, checkpoint_id: str) -> JobPlan:
        with self.transaction() as db:
            job = self._job(db, job_id)
            now = self.clock()
            row = db.execute("SELECT * FROM checkpoints WHERE job_id=? AND checkpoint_id=?",
                             (job_id, checkpoint_id)).fetchone()
            if (job["state"] != "RECOVERY_PENDING" or job["epoch"] != expected_epoch
                    or not self._ready(db, job, now, worker_id) or row is None
                    or row["epoch"] != expected_epoch or row["step"] >= self._spec(job).target):
                return self._plan(job, "STOP", now)
            manifest = CheckpointManifest.model_validate_json(row["manifest"])
            if not self._verify_artifact(db, job, manifest):
                return self._plan(job, "STOP", now)
            now = self.clock()
            if not self._ready(db, job, now, worker_id):
                return self._plan(job, "STOP", now)
            self._event(db, job, "CHECKPOINT_SELECTED", checkpoint_id=checkpoint_id,
                        step=manifest.step_completed, sha256=manifest.sha256)
            previous_owner = job["owner"]
            db.execute("""UPDATE jobs SET state='STANDBY_STARTING', owner=?, epoch=epoch+1,
                          lease_until=?, chosen_id=?, last_step=?, block_reason=NULL WHERE job_id=?""",
                       (worker_id, now + self.lease_ttl_s, checkpoint_id, manifest.step_completed, job_id))
            db.execute("DELETE FROM standby WHERE job_id=? AND worker_id=?", (job_id, worker_id))
            job = self._job(db, job_id)
            self._event(db, job, "LEASE_TRANSFERRED", previous_epoch=expected_epoch,
                        previous_owner=previous_owner, checkpoint_id=checkpoint_id, checkpoint_step=manifest.step_completed, sha256=manifest.sha256)
            return self._plan(job, "RUN", now)

    def mark_first_resumed_step(self, job_id: str, worker_id: str, epoch: int,
                                step: int, loss: float, sha256: str) -> bool:
        with self.transaction() as db:
            job = self._job(db, job_id)
            now = self.clock()
            if not self._owns(job, worker_id, epoch, now) or not math.isfinite(loss) or loss < 0:
                return False
            if job["state"] != "STANDBY_STARTING":
                return False
            row = db.execute("SELECT manifest FROM checkpoints WHERE checkpoint_id=?",
                             (job["chosen_id"],)).fetchone()
            manifest = CheckpointManifest.model_validate_json(row["manifest"])
            if step != manifest.step_completed + 1 or sha256 != manifest.sha256:
                return False
            rto_ms = (now - job["detected"]) * 1000
            rpo_steps = None if job["yielded_step"] is None else job["yielded_step"] - manifest.step_completed
            db.execute("""UPDATE jobs SET state='VERIFIED_RESUMED', resume_step=?, last_step=?,
                          rto_ms=?, rpo_steps=? WHERE job_id=?""", (step, step, rto_ms, rpo_steps, job_id))
            self._event(db, job, "FIRST_RESUMED_STEP_COMPLETED", source="measured", step=step, loss=loss,
                        sha256=sha256, rto_ms=rto_ms, rpo_steps=rpo_steps)
            self._event(db, job, "RESCUE_VERIFIED", step=step, rto_ms=rto_ms, rpo_steps=rpo_steps)
            return True

    def complete(self, job_id: str, worker_id: str, epoch: int) -> bool:
        with self.transaction() as db:
            job = self._job(db, job_id)
            if not self._owns(job, worker_id, epoch, self.clock()):
                return False
            if job["state"] == "STANDBY_STARTING":
                return False
            final = db.execute("SELECT manifest FROM checkpoints WHERE job_id=? AND epoch=? AND step=?",
                               (job_id, epoch, self._spec(job).target)).fetchone()
            if final is None or not self._verify_artifact(db, job, CheckpointManifest.model_validate_json(final["manifest"])):
                return False
            if not self._owns(job, worker_id, epoch, self.clock()):
                return False
            db.execute("UPDATE jobs SET state='COMPLETED', lease_until=NULL WHERE job_id=?", (job_id,))
            self._event(db, job, "JOB_COMPLETED", step=self._spec(job).target)
            return True
