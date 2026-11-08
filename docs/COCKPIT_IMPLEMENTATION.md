# Cockpit operation and verification

The UI source of truth is [COCKPIT_PLAN.md](COCKPIT_PLAN.md). This implementation
is a **read-only saved-evidence console**, served only on loopback. It never
starts a rescue, sends a message or touches hardware. Live mode and projection
extensions X1â€“X3 remain outside this change. Missing evidence remains `NO DATA`.

## Start on Windows

From the repository root, using the existing Python environment:

```powershell
npm ci
.\.venv\Scripts\python.exe -m liferaft demo --scenario cooling-test
```

The demo prints its `.liferaft/phase2-...` directory. It runs genuine CPU training
in two processes on this machine; it is not cross-device evidence. Copy that
directory into the variable below, keeping it private:

```powershell
$env:LIFERAFT_COCKPIT_JOB = "local-job"
$env:LIFERAFT_COCKPIT_LOCAL_RUN = ".liferaft/phase2-REPLACE_ME"
npm run build
npm start
```

Open [the local cockpit](http://127.0.0.1:3000). To work on source, use
`npm run dev` instead. Python defaults to the repository's `.venv`; an existing
compatible executable can be selected with `LIFERAFT_COCKPIT_PYTHON`.

For an actual saved coordinator export, clear `LIFERAFT_COCKPIT_LOCAL_RUN`, set
`LIFERAFT_COCKPIT_JOB` to its exact job ID and `LIFERAFT_COCKPIT_EVENTS` to its
local file. An optional `LIFERAFT_COCKPIT_INVESTIGATION` must belong to that job
and incident. Restart after changing these server-side variables. No path enters
the browser URL. No credentials are required to replay private local evidence.

## Use the console

- The headline summarizes the entire verified record; it stays unchanged when
  scrubbing. Each of the four rescue beats selects its recorded evidence.
- The topology and sensor evidence show state **as of the sequence cursor**.
  The Pi stays unknown because the frozen projection cannot attest its role.
- Event selection links the recorder, ledger, loss cursor, epochs and Inspector.
  Hover/focus tracing does not move the cursor. Filters affect the recorder and
  ticks only. Severity is a client-derived classification of event kinds.
- Playback never starts automatically. J/K or arrows step; Shift+arrows jump to
  milestones; Space in the transport plays/pauses; `/` focuses search; `?` opens
  help; Escape dismisses inspection and resets the camera; `0` resets the view.
- Motion preference persists locally. The 2D map provides the same evidence
  without a GPU. It is also used after unsupported graphics or repeated failures.
- The paper Handoff Brief copies as text or Markdown. Print prints only that
  card; provider advice, when attached, is labelled separately.
- Re-verify refetches through the original Python verifier. It preserves a still
  valid selection; invalid evidence never produces a partial success view.

Hashes in the frozen projection are **12-character prefixes**. The Inspector
copies exactly those prefixes and the redacted event JSON. It cannot display or
copy full hashes that were never projected. Full hashes remain server-side.

## Evidence and fixtures

`web/fixtures/replay.local-job.json` was generated from a real local two-process
run on 2026-11-08 UTC: 20 events, 70 optimizer-loss samples, checkpoint 30 â†’ first
resumed step 31, completion at 70, RTO 5221.859 ms, RPO 0. This is new same-host
evidence, not a reproduction of the historical 32 â†’ 33 run.

The plan's historical campus-button-05 and local-job fixtures were absent from
this checkout. Available campus-button-04 worker logs fail the coordinator
journal verifier and are not used as fixtures. The single-sample browser test
restricts the genuine local fixture to its journal sample. Simulated/error/
provider cases use explicitly intercepted **test responses**, never demo data
served by the application API. They are not new provider or hardware evidence.

## Reproducible checks

```powershell
npm run typecheck
npm run test:contracts
npm test
npm run build
# Start the production console with the local-run configuration above, then:
npm run test:e2e
node scripts/cockpit-budget.mjs
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_cockpit.py -v
```

Browser checks default to installed Chrome. Set `LIFERAFT_BROWSER=chromium`
and run `npx playwright install chromium` to use Playwright's browser instead.
CI runs contract checks, pure/lifecycle tests and the production build. Actual
browser tests use the running local server and genuine Python projection.

Tests cover source-sensitive narrative/unknowns, no idle/backward/seek animation,
as-of topology, ownership, checkpoint relations, loss segmentation, handoff word
bound, twenty mount/dispose cycles, idle settling and reduced-motion final state.
The lifecycle unit tests instrument the renderer; their results are not physical
GPU memory measurements. Browser checks exercise the real WebGL engine where
available, context loss/restore, 2D fallback, shader errors, mobile inspection,
deep links, filters/reverification, empty/403/422/network/simulated/single-sample
states, clipboard, print and axe at 1440/768/390/320 px.

QA artifacts stay private under `.liferaft/`: browser screenshots, handoff PDF,
Playwright results and `cockpit-budget.json`. Screenshot capture explicitly
reveals content-visibility sections so below-fold evidence is included.

## Graphics QA and demo bookmarks

- `?gl=off` or `?gl=2d`: static map.
- `?gl=lose`: inject context loss and request restoration once.
- `?gl=leak-check`: twenty engine disposal/reconstruction cycles; the canvas
  carries `data-leak-check="passed"` only when tracked GPU resources reach zero.
- `?e=EVENT_ID&c=INDEX&f=all&gl=3d`: event bookmark; unknown values are ignored.
  Indices are zero-based and exact event IDs come from the selected evidence.

In the real fixture, use the four strip buttons and copy the resulting URL for
trigger, save, handoff and proof bookmarks. Do not hard-code the historical
campus IDs into another job. The `?` help dialog also exposes these beat links.

## Acceptance boundaries

See PHASE_TRACKER.md for final measured results. The 120 KB total non-3D JS goal
is below the current measured Next/React framework plus cockpit load. It remains
an explicit budget miss rather than being redefined as app-only bytes. Hardware
class-specific FPS, Safari/Firefox/VoiceOver
and the two-of-three-person ten-second test need those environments/people.
No new Photon receipts, Pi telemetry, provider calls or physical fault are claimed.

## Legacy parity

- Glass/navy/teal identity: ported; static mesh replaces drifting orbs.
- Five-node 3D topology: rebuilt from npm three 0.170.0 with static fallback.
- Packets: qualified recorded transitions only; no heartbeat/idle animation.
- Loss: genuine samples, one-sample mode and explicit log/journal origins.
- Lifeboat and comms: designed `NO DATA` until evidence exists.
- Nemotron: validated read-only advisory evidence, never recovery authority.
- Simulated rescue controls/chat: retired. The legacy HTML entry point and
  obsolete monolithic React views have been removed.

Official API references checked during implementation:
[React external stores](https://react.dev/reference/react/useSyncExternalStore),
[Three.js renderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer),
[Next.js headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).

## Final local measurements (2026-11-08 UTC)

- TypeScript, fixture contract compilation and production build: PASS.
- Unit/lifecycle suites: 14/14. Python projection regressions: 3/3.
- Browser suite: 16/16 on Chrome (final rerun recorded in PHASE_TRACKER.md).
- Five-minute actual WebGL soak: 303389 ms, 548 navigation actions; 39 geometries
  and 1 texture after warm-up, no growth in minute 1–5 samples, no captured
  runtime/shader errors, and render count stable after settling. Sampled scene
  draw calls 18–19 and triangles 1098–1494 are within scene budgets.
- LCP: 1604 ms. Lazy 3D: 133479 bytes gzipped. Full baseline: 156840 bytes gzipped
  (**exceeds 120 KB target**). CLS: 0.000000478, visually negligible but not
  literally zero. Local automated click roundtrips: 61.966–82.430 ms, not field INP.
- npm audit: zero vulnerabilities. Frozen files remain unchanged.

The soak validates this local Chrome renderer, not a specific Apple/integrated
GPU performance class. Final framing/background/blur changes were followed by a
production rebuild and browser regression; the same geometry/lifecycle code was
exercised by the five-minute run.

After the final palette-only adjustment, the targeted WebGL lifecycle/context/
reduced-motion accessibility tests passed 2/2. The latest JSON report contains
that targeted run; the preceding full 16/16 result is recorded in the tracker.
