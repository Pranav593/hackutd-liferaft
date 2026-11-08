# LIFERAFT Cockpit — Design, Architecture & UI Plan

> **Status:** authoritative and self-contained. Baseline: `main` @ `efb58b9` (2026-11-08).
> **Scope:** the `web/` Next.js console only. **This is a plan; nothing here is implemented yet.**
> **Audience:** Codex or any implementer. You should not need another UI/design document.
> **Suggested path:** `docs/COCKPIT_PLAN.md`.

---

## 0. Read this first

### 0.1 What this document replaces

| Existing file | Disposition |
|---|---|
| `docs/UI_DESIGN_SYSTEM.md` | **Superseded entirely.** Replace its body with a 3-line pointer to this file. |
| `docs/UPSCALE_PLAN.md` §3 (items 1, 2, 3, 5 as UI) and §5 build order | **Superseded** by §3, §7, §12 here. Keep §1 judging fit, §2 tracks and §4 users in that file. |
| `LIFERAFT_MASTER_SPEC.md` §11 (Frontend) | **Superseded** for UI. Its honesty rules are copied verbatim into §0.2. |
| `AGENTS.md` "Upscale addendum" | Edit to say: *"UI source of truth is `docs/COCKPIT_PLAN.md`."* |
| `web/demo/index.html` | **Frozen reference, then deleted** after the parity check in §2.3. |
| `PHASE_TRACKER.md` Phase 9 entries | Stay as a historical log. Not a spec. |

Everything else (hardware, coordinator, training, Nemotron, Photon specs) is untouched.

### 0.2 Laws (carried over; nothing in this plan overrides them)

1. **Every number has a provenance badge**: `MEASURED`, `INJECTED`, `DERIVED`, `PROVIDER`, `SIMULATED`, or `NO DATA`. Missing data says `NO DATA`, never green, never zero.
2. **"Rescue verified" appears only if** `recovery.verified_resumed === true` (first optimizer step measured on the new owner).
3. **Replay is never visually conflated with live.** A persistent mode chip is always visible.
4. **Injected is not real.** A button drill is labelled *drill (injected)*. The UI never claims real overheating.
5. **Animation never carries data.** Every animation is backed by a recorded event (§6.5). Remove all animation and the data still reads.
6. **LLM output is advisory.** Nemotron text can never be shown as proof or change a status.
7. **No secrets in the browser.** The browser only receives the redacted projection.
8. **Simulated data** requires a persistent `SIMULATED` banner. The cockpit is read-only; there are no demo controls.
9. **No fabricated loss points, savings, RPO, temperatures, or message receipts.**
10. **Time is shown in UTC** with a `Z` suffix.

### 0.3 Change boundary (what we may touch)

| Class | Files | Rule |
|---|---|---|
| **Frozen** | `liferaft/**`, `tests/**`, `contracts/v1.schema.json`, `web/src/app/api/replay/route.ts`, `web/src/lib/contracts.ts` | No edits. The replay API, evidence projection, loopback `Host` check, server-configured paths and 5 s verifier timeout stay exactly as they are. |
| **Additive-only** | `web/src/lib/replay.ts`, `liferaft/cockpit.py` (optional, §5.6) | New *optional* fields only. Never rename, retype or remove. Regenerate any snapshot; add a Python test. |
| **Free to rebuild** | everything else under `web/src/**` | Replace freely. |

---

## 1. Product thesis

### 1.1 The ten-second rule

A first-time viewer must answer three questions within 10 seconds, without scrolling or clicking:

1. **What happened?** A cooling drill was triggered and the primary was told to stop.
2. **Was work lost?** 0 known steps lost.
3. **Is it proven?** Yes: step 25 was saved and verified, and step 26 was measured on a different machine.

The first viewport (above the topology) carries this as one generated headline plus a four-beat strip.

**Headline template** (`DERIVED`, built only from `Replay` fields by `derive/narrative.ts`):

> **Training survived.** The standby resumed at **step 26** from a verified **step 25** checkpoint in **6.5 s**, with **0** known steps lost.

Fallbacks, in order:

| Condition | Headline |
|---|---|
| `verified_resumed` and `completed_after_resume` | the sentence above, plus "Training then completed at step N." |
| `verified_resumed` only | the sentence above |
| trigger present, not verified | **"Recovery not verified in this evidence."** (amber) plus the first unknown |
| no replay | **"No saved evidence selected."** plus how to open one |

`rto_ms` or `rpo_steps` null → omit that clause. Never say "0 lost" if `rpo_steps` is null; say "work lost: unknown".

**Four-beat strip** (`RescueStrip`, each beat is a button that selects its evidence event):

| Beat | Colour | Example copy | Source event |
|---|---|---|---|
| 1 Trigger | amber | *Cooling drill requested · INJECTED · ESP32 button* | `trigger` |
| 2 Save | teal | *Checkpoint 25 verified · sha 3fa9c1…* | `recovery.checkpoint` |
| 3 Handoff | teal | *Lease epoch 1 → 2 · laptop-a → laptop-b* | `LEASE_TRANSFERRED` |
| 4 Proof | teal, solid | *Step 26 measured on standby · loss 0.4211* | `recovery.resumed` |

A beat with no evidence renders dashed and `NO DATA`. The strip is also the scrubber's coarse navigation.

### 1.2 Who it is for (drives priority)

| Persona | Question | Served by |
|---|---|---|
| NOC engineer, 3 a.m. | "Is it handled?" | Headline, strip, Handoff Brief |
| ML engineer | "Same optimizer state, step K+1?" | Recovery proof, loss, ledger |
| Manager / judge | "Can I trust this record?" | Provenance badges, hash chain, epochs |

### 1.3 Visual identity in one line

Midnight navy glass, one luminous teal path that means *continuity*, amber that means *risk*, and an editorial typographic voice borrowed from vedp.dev. Hierarchy over density.

---

## 2. Current state and the HTML → Next.js pivot

### 2.1 Audit of what exists (as read from the repo)

**The Next.js console already exists.** `web/` is Next 16.4.3 + React 19.2.8, started by `npm run dev` (loopback). The "pivot from HTML" is therefore *retiring `web/demo/index.html`*, not a framework migration. In the clone I read, `three` 0.170.0 and `@types/three` appear as **uncommitted** `package.json` changes. Commit them. No component imports `three` yet.

| Piece | Today | Verdict |
|---|---|---|
| `GET /api/replay` | Spawns `python -m liferaft cockpit-data`; loopback-only; 403 non-local host, 422 verification failure, `{replay:null}` when unconfigured | **Keep, frozen** |
| `lib/contracts.ts`, `lib/replay.ts` | Wire types, `eventName`, `utc` | **Keep**; additive helpers only |
| `components/cockpit.tsx` (224 lines) | One file with Recovery, FlightRecorder, Ledger, Sensors, Nemotron, Readiness, state | **Split** into §5.7 modules |
| `components/topology.tsx` | Raw WebGL point-sprite glow behind an SVG map; hard-coded node coordinates; selection only routes a packet | **Replace** with §6 engine; reuse its SVG as the static fallback |
| `components/loss.tsx` | Hand-rolled SVG chart, good honesty (single-sample mode, origin tooltips) | **Keep logic**, extend (§7.4) |
| `components/ui.tsx` | Icons, `Badge`, `PanelTitle` | **Keep**, extend |
| `globals.css` (208 lines) | Dark tokens, grain, panels | **Re-token** (§3), split into layers |
| `web/demo/index.html` | Simulated cockpit: drifting orbs, sim controls, fake chat, r128 three from CDN | **Reference only**, then delete |

### 2.2 What is wrong today (design debt this plan fixes)

1. No **shared selection model**: selecting in one panel only partly updates others; no scrubber; no cursor.
2. Topology is **decorative**: nodes are static, one glow shader, no geometry, no camera, no tooltips, no keyboard access.
3. **No epochs view**, no incident inspector beyond a small box, no handoff brief.
4. The rescue story is **spread across panels**; nothing answers the ten-second question.
5. `cockpit.tsx` mixes fetching, interpretation and rendering. Interpretation (primary/standby inference, milestones) is duplicated inline.
6. Sensor, Photon and Lifeboat panels are inert placeholders with no designed states.
7. No loading skeletons, no `prefers-reduced-motion` handling in the 3D path, no context-loss handling, no mobile bottom navigation.

### 2.3 Pivot checklist (retire the HTML demo)

| Demo feature | Fate in Next.js |
|---|---|
| Glass cards, 3 drifting orbs | Glass kept; **orbs removed** (static gradient mesh, §3.6) |
| 5-node WebGL hero, r128 CDN three | Rebuilt on npm `three@0.170.0`, §6 |
| Packets "only on real events" | Kept as the core rule, §6.5 |
| Loss curve, Lifeboat Score, Photon chat, Nemotron trace | Kept as designed views; **chat becomes read-only comms** (§7.9); Lifeboat is `NO DATA` in replay (§7.10) |
| Scenario buttons (`sc`, `go`), simulated mode | **Dropped.** The cockpit is read-only replay. |

Steps: (1) tag `web/demo/index.html` as legacy in a comment; (2) port tokens (§3, Appendix B); (3) tick the table above; (4) delete the file and its mentions in `docs/`.

---

## 3. Visual identity

### 3.1 Design inspiration, translated (vedp.dev → LIFERAFT)

vedp.dev uses a warm paper background; LIFERAFT deliberately does **not**. We keep its *structure and manners*:

| vedp.dev pattern | LIFERAFT translation |
|---|---|
| Numbered sections `01`, `02`… with an *italic* accent word (e.g. "Selected *work*") | `01 The *rescue*` · `02 The *proof*` · `03 Flight *recorder*` · `04 *Intelligence*` · `05 *Operators*`. Italic serif only on the accent word. |
| Big stat numerals with tiny captions | Recovery metrics (RTO, work lost, last step, epoch) as large tabular numerals. |
| "Hover a node to trace the tools shared across…" relation graph | **Trace**: hover or focus any event, checkpoint, epoch or node and every related item across all views stays bright while the rest dims (§5.4). |
| "Hover to preview, select to open" microcopy | Same pattern: hover previews in a tooltip, select opens the Inspector. |
| Generous whitespace, one accent, restrained motion | Same. Spacing scale §3.4. |
| Paper tone | **Reserved for exactly one surface**: the printable/copyable **Handoff Brief** (`#EEEBE3` paper card, ink `#0B1426`, contrast 15.4:1). It reads like a physical shift note laid on the navy desk. |

### 3.2 Colour (contrast measured)

All text pairs below were computed (WCAG 2.x) against the navy page and the glass surface. Ratios are on `glass` = `rgba(22,35,61,.62)` over `#0A1222`.

| Token | Hex | Role | on `bg-0` | on glass |
|---|---|---|---|---|
| `--bg-0` | `#060B16` | page | — | — |
| `--bg-1` | `#0A1222` | page gradient mid | — | — |
| `--ink` | `#EAF0FB` | primary text | 17.2 | 14.7 |
| `--ink-2` | `#AEBBD3` | secondary text | 10.2 | 8.7 |
| `--ink-3` | `#8A9AB6` | tertiary / captions (min size 12px) | 6.9 | 5.9 |
| `--teal` | `#5FF0D6` | **continuity**: verified paths, checkpoints, resumed step, focus ring | 14.0 | 12.0 |
| `--teal-dim` | `#35C3AD` | secondary teal strokes | 9.0 | 7.7 |
| `--amber` | `#FFB84D` | **risk**: trigger, injected, warnings | 11.5 | 9.8 |
| `--red` | `#FF7C96` | errors, `SIMULATED` | 8.0 | 6.9 |
| `--blue` | `#8DB4FF` | info, epoch 1, `DERIVED` | 9.5 | 8.1 |
| `--violet` | `#C7A8FF` | **provider only** (Nemotron, Photon) | 9.8 | 8.4 |
| `--ctl-border` | `#62779C` | interactive control outline (needs ≥3:1) | 4.4 | 3.7 |
| `--hairline` | `rgba(160,190,230,.14)` | decorative dividers only | — | — |

Text on solid teal/amber/red fills uses `#04101C` (13.6 / 11.1 / 7.8). Colour is **never the only signal**: every state also has text and a glyph (§3.5).

### 3.3 Typography

| Role | Face | Notes |
|---|---|---|
| UI sans | **Geist** (fallback: Inter, system-ui) | 14/1.55 body, `font-variant-numeric: tabular-nums` for all metrics |
| Accent serif | **Instrument Serif Italic** (fallback: Georgia italic) | Only on section accent words and the headline's key phrase |
| Mono | **Geist Mono** (fallback: ui-monospace) | Hashes, ids, timestamps, badges, kickers; 12px, `letter-spacing:.04em` |

Scale (`clamp` for fluid): display `clamp(2.4rem,5vw,4.25rem)` / h2 `1.75rem` / h3 `1.125rem` / body `0.875rem` / caption `0.75rem`. Display tracking `-0.03em`; mono kickers uppercase `.12em`.

**Fonts load via `next/font`.** The tracker records that the build shell could not reach the public registry, so vendor the `woff2` files and use `next/font/local`. Do not depend on Google Fonts at build.

### 3.4 Space, radius, elevation

- 4-pt grid. Section gap `96px` desktop / `56px` mobile. Panel padding `24px` / `18px`. Content max-width `1320px`, gutters `72px` / `16px`.
- Radii: panel `22px`, control `12px`, chip `999px`, topology stage `28px`.
- Elevation is three glass levels only:

| Level | Use | Style |
|---|---|---|
| 0 | page | `--bg` gradient mesh + grain |
| 1 | panels | `rgba(22,35,61,.62)`, 1px hairline, `backdrop-filter: blur(14px)` |
| 2 | tooltip, inspector, bottom sheet, menus | `rgba(26,42,72,.82)`, blur 18px, soft 0 24px 60px shadow |

**Restraint rule:** at most ~6 large blurred elements visible at once. No `backdrop-filter` over the WebGL canvas except the tooltip. Provide a `@supports not (backdrop-filter)` solid fallback.

### 3.5 Provenance badge (the signature element)

Crisp mono pill: glyph + uppercase label, 1px border, never colour alone.

| Source | Glyph | Colour | Meaning shown on hover/focus |
|---|---|---|---|
| `MEASURED` | ● filled | teal | Observed by the system |
| `INJECTED` | ◆ diamond | amber | Software-injected test; not a real fault |
| `DERIVED` | ◇ hollow diamond | blue | Computed from recorded events |
| `PROVIDER` | ✦ spark | violet | External model/service output, advisory |
| `SIMULATED` | ▲ + diagonal hatch | red | Synthetic; banner required |
| `NO DATA` | ○ dashed border | ink-3 | Not in this evidence |

### 3.6 Atmosphere

- **Background:** three static radial gradients (navy, deep indigo, teal-tinted slate) on `--bg-0`. **No drifting orbs.**
- **Grain:** keep the existing static SVG-noise overlay but at `opacity: .06`, `mix-blend-mode: overlay`. No animation.
- **Continuity Spine:** a 1px vertical line in the left gutter linking the section numerals `01–05`. Teal gradient when `verified_resumed`, amber dashed when not, hairline when no data. Static; it encodes the verdict, nothing else.
- **Bloom:** only inside the WebGL stage, restrained (§6.7).

### 3.7 Iconography

Extend the existing 1.55-stroke 24px set (`ui.tsx`). Add: `epoch`, `fence`, `packet`, `filter`, `play`, `pause`, `copy`, `print`, `warning`, `webgl-off`. Icons are decorative (`aria-hidden`); labels carry meaning.

---

## 4. Information architecture and layout

### 4.1 Page map

```
Header   brand · job id · MODE chip (REPLAY) · chain status · Re-verify
─ Skip link, landmarks: header / nav / main / region per section ─

01  The *rescue*        RescueHeadline + RescueStrip
                        TopologyStage (8 col)  |  RecoveryProof (4 col)
    ▒ ReplayScrubber (sticky) ▒
02  The *proof*         LossChart (8) | OwnershipEpochs (4)
                        CheckpointLedger (12)
03  Flight *recorder*   FlightRecorder (7) | Inspector (5)
04  *Intelligence*      NemotronEvidence (7) | HandoffBrief (5)
05  *Operators*         OperatorComms | SensorEvidence | Readiness
Footer  evidence snapshot, chain head, version
```

The **Inspector** is one component with three hosts: sticky right rail at ≥1440px, inline beside the recorder at 900–1439px, bottom sheet below 900px.

### 4.2 Desktop wireframe (≥1280)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◈ LIFERAFT   job: campus-button-05        [● REPLAY]   chain ✓ legacy  Re-verify│
├──────────────────────────────────────────────────────────────────────────────┤
│ 01 ─ The *rescue*                                                            │
│ Training survived. Standby resumed at step 26 from a verified step 25        │
│ checkpoint in 6.5 s, with 0 known steps lost.                  [DERIVED]     │
│ ① Trigger ───── ② Save ───── ③ Handoff ───── ④ Proof                         │
│ ┌ Topology (WebGL) ─────────────────────────┐ ┌ Recovery proof ────────────┐ │
│ │      Laptop A ◇───╮         ╭───◇ Laptop B │ │ 25 ──▶ 26                  │ │
│ │                    ◉ Coordinator           │ │ RTO 6.534 s  Lost 0 steps  │ │
│ │          Pi ◇──────╯  ╰──────◇ ESP32       │ │ Epoch 2 · laptop-b         │ │
│ └────────────────────────────────────────────┘ └────────────────────────────┘ │
├══ ⏮ ◀ ▶ ⏭  ⏵ 1×  ── ticks ────●──────────────────  event 14/21 · 14:02:19Z ═┤ sticky
│ 02 ─ The *proof* … 03 ─ Flight *recorder* … 04 ─ *Intelligence* … 05 ─ *Operators*│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Mobile wireframe (<900)

```
┌ ◈ LIFERAFT  [REPLAY] ┐
│ Headline (3–4 lines) │
│ ①②③④ strip (2×2)    │
│ Topology  (52vh)     │  ← canvas touch-action: pan-y (never hijacks scroll)
│ Proof card           │
│ ▾ 02 Proof (details) │  ← sections collapse; first one open
│ ▾ 03 Recorder        │
│ …                    │
├ ReplayScrubber (fixed bottom, safe-area aware) ┤
│ ◀  ●━━━━━━━━  ▶  ⏵  │
└──────────────────────┘
Tap node / event → bottom sheet Inspector (drag to dismiss, Esc, focus trapped)
```

Breakpoints: `≥1440` rail inspector · `1280–1439` two-column · `900–1279` single column with side-by-sides stacked 2-up · `<900` mobile · `<360` tighten gutters only.

### 4.4 Progressive disclosure (four levels)

| Level | What the viewer sees | Mechanism |
|---|---|---|
| **L0** | Headline + strip + proof numerals | Always visible |
| **L1** | Topology, loss, epochs, milestone recorder | Default sections |
| **L2** | All events, ledger rows, tool evidence, unknowns | Segmented filter, `<details>` |
| **L3** | Raw projection JSON, full hashes, previous→current chain | Inspector "Evidence" disclosure |

Only L0–L1 are rendered expanded by default. Full hashes appear only in L3; elsewhere show 12-character prefixes (`hash_prefix`, `head`).

---

## 5. State architecture (the spine)

### 5.1 Principles

1. **One store, one cursor.** The replay journal is ordered by `seq`. Every view is a pure function of `(replay, cursor, selection, filters)`.
2. **Interpretation lives in `lib/derive/*`**: pure, typed, unit-tested. Components never interpret events.
3. **No new dependencies for state.** A ~120-line store using `useSyncExternalStore` with selector hooks. Hover is a *separate* store so pointer movement never re-renders the app.
4. **GPU state is disposable.** Selection, camera preset and cursor live in the store, so the WebGL engine can be destroyed and rebuilt at any time (context loss, tier drop).

### 5.2 Store shape

```ts
type Status = "idle" | "loading" | "ready" | "error"

interface CockpitState {
  status: Status
  error: { code: "forbidden" | "unverified" | "network" | "unconfigured"; message: string } | null
  replay: Replay | null
  mode: "replay"                       // "live" is a future seam (§12, D3)
  cursor: number                       // index into replay.events (0-based); default = last
  selectedId: string | null            // event id; default per §5.3
  playback: { playing: boolean; speed: 0.5 | 1 | 2 }
  filters: {
    scope: "milestones" | "all"
    kinds: Set<KindGroup>              // lifecycle | checkpoint | ownership | sensor | provider
    sources: Set<Source>
    workers: Set<string>
    epochs: Set<number>
    severities: Set<"INFO" | "WARNING" | "ERROR">
    query: string                      // matches event id, worker, hash prefix, step
  }
  view: {
    inspectorOpen: boolean
    topologyMode: "3d" | "2d"
    motion: "system" | "reduced" | "full"
    quality: "auto" | "high" | "mid" | "low"
  }
  gl: { status: "off" | "booting" | "ok" | "lost" | "failed"; tier: Tier; retries: number }
}
```

Actions: `load()`, `reverify()`, `select(id, opts)`, `setCursor(i)`, `step(±1)`, `jump("trigger"|"checkpoint"|"handoff"|"proof"|"end")`, `play()/pause()`, `setFilter(...)`, `resetFilters()`.

**Default selection** (matches today's behaviour): last of `recovery.evidence_event_ids`, else `trigger`, else null. Default cursor: last event.

### 5.3 URL state (shareable deep links)

Sync with `history.replaceState`, no router navigation: `?e=<event_id>&c=<cursor>&f=<scope>&gl=<2d|3d>`. Parse on load; ignore unknown values; validate `e` against `replay.events`. **Never** put paths, hashes beyond the 12-char prefix, or env data in the URL.

### 5.4 Trace (linked highlighting)

`derive/relations.ts` builds, once per replay, an index `Map<eventId, Relation>`:

```ts
interface Relation {
  eventIds: Set<string>      // evidence_event_ids, trigger, prior/next in chain, checkpoint selected↔committed
  checkpointId?: string
  epoch: number
  worker?: string
  lossSteps: number[]        // samples at this step
  node: NodeId[]             // topology nodes touched
  edge?: EdgeId
}
```

Hover or focus on any item sets `hover.trace = relation`. Subscribed components compute `isRelated(id)` via a selector, so only rows whose boolean flips re-render. Unrelated items drop to `opacity: .45` (never below, to protect contrast). Hover tracing is purely visual; selection is what moves the cursor and camera.

### 5.5 Cursor semantics ("as-of" replay)

- Cursor is **sequence-based**, not wall-clock (journal order is authoritative). Optional time-proportional ticks on the track show real spacing.
- Items with `seq ≤ cursor` are *happened*; later items render as *future* (ghosted at 25% opacity, still readable). Nothing is hidden, so the overall shape of the story is never lost.
- The topology shows state **as of the cursor**; packets and batons animate only when the cursor *advances onto* an event (§6.5), never on idle or on hover.
- Charts draw the full dataset with the cursor marker; samples after the cursor are ghosted.

### 5.6 Optional additive extensions to the projection (not required for MVP)

Keep the API contract intact; these are *new optional fields* that default to absent. Without them, the UI shows `NO DATA`.

| ID | Field | Enables |
|---|---|---|
| X1 | `workers?: { id; role: "primary" \| "standby" \| "operator"; host: "laptop" \| "pi" \| "other" }[]` | Removes client-side inference of primary/standby; labels the Pi node truthfully |
| X2 | `pi_cpu?: { at; temp_c: number; valid: boolean }[]` from validated heartbeats | Pi tooltip and sensor evidence with real samples |
| X3 | `photon?: { at; direction: "out" \| "in"; state: "queued" \| "delivered" \| "acked" \| "failed"; text_redacted }[]` | Operator comms with real receipts |

Each needs: a Python test in `tests/test_cockpit.py`, a regenerated schema snapshot, and a TS type addition marked optional.

### 5.7 Module layout

```
web/
  next.config.ts                  security headers only (see §9.4)
  fixtures/                       replay.campus-button-05.json, replay.local-job.json  (redacted projections)
  src/
    app/
      layout.tsx                  fonts, metadata, themeColor "#060B16"
      page.tsx                    server shell → <CockpitApp/>
      globals.css                 @layer order + @imports
      api/replay/route.ts         FROZEN
    styles/                       tokens.css  base.css  layout.css  components.css  print.css
    lib/
      contracts.ts                FROZEN
      replay.ts                   types + eventName/utc (+ additive helpers)
      derive/                     narrative  epochs  ledger  timeline  relations  loss  topology-frame  handoff
      store/                      cockpit-store  hover-store  selectors  url-sync  prefs
      a11y/                       keymap  announce
      perf/                       tier  budgets
    components/
      app/        CockpitApp  Header  ModeBanner
      rescue/     RescueHeadline  RescueStrip
      topology/   TopologyStage  TopologyFallback  NodeProxy  Tooltip  engine/*
      proof/      RecoveryProof
      training/   LossChart  OwnershipEpochs  CheckpointLedger
      recorder/   FlightRecorder  EventRow  FilterBar  Inspector
      intelligence/ NemotronEvidence  HandoffBrief
      operators/  OperatorComms  SensorEvidence  Readiness
      scrubber/   ReplayScrubber
      ui/         Badge  Icon  Panel  Disclosure  Skeleton  EmptyState  ErrorState  Kbd  Sheet
  tests/          derive.*.test.ts  a11y.spec.ts  visual.spec.ts
```

Migration map: `cockpit.tsx` → `recorder/*`, `training/CheckpointLedger`, `proof/RecoveryProof`, `intelligence/NemotronEvidence`, `operators/*`; `topology.tsx` → `topology/*`; `loss.tsx` → `training/LossChart`; `ui.tsx` → `ui/*`.

### 5.8 Styling approach

Plain CSS with cascade layers (`@layer tokens, base, layout, components, utilities`). **No Tailwind, no CSS-in-JS**: the repo already uses plain CSS, so this keeps the change small. Tokens are CSS variables (Appendix B). Components own one class prefix each (`rescue-`, `topo-`, `ledger-`…).

---

## 6. The topology (centerpiece)

### 6.1 Concept

Five nodes in a shallow perspective plane, coordinator at the centre, like a small diorama lit from within. It must read in two seconds as *who owns the job, where checkpoints go, and what moved when*.

| Node | Role | World pos (x, y, z) | Form (procedural, no model files) |
|---|---|---|---|
| Cloud coordinator | authority; ledger; lease issuer | `(0, 0.2, 0)` | Faceted icosahedron core inside two thin orbit rings. The inner ring marks the **current ownership epoch** (a small notch per epoch crossed). |
| Primary laptop | first owner | `(-3.2, 0.2, -1.6)` | Hinged laptop: base slab + screen plane at ~100°, emissive screen |
| Standby laptop | second owner | `(3.2, 0.2, -1.6)` | Same model; lid at ~70° until it claims the lease, then opens to 100° |
| Raspberry Pi | edge/telemetry node | `(-3.0, -0.1, 2.0)` | Flat slab with chamfered edges, tiny chip cube, row of pin lines |
| ESP32 | sensor gateway | `(3.0, -0.1, 2.0)` | Small slab with serpentine antenna trace and a tiny OLED rectangle |

Starting values; tune visually. Edges: primary↔coordinator, standby↔coordinator, Pi↔coordinator, ESP32↔coordinator (curved, thin, below node height). The ESP32 tooltip notes it reaches the coordinator *via the serial bridge laptop* (from `bridge_id` if projected, else text from the README).

**Primary/standby identification:** primary = worker of `JOB_STARTED` (else `recovery.checkpoint.producer`); standby = worker of the last `LEASE_TRANSFERRED`. This moves from `cockpit.tsx` into `derive/topology-frame.ts` (replaced by X1 if added). Pi is `NO DATA` unless a worker id or X2 evidence says otherwise.

### 6.2 Visual treatment

- **Palette:** nodes are dark glass-navy bodies with teal edge lines (`EdgesGeometry`, 0.35 alpha). Selected node edges go full teal. Amber appears only on trigger-related nodes/edges.
- **Materials:** no `MeshPhysicalMaterial` transmission (too costly). Use `MeshStandardMaterial` (roughness .35, metalness .1) plus a small **fresnel rim** (`onBeforeCompile` injection) for the glass feel.
- **Lighting (no shadow maps):** hemisphere light (navy sky / near-black ground), one cool key directional, one teal rim point light that eases toward the selected node. A blurred contact-shadow sprite under each node.
- **Floor:** a faint radial-masked grid disc, a nod to the existing SVG map grid.
- **Bloom:** restrained, tier-gated (§6.7). Emissive parts only (screens, rings, packets). Strength ≈ .35, radius ≈ .6, threshold high enough that panels never glow.
- **Dimensional depth:** perspective camera, real geometry, parallax from camera easing; no spinning.

### 6.3 Camera

Perspective, FOV 34°. **Guided**, not free-orbit: the viewer can nudge ±18° azimuth and 55–70° polar with drag/arrow keys, but never lose the scene.

| Preset | Position | Look-at | Triggered by |
|---|---|---|---|
| Overview | `(0, 4.6, 9.2)` | `(0, 0.2, 0)` | default, `Esc`, `0` |
| Node focus | node pos + `(0.0, 1.6, 3.6)` toward camera | node | selecting a node |
| Route focus | mid-point of the edge, wider | edge mid | selecting an event with an edge |

Transitions use a **critically damped spring** (no tween library), 600–900 ms, interruptible. Reduced motion → instant cut (§9.5).

### 6.4 Interaction states

| State | Visual | Input |
|---|---|---|
| Idle | base materials | — |
| Hover | rim brightens, label chip, tooltip after 120 ms | pointer (raycast once per rAF while moving) |
| Keyboard focus | **HTML focus ring on the proxy button** + 3D outline | `Tab`, arrows |
| Selected | camera dolly, node edges teal, others dim to 35% | click, `Enter`, or selecting a related event |
| Related (trace) | related nodes/edges stay bright | any trace source |
| Unseen | dashed wire, desaturated, `NO DATA` label | node absent from evidence |

**Tooltips** are HTML, positioned by projecting each node's anchor to screen space (not following the pointer), so mouse and keyboard get identical content. They are hoverable and dismissible with `Esc` (WCAG 1.4.13).

| Node | Tooltip content |
|---|---|
| Coordinator | Local or cloud · epoch now (as of cursor) · checkpoints committed so far · chain head prefix · `DERIVED` |
| Primary | worker id · role "first owner" · last recorded step (as of cursor) · epoch · state (running / yielded / unreachable) · source badge |
| Standby | worker id · "claimed lease at event N" or "not yet claimed" · first resumed step + loss when reached · `MEASURED` |
| Pi | CPU sample or `NO CPU SAMPLE` · `NO DATA` when absent |
| ESP32 | last button frame time · `INJECTED`/`MEASURED` · ambient reading or `NO DATA` · "via serial bridge" |

### 6.5 Animating only real events

The engine receives a **`TopologyFrame`** from `derive/topology-frame.ts`: `{ nodes: NodeState[]; edges: EdgeState[]; transition: Transition | null }`. A `transition` is produced **only** when the cursor advances onto an event that passes its precondition. Idle, hover, filter changes and seeking *backwards* produce no transition; they jump to the final frame.

| Event kind | Visual (teal = continuity, amber = risk) | Precondition |
|---|---|---|
| `JOB_STARTED` | primary claims epoch 1: inner ring notch appears on coordinator | worker known |
| `SENSOR_EVENT_RECEIVED` | amber packet ESP32 → coordinator, chip "button · INJECTED/MEASURED" | `sensor` present |
| `RESCUE_REQUESTED` | single amber halo on coordinator (no packet) | — |
| `PRIMARY_PAUSE_REQUESTED` | amber dashed signal coordinator → primary | primary known |
| `PRIMARY_PROCESS_KILLED` / `PRIMARY_UNREACHABLE` | primary dims, amber outline, **no packet** | primary known |
| `PRIMARY_YIELDED` | primary releases lease ring into coordinator | primary known |
| `CHECKPOINT_COMMITTED` | teal packet worker → coordinator labelled "step N · sha prefix" | worker, `step`, `hash_prefix` present |
| `CHECKPOINT_SELECTED` | teal halo on coordinator (ledger lights), no packet | — |
| `LEASE_TRANSFERRED` | **ownership baton**: ring travels primary → coordinator → standby; epoch counter increments; standby lid opens | previous owner and standby known |
| `FIRST_RESUMED_STEP_COMPLETED` | standby pulse ring "step N" | `step` and `loss` present |
| `RESCUE_VERIFIED` | teal check halo on coordinator | — |
| `JOB_COMPLETED` | all nodes settle, no motion | — |
| `WORKER_HEARTBEAT` | **none**; updates last-seen in tooltip only | — |
| unknown kind | none; generic row elsewhere | — |

Packets use a pool of 8 instanced meshes. Baton: torus along a Catmull-Rom curve, 1.2 s ease-in-out. Each packet's HTML chip carries the evidence text and badge so the animation is also readable statically. Source colour: `INJECTED` amber, everything else teal.

### 6.6 Rendering policy: render on demand

- **No continuous loop.** Render only when (a) the camera spring is active, (b) a transition is playing, or (c) hover/selection/size changed. Idle = zero GPU work.
- Breathing/ambient animation is **off** by default. Selected node gets a static brighter rim, not a pulse.
- Pause on `document.hidden` and when the canvas is off-screen (`IntersectionObserver`).
- Single `ResizeObserver` on the stage; debounce to rAF.

### 6.7 Quality tiers and budgets

| Tier | Pixel ratio | AA | Glow | Chosen when |
|---|---|---|---|---|
| high | `min(dpr, 2)` | MSAA | `UnrealBloomPass` at half res | desktop, dedicated/Apple GPU, auto |
| mid | `min(dpr, 1.5)` | FXAA-style rim | additive halo sprites (fake bloom) | mobile, integrated GPU, auto |
| low | 1 | off | none | after perf drop, `saveData`, user choice |
| static | n/a | n/a | n/a | no WebGL, software renderer, repeated context loss, 2D chosen |

- **Pixel density is always capped.** `renderer.setPixelRatio(Math.min(devicePixelRatio, tier.cap))`.
- **Auto-degrade:** keep an EMA of frame time over 60 *rendered* frames (only counts while rendering). If > 22 ms, drop one tier and never upgrade in-session.
- Software renderers (`failIfMajorPerformanceCaveat: true` fails, or renderer string matches SwiftShader/llvmpipe) → **static**.
- Budgets: < 12k triangles, < 40 draw calls, no external textures (procedural only), engine chunk target ≤ 200 KB gz (measure with the build analyzer; adjust if `three` tree-shaking differs).
- Imports: `import { WebGLRenderer, Scene, … } from "three"` (named only). Bloom from `three/examples/jsm/postprocessing/*`, loaded only on high tier.

### 6.8 Lifecycle, disposal and context recovery

```ts
class TopologyEngine {
  constructor(canvas, opts)          // creates renderer, scene, registry
  setFrame(frame: TopologyFrame)     // diff, then request render
  setCamera(preset: CameraPreset)
  setTier(tier: Tier)
  dispose(): void                    // see below
}
```

- A `Disposables` registry collects every geometry, material, texture, render target and composer on creation.
- `dispose()` clears the registry, calls `renderer.dispose()` then `renderer.forceContextLoss()`, removes the canvas, disconnects observers and listeners.
- **Dev assertion:** after `dispose()`, `renderer.info.memory.geometries` and `.textures` must be 0. Include this in a test and a `?gl=leak-check` dev route.
- **Context loss:** `webglcontextlost` → `preventDefault()`, set `gl.status = "lost"`, show the static fallback immediately with the notice "Graphics paused. Restoring…". `webglcontextrestored` → **construct a new engine** (do not reuse GPU objects), re-apply store state. Allow 3 restores per 60 s; then `failed` with a **Retry 3D** button.
- Dev hook for QA: `?gl=lose` calls `WEBGL_lose_context`; `?gl=off` forces static.
- React strict-mode double-mount must not leak: create the engine in an effect, dispose in cleanup, guard with a ref.

### 6.9 Accessible static fallback

`TopologyFallback` is the existing SVG map, reorganized as the single non-GL representation. It is **always rendered first** (no layout shift), and the canvas fades in over it when ready.

- Same five nodes, same selection, same tooltips, same trace and the same route highlight, so no information exists only in 3D.
- Canvas is `aria-hidden`. A set of five real `<button>` **NodeProxy** elements (absolutely positioned in 3D mode, laid out by the SVG in 2D mode) provide focus, names and the tooltip.
- A visually hidden `<ol>` narrates the topology as of the cursor: *"1. Cloud coordinator, epoch 2. 2. laptop-a, primary, yielded at step 25. …"*.
- Shown when: no WebGL, `static` tier, context failed, `topologyMode === "2d"`, and print.

### 6.10 Loading, empty, error

- **Loading:** fallback SVG with node placeholders at `opacity .5` and a thin teal scan on the *skeleton only* (removed under reduced motion).
- **Empty (no replay):** nodes drawn dashed with `NO DATA`; overlay text: "Open a saved journal to see who owned the job and when." plus a one-line hint to set `LIFERAFT_COCKPIT_JOB`.
- **Error:** see §8.

---

## 7. Views

Every view obeys: provenance badge on every number, designed loading/empty/error/partial states, keyboard-reachable items, trace highlighting, cursor ghosting.

### 7.1 Replay scrubber (global, sticky)

- **Control:** `role="slider"` over `0…events.length-1`, `aria-valuetext="Event 14 of 21: Standby claimed lease, 14:02:19.482Z"`.
- **Track:** ticks per event; milestones taller; colour by source (teal measured/derived, amber injected, red simulated). Hover a tick shows a mini tooltip. Filters dim ticks that don't match (cursor still reaches them).
- **Transport:** ⏮ first · ◀ previous · ⏵/⏸ · ▶ next · ⏭ last · speed `0.5× 1× 2×`.
- **Play:** advances event-to-event with a 900 ms dwell on milestones and 250 ms on others (scaled by speed). Never autoplays. Respects reduced motion (play still steps; animation is instant).
- **Keys:** `←/→` step, `Shift+←/→` previous/next *milestone*, `Home/End`, `Space` play/pause (when scrubber focused), global `J/K` also step.
- Shows `event 14/21 · 14:02:19Z · Standby claimed lease`, and pins a `trace` to that event.
- Placement: sticky under the header on desktop; fixed bottom bar on mobile with safe-area padding.

### 7.2 Recovery proof

Three-stage evidence chain, each stage a button to its event:

```
[1] Verified checkpoint   step 25 · sha256 3fa9c1…   producer laptop-a · epoch 1   [MEASURED/DERIVED]
        ↓ lease fence
[2] Ownership transferred epoch 1 → 2 · laptop-a → laptop-b                          [DERIVED]
        ↓
[3] First resumed step    step 26 · loss 0.4211 · laptop-b · epoch 2                 [MEASURED]
```

Below: four large metrics (stat-numeral style): **Recovery time** (`rto_ms`, seconds, 3 decimals), **Work lost** (`rpo_steps`), **Last recorded step**, **Ownership epoch**. Each `NO DATA` if null. State pill: *Recovery verified · Training completed* / *Recovery verified* / *Awaiting verified recovery*. `Verification limits` disclosure lists `recovery.unknowns` (kept open by default if any exist, since honesty is the feature).

### 7.3 Ownership epochs

Lanes, one per distinct `epoch`, derived from events' `(worker, epoch)`:

```
epoch 1  laptop-a  ████████████████▌ yielded @ step 25      ● ● ● checkpoints
                                  │ fence: lease epoch 1 → 2
epoch 2  laptop-b                  ▐█████████████████ completed @ step 200
```

Each lane: worker, step range (events + losses), first/last event time, checkpoint count, **close reason** (`PRIMARY_YIELDED`, `PRIMARY_UNREACHABLE`, `PRIMARY_PROCESS_KILLED`, `JOB_COMPLETED`, or "open"). The fence is drawn at `LEASE_TRANSFERRED`. Clicking a lane or fence selects its event. Lane x-axis is **step**, aligned with the loss chart above it, so they read as one figure. Lanes after the cursor are ghosted. Epoch colours: 1 blue, 2 teal, ≥3 `--ink-2`.

### 7.4 Training loss (genuine measurements only)

- SVG, axes labelled ("optimizer step", "loss"). Y linear; offer log toggle only if range > 20×.
- Segments split by `(worker, epoch)`; colours as epochs. Break the line wherever steps are non-contiguous (existing rule: join only when `prev.step + 1 === sample.step` and the same epoch).
- **Origin distinction:** `worker log` samples solid, `journal` samples hollow dots. This makes local-log proof distinguishable from journal proof.
- Markers: checkpoint ticks on the x-axis, amber fault line at the last recorded step before the trigger, teal resume line, white cursor line.
- **Hover crosshair** snaps to samples; tooltip `step · loss · worker · origin`. Click a sample → select the nearest event at that step if one exists.
- Zoom: drag to zoom x, double-click or `0` to reset, `+/−` keys. >1500 points → min/max decimation per pixel bucket that always preserves the resume sample.
- **One-sample mode (campus-button-05 has exactly one):** a single large dot, no line, copy "1 measured sample. Only the first resumed loss is available in this journal.", checkpoint ticks still drawn. Must look intentional, not broken.
- Empty: grid placeholder plus "No measured loss samples in this replay."
- `role="img"` with a summary label; a "View as table" `<details>` exposes samples for screen readers (virtualized above 200 rows).

### 7.5 Checkpoint ledger

Table (existing columns, kept): **Step · Producer · Epoch · SHA-256 prefix · Evidence.** Add `Committed (UTC)`, `Status` and a "Used for recovery" teal chip on the selected recovery checkpoint. Row click selects the commit event and sets trace. Sort by step (default descending), sticky header, copy-prefix button per row. Footer: "N verified commits · latest step M". Rows after cursor ghosted. Empty: "No verified commit events in this replay."

### 7.6 Flight recorder

- **Filter bar:** scope segmented control (`Milestones | All events`, as today) plus filter chips: Kind group, Source, Worker, Epoch, Severity, search box. Active filters show as removable chips with a result count `14 of 21`. `Clear` resets.
- **List:** `<ol>` of rows (seq · human name · time · source badge · chevron). Selected row has `aria-pressed`/`aria-current`. Rows after cursor ghosted. Always include the selected event even if filtered out (existing behaviour).
- **Chain strip** (kept): "Chain verified / rechecked", export-head verified or "No export head anchor" (legacy), head prefix. **Re-verify** re-fetches the replay; label it "Re-verify" (it reruns the Python verifier, not a client check); disabled while loading.
- Virtualize past ~200 events with roving tabindex and `aria-setsize/posinset`.
- Filters affect lists and ticks only. They never alter topology truth, chart data or the headline, and the UI says so in the filter tooltip.

### 7.7 Incident inspector

Sections for the selected event (progressive disclosure):

1. **Summary:** human name, one-sentence "why this matters" per kind (copy deck, Appendix C), worker, epoch, step, UTC time.
2. **Provenance:** big badge plus its plain-language meaning (e.g. "Injected: a software drill. No physical fault is claimed.").
3. **Chain:** `previous_hash → hash` (12-char prefix, copy full), links to the previous and next event.
4. **Related:** trace relations as chips (checkpoint, epoch lane, loss sample, evidence events, topology node).
5. **Evidence (L3):** `<details>` with the redacted projection object as formatted JSON, and `Copy event`.

Hosts per §4.1; focus moves into the sheet on mobile and returns to the opener on close. `aria-live="polite"` announces "Selected event 14, Standby claimed lease".

### 7.8 Nemotron tool evidence

Only render a **validated** investigation (the route already validates against the journal). Layout:

- Header: model name, `PROVIDER` badge, banner: **"Advisory. Read-only tools. Cannot change a lease, checkpoint or status."**
- **Tool calls** list: tool name (mono) + cited-event count; expand to show cited event chips (each selects the event).
- **Findings:** each `fact.text` with its evidence chips. A fact with no resolvable evidence id is shown as "Uncited" in amber.
- **Uncertainty** displayed prominently (not collapsed). Then **Outcome**.
- States: none attached → "No saved investigation is attached to this incident."; `investigation_rejected` → "Saved investigation failed validation and was not shown." (amber).

### 7.9 Operator communications

The projection has no Photon data today. Design for honesty:

- Three rows, each `NO DATA` with an explanation: **Delivery**, **Acknowledgement**, **Operator replies**.
- When X3 exists: a message timeline (direction, state chip `queued/delivered/acked/failed`, redacted text, UTC), each message selectable.
- Useful today: **"Copy operator message"** produces a ≤480-character plain-text digest from the Handoff Brief (§7.11) for pasting into the operator channel. The UI never states it was sent.

### 7.10 Sensor evidence and readiness (small, honest tiles)

- **Sensor evidence:** Pi CPU temperature, ambient (DS18B20), ESP32 button as three separate labelled readings (never merged), each with its own badge. Today: ambient and button only from the last sensor frame; Pi CPU `NO DATA` until X2.
- **Readiness (Lifeboat Score):** a disabled ring showing `—` and "A replay has no live lease, standby or telemetry freshness." Tooltip lists the weights (checkpoint freshness 35, standby readiness 25, telemetry freshness 20, lease health 10, drill recency 10) so the idea stays visible without a fabricated number.

### 7.11 Handoff Brief (concise)

A **paper-toned card** (`#EEEBE3`, ink `#0B1426`), ≤ 120 words, generated deterministically in `derive/handoff.ts`. It reads like a shift note and is printable.

```
HANDOFF BRIEF · job campus-button-05 · saved replay
WHAT HAPPENED   A labelled cooling drill (injected) was requested at 14:02:11Z. laptop-a yielded after step 25.
VERIFIED        Checkpoint 25 (sha 3fa9c1…) → laptop-b claimed epoch 2 → first step 26 measured.
                Training completed at step 200. Journal chain verified (legacy, no export anchor).
UNKNOWN         <recovery.unknowns, one line each>
NEXT ACTION     No physical fault is claimed. Confirm drill closure and archive the journal.
```

Rules for **NEXT ACTION** (deterministic, no model):

| Condition | Text |
|---|---|
| not verified | "Do not treat as recovered. Inspect the standby worker's log and the last committed checkpoint." |
| verified and trigger `injected` | "No physical fault is claimed. Confirm drill closure and archive the journal." |
| verified and trigger `measured` | "Review the triggering sensor reading and the primary host before returning it to service." |

If a validated investigation exists, append a separate line: *"Nemotron (advisory): <outcome>"* with a `PROVIDER` badge, visually distinct from the deterministic text. Actions: `Copy as text`, `Copy as Markdown`, `Print` (the print stylesheet prints only this card on paper tone).

### 7.12 Cross-view behaviour (summary)

| User does | Everything that updates |
|---|---|
| Selects an event anywhere | cursor moves; topology camera + route; scrubber; inspector; ledger/recorder highlight; loss marker; epoch lane |
| Hovers anything | trace dims unrelated items; topology tooltip/highlight; **no** cursor move |
| Scrubs | topology frame as of cursor (animated only for forward single steps); charts ghost the future; headline unchanged (it summarizes the whole replay) |
| Changes a filter | recorder list and scrubber ticks only |
| Presses Re-verify | refetch; skeleton on affected panels; selection preserved by id if still present |

---

## 8. States: loading, empty, error, partial

| State | Where | Design |
|---|---|---|
| Loading | whole page | Skeletons keep the grid (no layout shift). Header chip "Checking saved evidence". `aria-busy` on regions. Skeleton shimmer disabled under reduced motion. |
| Unconfigured (`{replay:null}`) | page | Friendly empty hero: "No saved evidence selected." with the exact env var to set and a sample command, in a copyable block. Panels show their own `NO DATA` empties. |
| Forbidden (403) | banner | "The cockpit only serves replay data on this machine." |
| Unverified (422) | banner | "Saved evidence is unavailable or failed verification." plus **Retry**. Do not show partial data. |
| Network / fetch abort | banner | "Couldn't reach the local console." plus Retry. |
| Legacy journal | chain strip | Amber "Unanchored export (legacy)"; not an error. |
| Contains simulated events | persistent banner | Red `SIMULATED` banner, never dismissible. |
| Partial data | per panel | `NO DATA` badge + one-line reason. Never green. |
| WebGL lost/failed | stage | Fallback SVG + notice + Retry 3D (§6.8). |

Errors use `role="alert"` once, then persist visibly. Retry is a real `<button>` with a visible loading state.

---

## 9. Accessibility, responsiveness and performance

### 9.1 Keyboard map

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Natural order: header → headline strip → topology nodes → scrubber → panels |
| `←/→`, `J/K` | Previous/next event (scrubber or global) |
| `Shift+←/→` | Previous/next milestone |
| `Space` | Play/pause when scrubber focused |
| `Enter` | Select focused node/row; open Inspector |
| `Esc` | Close tooltip → close sheet/inspector → camera to Overview |
| `0` | Reset camera and chart zoom |
| `/` | Focus the recorder search |
| `?` | Shortcut help dialog |

No single-key shortcut is active while a text field or a dialog has focus.

### 9.2 Focus and semantics

- **Focus ring:** `outline: 2px solid var(--teal); outline-offset: 3px` on all interactive elements, visible on glass and canvas overlays (≥3:1 against adjacent colours).
- Landmarks: `header`, `nav`, `main`, one `section` per numbered block with `aria-labelledby`.
- Skip link retained and extended: *Skip to rescue*, *Skip to flight recorder*.
- Live regions: `polite` for selection summaries; `assertive` only for errors.
- Touch targets ≥ 44×44 px. Text resizes to 200% without loss. Layout reflows at 320 px.
- `@media (forced-colors: active)`: borders and focus use system colours; badges rely on glyph + text.

### 9.3 Contrast and colour independence

Palette ratios are in §3.2 (all text ≥ 5.3:1 on every surface; control borders ≥ 3.7:1 on glass). Ghosted "future" items stay ≥ 4.5:1 by dimming with **opacity applied to the colour token, not to text over glass**: use `--ink-2`/`--ink-3` for ghost text rather than lowering opacity below the threshold.

### 9.4 Security hygiene

Keep `next dev/start` bound to `127.0.0.1`. Add `next.config.ts` headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`, and a CSP with no third-party origins (fonts are self-hosted). Do not log or render env paths. Keep the route's `Cache-Control: no-store`.

### 9.5 Reduced motion

Honour `prefers-reduced-motion` **and** offer a persisted toggle (`system | reduced | full`).

| Motion | Normal | Reduced |
|---|---|---|
| Camera transitions | 600–900 ms spring | instant cut |
| Packets / baton | animated | final state shown instantly; the HTML chip still announces it |
| Section reveal | 240 ms fade/rise, 60 ms stagger | none |
| Metric tween | 600 ms count-up | none |
| Skeleton shimmer | on | static |
| Playback | steps with dwell | steps with dwell, no tweening |

3D stays available in reduced mode (it is static); a "2D map" toggle is always offered.

### 9.6 Motion budget (when anything moves at all)

Idle = nothing moves. Motion occurs only on: scrubber advance onto a qualifying event, selection camera move, panel reveal on first paint, hover trace (opacity only, 120 ms). No parallax on scroll, no looping effects, no auto-rotating camera.

### 9.7 Performance budgets

| Metric | Target |
|---|---|
| First-load JS (excluding 3D chunk) | ≤ 120 KB gz |
| 3D chunk | ≤ 200 KB gz, loaded only near viewport |
| LCP (local) | < 1.8 s |
| INP while scrubbing | < 100 ms |
| CLS | 0 |
| Frame rate | 60 fps on Apple-silicon laptops; ≥ 30 fps on a 2019 integrated-GPU laptop at `mid` |
| Memory | `renderer.info.memory` flat over 5 minutes of scrubbing/mount cycles |

Techniques: `next/dynamic` with `ssr:false` for the engine, `IntersectionObserver` to load it, `content-visibility: auto` on below-fold sections, memoized derive functions keyed by replay identity, hover store separate from main store, `will-change` only during active transitions.

### 9.8 Mobile specifics

Single column under 900 px; scrubber fixed to the bottom with `env(safe-area-inset-bottom)`; topology `52vh` (min 320 px) with `touch-action: pan-y`; sections as `<details>`; default tier `mid`; Inspector as a drag-to-dismiss bottom sheet with a focus trap; Flight recorder, Ledger and Nemotron share a segmented tab to shorten the page; hover-only affordances get tap equivalents (tap node = select; long-press not required).

---

## 10. Testing and QA

### 10.1 Automated

| Layer | Tests |
|---|---|
| `derive/*` (Vitest, pure) | Fed by **real saved projections**: `fixtures/replay.local-job.json` (21 events, 70 samples) and `fixtures/replay.campus-button-05.json` (79 events, 1 sample, legacy/unanchored). Assert headline text, epochs, topology transitions, handoff brief, relations. |
| Contract | A script validates both fixtures against the TS `Replay` shape and flags unknown required fields; run it in CI next to `npm run typecheck`. |
| Engine | Mount/dispose 20× → `renderer.info.memory` returns to 0; context lose/restore cycle rebuilds; reduced motion yields no transitions. |
| A11y (Playwright + axe) | No serious/critical violations at 1440, 768, 390 px in both GL and 2D modes. |
| Visual | Snapshot the four fixture states: campus, local, empty, error. |

If the registry is unreachable (it was for the previous session), install from the npm cache; if Playwright cannot install, run the manual matrix below and record that in `PHASE_TRACKER.md`.

### 10.2 Manual matrix

| Axis | Values |
|---|---|
| Data | campus (1 sample, legacy), local (70 samples), unconfigured, 403, 422, network down, injected, simulated |
| Viewport | 390, 768, 1440, 1920 |
| Graphics | GL on, `?gl=off`, `?gl=lose`, software renderer |
| Preferences | reduced motion, forced colours, 200% zoom, keyboard-only, screen reader (VoiceOver) |
| Browsers | Chrome, Safari, Firefox |

### 10.3 Ten-second test

Show the first viewport to someone unfamiliar for 10 seconds, then ask the three questions in §1.1. Pass = 3/3 correct for two of three people.

---

## 11. Implementation plan (slices; every slice ships)

The hackathon clock favours **a shippable slice at every step**. Judges weigh design and WebGL, so slices 1–2 come first. If time runs short, stop after S2 + S3-lite.

| Slice | Deliver | Files | Done when |
|---|---|---|---|
| **S0 Foundations** | Tokens, fonts (vendored), cascade layers, store + hover store, URL sync, `derive/narrative|epochs|ledger|timeline|relations|loss|handoff`, fixtures, Badge/Panel/Skeleton/Empty/Error | `styles/*`, `lib/derive/*`, `lib/store/*`, `components/ui/*`, `fixtures/*` | `npm run typecheck` and unit tests pass; old UI still renders on the new tokens |
| **S1 Hero (static-first)** | `RescueHeadline`, `RescueStrip`, `RecoveryProof`, `ReplayScrubber`, `TopologyFallback` with selection/tooltips/trace, `Header`, `ModeBanner` | `components/{app,rescue,proof,scrubber,topology}/*` | **Ten-second test passes**; keyboard-complete; works with GL absent |
| **S2 WebGL stage** | `TopologyEngine`: geometry, lighting, camera presets, packets, baton, tiers, render-on-demand, dispose, context recovery, `NodeProxy` overlay | `components/topology/engine/*` | Event→animation table §6.5 verified on both fixtures; leak test green; reduced motion verified |
| **S3 Linked views** | `LossChart` (zoom, origin, one-sample mode), `OwnershipEpochs`, `CheckpointLedger`, `FlightRecorder` + `FilterBar`, `Inspector` (rail/inline/sheet) | `components/{training,recorder}/*` | One selection updates every view; filters behave per §7.12 |
| **S4 Intelligence + Operators** | `NemotronEvidence`, `HandoffBrief` (copy/print), `OperatorComms`, `SensorEvidence`, `Readiness` | `components/{intelligence,operators}/*` | Brief ≤ 120 words, deterministic, prints clean; all `NO DATA` states designed |
| **S5 Hardening** | Mobile layouts, a11y audit, performance budget check, forced-colors, print stylesheet, error/empty QA, security headers | `styles/*`, `next.config.ts`, tests | §10 matrix passes; budgets in §9.7 measured and recorded |
| **S6 Demo polish** | Deep-link bookmarks for demo beats, screenshots, delete `web/demo/index.html`, update pointers in `AGENTS.md`/`README` | docs | Demo script runs end-to-end with no console errors |

**Order of risk:** S2 is the riskiest (GPU lifecycle). Build S1's fallback fully first so S2 is pure enhancement.

---

## 12. Decisions and open questions

| ID | Decision / question | Default |
|---|---|---|
| D1 | **Dataset switcher.** The route serves one job per server instance (env-configured). A picker would change the API. | **No.** For the demo, run two instances: `npm run start -- -p 3000` (campus) and `-p 3001` (local-job) with different env, or restart between datasets. |
| D2 | Add projection extensions X1–X3 (§5.6)? | Only X1 if time allows; X2/X3 when Pi telemetry / Photon evidence exist. |
| D3 | **Live mode** (poll every 1–2 s per master spec). | Out of scope; store has a `mode` seam and the "live ≠ replay" law stays enforced. |
| D4 | R3F vs imperative three. | **Imperative** (`TopologyEngine`), fewer dependencies, exact control of disposal and on-demand rendering. |
| D5 | Fonts (Geist, Instrument Serif, Geist Mono) are choices, not requirements. | Swap freely if licensing or build constraints bite; the tokens/roles stay. |

### Risk register

| Risk | Mitigation |
|---|---|
| No network at build → web fonts fail | Vendor `woff2`, `next/font/local`, system fallbacks |
| Integrated GPUs choke on blur + WebGL | Tier system, ≤ 6 blur surfaces, no blur over the canvas, solid fallback |
| `three` bundle larger than target | Named imports, lazy chunk, bloom only on high tier, measure early in S2 |
| Python verifier latency on Re-verify | Keep 5 s route timeout, disable button while pending, show skeleton |
| Campus fixture has one loss sample | Designed one-sample mode (§7.4); lead the live demo with the local-job curve and show campus for the physical-button drill |
| Reviewers see "no data" as incomplete | `NO DATA` is a feature: every panel states *why* in one line |

---

## Appendix A — Event kinds

Known kinds in the projection and contracts: `JOB_STARTED`, `SENSOR_EVENT_RECEIVED`, `RESCUE_REQUESTED`, `PRIMARY_PAUSE_REQUESTED`, `PRIMARY_PROCESS_KILLED`, `PRIMARY_UNREACHABLE`, `PRIMARY_YIELDED`, `CHECKPOINT_COMMITTED`, `CHECKPOINT_SELECTED`, `LEASE_TRANSFERRED`, `FIRST_RESUMED_STEP_COMPLETED`, `RESCUE_VERIFIED`, `JOB_COMPLETED`, `WORKER_HEARTBEAT`. Contract-level kinds that may appear: `CHECKPOINT_CREATED`, `CHECKPOINT_UPLOADED`, `CHECKPOINT_VERIFIED`, `COOLING_FAILURE_TEST`. Unknown kinds render a generic row via `eventName()` and never animate.

**Kind groups for filters:** *Lifecycle* (`JOB_*`, `RESCUE_*`), *Checkpoint* (`CHECKPOINT_*`), *Ownership* (`LEASE_*`, `PRIMARY_*`, `FIRST_RESUMED_*`), *Sensor* (`SENSOR_*`, `COOLING_*`, `WORKER_HEARTBEAT`), *Provider* (events with `source === "provider"`).

**Milestones** (default Flight Recorder scope, kept from today): `JOB_STARTED`, `SENSOR_EVENT_RECEIVED`, `RESCUE_REQUESTED`, `PRIMARY_PROCESS_KILLED`, `PRIMARY_UNREACHABLE`, `PRIMARY_PAUSE_REQUESTED`, `PRIMARY_YIELDED`, `CHECKPOINT_SELECTED`, `LEASE_TRANSFERRED`, `FIRST_RESUMED_STEP_COMPLETED`, `JOB_COMPLETED`.

## Appendix B — Token starter (`styles/tokens.css`)

```css
@layer tokens {
  :root {
    color-scheme: dark;
    --bg-0:#060B16; --bg-1:#0A1222;
    --glass:rgba(22,35,61,.62); --glass-raised:rgba(26,42,72,.82);
    --hairline:rgba(160,190,230,.14); --ctl-border:#62779C;
    --ink:#EAF0FB; --ink-2:#AEBBD3; --ink-3:#8A9AB6;
    --teal:#5FF0D6; --teal-dim:#35C3AD; --amber:#FFB84D;
    --red:#FF7C96; --blue:#8DB4FF; --violet:#C7A8FF;
    --on-fill:#04101C; --paper:#EEEBE3; --paper-ink:#0B1426; --paper-muted:#4A5568;

    --r-panel:22px; --r-ctl:12px; --r-stage:28px;
    --gap-section:96px; --pad-panel:24px;
    --ease-out:cubic-bezier(.2,.7,.2,1); --dur-1:120ms; --dur-2:240ms; --dur-3:600ms;

    --font-sans:"Geist",Inter,system-ui,sans-serif;
    --font-serif:"Instrument Serif",Georgia,serif;
    --font-mono:"Geist Mono",ui-monospace,SFMono-Regular,Consolas,monospace;
  }
  @media (max-width:899px){ :root{ --gap-section:56px; --pad-panel:18px; } }
  @media (prefers-reduced-motion:reduce){ :root{ --dur-1:0ms; --dur-2:0ms; --dur-3:0ms; } }
}
@layer base {
  body{ background:var(--bg-0); color:var(--ink); font:14px/1.55 var(--font-sans); font-variant-numeric:tabular-nums; }
  :focus-visible{ outline:2px solid var(--teal); outline-offset:3px; }
  .accent{ font-family:var(--font-serif); font-style:italic; font-weight:400; }
  .ghost{ color:var(--ink-3); }              /* future items: dim via token, not opacity */
}
```

## Appendix C — Copy deck

| Key | Copy |
|---|---|
| Mode chip | `REPLAY · SAVED EVIDENCE` |
| Empty hero | "No saved evidence selected. Set `LIFERAFT_COCKPIT_JOB` and restart the console." |
| 422 | "Saved evidence is unavailable or failed verification." |
| 403 | "The cockpit only serves replay data on this machine." |
| Injected help | "A software-injected drill. No physical fault is claimed." |
| Simulated banner | "Contains simulated events. Do not treat as observed." |
| Legacy chain | "Unanchored export (legacy). Chain links verified; no export head to anchor." |
| One-sample chart | "1 measured sample. Only the first resumed loss is available in this journal." |
| Nemotron banner | "Advisory. Read-only tools. Cannot change a lease, checkpoint or status." |
| Comms empty | "No delivery or acknowledgement evidence attached." |
| Lifeboat empty | "A replay has no live lease, standby or telemetry freshness." |
| Context lost | "Graphics paused. Restoring…" / "3D unavailable. Showing the 2D map." |

Why-this-matters one-liners (Inspector):

| Kind | Line |
|---|---|
| `CHECKPOINT_COMMITTED` | "A verified snapshot of model and optimizer state the standby can resume from." |
| `LEASE_TRANSFERRED` | "Ownership moved to a new epoch. The old owner can no longer commit work." |
| `FIRST_RESUMED_STEP_COMPLETED` | "The first optimizer step measured on the new owner. This is the proof of recovery." |
| `SENSOR_EVENT_RECEIVED` | "A frame from the ESP32. Check its badge to see whether it was measured or injected." |
| `RESCUE_REQUESTED` | "The coordinator accepted a request to move the job." |

## Appendix D — Demo beat sheet (aligns with `docs/DEMO_SCRIPT_AND_SUBMISSION.md`)

Real recorded numbers from the repo (do not embellish): **campus-button-05** (physical-button drill): checkpoint 25 → first step 26, completed at 200, RTO 6.534 s, RPO 0, 79 events (legacy, unanchored), 1 measured loss sample. **local-job** (`cooling-test`): checkpoint 32 → first step 33, completed at 70, RTO 2.183 s, RPO 0, 21 events, 70 measured samples.

| Time | Show | Say |
|---|---|---|
| 0:00–0:10 | Headline + strip | "Training survived. Here is the proof." |
| 0:10–0:30 | Press play: amber trigger → teal checkpoint packet → baton → resume pulse | "Every motion is a recorded event." |
| 0:30–0:50 | Recovery proof, epochs aligned over loss | "Saved at 25, measured at 26, on a different machine." |
| 0:50–1:10 | Flight recorder: filter to *Injected*, open Inspector, show chain | "Injected means a drill; the log says so." |
| 1:10–1:30 | Nemotron evidence chips → jump to events | "Advisory, read-only, every claim cited." |
| 1:30–1:50 | Handoff Brief → Copy / Print | "The 3 a.m. handoff, in 100 words." |