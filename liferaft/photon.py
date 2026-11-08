"""Photon 2.0 iMessage adapter. Provider calls never run inside lease transactions."""
from base64 import b64decode, b64encode
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
import hmac
import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

COMMANDS = frozenset({"STATUS", "WHY", "CHECKPOINT", "ACK", "HELP"})
MAX_WEBHOOK_BYTES = 32 * 1024
EVENT_TYPES = {"message.received": "received", "message.delivered": "delivered", "message.failed": "failed"}


def valid_id(value, kind):
    return isinstance(value, str) and re.fullmatch(rf"pho_{kind}_[0-7][0-9a-hjkmnp-tv-z]{{25}}", value) is not None


@dataclass(frozen=True)
class PhotonScope:
    project: str
    space: str
    operator: str
    agent: str
    job: str
    secret: bytes

    @classmethod
    def from_environment(cls):
        from pydantic import TypeAdapter
        from .contracts import Identifier

        values = [os.getenv("PHOTON_" + name, "") for name in
                  ("PROJECT_ID", "SPACE_ID", "OPERATOR_USER_ID", "AGENT_USER_ID", "JOB", "WEBHOOK_SECRET")]
        project, space, operator, agent, job, secret = values
        if os.getenv("LIFERAFT_ENABLE_PHOTON") != "1":
            return None
        if not all(valid_id(value, kind) for value, kind in
                   ((project, "prj"), (space, "spc"), (operator, "usr"), (agent, "usr"))) or agent == operator:
            raise ValueError("configure the Photon project, direct space and distinct user IDs")
        if not secret.startswith("whsec_"):
            raise ValueError("configure the Photon webhook signing secret")
        key = b64decode(secret.removeprefix("whsec_"), validate=True)
        if len(key) < 16:
            raise ValueError("invalid Photon webhook signing secret")
        return cls(project, space, operator, agent, TypeAdapter(Identifier).validate_python(job), key)

    def verify(self, environ, body, *, now=None):
        now = time.time() if now is None else now
        identity = environ.get("HTTP_WEBHOOK_ID", "")
        stamp = environ.get("HTTP_WEBHOOK_TIMESTAMP", "")
        signatures = environ.get("HTTP_WEBHOOK_SIGNATURE", "")
        if (not re.fullmatch(r"[\w-]{1,128}", identity, re.ASCII)
                or not re.fullmatch(r"[0-9]{1,12}", stamp)
                or abs(now - int(stamp)) > 300 or len(signatures) > 1024):
            return False
        expected = b64encode(hmac.digest(self.secret, f"{identity}.{stamp}.".encode() + body, sha256)).decode()
        return any(re.fullmatch(r"v1,[A-Za-z0-9+/=]{44}", part) and hmac.compare_digest(part[3:], expected)
                   for part in signatures.split())

    def parse(self, event):
        try:
            kind = event.get("type")
            if (kind not in EVENT_TYPES or event["source"] != "imessage.photon"
                    or event["apiVersion"] != "2026-07-01"):
                return None
            data = event["data"]
            message = data["object"]
            if (data.get("projectId") != self.project or message["projectId"] != self.project
                    or message["space"]["id"] != self.space or message["space"]["kind"] != "direct"
                    or set(message["space"]["participantIds"]) != {self.agent, self.operator}
                    or message["platform"] != "imessage" or message["status"] != EVENT_TYPES[kind]
                    or not valid_id(event["id"], "evt") or not valid_id(message["id"], "msg")):
                return None
            sender = message["sentBy"]["id"]
            if sender != (self.operator if kind == "message.received" else self.agent):
                return None
            stamp = event["timestamp"]
            if not isinstance(stamp, str) or not stamp.endswith("Z"):
                return None
            at = datetime.fromisoformat(stamp).timestamp()
            command = None
            if kind == "message.received":
                content = message["content"]
                if content["type"] != "text" or not isinstance(content["text"], str):
                    return None
                raw = content["text"]
                if len(raw) > 32 or not raw.isascii():
                    return None
                command = raw.strip().upper()
                if command not in COMMANDS:
                    return None
            return kind, event["id"], message["id"], at, command
        except (AttributeError, KeyError, TypeError, ValueError, OverflowError):
            return None


class PhotonSendError(RuntimeError):
    def __init__(self, retryable):
        super().__init__("Photon message submission failed")
        self.retryable = retryable


class PhotonClient:
    def __init__(self, key):
        from .cloud import NoRedirect

        if not re.fullmatch(r"pho_sk_[A-Za-z0-9_-]{12,256}", key):
            raise ValueError("configure a project-scoped Photon API key")
        self.key = key
        self.opener = build_opener(NoRedirect())

    def send(self, task):
        project, space, sender = (task[key] for key in ("project", "space", "agent"))
        if not all(valid_id(value, kind) for value, kind in ((project, "prj"), (space, "spc"), (sender, "usr"))):
            raise PhotonSendError(False)
        request = Request(f"https://api.photon.codes/v1/projects/{project}/messages", method="POST",
                          data=json.dumps({"spaceId": space, "senderId": sender, "content": {
                              "type": "text", "format": "plain", "text": task["text"],
                          }}).encode(), headers={"Authorization": f"Bearer {self.key}",
                                                "Content-Type": "application/json", "Idempotency-Key": task["id"]})
        deadline = time.monotonic() + 3
        try:
            with self.opener.open(request, timeout=3) as response:
                if response.status != 202:
                    raise PhotonSendError(False)
                raw = bytearray()
                read = getattr(response, "read1", response.read)
                while time.monotonic() < deadline and len(raw) <= MAX_WEBHOOK_BYTES:
                    chunk = read(min(4096, MAX_WEBHOOK_BYTES + 1 - len(raw)))
                    if time.monotonic() >= deadline:
                        raise PhotonSendError(True)
                    if not chunk:
                        break
                    raw.extend(chunk)
                else:
                    raise PhotonSendError(True)
            message = json.loads(raw)
            if (not valid_id(message["id"], "msg") or message["projectId"] != project
                    or message["space"]["id"] != space or message["sentBy"]["id"] != sender):
                raise PhotonSendError(True)
            return message["id"]
        except HTTPError as error:
            error.close()
            raise PhotonSendError(error.code in {408, 429, 500, 502, 503, 504}) from None
        except (URLError, OSError):
            raise PhotonSendError(True) from None
        except (KeyError, TypeError, ValueError):
            raise PhotonSendError(True) from None


def drain(client, provider, job, deadline):
    from .config import log

    while time.monotonic() < deadline:
        task = client.call("photon_claim", job)
        if task is None:
            time.sleep(min(1, max(0, deadline - time.monotonic())))
            continue
        try:
            message_id = provider.send(task)
        except PhotonSendError as error:
            client.call("photon_result", job, task_id=task["id"], lease=task["lease"],
                        retryable=error.retryable)
            log("PHOTON_SUBMISSION_FAILED", job_id=job, retryable=error.retryable)
        else:
            if not client.call("photon_result", job, task_id=task["id"], lease=task["lease"],
                               message_id=message_id):
                raise RuntimeError("Photon submission lease expired; the queue retains the same idempotency key")
            log("PHOTON_SUBMISSION_ACCEPTED", source_type="provider", job_id=job)
