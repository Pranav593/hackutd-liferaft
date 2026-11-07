# LIFERAFT — Codex phase tracker and real progress log

**Initial status:** Specifications only. No source implementation or live integrations are claimed to exist. Codex updates this document after each phase with actual files, commands and observed evidence.

## Workflow rules

- Each phase has `NOT_STARTED / IN_PROGRESS / DONE / BLOCKED_EXTERNAL / NEEDS_FIX` status. Only mark DONE when its specified positive and negative tests pass.
- Always work on next phase. Resolve failed tests before moving forward; external credential blockers should not prevent building local adapters and unit tests.
- After a phase, write `what actually works`, `test command`, `observed result`, `remaining blocker`, `what team must do in beginner steps`, `next phase`.
- Hardware safety is **cross-cutting**: it is enforced in every phase, not deferred to hardware phase.
- Never include private keys, full phone numbers, access tokens, checkpoint signed download URLs or private network credentials in evidence.

## Phase checklist

### Phase 0 — Foundation / contracts / doctor — NOT_STARTED
- [ ] Repo scaffold, source control ignore patterns, lockfiles, typed models and schemas.
- [ ] Python, Node and Pi compatibility probe with harmless read-only diagnostics.
- [ ] Local SQLite adapter, local file checkpoint store, structured redacted logs.
- [ ] `liferaft doctor` CLI and OS-aware setup docs.
- [ ] Tests for schema validation, auth/redaction and offline mode.
- [ ] Record actual OS, Python, architecture, dependency constraints (no secrets).
- **Gate:** local backend tests pass, secrets never printed, no remote connectivity required.

### Phase 1 — Genuine PyTorch job + checkpoint/resume — NOT_STARTED
- [ ] Seeded 32-feature regression MLP, real optimizer and loss logging.
- [ ] Model+optimizer+RNG+dataset cursor checkpoint schema and atomic writes.
- [ ] SHA-256, immutable filenames, compatibility and tampering checks.
- [ ] Resume K→K+1 and baseline-comparison tests.
- **Gate:** 200-step baseline and interrupted/restarted run pass actual numeric checks.

### Phase 2 — Local failover engine and ownership — NOT_STARTED
- [ ] Heartbeats, lease TTL, fencing epoch, durable event log.
- [ ] Primary and standby CLI processes, local checkpoint transfer and monitored handoff.
- [ ] Graceful risk preemption and worker-process crash tests.
- [ ] No-valid-checkpoint, race, stale-primary and idempotence tests.
- **Gate:** real second process finishes training and old primary cannot commit.

### Phase 3 — Cloud coordination for campus-isolated devices — NOT_STARTED
- [ ] Hosted Supabase Postgres/Storage/Edge Functions created using verified docs.
- [ ] Auth roles, RLS, private bucket, signed URLs, immutable object paths.
- [ ] Atomic lease claim/yield/reject stale epoch and cloud health checks.
- [ ] Two independent computers access cloud over HTTPS; checkpoint round-trip verified.
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
| Team Supabase project account (when Phase 3 needs it) | hosted coordination/storage | `TEAM_SETUP_GUIDE.md` §4 | NOT_CHECKED |
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
