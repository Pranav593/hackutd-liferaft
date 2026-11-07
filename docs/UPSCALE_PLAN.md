# LIFERAFT — Upscale Plan (idea, presentation, judging fit)

Additive layer on top of the Codex specs. Nothing in `LIFERAFT_MASTER_SPEC.md` is replaced; honesty rules (measured vs injected vs simulated) stay law.

## 1. Judging fit (HackUTD ZeroDay criteria, from Devpost)
| Criterion | How LIFERAFT scores it |
|---|---|
| Innovation | Physical sensor to verified compute rescue, hash-chained Flight Recorder, Lifeboat Score |
| Technical complexity | PyTorch checkpoint/resume, lease fencing, ESP32 serial bridge, Nemotron tool agent, Photon two-way |
| Completeness | Phase 0-2 local engine must work end to end before any polish; demo mode covers the rest |
| Design | Glass cockpit in `web/demo/index.html` plus `docs/UI_DESIGN_SYSTEM.md` |
| Impact | Data-center teams lose training progress and context at handoff (NMC² prompt) |
| Presentation | 2-minute video script in `docs/DEMO_SCRIPT_AND_SUBMISSION.md` |

## 2. Tracks to enter (Devpost: up to 3 sponsor + 1 HackUTD track; MLH any number)
- Sponsor: **NMC²**, **NVIDIA Nemotron beyond a chatbot**, **Photon**.
- HackUTD track: **Best Hardware** (ESP32 + OLED + Pi 5). Design is a strong alternative if hardware is flaky.
- MLH optional: **Tiger Data** (telemetry is time-series; only if time allows, see spec scope rule), **Vultr** (host coordinator/web).
- Verify prize text on the live MLH/Devpost pages before submitting; sponsor rubrics were not fully visible.

## 3. Idea upscale (5 additions, ordered by value/effort)
1. **Provenance badges everywhere** (`MEASURED`, `INJECTED`, `DERIVED`, `PROVIDER`, `SIMULATED`). Cheap, makes honesty visible, judges trust it.
2. **Hash-chained Flight Recorder.** Each event stores `prev_hash = sha256(prev_event_json)`; a Verify button recomputes the chain. Tamper-evident incident history for postmortems. (+1 column on `events`.)
3. **Lifeboat Score (0-100), deterministic, no LLM.** Weighted: checkpoint freshness 35, standby readiness 25, telemetry freshness 20, lease health 10, drill recency 10. Shows "estimated work at risk" before any incident. This is the "one step ahead" in the NMC² prompt.
4. **Rescue Drill mode.** The button press is a labeled drill; drills raise the score and give ops teams rehearsed confidence. Same code path as real incidents.
5. **Handoff Brief.** After rescue, Nemotron (read-only tools) writes a shift-handoff note: what happened, what is verified, what is unknown, next human action. Delivered through Photon. Directly answers "unclear handoff" in the NMC² prompt.

## 4. Who uses it (criterion 3)
- **NOC engineer at 3 a.m.:** gets one Photon message, replies `STATUS`, never opens a laptop.
- **ML engineer:** wants proof the job resumed at step K+1 with the same optimizer state.
- **Data-center manager:** wants a fleet-level readiness number and an auditable timeline.

## 5. Build order for the remaining hours
1. Phases 0-2 from `PHASE_TRACKER.md` (real checkpoint, resume, local failover). Do not skip.
2. Wire the cockpit (`web/demo/index.html`) to real events behind the same event names as the sim (`CHECKPOINT_COMMITTED`, `RESCUE_REQUESTED`, ...). The sim and real feed share one `log()` shape.
3. Phase 5 button -> real rescue. 4. Phase 7/8 only after the above; mock adapters stay labeled.
4. If cloud (Phase 3) is not ready, use the local coordinator and say so on screen.

## 6. Do not
Claim real overheating, invent savings numbers, or show simulated data without the SIMULATED badge.
