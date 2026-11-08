"""Outbound HTTPS client and operator commands for the Phase 3 coordinator."""
from base64 import b64decode, b64encode
import json
import os
import re
import random
from pathlib import Path
import tempfile
import time
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from dotenv import dotenv_values
from pydantic import Field, TypeAdapter

from .artifacts import LocalArtifactStore, verify_data
from .cloud_api import DEVICE_IDS, MAX_BODY, PRIMARY, TOKEN_PATTERN, unique_keys
from .config import log, state_dir
from .contracts import AdaptiveHeartbeat, MAX_CHECKPOINT_BYTES, CheckpointManifest, Identifier, Step, WireModel, utc_now
from .pi import PI_PRIMARY
from .failover import LEASE_TTL_S, JobPlan, JobSpec

RETRYABLE_STATUS = frozenset({429, 502, 503, 504})
RETRY_SAFE_ACTIONS = frozenset({"doctor", "spec", "status", "events", "register", "candidates",
                                "heartbeat", "heartbeat_edge", "ambient", "pi_telemetry", "edge_status", "commit", "rescue",
                                "button", "upload_url", "download_url", "photon_context"})


class LeaseResponse(WireModel):
    action: Literal["RUN", "PAUSE", "STOP"]
    lease_epoch: Step
    lease_remaining_s: float = Field(ge=0, le=LEASE_TTL_S, strict=True)
    checkpoint_interval: int | None = Field(default=None, ge=1, le=10_000, strict=True)


def decode_response(raw):
    def reject_constant(value):
        raise ValueError("nonfinite JSON")

    return json.loads(raw, object_pairs_hook=unique_keys, parse_constant=reject_constant)


def decode_plan(value):
    plan = LeaseResponse.model_validate(value)
    if plan.action != "STOP" and (plan.lease_epoch == 0 or plan.lease_remaining_s == 0):
        raise ValueError("active plan requires a finite current lease")
    return JobPlan(**plan.model_dump())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class CloudClient:
    def __init__(self, url, token):
        parts = urlsplit(url)
        if (parts.scheme != "https" or not parts.hostname or parts.username or parts.password
                or parts.path not in ("", "/") or parts.query or parts.fragment):
            raise ValueError("set LIFERAFT_CLOUD_URL to the coordinator HTTPS origin")
        if not TOKEN_PATTERN.fullmatch(token):
            raise ValueError("set the scoped 64-character hex LIFERAFT_CLOUD_TOKEN")
        self.endpoint = url.rstrip("/") + "/v1/control"
        self.origin = url.rstrip("/")
        self.token = token
        self.opener = build_opener(NoRedirect())
        self._signed_transfers = None

    def supports_signed_transfers(self):
        if self._signed_transfers is None:
            report = self.call("doctor")
            if not isinstance(report, dict):
                raise ValueError("invalid coordinator protocol report")
            self._signed_transfers = report.get("checkpoint_transfer") == "signed-v1"
        return self._signed_transfers

    def _exchange(self, request, *, label, limit, retry_safe):
        """One six-second budget; never retry an ambiguous ownership mutation."""
        deadline = time.monotonic() + 6
        last_status = None
        for attempt in range(3 if retry_safe else 1):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                with self.opener.open(request, timeout=min(2.0, remaining)) as response:
                    chunks, size = [], 0
                    read = getattr(response, "read1", response.read)
                    while time.monotonic() < deadline:
                        chunk = read(min(64 * 1024, limit + 1 - size))
                        if time.monotonic() >= deadline:
                            raise OSError("response deadline")
                        if not chunk:
                            return b"".join(chunks)
                        size += len(chunk)
                        if size > limit:
                            raise ValueError("response size cap")
                        chunks.append(chunk)
                    raise OSError("response deadline")
            except HTTPError as error:
                last_status = error.code
                error.close()
                if error.code not in RETRYABLE_STATUS:
                    break
            except (URLError, OSError):
                last_status = None
            except ValueError:
                raise RuntimeError(f"invalid coordinator response during {label}") from None
            if not retry_safe or attempt == 2:
                break
            delay = min(random.uniform(0.1, 0.2) * 2**attempt, max(0, deadline - time.monotonic()))
            if delay:
                time.sleep(delay)
        if last_status is not None:
            raise RuntimeError(f"coordinator rejected {label} (HTTP {last_status})") from None
        raise RuntimeError(f"coordinator unavailable during {label}") from None

    def transfer(self, signed_url, method, *, data=None, limit=MAX_CHECKPOINT_BYTES):
        # A compromised response must not exfiltrate a worker token to another
        # host, scheme, route or redirect. Accept only our exact relative route.
        if not isinstance(signed_url, str) or not re.fullmatch(
                r"/v1/checkpoint\?ticket=[A-Za-z0-9_-]{1,8100}\.[a-f0-9]{64}", signed_url):
            raise ValueError("invalid coordinator transfer URL")
        request = Request(self.origin + signed_url, data=data, method=method, headers={
            "Content-Type": "application/octet-stream", "Authorization": f"Bearer {self.token}",
        })
        return self._exchange(request, label="checkpoint transfer", limit=limit, retry_safe=True)

    def upload_checkpoint(self, manifest, data):
        verify_data(data, manifest)
        offer = self.call("upload_url", manifest.job_id, manifest=manifest.model_dump(mode="json"))
        if not isinstance(offer, dict) or "signed_url" not in offer:
            raise ValueError("invalid coordinator upload offer")
        raw = self.transfer(offer["signed_url"], "PUT", data=data, limit=4096)
        try:
            acknowledgment = decode_response(raw)
            if acknowledgment != {"result": True} or acknowledgment["result"] is not True:
                raise ValueError
            return True
        except (KeyError, TypeError, ValueError):
            raise RuntimeError("invalid checkpoint upload acknowledgment") from None

    def download_checkpoint(self, manifest):
        offer = self.call("download_url", manifest.job_id, epoch=manifest.lease_epoch,
                          checkpoint_id=manifest.checkpoint_id)
        if not isinstance(offer, dict) or "signed_url" not in offer:
            raise ValueError("invalid coordinator download offer")
        return verify_data(self.transfer(offer["signed_url"], "GET", limit=manifest.size_bytes), manifest)

    def call(self, action, job=None, **args):
        body = json.dumps({"action": action, "job": job, "sent_at": time.time(), "args": args},
                          allow_nan=False).encode()
        request = Request(self.endpoint, data=body, headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {self.token}",
        })
        raw = self._exchange(request, label=action, limit=MAX_BODY, retry_safe=action in RETRY_SAFE_ACTIONS)
        try:
            response = decode_response(raw)
            if not isinstance(response, dict) or set(response) != {"result"}:
                raise ValueError
            return response["result"]
        except (KeyError, TypeError, ValueError):
            raise RuntimeError(f"invalid coordinator response during {action}") from None

    def export_events(self, job):
        from .evidence import verify_journal

        events = []
        cursor = 0
        head = None
        head_hash = None
        for _ in range(32):
            page = self.call("events", job, **({"after": cursor, "through": head} if head is not None else {}))
            if not isinstance(page, dict) or page.get("chain_valid") is not True:
                raise ValueError("coordinator journal verification failed")
            if head is None:
                head, head_hash = page.get("head_seq"), page.get("head_hash")
                if head is None:
                    raise ValueError("coordinator needs paged-v1 event export; update server before exporting")
            if (page.get("head_seq"), page.get("head_hash")) != (head, head_hash):
                raise ValueError("event journal head changed during export")
            batch = page.get("events")
            if not isinstance(batch, list):
                raise ValueError("invalid event page")
            events.extend(batch)
            if len(json.dumps(events)) > 2 * 1024 * 1024:
                raise ValueError("event export exceeds size cap")
            next_after = batch[-1]["seq"] if batch else cursor
            if page.get("next_after") != next_after or (page.get("has_more") and next_after <= cursor):
                raise ValueError("event pagination did not advance")
            cursor = next_after
            if page.get("has_more") is False:
                result = {"chain_valid": True, "events": events, "complete": True,
                          "head_seq": head, "head_hash": head_hash}
                verify_journal(result, job)
                return result
        raise ValueError("event export page budget exceeded")


class CloudWorkerCoordinator:
    def __init__(self, client, store, *, adaptive=False):
        self.adaptive = adaptive
        self.client = client
        self.store = store

    def get_spec(self, job_id):
        return JobSpec.model_validate(self.client.call("spec", job_id))

    def start_primary(self, job_id, worker_id):
        return decode_plan(self.client.call("start", job_id))

    def heartbeat(self, request):
        action = "heartbeat_edge" if self.adaptive and isinstance(request, AdaptiveHeartbeat) else "heartbeat"
        return decode_plan(self.client.call(action, request.job_id, **request.model_dump(
            mode="json", exclude={"checkpoint_ms", "step_wall_ms"} if action == "heartbeat" else None)))

    def register_standby(self, job_id, worker_id):
        self.client.call("register", job_id)

    def checkpoint_candidates(self, job_id, worker_id):
        return [CheckpointManifest.model_validate(item) for item in self.client.call("candidates", job_id)]

    def claim_standby(self, job_id, worker_id, expected_epoch, checkpoint_id):
        # Restore/HTTPS latency can exceed the standby freshness window. Renew
        # presence, not ownership; the atomic claim still validates epoch/state.
        self.register_standby(job_id, worker_id)
        return decode_plan(self.client.call("claim", job_id, epoch=expected_epoch, checkpoint_id=checkpoint_id))

    def commit_checkpoint(self, manifest):
        data = self.store.verified_bytes(manifest)
        if hasattr(self.client, "supports_signed_transfers") and self.client.supports_signed_transfers():
            return self.client.upload_checkpoint(manifest, data)
        return self.client.call("commit", manifest.job_id, manifest=manifest.model_dump(mode="json"),
                                data=b64encode(data).decode("ascii"))

    def yield_or_pause(self, job_id, worker_id, epoch, checkpoint_id):
        return self.client.call("yield", job_id, epoch=epoch, checkpoint_id=checkpoint_id)

    def mark_first_resumed_step(self, job_id, worker_id, epoch, step, loss, sha256):
        return self.client.call("resumed", job_id, epoch=epoch, step=step, loss=loss, sha256=sha256)

    def complete(self, job_id, worker_id, epoch):
        return self.client.call("complete", job_id, epoch=epoch)

    def fetch_checkpoint(self, manifest):
        # An offer is a snapshot, not a lasting authorization. Keep our existing
        # scoped standby identity fresh before the separately authorized GET.
        self.client.call("register", manifest.job_id)
        if hasattr(self.client, "supports_signed_transfers") and self.client.supports_signed_transfers():
            data = self.client.download_checkpoint(manifest)
        else:
            raw = self.client.call("download", manifest.job_id, epoch=manifest.lease_epoch,
                                   checkpoint_id=manifest.checkpoint_id)
            data = verify_data(b64decode(raw, validate=True), manifest)
        path = self.store.path_for(manifest.path)
        if path.exists():
            self.store.verified_bytes(manifest)
            return path
        return self.store.put(manifest.path, lambda stream: stream.write(data))


def install_commands(subcommands):
    cloud = subcommands.add_parser("cloud", help="operate the hosted Phase 3 coordinator")
    cloud.add_argument("--profile", choices=("operator", "primary", "standby", "gateway", "photon", "pi_primary"))
    actions = cloud.add_subparsers(dest="action", required=True)
    for action in ("doctor", "create", "status", "events", "rescue", "worker", "bridge", "photon", "pi-telemetry"):
        parser = actions.add_parser(action)
        parser.set_defaults(handler=run)
        parser.add_argument("--job", required=action != "doctor")
        if action in {"photon", "pi-telemetry"}:
            parser.add_argument("--seconds", type=int, default=120)
        if action == "photon":
            parser.add_argument("--investigation", type=Path, help="saved Nemotron advisory for WHY and handoff")
            parser.add_argument("--events", type=Path, help="journal backing the saved investigation")
        if action == "create":
            parser.add_argument("--primary", choices=(PRIMARY, PI_PRIMARY), default=PRIMARY)
        if action == "worker":
            parser.add_argument("--role", choices=("primary", "standby"), required=True)
        if action == "bridge":
            parser.add_argument("--port", required=True, help="Espressif native USB serial port")
            parser.add_argument("--monitor", action="store_true", help="forward ambient and coordinator display state")


def run(args):
    try:
        settings = dotenv_values(f".env.{args.profile}", interpolate=False) if args.profile else os.environ
        client = CloudClient(settings.get("LIFERAFT_CLOUD_URL") or "", settings.get("LIFERAFT_CLOUD_TOKEN") or "")
        action = args.action
        job = TypeAdapter(Identifier).validate_python(args.job) if args.job else None
        if action == "pi-telemetry":
            from .pi import cpu_temperature, is_pi5

            if (not 1 <= args.seconds <= 900 or not is_pi5()
                    or client.call("doctor")["role"] != "pi_primary"):
                raise ValueError("Pi telemetry requires a Pi 5, its scoped token and a bounded duration")
            deadline = time.monotonic() + args.seconds
            while time.monotonic() < deadline:
                value = cpu_temperature()
                client.call("pi_telemetry", job, client_utc=utc_now().isoformat(), pi_cpu_temp_c=value)
                time.sleep(min(2, max(0, deadline - time.monotonic())))
            return 0
        if action == "photon":
            from .photon import PhotonClient, drain

            if not 1 <= args.seconds <= 900 or client.call("doctor")["role"] != "photon":
                raise ValueError("Photon runner requires its scoped token and a bounded duration")
            provider = PhotonClient(settings.get("PHOTON_API_KEY") or os.environ.get("PHOTON_API_KEY", ""))
            if args.investigation:
                from .cockpit import investigation_view
                from .evidence import load_export, recovery_brief

                events, _ = load_export(args.events or state_dir() / f"{job}.jsonl", job)
                proof = recovery_brief(events, job)
                if not proof["verified_resumed"]:
                    raise ValueError("Photon handoff requires verified recovery evidence")
                incident = proof["incident_id"]
                advisory = investigation_view(args.investigation, job, events, incident)
                scoped = {str(event.event_id) for event in events if event.incident_id == incident}
                refs = list(dict.fromkeys(
                    ref for fact in advisory["facts"] for ref in fact["evidence_event_ids"] if ref in scoped
                ))[:4]
                if not refs or not client.call("photon_context", job, incident=incident,
                                               summary=advisory["outcome"][:400], refs=refs):
                    raise ValueError("Photon handoff did not match the current hosted incident")
            drain(client, provider, job, time.monotonic() + args.seconds)
            return 0
        if action == "bridge":
            from .bridge import run_bridge

            run_bridge(client, job, args.port, continuous=args.monitor)
            return 0
        if action == "worker":
            from .worker import run_worker

            capability = client.call("doctor")
            authenticated_role = capability.get("role")
            allowed_roles = {"primary", "pi_primary"} if args.role == "primary" else {"standby"}
            if authenticated_role not in allowed_roles:
                raise ValueError("cloud token does not match the worker role")

            worker_id = DEVICE_IDS[authenticated_role]
            advertised = capability.get("worker_id")
            if advertised != worker_id and (advertised is not None or authenticated_role == "pi_primary"
                                           or capability.get("edge_protocol") == "v1"):
                raise ValueError("coordinator returned an invalid worker identity")
            root = state_dir()
            root.mkdir(exist_ok=True, parents=True, mode=0o700)
            store = LocalArtifactStore(Path(tempfile.mkdtemp(prefix=f"cloud-{args.role}-", dir=root)))
            coordinator = CloudWorkerCoordinator(client, store, adaptive=capability.get("edge_protocol") == "v1")
            run_worker(coordinator, store, job_id=job, worker_id=worker_id, role=args.role,
                       step_sleep=0.4, timeout=240, poll_s=1.0, fetch_checkpoint=coordinator.fetch_checkpoint, adaptive=coordinator.adaptive)
            return 0
        fields = {}
        if action == "create":
            from .workload import CONFIG_FINGERPRINT, MODEL_VERSION, make_dataset

            spec = JobSpec(job_id=job, run_id=f"run-{uuid4().hex}", primary=args.primary, seed=1729,
                           target=200, checkpoint_every=10, model_version=MODEL_VERSION,
                           dataset_fingerprint=make_dataset(1729)[2], config_fingerprint=CONFIG_FINGERPRINT)
            fields = spec.model_dump(mode="json")
        if action == "rescue":
            fields = {"request_id": str(uuid4())}
        result = client.export_events(job) if action == "events" else client.call(action, job, **fields)
        log(f"CLOUD_{action.upper()}", job_id=job, result=result)
        return 0
    except (RuntimeError, ValueError, OSError) as error:
        log("CLOUD_OPERATION_FAILED", reason=str(error))
        return 2
