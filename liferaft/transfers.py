"""Short-lived, identity-bound checkpoint capabilities; no storage credentials."""
from base64 import b64decode, urlsafe_b64encode
import hashlib
import hmac
import json
import time
from typing import Literal

from pydantic import Field

from .contracts import CheckpointManifest, WireModel

TRANSFER_TTL_S = 20
MAX_TICKET_CHARS = 8192


class TransferTicket(WireModel):
    version: Literal[1] = 1
    role: Literal["primary", "standby", "pi_primary"]
    method: Literal["GET", "PUT"]
    issued_at: int = Field(strict=True, ge=0)
    expires_at: int = Field(strict=True, ge=0)
    manifest: CheckpointManifest


def signature(payload: str, credential: str) -> str:
    # Domain separation prevents reuse as another credential/HMAC protocol.
    key = hmac.digest(credential.encode("ascii"), b"liferaft-checkpoint-v1", "sha256")
    return hmac.new(key, payload.encode("ascii"), hashlib.sha256).hexdigest()


def issue_ticket(manifest, role, method, credential, *, now=None):
    issued = int(time.time() if now is None else now)
    ticket = TransferTicket(role=role, method=method, manifest=manifest,
                            issued_at=issued, expires_at=issued + TRANSFER_TTL_S)
    payload = urlsafe_b64encode(ticket.model_dump_json().encode()).rstrip(b"=").decode("ascii")
    return payload + "." + signature(payload, credential)


def verify_ticket(value, role, method, credential, *, now=None):
    """Authentication is checked by the caller too; a leaked URL is insufficient."""
    try:
        if not isinstance(value, str) or len(value) > MAX_TICKET_CHARS:
            raise ValueError
        payload, digest = value.split(".")
        if not hmac.compare_digest(signature(payload, credential), digest):
            raise ValueError
        raw = b64decode(payload + "=" * (-len(payload) % 4), altchars=b"-_", validate=True)
        ticket = TransferTicket.model_validate(json.loads(raw))
        current = time.time() if now is None else now
        if (ticket.role != role or ticket.method != method
                or ticket.expires_at - ticket.issued_at != TRANSFER_TTL_S
                or not ticket.issued_at <= current < ticket.expires_at):
            raise ValueError
        return ticket.manifest
    except (ValueError, TypeError, UnicodeError):
        raise ValueError("invalid or expired checkpoint capability") from None
