# LIFERAFT — UI Design System (for `web/` Next.js console)

Reference implementation: `web/demo/index.html` (single file, no build). Port tokens and motion to Next.js components named in the master spec §11.

## Look
- Dark glass: surfaces `rgba(255,255,255,.06)`, 1px `rgba(255,255,255,.12)` border, `backdrop-filter: blur(18px)`, radius 20-28px.
- Background: 3 large blurred gradient orbs (blue `#6ea8ff`, violet `#b08cff`, teal `#3ddc97`), slow drift animation, plus a faint grain.
- Type: system UI stack for body, tabular numerals for metrics, small-caps mono for badges.
- Status colors: ok `#3ddc97`, warn `#ffb84d`, bad `#ff5c7a`, info `#6ea8ff`. Never use color alone; pair with text.

## Motion (all decorative; data never depends on animation)
- Cards fade/slide in with 60ms stagger. Metrics tween over 600ms. Status chip pulses while a rescue is in progress.
- WebGL hero (three.js, pinned `r128` from cdnjs): 5 nodes (Cloud center, Pi 5, Laptop A, Laptop B, ESP32), edge lines, packets flowing along edges. Packets are emitted only on real events (checkpoint commit, sensor event, lease transfer, download).
- Respect `prefers-reduced-motion`: stop orbit and orbs, keep state changes.

## Components to port (names from master spec §11)
`SystemTopology` (WebGL), `TrueLossCurve` (canvas/recharts, checkpoint + fault + resume markers), `SensorEvidence` (Pi CPU and ambient shown separately), `CheckpointLedger`, `RescueTimeline` (Flight Recorder), `NemotronTrace`, `OperatorMessages`, `RecoveryMetrics`, plus new `LifeboatScore` and `ProvenanceBadge`.

## Rules
- Every number has a source badge. Missing data shows `NO DATA`, never green.
- `Rescue complete` only after first verified optimizer step on the new owner.
- Simulated mode has a persistent banner. Demo controls are hidden when `DEMO_MODE` is off.
- Responsive: single column under 900px, 44px touch targets, visible focus rings.
