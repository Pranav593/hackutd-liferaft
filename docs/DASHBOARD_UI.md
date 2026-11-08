# Single-page dashboard UI

The user's latest UI request supersedes the earlier long-page visual layout.
Content placement is provisional and intentionally easy to change.

- Five desktop bento surfaces occupy approximately equal areas: Honeydew
  `#F1FAEE` (outcome), Deep Space Blue `#1D3557` (handoff diagram), Strawberry Red
  `#E63946` (trigger), Frosted Blue `#A8DADC` (progress), Steel Blue `#457B9D`
  (shift handoff). Neutral black is used for small text on red/steel to preserve
  contrast; large pale headings retain the supplied palette.
- Flat fills only: no radial backgrounds, gradients, grain, bloom or rim glow.
- The overview uses everyday language. Clicking any complete card opens an
  accessible in-page dialog with the existing technical evidence and definitions.
- Detailed records, checkpoints, ownership, loss charts, worker topology,
  investigation, copy/print handoff, device evidence and messages remain available.
- The dashboard fits a desktop viewport and stacks naturally on mobile. Native
  dialog behavior plus explicit focus wrapping keeps details keyboard accessible.
- Replay source labels, missing-data states and verified-success gates remain
  evidence driven. Local worker processes are never described as two computers.

Design reference reviewed: the actual styles and disclosure patterns in
[VEDLEGENDARY/Portfolio-Website](https://github.com/VEDLEGENDARY/Portfolio-Website).
Borrowed editorial typography, thin rules, numbering, clear disclosure and
restrained interactions; the five-color palette comes from the supplied image.

Primary files: `components/app/CockpitApp.tsx`, `components/dashboard/*`,
`lib/derive/dashboard.ts`, and `styles/*` under `web/src`.

Checks: `npm run typecheck`, `npm run test:contracts`, `npm test`, `npm run build`.
Browser checks: `LIFERAFT_COCKPIT_URL=http://127.0.0.1:3105 npm run test:e2e`
(set the environment variable separately in PowerShell).
