# Cockpit contract and operation

The separate loopback [live hardware cockpit](LIVE_HARDWARE_DEMO.md) may
request a new bounded Pi job through the authenticated operator launch slot.
It displays verified hosted records and has no recovery or hardware command.
The saved replay routes remain read-only.

## Independent training activity feed

Both dashboards include a read-only **Training activity** section separate from
the replay cursor. `/api/worker-logs` accepts only loopback requests and no
browser-supplied paths, commands, credentials or job IDs. Its backend discovers
the job from local worker processes/session mirrors or a verified saved export.
Pi and Windows panes keep their actual configured worker IDs; local rehearsal
IDs are never renamed to imply physical Pi evidence. Missing OS stays unknown.

The operator's ignored backend profile permits existing authenticated event
exports. Verify the full chain, then expose only allowlisted event kinds and
numeric metrics, not arbitrary stdout or evidence. Poll serially with bounded
subprocess/network deadlines, cancel on unmount and pause while the page is
hidden. Keep saved, local, cloud, stale, ended, paused and error states explicit.
Local worker mirrors are supplemental diagnostics, never recovery proof. They
are size capped and a mirror failure cannot stop the training worker.

## Additive MVP story route (2026-11-08)

The latest MVP request adds `/story` beside the existing five-card `/` view.
Only this presentation route uses the requested dark gradient/glass visual
system and a Three.js worker constellation. The five-card view below keeps
its established palette and behavior. `npm run demo` prepares genuine local
evidence and starts the presentation on loopback port 3120.

Story controls are read-only saved-drill selection and explicit playback.
The 90-second story may scroll to evidence panels after the operator presses
Run. A persistent disclosure identifies same-host workers, injected faults,
mock messaging and deterministic planning. Human reply buttons are interaction
previews and never mutate the coordinator. The failure estimate shows linear
fit R² rather than claiming calibrated confidence. Real ghost curves and
final-weight proof appear only at their recorded comparison event.
All existing evidence/security/safety requirements below still apply.

### Simplified story presentation

The main view prioritizes the worker handoff, early-warning estimate and ghost
comparison. Keep the 3D transfer and real continuity proof prominent. Agent
tools, simulated on-call messaging and illustrative costs are grouped in the
closed-by-default **Under the hood** disclosure. The replay slider stays visible;
hash-chain nodes and event JSON open under **Inspect the flight recorder**.
Playback focuses the main panels without opening technical disclosures. Preserve
all provenance labels and access to the original evidence cockpit. Use a plain
dark background, flat panels and concise copy.

Authoritative UI guidance, consolidated on 2026-11-08. The current five-card
dashboard supersedes the retired long-page/glass layout and its implementation
slices. Product, recovery, security and hardware requirements remain in the
master specification, interface contracts, safety guide and phase tracker.

## Evidence rules

- Read-only saved replay, served on loopback. Never start recovery, send messages,
  operate hardware or expose credentials from the browser.
- Success requires `recovery.verified_resumed === true`: a recorded optimizer
  step after the new owner resumes. Nemotron advice cannot establish success.
- Label measured, injected, derived, provider, simulated and missing evidence.
  Keep a persistent saved-replay label and a persistent SIMULATED banner when
  applicable. Button drills never imply real overheating.
- Missing temperature, RPO, RTO, readiness, loss or receipts remain unknown;
  never substitute zero or invented data. Pi CPU and ambient are separate.
- Local worker processes run on one computer. A cloud record alone does not
  attest physical device identity. Do not claim cross-device proof without it.
- Show UTC timestamps. Hashes in the projection are 12-character prefixes;
  full hashes and private evidence paths remain server-side.
- Preserve the replay API, Python verifier, loopback Host check, no-store caching,
  five-second verifier timeout, redaction and existing wire contracts. This
  cleanup changes no coordinator, lease, checkpoint or hardware authority.

## Current visual system and navigation

Five approximately equal desktop cards cover outcome, worker handoff, trigger,
training progress and shift handoff. Palette: Honeydew #F1FAEE, Deep Space Blue
#1D3557, Strawberry Red #E63946, Frosted Blue #A8DADC and Steel Blue #457B9D.
Use flat fills and clear text contrast; no gradients, grain, bloom or rim glow.
Editorial typography uses the vendored Geist, Geist Mono and Instrument Serif
fonts with their licenses. Stack cards on mobile without horizontal overflow.

Overview copy uses everyday language. Each card opens an accessible detail
dialog: proof, workers, event log, training, handoff, or devices/messages. Retain
source badges, checkpoint ledger, epochs, genuine loss samples, selected event
JSON, advisory investigation and deterministic copy/print handoff.

The outcome summarizes the full record. Topology and sensor views follow the
cursor. Selection updates linked views; hover tracing does not move the cursor.
Filters affect displayed event rows rather than the evidence itself. Re-verify
runs the verifier again and preserves valid selection. Invalid evidence must
not produce a partial success display. Replay never autoplays.

Keep keyboard access, native dialog focus handling, visible focus indicators,
Escape dismissal and focus restoration. J/K or arrows step, Shift+arrows jump
milestones, / opens event search, ? opens help, and 0 resets the camera. Ignore
shortcuts in editable fields/dialogs. Support reduced motion, forced colors,
320px layouts and 200% text zoom. Print only the handoff brief.

## Start and inspect

Follow README.md for Python/Node installation. From repository root:

```powershell
.\.venv\Scripts\python.exe -m liferaft demo --scenario cooling-test
$env:LIFERAFT_COCKPIT_JOB = "local-job"
$env:LIFERAFT_COCKPIT_LOCAL_RUN = ".liferaft/phase2-REPLACE_ME"
npm run build
npm start
```

Use the actual directory printed by the demo. Open http://127.0.0.1:3000.
For development use `npm run dev`. For a coordinator journal, clear LOCAL_RUN
and set `LIFERAFT_COCKPIT_EVENTS` plus the exact job ID. Optional investigation
JSON must match that job/incident. `LIFERAFT_COCKPIT_PYTHON` selects Python.
Restart after changing server environment; keep files private.

## Graphics and QA

Keep WebGL lazy and render on demand, with no idle animation. Recorded forward
single-step transitions may animate; backward movement and seeking do not.
Respect reduced motion and dispose resources/listeners on unmount. Keep a 2D
fallback and context restoration. Quality tiers bound pixel ratio and work.

- `?gl=off` or `?gl=2d`: static map.
- `?gl=lose`: context-loss/restoration test.
- `?gl=leak-check`: twenty disposal/reconstruction cycles.
- `?e=EVENT_ID&c=INDEX&f=all&gl=3d`: bookmark using actual event IDs and
  zero-based indices. Unknown values are ignored.

```powershell
npm run typecheck
npm run test:contracts
npm test
npm run build
# With a configured production server running:
npm run test:e2e
node scripts/cockpit-budget.mjs
node scripts/cockpit-soak.mjs
```

Browser checks default to installed Chrome. `LIFERAFT_BROWSER=chromium` selects
Playwright Chromium; install it with `npx playwright install chromium` if needed.
`LIFERAFT_COCKPIT_URL` selects the running server. QA outputs stay in .liferaft.

Test empty/error/403/422/network states, injected/simulated/provider labels,
single-loss-sample charts, keyboard/dialog behavior, linked selection, clipboard,
print, reduced motion, 2D/WebGL and context loss. Unit renderer instrumentation
is not physical GPU evidence. Test responses are not real provider receipts.

Performance targets remain <=120 KB gzip baseline JS, <=200 KB lazy 3D, local
LCP <1.8s, scrub interaction <100ms, zero CLS and no GPU memory growth during a
five-minute soak. Record misses honestly. Human comprehension, actual hardware
classes, Safari/Firefox and screen-reader checks need their own evidence.
Historical measurements and outstanding gates live in PHASE_TRACKER.md; rerun
checks for current code instead of treating old results as current acceptance.

The genuine local fixture has 20 events and 70 measured losses, saved at step
30 and resumed at 31, completed at 70. It is same-host two-process evidence.
Do not substitute historical campus job IDs, timings or screenshots for it.
