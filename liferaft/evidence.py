"""Local validation of journal bytes; hash integrity is not remote attestation."""
from hashlib import sha256

from .contracts import IncidentEvent
from .coordinator import GENESIS, canonical


def verify_journal(result, job_id):
    try:
        events = result["events"]
        if result["chain_valid"] is not True or not isinstance(events, list) or result.get("complete") is False:
            raise ValueError
        parsed, ids = [], set()
        previous = GENESIS
        for seq, entry in enumerate(events, 1):
            body = {k: v for k, v in entry.items() if k not in ("seq", "prev_hash", "event_hash")}
            digest = sha256(f"{previous}\n{canonical(body)}".encode()).hexdigest()
            if entry["seq"] != seq or entry["prev_hash"] != previous or entry["event_hash"] != digest:
                raise ValueError
            event = IncidentEvent.model_validate(body)
            if event.job_id != job_id or event.event_id in ids:
                raise ValueError
            parsed.append(event)
            ids.add(event.event_id)
            previous = digest
        if ("head_seq" in result or "head_hash" in result) and (
                result.get("head_seq") != len(events) or result.get("head_hash") != previous):
            raise ValueError
        return parsed
    except (AttributeError, KeyError, TypeError, ValueError):
        raise ValueError("invalid, incomplete or tampered event journal") from None
