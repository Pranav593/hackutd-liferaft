# LIFERAFT — Codex Master Engineering Specification

**HackUTD 2026 · November 7–8, 2026 · Version 1.0 · Status: implementation brief**  
**Intended readers:** Codex and the student development team  
**Primary sponsor targets:** NMC² (data-center resilience), NVIDIA Nemotron (agentic multi-step action), Photon (operator communications)  
**Non-negotiable environment:** two student laptops, unreliable/campus-isolated Wi-Fi, hardware not yet available, beginner hardware experience, CPU-capable demo.

> **Core mission:** Demonstrate a real training job on Laptop A saving verifiable checkpoints; when Laptop A loses its worker process or a hardware emergency occurs, Laptop B loads the last confirmed checkpoint and **continues the same training job**. Nemotron investigates and coordinates; Photon provides a real two-way operator interface. The physical sensor system is optional for first delivery and must not block the software.

## 0. Read this first — Codex operating contract

Implement this specification in **phases**, in the order shown. At the end of each phase:

1. Produce working code and automated tests.
2. Run the tests that are locally possible; report exactly what passed, failed or could not be run.
3. Record a short demo instruction and update `PROGRESS.md` (checkboxes, commands, blockers, next phase).
4. Commit only when requested by the team; never invent API keys or claim live integrations worked without credentials and observed responses.
5. Do not implement a pretty fake dashboard before making a real checkpoint resume work.
6. Build a fully functional **local simulator** first, so developers can work without Supabase, Nemotron, Photon, or hardware accounts; then add real services behind adapters.
7. Do not assume that machines on school Wi-Fi can reach each other's IP addresses. **No phase may require direct laptop-to-laptop TCP or UDP.**
8. Never use an LLM's output as the sole basis for executing a disruptive action. Enforce recovery, ownership, validation and safety through deterministic code.
9. When a step needs user-created credentials, a Supabase project, Photon channel setup, or a real second machine, implement the code and pause at that integration boundary with exact human setup instructions. Continue work on other testable parts.
10. Prefer understandable, documented Python over complex frameworks. If implementation requirements conflict, prioritize real checkpoint integrity, recovery continuity, and safe failure handling.

### Definition of a successful project

A live judge sees: a nontrivial PyTorch job running and a real loss curve; real checkpoints arriving in storage; a physical emergency or an actual killed process; a measured gap in heartbeats; a real transfer of job ownership; Laptop B resumes from the last verified step; the recovered loss curve continues; a Nemotron agent examines tools and produces a grounded incident report; a Photon message arrives on a real phone and `STATUS`/`WHY` returns current data. At every stage the UI shows **actual backend state**, not invented values.

### What is *not* the project

- Not migrating uncheckpointable arbitrary processes or moving GPU VRAM between machines.
- Not actually overheating laptops, cutting laptop power, or switching mains electricity.
- Not a production-grade high-availability scheduler. The demo has one job and two workers.
- Not a chatbot that merely repeats alerts.
- Not a fake animation pretending a job moved.

## 1. Sponsor alignment and source verification

### 1.1 HackUTD sponsor targets

**NMC² (primary):** The team is pursuing the "Keep the World Running" style challenge concerning data-center operational disruptions, better communication, and timely incident response. LIFERAFT focuses on **preserving useful compute progress when infrastructure becomes unsafe**, reducing wasted time and improving operator handoffs. Deliver measurable recovery latency, preserved checkpoint step and repeatable incident records.

**NVIDIA:** The user-provided sponsor sheet says **"Best Usage of Nemotron Beyond a Chatbot."** Use hosted NVIDIA Nemotron for a tool-driven multi-step *investigation → evidence collection → recovery plan → verification → report* workflow. The Python rescue controller remains deterministic. Current hosted API example: `https://integrate.api.nvidia.com/v1`, model `nvidia/nemotron-3-super-120b-a12b` (verify availability in team account before pinning). See https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b/deploy.

**Photon:** The user-provided sponsor sheet says **"Best Use of Photon API"**; the full HackUTD-specific Photon Notion guidelines were not retrievable. Photon Beta 2.0 documents messaging via Users, Spaces, Messages, with `https://api.photon.codes/v1`, and bearer project credentials `pho_sk_...`. Implement genuine operator messaging and incoming commands. Source: https://photon.codes/docs/beta/api-reference; example https://photon.codes/blog/introducing-photon-2.0. Verify any event-websocket or webhook schema against current Photon docs rather than inventing endpoint paths.

**Challenge-eligibility caveat:** The team has confirmed three company tracks are allowed. Keep NMC², NVIDIA and Photon as sponsor targets, and verify any additional MLH categories with an on-site MLH representative before claiming eligibility.

### 1.2 MLH research (not equivalent to confirmed 2026 HackUTD rules)

The user-requested `https://www.mlh.com/hackutd` could not be retrieved directly. The indexed MLH HackUTD page reachable at https://www.mlh.com/events/hackutd-ae and its https://www.mlh.com/events/hackutd-ae/prizes describes an **event that ended November 8–9, 2025**. Its displayed MLH categories are Gemini API, ElevenLabs, Solana, Vultr, DigitalOcean and GoDaddy Registry. The past event also lists Best Hardware, Best Startup, and other event-specific prizes. **Do not label these as confirmed HackUTD 2026 prize tracks.** LIFERAFT could plausibly suit Hardware/Startup, and DigitalOcean/Vultr only if actually deployed there; changing the reliable architecture purely for an unconfirmed extra prize is not advisable.

HackUTD event timing: initial Devpost deadline **Saturday November 7 at 11 PM CT**, final submission **Sunday November 8 at noon CT** on https://zeroday.hackutd.co/. The website lists an NMC workshop **Saturday 4:20–5:05 PM CT**. Confirm any last-minute changes at the event.

## 2. Product definition and differentiators

**One-line pitch:** *"Every data center protects its hardware. LIFERAFT protects the work running on it."*

### Three meaningful differentiators

1. **Rescue, not alerting:** actual recoverable computation moves to a second computer and finishes; evidence includes checkpoint hash, step number, loss curve, elapsed time and preserved progress.
2. **Risk-aware checkpointing:** normal mode saves every ~20 steps; when sensor/cooling risk rises, the job increases checkpoint frequency (e.g., every 5 steps) to reduce potential lost work. Measure storage overhead and maximum progress lost. This is a **policy-driven feature**, not autonomous AI taking dangerous action.
3. **Explainable, human-connected incident command:** Nemotron uses real diagnostic tools and a runbook to investigate; Photon makes the incident conversational (`STATUS`, `WHY`, `CHECKPOINT`, `ACK`) and tracks acknowledgements, with real delivery status and a durable incident timeline.

### Honest product limits

- Train a small checkpoint-friendly model with PyTorch on CPU; do **not** claim arbitrary deep-learning framework portability.
- The model can run on both laptops with pinned package versions. Do not assume their OS or CPU instruction sets are identical.
- A hard crash can lose work since the most recently **committed** checkpoint. Show that honestly.
- Simulated cooling failures indicate *the demonstration's external sensor condition*, not actual datacenter-grade thermal diagnosis.
- The control system is a hackathon prototype; a production fleet scheduler needs much stronger fencing, telemetry integration, security and operations engineering.

## 3. Network strategy: design around school Wi-Fi isolation

### Critical decision

**Primary mode: cloud rendezvous over HTTPS / TCP 443.** Both laptops independently make outbound connections to a managed backend. No incoming ports, LAN IPs, port forwarding, mDNS, or peer-to-peer connections are necessary. Using Supabase (PostgreSQL + Auth + Storage + optional Realtime) is recommended because it minimizes deployed infrastructure and supports both checkpoint object storage and coordination.

```
 Laptop A (primary worker)                         Laptop B (standby + rescue)
  training + checkpoint                                controller + training
     |   HTTPS 443                                           |  HTTPS 443
     v                                                     v
  +-----------------------------------------------------------------------+
  | Supabase Auth + PostgreSQL + PRIVATE Storage bucket (cloud relay)     |
  | jobs / leases / workers / checkpoints / incidents / event timeline    |
  +-----------------------------------------------------------------------+
                     ^                                  ^
                     | HTTPS                            | HTTPS/WSS
                Dashboard (on B)                Nemotron API / Photon API

 Arduino or ESP32 (later) → USB serial into Laptop B (best no-Wi-Fi path)
```

The cloud is **coordination plus storage**, not the primary compute engine. Both computers run training locally; Laptop B restores the checkpoint only after the object is committed and validated. A's last successful upload survives A's abrupt shutdown.

**Practical connection test on both laptops:**
- Open the Supabase project URL in browser; verify access to HTTPS endpoints.
- Run a minimal authenticated upload/download of one 10 KB test file to the private storage bucket.
- Run two simultaneous authenticated sessions; A writes an event row, B reads it.
- Do not use `ping` failure as proof that internet is down. Campus firewalls often block ICMP or device-to-device traffic.
- If outbound HTTPS is blocked, try a **team-controlled phone hotspot/travel router** and repeat the test. Only after that consider Tailscale (DERP relay over outbound internet), if permitted by campus policies. Do not use an open public tunnel that exposes unauthenticated management APIs.

**Connectivity contingency matrix:**

| Condition | Behavior |
|---|---|
| Campus Wi-Fi blocks A↔B directly | Normal: cloud HTTPS means no LAN dependency. |
| A process crashes; cloud reachable from B | B claims job after lease expiry, downloads checkpoint, resumes. |
| A is alive but cloud access temporarily fails | A **pauses training** after coordination grace period to limit split-brain; B must not assume A is dead based on missing heartbeats alone until lease expires. |
| Cloud temporarily unavailable to both | Both workers enter `DEGRADED`; stop automatic ownership transfer. Recovery cannot be guaranteed during cloud outage. Show honest degraded status and retry. |
| Supabase credentials not ready | Use local in-process/file adapter to finish Phase 1 and Phase 2, then plug in cloud. |
| Only one laptop works | Run two worker processes with separate folders in a single host, label clearly as degraded demo mode. |

### Why not a local FastAPI server on Laptop B?

FastAPI listening on `0.0.0.0` is not enough to traverse school Wi-Fi client isolation. The direct A→B upload from the previous outline would be fragile. **Replace direct A→B requests with independently initiated cloud requests.** A small local FastAPI process can still power B's operator dashboard, but A must not depend on reaching it.

## 4. Technologies: exact choice and purpose

| System | Use | Implementation guidance |
|---|---|---|
| Python 3.11+ | Workers, recovery controller, tests | Pin dependencies in `uv.lock` or pinned `requirements.txt`. |
| PyTorch CPU | Small genuine model | `torch.nn.Sequential(Linear(32,64), ReLU(), Linear(64,1))`; synthetic seeded regression data. |
| Supabase Auth | Team's demo authentication | Start with one dedicated demo account used by both processes; distinguish workers by UUID, never expose a secret/service-role key in frontend. |
| Supabase Postgres | Worker status, lease, checkpoints, events | Use a **transactional RPC** for atomic job claims. RLS must restrict all user data. |
| Supabase Storage | Committed checkpoint files | Private `liferaft-checkpoints` bucket; unique immutable object path per checkpoint. |
| Next.js + TypeScript + Tailwind | Dashboard | Single screen optimized for live judging. |
| Supabase Realtime **or** polling | Dashboard updates | Realtime optional; 1–2s polling acceptable and simpler under time pressure. |
| NVIDIA Nemotron hosted | Agent tool orchestration | Use OpenAI-compatible Python SDK with configured model ID; integrate in Phase 6. |
| Photon 2.0 | Messaging | `POST .../users`, `/spaces`, `/messages` per current docs; inbound WebSocket **if documented/verified**, otherwise a secure hosted webhook. |
| PySerial | USB Arduino integration | Parse newline-delimited JSON; validate events before acting. |
| Pytest, Ruff, TypeScript lint | Testing | Every phase includes runnable tests. |

Do not add Kubernetes, Celery, Kafka, a vector database, Redis, blockchain, or an LLM running locally unless there is a demonstrated need. Sophistication is in **real failover semantics, validation, and operational evidence**, not framework count.

## 5. Repository layout and ownership boundaries

```
liferaft/
  README.md
  AGENTS.md
  PROGRESS.md
  docs/
    architecture.md
    demo-script.md
    network-diagnostics.md
    sponsor-evidence.md
    risk-register.md
  python/
    pyproject.toml
    liferaft/
      __init__.py
      cli.py                  # `liferaft worker|controller|demo|doctor`
      config.py
      models.py               # Typed data contracts
      training/
        dataset.py            # deterministic synthetic data
        model.py              # tiny PyTorch MLP
        train.py
        checkpoint.py
      coordination/
        protocol.py           # Repository/Coordinator interfaces
        local_adapter.py      # fully offline implementation
        supabase_adapter.py   # cloud implementation
        lease.py              # policies; claim/release calls
        storage.py            # upload/download/verify
      workers/
        primary.py            # runs job & heartbeat loop
        standby.py            # claim + restore + execute
      risk/
        policy.py             # deterministic risk bands
        predictor.py          # optional baseline forecast
      incidents/
        log.py
        verification.py
      agents/
        nemotron_agent.py
        tools.py
        runbook.md
      messaging/
        photon_client.py
        inbound.py
        fake_client.py
      hardware/
        serial_bridge.py
        simulator.py
    tests/
      test_checkpoint_resume.py
      test_upload_commit.py
      test_failover.py
      test_claim_race.py
      test_corrupt_checkpoint.py
      test_risk_policy.py
      test_agent_tools.py
      test_photon_commands.py
  web/
    package.json
    src/app/page.tsx
    src/components/
      WorkerStatus.tsx
      TrainingChart.tsx
      RescueTimeline.tsx
      RiskGauge.tsx
      CheckpointChain.tsx
      OperatorConsole.tsx
  supabase/
    migrations/              # schema + RLS + RPC
    functions/               # only if necessary for Photon webhook/privileged ops
  hardware/
    arduino_sensor.ino
    esp32_sensor.ino          # optional later
  scripts/
    check_network.py
    verify_checkpoint.py
    inject_failure.py
  .env.example
  .gitignore
```

**Four person division (if available):**
- **A — Compute engineer:** PyTorch, checkpoint serialization, deterministic loss continuity, local worker.
- **B — Reliability engineer:** Supabase, lease protocol, cloud storage, recovery coordinator, failure tests.
- **C — Experience/hardware engineer:** Next.js dashboard, event visualization, simulator, serial interface.
- **D — Agent/communications engineer:** NVIDIA tool-calling agent, Photon setup, two-way commands, sponsor evidence.

Work independently using shared typed event schemas. Agree on contracts before separate branches. Do not allow four Codex agents to refactor the same shared files simultaneously.

## 6. Data contracts and state machine

### 6.1 Job states

`QUEUED → RUNNING_A → (RISK_DETECTED | DRAINING | A_UNREACHABLE) → RECOVERING → RUNNING_B → COMPLETED`

Other terminal/exception states: `FAILED`, `PAUSED`, `DEGRADED`, `NO_VALID_CHECKPOINT`, `BACKUP_UNAVAILABLE`. Every state change emits a durable event.

### 6.2 Minimal cloud database schema

In a **SQL migration**, implement at least:

- `jobs`: `id UUID PK`, `owner_id UUID NOT NULL`, `status TEXT`, `active_worker_id TEXT`, `epoch BIGINT DEFAULT 0`, `lease_expires_at TIMESTAMPTZ`, `total_steps INT`, `current_step INT`, `latest_checkpoint_id UUID NULL`, `requested_state TEXT`, `created_at`, `updated_at`.
- `workers`: composite identity (`job_id`, `worker_id`), `owner_id`, `role`, `status`, `last_heartbeat_at TIMESTAMPTZ`, `heartbeat_seq BIGINT`, `hostname_label`, `platform`, `cpu_count INT`, `free_memory_mb INT`, `last_report JSONB`. Worker labels are not authentication identities.
- `checkpoints`: `id UUID PK`, `owner_id`, `job_id`, `worker_id`, `epoch`, `step INT`, `storage_path TEXT UNIQUE`, `sha256 TEXT`, `size_bytes BIGINT`, `status TEXT` (`PENDING`, `COMMITTED`, `INVALID`), `created_at`, `committed_at`.
- `incidents`: `id UUID`, `owner_id`, `job_id`, `severity`, `cause`, `source`, `status`, `opened_at`, `closed_at`, `details JSONB`.
- `events`: `id UUID`, `owner_id`, `job_id`, `event_type TEXT`, `worker_id TEXT`, `epoch BIGINT`, `timestamp TIMESTAMPTZ`, `dedupe_key TEXT UNIQUE NULL`, `payload JSONB`.
- `operator_actions`: `id UUID`, `owner_id`, `incident_id`, `sender`, `channel`, `command`, `status`, `created_at`, `payload JSONB`.

Add indexes on `events(job_id,timestamp)`, `checkpoints(job_id,step DESC)`, and `workers(job_id,last_heartbeat_at)`.

**Security:** Every exposed table must have Row-Level Security enabled. Use `owner_id = auth.uid()` for the dedicated demo account's rows, both in SELECT and write policies; validate foreign-key ownership across related rows. No `service_role` key in browser or local student applications. Do not make the storage bucket public. Use authenticated client APIs and private bucket RLS. If using a security-definer function, restrict execute privileges, set search path, check owner identity, and audit the RPC carefully. Prefer security-invoker functions plus RLS if practical.

### 6.3 Ownership / lease semantics (most important safety rule)

Implement `try_claim_job(job_id, worker_id, expected_epoch)` as an **atomic Postgres transaction/RPC**, never a `SELECT` followed by unconditional `UPDATE` from Python.

- Lock one job row (`FOR UPDATE`).
- Verify authenticated owner may mutate the job.
- Require the existing lease to have expired **OR** the previous owner to have explicitly released control.
- Refuse if the caller's expected epoch is stale, or its worker is not registered/ready.
- Atomically increment `epoch`, set `active_worker_id`, `lease_expires_at = now()+interval '8 seconds'`, return new epoch.
- Current owner renews lease with epoch match every ~2 seconds while healthy.
- On all updates/commits, require ownership token `(job_id, worker_id, epoch)` to match current live lease. Reject old epochs.
- When a worker loses the ability to renew for >6 seconds, it pauses/terminates local training before assuming it still owns the job. After reconnect, it must re-query epoch and **never** resume an old epoch.
- **Caveat:** This is a demonstration-level soft lease; it is not strong distributed fencing against every network partition. Do not call it production-grade exactly-once execution.

For the first working prototype, implement these rules in the local adapter with a lock and fake clock before writing SQL. Unit-test competing claims.

### 6.4 Checkpoint lifecycle

1. Train step reaches checkpoint interval.
2. Write checkpoint file to **temporary path**, then `fsync` where reasonable and atomic `os.replace` to final local path.
3. Calculate SHA-256 over the exact bytes and record file size.
4. Upload to unique immutable private object path: `jobs/{job_id}/e{epoch}/step_{step}_{checkpoint_uuid}.pt`.
5. Wait for successful storage response. Only then create `checkpoints.status=COMMITTED` record and update `jobs.latest_checkpoint_id` atomically if same epoch/owner and newer than existing.
6. If upload fails, keep local file and retry with backoff. Never mark it committed. A file that exists only on Laptop A is **not** a disaster-safe checkpoint.
7. On rescue, B selects latest committed checkpoint, downloads, verifies size + SHA-256, then loads. If corrupt, mark invalid and try next older committed checkpoint (maximum 3 attempts in hackathon MVP).
8. Checkpoint commit should be idempotent; duplicate requests must not create new logical checkpoints or roll progress backward.

Use `torch.load(path, map_location='cpu', weights_only=True)` with trusted/authenticated, hash-verified artifacts and no untrusted arbitrary objects. Save model and optimizer state dictionaries, `step`, deterministic training config, dataset seed/version, and RNG state if stochasticity is used. PyTorch guidance: https://docs.pytorch.org/tutorials/beginner/saving_loading_models.

### 6.5 Event example (share this schema between everyone)

```json
{
  "id": "uuid",
  "job_id": "uuid",
  "event_type": "RESCUE_STARTED",
  "timestamp": "2026-11-07T20:00:00Z",
  "worker_id": "laptop-b",
  "epoch": 2,
  "payload": {
    "trigger": "heartbeat_timeout",
    "last_good_step": 120,
    "checkpoint_sha256": "hex-string",
    "candidate_backup": "laptop-b"
  }
}
```

Use shared enums in Python and a TypeScript mirror or generated JSON Schema. **Do not invent numbers or statuses on the frontend**; every visible metric must trace to an event or worker report.

## 7. Exact training workload and proof of continuity

### 7.1 CPU model

Create a deterministic regression task with X shaped `(1024, 32)` and target y generated from a fixed random linear transform plus noise. Seed all generation and use CPU only. Use:

```python
model = torch.nn.Sequential(
    torch.nn.Linear(32, 64),
    torch.nn.ReLU(),
    torch.nn.Linear(64, 1),
)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = torch.nn.MSELoss()
```

Default job: **400 steps**, mini-batches of 64, explicit step delay optional `DEMO_STEP_DELAY_MS=120` to make the UI watchable. The seed, dataset generation recipe, model shape, optimizer and step index must match on both laptops. Do not download large public datasets; eliminate Wi-Fi dependence from the training itself.

### 7.2 Checkpoint content

```python
checkpoint = {
    "schema_version": 1,
    "job_id": str(job_id),
    "step_completed": int(step),
    "seed": seed,
    "model_state_dict": model.state_dict(),
    "optimizer_state_dict": optimizer.state_dict(),
    "torch_rng_state": torch.get_rng_state(),
    "config": {"input_dim": 32, "hidden_dim": 64, "lr": 0.001, "total_steps": 400},
    "latest_loss": float(loss.item()),
}
```

If using random batch selection, either derive batch indices purely from the completed step and seed or save the generator state. On resume, instantiate the same model and optimizer, restore both state dictionaries and RNG, and continue **from `step_completed + 1`**. A checkpoint step describes the *last completed* step, not the next step to execute.

### 7.3 Success tests

- `uninterrupted_run`: train for 100 steps; record final parameters and loss.
- `restart_same_machine`: train 60, save, load, then train 40; final parameters should match uninterrupted control to configured tolerance on same environment.
- `resume_second_machine`: A trains, uploads, B downloads and resumes with pinned CPU versions; B's first step must be exactly after checkpoint's completed step.
- `hard_kill`: kill A **without** an on-demand final checkpoint. B must resume from last remote commit (some work is lost; display exact step loss).
- `graceful_thermal_rescue`: trigger warning; A saves latest checkpoint, releases lease, B resumes with minimal gap.
- `checkpoint_corruption`: mutate one byte; verification must reject and fall back, never load silently.

### 7.4 Metrics to show judges

- `last_confirmed_checkpoint_step`
- `last_step_completed_on_A`
- `first_step_completed_on_B`
- `work_lost_steps = last_step_completed_on_A - last_confirmed_checkpoint_step` (only if last A step is known; otherwise display unknown)
- `recovery_time_ms = B_first_progress_at - incident_detected_at`
- `rescue_time_to_start_ms = B_started_at - incident_detected_at`
- `checkpoint_age_s`, `checkpoint_size_kb`, `sha256_verified=true`
- `loss_before` and `loss_after` with a visually continuous chart and a vertical event marker
- Report savings in **CPU training steps/seconds actually preserved**. Never claim measured GPU-hours or dollar savings from this CPU prototype; illustrative business scenarios must be explicitly hypothetical.

## 8. Risk-aware rescue logic (innovative but safely constrained)

Implement **deterministic policy first**:

| Risk band | Trigger | Checkpoint every | Controller behavior |
|---|---|---|---|
| GREEN | Healthy heartbeat/temp | 20 steps | Normal job, no interruption. |
| YELLOW | One elevated temperature reading / fan warning | 5 steps | Increase checkpoint frequency, preflight backup and send low-priority operator note. |
| RED | Sustained high sensor reading / physical emergency button | Immediately checkpoint if A responds | Request controlled handoff; B waits for verified commit then claims. |
| BLACK | A process missing / lease expired | No new A checkpoint available | B resumes from last valid remote checkpoint. |

Sensor thresholds must be explicitly configurable, with hysteresis/sustained-reading checks. A warm hand near a sensor is a demo input, not a real data center safety certification. If no temperature module exists, the `hardware simulator` produces the same normalized events. Include a visible "SIMULATED" label whenever injection is used.

**Optional innovative stretch:** estimate expected lost work as `checkpoint_interval * mean_step_seconds / 2` under an assumed uniformly random failure instant; compare estimated loss to checkpoint upload cost. This is a *toy optimization* with stated assumptions, not a validated failure predictor. Use it to justify why checkpoint cadence changes under risk.

## 9. Nemotron agent: beyond a chatbot

### 9.1 Exact role

Nemotron acts as **Incident Investigator and Recovery Planner**. It may call read-only diagnostic tools, consult a concise runbook, and propose structured actions. The controller validates and executes only supported action types based on deterministic policies. Never let the LLM run arbitrary shell commands or execute unrestricted Python.

### 9.2 Tool functions (implement with validated typed arguments)

- `get_job_status(job_id)` → owner, step, lease, risk state, current worker
- `get_worker_health(worker_id)` → last heartbeat, temperature trend, RAM, availability
- `list_verified_checkpoints(job_id, limit=5)` → hashes, sizes, committed steps, ages, validation status
- `estimate_recovery(job_id, target_worker_id)` → checkpoint age, expected resume step, candidate readiness, estimated loss/recovery time (with assumptions)
- `get_incident_events(job_id, since)` → timeline
- `read_runbook(topic)` → approved response rules
- `propose_rescue_plan(job_id, reason, backup_worker_id)` → structured proposal; **proposal is NOT the authority to execute**
- `record_incident_note(incident_id, text)` → append-only sanitized note, authorized action

### 9.3 Agent loop

1. Receive `RISK_DETECTED` or `A_UNREACHABLE` incident.
2. Nemotron identifies which evidence it needs and calls 2–4 actual diagnostic tools.
3. Return a validated JSON object:

```json
{
  "incident_id": "uuid",
  "summary": "Primary worker stopped reporting; latest remote checkpoint is step 120.",
  "root_cause_hypotheses": [{"cause": "worker_process_crash", "confidence": "medium", "evidence": ["heartbeat gap"]}],
  "recommended_action": "RESUME_ON_BACKUP",
  "backup_worker_id": "laptop-b",
  "checkpoint_id": "uuid",
  "verification_steps": ["verify artifact hash", "confirm new epoch", "observe 3 new steps"],
  "operator_message": "Workload resumed on Laptop B from step 120."
}
```

4. Validate against a strict Pydantic schema and a finite allowlist (`EXPLAIN`, `CHECK_BACKUP`, `RECOMMEND_RESUME`, `REQUEST_APPROVAL`, `NO_ACTION`).
5. Controller independently checks that checkpoint is valid, lease can be acquired, and backup is ready; it does not blindly trust plan fields.
6. Agent inspects post-rescue data and writes a verification summary.

Keep model ID/config in `NVIDIA_MODEL`, with `NVIDIA_API_KEY` in environment; default hosted endpoint `https://integrate.api.nvidia.com/v1` per NVIDIA's published reference. Implement a deterministic `FakeNemotron` for tests and offline demo; UI labels fake responses.

### 9.4 Runbook guardrails

- A backup with no validated checkpoint must **not** claim it restored work.
- Never interrupt a healthy worker solely because the model speculates there might be danger.
- Escalate for human review when confidence/data quality is low.
- Workload safety and recovery operate without Nemotron if its API fails.
- Log tool calls, input IDs, durations and decisions (redact credentials and phone numbers).

## 10. Photon 2.0: real two-way operator participation

Photon is **not** just a one-way SMS alert. Build a dedicated operations conversation.

### Required interaction

- At risk: `LIFERAFT: Cooling warning on A. Checkpointing increased. Last safe step: 115.`
- At rescue: `LIFERAFT: A stopped reporting. B is recovering from verified checkpoint 120.`
- On success: `LIFERAFT: Recovery complete. Job running on B at step 125. Reply STATUS, WHY, CHECKPOINT, ACK.`
- Incoming `STATUS` → query real job state; reply with owner, step, risk, checkpoint.
- Incoming `WHY` → summarize Nemotron's evidence-based incident report; explain what is observed vs inferred.
- Incoming `CHECKPOINT` → answer latest **verified** checkpoint age/step.
- Incoming `ACK` → persist operator acknowledgement with timestamp and incoming message ID.

### Photon implementation constraints

- Photon 2.0 Beta API base `https://api.photon.codes`, version `/v1` and bearer project key. Use project-scoped key when possible. Source: https://photon.codes/docs/beta/api-reference.
- Users, Spaces and Messages are first-class entities. Source + sample: https://photon.codes/blog/introducing-photon-2.0.
- Use `idempotency-key` on sends so retry does not duplicate messages. Store Photon message ID and track `dispatched` vs actual `delivered`/`failed`; do not claim delivered from a 202 alone.
- The Photon beta supports text/images on iMessage; advanced reactions/polls are not guaranteed. Plain text commands only.
- For **incoming messages**, prefer an outbound event-delivery WebSocket client on Laptop B if supported by the team account and current documented endpoint (this avoids a public webhook and campus inbound restrictions). Otherwise implement a **public HTTPS webhook in a hosted Edge Function**, verify Standard Webhooks signature, dedupe incoming message IDs, and write a command event for B to poll. NEVER run an unauthenticated local webhook listener and assume Photon can reach it.
- Keep `PHOTON_TRANSPORT=fake|socket|webhook` and `PHOTON_CHANNEL=imessage|telegram|email|...` configurable; test the available channel early. Some channels need phone/domain compliance. Use the simplest channel the team can actually provision; do not pretend all channels are instantly available.
- The Photon official Beta docs are authoritative for concrete endpoints, payloads, and websocket authentication. Do not borrow similarly named unrelated "Photon" APIs or older Photon Stable APIs by accident.

### Helpful current sources

- https://photon.codes/docs/beta
- https://photon.codes/docs/beta/api-reference
- https://photon.codes/blog/your-dify-agent-can-now-answer-on-imessage-whatsapp-and-telegram-using-photon

## 11. Hardware interface — implement software before checkout

Your confirmed current inventory: **two laptops**, one Arduino board with wires, two incomplete beginner kits, a Raspberry Pi 2 (no Ethernet cable), one 64 GB microSD card, and a microSD card reader. No sensors or modules are guaranteed yet. **Do not require the Raspberry Pi.**

Define a normalized internal event contract independent of board choice:

```json
{"source":"arduino-usb","type":"TEMPERATURE","sequence":12,"temperature_c":27.4,"timestamp":"2026-11-07T20:10:00Z"}
{"source":"arduino-usb","type":"EMERGENCY_BUTTON","sequence":13,"pressed":true,"timestamp":"2026-11-07T20:10:04Z"}
```

Phase 1–5: Implement a **software fault-injection adapter** that emits the same events. Later Arduino/ESP32 integration only swaps the adapter. USB serial (via `pyserial`) connected to **Laptop B** is the simplest and most reliable path on isolated campus Wi-Fi. An ESP32 Wi-Fi board is optional; do not make it a requirement.

Expected later hardware: one DS18B20 or DHT11/DHT22 sensor, breadboard, jumper wires, one tactile emergency button, 3 LEDs with resistors, optional OLED and buzzer. Do not cut laptop power or stop its internal fans. A separate low-voltage DC fan can be an optional visual prop only with appropriate electrical protections.

Debounce button presses; reject implausible telemetry; cap event rate. Track hardware availability and gracefully fall back to simulated sensor mode.

## 12. Frontend: memorable and evidence-driven, not fake analytics

**One-screen "mission control"**, dark theme with intentional red/amber/green state (accessible contrast). This is a working operator console, not decorative sci-fi filler.

Sections:
1. **Twin-node view:** `LAPTOP A / LAPTOP B` cards; live worker heartbeat age, step, role, epoch, temperature/risk and network state.
2. **Training continuity chart:** real loss-vs-step points from A and B in different line styles; shade the recovery gap; vertical incident and checkpoint markers. No fabricated smooth values.
3. **Rescue sequence:** "Sensor warning → checkpoint committed → worker unavailable → lease transferred → checkpoint verified → new training step." Each stage driven by a recorded event.
4. **Checkpoint chain:** last 5 checkpoints with step, age, object integrity (hash), size and current selected recovery point.
5. **Rescue scoreboard:** real recovery time, retained steps and known lost steps. Show unknowns honestly.
6. **Operator transcript:** Photon sends/receives and acknowledgement, with delivery state.
7. **Demo controls:** clearly labeled `INJECT COOLING WARNING`, `SIMULATE WORKER CRASH`, `RESET DEMO`; hide/control behind local dev mode, not public anonymous writes.
8. **Evidence drawer:** raw event IDs, checkpoint hashes and agent tool-call audit. Judges can verify the system isn't making up facts.

Use a single shared source of truth; Next.js reads authenticated cloud data (or local adapter during development), not mock data after Phase 4. Use a skeleton/loading state, reconnect status and stale-data warning.

## 13. Phase-by-phase execution plan

**Phase order is mandatory; parallel tracks only after contracts stabilize.** Each phase below ends with a demonstrable artifact.

### PHASE 0 — Repo, definitions, network spike (Priority P0)

**Goal:** Make the team and Codex productive without guessing about the environment.

Tasks:
- Create repo structure, `pyproject.toml`, pinned deps, Ruff/Pytest, Next.js scaffold, `.env.example`, `.gitignore`, `PROGRESS.md`.
- Implement shared `JobStatus`, `WorkerHeartbeat`, `CheckpointManifest`, `RescueEvent`, `HardwareEvent` as Pydantic models with schema export for TS.
- Implement `liferaft doctor`: Python/PyTorch version, hostname, CPU, HTTPS connectivity, Supabase project reachability (if configured), storage upload/delete small probe, Photon/NVIDIA key presence (no secret printing), detected serial ports. Do not error if optional credentials are absent.
- Implement a `CoordinationStore` interface with `LocalStore` and stub `SupabaseStore`.
- Record all unknowns in `docs/risk-register.md` and assumptions in README.

**Acceptance:** `pytest` and `ruff check` run; `liferaft doctor` prints clear network findings and the project can run with `MODE=local` and no credentials.

### PHASE 1 — Real CPU training, atomic checkpoint, exact resume (Priority P0)

Tasks:
- Implement seeded synthetic regression dataset and PyTorch model per Section 7.
- CLI: `python -m liferaft.cli train --job-id demo --steps 400 --checkpoint-every 20 --data-dir ./data/A`.
- Save atomic local checkpoints; include optimizer state and completed step; verify SHA-256.
- Implement `--resume <path>`; log one JSON line per completed step, include loss and timestamp.
- `tests/test_checkpoint_resume.py`: compare uninterrupted run to resumed run; use deterministic tolerance and ensure no restart at step zero.

**Acceptance:** Kill and restart **on one laptop**; resume at exact next step, preserve optimizer state, final loss matches control.

### PHASE 2 — Two processes + local coordinator, crash simulation (Priority P0)

Tasks:
- Build two separate worker directories/processes on one machine (`MODE=local`) using `LocalStore` to simulate remote object store and leases.
- Heartbeat every 2s, lease TTL 8s; only current owner can mark a new checkpoint.
- `liferaft demo --local`: launches primary/standby as subprocesses and records incident timeline.
- `scripts/inject_failure.py --mode kill-primary`: terminate **training process**, not the user's laptop.
- Standby detects timeout, validates last committed artifact, claims a new epoch, resumes.
- Add fault scenarios: normal handoff, abrupt kill, corrupted newest checkpoint, duplicate claims.

**Acceptance:** One command demonstrates autonomous failover with measured recovery time and no fabricated checkpoint. Tests pass locally with no internet.

### PHASE 3 — Cloud relay that works despite campus Wi-Fi (Priority P0)

Tasks:
- Team creates a Supabase project, private storage bucket, and a dedicated demo Auth account (manual setup documented).
- Implement Postgres migration with jobs, workers, checkpoints, incidents, events, operator actions; RLS and indexes.
- Implement atomic RPC `try_claim_job` and epoch-aware `renew_lease` / `commit_checkpoint` methods; authorization rules per Sections 6.2–6.4.
- Implement `SupabaseStore`: upload artifact to unique private path; commit metadata only after uploaded; B download and SHA-256 verify. Retry network calls with capped backoff and idempotency. Checkpoint credentials never go into browser source.
- On **two real laptops**, connect to same Supabase project over HTTPS. Do not configure direct IP transfer. `liferaft doctor` confirms each can access the project.
- A runs `liferaft worker --role primary --worker-id laptop-a`; B runs `liferaft worker --role standby --worker-id laptop-b`; B manages/resumes after A fails.
- If direct connectivity is impossible and Supabase is inaccessible, use a controlled hotspot. Do not quietly switch to fake data.

**Acceptance:** Both laptops can be on campus Wi-Fi without contacting each other's local IP. Kill A's worker; B downloads last remotely committed checkpoint and resumes. `checkpoint_sha256_verified=true`, epoch increased. `test_claim_race` proves only one concurrent claimant succeeds at the cloud DB level.

### PHASE 4 — Failure policy, risk-adaptive checkpointing, continuity metrics (Priority P0/P1)

Tasks:
- Add risk engine Green/Yellow/Red/Black with simulated cooling input and heartbeats.
- Normal checkpoint every 20 steps, warning every 5, emergency immediately when cooperative; optional rework-cost estimate with stated assumptions.
- Add process state observations, backup health preflight, grace period handling, controlled handoff and abrupt crash modes.
- Calculate `recovery_time_ms`, `checkpoint_age_s`, `lost_steps` when known, and `safe_steps_retained`.
- Persist event log with full causality and event IDs.

**Acceptance:** A hardware-simulated warning increases checkpoint frequency; controlled transfer preserves newer progress than an abrupt crash under the same schedule. Show raw evidence.

### PHASE 5 — Judge-friendly live console (Priority P0/P1)

Tasks:
- Build the single-screen Next.js dashboard in Section 12.
- Use the authenticated Supabase client and RLS (or B-hosted restricted proxy if needed); no service-role key in browser.
- Add real-time/polling data source, incident timeline and loss chart. Add labeled fault injection controls in development mode.
- Handle stale data, reconnecting, no worker, upload in-progress, and lack of valid checkpoint.
- Add a `Demo Reset` action that archives previous incident events and starts a new job ID, never erases evidence during judged demo.

**Acceptance:** One judge can understand A→B transfer by watching the chart, checkpoint chain, timeline and measured time; no fake green statuses.

### PHASE 6 — Real Nemotron tool-using investigation (Priority P0 for NVIDIA)

Tasks:
- Implement `NemotronAgent` with documented NVIDIA OpenAI-compatible API, secrets in environment.
- Register and exercise actual diagnostic tools from Section 9. Tests use recorded tool output fixtures and a fake adapter.
- Ask model for a structured recovery recommendation and evidence IDs; validate with Pydantic; never permit direct shell commands.
- Add post-action verification run using real progress data.
- Show each tool invocation in UI incident evidence drawer (e.g., `get_worker_health → list_verified_checkpoints → estimate_recovery → recommend`).

**Acceptance:** In real mode, logs prove at least two **real tool calls** with live state; model explains observed evidence and proposes a safe plan; recovery still works with `NVIDIA_API_KEY` missing.

### PHASE 7 — Photon 2.0 real two-way operations (Priority P0 for Photon)

Tasks:
- Create/verify Photon 2.0 Beta project and one working channel on team account. Use current docs and minimal send test **before** full integration.
- Implement real outbound messages with idempotency keys and delivery status.
- Implement incoming `STATUS`, `WHY`, `CHECKPOINT`, `ACK`, `HELP` with sender allowlist and dedupe.
- Prefer documented outbound WebSocket event listener from B; if unsupported, configure verified secure hosted webhook in Supabase Edge Functions. No assumption of inbound campus connectivity.
- Bind `WHY` to actual Nemotron incident summary with factual guardrails.

**Acceptance:** An engineer receives a real alert on a phone; replies `STATUS`; receives real step/worker; replies `ACK`; dashboard shows acknowledged timestamp. Record screenshots/short video only with consent; never expose phone numbers in public repo.

### PHASE 8 — Arduino/ESP32 and physical proof (Priority P1)

Tasks:
- Implement `hardware.simulator` now (a button/CLI event matching serial schema).
- When hardware arrives, connect Arduino via USB to Laptop B; read button/sensor over serial; handle reconnect/debounce and emit normalized event.
- Optional: ESP32 posts sensor events over outbound HTTPS if Wi-Fi provisioning works, otherwise stay with USB. Optional OLED shows `NORMAL`, `RISK`, `RESCUING`, `SAFE ON B` based on acknowledged backend messages.
- Label simulated vs observed sensor events in UI.

**Acceptance:** Physical button produces real event; core rescue and checkpoint verification run; software still passes if USB cable is unplugged or no board is present.

### PHASE 9 — Hardening, presentation and submission (Priority P0)

Tasks:
- Run `pytest -q`, `ruff check`, `npm run build`, full end-to-end tests.
- Conduct at least three consecutive recovery demos. Save logs and metrics in `docs/demo-runs/` with redacted secrets.
- Test hard kill, graceful rescue, corrupt checkpoint fallback, cloud timeouts, Photon failure, Nemotron failure, two contenders and stale lease.
- Produce `docs/demo-script.md` (60–90-second demo), architecture diagram, sponsor mapping, README setup, QR code to demo, and short backup video **of an actual working run**.
- Prepare submission before the 11 PM initial deadline and final deadline 12 PM Sunday; verify actual current hackathon instructions on-site.

**Acceptance:** Team can run a reliable 3-minute judge story, explain the limits and showcase tool-call logs, phone conversation, and checkpoint integrity.

## 14. Config, CLI and commands to build toward

`.env.example` (placeholders only):

```dotenv
LIFERAFT_MODE=local             # local | cloud
LIFERAFT_ROLE=primary           # primary | standby
LIFERAFT_WORKER_ID=laptop-a
LIFERAFT_JOB_ID=demo-job
LIFERAFT_STEP_DELAY_MS=120
LIFERAFT_CHECKPOINT_EVERY=20
LIFERAFT_HEARTBEAT_SECONDS=2
LIFERAFT_LEASE_SECONDS=8
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_DEMO_EMAIL=
SUPABASE_DEMO_PASSWORD=
SUPABASE_BUCKET=liferaft-checkpoints
NVIDIA_API_KEY=
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
PHOTON_API_KEY=
PHOTON_PROJECT_ID=
PHOTON_AGENT_USER_ID=
PHOTON_OPERATOR_HANDLE=
PHOTON_PLATFORM=imessage
PHOTON_TRANSPORT=fake
ARDUINO_SERIAL_PORT=
```

**Replace credentials in `.env` on each laptop; never commit `.env`.** Choose one consistent project configuration and document how both laptops identify the same job ID.

Desired commands after implementation:

```bash
# Phase 0 — initial setup
uv sync
uv run pytest -q
uv run liferaft doctor

# Phase 1 — standalone real training
uv run liferaft train --steps 400 --checkpoint-every 20 --data-dir ./data/A

# Phase 2 — full local simulator
uv run liferaft demo --local --scenario hard-crash

# Phase 3 — hosted relay, execute on A
uv run liferaft worker --role primary --worker-id laptop-a --mode cloud

# Phase 3 — hosted relay, execute on B
uv run liferaft worker --role standby --worker-id laptop-b --mode cloud

# Phase 5 — dashboard
cd web && npm install && npm run dev

# Phase 9 — validation
uv run pytest -q
uv run ruff check .
cd web && npm run build
```

These are **target CLIs for Codex to implement**, not commands that exist before coding. Codex may change exact flags but must update this document and README to match.

## 15. Test matrix and acceptance thresholds

| Test ID | Scenario | Must happen |
|---|---|---|
| T01 | Load valid checkpoint | Resume at saved step + 1, optimizer state restored. |
| T02 | Same-environment reproducibility | Control and resumed run produce equivalent final weights/loss within tolerance. |
| T03 | Abrupt A-process kill | After lease timeout B resumes from last committed checkpoint, not last A-local checkpoint. |
| T04 | Cooperative thermal handoff | A saves newer checkpoint; B verifies and resumes. |
| T05 | Corrupted newest checkpoint | Hash rejection, try older committed artifact, log loss transparently. |
| T06 | Two simultaneous standby claimants | Exactly one job claim in a single epoch succeeds. |
| T07 | A comes back with stale epoch | A refuses to continue the old job. |
| T08 | Cloud HTTPS unavailable | Pause/mark degraded, do not claim unverified recovery; local simulator still works separately. |
| T09 | Nemotron API unavailable | Core recovery succeeds; agent status shows unavailable, not success. |
| T10 | Photon API unavailable | Core recovery succeeds; queue/record alert delivery failure. |
| T11 | Replayed incoming Photon message | No duplicate `ACK` or duplicate rescue command. |
| T12 | Sensor repeats / noisy readings | Button debounce; risk hysteresis; no storm of duplicate incidents. |
| T13 | Browser refresh during demo | Dashboard reconstructs truthful state from cloud/events. |
| T14 | Network isolation | A and B perform successful rescue with no inbound peer connection on campus Wi-Fi. |

**Minimum viable before judging:** T01, T03, T05, T06, T08, T09, T10, T14 should be demonstrably reliable. Phase 7/8 sponsor requirements additionally need real Photon + hardware when available.

## 16. Demo storyboard: the WOW moment

**0:00–0:20** — Show two labeled laptops and one live chart. "AI training has been running. We protect progress, not just hardware."

**0:20–0:35** — Point out the backup is idle and a verified checkpoint is stored remotely (step, hash, age).

**0:35–0:45** — Press the physical emergency button for controlled mode **or** kill the primary worker process for hard-crash mode. Show telemetry and event live.

**0:45–1:05** — Watch live timeline: A unhealthy → lease expires → B claims epoch → artifact SHA-256 verified → training continues. Highlight real loss curve reconnecting across the discontinuity.

**1:05–1:25** — Photon sends a real text; operator replies `WHY`; message returns incident evidence.

**1:25–1:45** — Open Nemotron investigation audit: multiple tools, evidence grounded in checkpoint/heartbeat data, verification after recovery. Explain adaptive checkpointing reduces lost progress when risk rises.

**1:45–2:10** — Show outcome metrics: "Recovered from step X, only Y steps lost, took Z seconds," with readings from current test, not predefined numbers.

**Remaining pitch time** — Why NMC² would benefit (GPU customers' valuable training progress; fleet operations), limits (checkpoint-aware jobs), existing competition (schedulers/checkpointing exist), and differentiated integration (physical risk → preemptive checkpoint cadence → verified continuity → AI & two-way humans).

Bring a backup **recording of a genuine successful run**, not a prerecorded fake demo. Do not depend on a working phone signal for the core recovery to function.

## 17. Risk register and mitigation

1. **School Wi-Fi client isolation:** use Supabase HTTPS cloud relay; no direct peer connection.
2. **Supabase signup/RLS setup takes too long:** implement end-to-end local mode first; use Supabase setup checklist; reduce schema to essential rows but never skip ownership checks.
3. **Free storage/upload quota:** keep model small, immutably store limited checkpoints, retention/pruning only after successful rescue; monitor quota.
4. **Lease race/split-brain:** server-side atomic claims + epoch fencing + owner pauses when control plane unavailable; label non-production limitation.
5. **Python version differences between laptops:** pin lockfile and CPU PyTorch versions, fixed dataset seed/shape, validate checkpoint schema.
6. **Photon provisioning/account restrictions:** select any real supported messaging channel, test a single send early; fake transport for tests and record authentic failure reasons.
7. **Nemotron token limits/API errors:** configure timeouts and 1 retry; fall back to deterministic report without pretending LLM succeeded.
8. **Hardware shortage:** serial simulator; Arduino USB to B; two laptop core remains full-value demo.
9. **Over-scoping:** finish actual checkpoint transfer before styling, voice, predictive modeling, QR codes, or extra sponsor tracks.
10. **Academic / privacy:** do not copy university network configurations, disclose credentials, or send personally identifying incident logs to public dashboards; anonymize demo workers.

## 18. Codex work tickets — first actions, in order

Start now, without waiting for hardware or sponsor API keys:

- [ ] C00: Scaffold Python `uv` project, CLI, typed models, test harness, README and `PROGRESS.md`.
- [ ] C01: Implement deterministic PyTorch regression training with CLI progress output.
- [ ] C02: Implement atomic checkpoint serializer, SHA-256 verifier, schema version and optimizer restore.
- [ ] C03: Unit test: uninterrupted 100 steps vs resume 60+40.
- [ ] C04: Implement coordinator interfaces and local adapter with transactional-like ownership lock.
- [ ] C05: Launch two local processes with fault injection, lease, checkpoint transfer and standby resume.
- [ ] C06: Add event log, metrics and a reproducible CLI demo run; save truthful output logs.
- [ ] C07: Create Supabase schema migration and RLS test plan; add cloud adapter when credentials supplied.
- [ ] C08: Implement real campus-Wi-Fi-safe two-laptop rescue using outbound HTTPS only.
- [ ] C09: Add risk policy/adaptive intervals and physical event simulator.
- [ ] C10: Create dashboard with real events, loss curve and integrity panel.
- [ ] C11: Add NVIDIA tool-calling agent and strict structured plan schema.
- [ ] C12: Add Photon 2.0 send/receive with secured command handling.
- [ ] C13: Connect Arduino sensor input when hardware available.
- [ ] C14: E2E reliability pass + judge demo script + sponsor evidence.

**Handoff checkpoint after C03:** The team should already be able to answer: *Does a real model resume from the exact stored progress?* If no, stop and fix before cloud or frontend work.

## 19. Human setup checklist (cannot be done silently by Codex)

- Create/open a shared Git repository (or initialize local repo).
- Confirm OS of Laptop A/B, installed Python versions, and ability to run PyTorch CPU.
- Confirm outbound HTTPS to Supabase from both campus Wi-Fi sessions. If blocked, use hotspot.
- Create a Supabase project + one dedicated Auth demo user + private storage bucket; configure RLS and RPC from migrations. Do not post API secrets in chat or source control.
- Acquire NVIDIA hosted Nemotron credential and verify one real call.
- Create Photon 2.0 Beta project, enable one usable messaging channel, create project key, send one real message, determine working inbound event method.
- When hardware arrives, identify exact Arduino board, serial port, available sensor module, and wiring. Never assume a module that isn't physically present.

## 20. Reference documentation (checked November 7, 2026)

- HackUTD 2026 schedule: https://zeroday.hackutd.co/
- MLH previous HackUTD event (2025): https://www.mlh.com/events/hackutd-ae
- MLH previous event prize listing (2025): https://www.mlh.com/events/hackutd-ae/prizes
- NVIDIA hosted Nemotron model/API: https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b/deploy
- NVIDIA Nemotron models: https://developer.nvidia.com/topics/ai/Nemotron
- Photon 2.0 Beta API: https://photon.codes/docs/beta/api-reference
- Photon 2.0 onboarding: https://photon.codes/docs/beta
- Photon platform post and request examples: https://photon.codes/blog/introducing-photon-2.0
- Photon events/Dify guide: https://photon.codes/blog/your-dify-agent-can-now-answer-on-imessage-whatsapp-and-telegram-using-photon
- PyTorch saving/loading: https://docs.pytorch.org/tutorials/beginner/saving_loading_models
- Supabase Postgres functions / RPC: https://supabase.com/docs/guides/database/functions
- Supabase storage signed upload URL: https://supabase.com/docs/reference/python/storage-from-createsigneduploadurl
- Supabase storage upload to signed URL: https://supabase.com/docs/reference/python/storage-from-uploadtosignedurl
- Supabase Edge Function auth headers: https://supabase.com/docs/guides/functions/auth-headers
- Supabase storage upload caveats: https://supabase.com/docs/guides/storage/uploads/standard-uploads

**Reminder:** API docs and pricing are live; Codex should check exact installed SDK signatures and active credentials before calling an endpoint. The architecture and success criteria above are requirements, not proof a service was already configured.

---

# Immediate Codex instruction

**Implement PHASE 0 and PHASE 1 now.** Read this specification and `AGENTS.md`. Initialize the project, create the deterministic PyTorch training loop, save versioned atomic checkpoints including model and optimizer states, implement reload from checkpoint, add tests proving identical continuity after resume, and demonstrate execution entirely locally with no APIs or hardware. Update `PROGRESS.md` with concrete commands, tests and outcomes. Do not start UI mockups or external integrations until the resume test passes. When Phase 1 is complete, report changed files, exact commands used, test results, and the remaining blockers for Phase 2.
