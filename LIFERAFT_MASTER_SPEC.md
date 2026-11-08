# LIFERAFT — Complete Product + Engineering Master Specification (v2.0)

**Audience:** Codex implementing the product; student operators new to cloud infrastructure, ML training, APIs, embedded electronics and recovery systems.  
**Status:** Full implementation requirements; not a claim that any features are already implemented.  
**Related files:** `AGENTS.md`, `INTEGRATION_CONTRACTS.md`, `TEAM_SETUP_GUIDE.md`, `HARDWARE_SAFETY_AND_WIRING.md`, `TEST_MATRIX.md`, `PHASE_TRACKER.md`, `SPONSOR_ALIGNMENT.md`.

## 0. Decision summary: build this specific project

**LIFERAFT = physical-to-digital compute rescue.** A small real AI-training workload runs on the Raspberry Pi 5 or Laptop A. It saves periodic, portable, cryptographically checked checkpoints to private storage. An independent ESP32-S3 sensor board measures nearby temperature and takes a physical button signal. A trusted deterministic policy assesses equipment telemetry, risk, checkpoint age, and backup availability. When the team injects an emergency, it safely preempts the primary worker *in software*, transfers ownership to a healthy secondary computer, and resumes from the last verified saved state. An NVIDIA Nemotron agent investigates the incident with typed tools and assembles a documented explanation and next steps. Photon sends actual two-way operator communications. The operator console displays **measured** recovery outcomes and an auditable evidence chain.

This is neither an arbitrary running-process migrator nor an actual production safety system. We only support a checkpoint-aware application; failover loses at most the progress since the most recently **committed and verifiable** checkpoint. A simulated cooling emergency is not a real cooling failure. The demo must label these truths prominently.

### The pitch in plain English

"Most systems warn you when a server is in danger. LIFERAFT saves what the server was working on and helps another computer continue the job. Our physical sensor board detects an emergency, our controller selects a safe backup and verifies the saved progress, Nemotron investigates what happened, and Photon keeps the on-call engineer in the loop. We can prove how much work we saved, how quickly we recovered, and exactly what was transferred."

### What makes this worth showing to NMC²

- **Physical observability → actual action:** Sensor and Pi CPU telemetry change job-protection policy, not just an LED dashboard.
- **Evidence-based continuity:** A real training run resumes on different hardware, with SHA-256 checkpoint verification, model/optimizer/RNG state, and plotted real losses.
- **Proactive risk preparation:** When a measured risk indicator rises, the controller can shorten checkpoint intervals; actual workload transfer occurs only under explicit policy or a test-trigger with guardrails.
- **Human-in-loop coordination:** A Nemotron tool agent collects evidence and plans a response; Photon exchanges real operator messages with confirmation and contextual answers.
- **Low assumptions about networking:** Uses independent outbound HTTPS instead of assuming campus devices can ping each other.

## 1. Hardware the team actually has

| Item | Role in LIFERAFT | Limitation / safety note |
|---|---|---|
| 1 Raspberry Pi 5 | Preferred primary compute worker; reads its own CPU temperature, reports heartbeat and checkpoints | CPU-only demo; official 27W power; prevent thermal stress; verify OS/ARM package compatibility |
| 1 fan, type **unverified** | Pi cooling **only if verified as compatible**; otherwise just a loose accessory | Never turn off, unplug or modulate Pi's fan to inject faults; never connect unknown-voltage fan to GPIO |
| 27W official Pi USB-C supply | Dedicated supply for Pi 5 | Use directly; do not route through relay |
| micro-HDMI-to-HDMI | Optional Pi display during setup | Headless SSH is allowed; display/keyboard not assumed |
| USB-C-to-USB-C cable | May connect devices if connector/support verified | Do not assume the ESP32 has a USB-C port; inspect it |
| ESP32-S3-DevKitC-1 | **Primary independent sensor board**; reads DS18B20+button; drives OLED over I2C; USB serial to control laptop | 3.3V GPIO only; identify board revision and correct port |
| Arduino Uno + breadboard | Backup microcontroller, breadboard | Uno can replace ESP32 if port/driver fails; Uno 5V signals must never connect directly to ESP32 |
| DS18B20 temperature sensor | Measures nearby/local ambient temperature | **Not Pi CPU temperature**; bare sensor needs pull-up resistor and verified pin orientation |
| SSD1306 0.96in OLED | Hardware status: normal/at-risk/rescuing/resumed | Verify exact I2C/SPI variant, voltage range, address 0x3C or 0x3D |
| Button | An explicitly **injected** risk event | Wire to GPIO with `INPUT_PULLUP`, active low; debounce |
| Relay module | **Not used in core demo** | Do not switch the Pi, fan, laptops, mains, or chargers; no automatic relay energization |
| Jumper wires | Low-voltage sensor wiring | Keep short and strain-relieved |
| 2 laptops | One backup worker; one control station/dashboard (roles configurable) | Must not require direct peer-to-peer LAN reachability |
| 64GB microSD + card reader from prior inventory | Pi 5 OS and code | Human must confirm these still exist; never overwrite an unknown card |

### Preferred physical arrangement

- **Pi 5:** `worker-pi-primary`, a genuine CPU-based training worker, boots Raspberry Pi OS 64-bit from known 64GB microSD. Data and job logic are identical to backup worker where dependencies permit. It connects to cloud coordinator **outbound** via HTTPS, not by exposing an inbound port.
- **Laptop A:** `worker-laptop-standby`, stays ready; fetches the last verified checkpoint and executes the same PyTorch model on CPU after safe lease transfer.
- **Laptop B:** operator station with Next.js console, CLI / serial gateway for ESP32, controls test injections, and runs diagnostic Nemotron/Photon integrations. Hosted coordinator still owns authoritative state.
- **ESP32:** USB serial into Laptop B; local DS18B20 and button; OLED reads authoritative incident state sent back over USB. It operates even if Pi workload process crashes because it does not depend on Pi process or Pi GPIO.

**Fallback A — Pi cannot reliably run PyTorch:** Laptop A becomes primary, Laptop B standby; Pi reports genuine CPU/health telemetry as a third infrastructure node; ESP32 still supplies physical events; web console can run on either laptop and the cloud remains authoritative. Clearly label which worker actually executed training. **Fallback B — Pi is temporarily unavailable:** two-laptop real failover plus ESP32. **Fallback C — cloud unavailable:** same-machine local simulator/test adapter only; label distributed recovery not demonstrated until cloud works.

Codex must discover actual Pi CPU architecture, RAM, Python, pip wheel availability, and network access; do not ask the human team to choose an ARM compatibility strategy.

## 2. Sponsor challenge coverage

### NMC² — Keep the World Running

**Prompt text from the user's sponsor-sheet screenshot:**

> Mission: Keep the World Running
>
> Behind every AI model, streaming service, and cloud application is a data center—and a team keeping it running around the clock. A missed warning, an unclear handoff, or the wrong information at the wrong time can turn a small issue into a major disruption.
>
> NMC² challenges you to build a solution that helps data center teams stay one step ahead.

**Our concrete response:** detect risk before losing all useful computation; preserve checkpoint state; recover work on a separate node; identify human action/communications gaps; measure resilience. To be credible: show actual progress, reliable notification, and operator-friendly runbook.

### NVIDIA — Best Usage of Nemotron Beyond a Chatbot

**Prompt text available in sponsor-sheet screenshot:** "Best Usage of Nemotron beyond a chatbot." Additional 2026-specific technical requirements were not visible in the provided screenshots. We must not invent them.

**Our concrete response:** Nemotron is an actual tool-using investigation agent that fetches correlated sensor/OS/job telemetry, queries real checkpoints, evaluates recovery evidence, explains expected lost progress and summarizes verified completion. The model **does not** make lease claims, execute arbitrary code, operate hardware, or decide safety boundaries. A deterministic controller does those things.

### Photon — Best Use of Photon API

**Prompt text available in sponsor-sheet screenshot:** "Best Use of Photon API (Notion with full info)"; the linked detailed Notion challenge page was inaccessible in external retrieval. Treat exact sponsor-specific constraints as **unverified**. The official Photon 2.0 API reference documents project-scoped bearer keys, Users/Spaces/Messages, inbound delivery, and telephony availability dependent on setup. See `SPONSOR_ALIGNMENT.md` for sources and restrictions.

**Our concrete response:** actual message to a real operator when rescue begins and completes, plus two-way `STATUS`, `WHY`, `CHECKPOINT`, `ACK` commands. Photon messages map to actual incident IDs and return live evidence, not hard-coded chat text. Voice calling is an optional stretch feature only if the provider account/channel supports it.

## 3. Non-negotiable user experience

### Hero demonstration (truthful)

1. Operator opens `LIFERAFT Control`, sees Pi worker online, a real training loss line updating, first verified checkpoint, latest heartbeat, Pi CPU temperature, external ambient reading (separately labeled), and backup readiness.
2. The model trains for at least several dozen real optimizer steps with checkpoint uploads; operator sees the checkpoint manifest SHA-256 and cloud status `VERIFIED`.
3. Operator presses the **physical button** on ESP32. OLED changes to `TEST EMERGENCY` and backend logs `source=injected`, not `real overheating`. Controller receives event via Laptop B serial bridge, validates it, and enters `RESCUE_REQUESTED`.
4. Policy queries backup readiness, recent committed checkpoint and lease/fencing rules. Prefer a graceful preemption: signal primary worker to checkpoint/pause via its next **outbound poll**. If primary is actually dead (separate crash test), fall back to existing verified checkpoint after lease expiry.
5. Controller atomically transfers job ownership/lease epoch and starts backup worker after verification. On a dead primary, no unsafe waiting for fresh checkpoint; apply measured recovery-point loss.
6. Backup runs the same real training algorithm from the stored step/optimizer state and advances the loss curve using new genuine measurements. Dashboard shows before/after worker IDs and first resumed step.
7. Nemotron calls read-only diagnostic tools, returns specific evidence, a causal hypothesis with uncertainty, a structured recommended plan, and a final verification summary.
8. Photon sends incident notification to operator's real channel. Operator responds `STATUS` and receives job step, active worker, checkpoint hash prefix, and rescue state from the backend. Optionally `ACK` records acknowledgement.
9. Console shows measured time-to-resume and checkpoint gap, plus ``is_fully_verified=true`` only after the backup completes actual training steps.
10. Operator can view "Flight Recorder" — chronological immutable events with source, timestamps and attached evidence, clearly identifying test injections.

### Secondary demonstrations

- **Crash test:** force-stop only the primary **training process** (not Pi shutdown or power); show automatic lease expiry and takeover with the last verified checkpoint; no need to touch a wire.
- **Bad checkpoint test:** corrupt a *test copy* of a checkpoint object in local test mode, verify standby rejects it and chooses the last good checkpoint rather than silently restarting or accepting invalid bytes.
- **Campus network isolation:** demonstrate that workers require only outbound HTTPS; a direct ping may fail but job rescue still functions. Never require port-forwarding on school infrastructure.

## 4. Architecture — concrete components

```text
Pi 5 primary worker  --HTTPS--> hosted coordinator <--HTTPS-- Laptop A standby worker
       |                                  |                      ^
       |                            private checkpoint          |
       +---- checkpoint bytes ------> storage ------------------+
                                          |
ESP32 DS18B20 + button --USB serial--> Laptop B hardware bridge --HTTPS--> coordinator
OLED <--- USB serial status <--- Laptop B bridge                       |
                                                                    |
Laptop B Next.js console <--HTTPS / realtime or polling----------- hosted APIs
                  |                                              |
                  +--- Nemotron structured diagnostic agent ----+
                  +--- Photon two-way messaging adapter --------+
```

**Cloud foundation:** MongoDB Atlas stores job state and private checkpoints. A hosted Python HTTPS coordinator runs the same recovery policy as the local adapter. The dashboard reads scoped coordinator APIs. Workers on campus Wi-Fi independently initiate outbound TLS connections.

**Important implementation choice:** Pi 5's own Wi-Fi is sufficient for the preferred plan if a network it can join grants internet. If campus enterprise Wi-Fi or client policies interfere, use an approved personal hotspot/private router. No Ethernet cable is necessary for the cloud design. USB cable provides the primary ESP32 telemetry path so its Wi-Fi credentials are optional.

**Security outline:** Each device has a distinct scoped credential. The coordinator validates identity and payload. The Atlas connection URI stays in the hosted runtime. Checkpoints use immutable paths and short-lived scoped transfer URLs. Dashboard access is read-only by default. Operator commands require an authenticated operator. Keep long-lived secrets out of browser JavaScript and ESP32 firmware.

**Local development:** Build `LocalCoordinator`/`LocalArtifactStore` using SQLite + filesystem with the *same typed interface* as cloud. It simulates remote APIs only for testing; the real distributed demonstration must pass using cloud mode. No Docker dependency required.

## 5. Repository architecture Codex must build

```text
liferaft/
  README.md                       # human-facing project setup/usage
  AGENTS.md
  PHASE_TRACKER.md
  .gitignore
  .env.example
  pyproject.toml / uv.lock        # Python libraries, exact versions verified and pinned
  package.json / package-lock.json or pnpm-lock.yaml
  docs/
    architecture.md
    user-setup.md
    hardware-bringup.md
    operator-runbook.md
    security.md
    fault-injection.md
    experiments.md
    risk-register.md
  packages/
    liferaft_core/
      contracts.py               # Pydantic event/job/checkpoint models
      states.py                  # state machine and invariants
      workload/
        model.py                 # small real PyTorch model
        dataset.py               # deterministic seeded dataset
        train.py                 # real loss/optimizer step
        checkpoint.py            # atomic save/load/compatibility/integrity
      coordinator/
        interface.py
        local_sqlite.py
        cloud_http.py
        leases.py                # epoch/fencing and expiry logic
        checkpoint_commit.py
      agents/
        nemotron_client.py
        tools.py                 # allowlisted read-only typed tools
        planner.py
      messaging/
        photon_client.py
        commands.py
        fake_provider.py
      telemetry/
        health.py
        pi_cpu.py                # read-only sysfs/vcgencmd
        serial_bridge.py
        risk_policy.py
      demo/
        inject.py
        scenario_runner.py
        evidence_export.py
    worker/
      main.py                    # same worker binary across Pi/laptop
      runtime.py
      checkpoint_uploader.py
      lease_watcher.py
    tests/
      test_resume_equivalence.py
      test_checkpoint_integrity.py
      test_lease_fencing.py
      test_cloud_state_machine.py
      test_temperature_semantics.py
      test_agent_tools.py
      test_photon_webhook.py
      test_hardware_parser.py
      e2e/
        test_two_workers.py
  cloud/
    cloud/
      config.toml
      migrations/
      functions/
        liferaft-control/
        photon-inbound/
      tests/
  web/
    src/app/
    src/components/
      SystemTopology.tsx
      TrueLossCurve.tsx
      SensorEvidence.tsx
      CheckpointLedger.tsx
      RescueTimeline.tsx
      NemotronTrace.tsx
      OperatorMessages.tsx
      RecoveryMetrics.tsx
    src/lib/contracts.ts
    ...
  firmware/
    esp32_s3/
      src/main.cpp or .ino
      platformio.ini or arduino-cli config
    uno_fallback/
  scripts/
    doctor.py
    install_pi.sh
    start_primary.sh
    start_standby.sh
    start_hardware_bridge.sh
    run_demo.sh
    run_fault_matrix.sh
```

Codex may reorganize paths if it improves reliability but must preserve functions, stable interfaces, phase tests and documented command examples. Keep worker code platform-independent and CPU-only by default. PIN verified dependency versions, don't guess incompatible ARM builds.

## 6. Training workload: exact functional requirements

### 6.1 Genuine model

Use PyTorch CPU, deterministic regression on generated 32-feature vectors, e.g. `Linear(32,64) → ReLU → Linear(64,1)` and AdamW optimizer. Generate synthetic data using a fixed seed and stable sample order. 200–500 optimizer steps are sufficient; add a configurable per-step sleep for observable demo without stressing CPU. Log actual MSE loss, wall-clock timing, worker ID, job ID and step. No fake progress increments.

### 6.2 Checkpoint content

Each checkpoint must include: schema version; unique `job_id`; `run_id`; `checkpoint_id`; completed step; model architecture version; model `state_dict`; optimizer `state_dict`; scheduler state if applicable; torch CPU RNG, numpy RNG and Python `random` RNG; data generator position/permutation or seed and cursor; creation UTC time; worker ID; worker lease epoch; dataset fingerprint; code/config fingerprint; loss/history summary; checkpoint content SHA-256 in *separate* manifest to avoid self-referential hashing.

- Write to a temporary local file then `flush` + `fsync` (where supported), atomic rename to immutable filename, hash actual bytes. Avoid unsafe delete/overwrite of previous checkpoints.
- Use trusted locally produced checkpoint files only; PyTorch pickle-compatible artifacts can be dangerous when loaded from untrusted sources. Prefer weights-only loading/validated formats, allowlisted structures and private source provenance; do not blindly deserialize unknown uploads.
- Upload immutable bytes, confirm remote object exists, verify remote/downloaded hash before marking `COMMITTED`. The *commit manifest* must reference immutable path and exact size/hash.
- On restore verify job ID, checkpoint schema, model version, dataset fingerprint, hash, expected epoch and permitted producer before loading; gracefully reject corruption, truncated writes and stale job metadata.
- Ensure resumed worker executes **next training step after checkpoint step**, with model/optimizer state preserved. An honest difference after crash equals work completed since most recent successful checkpoint.

### 6.3 Test for true continuity

Run an uninterrupted baseline from seed 1729 for N steps; run an interrupted version with the same initial weights, samples and optimizer ordering; save at step K, resume on second worker and finish to N. Compare loss trajectory after K and final model tensors to reasonable floating-point tolerance; record architecture differences where relevant. Verify actual resumed loss/weights—not just checkpoint file presence or final numeric progress.

Pi (ARM CPU) vs laptop (x86 CPU) may have small floating-point implementation differences. Use documented tolerances and loss convergence checks rather than demanding byte-for-byte model tensors across architectures. A same-machine deterministic test should be tighter.

### 6.4 Progressive checkpoint / risk innovation

Implement two policies:

- **Normal:** checkpoint every 10–20 optimizer steps, configurable. Commit asynchronously without blocking the entire training loop longer than bounded time.
- **At-risk:** shorter interval, e.g. every 2–5 steps, **only if risk source is credible**, active transfer stable, backup capacity adequate, checkpoint creation isn't excessively costly, and persisted policy state allows it. Track overhead vs useful preserved work.

Risk signals: Pi reported CPU temp and trend, heartbeat irregularity, measured external *ambient* temperature (separate label), declared test injection, and backup readiness. An operator can run a controlled failover test via the button. Never let an LLM or isolated sensor spike directly alter Pi fan, power, overclock or system thermal protection. Use cooldown/hysteresis, stale-sensor rejection, rate limits and max checkpoint frequency.

## 7. Recovery: exact state machine, proof and safety

### 7.1 Canonical states

`CREATED → PRIMARY_RUNNING → AT_RISK → RESCUE_REQUESTED → PREEMPTING → CHECKPOINT_SELECTED → LEASE_TRANSFERRED → STANDBY_STARTING → VERIFIED_RESUMED → PRIMARY_STOPPED / COMPLETED`.

Separate error states `DEGRADED`, `NO_VALID_CHECKPOINT`, `STANDBY_UNAVAILABLE`, `AUTH_ERROR`, `STORAGE_UNAVAILABLE`, and `FENCED_OLD_PRIMARY`. Every state transition must be written as a durable event with UTC timestamp, reason/source, actor, epoch and evidence.

For a hard crash where primary cannot preempt, controller marks `PRIMARY_UNREACHABLE`, waits TTL with jitter/clock-skew consideration, validates prior committed checkpoint, then transfers epoch and resumes. Do not falsely show `PREEMPTING` if no request reached the primary.

### 7.2 Leases and fencing

One logical owner per `job_id`. Coordinator stores `owner_worker_id`, monotonically increasing `lease_epoch`, expiry, current checkpoint reference, and state. Claim/transfer is **atomic** (database transaction or server function with row locking), requiring a proven prior lease expiry OR verified voluntary yield; standby ready; checkpoint compatible. Claim returns epoch N+1. Every worker must check lease validity before committing checkpoints and periodically during training. Any update tagged with a stale epoch is denied, logged, and old worker stops promptly. Never infer global correctness merely from both nodes displaying "active"; coordinator authoritative state controls accepted writes.

Do not promise impossible exactly-once execution during partitions. Explicitly handle stale primary that is still calculating locally but no longer has write authority. Make one authoritative accepted writer and show that in UI.

### 7.3 Checkpoint transfer

Preferred store: private Atlas checkpoint collection; key path `runs/{run_id}/checkpoints/{step}-{uuid}.pt`. Upload with a time-limited signed URL and no upsert. On the server enforce declared file size caps and metadata; on commit, verify checksum and object existence (small demo checkpoints permit end-to-end bytes check). Store states `PREPARING / UPLOADING / STORED / VERIFIED / COMMITTED / REJECTED`. A standby may only restore `COMMITTED` checkpoint metadata whose object it downloads and verifies again. Keep previous good checkpoints on failures.

### 7.4 Metrics (all actually measured)

- `RTO`: time from incident detection to first *successful optimizer step* on backup; separate fault-injection timestamp and lost-heartbeat detection time.
- `RPO`: primary's last completed optimizer step before failure minus restored committed checkpoint step; mark unknown if primary dies before reporting last completed step.
- `checkpoint_age_seconds`: event time minus checkpoint commit time; not the same as RPO.
- `protected_steps`: checkpoint step / last known completed step; avoid claiming guaranteed cost savings.
- `recovered_loss`: loss value from the *actual* resumed step.
- `checksum_verified`: from an actual local hash comparison.
- `agent_tool_calls`: observed tool names/arguments/results (redact credentials).
- `operator_ack`: real provider inbound event correlated to incident.

## 8. Physically meaningful evidence and failure handling

### 8.1 Three separate observations

- `pi_cpu_temp_c` = CPU thermal data from Pi OS; not DS18B20.
- `ambient_temp_c` = DS18B20 sensor near demo enclosure; not device CPU measurement. If sensor is not mounted near the Pi, label it `room_temperature` instead.
- `fault_injection` = real button press representing a simulated cooling emergency or job risk; label **SIMULATION**.

The backend correlates these readings with heartbeats and checkpoint status; no assumption that room temperature predicts chip temperature accurately. Sensor invalid readings, no device serial, Wi-Fi loss or a stale timestamp become `telemetry_degraded` rather than an invented healthy measurement.

### 8.2 Incident types

1. `MANUAL_COOLING_SIMULATION` from ESP32 button; safe graceful rescue; no heat produced.
2. `WORKER_PROCESS_EXIT` genuine Python process kill; automatic lease expiry and standby resume.
3. `RISK_FROM_PI_CPU_TEMP` genuine read-only telemetry, but **advisory by default**; if policy permits auto-rescue, do it through process-level checkpoint/preemption only, not hardware shutdown.
4. `CHECKPOINT_CORRUPTION` injected in tests only; refuse and fall back to last valid.
5. `COORDINATOR_DELAY` latency/loss simulation on HTTP adapter; retries and no lease violation.
6. `SENSOR_DISCONNECT` missing/stale board telemetry; continue core job safely, report degraded sensing.

### 8.3 ESP32 communications

Reliable default is ESP32 USB serial → Laptop B Python bridge, newline-delimited JSON with `protocol_version`, `device_id`, `seq`, `millis`, `ambient_temp_c`, `button_pressed`, `event_type`, `source_type`, `quality`, and `crc_or_checksum` if implemented. Bridge validates length, schema, sequence monotonicity, allowed values, duplicate and debounce; forwards to cloud over HTTPS with authenticated identity; sends display state back to board. Never interpret arbitrary serial strings as shell commands.

ESP32 Wi-Fi path is optional and must **not** be required under campus isolation; if used, HTTPS and secret storage appropriate to board, plus no raw API admin keys flashed to microcontroller.

## 9. Nemotron — an agent, not a chatbot

### 9.1 Actual useful role

Nemotron should answer: "What is happening? How much work is at risk? Is the standby healthy? Which checkpoint is safe to use? What evidence supports the decision? What did the rescue actually preserve?" It must drive a **multi-tool investigation** and produce grounded structured decisions with confidence/uncertainty, not narrate pre-written strings.

### 9.2 Read-only tools to implement

- `get_incident(incident_id)` — source, timestamps, primary and current state.
- `get_recent_telemetry(worker_id, minutes)` — CPU temperature, ambient (if relevant), loss/step and heartbeat age.
- `get_checkpoint_candidates(job_id)` — immutable entries, hashes, committed flag, age, steps, compatibility.
- `get_worker_capabilities(worker_id)` — architecture, memory, Python, torch, storage, readiness, health.
- `compare_recovery_options(job_id)` — deterministic estimate of checkpoint gap, cost and transfer readiness.
- `get_lease_and_fencing_state(job_id)` — owner, epoch, expiry, stale rejected writes.
- `get_rescue_verification(incident_id)` — actual resumed step, hash, RTO/RPO, status.
- `get_runbook_section(topic)` — curated team-approved SOP paragraphs, not retrieved arbitrary web commands.

Only expose allowlisted typed tools. Agent request budget, tool-call cap (e.g. 8), timeout, retries, and signed telemetry provenance. If no Nemotron credentials, a fake adapter may be used for unit tests but never claim it satisfies a real integration. Configurable current model ID from NVIDIA Build; choose a tool-capable Nemotron actually available under team's account. Treat provider model names as configurable and confirm them at implementation time.

### 9.3 Workflow

`Incident → context snapshot → Nemotron requests tools → real backend executes read-only tools → tool results → model synthesizes incident hypothesis and options → policy engine independently decides actual rescue → verification tools → Nemotron after-action summary.`

No shell execution or writes in Nemotron tool list. Never pass tokens, raw phone numbers, user chat histories or private environment files into the model. Display a trace that distinguishes tool inputs/results from model interpretation.

### 9.4 Structured answer

`{incident_id, observed_facts[], likely_failure_mode, uncertainty, recommended_software_actions[], data_gaps[], verification_checks[], verified_outcome}`. Every observed fact cites an event ID or telemetry window, and unknowns remain `unknown`, never guesses.

## 10. Photon — real operator messages

### 10.1 Real interaction

Notification 1: `LIFERAFT [TEST EMERGENCY] — Pi 5 worker at risk. Checkpoint step 120 committed. Standby ready. Incident INC-... Reply STATUS or WHY.`  
Notification 2: `Recovered: Laptop A resumed at step 121; first new optimizer step completed at ...; measured recovery time ...; checkpoint SHA ...`.

Operator reply commands:

- `STATUS` — live owner, worker status, job step, incident state.
- `WHY` — Nemotron explanation with trace/evidence references, or honest unavailable message.
- `CHECKPOINT` — step, verified SHA prefix, age, status.
- `ACK` — record acknowledgement with conversation identity and timestamp.
- `HELP` — supported commands, privacy note.

Inbound commands must map to an authenticated/allowlisted contact and active incident; unknown senders cannot invoke job actions. The first version does NOT allow remote `SHUTDOWN`, `FORCE`, `RESTART` or arbitrary code from messages. Handle duplicate provider deliveries idempotently. Confirm channel setup and webhook/event-delivery specification against current Photon docs; Beta is evolving. Avoid adding voice unless basic message round trip and provider provisioning are truly working.

### 10.2 Phone setup and privacy

A human may need to create a Photon account/project, choose a channel, acquire a number/identity or link a service, and supply *one consenting team phone number* through private env settings. The precise provider UI varies; Codex must inspect current docs and provide literal click-by-click steps when an actual account screen is reached. Do not store or display personal phone numbers in event logs.

## 11. Frontend — interactive operations cockpit

Build one excellent screen rather than many generic pages. It must show *real* status from coordinator and be usable on a laptop and phone:

1. **Topological strip** with Pi 5 (primary), Laptop A (backup), Laptop B (operator), ESP32 sensor box, cloud relay; live green/yellow/red states with last-seen timestamps. If a node has never connected, mark `NOT CONNECTED`, never fake green.
2. **Live loss graph** with actual training step/loss values. Mark checkpoint commits, fault injection and first resumed step with vertical event annotations. Color/shading may distinguish worker before and after; never fabricate actual loss points.
3. **Risk panel** with distinct Pi CPU temp, ambient sensor reading, telemetry freshness, checkpoint interval and causal reasons.
4. **Checkpoint Ledger** table: step, generated UTC, immutable path suffix, bytes, SHA prefix, verify stage, producer/epoch. Clicking opens an evidence panel (not raw secret URL).
5. **Flight Recorder** event timeline: who/what/when, `injected` vs `measured`, authenticated worker, evidence reference.
6. **Actual recovery metrics** RTO/RPO, recovered step, jobs completed, signed status; show `N/A` when unavailable.
7. **Nemotron diagnostics** actual tool-call timeline and final answer, with tool metadata and no secrets.
8. **Photon operator plane** provider delivery + inbound ack state, no fake message receipts.
9. **Demo controls** hidden/disabled in production mode: `Inject cooling emergency`, `Simulate sensor dropout`, `Run worker crash test` (latter only kills dedicated training process with explicit scoped confirmation). Each control sends a labeled injected event to backend; never directly powers down physical devices.
10. **A scenario replay** loads historical *observed* events into read-only UI for repeatability; never visually conflates replay with live data.

Data updates by short polling (1–2 seconds). No CSS animation can change authoritative data. Show loading/error/stale statuses.

## 12. Security and reliability requirements

- All coordinated state changes occur through an authenticated hosted endpoint; enforce per-device roles and server-side validation. No admin token on ESP32, Pi code firmware, or browser.
- Atlas is private to the hosted coordinator, with separate device credentials and scoped API requests. Store credentials only in `.env` / hosted secrets; redact logs.
- Idempotent event IDs and leases; no retries that accidentally execute a rescue twice.
- Timeout and backoff on cloud calls; no infinite loops, no excessive checkpoint uploads, finite local disk quota and retention policy **limited to LIFERAFT owned paths**.
- Failover policy needs a committed checksum-verified checkpoint and healthy standby before marking a rescue successful.
- Backup worker always re-downloads and rehashes artifact, even if controller previously marked committed.
- Graceful cancellation of worker processes via application messages; no OS-level destructive commands, unmounts, `sudo reboot`, forced Pi shutdown, or relay toggling.
- Prevent job recovery if dataset/model/code compatibility mismatches; show an explicit error.
- Network partitions cannot be papered over: stale writer fenced by epoch and refused commits; client should pause locally if lease cannot be renewed within configured grace.
- No external data or real customer workloads, only generated test data.

## 13. Engineering phases — implement sequentially

Codex must complete a phase with tests, user-visible working demo and tracker update before the next. It may build shared scaffolding but cannot mark a phase done while failing its acceptance gates. Every phase has exact expected artifacts.

### PHASE 0 — Foundation, hardware/network inventory, contracts

**Build:** repo scaffold, package lockfiles, `liferaft doctor` command, Pydantic/TypeScript shared protocol docs, environment loader, structured logging, local SQLite coordinator, fixture generators and readme. `doctor` shows OS, Python version, CPU architecture, PyTorch installability, network egress (`HTTPS` only), device readiness, disk space and whether hardware ports are present **without modifying hardware**. Add `--json`, `--redact`, and a nonzero exit status for critical failures. It may probe Atlas-backed coordinator/NVIDIA/Photon only when keys are configured, read-only and bounded.

**Specific tests:** schema parse round-trip; invalid timestamps/replayed event rejected; redaction; local SQL mode works without internet; no direct LAN dependency. **Exit:** `uv run pytest` (or documented pinned equivalent) passes; `liferaft doctor` works on one laptop and doesn't print secrets.

### PHASE 1 — Real CPU training, exact checkpoint/resume

**Build:** deterministic synthetic dataset, small PyTorch model, training CLI; baseline training; atomic checkpoint file, hash manifest, weights-only/safe loading, complete optimizer/RNG/dataset cursor; controlled resume. Small checkpoint (<10 MB target) to keep uploads fast. Add `liferaft train --steps 200 --checkpoint-every 10 --seed 1729` and `liferaft resume --checkpoint ...` with actual outputs.

**Tests:** interrupted vs uninterrupted loss and weights within tolerances; interrupted process resumes at K+1; wrong schema/model/seed/hash rejects; store previous good checkpoint. **Exit:** repeatable local proof shown in console with saved artifact checksum. No UI needed.

### PHASE 2 — Local failover engine / distributed simulator

**Build:** two worker processes (can run on same laptop for phase testing), heartbeats every ~2 seconds, lease TTL ~12 seconds, epoch fencing, event log, watchdog, stand-by poll, fault injector scoped to dedicated training subprocess. Local SQLite coordinator and local artifact store implement exactly cloud protocol interfaces.

**Tests:** graceful preemption, primary crash, no duplicate accepted writers, standby absent, corrupt checkpoint, repeated incident ID, racing standby claims, old primary return and stale write rejection. **Exit:** a real stopped process is replaced by a second real training process using a committed checkpoint, with measured recovery metrics.

### PHASE 3 — Hosted cloud coordinator and private storage

**Build:** Atlas project, private checkpoint collection, hosted coordinator endpoints, device credentials, signed expiring transfer URLs, atomic claims and renewals, checkpoint verification, status, events, and a cloud doctor. Workers make outbound HTTPS calls and require no local inbound socket. Keep operator scope separate from workers.

**Tests:** both laptops can reach service independently despite direct ping failure; coordinator auth rejects wrong tokens and anonymous reads; genuine immutable checkpoint transfer; two simultaneous claims choose one; stale epoch rejected; retry/upload failure rollback. **Exit:** actual cross-laptop restore over cloud HTTPS, documented exact request/response (redacted) and no direct peer connection.

### PHASE 4 — Raspberry Pi 5 bring-up and real heterogenous worker

**Build:** beginner-safe Pi OS 64-bit setup guide; headless SSH with approved credentials; PyTorch ARM64 preflight; CPU-only training dependency resolution, `worker-pi-primary` service launched as an ordinary non-root user; separate CPU telemetry reader; bounded CPU load and thermal guards; easy reversible installation. Never modify EEPROM, CPU voltage, bootloader, fan curves or system power. Cache deterministic dataset/weights on Pi; checkpoint cloud upload.

**Tests:** Pi boots and accesses HTTPS; CPU temp reports plausible values from OS (separate from DS18B20); training executes N steps with no excessive thermal readings; checkpoint uploaded; Laptop A resumes ARM-produced checkpoint on x86; Pi worker accepts graceful pause and epoch fencing. **Exit:** a Pi-to-laptop rescue documented with actual worker IDs. **If ARM PyTorch cannot be installed reliably:** invoke documented laptop-to-laptop fallback, keep Pi for real independent telemetry, record compatibility obstacle; continue.

### PHASE 5 — Independent ESP32-S3 hardware + sensor + OLED

**Build:** firmware with read-only DS18B20, debounced button, OLED driver, `startup self-test`, clear state-machine display, serial JSON protocol; Laptop B serial bridge that forwards validated events to cloud, reads current system state to show on OLED, and handles disconnected USB without causing false rescue. Deploy first with button only, then OLED, then DS18B20 after wiring validation. Arduino Uno fallback firmware only if ESP32 unavailable. **Relay never switches Pi, fan, laptop or mains.**

**Tests:** board upload success via correct port; stable serial output; known-good ambient readings; invalid sensor disconnected yields degraded, no auto-shutdown; press button triggers `MANUAL_COOLING_SIMULATION`, with `source=injected`; OLED shows `TEST / RESCUING / RESUMED`; repeated bounce events collapse to one; safe USB reconnect. **Exit:** physical button begins a *real software rescue* without any harmful equipment actuation.

### PHASE 6 — Measured risk, proactive checkpoint policy and continuity scoring

**Build:** deterministic risk score incorporating recent Pi CPU temp/trend, sensor validity, heartbeat age, backup capacity, checkpoint age, and explicit injected event. Keep thresholds conservative and configurable; sensor spike alone advisory. Adaptive checkpoint frequency with hysteresis and cap; backup-readiness evaluation; RTO/RPO calculations and event attribution.

**Tests:** stable telemetry normal; single invalid high reading ignored/reported; rising *measured* Pi CPU temp only advisory without unsafe actions; injected test authorizes graceful software preemption; checkpoint interval changes bounded; stale sensor ignored; loss estimates correctly labeled. **Exit:** exact reasons for risk/interval shown in APIs and UI, and measured overhead for adaptive vs fixed interval.

### PHASE 7 — NVIDIA Nemotron real multi-tool agent

**Build:** provider adapter using official available API/model ID; bounded typed read-only tool loop; evidence references; structured JSON output validated by Pydantic; mock for unit tests; store redacted trace; UI view. Tools are `get_incident`, `get_recent_telemetry`, `get_checkpoint_candidates`, `get_worker_capabilities`, `compare_recovery_options`, `get_lease_and_fencing_state`, `get_rescue_verification`, `get_runbook_section`. Avoid any agent-caused job state transition.

**Tests:** tool argument validation; unknown function name rejected; bounded loop and timeout; hallucinated state never trusted; real provider key test when provided showing >=2 distinct live tool calls; no secret data in model context. **Exit:** incident narrative grounded in actual returned tools and observable trace; simulated adapter clearly labeled otherwise.

### PHASE 8 — Photon real two-way operator operations

**Build:** project/channel setup validated against current Photon docs; outbound send adapter; secure inbound webhook/WebSocket event receiver (whichever verified); operator allowlist; `STATUS`, `WHY`, `CHECKPOINT`, `ACK`, `HELP`; provider event ID dedupe; retry queues; incoming payload redaction; displayed delivery state.

**Tests:** real outbound message to consenting operator, real inbound reply mapped to correct incident, duplicate message idempotence, unknown number rejected, provider unavailable leaves rescue unaffected. **Exit:** a full actual 2-way Photon conversation linked to the live incident. If credentials not ready, tests of mock pass but phase stays `BLOCKED_EXTERNAL`, not `DONE`.

### PHASE 9 — Operations cockpit UI and observed evidence

**Build:** polished Next.js console with actual topology, Pi/ambient temps separately labeled, training loss curve, checkpoint hashes, ownership epoch, true recovery metrics, Nemotron tool trace, Photon acknowledgement, incident timeline; responsive operator mode; demo controls clearly mark injections. API failures show stale/unavailable rather than fake normal state; optional read-only replay.

**Tests:** API contract, empty/new device, sensor disconnected, cloud stale, corrupt checkpoint, actual loss data, accessibility keyboard/focus contrast, no secrets in browser bundle. **Exit:** judge/engineer can understand incident and actual rescue by looking at the cockpit, with every line grounded in backend events.

### PHASE 10 — Hardening and full system failure gauntlet

**Build:** e2e scripts for both workers, edge functions, ESP32 serial, Nemotron and Photon; run controlled failures, collect redacted evidence, document known limits, operational SOP; benchmark recovery latency, lost steps and checkpoint overhead. Run 3 successful full recoveries and stress negative cases. Do not make hardware shutoff part of the tests.

**Tests:** all cases in `TEST_MATRIX.md`, including old primary reappears, cloud outage, corrupt checkpoint, sensor failure, unauthorized remote commands, slow download, Pi overheated warning (synthetic telemetry input, not physical overheating). **Exit:** reliable end-to-end demo, safe hardware thermals, reproducible operations command, and no claims unsupported by evidence.

### PHASE 11 — Product polish and operational handoff

**Build:** concise operator manual, architecture diagram, in-app first-run walkthrough, deployment/cleanup scripts that touch only project-owned resources, example runbook for operators, one-command `liferaft demo --scenario thermal-test`, scripted reset of *only software state* for repeatability, and feature flag to disable injections in normal mode.

**Tests:** a beginner can follow `docs/operator-runbook.md` without technical assumptions; Pi/ESP32 can be safely unplugged **after normal program exit/shutdown** and returned without wiring modification; all local artifact removal is scoped to project directory. **Exit:** maintainable engineering product, no unresolved unknowns disguised as implemented features.

## 14. Work splits when multiple developers are coding

- **Compute engineer:** Phases 1/2, checkpoint schema, Python worker, Pi runtime.
- **Cloud engineer:** Phase 3, transactional leases, private storage, auth, integration tests.
- **Embedded engineer:** Phase 5, board identification, firmware, serial bridge, OLED and DS18B20 safe wiring.
- **Operator experience engineer:** Phase 7/8/9, Nemotron/Photon adapters, UI. Shared typed contract must be merged before parallel branches.

If there are fewer developers, Codex should prioritize P0 sequentially. Avoid divergent custom JSON schemas, duplicate fake event producers, long-lived branches or unverified dependencies.

## 15. Global acceptance metrics and honest limits

| Goal | Required proof | Not acceptable |
|---|---|---|
| Real computation | Actual PyTorch optimizer steps and nontrivial losses | JS progress bar alone |
| Correct resume | Checkpoint model+optimizer+RNG, run step after K | Restart at 0 with progress offset |
| Real cross-machine | One physical device produces checkpoint, another downloads+resumes | Two threads on same laptop labeled as two physical nodes |
| Cloud independent | HTTPS egress only; no inbound campus peer assumptions | Requires laptop IP/port reachable on school Wi-Fi |
| Physical evidence | ESP32 serial event and actual button press | Clicking web button but calling it hardware |
| Safe hardware | No power/cooling intervention, bounded CPU, unmodified Pi boot/clock | Pulling power, covering fan, deliberately overheating |
| NVIDIA | Actual provider response and multiple real tool calls | Static incident text or generic chatbot |
| Photon | Actual outbound and inbound message IDs | UI screenshot of fake text |
| Observability | Real hashes, RTO/RPO, loss and lease epochs | Fabricated performance/savings numbers |
| Fail-safe state | Invalid checkpoint and stale primary prevented | Unverified artifact silently loaded |

**Limits:** Hardware is a tabletop validation model, not a production-rated data-center safety system. PyTorch checkpoint-aware workloads only. No guaranteed recovery of arbitrary process memory, network sockets, GPU memory, or customer workloads. Campus/cloud outages can delay control. An LLM can be uncertain. No claim of company endorsement or deployment.

## 16. Authoritative external references

Check current official docs **before installing libraries or writing live API calls**; pin versions after verification.

- Pi 5 setup, power: https://www.raspberrypi.com/documentation/computers/getting-started.html
- Pi 5 fan connector, thermal controls: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html
- ESP32-S3-DevKitC-1 official guide: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide.html
- DS18B20 official datasheet: https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf
- PyTorch local start: https://pytorch.org/get-started/locally/
- PyTorch serialization: https://pytorch.org/docs/stable/notes/serialization.html
- Atlas database access: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/
- PyMongo transactions: https://www.mongodb.com/docs/languages/python/pymongo-driver/current/crud/transactions/
- Docker deployment: https://render.com/docs/docker
- NVIDIA available Nemotron models: https://build.nvidia.com/search/models?q=Nemotron
- Photon 2.0 official API reference: https://photon.codes/docs/beta/api-reference
- Photon overview: https://photon.codes/blog/introducing-photon-2.0
- Sponsor wording: team-provided challenge screenshots; NMC² longer statement transcribed above; NVIDIA/Photon short track titles only. No invented additional restrictions.
