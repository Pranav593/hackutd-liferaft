"""Outbound HTTPS client and operator commands for the Phase 3 coordinator."""
from base64 import b64decode, b64encode
import json
import os
import re
from pathlib import Path
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from dotenv import dotenv_values
from pydantic import TypeAdapter

from .artifacts import LocalArtifactStore, verify_data
from .cloud_api import DEVICE_IDS, MAX_BODY, PRIMARY, TOKEN_PATTERN
from .config import log, state_dir
from .contracts import MAX_CHECKPOINT_BYTES, CheckpointManifest, Identifier
from .failover import JobPlan, JobSpec


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
            self._signed_transfers = self.call("doctor").get("checkpoint_transfer") == "signed-v1"
        return self._signed_transfers

    def transfer(self, signed_url, method, *, data=None, limit=MAX_CHECKPOINT_BYTES):
        # A compromised response must not exfiltrate a worker token to another
        # host, scheme, route or redirect. Accept only our exact relative route.
        if not isinstance(signed_url, str) or not re.fullmatch(
                r"/v1/checkpoint\?ticket=[A-Za-z0-9_-]{1,8100}\.[a-f0-9]{64}", signed_url):
            raise ValueError("invalid coordinator transfer URL")
        request = Request(self.origin + signed_url, data=data, method=method, headers={
            "Content-Type": "application/octet-stream", "Authorization": f"Bearer {self.token}",
        })
        try:
            with self.opener.open(request, timeout=6) as response:
                raw = response.read(limit + 1)
                if len(raw) > limit:
                    raise ValueError("transfer response exceeds size cap")
                return raw
        except HTTPError as error:
            error.close()
            raise RuntimeError(f"coordinator rejected checkpoint transfer (HTTP {error.code})") from None
        except (URLError, OSError, ValueError):
            raise RuntimeError("coordinator unavailable during checkpoint transfer") from None

    def upload_checkpoint(self, manifest, data):
        verify_data(data, manifest)
        offer = self.call("upload_url", manifest.job_id, manifest=manifest.model_dump(mode="json"))
        raw = self.transfer(offer["signed_url"], "PUT", data=data, limit=4096)
        try:
            return json.loads(raw)["result"] is True
        except (KeyError, TypeError, ValueError):
            raise RuntimeError("invalid checkpoint upload acknowledgment") from None

    def download_checkpoint(self, manifest):
        offer = self.call("download_url", manifest.job_id, epoch=manifest.lease_epoch,
                          checkpoint_id=manifest.checkpoint_id)
        return verify_data(self.transfer(offer["signed_url"], "GET", limit=manifest.size_bytes), manifest)

    def call(self, action, job=None, **args):
        body = json.dumps({"action": action, "job": job, "sent_at": time.time(), "args": args},
                          allow_nan=False).encode()
        request = Request(self.endpoint, data=body, headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {self.token}",
        })
        try:
            with self.opener.open(request, timeout=6) as response:
                return json.loads(response.read(MAX_BODY + 1))["result"]
        except HTTPError as error:
            error.close()
            raise RuntimeError(f"coordinator rejected {action} (HTTP {error.code})") from None
        except (URLError, OSError, KeyError, ValueError):
            raise RuntimeError(f"coordinator unavailable during {action}") from None


class CloudWorkerCoordinator:
    def __init__(self, client, store):
        self.client = client
        self.store = store

    def get_spec(self, job_id):
        return JobSpec.model_validate(self.client.call("spec", job_id))

    def start_primary(self, job_id, worker_id):
        return JobPlan(**self.client.call("start", job_id))

    def heartbeat(self, request):
        return JobPlan(**self.client.call("heartbeat", request.job_id, **request.model_dump(mode="json")))

    def register_standby(self, job_id, worker_id):
        self.client.call("register", job_id)

    def checkpoint_candidates(self, job_id, worker_id):
        return [CheckpointManifest.model_validate(item) for item in self.client.call("candidates", job_id)]

    def claim_standby(self, job_id, worker_id, expected_epoch, checkpoint_id):
        # Restore/HTTPS latency can exceed the standby freshness window. Renew
        # presence, not ownership; the atomic claim still validates epoch/state.
        self.register_standby(job_id, worker_id)
        return JobPlan(**self.client.call("claim", job_id, epoch=expected_epoch, checkpoint_id=checkpoint_id))

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
    cloud.add_argument("--profile", choices=("operator", "primary", "standby", "gateway"))
    actions = cloud.add_subparsers(dest="action", required=True)
    for action in ("doctor", "create", "status", "events", "rescue", "worker", "bridge"):
        parser = actions.add_parser(action)
        parser.set_defaults(handler=run)
        if action != "doctor":
            parser.add_argument("--job", required=True)
        if action == "worker":
            parser.add_argument("--role", choices=tuple(DEVICE_IDS), required=True)
        if action == "bridge":
            parser.add_argument("--port", required=True, help="Espressif native USB serial port")


def run(args):
    try:
        settings = dotenv_values(f".env.{args.profile}", interpolate=False) if args.profile else os.environ
        client = CloudClient(settings.get("LIFERAFT_CLOUD_URL") or "", settings.get("LIFERAFT_CLOUD_TOKEN") or "")
        action = args.action
        job = None if action == "doctor" else TypeAdapter(Identifier).validate_python(args.job)
        if action == "bridge":
            from .bridge import run_bridge

            run_bridge(client, job, args.port)
            return 0
        if action == "worker":
            from .worker import run_worker

            if client.call("doctor")["role"] != args.role:
                raise ValueError("cloud token does not match the worker role")

            root = state_dir()
            root.mkdir(exist_ok=True, parents=True, mode=0o700)
            store = LocalArtifactStore(Path(tempfile.mkdtemp(prefix=f"cloud-{args.role}-", dir=root)))
            coordinator = CloudWorkerCoordinator(client, store)
            run_worker(coordinator, store, job_id=job, worker_id=DEVICE_IDS[args.role], role=args.role,
                       step_sleep=0.4, timeout=240, poll_s=1.0, fetch_checkpoint=coordinator.fetch_checkpoint)
            return 0
        fields = {}
        if action == "create":
            from .workload import CONFIG_FINGERPRINT, MODEL_VERSION, make_dataset

            spec = JobSpec(job_id=job, run_id=f"run-{uuid4().hex}", primary=PRIMARY, seed=1729,
                           target=200, checkpoint_every=10, model_version=MODEL_VERSION,
                           dataset_fingerprint=make_dataset(1729)[2], config_fingerprint=CONFIG_FINGERPRINT)
            fields = spec.model_dump(mode="json")
        if action == "rescue":
            fields = {"request_id": str(uuid4())}
        result = client.call(action, job, **fields)
        log(f"CLOUD_{action.upper()}", job_id=job, result=result)
        return 0
    except (RuntimeError, ValueError, OSError) as error:
        log("CLOUD_OPERATION_FAILED", reason=str(error))
        return 2
