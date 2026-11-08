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
- [ ] Deny anonymous/untrusted reads and fake device writes.
- **Gate:** actual cross-laptop recovery needs **no inbound campus-LAN access**.

### Phase 4 — Raspberry Pi 5 real worker — NOT_STARTED
- [ ] Pi boot, official power, compatible cooling verified in human safety steps.
- [ ] Pi OS/ARM64 PyTorch installation capability audited; no destructive system changes.
- [ ] Pi CPU temperature read-only; low-load training, cloud upload.
- [ ] Laptop A restores Pi-produced checkpoint, increments real training step.
- [ ] Document fallback if Pi cannot run PyTorch; no fake Pi compute indicator.
- **Gate:** Pi→laptop real rescue OR clearly recorded fallback with Pi telemetry.

### Phase 5 — ESP32-S3 sensor node, button and OLED — NOT_STARTED
- [ ] ESP32 revision/port/pinout checked; board-only USB serial hello.
- [ ] Button with pull-up/debounce emits *injected* test incident.
- [ ] OLED verified I2C voltage/address displays cloud-reported state.
- [ ] DS18B20 pinout/resistor inspected; valid ambient measurement + invalid handling.
- [ ] Python USB bridge forwards validated events via outbound HTTPS.
- [ ] Relay disconnected; no fan/Pi power switching; no real overheating.
- **Gate:** physical button causes real software rescue and OLED reflects confirmed state.

### Phase 6 — Deterministic risk + adaptive checkpointing — NOT_STARTED
- [ ] Separate Pi CPU and ambient sensor metric sources; timestamp freshness.
- [ ] Backup-ready and checkpoint-age awareness, policy cooldown/hysteresis.
- [ ] Bounded adaptive interval and measured overhead.
- [ ] Real RTO/RPO/continuity metrics, uncertainty properly represented.
- **Gate:** risk tests plus 3 measured scenarios pass without unsafe actions.

### Phase 7 — NVIDIA Nemotron tool agent — NOT_STARTED
- [ ] Verified live model/API setup behind configured adapter.
- [ ] Read-only typed diagnostic tool collection and bounded loop.
- [ ] Real multi-tool calls, evidence IDs and structured answer.
- [ ] Model cannot operate power, command line or leasing.
- [ ] Mock tests and real provider smoke test when credentials exist.
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
