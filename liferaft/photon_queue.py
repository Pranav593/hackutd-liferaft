"""Job-scoped durable provider queue using the existing coordinator transaction."""
from uuid import NAMESPACE_URL, uuid4, uuid5

from .contracts import CheckpointManifest, IncidentEvent

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS photon_outbox (
        id TEXT PRIMARY KEY, incident TEXT NOT NULL, text TEXT NOT NULL, due REAL NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, lease TEXT, provider_id TEXT UNIQUE,
        state TEXT NOT NULL DEFAULT 'pending'
    )""",
    """CREATE TABLE IF NOT EXISTS photon_context (
        incident TEXT PRIMARY KEY, summary TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS photon_inbox (
        provider_id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE
    )""",
)
MAX_ATTEMPTS = 3
MAX_QUEUE = 64
TASK_TTL = 900


def enqueue(db, incident, identity, text, now):
    if db.execute("SELECT count(*) FROM photon_outbox").fetchone()[0] >= MAX_QUEUE:
        return False
    task_id = str(uuid5(NAMESPACE_URL, f"liferaft:photon:{incident}:{identity}"))
    return bool(db.execute("INSERT OR IGNORE INTO photon_outbox(id, incident, text, due) VALUES (?, ?, ?, ?)",
                           (task_id, incident, text, now)).rowcount)


def notification(db, job, kind, evidence, now, *, source):
    incident = job["incident_id"]
    if incident is None:
        return
    if kind == "RESCUE_REQUESTED" and source == "injected":
        text = f"LIFERAFT cooling drill {incident}. Software recovery requested. Reply STATUS, WHY, CHECKPOINT, ACK or HELP."
    elif kind == "PRIMARY_UNREACHABLE" and source == "derived":
        text = f"LIFERAFT incident {incident}. The primary lease expired. Reply STATUS or HELP."
    elif kind == "FIRST_RESUMED_STEP_COMPLETED" and source == "measured":
        text = (f"LIFERAFT {incident} recovered on {job['owner']} at optimizer step {evidence['step']}. "
                f"Recovery time {evidence['rto_ms'] / 1000:.3f} s. Reply CHECKPOINT or ACK.")
    else:
        return
    enqueue(db, incident, kind, text, now)


def checkpoint_for(db, job):
    row = db.execute("""SELECT manifest FROM checkpoints WHERE job_id=? AND
                        (checkpoint_id=? OR (? IS NULL AND epoch=?)) ORDER BY step DESC LIMIT 1""",
                     (job["job_id"], job["chosen_id"], job["chosen_id"], job["epoch"])).fetchone()
    return CheckpointManifest.model_validate_json(row["manifest"]) if row else None


def reply_text(db, job, command, now):
    if command == "STATUS":
        return (f"{job['job_id']} · {job['state']} · owner {job['owner'] or 'unknown'} · "
                f"recorded step {job['last_step']} · epoch {job['epoch']}.")
    if command == "CHECKPOINT":
        manifest = checkpoint_for(db, job)
        if manifest is None:
            return "No committed checkpoint is recorded."
        age = max(0, round(now - manifest.committed_utc.timestamp()))
        return f"Committed checkpoint step {manifest.step_completed} · SHA-256 {manifest.sha256[:12]} · age {age} s."
    if command == "WHY":
        context = db.execute("SELECT summary FROM photon_context WHERE incident=?", (job["incident_id"],)).fetchone()
        if context:
            return f"Nemotron advisory: {context['summary']}"
        trigger = db.execute("""SELECT body FROM events WHERE job_id=?
                                AND json_extract(body,'$.incident_id')=?
                                AND json_extract(body,'$.event_type') IN ('RESCUE_REQUESTED','PRIMARY_UNREACHABLE')
                                ORDER BY seq LIMIT 1""", (job["job_id"], job["incident_id"])).fetchone()
        if trigger:
            event = IncidentEvent.model_validate_json(trigger["body"])
            reason = "An injected cooling drill requested rescue." if event.source_type == "injected" else "The primary lease expired."
            return f"{reason} Event {event.event_id}. Nemotron summary is unavailable in this channel."
        return "Incident trigger and Nemotron summary are unavailable."
    if command == "ACK":
        return f"Acknowledged incident {job['incident_id']}."
    return "LIFERAFT commands: STATUS, WHY, CHECKPOINT, ACK, HELP. Replies use job evidence only."


def ingest(policy, job_id, parsed):
    kind, event_id, provider_id, created, command = parsed
    with policy.transaction() as db:
        job = policy._job(db, job_id)
        now = policy.clock()
        incident = job["incident_id"]
        if incident is None or job["detected"] is None or not job["detected"] - 5 <= created <= now + 60:
            return True
        if kind != "message.received":
            row = db.execute("SELECT * FROM photon_outbox WHERE provider_id=?", (provider_id,)).fetchone()
            if row is None:
                # Provider callback may precede recording the 202 response.
                inflight = db.execute("SELECT 1 FROM photon_outbox WHERE state='pending' AND lease IS NOT NULL").fetchone()
                return inflight is None
            if row["state"] == "accepted":
                state = "delivered" if kind == "message.delivered" else "failed"
                db.execute("UPDATE photon_outbox SET state=? WHERE id=?", (state, row["id"]))
                policy._event(db, job, "PHOTON_" + state.upper(), source="provider",
                              provider_message_id=provider_id, provider_event_id=event_id)
            return True
        if now - created > TASK_TTL:
            return True
        if db.execute("SELECT count(*) FROM photon_inbox").fetchone()[0] >= MAX_QUEUE:
            return True
        if not db.execute("INSERT OR IGNORE INTO photon_inbox VALUES (?, ?)", (provider_id, event_id)).rowcount:
            return True
        if not enqueue(db, incident, provider_id, reply_text(db, job, command, now), now):
            return True
        policy._event(db, job, "PHOTON_COMMAND_RECEIVED", source="provider",
                      provider_message_id=provider_id, provider_event_id=event_id, command=command)
        if command == "ACK" and not db.execute("""SELECT 1 FROM events WHERE job_id=?
                AND json_extract(body,'$.incident_id')=? AND json_extract(body,'$.event_type')='PHOTON_ACK'""",
                (job_id, incident)).fetchone():
            policy._event(db, job, "PHOTON_ACK", source="provider", provider_event_id=event_id)
        return True


def attach_context(policy, job_id, incident, summary, refs):
    with policy.transaction() as db:
        job = policy._job(db, job_id)
        now = policy.clock()
        if (job["incident_id"] != incident or job["resume_step"] is None or job["detected"] is None
                or now - job["detected"] > TASK_TTL):
            return False
        for event_id in refs:
            match = db.execute("""SELECT 1 FROM events WHERE job_id=? AND event_id=?
                AND json_extract(body,'$.incident_id')=?""", (job_id, event_id, incident)).fetchone()
            if match is None:
                return False
        existing = db.execute("SELECT summary FROM photon_context WHERE incident=?", (incident,)).fetchone()
        suffix = " Evidence " + ", ".join(refs) + "."
        text = summary + suffix
        if existing:
            return existing["summary"] == text
        if not enqueue(db, incident, "nemotron_handoff", "LIFERAFT Nemotron advisory: " + text, now):
            return False
        db.execute("INSERT INTO photon_context VALUES (?, ?)", (incident, text))
        policy._event(db, job, "PHOTON_HANDOFF_QUEUED", evidence_event_ids=refs)
        return True


def claim(policy, job_id):
    with policy.transaction() as db:
        job = policy._job(db, job_id)
        now = policy.clock()
        db.execute("""UPDATE photon_outbox SET state='unconfirmed', lease=NULL
                      WHERE state='pending' AND due<=? AND attempts>=?""", (now, MAX_ATTEMPTS))
        if job["detected"] is not None and now - job["detected"] <= TASK_TTL:
            rows = db.execute("""SELECT body FROM events WHERE job_id=?
                AND json_extract(body,'$.incident_id')=?
                AND json_extract(body,'$.event_type') IN
                    ('RESCUE_REQUESTED','PRIMARY_UNREACHABLE','FIRST_RESUMED_STEP_COMPLETED')
                ORDER BY seq LIMIT 3""", (job_id, job["incident_id"]))
            for entry in rows:
                event = IncidentEvent.model_validate_json(entry["body"])
                notification(db, job, event.event_type, event.evidence,
                             min(now, event.created_utc.timestamp()), source=event.source_type)
        row = db.execute("""SELECT * FROM photon_outbox WHERE state='pending' AND due<=?
                            AND incident=? ORDER BY due, rowid LIMIT 1""", (now, job["incident_id"])).fetchone()
        if row is None:
            return None
        if job["detected"] is None or now - job["detected"] > TASK_TTL:
            db.execute("UPDATE photon_outbox SET state='expired', lease=NULL WHERE state='pending'")
            return None
        lease = uuid4().hex
        db.execute("UPDATE photon_outbox SET attempts=attempts+1, lease=?, due=? WHERE id=?",
                   (lease, now + 20, row["id"]))
        return {"id": row["id"], "lease": lease, "text": row["text"]}


def result(policy, job_id, task_id, lease, provider_id, retryable):
    with policy.transaction() as db:
        job = policy._job(db, job_id)
        now = policy.clock()
        row = db.execute("SELECT * FROM photon_outbox WHERE id=?", (task_id,)).fetchone()
        if (not row or row["incident"] != job["incident_id"] or row["lease"] != lease
                or row["due"] <= now or row["state"] != "pending"):
            return False
        if provider_id:
            db.execute("UPDATE photon_outbox SET state='accepted', provider_id=?, lease=NULL WHERE id=?",
                       (provider_id, task_id))
            policy._event(db, job, "PHOTON_ACCEPTED", source="provider", provider_message_id=provider_id)
        elif retryable and row["attempts"] < MAX_ATTEMPTS:
            db.execute("UPDATE photon_outbox SET due=?, lease=NULL WHERE id=?",
                       (now + 2**row["attempts"], task_id))
        else:
            db.execute("UPDATE photon_outbox SET state=?, lease=NULL WHERE id=?",
                       ("unconfirmed" if retryable else "rejected", task_id))
            policy._event(db, job, "PHOTON_SUBMISSION_UNCONFIRMED" if retryable else "PHOTON_SUBMISSION_REJECTED")
        return True
