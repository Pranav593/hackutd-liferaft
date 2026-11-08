"""Environment loading and log redaction."""
import json
import os
import re
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from dotenv import load_dotenv

from .contracts import utc_now

SECRET_KEY = re.compile(r"authorization|password|atlas.?uri|secret|token|cookie|api.?key|service.?role|signed.?url|phone|destination", re.I)
SECRET_TEXT = re.compile(r"(?:https?|mongodb(?:\+srv)?)://[^\s\"']+|\b(?:bearer\s+[^\s,;]+|(?:pho_sk_|nvapi-|sb_secret_)[\w-]+)|(?<!\w)\+\d{8,15}\b", re.I)
_LOG_CAPTURE = ContextVar("liferaft_log_capture", default=None)


@contextmanager
def capture_worker_logs(path):
    """Mirror redacted structured output; logging failure never controls training."""
    marker = _LOG_CAPTURE.set(path)
    try:
        yield
    finally:
        _LOG_CAPTURE.reset(marker)


def load_environment() -> None:
    load_dotenv(dotenv_path=".env", override=False, interpolate=False)


def state_dir() -> Path:
    return Path(os.environ.get("LIFERAFT_STATE_DIR") or ".liferaft")


def redact(value):
    if isinstance(value, dict):
        return {key: "[REDACTED]" if SECRET_KEY.search(key) else redact(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact(item) for item in value]
    if isinstance(value, str):
        for key, secret in os.environ.items():
            if SECRET_KEY.search(key) and len(secret) >= 8:
                value = value.replace(secret, "[REDACTED]")
        return SECRET_TEXT.sub("[REDACTED]", value)
    return value


def log(event_type: str, *, source_type: str = "derived", **fields) -> None:
    line = json.dumps(redact({
        "event_type": event_type, "source_type": source_type,
        "created_utc": utc_now().isoformat(), **fields,
    }), allow_nan=False)
    print(line, flush=True)
    capture = _LOG_CAPTURE.get()
    if capture is not None:
        try:
            # Bound the optional mirror; the authoritative journal is separate.
            if not capture.exists() or capture.stat().st_size < 2 * 1024 * 1024:
                with capture.open("a", encoding="utf-8") as stream:
                    stream.write(line + "\n")
        except OSError:
            pass
