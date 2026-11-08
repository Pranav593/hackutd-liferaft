"""Authenticated WSGI coordinator API. The host terminates HTTPS."""
from base64 import b64decode, b64encode
from dataclasses import asdict
import hmac
import json
import logging
import os
import re
import time
from threading import Lock
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5
from urllib.parse import parse_qs

from pydantic import Field, TypeAdapter, ValidationError

from .artifacts import IntegrityError, verify_data
from .atlas import AtlasRepository
from .contracts import ButtonEvent, CheckpointManifest, Digest, Identifier, MAX_CHECKPOINT_BYTES, Step, WireModel, WorkerHeartbeat
from .failover import JobSpec, JobPlan
from .transfers import issue_ticket, verify_ticket

PRIMARY = "laptop-primary"
STANDBY = "laptop-standby"
DEVICE_IDS = {"primary": PRIMARY, "standby": STANDBY}
WORKERS = frozenset(DEVICE_IDS)
REQUIRED_ROLES = WORKERS | {"operator"}
TOKEN_PATTERN = re.compile(r"[a-f0-9]{64}")
LOGGER = logging.getLogger(__name__)
MAX_BODY = ((MAX_CHECKPOINT_BYTES + 2) // 3) * 4 + 8192
MAX_CONTROL_BODY = 16 * 1024


class Request(WireModel):
    action: str = Field(pattern=r"^[a-z_]{1,32}$")
    job: Identifier | None = None
    sent_at: float = Field(strict=True)
    args: dict = Field(default_factory=dict)


class CheckpointRef(WireModel):
    checkpoint_id: Identifier
    epoch: Step


class ResumeEvidence(WireModel):
    epoch: Step
    step: Step
    loss: float = Field(ge=0)
    sha256: Digest


class APIError(Exception):
    def __init__(self, status, code):
        self.status = status
        self.code = code


def unique_keys(pairs):
    """Reject ambiguous JSON rather than letting different parsers pick a value."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON key")
        result[key] = value
    return result


def application(repository, credentials, *, drills=False):
    if (set(credentials) not in (REQUIRED_ROLES, REQUIRED_ROLES | {"gateway"})
            or any(not TOKEN_PATTERN.fullmatch(token) for token in credentials.values())
            or len(set(credentials.values())) != len(credentials)):
        raise ValueError("configure distinct 64-character hex credentials for each role")

    rate_lock = Lock()
    windows = {}

    def dispatch(role, request):
        action, job, args = request.action, request.job, request.args
        if action == "doctor" and job is None and not args:
            repository.ping()
            return {"auth": True, "database": True, "role": role, "checkpoint_transfer": "signed-v1"}
        if job is None:
            raise APIError("422 Unprocessable Entity", "JOB_REQUIRED")
        worker = DEVICE_IDS.get(role)

        def allowed(roles):
            if role not in roles:
                raise APIError("403 Forbidden", "ROLE_DENIED")

        if action == "button":
            allowed({"gateway"})
            if not drills:
                raise APIError("403 Forbidden", "DRILL_DISABLED_OR_INVALID")
            button = ButtonEvent.model_validate(args)
            request_id = uuid5(NAMESPACE_URL, f"liferaft:button:{job}:{button.device_id}:{button.seq}:{button.uptime_ms}")
            return repository.execute(job, lambda policy: policy.request_rescue(job, request_id, button=button))

        if action == "create":
            allowed({"operator"})
            spec = JobSpec.model_validate(args)
            if (spec.job_id != job or spec.primary != PRIMARY
                    or spec.target > 200 or spec.checkpoint_every < 10):
                raise ValueError("job does not match the hosted demo limits")
            return repository.execute(job, lambda policy: policy.create_job(spec), create=True)
        if action in {"status", "events", "rescue"}:
            allowed({"operator"})
            if action == "status" and not args:
                return repository.execute(job, lambda policy: policy.status(job))
            if action == "events" and not args:
                return repository.execute(job, lambda policy: {
                    "chain_valid": policy.verify_chain(), "events": policy.events(limit=500),
                })
            if action == "rescue" and drills and set(args) == {"request_id"}:
                request_id = TypeAdapter(UUID).validate_python(args["request_id"])
                return repository.execute(job, lambda policy: policy.request_rescue(job, request_id))
            raise APIError("403 Forbidden", "DRILL_DISABLED_OR_INVALID")

        allowed(WORKERS)
        if action == "spec" and not args:
            return repository.execute(job, lambda policy: policy.get_spec(job))
        if action == "start" and not args:
            allowed({"primary"})
            return repository.execute(job, lambda policy: policy.start_primary(job, worker))
        if action == "register" and not args:
            allowed({"standby"})
            return repository.execute(job, lambda policy: policy.register_standby(job, worker))
        if action == "candidates" and not args:
            allowed({"standby"})
            return repository.execute(job, lambda policy: policy.checkpoint_candidates(job, worker))
        if action == "heartbeat":
            heartbeat = WorkerHeartbeat.model_validate(args)
            if (heartbeat.job_id, heartbeat.worker_id) != (job, worker):
                raise APIError("403 Forbidden", "IDENTITY_DENIED")
            return repository.execute(job, lambda policy: policy.heartbeat(heartbeat))
        if action == "upload_url" and set(args) == {"manifest"}:
            manifest = CheckpointManifest.model_validate(args["manifest"])
            if (manifest.job_id, manifest.worker_id) != (job, worker):
                raise APIError("403 Forbidden", "IDENTITY_DENIED")
            if not repository.execute(job, lambda policy: policy.can_upload_checkpoint(manifest)):
                raise APIError("409 Conflict", "UPLOAD_NOT_ALLOWED")
            return transfer_url(manifest, role, "PUT")
        if action == "download_url":
            allowed({"standby"})
            ref = CheckpointRef.model_validate(args)

            def offer(policy):
                for manifest in policy.checkpoint_candidates(job, worker):
                    if (manifest.checkpoint_id, manifest.lease_epoch) == (ref.checkpoint_id, ref.epoch):
                        return manifest
                raise APIError("403 Forbidden", "CHECKPOINT_NOT_OFFERED")

            return transfer_url(repository.execute(job, offer), role, "GET")
        if action == "commit" and set(args) == {"manifest", "data"}:
            manifest = CheckpointManifest.model_validate(args["manifest"])
            if (manifest.job_id, manifest.worker_id) != (job, worker):
                raise APIError("403 Forbidden", "IDENTITY_DENIED")
            data = verify_data(b64decode(args["data"], validate=True), manifest)
            return repository.execute(job, lambda policy: policy.commit_checkpoint(manifest),
                                      upload=(manifest, data))
        if action in {"claim", "yield", "download"}:
            ref = CheckpointRef.model_validate(args)
            if action == "yield":
                allowed({"primary"})
                return repository.execute(job, lambda policy: policy.yield_or_pause(
                    job, worker, ref.epoch, ref.checkpoint_id,
                ))
            allowed({"standby"})
            if action == "claim":
                return repository.execute(job, lambda policy: policy.claim_standby(
                    job, worker, ref.epoch, ref.checkpoint_id,
                ))

            def download(policy):
                for manifest in policy.checkpoint_candidates(job, worker):
                    if (manifest.checkpoint_id, manifest.lease_epoch) == (ref.checkpoint_id, ref.epoch):
                        return b64encode(policy.store.verified_bytes(manifest)).decode("ascii")
                raise APIError("403 Forbidden", "CHECKPOINT_NOT_OFFERED")

            return repository.execute(job, download)
        if action == "resumed":
            allowed({"standby"})
            evidence = ResumeEvidence.model_validate(args)
            return repository.execute(job, lambda policy: policy.mark_first_resumed_step(
                job, worker, evidence.epoch, evidence.step, evidence.loss, evidence.sha256,
            ))
        if action == "complete" and set(args) == {"epoch"}:
            epoch = TypeAdapter(Step).validate_python(args["epoch"])
            return repository.execute(job, lambda policy: policy.complete(job, worker, epoch))
        raise APIError("422 Unprocessable Entity", "UNKNOWN_OR_INVALID_ACTION")

    def encode(item):
        if isinstance(item, WireModel):
            return item.model_dump(mode="json")
        if isinstance(item, JobPlan):
            return asdict(item)
        raise TypeError("invalid response object")

    def transfer_url(manifest, role, method):
        ticket = issue_ticket(manifest, role, method, credentials[role])
        return {"signed_url": "/v1/checkpoint?ticket=" + ticket, "expires_in_s": 20}

    def authenticate(environ):
        bearer = environ.get("HTTP_AUTHORIZATION", "").removeprefix("Bearer ")
        role = next((role for role, token in credentials.items()
                     if TOKEN_PATTERN.fullmatch(bearer) and hmac.compare_digest(bearer, token)), None)
        if role is None or not environ.get("HTTP_AUTHORIZATION", "").startswith("Bearer "):
            raise APIError("401 Unauthorized", "AUTH_REQUIRED")
        window = int(time.monotonic())
        with rate_lock:
            previous, count = windows.get(role, (window, 0))
            count = count + 1 if previous == window else 1
            if count > 20:
                raise APIError("429 Too Many Requests", "RATE_LIMITED")
            windows[role] = (window, count)
        return role

    def transfer(environ):
        role = authenticate(environ)
        query = parse_qs(environ.get("QUERY_STRING", ""), strict_parsing=True, max_num_fields=1)
        if set(query) != {"ticket"} or len(query["ticket"]) != 1:
            raise APIError("403 Forbidden", "INVALID_TRANSFER")
        try:
            manifest = verify_ticket(query["ticket"][0], role, environ["REQUEST_METHOD"], credentials[role])
        except ValueError:
            raise APIError("403 Forbidden", "INVALID_TRANSFER") from None
        if environ["REQUEST_METHOD"] == "PUT":
            if manifest.worker_id != DEVICE_IDS.get(role):
                raise APIError("403 Forbidden", "IDENTITY_DENIED")
            if int(environ.get("CONTENT_LENGTH") or 0) != manifest.size_bytes:
                raise APIError("413 Payload Too Large", "CHECKPOINT_SIZE")
            data = verify_data(environ["wsgi.input"].read(manifest.size_bytes), manifest)
            accepted = repository.execute(manifest.job_id, lambda policy: policy.commit_checkpoint(manifest),
                                          upload=(manifest, data))
            if not accepted:
                raise APIError("409 Conflict", "UPLOAD_NOT_ALLOWED")
            return {"result": True}

        def download(policy):
            # Capability is not authority to bypass current policy or freshness.
            if role == "standby" and manifest in policy.checkpoint_candidates(manifest.job_id, DEVICE_IDS[role]):
                return policy.store.verified_bytes(manifest)
            raise APIError("403 Forbidden", "CHECKPOINT_NOT_OFFERED")

        return repository.execute(manifest.job_id, download)

    def handle(environ, start_response):
        request_id = uuid4().hex
        status = "200 OK"
        try:
            route = (environ["REQUEST_METHOD"], environ["PATH_INFO"])
            if route[0] in {"GET", "HEAD"} and route[1] == "/healthz":
                payload = {"ready": True}
            elif route[0] in {"GET", "PUT"} and route[1] == "/v1/checkpoint":
                payload = transfer(environ)
            elif route == ("POST", "/v1/control"):
                role = authenticate(environ)
                length = int(environ.get("CONTENT_LENGTH") or 0)
                if not 0 < length <= MAX_BODY:
                    raise APIError("413 Payload Too Large", "BODY_SIZE")
                raw = environ["wsgi.input"].read(length)
                if len(raw) != length:
                    raise APIError("400 Bad Request", "INCOMPLETE_BODY")
                request = Request.model_validate(json.loads(raw, object_pairs_hook=unique_keys))
                if request.action != "commit" and length > MAX_CONTROL_BODY:
                    raise APIError("413 Payload Too Large", "CONTROL_BODY_SIZE")
                if abs(time.time() - request.sent_at) > 30:
                    raise APIError("409 Conflict", "STALE_REQUEST")
                payload = {"result": dispatch(role, request)}
            else:
                raise APIError("404 Not Found", "UNKNOWN_ROUTE")
            data = payload if isinstance(payload, bytes) else json.dumps(payload, default=encode, allow_nan=False).encode()
        except APIError as error:
            status = error.status
            data = json.dumps({"error": error.code, "request_id": request_id}).encode()
        except (ValidationError, TypeError, ValueError, IntegrityError):
            status = "422 Unprocessable Entity"
            data = json.dumps({"error": "INVALID_REQUEST", "request_id": request_id}).encode()
        except Exception as error:
            LOGGER.warning("Coordinator request %s failed (%s)", request_id, type(error).__name__)
            status = "503 Service Unavailable"
            data = json.dumps({"error": "COORDINATOR_UNAVAILABLE", "request_id": request_id}).encode()
        binary = status == "200 OK" and route == ("GET", "/v1/checkpoint")
        start_response(status, [("Content-Type", "application/octet-stream" if binary else "application/json"),
                                ("Content-Length", str(len(data))), ("Cache-Control", "no-store"),
                                ("Referrer-Policy", "no-referrer"), ("X-Content-Type-Options", "nosniff")])
        return [b"" if environ["REQUEST_METHOD"] == "HEAD" else data]

    return handle


def from_environment():
    uri = os.environ.get("LIFERAFT_ATLAS_URI", "")
    if not uri.startswith("mongodb+srv://"):
        raise ValueError("configure the Atlas SRV URI on the hosted coordinator")
    credentials = {role: os.environ.get(f"LIFERAFT_{role.upper()}_TOKEN", "") for role in REQUIRED_ROLES}
    gateway_token = os.environ.get("LIFERAFT_GATEWAY_TOKEN")
    if gateway_token:
        credentials["gateway"] = gateway_token
    return application(AtlasRepository(uri), credentials, drills=os.environ.get("LIFERAFT_ENABLE_DRILLS") == "1")
