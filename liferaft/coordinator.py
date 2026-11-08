"""Offline coordinator. Its SQLite database is authoritative in local mode."""
import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path

from .config import redact
from .contracts import IncidentEvent, utc_now

GENESIS = "0" * 64


class ReplayError(ValueError):
    pass


def canonical(value: dict) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"), allow_nan=False)


class LocalCoordinator:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.database = directory / "coordinator.sqlite3"
        with self.transaction() as db:
            db.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    seq INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE,
                    job_id TEXT NOT NULL, body TEXT NOT NULL,
                    prev_hash TEXT NOT NULL, event_hash TEXT NOT NULL
                )
            """)
            db.execute("CREATE INDEX IF NOT EXISTS events_job ON events(job_id, seq)")

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.database, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def record(self, event: IncidentEvent) -> str:
        with self.transaction() as db:
            return self.append(db, event)

    @staticmethod
    def append(db: sqlite3.Connection, event: IncidentEvent) -> str:
        if abs(utc_now() - event.created_utc) > timedelta(minutes=5):
            raise ReplayError("event timestamp outside accepted window")
        body = canonical(redact(event.model_dump(mode="json")))
        row = db.execute("SELECT event_hash FROM events ORDER BY seq DESC LIMIT 1").fetchone()
        previous = row["event_hash"] if row else GENESIS
        digest = hashlib.sha256(f"{previous}\n{body}".encode()).hexdigest()
        try:
            db.execute(
                "INSERT INTO events (event_id, job_id, body, prev_hash, event_hash) VALUES (?, ?, ?, ?, ?)",
                (str(event.event_id), event.job_id, body, previous, digest),
            )
        except sqlite3.IntegrityError as error:
            raise ReplayError("duplicate event ID") from error
        return digest

    def events(self, *, after: int = 0, limit: int = 500) -> list[dict]:
        if not 1 <= limit <= 500:
            raise ValueError("event page limit must be between 1 and 500")
        with self.transaction() as db:
            rows = db.execute("SELECT * FROM events WHERE seq > ? ORDER BY seq LIMIT ?", (after, limit)).fetchall()
        return [
            {"seq": row["seq"], **json.loads(row["body"]),
             "prev_hash": row["prev_hash"], "event_hash": row["event_hash"]}
            for row in rows
        ]

    def verify_chain(self) -> bool:
        with self.transaction() as db:
            return self._verify_prefix(db)

    @staticmethod
    def _verify_prefix(db, through=2**63 - 1):
        previous = GENESIS
        for row in db.execute("SELECT * FROM events WHERE seq <= ? ORDER BY seq", (through,)):
            digest = hashlib.sha256(f"{previous}\n{row['body']}".encode()).hexdigest()
            if row["prev_hash"] != previous or row["event_hash"] != digest:
                return False
            previous = digest
        return True

    def event_page(self, *, after=0, through=None, limit=500):
        """Freeze a journal head so concurrent appends cannot truncate an export."""
        if not 0 <= after < 2**63 or not 1 <= limit <= 500:
            raise ValueError("invalid event cursor")
        with self.transaction() as db:
            head = db.execute("SELECT seq, event_hash FROM events ORDER BY seq DESC LIMIT 1").fetchone()
            head_seq = head["seq"] if head else 0
            if through is not None:
                if not 0 <= through <= head_seq:
                    raise ValueError("invalid event head")
                head_seq = through
                head = db.execute("SELECT seq, event_hash FROM events WHERE seq=?", (through,)).fetchone()
                if through and head is None:
                    raise ValueError("missing event head")
            if after > head_seq:
                raise ValueError("cursor beyond journal head")
            rows = db.execute("SELECT * FROM events WHERE seq > ? AND seq <= ? ORDER BY seq LIMIT ?",
                              (after, head_seq, limit)).fetchall()
            events = [{"seq": row["seq"], **json.loads(row["body"]),
                       "prev_hash": row["prev_hash"], "event_hash": row["event_hash"]} for row in rows]
            next_after = rows[-1]["seq"] if rows else after
            return {"events": events, "chain_valid": self._verify_prefix(db, head_seq),
                    "head_seq": head_seq, "head_hash": head["event_hash"] if head else GENESIS,
                    "next_after": next_after, "has_more": next_after < head_seq}
