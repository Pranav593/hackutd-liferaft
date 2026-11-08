# LIFERAFT — Codex phase tracker and real progress log

**Current status:** Phases 0–2 are verified on one Apple Silicon Mac. This tracker records the commands, results, and gates for each phase.

## Workflow rules

- Each phase has `NOT_STARTED / IN_PROGRESS / DONE / BLOCKED_EXTERNAL / NEEDS_FIX` status. Only mark DONE when its specified positive and negative tests pass.
- Always work on next phase. Resolve failed tests before moving forward; external credential blockers should not prevent building local adapters and unit tests.
- After a phase, write `what actually works`, `test command`, `observed result`, `remaining blocker`, `what team must do in beginner steps`, `next phase`.
- Hardware safety is **cross-cutting**: it is enforced in every phase, not deferred to hardware phase.
- Never include private keys, full phone numbers, access tokens, checkpoint signed download URLs or private network credentials in evidence.

## Phase checklist

### Phase 0 — Foundation / contracts / doctor — DONE
- [x] Repo scaffold, source control ignore patterns, lockfiles, typed models and schemas.
- [x] Python, Node and Pi compatibility probe with harmless read-only diagnostics.
- [x] Local SQLite adapter, local file checkpoint store, structured redacted logs.
- [x] `liferaft doctor` CLI and OS-aware setup docs.
- [x] Tests for schema validation, auth/redaction and offline mode.
- [x] Record actual OS, Python, architecture, dependency constraints (no secrets).
- **Gate:** local backend tests pass, secrets never printed, no remote connectivity required.

### Phase 1 — Genuine PyTorch job + checkpoint/resume — DONE
- [x] Seeded 32-feature regression MLP, real optimizer and loss logging.
- [x] Model+optimizer+RNG+dataset cursor checkpoint schema and atomic writes.
- [x] SHA-256, immutable filenames, compatibility and tampering checks.
- [x] Resume K→K+1 and baseline-comparison tests.
- **Gate:** 200-step baseline and interrupted/restarted run pass actual numeric checks.

### Phase 2 — Local failover engine and ownership — DONE
- [x] Heartbeats, lease TTL, fencing epoch, durable event log.
- [x] Primary and standby CLI processes, local checkpoint transfer and monitored handoff.
- [x] Graceful risk preemption and worker-process crash tests.
- [x] No-valid-checkpoint, race, stale-primary and idempotence tests.
- **Gate:** real second process finishes training and old primary cannot commit.

### Phase 3 — Cloud coordination for campus-isolated devices — IN_PROGRESS
- [x] Coordinator, Atlas adapter, outbound HTTPS client and Render Docker configuration implemented.
- [x] Deploy the service and verify authenticated Atlas connectivity.
- [x] Scoped device roles, transfer integrity, and stale-owner rejection pass offline API tests.
- [ ] Add signed transfer URLs and complete the cloud doctor lease, transfer, and integrity checks.
- [ ] Verify immutable checkpoint writes and transaction rollback against live Atlas.
- [ ] Atomic lease claim/yield/reject stale epoch and cloud health checks.
- [x] Two independent computers access cloud over HTTPS; checkpoint round-trip verified.
- [x] Graceful Mac-to-Windows handoff completed all 200 training steps over hosted HTTPS (`campus-drill-03`).
- [ ] Deny anonymous/untrusted reads and fake device writes.
- **Gate:** actual cross-laptop recovery needs **no inbound campus-LAN access**.

### Phase 4 — Raspberry Pi 5 real worker — IN_PROGRESS (safe host preparation)
- [x] Boot, Pi 5 identity, ARM64 OS, Connect access, Python venv, public HTTPS and idle health observed; see `docs/HARDWARE_PROGRESS_REPORT.md`. Training/cooling and recovery gate remain open.
- [ ] Pi boot, official power, compatible cooling verified in human safety steps.
- [ ] Pi OS/ARM64 PyTorch installation capability audited; no destructive system changes.
- [ ] Pi CPU temperature read-only; low-load training, cloud upload.
- [ ] Laptop A restores Pi-produced checkpoint, increments real training step.
- [ ] Document fallback if Pi cannot run PyTorch; no fake Pi compute indicator.
- **Gate:** Pi→laptop real rescue OR clearly recorded fallback with Pi telemetry.

### Phase 5 — ESP32-S3 sensor node, button and OLED — IN_PROGRESS (physical bench)
- [x] Native USB enumeration, chip/flash identity, private original-flash backup, and real board-only USB serial hello verified on Windows.
- [x] External GPIO5 button emitted a real contract-valid injected USB frame; local monitor exited and released COM8. Gateway and standby cloud doctors passed.
- [ ] Exact PCB revision and accessory pinouts checked before accessory wiring; chip revision and board-only hello are verified above.
- [x] Wired button emits an *injected* test incident and triggers an uninterrupted cloud recovery (`campus-button-05`).
- [ ] OLED verified I2C voltage/address displays cloud-reported state.
- [ ] DS18B20 pinout/resistor inspected; valid ambient measurement + invalid handling.
- [x] Python USB bridge forwards validated button events via outbound HTTPS, verified in `campus-button-05`.
- [x] One-shot button bridge and scoped coordinator action pass offline tests and the physical USB/Render drill.
- [ ] Relay disconnected; no fan/Pi power switching; no real overheating.
- **Gate:** physical button causes real software rescue and OLED reflects confirmed state.

### Phase 6 — Deterministic risk + adaptive checkpointing — NOT_STARTED
- [ ] Separate Pi CPU and ambient sensor metric sources; timestamp freshness.
- [ ] Backup-ready and checkpoint-age awareness, policy cooldown/hysteresis.
- [ ] Bounded adaptive interval and measured overhead.
- [ ] Real RTO/RPO/continuity metrics, uncertainty properly represented.
- **Gate:** risk tests plus 3 measured scenarios pass without unsafe actions.

### Phase 7 — NVIDIA Nemotron tool agent — DONE (demo scope)
- [x] Verified live model/API setup behind configured adapter.
- [x] Read-only typed incident and recovery-verification tools with a bounded exchange.
- [x] Real multi-tool calls, evidence IDs and structured answer.
- [x] Model has no power, command line, or leasing tools.
- [x] Mock tests and real provider smoke test when credentials exist.
- **Gate:** actual provider trace from one incident; no fabricated results.

### Phase 8 — Photon two-way communication — NOT_STARTED
- [ ] Verified supported channel, project-scoped key stored privately.
- [ ] Actual outbound notification; inbound secure event receiver.
- [ ] `STATUS/WHY/CHECKPOINT/ACK/HELP`, dedupe, sender allowlist, privacy.
- [ ] Channel failure does not block recovery.
- **Gate:** real phone/provider round trip correlated to incident.

### Phase 9 — Real-data operations cockpit — NOT_STARTED
- [ ] True topology, freshness, real loss curve, checkpoint ledger and flight recorder.
- [ ] Clearly distinguished injected vs measured states, no mock visuals as truth.
- [ ] Nemotron trace and Photon delivery/ACK evidence.
- [ ] Demo controls only in demo mode, no unsafe hardware action.
- [ ] UI API / auth / responsive / empty-state tests.
- **Gate:** observer can prove real cross-device rescue from actual evidence.

### Phase 10 — Failure gauntlet and measurements — NOT_STARTED
- [ ] Run full `TEST_MATRIX.md` with results recorded.
- [ ] Three end-to-end physical-button rescues; never heat/remove fan.
- [ ] Crash, bad checkpoint, lost network, stale primary, missed heartbeat, duplicate provider event tested.
- [ ] Redacted evidence and real latency/loss summaries produced.
- **Gate:** no critical broken feature or dangerous hardware path remains.

### Phase 11 — Operator-grade handoff / maintainability — NOT_STARTED
- [ ] `liferaft demo --scenario cooling-test` plus safe app-only reset.
- [ ] New-person walkthrough, runbook, architecture, troubleshooting and cleanup.
- [ ] Code formatting, type checks, pinned dependencies and no credentials in repo.
- [ ] Strict provenance: distinguish measured, derived, injected and mock provider events.
- **Gate:** any team member can use the project with step-by-step docs and no hardware damage.

## Human actions pending — fill only when needed

| Action | Why | Exact guide location | Status |
|---|---|---|---|
| Confirm 64GB microSD and card reader are still available | Pi OS boot | `TEAM_SETUP_GUIDE.md` §7 | NOT_CHECKED |
| Identify exact fan model and ESP32 USB connector | electrical safety | `HARDWARE_SAFETY_AND_WIRING.md` §B | NOT_CHECKED |
| Check DS18B20 sensor type and presence of 4.7kΩ resistor | avoid wrong wiring | `HARDWARE_SAFETY_AND_WIRING.md` §B/C | NOT_CHECKED |
| Team MongoDB Atlas project account (Phase 3) | hosted coordination and checkpoint storage | `docs/PHASE_3_ATLAS_SETUP.md` §§1–4 | PENDING |
| NVIDIA Build account/key (when Phase 7 needs it) | live tool-using agent | `TEAM_SETUP_GUIDE.md` §5 | NOT_CHECKED |
| Photon project/channel and consenting operator (Phase 8) | real messaging | `TEAM_SETUP_GUIDE.md` §6 | NOT_CHECKED |
| Compatible ESP32 USB data cable | flash/read serial | `TEAM_SETUP_GUIDE.md` §8 | NOT_CHECKED |

## Append one entry after each work session

### YYYY-MM-DD UTC — Phase X — [IN_PROGRESS / DONE / BLOCKED_EXTERNAL / NEEDS_FIX]

**What changed:**

**Files added/modified:**

**Commands actually run:**

```text
[actual commands, no passwords]
```

**Tests observed:**

- PASS:
- FAIL:
- BLOCKED_EXTERNAL / NOT_RUN:

**Hardware safety status:**

**Human action needed with complete beginner steps:**

**Actual metrics / screenshots / evidence location (redacted):**

**Next phase:**

## Phase U — Upscale layer (presentation + idea) — IN_PROGRESS
- [x] `docs/UPSCALE_PLAN.md`, `docs/UI_DESIGN_SYSTEM.md`, `docs/DEMO_SCRIPT_AND_SUBMISSION.md`
- [x] `web/demo/index.html` simulated cockpit (SIMULATED badge; no live data claimed)
- [ ] Port cockpit to Next.js `web/` and bind to real events
- [ ] Add `prev_hash` chain + Verify button, Lifeboat Score from real telemetry

### 2026-11-07 — Phase 0 — DONE

- Added a Python CLI, locked foundation dependencies, npm lockfile, Pydantic and TypeScript contracts with a JSON Schema snapshot, redacted logging, SQLite event journal, immutable local artifact storage, and local setup instructions.
- `python3 -m unittest discover -s tests -p test_foundation.py -v` passed 6 tests. Offline SQLite and filesystem, replay/time rejection, operator token boundary, tamper detection, schema sync and redaction passed.
- `npm ci --offline --ignore-scripts --cache .liferaft/npm` and `./node_modules/.bin/tsc --strict --noEmit web/src/lib/contracts.ts` passed using the cached official TypeScript package.
- `python3 -m liferaft doctor --network --json --redact` exited 0 for local use on macOS ARM64 (Darwin 27.0.0, Python 3.13.5, SQLite 3.49.1, Node 22.16.0, npm 10.9.2). Both public HTTPS probes returned unreachable in the execution shell. PyTorch was absent and no Pi/serial board was detected. Provider probes and physical hardware remain unverified.
- Architecture decision. SQLite commits each event and its SHA-256 predecessor in one transaction. Local checkpoint publishing uses a no-overwrite filesystem link from a flushed staging file. Both are offline and open no listening ports. Phase 3 will put lease authority and private checkpoint storage behind an outbound HTTPS API.
- No hardware action required for this phase. Next is Phase 1. Its numeric gate requires a real CPU PyTorch installation.

### 2026-11-07 — Phase 1 — BLOCKED_EXTERNAL

- Added `liferaft/workload.py`, `liferaft/checkpoint.py`, `liferaft/training_cli.py`, `tests/test_training.py` and the README training flow. The workload is a one-thread CPU MLP with AdamW and deterministic synthetic regression data. A checkpoint contains weights, optimizer buffers, step, dataset seed and cursor, loss history, and Python, NumPy and Torch RNG states.
- Compatibility choices. Integer source data is fingerprinted in a fixed byte order. Model/config identity and checkpoint ownership metadata are checked. SHA-256 and size are checked before CPU-only, weights-only deserialization from the exact verified bytes. Local saves publish a separate manifest after re-reading the immutable artifact.
- `python3 -m compileall -q liferaft tests` passed. Foundation regressions passed 6/6. `python3 -m liferaft train --steps 200 --checkpoint-every 10 --seed 1729` exited 2 at the missing Torch dependency. `python3 -m unittest discover -s tests -v` passed the six foundation tests and errored while importing the training suite with `ModuleNotFoundError: No module named 'torch'`. `python3 -m liferaft doctor --training --json --redact` exited 1 as designed.
- Verified the published CPython 3.13 Apple Silicon wheel and PyTorch's CPU index. The shell could not reach PyPI and the browser reported `ERR_BLOCKED_BY_CLIENT` at the official wheel download. No test losses, optimizer updates, checkpoint bytes, or timing were observed.
- Team step. Open Terminal and run the README installation commands in this repo's `.venv`. If the existing pinned foundation packages are already installed globally on this Mac, `python3 -m venv --system-site-packages .venv` is sufficient to expose them. The verification is `.venv/bin/python -m liferaft doctor --training --json --redact` reporting `cpu_verified: true`. If PyPI is unreachable from the normal Terminal, use a permitted hotspot or the second laptop. No passwords, service secrets or hardware needed.
- No Pi or microcontroller was powered, wired, or modified during this phase. Cross-device recovery, hosted services and physical evidence remain untested.
- Next. Run `.venv/bin/python -m unittest discover -s tests -v`, capture the actual 200-step and 120→121 numerical evidence and only then move to Phase 2.

### 2026-11-07 — Phase 1 — DONE

- The operator installed PyTorch 2.15.0 in the project virtual environment. `.venv/bin/python -m liferaft doctor --training --json --redact` exited 0 and verified CPU execution on macOS ARM64 with Python 3.13.5. This clears the previous dependency blocker.
- `.venv/bin/python -m unittest discover -s tests -v` passed all 12 tests in 6.746 seconds. Phase 0 offline checks passed again. The Phase 1 suite verified exact optimizer tensors, model weights, and loss trajectory against the 200-step baseline. It also verified RNG and cursor restore, wrong identity and seed rejection, schema and model incompatibility rejection, hash and truncation rejection before loading, and preservation of the previous checkpoint after an interrupted write.
- `npm ci --offline --ignore-scripts --cache .liferaft/npm` and `./node_modules/.bin/tsc --strict --noEmit web/src/lib/contracts.ts` passed.
- Retained a second real CLI run under `.liferaft/phase1-proof-ng3ekfdy/`. The commands were `.venv/bin/python -m liferaft train --steps 200 --seed 1729 --job phase1-proof --checkpoint-every 10`, the same command with `--steps 120`, then `.venv/bin/python -m liferaft resume --steps 200 --seed 1729 --job phase1-proof --checkpoint-every 10 --checkpoint <step-120 .pt path>`. The baseline used a separate state directory from the primary and resumed runs.
- The baseline started at loss 0.9492214918. The separate resume process started at step 121 with loss 0.0136791244 and completed step 200 at loss 0.0146676246. The maximum loss difference across all 200 steps was 0. The saved step-120 artifact was 46,192 bytes and its independently computed SHA-256 was `f26d68a90dfdcf43898ba210c7740013faf256a4f881a678587a2ba5137e013c`.
- This proves same-machine checkpoint and resume. Hardware is still unset and hosted services and physical cross-device recovery remain unverified. No human action is needed for Phases 0 or 1. The next phase is automated local failover between two processes. Pi and ESP32 setup will be guided separately when those phases are reached.

### 2026-11-07 — Phase 2 — DONE

- Added `liferaft/failover.py`, `liferaft/worker.py`, `liferaft/scenario.py` and `tests/test_failover.py`. Wired the worker and demo commands into `liferaft/cli.py` and updated the README and operational runbook.
- SQLite transactions serialize lease renewals, claims, checkpoint commits and their audit events. A worker checks its lease before continuing, and the coordinator fences stale writers. The standby restores a committed checkpoint and must report a real first optimizer step at the next step number with the selected SHA-256 before recovery is marked verified.
- Default timing is a 2-second heartbeat, 12-second lease and 6-second standby freshness window. The crash test targets only its dedicated primary subprocess. RTO in the report starts at incident detection. For crashes, the journal also records the earlier process kill. Crash RPO stays unknown when the exact last step is unavailable.
- `.venv/bin/python -m compileall -q liferaft tests` and `git diff --check` passed. `.venv/bin/python -m unittest discover -s tests -v` passed all 19 tests in 43.098 seconds. Both independent-process demos matched uninterrupted PyTorch loss exactly for every resumed step. Negative tests verified blocked recovery without a ready standby or committed checkpoint, actual resume from the prior checkpoint after corruption, one winner for racing claims, rejected stale heartbeat/commit, and request replay without extra handoffs or lease extensions.
- Both standalone commands below exited 0. The standby completed step 70 under epoch 2 in each run. The evidence includes checkpoint hashes, worker logs and the verified event chain.
- `.venv/bin/python -m liferaft demo --scenario cooling-test` resumed from checkpoint 32 at step 33. Detection to resume was 2.190 s, trigger to resume was 2.189 s, and lost steps were 0. Checkpoint SHA-256 `18f4c76e6f16981c54c0df970c86af3e122b68e3a9fde30a0e05c713f6ecca4c`. Evidence `.liferaft/phase2-dibgt9me/evidence.json`.
- `.venv/bin/python -m liferaft demo --scenario worker-crash` resumed from checkpoint 20 at step 21. Detection to resume was 0.707 s, trigger to resume was 12.206 s, and lost steps were unknown. Checkpoint SHA-256 `5b2dfdf045301bd823848cd432e8ed818e20e3335fabaa898a0ce9d87ba61883`. Evidence `.liferaft/phase2-df10wcse/evidence.json`.
- This gate covers one handoff on one Mac using a shared local artifact directory. Atlas, cross-device HTTPS, network partitions and physical hardware are outside this proof. No human action was needed for Phase 2.
- Next phase. Use MongoDB Atlas for hosted job ownership and private checkpoint storage, with a separately hosted HTTPS coordinator. The team selected Atlas before cloud implementation. Phase 3 will align the earlier Supabase-specific handoff documentation with that choice and verify the hosted path.

### 2026-11-08 UTC — Phase 3 — IN_PROGRESS

- Added the Atlas adapter, hosted WSGI API, outbound HTTPS worker and operator commands, pinned cloud requirements, Docker configuration, and offline API tests. Updated the worker transport seam, diagnostics, master and interface documentation, runbook, setup guide, and environment template.
- Selected Render's Docker Web Service as the initial host. Workers use one token per role and never connect to Atlas. The API runs the existing bounded SQLite policy against a disposable per-job snapshot. Atlas stores that snapshot separately from immutable checkpoint bytes and publishes accepted updates in one majority-write snapshot transaction. Concurrent writes to the same job are retried against fresh state within a five-second operation budget. This keeps the local and hosted policy in one implementation. Whole-job snapshots and the dedicated two-worker deployment are deliberate demo limits.
- `.venv/bin/python -m unittest discover -s tests -v` passed 21 tests in 42.216 s. The offline API exercised missing credentials, wrong roles, stale request timestamps, corrupt bytes, private transfer, valid lease handoff, old-epoch rejection, and the audit chain. The API test used fixture bytes and a local repository, while the existing local training tests ran real PyTorch. The 200-step local run again resumed at step 121 with a maximum loss difference of 0. The targeted foundation and cloud suites passed after follow-up edits.
- `.venv/bin/python -m compileall -q liferaft tests`, `./node_modules/.bin/tsc --strict --noEmit web/src/lib/contracts.ts`, `git diff --check`, and `git check-ignore -v .env.primary .env.standby .env.operator` passed. Cloud doctor correctly refused to run without a configured coordinator URL.
- The Docker daemon was unavailable. Render deployment, Atlas driver connectivity and transactional behavior, and physical two-laptop recovery are unverified. No hardware changes. The current API uses authenticated coordinator-mediated transfer and rejects requests older than 30 seconds. Expiring signed URLs and the active cloud doctor lease, transfer and integrity checks remain Phase 3 work.
- Team action. Follow `docs/PHASE_3_ATLAS_SETUP.md` to create the Free Atlas cluster and database-scoped user, publish the code branch, configure the Render service and its allowlisted egress, and provision the two laptops. Secrets stay in the password manager, Render settings, and the intended device's ignored profile. Next is the hosted auth smoke test followed by the two-laptop injected drill. Retain the local Phase 2 demo as the fallback.

### 2026-11-08 UTC — Phase 3 — Offline recovery verification

- Ran an inline harness with `PYTHONPATH=tests .venv/bin/python -`. It used the actual cloud request encoder, WSGI authorization and action handlers, worker adapter, and two CPU PyTorch workers with separate checkpoint directories. An in-process WSGI transport and disposable local repository replaced the network and Atlas. The only injected fault was the software cooling drill.
- The standby restored step 11, performed step 12 under epoch 2, and completed step 40. All 40 losses exactly matched the uninterrupted CPU baseline. The event chain verified. Offline detection-to-resume was 457.7 ms and no completed steps were lost. These measurements apply to the local harness.
- `curl -fsS --max-time 10 https://liferaft-coordinator.onrender.com/healthz` failed at DNS resolution in the execution shell. `.venv/bin/python -m liferaft cloud --profile operator doctor` also failed before contacting the hosted service. Computer Use controls were unavailable in this session and local socket bind was denied. No live service, database, monitor, or physical recovery result was observed.
- Next external gate. Run the authenticated doctor from the operator's normal Terminal, then follow `docs/PHASE_3_ATLAS_SETUP.md` for the independent two-laptop drill. Signed transfer URLs and the active diagnostic checks remain open in the Phase 3 checklist. No hardware actions were taken.
- The full Python suite passed 21/21 in 42.708 s. The TypeScript contract check and Git whitespace check also passed.

### 2026-11-08 UTC — Phase 3 — Live deployment audit

- In Brave, Render showed Docker Free live at commit `b3385b1`, and `GET /healthz` returned `{"ready": true}` after cold start. Render's two outbound CIDR ranges were both active in the Atlas allowlist. Public health checks establish web-process availability only.
- Atlas **Database Users** showed `liferaft-coordinator` with `readWrite @ liferaft.liferaft-demo`. The edit form confirmed `liferaft-demo` was entered in **Collection**. The coordinator uses `liferaft.job_state_v1` and `liferaft.checkpoint_objects_v1`. The role correction is pending approval. The setup guide now distinguishes database scope from cluster name and specifies how to verify the corrected role.
- Created UptimeRobot HTTP monitor `804591090` at `/healthz` with a five-minute interval and email alerts off. The first probe returned `404 Not Found`. Its free configuration uses `HEAD`, and the deployed handler accepts `GET` only. Added `HEAD /healthz` support and a regression test in `liferaft/cloud_api.py` and `tests/test_cloud.py`. The change is local. After deploying it, verify HTTP 200 with `curl -fsSI https://liferaft-coordinator.onrender.com/healthz` and confirm the monitor shows **Up**.
- `.venv/bin/python -m unittest discover -s tests -v` passed 22/22 in 44.863 s after the fix. Python compilation, strict TypeScript contract checks, and `git diff --check` passed. `git check-ignore .env.operator .env.primary .env.standby` confirmed all three profiles are ignored. An exact-match scan of the eight locally available Git commits found none of the three current role tokens.
- `curl -sS -i --max-time 15 https://liferaft-coordinator.onrender.com/healthz` failed DNS resolution from the execution shell. `.venv/bin/python -m liferaft cloud --profile <operator|primary|standby> doctor` could not reach the coordinator from that shell. Live authenticated Atlas access, rollback, immutability, negative API probes and cross-laptop recovery are open. No hardware action was taken.
- Next gate. Correct the Atlas user scope, deploy the health handler, and run the authenticated checks and two-laptop drill in `docs/PHASE_3_ATLAS_SETUP.md`. Signed transfer URLs and an active cloud doctor remain open implementation items.

### 2026-11-08 UTC — Phase 3 — Atlas scope and live health fixed

- Atlas now shows `readWrite @ liferaft` for `liferaft-coordinator`, restricted to the `liferaft-demo` cluster. This corrects access for the job-state and checkpoint collections. The roles dashboard confirms the permission change. An authenticated job write remains the functional check.
- `.venv/bin/python -m unittest discover -s tests -p test_cloud.py -v` passed 3/3 in 0.028 s, including the health `HEAD` regression test. `git diff --check` passed. The GitHub integration returned HTTP 403 for the write, so the signed-in GitHub editor published only the tested two-line runtime change. GitHub confirmed commit `107d744` on `main`, and Render showed that commit **Live** after a 19.4-second auto-deploy. The regression test and documentation edits remain in the workspace.
- UptimeRobot monitor `804591090` showed **Up** at the five-minute interval after a fresh check. The prior 404 incident showed **Resolved**. Render has `LIFERAFT_ENABLE_DRILLS=1`. All three local profiles point at the deployed Render origin.
- Next gate. Run the authenticated role doctors and the two-physical-laptop drill in `docs/PHASE_3_ATLAS_SETUP.md` §4. Live Atlas transaction rollback, immutable checkpoint writes, and independent recovery still need observed evidence. No hardware action was taken.

### 2026-11-08 UTC — Phase 3 — Laptop A preflight and create fix

- Laptop A's terminal reported `cpu_verified: true`. Both `cloud --profile operator doctor` and `cloud --profile primary doctor` returned `auth: true`, `database: true`, and the matching role. This confirms the live HTTPS and Atlas ping path for those roles.
- `cloud --profile operator create --job campus-drill-01` failed locally because the CLI omitted the required workload configuration fingerprint. It failed before sending the job request. `liferaft/cloud.py` now includes the workload's existing `CONFIG_FINGERPRINT` in `JobSpec`.
- `.venv/bin/python -m unittest discover -s tests -p test_cloud.py -k create_cli -v` reproduced the missing-field failure before the fix. After the fix, the cloud suite passed 4/4, including CLI creation through the real WSGI handler with local persistence and a worker readback of the fingerprint. `.venv/bin/python -m unittest discover -s tests -v` passed 23/23 in 43.861 s. `git diff --check` passed.
- Retry the same create command from Laptop A. The CLI-only fix does not require a Render redeploy or a change on Laptop B. A live Atlas job write and the two-laptop drill remain open.

### 2026-11-08 UTC — Phase 3 — Cross-laptop crash recovery verified

- For `campus-drill-01`, the shared terminal logs show CPU PyTorch verified on Laptop A (macOS ARM64) and Laptop B (Windows AMD64). All three role doctors authenticated and reached Atlas, and the operator created the job with Laptop B registered as standby.
- Laptop A committed checkpoint step 70 under epoch 1 and printed real training through step 78 before a `KeyboardInterrupt`. The operator requested the injected cooling drill, and the event export records `PRIMARY_UNREACHABLE` and `LEASE_EXPIRED`. This was recovery after a primary worker interruption.
- Laptop B restored step 70 with SHA-256 `fb0d9c1950044c48687708d066ef04729485fb672a4f735dcc3d138e5ab550ce`, matching Laptop A's committed checkpoint and the coordinator's transfer and resume evidence. It advanced to step 71 under epoch 2 and the supplied Windows log records training through step 183. Coordinator detection to first resumed step was 14.384 s. Coordinator-reported lost progress is unknown because there was no graceful yield.
- Independently recomputed and matched all 46 event hashes in `.liferaft/campus-drill-01.jsonl` using the coordinator's canonical encoding. That export ends at step 120, and the latest supplied status is `VERIFIED_RESUMED`. A new `cloud --profile operator status --job campus-drill-01` call from the execution shell returned coordinator unavailable. Next evidence is the final status from Laptop A's normal Terminal with `state: COMPLETED`, `owner: laptop-standby`, `epoch: 2` and `last_step: 200`. No hardware action was taken.
- Laptop A subsequently reported `state: FAILED`, owner `laptop-standby`, epoch 2, last recorded step 180 and no active lease. The watchdog transitions a resumed job to `FAILED` when its standby lease expires. A manual standby termination is consistent with the result, but the shared Windows log ends mid-line and does not identify the exit cause. The handoff passed, while the finish-to-step-200 check failed. Retry with a fresh job ID and keep the standby running until the coordinator records completion.

### 2026-11-08 UTC — Phase 5 — physical ESP32 board-only gate passed

- Actual native USB chip query identified ESP32-S3 revision 0.2, quad flash
  16 MB, embedded PSRAM 8 MB and a 40 MHz crystal. COM socket did not enumerate
  with the available C-to-C connection; native USB did. User performed BOOT/RST
  to enter download mode, changing the native port from COM7 to COM8.
- Hardware tool commands use `.liferaft/hardware-tools/Scripts/python.exe`.
  `-m esptool --port COM8 --before no-reset --after no-reset --no-stub
  --connect-attempts 2 flash-id` passed. `read-flash 0 ALL` saved all 16,777,216
  bytes in 105.2 s under ignored `.liferaft/esp32-original-20261107/`.
  Backup size and SHA-256 were verified locally; raw flash is not published.
  Backup restoration is NOT tested.
- Added `hardware/esp32/platformio.ini`, `hardware/esp32/src/main.cpp`,
  `hardware/esp32/README.md`, `scripts/esp32_capture.py`. Updated hardware readiness
  notes and this tracker only; Phase 3 code and cloud settings unchanged. Platform
  8.0.0 and Arduino 3.3.12 build a USB-only test with no accessory GPIO, Wi-Fi,
  relay or cloud actions. `PLATFORMIO_CORE_DIR` points at ignored `.liferaft/pio`;
  build outputs stay under `.liferaft/esp32-build`.
- `python -m platformio run --project-dir hardware/esp32` passed in 554.96 s
  including first-time tool downloads. Flash use 314,434 bytes, RAM 22,336 bytes;
  application binary 319,632 bytes. `esptool image-info` confirmed a valid S3
  bootloader with 16 MB flash header, despite the base board's N8 display title.
- The first upload was interrupted. Checked for active uploader processes and
  re-enumerated USB before proceeding. A bounded capture found zero test lines.
  `python -m platformio run --project-dir hardware/esp32 --target upload
  --upload-port COM8` then passed in 8.13 s, with written-data hashes verified
  for all four uploaded components. No full-chip erase or eFuse writes.
- The initial post-upload capture also correctly failed (no samples). Espressif
  documents that native USB default reset can retain manually entered download
  mode. `esptool --port COM8 --before no-reset --after watchdog-reset --no-stub
  --connect-attempts 2 flash-id` performed the supported full reset. This was
  an ESP32 application-start reset, not a Pi shutdown, power or thermal change.
- `python scripts/esp32_capture.py --port COM8` then passed: three real banners,
  sequence 4/5/6, uptime 8008/10008/12008 ms, observed
  `2026-11-08T03:05:26.645250+00:00`. Local proof is
  `.liferaft/esp32-original-20261107/board-only-proof.json`. Application SHA-256:
  `1982413572b9793d4da285226d2f6ca8f1499bd3fa1001d37674609f2ea4ed26`.
  The capture's Bluetooth COM3 negative check was rejected before opening it.
  Python compilation and `git diff --check` passed.
- Still NOT TESTED: accessory pinout, button, OLED, temperature sensor, combined
  firmware, sensor cloud forwarding and physical-button recovery. No jumper wires
  or accessories were attached. Pi remains uncooled, without training; relay stays
  disconnected. User's resistor color sequence identifies a 4.7k candidate but its
  value was not measured. Need separate button photo, readable sensor marking and
  sensor-board rear traces before the next wiring step. This is a board-only gate,
  not completion of Phase 5 or cloud integration.

### 2026-11-08 UTC — Hardware report and publication validation

- Completed `docs/HARDWARE_PROGRESS_REPORT.md` and a 200-word shareable summary
  in `docs/HARDWARE_SHARE_SUMMARY.md`. Included the staged Windows standby guide
  after reviewing its scoped-token instructions. Marked Phase 4 host preparation
  in progress without checking its cooling/training/recovery gate.
- Resolved the `PHASE_TRACKER.md` upstream/stash conflict by retaining both the
  software team's cross-laptop handoff and later completion failure, and the
  hardware board-only proof. No conflict markers or unmerged paths remain.
- `.venv/Scripts/python.exe -m unittest discover -s tests -v`: PASS, 26 tests,
  108.241 s on Windows. Real 200-step checkpoint/resume test resumed at step 121
  and maximum same-host loss difference was 0.0. These are local Windows test
  results; neither Pi training nor integrated physical-sensor recovery is implied.
- `.venv/Scripts/python.exe -m compileall -q liferaft scripts tests`,
  `git diff --check`, and `git diff --cached --check`: PASS. Staged scan checked
  all 15 files against private local-profile values, credential patterns,
  prohibited raw artifact paths and merge markers: no findings. Private profiles,
  original flash backups and compiled binaries remain ignored and uncommitted.
- Phase 3 source and deployment configuration were not edited by this hardware
  publication. No TypeScript changes or TypeScript validation are claimed.
  On-Pi health service installation, accessory wiring/tests, combined firmware
  and full physical-button cloud recovery remain NOT RUN.

### 2026-11-08 UTC — Hardware base handoff; breadboard accessories deferred

- Operator supplied temperature breakout and OLED front/back photos and explicitly
  postponed their tests until later breadboard assembly. Recorded exact visible
  header order and orientation in `docs/HARDWARE_CONNECTION_REFERENCE.md`:
  temperature G/R/Y with S nearby; OLED front GND/VCC/SCL/SDA; native ESP32 USB
  connection verified previously. The operator reports no sensor-back markings.
  Sensor supply/data assignments and OLED ratings are not inferred from photos.
- External button and all breadboard wiring remain deferred with that assembly.
  Base hardware evidence remains the verified Pi setup and actual ESP32 USB-only
  application test. No additional flash, GPIO operation, accessory wiring,
  Pi workload or cloud setting change was performed for this documentation step.
- Updated readiness/progress notes to distinguish the current deferral from the
  earlier request for immediate component identification. Phase 4/5 remain
  incomplete; no sensor or whole-system completion claim was added.
- Validation: `git diff --check`. Documentation-only change; no additional
  firmware tests or full regression rerun required. Earlier 26-test publication
  and real board-only serial evidence remain recorded above.

### 2026-11-08 UTC — Phase 3 — Graceful cross-laptop handoff verified

- `campus-drill-02` records an injected cooling drill, a primary pause request, checkpoint commit and `PRIMARY_YIELDED` at step 30. Windows claimed epoch 2, restored the same SHA-256 verified checkpoint, and completed measured step 31. Detection-to-resume was 6.384 s, with zero steps lost at the handoff.
- Independently recomputed all 52 event hashes in `.liferaft/campus-drill-02.jsonl`. The exported prefix ends with the standby checkpoint at step 140. The operator reports the standby progressed to step 157 before it was manually stopped. The run proves graceful cloud handoff; completion at step 200 was not observed.
- For the next run, leave the standby running until it commits the step-200 checkpoint, acknowledges completion and exits. The worker has a 0.4 s delay between steps in addition to network and checkpoint time. A fresh run can preserve the completed first and second drill evidence. `git diff --check` passed for this documentation-only update.

### 2026-11-08 UTC — Phase 3 — Full two-laptop drill passed

- `campus-drill-03` finished `COMPLETED` with `laptop-standby` owning epoch 2 at step 200. The exported events record the injected rescue request, Mac checkpoint commit and graceful yield at step 48, matching SHA-256 through lease transfer, and measured Windows training at step 49. The Windows worker committed the final step-200 checkpoint and recorded `JOB_COMPLETED`.
- Detection-to-first-resumed-step was 5.398 s, with zero steps lost at handoff. Independently recomputed all 70 hashes in `.liferaft/campus-drill-03.jsonl` and matched the complete event chain. `git diff --check` passed for this documentation-only update.
- The two-laptop recovery gate is verified. Phase 3 remains in progress for its other unchecked security and live transaction checks.

### 2026-11-08 UTC — Software gateway for the button drill

- Added a one-shot, bounded USB bridge and an optional gateway-only HTTPS action. The coordinator rejects the action when drills are disabled, validates the typed ESP32 frame again, and links the injected sensor event to the existing rescue transaction. Repeated delivery of the same frame returns the same incident. The gateway cannot read job data, upload checkpoints, claim leases or call the operator rescue action.
- `.venv/bin/python -m unittest discover -s tests -v` passed 28 tests in 44.804 s, with two live checks skipped. `.venv/bin/python -m compileall -q liferaft tests`, `git diff --check`, and `git check-ignore .env.gateway` passed.
- `PYTHONPATH=tests .venv/bin/python -` exercised a synthetic serial frame through the bridge parser, WSGI API, disposable local persistence and real PyTorch workers. The primary yielded at step 15, the standby resumed at 16 under epoch 2, and the job completed step 30 with zero lost steps and a verified event chain. The serial input and cloud transport were simulated for this run.
- Added opt-in hosted authorization and isolated Atlas rollback/immutability checks in `tests/test_cloud_live.py`. `LIFERAFT_TEST_HOSTED=1 .venv/bin/python -m unittest discover -s tests -p test_cloud_live.py -v` stopped at the coordinator preflight. The execution shell could not resolve the Render host. The isolated Atlas test was skipped because no test URI was configured. These live gates, signed transfers, and the physical button drill remain open.
- Next step is gateway provisioning and deployment, then a real serial frame from Ved's button-only firmware and the Windows bridge command in `docs/PHASE_3_ATLAS_SETUP.md` §5. No hardware was accessed or changed.

### 2026-11-08 UTC — Laptop B button firmware and private gateway preparation

- Reviewed main `82c31f7` and the merged gateway implementation. It supplied the
  bridge/API/strict schema but no button-only firmware; installed source still
  contained only the USB hello. USB enumeration in this session lists Bluetooth
  COM3–COM6 only, with no connected ESP32. No serial monitor or bridge is holding
  an ESP32 port; no physical button press is claimed.
- Installed `pyserial==3.5` in the existing project `.venv`. Created `.env.gateway`
  with exclusive creation, the correct Render origin, actual newlines and a new
  private token. Token was not displayed. Verified ignored status, correct origin
  and valid 64-character hex format without printing its value. `pip check` passed.
- `python -m liferaft cloud --profile gateway doctor` reached the coordinator but
  returned HTTP 401. Server-side acceptance/deployment is unverified; the service
  account holder must privately set matching `LIFERAFT_GATEWAY_TOKEN`, retain
  drills enabled and deploy the merged gateway code. No Render secret changed by
  this session and no rescue requested.
- Added separate `button_only` PlatformIO environment and source, preserving the
  default board-only environment. GPIO5 is input with pull-up; 75 ms debounce,
  stable release before initial trigger, no held repeat, 500 ms event gap. It
  emits the exact injected COOLING_FAILURE_TEST frame, no fabricated ambient
  measurement. No sensor/OLED/Wi-Fi/relay/power-control functions are enabled.
- `python -m platformio run --project-dir hardware/esp32 --environment button_only`
  passed in 39.738 s, with program flash 315,206 bytes and RAM 22,344 bytes. This
  firmware was NOT uploaded because the board is not connected. An extracted
  actual firmware printf format produced a synthetic 201-byte frame that passed
  strict ButtonEvent validation and the existing bridge parser; this is format
  evidence, not a physical event.
- `.venv/Scripts/python.exe -m unittest discover -s tests -p test_cloud.py -v`
  passed 6/6 in 8.601 s. Compilation of the new local checker and Git whitespace
  checks passed. Added `scripts/esp32_button_check.py` using the teammate's actual
  parser, a 45 s deadline, explicit native USB port selection, no cloud request,
  and automatic port close. Added `hardware/esp32/BUTTON_SETUP.md` with exact
  account-holder instructions and physical prerequisites.
- Required human actions: reconnect ESP32 native USB with accessories removed;
  supply separate-button photo before terminal-specific wiring; have the Render
  account holder provision the matching private gateway token. Then engineer can
  upload, check an actual press locally, release the port, rerun gateway doctor,
  and arm against a fresh agreed job only when primary/standby are ready. Physical
  press, deployed gateway auth and real button-triggered recovery remain open.

### 2026-11-08 UTC — Gateway authentication verified; physical button test next

- Rechecked the existing `.env.gateway` without regenerating its credential.
  `git check-ignore .env.gateway` passed; project environment reports pySerial
  3.5. The pasted command's malformed URL/newline is not used.
- `.venv/Scripts/python.exe -m liferaft cloud --profile gateway doctor` exited 0
  at `2026-11-08T04:50:33.614973+00:00` and returned `auth: true`,
  `database: true`, `role: gateway`. This supersedes the earlier 401 blocker.
  No token or Render secret was printed or changed during this check.
- USB enumeration currently shows only Bluetooth COM3–COM6, no ESP32. No serial
  monitor is open, no button firmware uploaded and no rescue request sent in this
  session. Human next step: unplug USB, present separate button/breadboard for
  terminal and row identification, then follow exact unpowered wiring instructions.
- Profile/dependency preparation and authenticated gateway doctor are complete.
  Real button-frame emission and end-to-end button-triggered recovery remain open;
  doctor alone is not evidence of either. Temperature/OLED stay disconnected.

### 2026-11-08 UTC — Button module identified from operator videos

- Inspected extracted frames from both supplied local videos (27.17 s / 76.41 s).
  The second shows a three-pin KY-004-style tactile switch breakout, S at left
  and - at right with component side facing the viewer and pins down. Middle
  pin remains unlabeled. Breadboard row/column markings are visible. Exact part
  vendor is unconfirmed; matching primary Joy-IT documentation describes the
  switch connecting signal to ground.
- Updated button/setup reference for a two-wire S/- test using GPIO5 INPUT_PULLUP,
  with center pin unconnected; no module supply, sensor, OLED or resistor wiring.
  First human step is unpowered breadboard placement and a still showing actual
  ESP32 header alignment; no exact GPIO jumper row is assumed before that check.
- Added video-decoding helpers to the isolated hardware tools only; extracted
  inspection images stay ignored under `.liferaft/video-review/`. No media or
  credentials uploaded/committed. `git diff --check` passed.
- Serial enumeration still shows Bluetooth ports only. No ESP32 flash, physical
  press, bridge arming or rescue occurred during video review. Earlier live
  gateway doctor remains passed; hardware frame and integrated drill remain open.

### 2026-11-08 UTC — Physical button USB frame verified on Laptop B

- Operator reported unpowered placement with ESP32 headers a1 through i22,
  GPIO5 at i18 accessible via j18, ground at i1 via j1, and button header in
  separate a30/a31/a32 rows. Instructions connect S to GPIO5 and - to GND, leaving
  middle pin unconnected. Operator declined an assembled-wiring photo and reported
  completing the connections; wiring is operator-reported, not visually inspected.
- Native USB reconnected on COM8. Button-only PlatformIO upload passed in 8.976 s;
  all written sections were hash-verified. Application is 320,496 bytes with
  SHA-256 ba9418ba07ce97ce3d22f6df6216da640dc5983d6477bd4dfab1b88eea4382d4.
- Passive serial read observed three LIFERAFT_BUTTON_READY messages, then closed
  the port. `python -m scripts.esp32_button_check --port COM8` armed locally and
  accepted a physical press through the actual bridge parser: protocol 1,
  esp32-s3-01, seq 1, uptime 54483 ms, ambient null/invalid, button true,
  COOLING_FAILURE_TEST, source injected. Exited 0; port released; no cloud request.
  Retained evidence: `.liferaft/button-proof/first-physical-press.json` (ignored).
- Existing standby and gateway doctor commands both exited 0 with auth/database
  true and matching roles at 2026-11-08T05:20:34/35 UTC. Training doctor exited 0
  with PyTorch 2.15.0+cpu and cpu_verified true on Windows. No token regenerated.
- Laptop B preparation and real button-frame gate are complete. Full cloud
  physical-button recovery is NOT yet demonstrated. Need Laptop A to create a
  fresh agreed test job; next start Laptop B standby, verify readiness, start
  Laptop A primary, arm bridge, press once after a committed checkpoint, and
  retain final completion/event-chain evidence. No new job or rescue was issued
  by this hardware session yet. OLED, temperature sensor and relay untouched.

### 2026-11-08 UTC — campus-button-03 blocked; standby exit under investigation

- Operator supplied Windows bridge output: armed at 05:50:34 UTC, then
  BUTTON_REQUEST_RECORDED (injected) at 05:51:07 UTC with incident
  inc-45f4184f0de244efba2603097a7c1703. This establishes a physical serial frame
  reached the authenticated coordinator; it does not establish a successful
  RESCUE_REQUESTED transition or recovery.
- Operator armed a second bridge against the same job at 05:51:59 UTC; a new
  request received HTTP 422 at 05:52:21 UTC. The policy rejects a new drill if the
  primary is not PRIMARY_RUNNING or its lease expired. This is a separate press,
  not an automatic retry of the first frame. Exact rejection reason is hidden by
  the generic API response and is not independently proven from this output.
- Supplied Mac status at 05:52:47 UTC reports RECOVERY_PENDING, owner
  laptop-primary, epoch 1, last_step 55, no active lease, no selected checkpoint,
  STANDBY_UNAVAILABLE and standby_ready false. Its incident differs from the
  first button acknowledgment. No transfer, first resumed step or completion
  result is present; do not mark the drill passed or label it a graceful yield.
- Read-only Windows process inspection at 05:54 UTC found no running liferaft
  worker. The cloud-standby directory created around 05:50 UTC contains no files.
  This does not identify why the worker exited. Requested the original Windows
  standby terminal's full output/error before modifying software or retrying.
- No bridge rearmed, job state changed, worker restarted or lease extended by
  this investigation. Preserve the failed job and exported events. Root cause
  remains open pending standby exit evidence; do not assume user termination,
  four-minute deadline, transient HTTPS error or a firmware fault.

### 2026-11-08 UTC — campus-button-03 late standby recovered to completion

- Operator reported running standby and bridge in the same PowerShell. This
  does not preserve concurrent processes; exact original standby exit output was
  not retained, so its exit cause is not independently established.
- Authorized small real-cloud recovery test: assistant launched the existing
  standby command for campus-button-03 as a separate managed process, with all
  output saved to ignored `.liferaft/button-proof/campus-button-03-late-standby.jsonl`.
  No primary launched, new job created, sensor frame injected or bridge rearmed.
- Worker restored actual cloud checkpoint step 50, SHA-256
  5a295ea49175c97993f379808f1e4be2265bee0ec455ec92df8dc03fb1d522d2,
  claimed epoch 2, executed real optimizer steps 51 through 200 and exited 0 after
  coordinator completion returned true. Final measured loss 0.014667629264295101.
  Verified all 150 emitted steps are contiguous and carry job/epoch identity;
  resumed training elapsed 74.761 s. Local summary
  is `.liferaft/button-proof/campus-button-03-recovery-summary.json`.
- This proves late cloud checkpoint recovery and accepted completion. It does
  NOT retroactively turn the original blocked button drill into a successful
  immediate button handoff. The physical button reached the coordinator earlier,
  but the primary later lost its lease and the standby was started after the
  reported RECOVERY_PENDING/STANDBY_UNAVAILABLE state. RPO is not claimed zero;
  authoritative final status/event-chain review remains with Laptop A's operator.
- For a fresh automatic drill, keep standby running separately from the one-shot
  bridge, pre-open terminals and logs, and verify readiness before pressing once.
  Do not repeat presses against a non-running/completed job. Hardware unchanged;
  Pi, relay, temperature sensor and OLED untouched.

### 2026-11-08 UTC — Operator confirmed campus-button-03 completion

- Operator on Laptop A ran the requested final status command. Hardware operator
  relayed that all expected fields matched: state COMPLETED, owner laptop-standby,
  epoch 2 and last_step 200. This is operator-reported authoritative status,
  consistent with the locally observed standby exit 0 after accepted completion.
- Gate classification remains: physical USB button delivery verified; subsequent
  late standby cloud checkpoint recovery and completion verified. The original
  immediate button handoff was blocked by STANDBY_UNAVAILABLE, so no fresh
  automatic button-triggered handoff or event-chain linkage is claimed complete.
- No further press or rerun is required for this completed job. A future fresh
  automatic drill must keep standby and bridge in separate concurrent processes.
  No firmware, cloud settings, wiring or credentials changed for this confirmation.

### 2026-11-08 UTC — Reproduced/fixed standby readiness race; campus-button-04 completed

- Operator's screenshot shows a genuine bridge acknowledgment for campus-button-04
  at 06:04:42 UTC, followed by standby `download (HTTP 403)` at 06:04:49 UTC.
  Kept failed-transfer evidence; no firmware or wiring fault is inferred.
- Reproduced CHECKPOINT_NOT_OFFERED HTTP 403 through the actual offline WSGI API
  and policy: advance the controlled clock seven seconds between a valid offer
  and download, allowing the six-second standby freshness window to expire.
  Added the regression before the production fix and observed its 403 failure.
  This demonstrates a code path consistent with the screenshot; no hosted server
  trace was available to independently establish the original request timing.
- Fixed only the outbound CloudWorkerCoordinator: refresh the authenticated
  standby's own presence before checkpoint download and before ownership claim
  after restore. No role, state, epoch, lease or checksum check is bypassed or
  extended. The regression also verifies direct stale download remains denied,
  stale claim returns STOP, and the wrong role still cannot download. Existing
  fencing/integrity tests pass. No coordinator code change is needed.
- Cloud suite passed 7/7 in 4.595 s. Full Windows suite ran 31 tests in 110.776 s,
  OK with 2 opt-in hosted/isolated-Atlas tests skipped. The real 200-step local
  training test resumed at 121 with maximum loss difference 0.0. Compilation and
  Git whitespace checks passed. Updated setup docs with the freshness failure
  and safe retry guidance.
- After confirming no active Windows worker, ran patched standby against the
  existing campus-button-04 as a separate managed process, retaining output in
  ignored `.liferaft/button-proof/campus-button-04-fixed-standby.jsonl`.
  It restored checkpoint 30, SHA-256
  1672ae2f7d90063b7e2b8efa219d2176af5a0fcbfd6b828c06595328a9f007f2,
  claimed epoch 2 and executed every step 31 through 200. Observed exit code 0
  after coordinator completion acceptance. Final loss 0.014667626470327377;
  170 real optimizer steps over 85.345 s. Retained a local parsed proof summary
  in `campus-button-04-fixed-summary.json`. No synthetic sensor frame or extra
  button request was sent by the assistant.
- This is successful late recovery with the fixed client, not proof that the
  original standby survived the whole button handoff. A fresh uninterrupted
  physical drill and operator event-chain review remain open. Laptop A can
  confirm final status with its existing operator role. Pi/OLED/temperature/relay
  unchanged; profiles, backup binaries and runtime evidence remain untracked.

### 2026-11-08 UTC — Uninterrupted physical-button drill passed

- `campus-button-05` completed at step 200 with `laptop-standby` owning epoch 2. The operator and standby ran on separate laptops. The saved journal links the physical ESP32 event labeled `injected` to `RESCUE_REQUESTED` for the same incident.
- The Mac committed checkpoint step 25 and yielded. The standby received the matching SHA-256 checkpoint and ran measured step 26. Detection to the first resumed step was 6.534 s, with zero steps lost at the handoff. `JOB_COMPLETED` confirms the standby finished step 200.
- Independently recomputed and verified all 79 hashes in `.liferaft/campus-button-05.jsonl`. Phase 5's button-to-recovery milestone is complete. The OLED and ambient temperature sensor remain separate open items.

### 2026-11-08 UTC — Nemotron incident investigation implemented

- Added `liferaft investigate`, a hosted NVIDIA client, and typed read-only `get_incident` and `get_rescue_verification` tools. The command verifies the saved event chain before the three-request exchange and validates the report and its citations. It emits the tool trace alongside the model's interpretation.
- Loaded the actual `campus-button-05` export and verified that the projected tools expose the injected button event, lease transfer, measured resume, and completion. The provider exchange was tested with a mock HTTP response. `.venv/bin/python -m unittest discover -s tests -v` ran 33 tests in 48.403 s, with 31 passing and two opt-in cloud checks skipped. Compilation and `git diff --check` passed.
- The live run from this checkout stopped at the missing `NVIDIA_API_KEY` check. An unauthenticated NVIDIA endpoint probe timed out from the execution shell. Live verification remains open. On the dashboard Mac, configure the key in the ignored `.env` and run `.venv/bin/python -m liferaft investigate --job campus-button-05` from the repository root.
- Pranav's Mac is the dashboard station. Ved's Windows laptop is the Raspberry Pi connection point. The investigator reports worker identities from each job export, including older runs that used the Mac as a training worker.

### 2026-11-08 UTC — Live Nemotron investigation passed

- Pranav ran `.venv/bin/python -m liferaft investigate --job campus-button-05` on the dashboard Mac with an NVIDIA Build key. The supplied terminal output shows `NEMOTRON_INVESTIGATION` from `nvidia/nemotron-3.5-lightning-30b-a3b` with both read-only tool calls and a structured report. Independently matched all eight cited event IDs against the saved verified event export.
- The report traces the injected button drill, checkpoint step 25, lease transfer to epoch 2, measured resume at step 26, and completion at step 200. The tool evidence records 6.534 s recovery time and zero steps lost. The dashboard integration and additional diagnostic tools are outside the demonstrated CLI scope.
### 2026-11-08 UTC — OLED bring-up prepared; wiring and physical test pending

- Reused saved front/rear photos and videos plus operator's GND/VCC/SCL/SDA
  order. Found the matching GoldenMorning GME12864-11/12/13 manufacturer page,
  specifying SSD1306, 128x64, I2C and 3.3–5 V. This supports a 3.3 V bench plan;
  it does not prove the physical unit's operation. Source:
  https://goldenmorninglcd.com/oled-display-module/0.96-inch-128x64-ssd1306-gme12864-11/
- Read hardware runbook and display requirements. First test shows LIFERAFT /
  TEST BOARD, labeled LOCAL DISPLAY TEST / CLOUD: NOT LINKED / TEMP: NO SENSOR.
  Rescue success must later require actual coordinator verification; no fake
  rescue animation, cloud state or temperature is implemented in the test.
- Added separate oled_test environment and src/oled_test.cpp with pinned official
  Adafruit SSD1306 2.5.17, GFX 1.13.0 and BusIO 1.17.4. Verified current official
  headers before using the Wire constructor and begin signature. SDA GPIO8,
  SCL GPIO9, 100 kHz bus, 50 ms timeout. Probe 0x3C/0x3D and fail explicitly on
  zero/two responses or initialization failure. USB status checks acknowledge
  presence but still require the operator to confirm actual visible text.
- `python -m platformio run --project-dir hardware/esp32 --environment oled_test`
  passed in 69.281 s; flash 380,450 bytes, RAM 23,856 bytes. Build files/libraries
  remain under ignored .liferaft paths. Firmware has NOT been uploaded and OLED
  has NOT been powered or detected by this session. Git whitespace check passed.
- Added hardware/esp32/OLED_SETUP.md with unpowered placement: for unchanged ESP32
  a1-i22 layout, OLED GND/VCC/SCL/SDA at a40/a41/a42/a43, jumpers b40-j3 (GND),
  b41-j21 (3V3), b42-j8 (GPIO9), b43-j11 (GPIO8). Printed labels must match before
  power. Existing button can stay wired, but oled_test emits no rescue frames.
- Current one-shot gateway cannot read job status or keep OLED synchronized after
  exit. DISPLAY_STATUS command validation and an authorized status transport are
  still combined-integration work; no gateway permissions or cloud code changed.
  User next action is unpowered OLED wiring, then reconnect USB for upload and
  observed I2C/visible-display verification. Temperature/relay/Pi untouched.

### 2026-11-08 UTC — OLED test uploaded; no I2C acknowledgment yet

- Operator reported OLED connected and external button disconnected to free a
  ground connection. Re-enumeration identified native Espressif USB on COM8.
- `platformio run --project-dir hardware/esp32 --environment oled_test --target
  upload --upload-port COM8` passed in 9.856 s. All written sections passed hash
  verification; application binary 387248 bytes, SHA-256
  83144f8134f5510ffd415d2b845e246cdf0bb1c229c2fcb214767150545eb2cf.
- Bounded serial capture received three actual OLED_NOT_DETECTED reports, uptime
  12044/14044/16044 ms, address 0. Neither supported 0x3C/0x3D address acknowledged
  on GPIO8 SDA / GPIO9 SCL. Local raw proof is ignored under .liferaft/oled-proof/.
  Serial port was closed. No visible pixels/display success is claimed.
- Physical wiring/power/connection inspection is the next action with USB
  unplugged. Keep supply at 3.3 V, verify printed pin labels and distinct
  breadboard rows; do not increase to 5 V or rewire while powered. Exact cause
  is not established. Button stays disconnected during OLED bring-up; no rescue,
  cloud-state command, relay or Pi action was performed.

### 2026-11-08 UTC — OLED detected after SDA/SCL correction

- Operator clarified actual wiring: GND j1, VCC j21, SCL j11, SDA j8. Signal
  wires were reversed relative to the tested firmware's GPIO9 SCL / GPIO8 SDA.
  Instructed unplugging USB, swapping only signal wires, then reconnecting.
- After operator reported reconnect, bounded serial capture on native COM8
  observed three actual OLED_TEST_READY frames: uptime 20081/22081/24081 ms,
  address 60 decimal = 0x3C, local_display_test, cloud_connected false,
  ambient_valid false. Thus address acknowledgment and driver initialization
  are verified. The port was closed on completion.
- Corrected operator-reported map: OLED GND-j1 (GND), VCC-j21 (3V3),
  SCL-j8 (GPIO9), SDA-j11 (GPIO8). Button remains disconnected. Local proof
  retained at `.liferaft/oled-proof/corrected-wiring-093113.json` (ignored).
- Still requires operator confirmation of visible LIFERAFT / TEST BOARD text;
  acknowledgment alone is not proof of correct pixels. No cloud display state,
  measured ambient temperature, rescue completion or combined button/OLED
  behavior is claimed. No new flash or cloud action performed in this check.

### 2026-11-08 UTC — Standalone OLED visible-output test passed

- Operator confirmed seeing all expected lines on the physical OLED: LIFERAFT,
  TEST BOARD, LOCAL DISPLAY TEST, CLOUD: NOT LINKED, TEMP: NO SENSOR.
  Combined with three actual OLED_TEST_READY reports at 0x3C, this completes
  the initial standalone display bring-up test. Visual confirmation is
  operator-reported; USB acknowledgment was independently captured.
- Verified/operator-reported wiring for unchanged a1-i22 ESP32 placement:
  OLED GND-j1, VCC-j21 (3V3), SCL-j8 (GPIO9), SDA-j11 (GPIO8).
  The earlier detection failure was resolved after correcting swapped signals.
- Button currently disconnected and oled_test firmware is installed. No combined
  button handling, live coordinator status, DISPLAY_STATUS command receiver,
  temperature reading or display disconnection test has been verified. Those
  remain separate integration gates; Phase 5 is not marked complete.

### 2026-11-08 UTC — Main synchronized and OLED changes validated

- Integrated origin/main through 11eca3d (Nemotron investigation CLI and updated
  physical-drill evidence), preserving both incoming notes and OLED bench proof.
- `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` ran 33 tests
  in 110.470 s: 31 passed, two opt-in live cloud checks skipped. Compilation
  (`python -m compileall -q liferaft scripts tests`) and Git whitespace checks
  passed. The commit-content scan found no local credential values, private
  runtime artifacts or unresolved merge markers in the six changed files.
- No new live cloud, Pi or hardware action was performed during synchronization.
  Combined button/OLED and live display status remain outstanding integration.

### 2026-11-08 — Autonomous software update 1 — Phase 3 HTTP boundaries

- Reject duplicate JSON keys, nonnumeric/nonfinite timestamps, truncated bodies,
  invalid action names and oversized non-transfer requests before policy dispatch.
- Files: liferaft/cloud_api.py, tests/test_cloud_boundaries.py.
- Ran `.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_cloud_boundaries.py -v`: 2/2 passed; `git diff --check` passed.
- No live service or hardware action. Hosted/Atlas checks remain opt-in; no human
  action requested in this software-only session. Next: expiring private transfers.
