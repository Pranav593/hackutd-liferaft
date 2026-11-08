# LIFERAFT — Codex phase tracker and real progress log

**Current status:** Phases 0–2 have local numerical/process proof, and recorded campus drills demonstrate real two-laptop recovery and physical-button delivery. Phase 7's live Nemotron demo is verified. Phase 3's signed transfers, paged evidence exports and per-job doctor are software-tested; their new hosted/live Atlas gates remain open. The Pi worker, edge monitor, adaptive scheduling, extended Nemotron tooling and Photon queue are implemented in software. The Next.js cockpit can replay verified saved journals locally. Physical Pi/sensor/OLED integration and Photon gates remain as listed below.

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
- [x] Implement expiring identity-bound binary transfer URLs and read-only per-job cloud doctor; offline positive/negative tests and real same-host signed-path training pass.
- [ ] Verify the new signed transfers and job doctor on the deployed coordinator; no new hosted evidence claimed.
- [ ] Verify immutable checkpoint writes and transaction rollback against live Atlas.
- [ ] Atomic lease claim/yield/reject stale epoch and cloud health checks.
- [x] Two independent computers access cloud over HTTPS; checkpoint round-trip verified.
- [x] Graceful Mac-to-Windows handoff completed all 200 training steps over hosted HTTPS (`campus-drill-03`).
- [ ] Deny anonymous/untrusted reads and fake device writes.
- **Gate:** actual cross-laptop recovery needs **no inbound campus-LAN access**.

### Phase 4 — Raspberry Pi 5 real worker — IN_PROGRESS (software implemented)
- [x] Boot, Pi 5 identity, ARM64 OS, Connect access, Python venv, public HTTPS and idle health observed; see `docs/HARDWARE_PROGRESS_REPORT.md`. Training/cooling and recovery gate remain open.
- [ ] Pi boot, official power, compatible cooling verified in human safety steps.
- [ ] Pi OS/ARM64 PyTorch installation capability audited; no destructive system changes.
- [ ] Pi CPU temperature read-only; low-load training, cloud upload.
- [ ] Laptop A restores Pi-produced checkpoint, increments real training step.
- [x] Scoped Pi worker, bounded host guard, separate CPU publisher and non-root service template.
- [x] Laptop-primary and Pi telemetry-only fallback documented.
- **Gate:** Pi→laptop real rescue OR clearly recorded fallback with Pi telemetry.

### Phase 5 — ESP32-S3 sensor node, button and OLED — IN_PROGRESS (firmware and bridge implemented)
- [x] Native USB enumeration, chip/flash identity, private original-flash backup, and real board-only USB serial hello verified on Windows.
- [x] External GPIO5 button emitted a real contract-valid injected USB frame; local monitor exited and released COM8. Gateway and standby cloud doctors passed.
- [ ] Exact PCB revision and accessory pinouts checked before accessory wiring; chip revision and board-only hello are verified above.
- [x] Wired button emits an *injected* test incident and triggers an uninterrupted cloud recovery (`campus-button-05`).
- [x] Combined firmware source, bounded monitor, separate ambient wire contract and verified-resume OLED logic.
- [ ] PlatformIO target build, physical flash and OLED verified I2C voltage/address displays cloud-reported state.
- [ ] DS18B20 pinout/resistor inspected; valid ambient measurement + invalid handling.
- [x] Python USB bridge forwards validated button events via outbound HTTPS, verified in `campus-button-05`.
- [x] One-shot button bridge and scoped coordinator action pass offline tests and the physical USB/Render drill.
- [ ] Relay disconnected; no fan/Pi power switching; no real overheating.
- **Gate:** physical button causes real software rescue and OLED reflects confirmed state.

### Phase 6 — Deterministic risk + adaptive checkpointing — IN_PROGRESS (software verified)
- [x] Separate Pi CPU and ambient sensor metric sources, timestamp freshness, and unavailable-score handling.
- [x] Standby readiness, checkpoint age, policy cooldown and hysteresis.
- [x] Bounded adaptive interval, single in-flight upload, and measured local checkpoint cost.
- [x] Real local RTO/RPO/continuity metrics, with unknown crash RPO.
- [ ] Repeat measured scenarios on the deployed coordinator and devices.
- **Gate:** risk tests plus 3 measured scenarios pass without unsafe actions.

### Phase 7 — NVIDIA Nemotron tool agent — DONE (demo scope)
- [x] Verified live model/API setup behind configured adapter.
- [x] Read-only typed incident and recovery-verification tools with a bounded exchange.
- [x] Real multi-tool calls, evidence IDs and structured answer.
- [x] Model has no power, command line, or leasing tools.
- [x] Mock tests and real provider smoke test for the original two-tool path.
- [x] Eight-tool extended mode, saved report and journal-matched UI trace pass offline tests.
- [ ] Repeat a live NVIDIA call with the extended tool set.
- **Gate:** actual provider trace from one incident; no fabricated results.

### Phase 8 — Photon two-way communication — BLOCKED_EXTERNAL (software implemented)
- [x] Photon 2.0 iMessage project-scoped send, signed webhook, durable bounded outbox, and dedupe exercised with fixtures.
- [x] `STATUS/WHY/CHECKPOINT/ACK/HELP`, incident-scoped Nemotron advisory handoff, and replay receipt display.
- [x] The queue reads recovery evidence independently and never runs provider calls in lease transactions.
- [ ] Provision a real project, key, direct space and signed webhook. Observe outbound notification, actual inbound reply and ACK.
- **Gate:** real phone/provider round trip correlated to incident.

### Phase 9 — Real-data operations cockpit — IN_PROGRESS (saved evidence replay)
- [x] Saved-evidence topology, recorded loss, checkpoint ledger and hash-verified flight recorder.
- [x] Replay labels, event provenance, explicit unknowns and no-data states.
- [x] Saved Nemotron trace validation and evidence links pass fixture tests.
- [x] Replay supports recorded Pi/ambient samples, risk decisions and Photon receipts when present.
- [ ] Live coordinator freshness, readiness scoring, measured sensor feed and Photon delivery/ACK in a running deployment.
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
- [x] Port cockpit to Next.js `web/` and bind to verified saved events
- [x] Use existing `prev_hash` chain with an explicit re-verification control
- [ ] Bind live data and compute Lifeboat Score from fresh telemetry

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

### 2026-11-08 — Autonomous software update 2 — Phase 3 capabilities

- Added HMAC-SHA256 transfer capabilities with a fixed 20-second lifetime,
  exact manifest/role/method binding, credential rotation invalidation, bounded
  parsing and future/expired-token rejection. URL alone will not authenticate.
- Files: liferaft/transfers.py, tests/test_transfers.py. No new dependency/key.
- Ran `python -m unittest discover -s tests -p test_transfers.py -v` using
  .venv Python: 2/2 passed; `git diff --check` passed. Baseline full suite:
  33 tests in 81.383 s, 31 passed, 2 opt-in cloud tests skipped; same-host real
  200-step training resume starts at 121, maximum loss difference 0.0.
- Capability module is not yet wired to HTTP. Live Atlas and new distributed
  transfers are NOT_RUN. Hardware untouched. Next: atomic binary transfer API.

### 2026-11-08 — Autonomous software update 3 — Phase 3 binary transfer API

- Added authenticated upload_url/download_url control actions and raw PUT/GET
  /v1/checkpoint with expiring HMAC capabilities. Each use rechecks current
  policy, epoch, readiness, exact size/hash and immutable transactional commit.
- Files: cloud_api.py, failover.py, test_cloud.py. Legacy scoped transfer actions
  remain compatible. No Atlas credentials or alternate storage service added.
- `.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_cloud.py -v`:
  8/8 passed in 2.489 s, including wrong-role/method, corrupt/truncated upload,
  immutable retry, successful roundtrip and post-transfer stale URL denial.
- No live deployment/Atlas/hardware run; Phase 3 stays IN_PROGRESS. Next: use
  binary transport in workers, with same-origin URL validation and size caps.

### 2026-11-08 — Autonomous software update 4 — Phase 3 worker binary transport

- Workers negotiate signed-v1 through authenticated doctor, upload raw verified
  bytes, download through expiring URLs and rehash locally. Older coordinators
  retain the legacy authenticated path for rolling compatibility.
- Reject absolute/foreign URLs, fragments and alternate routes before attaching
  credentials. Redirects remain disabled. Downloads and acknowledgments are capped.
- Files: cloud.py, cloud_api.py, test_cloud.py, test_cloud_transport.py.
- `.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_cloud*.py' -v`:
  15 tests, 13 passed, 2 live checks skipped in 2.463 s. `git diff --check` passed.
- Binary HTTP tested with offline policy and transport doubles; no new physical
  cross-device/live signed-transfer evidence claimed. Next: protocol documentation
  and bounded retries that preserve uncertain ownership outcomes.

### 2026-11-08 — Autonomous software update 5 — Phase 3 bounded transport retries

- Added at most three attempts with exponential jitter and a six-second request
  budget for read/idempotent actions and immutable binary transfers. Reuse the
  exact request and heartbeat/request IDs. No retry for start/claim/yield/resumed/
  complete/create when outcome is uncertain; worker fails closed.
- Retry only network failures and 429/502/503/504; permanent auth/validation errors
  stop immediately. Cap responses and hide private network/provider details.
- Files: cloud.py, test_cloud_transport.py. Ran `.venv` Python with
  `-m unittest discover -s tests -p 'test_cloud*.py' -v`: 18 tests in 2.608 s,
  16 passed, 2 live checks skipped. `git diff --check` passed.
- Faults are test-injected transport errors; no actual cloud outage induced.
  Next: stronger persistence fault coverage and isolated live test fixtures.

### 2026-11-08 — Autonomous software update 6 — Phase 3 persistence fault gauntlet

- Atlas artifact boundary now independently rejects corrupt bytes and cross-job
  access before database writes. Added actual repository algorithm tests with
  transactional doubles for state/artifact rollback, transient conflict retry,
  bounded exhaustion and uncertain-commit refusal. These are NOT live Atlas tests.
- Verified session/transaction methods against current official PyMongo docs:
  https://www.mongodb.com/docs/languages/python/pymongo-driver/current/crud/transactions/
- Installed existing pins with `.\.venv\Scripts\python.exe -m pip install
  pymongo==4.15.5 dnspython==2.8.0` (passed; no lockfile changes).
- `.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_atlas*.py' -v`:
  6/6 passed in 0.153 s; `git diff --check` passed. New repository tests skip if
  optional cloud packages are absent. Files: atlas.py, test_atlas_artifacts.py,
  test_atlas_transactions.py. Live rollback remains gated on isolated test Atlas.
- No hardware, production database or credentials touched. Next: complete,
  paginated event export without silently truncating recovery evidence.

### 2026-11-08 — Autonomous software update 7 — Phase 3 complete journal exports

- Replaced silent 500-event truncation with snapshot-head pagination (head sequence
  and hash). CLI events fetches all bounded pages and independently recomputes
  hashes, sequence, unique event IDs and exact job identity before printing.
- Concurrent appends stay outside the captured head. Invalid/stuck cursors, changed
  heads, oversized exports and older unpaged servers fail explicitly.
- Files: coordinator.py, cloud_api.py, cloud.py, evidence.py, test_event_export.py,
  test_cloud.py. Ran `.venv` Python `-m unittest discover -s tests -p
  test_event_export.py -v`: 4/4 in 0.684 s; test_cloud.py: 8/8 in 2.526 s;
  `git diff --check` passed. 515-event synthetic journal plus concurrent append
  verified; no production events changed.
- Hash verification is tamper detection, not remote attestation. Hosted paged
  endpoint NOT_RUN; next: shared evidence loader and deterministic handoff brief.

### 2026-11-08 — Autonomous software update 8 — Verified recovery evidence brief

- Added `liferaft evidence --job JOB --events FILE [--output NEW_JSON]` with
  atomic no-overwrite output. Derives continuity only from matching committed
  hash/step/producer, increasing ownership epoch and measured K+1 loss. Rejects
  simulated or inconsistent recovery proof; requires matching completion owner.
- RPO is unknown without a primary yield record; recorded RTO is labeled derived.
  Report explicitly says device identity is not attested and bytes are not
  independently rehashed here. Allowlisted fields omit private journal free text.
- Nemotron now shares the stricter journal loader, including anchored truncation
  detection. Legacy saved exports remain readable with unanchored completeness.
- Files: evidence.py, cli.py, nemotron.py, test_evidence.py.
- Ran `.venv` Python `-m unittest discover -s tests -p test_evidence.py -v`:
  3/3 in 0.199 s; test_nemotron.py: 2/2 in 0.128 s; `git diff --check` passed.
- Tests use synthetic journals, not new live rescue evidence. No provider calls,
  hardware or cloud mutations. Next: read-only cloud readiness diagnostics.

### 2026-11-08 — Autonomous software update 9 — Read-only per-job cloud doctor

- `liferaft cloud --profile operator doctor --job JOB` now checks owner lease,
  standby freshness, committed checkpoint bytes/hash, journal integrity and drill
  flag. Returns explicit blocking reasons and checks not performed.
- Diagnostic never invokes watchdog, renews a lease, records events or transfers
  ownership. Expired/corrupt data cannot show ready; no checkpoint means no data.
- Files: failover.py, cloud_api.py, cloud.py, test_readiness.py, test_cloud.py.
- `.venv` Python: `-m unittest discover -s tests -p test_readiness.py -v` passed
  2/2 in 0.173 s; latest test_cloud.py passed 9/9 in 4.148 s. CLI `cloud doctor
  --help` and `git diff --check` passed. Tests compare database bytes before/after
  expired-lease and corruption diagnostics to prove no state mutation.
- Hosted doctor/transfer checks remain NOT_RUN. No hardware/provider actions.
  Next: real PyTorch checkpoint/resume through the full signed API/client path.

### 2026-11-08 — Autonomous software update 10 — Genuine training through signed API

- Added a full real PyTorch baseline/checkpoint/restore/completion test through
  CloudClient, CloudWorkerCoordinator, authenticated WSGI API and isolated stores.
  Only the network layer is replaced with an in-process WSGI opener; this is not
  new hosted TLS, Atlas, multi-process or cross-device evidence.
- Corrupt signed GET bytes are rejected before file publication or ownership
  claim. After valid retry, standby executes all steps 26..200 from checkpoint 25;
  final loss sequence and every final model tensor equal the uninterrupted baseline.
- `.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_signed_training.py -v`:
  1/1 passed in 11.617 s. Observed 45,296-byte checkpoint, 32 linked journal
  events, same-host RTO 235.896 ms, graceful RPO 0, max loss difference 0.0.
  These timings are local test measurements, not campus recovery performance.
- `python -m compileall -q liferaft tests scripts` and `git diff --check` passed.
- File: tests/test_signed_training.py. No hardware, live service, provider or
  credential changes. Next: final protocol adversarial review and operator docs.

### 2026-11-08 — Autonomous software update 11 — Fail-closed response and lease validation

- Cloud lease plans now validate action allowlist, strict epoch and finite lease
  duration capped at the coordinator's 12-second TTL. Malformed, zero-duration
  active, infinite and extra-field plans cannot authorize training.
- Reject duplicate/nonfinite/unexpected JSON response envelopes, missing transfer
  offers and malformed upload acknowledgments. Check response deadline while
  reading bounded chunks so a trickling stream cannot keep extending the read.
- Files: cloud.py, test_cloud_transport.py. `.venv` Python ran test_cloud_transport.py:
  8/8 in 0.374 s, and test_signed_training.py: 1/1 in 11.132 s. Signed real
  training still has zero loss difference and identical final tensors after K+1.
  Compilation and `git diff --check` passed.
- Errors/delays are injected fixtures; no actual cloud outage or hardware action.
  Next: consolidated operator guide, protocol contract and full regression suite.

### 2026-11-08 — Autonomous software update 12 — Operator handoff and full verification

- Updated README, integration contracts, test-matrix coverage, hosted setup notes,
  tracker summary/checklist and docs/SOFTWARE_VERIFICATION.md. Documented exact
  commands, rolling compatibility, safe failures and evidence/attestation limits.
- Decisions: keep Atlas private behind the existing coordinator (no new service),
  derive short-lived HMAC capabilities from scoped role credentials (no extra
  secret provisioning), require both URL and bearer identity, preserve old worker
  transfer compatibility, and reject unpaged server exports instead of silently
  claiming completeness. Defer hardware/provider/deployment gates without asking
  the team for resources in this session.
- Full command actually run:
  `.\.venv\Scripts\python.exe -m unittest discover -s tests -v 2>&1 | Tee-Object -FilePath .liferaft/autonomous-software-tests.log`
  Result: 63 tests in 126.414 s, 61 passed, 2 opt-in hosted/isolated-Atlas tests
  skipped, zero failures. Local raw output stays ignored. Full-run signed-path
  metrics: checkpoint 25 -> measured 26..200, max loss difference 0.0, identical
  final tensors, 32 journal events, 45,296-byte checkpoint, local RTO 218.038 ms,
  graceful RPO 0. Independent-process test also resumed 120 -> 121 with max
  loss difference 0.0. These are same-host tests, not new campus measurements.
- `python -m compileall -q liferaft tests scripts` and `git diff --check` passed.
  Initial `npm exec -- tsc ...` failed because this checkout lacked node_modules
  and npm fetched the unrelated tsc placeholder. Corrected with `npm ci
  --ignore-scripts` (one locked package, zero reported vulnerabilities) and
  `node node_modules/typescript/bin/tsc --strict --noEmit web/src/lib/contracts.ts`
  (exit 0). No package/lockfile changes. New guide invokes the pinned compiler.
- Saved campus-button-05 export is absent from this checkout, so the new report
  was not run on that historical physical drill here. Earlier live evidence stays
  as recorded; synthetic/unit fixtures never replace it.
- Remaining gates: new hosted signed/paged/doctor verification, real Atlas rollback
  and claim concurrency, Pi heterogeneous compute, combined OLED/sensor status,
  Photon and Next.js cockpit. No deployment, hardware/serial access, provider
  message, live NVIDIA call or production fixture performed. No new human action
  requested. Phase 3 remains IN_PROGRESS; no hardware phase falsely marked done.
- Twelve major updates were independently committed and pushed. Next work should
  use the documented hosted checks when a deployment/isolated Atlas is authorized
  and available, while preserving the local adapter and recorded physical proof.


### 2026-11-08 UTC — Phase 9 — IN_PROGRESS

- Built a localhost Next.js replay cockpit in `web/src` with a five-node WebGL/SVG
  topology, reduced-motion support, measured loss chart, linked checkpoint ledger,
  flight recorder, sensor provenance and saved Nemotron trace. The browser receives
  a redacted projection from `liferaft/cockpit.py`. The route accepts only
  server-configured input paths. It uses the existing Python journal verifier and
  recovery brief, so the browser cannot promote provider text to recovery proof.
- Display decisions. Mark older exports as unanchored. Use a single dot when only
  one loss sample exists. Plot local worker logs separately from journal proof.
  Missing hardware readings, Photon receipts and live score inputs show no data.
  Invalid optional Nemotron attachments are flagged separately from journal failure.
- Commands and results:
  - `.venv/bin/python -m liferaft demo --scenario cooling-test` completed with two
    local processes. `cockpit-data --job local-job --local-run
    .liferaft/phase2-9_xemq61` projected 21 events and 70 real loss samples.
    Checkpoint 32 → first step 33, completed at 70, RTO 2.183 s, RPO 0.
  - `.venv/bin/python -m liferaft cockpit-data --job campus-button-05` verified the
    saved 79-event legacy journal. Checkpoint 25 → first step 26, completed at
    200, recorded RTO 6.534 s and RPO 0. It contains one measured loss sample.
    This replays the previously recorded physical-button drill.
  - `.venv/bin/python -m unittest discover -s tests -v` ran 67 tests in 51.250 s.
    62 passed, five skipped. Three repository fault tests need the optional
    cloud dependencies and two live tests are opt-in.
  - `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build`,
    `.venv/bin/python -m compileall -q liferaft tests scripts` and
    `git diff --check` passed. Dependencies were installed from the existing npm
    cache because the shell cannot resolve the public registry.
  - Direct calls to the compiled GET handler passed for empty config, rejected
    non-loopback Host, missing evidence, campus replay and the local replay.
    The sandbox rejected the dev server's loopback listen with EPERM. Chrome
    rendered the actual React components with the compiled route's response in a
    file-backed QA preview. Desktop and 390 px layouts, Verify chain, event
    filtering and keyboard event selection were checked there.
- Hardware safety. Only the local training demo ran. There were no hardware
  operations or new hosted/provider observations in this pass.
- Next gate. Run the live coordinator-backed cockpit with fresh telemetry and
  operator auth, then observe an end-to-end recovery in the running console.
  Hosted Atlas, Pi/OLED/ambient and Photon gates remain open. No human action was
  requested in this pass.
- GitHub push was requested during this milestone. The local Git index is
  read-only in this session, shell DNS could not resolve GitHub, and the GitHub
  integration returned 403 when creating the commit tree. GitHub main was
  verified at the starting commit before the write attempt. Changes are local.


### 2026-11-08 UTC — Phases 3–8 software checkpoint

- Phase 3 retains the signed transfer and paged journal protocol. The coordinator
  advertises the additive edge capability, accepts separately scoped Pi and
  Photon roles, and preserves the older worker heartbeat response.
- Phases 4–5 add the guarded Pi worker, telemetry-only fallback, non-root
  service template, combined ESP32 target, bounded USB monitor and cloud-confirmed
  OLED state. The independent button and OLED targets remain available.
- Phase 6 persists advisory decisions and conditionally shortens the cadence to
  five steps with a ready standby, fresh lease and bounded cost. One immutable
  upload may run in the background. Later progress and yield wait for its result.
- Phases 7–8 add eight read-only Nemotron tools, immutable saved reports,
  Photon 2.0 signature validation, one-job direct-space allowlisting,
  deduplicated commands and ACK, a durable retry queue, and a verified-resume
  handoff note. The replay cockpit shows telemetry and provider events with
  their provenance.
- A real local 44-step workload with injected Pi policy inputs produced identical
  optimizer losses with both schedules. One measured run used fixed checkpoint
  steps 10, 20, 30, 40, 44 (63.71 ms cumulative checkpoint time) and adaptive
  steps 10, 20, 25, 30, 35, 40, 44 (68.25 ms). These times describe this local
  workload and the policy input is a fixture.
- Read-only hosted doctor returned coordinator unavailable from this session.
  Live Atlas, new cross-device recovery, Pi thermal/cooling operation,
  ESP32 hardware and Photon round-trip remain external gates. The firmware
  passed a host C++11 syntax check with stubs. PlatformIO installation timed out
  fetching its package, so the actual ESP32 target remains uncompiled here.
- Exact operator steps are in [the Phases 3–8 bring-up](docs/PHASES_3_8_OPERATOR_STEPS.md).
- Final verification: `.venv/bin/python -m unittest discover -s tests -v`
  ran 78 tests in 68.665 s. 73 passed and five skipped. Three skips require the
  optional cloud test dependencies, and the hosted HTTPS and isolated Atlas
  tests are opt-in. The new role and edge-policy suites also passed after
  tightening the Pi identity check.
- In-process signed transport resumed checkpoint 25 at step 26 and finished
  at 200 with identical final tensors and zero loss delta. The corruption
  fixture was rejected. This exercise used local WSGI transport and the new
  edge heartbeat, without hosted TLS or physical hardware.
- `npm run typecheck`, `NEXT_TELEMETRY_DISABLED=1 npm run build`,
  `.venv/bin/python -m compileall -q liferaft tests scripts`, and
  `git diff --check` passed.

### 2026-11-08 UTC — Cockpit S0 foundations — DONE

- Installed pinned three 0.170.0, matching types, Vitest 4.1.12, Playwright and axe;
  vendored local font files and licenses. npm audit: zero vulnerabilities after
  replacing the initially selected vulnerable older Vitest. No frozen files edited.
- Added authoritative docs/COCKPIT_PLAN.md, pure narrative, timeline, ownership,
  ledger, relations, loss, handoff and topology-frame derivations; external-store
  cursor and independent hover store. Added real local projection fixture.
- Commands: `python -m liferaft demo --scenario cooling-test` (venv Python),
  `python -m liferaft cockpit-data --job local-job --local-run .liferaft/phase2-ahf9ym0g`,
  `npm run typecheck` (PASS), `npx vitest run` (9/9 PASS), `npm audit` (0).
- Fixture is newly measured same-machine two-process training, not distributed
  recovery. Historical campus-button-05 coordinator export is absent. Available
  campus-button-04 files are worker logs; rejected by the frozen verifier and not
  passed off as projection fixtures. No hardware/provider/deployment performed.
- No human action required. Next: S1 accessible hero and replay controls.

### 2026-11-08 UTC — Cockpit S1 hero — IMPLEMENTED, HUMAN QA OPEN

- Added truthful headline, four evidence beats, checkpoint/optimizer proof,
  shared replay transport and accessible five-node 2D map. Preserved loopback API.
- `npm run typecheck`, `npx vitest run` (9/9), `npm run build`: PASS.
  Real HTTP/Playwright verified API projection, non-loopback 403, security headers,
  linked cursor/filter/deep-link/reverify flow: PASS. Production loopback server
  started with local-run env, no provider or hardware actions.
- Fresh same-host run: 20 events, 70 actual losses, checkpoint 30 -> measured 31,
  completion 70, derived RTO 5221.859 ms, RPO 0. Not cross-device evidence.
- Human ten-second usability gate NOT_RUN; no unfamiliar viewers available.
- First browser audit caught invalid definition-list placement; corrected badge
  into dd. Full responsive/a11y rerun pending. No human setup needed.
- Next: S2 GPU lifecycle validation; then linked-view hardening.

### 2026-11-08 UTC — Cockpit S2 topology — IMPLEMENTED, DEVICE QA OPEN

- Procedural laptop/coordinator/Pi/ESP32 geometry, curved routes, eight-slot
  instanced packet pool, ownership baton, epoch notches, procedural shadows,
  Fresnel rims, critically damped camera, capped density and high-tier lazy bloom.
- Added render-on-demand, visibility suspension, tier degradation, disposal registry,
  context reconstruction with bounded retries, software-renderer 2D fallback,
  keyboard node proxies, quality/motion/2D controls and dev QA hooks.
- `npm run typecheck`: PASS. `npm test`: 13/13 PASS including four instrumented
  renderer lifecycle tests (20 mounts, tracked geometry/textures return to zero,
  no idle loop, reduced-motion one frame, context-preserving disposal).
- `npm run test:e2e`: 14/14 PASS against production server before final visual
  enhancements. Browser in this environment selected honest static fallback;
  physical GPU context-loss and five-minute soak remain NOT_RUN. Instrumented
  tests do not claim physical GPU proof. No hardware or human setup required.
- Next: S3 linked evidence validation.

### 2026-11-08 UTC — Cockpit S3 linked views — IMPLEMENTED

- Shared cursor drives replay transport, topology as-of state, chart cursor,
  checkpoint/recorder selection, ownership ranges and responsive Inspector.
  Added kind/source/worker/epoch/derived-severity/search filters, bounded recorder
  paging (200 rows), chain prefixes, related-event navigation, raw redacted JSON,
  loss drag/keyboard zoom, linear/log scale, measured sample table and origin dots.
- Contract compile check `npm run test:contracts`: PASS; `npm run typecheck`: PASS.
  Nine pure derivation tests plus four lifecycle tests pass. Browser flow validates
  filtering without mutating headline truth, URL/reload and reverify preservation.
- `npm run test:e2e`: 14/14 PASS including serious/critical axe audits at
  1440/768/390/320 px, mobile sheet open/Esc and no horizontal page overflow.
  Network abort, 403, 422, empty, simulated and one-sample states pass.
- Browser states based on intercepted responses are test injections, not new
  service/provider evidence. Historical campus fixture unavailable. Next: S4.

### 2026-11-08 UTC — Cockpit S4 intelligence/operators — IMPLEMENTED

- Added deterministic <=120-word shift brief with copy text/Markdown and paper-only
  print layout. Read-only validated Nemotron tool/fact evidence remains distinct
  from recovery authority. Missing Photon/CPU/fresh readiness has designed NO DATA.
- `npm test`: handoff determinism/word bound passes. Production Playwright copy,
  clipboard readback, shortcut help and print/PDF visibility checks PASS.
  `.venv/Scripts/python.exe -m unittest discover -s tests -p test_cockpit.py -v`:
  3/3 PASS including provider validation, tampering and legacy journal rejection.
- No real Photon/NVIDIA interaction or sensor observation performed. No external
  action required for this replay scope. Next: S5 hardening and budget measurement.

### 2026-11-08 UTC — Cockpit S5 hardening — IMPLEMENTED, BUDGET GATE OPEN

- Added responsive layouts, mobile evidence tabs and focus-trapped/drag-dismissable
  inspection, persistent motion preference, forced-colors and print styles,
  accessible source glyphs, local fonts/licenses, security headers and CSP with
  no third-party origins. Requests have an eight-second browser deadline while
  the frozen server verifier retains its original five-second deadline.
- Fixed invalid dl markup, closed-disclosure focus leakage, default empty-content
  prerender shifts, camera-label layout shifts, initial camera framing and bloom
  background. Large event/sample tables use bounded 200-row pages. Relation
  indexes are built once per replay without quadratic full-journal filtering.
- Commands observed: `npm run typecheck`, `npm run test:contracts`, `npm test`
  (14/14 PASS), `npm run build` (PASS), `npm audit` (zero vulnerabilities),
  `git diff --check` (PASS; informational Windows LF/CRLF notices only).
  Python projector regression: 3/3 PASS in 0.364 s. All frozen Python/contracts/
  replay API/type files are unchanged according to targeted Git diff.
- `npm run test:e2e`: 16/16 PASS before final cosmetic framing/background pass;
  final rerun status is appended below. Includes actual API/Python projection,
  security headers and loopback rejection, selected event/URL/filter/reverify,
  empty/403/422/network/simulated/single-sample inputs, clipboard/print, mobile
  focus containment/restoration, WebGL shader/context recovery, and serious/
  critical axe checks at 1440/768/390/320 px and in WebGL/reduced-motion mode.
- `node scripts/cockpit-soak.mjs`: PASS, actual Chrome WebGL at mid tier,
  303389 ms, 548 navigation actions, zero captured runtime/shader errors.
  After warm-up, geometries stayed 39 and textures 1 across minute 1–5 samples;
  sampled draw calls 18–19, triangles 1098–1494, final idle render count stable.
  Resource disposal also passes 20 real browser mount cycles and four separately
  instrumented lifecycle tests. These are renderer counts, not GPU VRAM attestation.
- Final `node scripts/cockpit-budget.mjs` measurement: LCP 1508 ms;
  CLS 0.0000004778374566 (visually negligible, not literally the specified zero);
  non-3D JS 156838 bytes gzipped, 3D lazy load 133443 bytes gzipped.
  Automated click roundtrips 61.966–82.430 ms, not field INP measurements.
- Explicit misses: full baseline JS exceeds the 120 KB target. React/Next/router
  shared chunks alone account for most of this load; no framework migration was
  made to conceal the miss. Strict CLS=0 also remains a numerical target miss.
  LCP and lazy 3D chunk targets pass in this local observation.
- NOT_RUN: Safari, Firefox, VoiceOver, named Apple/2019-integrated GPU FPS,
  historical campus-button-05 fixture and the two-of-three-person ten-second test.
  No hardware, hosted coordinator, provider, deployment or credential action.
  No human action required to run the implemented replay. Next: S6 retirement/docs.

### 2026-11-08 UTC — Cockpit S6 polish / handoff — IMPLEMENTED

- Added docs/COCKPIT_IMPLEMENTATION.md with exact PowerShell setup, fixture
  provenance, commands, graphics QA, event bookmarks, limitations and legacy
  parity. Updated README, UI_DESIGN_SYSTEM pointer, UPSCALE UI sections, AGENTS
  UI source of truth and demo script. Kept historical tracker entries intact.
- Removed the legacy HTML entry point and unused monolithic cockpit/topology/loss
  components after parity review. No simulated rescue controls/chat remain.
- Added .github/workflows/cockpit.yml for typecheck, fixture contract check, unit/
  lifecycle tests and production build. This workflow is local code; no remote CI
  execution or deployment is claimed. Dependencies remain exactly pinned.
- QA files: .liferaft/cockpit-qa-results.json, cockpit-budget.json,
  cockpit-soak.json, cockpit-hero.png, cockpit-desktop-final.png, cockpit-*.png,
  handoff.pdf. QA artifacts remain ignored/private. UI uses only redacted data.
- Known acceptance limits remain in S5; software scope is implemented without
  marking unrelated live/cloud/hardware phases DONE. No push/deployment performed.

### 2026-11-08 13:12 UTC — Final cockpit regression evidence

- Final production rebuild and restart completed. `npm run test:e2e`: 16/16 PASS
  in 58.5 s against the final framing/background/blur build, including real WebGL
  context restoration, shader checks, reduced-motion axe and mobile focus trap.
- Refreshed final hero/topology/full-desktop screenshots. Production server remains
  available at http://127.0.0.1:3000 with the genuine local-run replay configured.
- Final typecheck and fixture compile PASS; unit/lifecycle 14/14 PASS; Python
  projection regression 3/3 PASS; npm audit 0; Git whitespace check PASS.
- All frozen boundaries remain unchanged. Strict 120 KB baseline/zero CLS,
  unavailable historical fixtures and external browser/usability/FPS gates remain
  explicit in docs/COCKPIT_IMPLEMENTATION.md. No credentials or hardware needed
  for local replay, and no new cloud/provider/hardware success is claimed.

### 2026-11-08 13:14 UTC — Palette-only follow-up

- Unknown-node pins/edges now use neutral NO DATA colors. Screen compositing
  preserves the navy background under high-tier bloom. No geometry, recovery,
  storage or API behavior changed.
- Rebuilt production, typecheck PASS, unit/lifecycle 14/14 PASS. Targeted real
  WebGL lifecycle/context-restoration/reduced-motion axe regression: 2/2 PASS.
  The preceding full browser run remains 16/16 PASS in 58.5 s; the JSON reporter
  now contains this latest two-test targeted run rather than the earlier full run.
- Updated performance probe: LCP 1604 ms, baseline 156840 gzip bytes, lazy 3D
  133479 gzip bytes, CLS 0.0000004778374566. Budget misses are unchanged.
- Refreshed final screenshots. The five-minute soak remains applicable to the
  unchanged scene resources/lifecycle. No additional external action performed.

### 2026-11-08 — Repository cleanup

- Removed obsolete bootstrap instructions (`CODEX_START_PROMPT.txt`,
  `README_START_HERE.md`), superseded UI/judging notes
  (`docs/UI_DESIGN_SYSTEM.md`, `docs/UPSCALE_PLAN.md`), and the outdated
  `docs/HARDWARE_SHARE_SUMMARY.md`. Removed their active pointers from the
  cockpit plan and hardware report; earlier tracker entries remain historical.
- Removed three unused `@fontsource/*` development dependencies and their lock
  entries. The app uses vendored WOFF2 files through `next/font/local`.
- Added `.gitignore` rules for Playwright reports, test results and PlatformIO
  output. Retained runtime modules, hardware diagnostics, QA scripts, tests,
  licenses, required specifications and operational/safety guides.
- Commands: `npm uninstall --save-dev @fontsource/geist @fontsource/geist-mono
  @fontsource/instrument-serif --ignore-scripts --no-audit --no-fund` PASS;
  `npm run test:contracts` PASS; `npm test` PASS (14/14);
  `git diff --check` PASS (line-ending notices only).
- `npm run typecheck` FAIL: TS2306 because the pre-existing modified
  `web/src/components/app/CockpitApp.tsx` is empty. Existing dashboard and style
  edits were preserved. Production build/browser verification cannot be
  completed with that entry component empty.
- Backend command: `.venv\Scripts\python.exe -m unittest discover -s tests -v`.
  Final result recorded below after completion. No remote provider or physical
  hardware verification performed. No human action required for cleanup.
- Next action: finish the existing cockpit edit, then rerun typecheck/build and
  browser QA. No recovery or hardware behavior changed by this cleanup.

- Follow-up: the concurrently edited cockpit component was populated during
  verification. Reran `npm run typecheck`: PASS. `npm run build`: PASS
  (production compilation and static generation). The earlier empty-file
  blocker is resolved; no existing UI edits were changed by this cleanup.

- Backend final result: 78 tests run in 133.340 s, OK (2 opt-in remote
  tests skipped). Same-host resume loss difference 0.0 and final weights
  equal; this does not establish new cross-device or hardware evidence.

### 2026-11-08 UTC — Single-page bento UI revision — IMPLEMENTED

- Latest user direction: complete the UI quickly; final content placement remains
  provisional. Replaced long scrolling dashboard with five equal-area desktop
  bento fields using the exact supplied red/honeydew/frost/steel/navy palette.
- Reviewed the requested Portfolio-Website repository's actual global styles and
  disclosure patterns. Added editorial type, simple copy and custom flat SVGs.
  Removed radial gradients, grain, bloom and rim highlights from rendered views.
- Each card opens an in-page detail dialog; existing proof, topology, timeline,
  checkpoints, loss, advisory investigation, device/message states and copy/print
  handoff remain accessible. Added plain-language explanations and a glossary.
- Files: web/src/components/app/CockpitApp.tsx, components/dashboard/*,
  lib/derive/dashboard.ts, styles/*, app/layout.tsx, topology presentation;
  web/tests/dashboard.test.ts, cockpit.spec.ts, playwright.config.ts,
  docs/DASHBOARD_UI.md. Preserved unrelated concurrent cleanup/package edits.
- Actual commands: npm run typecheck, npm run test:contracts, npm test (18/18 PASS),
  npm run build (PASS), git diff --check (PASS). Browser tests cover all five card
  disclosures, sources/missing data, responsive fit/contrast, focus, copy/print,
  filters/cursor/reverify and optional WebGL; final browser result appended below.
- Initial browser pass caught the 1920 px layout being 10 px too tall, modal focus
  wrapping and rendering during lost WebGL context; corrected all three. A filter
  test was fixed to select the injected row rather than the always-visible current
  selection, preserving the existing selected-event honesty behavior.
- Real local CPU cooling-test demo ran in .liferaft/phase2-a4r4q6bx. No hardware,
  real overheating, cloud writes or provider calls. Preview runs on loopback port
  3105 to preserve existing listeners on 3000/3001. No deployment or push.

### 2026-11-08 UTC — Bento UI final check

- Production build and typecheck PASS; contract compile PASS; unit suites 18/18
  PASS. Browser rerun: 18 overview/detail/responsive/honesty/focus/clipboard/print
  tests PASS, with one context-loss rendering race found in optional WebGL.
  Added an isContextLost guard before rendering; targeted WebGL restore/shader
  regression now PASS (1/1). All 19 browser cases have passing results across
  the full run plus that targeted correction. Latest JSON is the targeted run.
- Desktop overview fits one screen at 1280/1440/1920 widths; all five colored
  card areas are within 6% of one another. Axe serious/critical checks PASS at
  1920/1440/1280/768/390/320 px and inside mobile details. No radial/gradient
  backgrounds remain in active styles or the SVG map.
- Actual fresh local replay: 22 events, 70 measured samples, checkpoint 32 ->
  first resumed update 33, completion confirmed, RTO 4810.946 ms, RPO 0.
  This is same-host two-process evidence, never a new distributed/hardware claim.
- UI preview: http://127.0.0.1:3105. Final screenshots under .liferaft:
  bento-desktop-final.png, bento-detail-final.png, bento-*.png and bento-handoff.pdf.
- User requested stopping at a complete UI while content arrangement is decided.
  No extra functionality or physical/provider/deployment work is required here.
