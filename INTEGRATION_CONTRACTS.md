# LIFERAFT — Engineering contracts: workers, cloud, checkpoints, agents, hardware and messaging

**Status:** Normative design contract for Codex to implement; example paths are **our proposed LIFERAFT endpoints**, not undocumented endpoints claimed to exist at Atlas, Photon or NVIDIA. Verify all provider SDK methods and hosting instructions in their official current docs.

## 1. Design principles

- **Authoritative source of truth = cloud coordinator database**, not dashboard local React state, worker's current process memory or Nemotron output.
- **One job, at most one accepted writer per epoch**, using atomic lease transitions and fencing. Stale orphaned computation may exist during a partition; it must not commit a checkpoint or update active status.
- **Worker transport = outbound HTTPS only.** Each worker independently connects; never require peer IP addresses, campus LAN inbound, SMB file share, SSH tunnel to a classmate's laptop or open firewall ports.
- **Immutable checkpoint file names.** Every file is uniquely named; new commits cannot overwrite prior checkpoints.
- **Event sources:** `measured` (from physical board/OS), `injected` (test), `derived` (computed from verified data), `provider` (NVIDIA/Photon callbacks). Always include source type and evidence link.
- **No unsafe actuator API.** There is no remote power-off, fan-off, GPIO relay toggle, free-form shell command, or `sudo` tool.

## 2. Identity and authorization

Actors: `primary_worker`, `standby_worker`, `operator`, `sensor_gateway`, `coordinator`, `nemotron_agent`, `photon_adapter`. Every caller has specific role claims and a separate secret/token; issuer, expiry, scopes and revocation defined server-side. The hosted coordinator validates bearer/device credential using constant-time comparison or authenticated JWT verification and maps it to an allowlisted `device_id`/role. The Atlas database URI stays only in the hosted runtime. The frontend uses appropriately scoped coordinator auth.

**Scopes:** worker only posts heartbeat/progress/checkpoint for assigned jobs; standby claims only under atomic policy; gateway may submit sensor events but never claim ownership; dashboard reads scoped data; operator may inject explicit demo fault only when demo mode is enabled and may acknowledge incidents; agent tools are read-only; Photon inbound commands are limited to status and ACK.

For each device key, allow server-side rotation; redact authorization headers. Require HTTPS, request IDs, timestamp/clock skew checks, device IDs and idempotency keys where applicable. Rate-limit events and reject unknown or stale credentials.

## 3. Suggested cloud API surface

Use the hosted coordinator's `POST /v1/control` action endpoint. Worker credentials and requests are checked by the coordinator. The table lists logical operations and their guarantees.

| Action / logical endpoint | Caller | Request | Response | Invariant |
|---|---|---|---|---|
| `register_worker` | worker | worker_id, capabilities, version, worker token | observed server time, role, permitted jobs | scoped role |
| `heartbeat` | worker | job_id, worker_id, lease_epoch, completed_step, client_observed_at | lease valid? server time, next policy | epoch verified, server timestamp authoritative |
| `get_job_plan` | worker | worker_id, job_id | intended action (`RUN`, `PAUSE`, `STANDBY`, `STOP`), epoch, checkpoint target | worker only receives assigned job |
| `request_checkpoint_upload` | current owner | immutable checkpoint id, declared size/sha/step/epoch | short-lived signed upload URL and path | no overwrite; size limit |
| `commit_checkpoint` | current owner | id, sha256, bytes, step, epoch | status + checkpoint reference | verify object before mark committed |
| `list_checkpoints` | authorized actor | job_id | committed candidates sorted step desc | never expose public object URLs |
| `issue_checkpoint_download` | standby | requested checkpoint id/job | short-lived signed GET URL | requires standby authorization |
| `request_rescue` | operator/gateway | job_id, incident_type, `source_type`, idempotency key | incident id, accepted/pending | cannot directly claim lease |
| `yield_or_pause` | current owner | job_id, epoch, verified last checkpoint | acknowledged yield state | only current owner |
| `claim_standby` | standby/controller | job_id, checkpoint id, current observed epoch | new epoch or conflict | transactional one-winner claim |
| `mark_first_resumed_step` | new owner | new epoch, actual step and loss, hash | verification status | real step after checkpoint required |
| `get_status` | operator or authorized worker | job_id | current authoritative state / metrics | redacted private data |
| `list_events` | operator | job_id, cursor | ordered events | validated typed entries |
| `submit_sensor_event` | sensor gateway | signed device id, sensor event, bridge timestamp | accepted/ignored reason | no GPIO execution |
| `ack_incident` | operator/Photon adapter | incident id, source message id | ack status | idempotent |

**Every API error** uses a machine-readable error code, request ID and safe message. Do not leak SQL stack traces, secrets, bucket object tokens or contact numbers. Use 401/403 appropriately for auth, 409 for stale epoch, 422 for bad schema, 429 for rate-limits; network timeouts retry with capped exponential backoff plus jitter. Distinguish committed vs uploading checkpoint.

## 4. Canonical schema examples

### Worker heartbeat

```json
{
  "protocol_version": 1,
  "request_id": "6e43b637-6090-4cb1-99f5-ef78ca0201a7",
  "job_id": "demo-job-001",
  "worker_id": "pi-primary",
  "lease_epoch": 4,
  "client_utc": "2026-11-07T19:15:30Z",
  "step_completed": 120,
  "status": "RUNNING",
  "system": {"os": "linux", "arch": "aarch64", "pi_cpu_temp_c": 49.6, "cpu_temp_valid": true},
  "checkpoint": {"last_committed_id": "ckpt-120-ab12"}
}
```

### Checkpoint manifest

```json
{
  "schema_version": 1,
  "checkpoint_id": "ckpt-120-ab12",
  "job_id": "demo-job-001",
  "run_id": "run-01",
  "step_completed": 120,
  "worker_id": "pi-primary",
  "lease_epoch": 4,
  "path": "runs/run-01/checkpoints/000120-ab12.pt",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "size_bytes": 642708,
  "dataset_fingerprint": "sha256:seed-1729-config-v1",
  "model_version": "tinymlp-v1",
  "created_utc": "2026-11-07T19:15:28Z",
  "committed_utc": "2026-11-07T19:15:31Z",
  "status": "COMMITTED"
}
```

The hash above is a **placeholder** and must never be presented as a computed real checkpoint hash. Actual code computes SHA-256 from physical bytes and compares them on both upload and restore.

### Sensor event relayed from ESP32

```json
{
  "protocol_version": 1,
  "event_id": "b5440d9d-8576-4bfd-9464-296e690d3d5a",
  "device_id": "esp32-s3-01",
  "bridge_id": "operator-laptop-bridge",
  "sequence": 18,
  "source_type": "injected",
  "event_type": "COOLING_FAILURE_TEST",
  "ambient_temp_c": 24.6,
  "ambient_valid": true,
  "bridge_received_utc": "2026-11-07T19:16:00Z"
}
```

### Incident event

```json
{
  "schema_version": 1,
  "event_id": "f29bd398-933e-4e6e-96aa-a50a60024b63",
  "incident_id": "inc-20261107-001",
  "job_id": "demo-job-001",
  "created_utc": "2026-11-07T19:16:00Z",
  "event_type": "RESCUE_REQUESTED",
  "source_type": "derived",
  "trigger_event_id": "b5440d9d-8576-4bfd-9464-296e690d3d5a",
  "worker_id": "pi-primary",
  "lease_epoch": 4,
  "severity": "WARNING",
  "message": "Software evacuation requested after physical test-button event"
}
```

### Live UI status

```json
{
  "job_id": "demo-job-001",
  "mode": "cloud",
  "hardware_mode": "esp32-usb-serial",
  "primary": {"id": "pi-primary", "connected": true, "last_seen_age_s": 1.8, "pi_cpu_temp_c": 49.6},
  "standby": {"id": "laptop-standby", "ready": true, "last_seen_age_s": 2.0},
  "sensor": {"id": "esp32-s3-01", "ambient_temp_c": 24.6, "valid": true, "last_seen_age_s": 1.4},
  "job": {"status": "VERIFIED_RESUMED", "owner": "laptop-standby", "lease_epoch": 5, "step": 121, "loss": 0.0178},
  "checkpoint": {"id": "ckpt-120-ab12", "step": 120, "verified": true},
  "incident": {"id": "inc-20261107-001", "source_type": "injected", "rto_s": 9.4, "rpo_steps": 0}
}
```

All numbers above are illustrative schema test fixtures, not actual demo results. The UI reads data from live cloud queries and actual worker results.

## 5. Persistence and ownership

The logical data model is below. Phase 3 stores each job's bounded policy snapshot and hash-chained journal in one private Atlas document and immutable bytes in a separate collection. A snapshot transaction commits both together on upload. Workers access only the HTTPS coordinator.

| Table | Key columns | Constraints / indexes |
|---|---|---|
| `jobs` | `job_id`, `run_id`, `state`, `owner_worker_id`, `lease_epoch`, `lease_expires_at`, `desired_action`, `model_version`, `dataset_fingerprint` | PK job_id, epoch >=0; index expiry; atomic locking update |
| `workers` | `worker_id`, `role`, `architecture`, `status`, `last_seen_at`, `capabilities_json` | PK worker_id; last_seen index |
| `checkpoints` | `checkpoint_id`, `job_id`, `run_id`, `producer`, `lease_epoch`, `step`, `path`, `sha256`, `bytes`, `state`, `committed_at` | immutable unique path, job+step index, state index |
| `incidents` | `incident_id`, `job_id`, `trigger`, `source_type`, `state`, `opened_at`, `resolved_at`, `rto_ms`, `rpo_steps` | PK incident, trigger idempotency unique |
| `events` | `event_id`, `incident_id`, `job_id`, `created_at`, `event_type`, `source_type`, `actor_id`, `lease_epoch`, `payload_redacted_json` | unique event id, ordered index job+time |
| `telemetry` | `sample_id`, `device_id`, `worker_id`, `measured_at`, `received_at`, `metric_name`, `metric_value`, `quality` | validated ranges, index device+time, retention |
| `message_events` | `provider_event_id`, `incident_id`, `direction`, `channel`, `delivery_state`, `contact_hash`, `created_at` | dedupe unique provider_event_id |
| `device_identities` | `device_id`, `role`, `credential_hash/identifier`, `active`, `rotated_at` | server-only read; no exposed secret |

The coordinator runs all transitions and commits accepted mutations in an Atlas transaction. Concurrent writes to the same job conflict and rerun against current state within a bounded deadline. The Atlas credential is scoped to the dedicated Liferaft database.

### Transactional ownership function behavior

Pseudocode for `claim_job(job_id, expected_epoch, claimant, checkpoint_id)`:

```text
BEGIN transaction
  SELECT job FOR UPDATE
  assert caller authorized for job and claimant standby ready
  assert row.lease_epoch == expected_epoch
  assert previous lease expired OR last owner issued verified yield
  SELECT checkpoint FOR UPDATE
  assert checkpoint.status == COMMITTED and job/model/dataset compatible
  assert checkpoint is backed by successfully verified private storage object
  increment lease_epoch, set owner=claimant, state=STANDBY_STARTING
  record transfer event including old owner + old/new epoch
COMMIT
return new lease_epoch, checkpoint id
```

A later `mark_first_resumed_step` verifies the reported new step is actually `checkpoint_step+1` or later and was issued by new epoch owner. On repeated claim, return conflict/idempotent prior result appropriately. The old primary may still calculate in memory; coordinator rejects all further writes from its stale epoch.

## 6. Retry, timing and failure budgets

- Heartbeat from workers: every **2 s** (adjustable). Lease TTL **12 s** (adjustable). Use **server time** for lease expiry; worker clock may be skewed.
- Checkpoint period: default every **10** optimizer steps, minimum **2** in at-risk mode only when safe.
- Cloud request timeout: suggest 5–10s for metadata calls and larger explicit timeout for checkpoint transfer; bounded retries max 3–5 with jitter.
- Cloud polling: standby poll every 1–2s, dashboard every 1–2s or supported push updates; handle 429.
- Stale telemetry: explicitly mark sensor sample as stale after configurable 10–15s; do **not** present last reading as current.
- Size cap: aim <10 MB per checkpoint for demo, set server-side hard limit matching actual storage capabilities.
- Two consecutive heartbeat misses: may show warning; **do not** transfer ownership solely on a naive two-miss counter without considering lease expiry and server-side policy.
- On cloud loss, workers stop accepting new job ownership. Current owner may pause after bounded renew failure; no split-brain accepted writes.
- Client offline buffer telemetry/event IDs with a strict finite maximum and chronological server reception marks; no infinite memory growth.

## 7. Training/checkpoint proof artifacts

Manifest fields must align exactly across Python worker, hosted coordinator and TypeScript UI. Create a codegen or schema snapshot test so a field rename breaks tests early. Use JSON Schema where possible. Define `RunId`, `JobId`, `WorkerId`, `IncidentId` and `CheckpointId` as distinct nominal types in TS to avoid accidental mixing.

For training, persist full **safe** checkpoint state (model/optimizer, RNG, dataset cursor). `torch.save` uses pickle-based serialization; only restore private owned files after hash, identity and type checks; see current PyTorch `weights_only` handling. Checkpoint `sha256` is computed over the raw `.pt` bytes and stored in separate signed/authenticated manifest. Failed restore must not erase last good file.

Compute RTO using timestamp of detected incident and **first completed optimizer step** on new owner, not mere backup process startup. RPO measures step loss if last completed primary step is known; if unknown show `unknown` rather than 0.

## 8. NVIDIA tool interface examples

Provide only tightly constrained read-only tool/function schemas. Sample:

```json
{"type":"function","function":{"name":"get_checkpoint_candidates","description":"List committed checkpoints for one authorized job","parameters":{"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"],"additionalProperties":false}}}
```

Define and validate arguments and response objects before sending them to LLM. Cap tool depth/loop count, ensure actual result-to-model followup, verify model ID/SDK against current API reference. Agent response must state `evidence_event_ids[]` and `unknowns[]`. Never allow model to invoke `shutdown`, `restart`, `sql`, `bash`, `gpio`, `move_lease`, `delete_checkpoint`, or `write_config`.

## 9. Photon commands and webhook defenses

- **Supported:** `STATUS`, `WHY`, `CHECKPOINT`, `ACK`, `HELP` (text-only is sufficient).
- **Unsupported:** arbitrary natural-language system mutations, reboot/power commands, model-generated shell execution.
- Match provider event ID, project ID, channel identity, operator allowlist, incident ID; dedupe by event ID, verify provider signature/authorized WebSocket session as documented. If Photon beta channel lacks a feature, select a compatible channel or report it unavailable—never fabricate an endpoint.
- Keep phone numbers/private channel IDs out of API logs and frontend. Store normalized hashed contact identifier only in event records. Do not display the complete inbound chat history to anonymous viewers.

## 10. Hardware serial contract

See `HARDWARE_SAFETY_AND_WIRING.md` for tested safe wiring and staged bring-up. ESP32 emits strictly structured `protocol_version=1` JSON lines over USB serial at configured 115200 baud. Gateway sends confirmed status commands back (`DISPLAY_STATUS` only). The button means `injected cooling test`; DS18B20 reading means `ambient measured`. Pi CPU temp arrives from OS as `pi_cpu_temp_c`; don't conflate them. Relay has **no command in protocol**.

## 11. Observable state change log

Log each phase:

1. `JOB_STARTED`
2. `CHECKPOINT_CREATED` → `CHECKPOINT_UPLOADED` → `CHECKPOINT_VERIFIED` → `CHECKPOINT_COMMITTED`
3. `SENSOR_EVENT_RECEIVED` (measured or injected)
4. `RESCUE_REQUESTED`
5. `PRIMARY_PAUSE_REQUESTED` or `PRIMARY_UNREACHABLE`
6. `PRIMARY_YIELDED` OR `LEASE_EXPIRED`
7. `LEASE_TRANSFERRED` (old → new epoch)
8. `STANDBY_DOWNLOADED_CHECKPOINT`
9. `CHECKPOINT_INTEGRITY_VERIFIED`
10. `FIRST_RESUMED_STEP_COMPLETED`
11. `RESCUE_VERIFIED`
12. `NEMOTRON_TOOL_CALL` / `NEMOTRON_REPORT_GENERATED`
13. `PHOTON_MESSAGE_SENT` / `PHOTON_OPERATOR_ACK`

Every status in UI must map to explicit events and durable state, not a timeout-based animation.
