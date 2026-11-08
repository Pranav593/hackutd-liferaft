# LIFERAFT — Upscale Plan (idea, presentation, judging fit)

Additive layer on top of the Codex specs. UI requirements are now superseded by `docs/COCKPIT_PLAN.md`; honesty rules (measured vs injected vs simulated) stay law.

## 1. Judging fit (HackUTD ZeroDay criteria, from Devpost)
| Criterion | How LIFERAFT scores it |
|---|---|
| Innovation | Physical sensor to verified compute rescue, hash-chained Flight Recorder, Lifeboat Score |
| Technical complexity | PyTorch checkpoint/resume, lease fencing, ESP32 serial bridge, Nemotron tool agent, Photon two-way |
| Completeness | Phase 0-2 local engine must work end to end before any polish; demo mode covers the rest |
| Design | Next.js evidence cockpit governed by `docs/COCKPIT_PLAN.md` |
| Impact | Data-center teams lose training progress and context at handoff (NMC² prompt) |
| Presentation | 2-minute video script in `docs/DEMO_SCRIPT_AND_SUBMISSION.md` |

## 2. Tracks to enter (Devpost: up to 3 sponsor + 1 HackUTD track; MLH any number)
- Sponsor: **NMC²**, **NVIDIA Nemotron beyond a chatbot**, **Photon**.
- HackUTD track: **Best Hardware** (ESP32 + OLED + Pi 5). Design is a strong alternative if hardware is flaky.
- MLH optional: **Tiger Data** (telemetry is time-series; only if time allows, see spec scope rule), **Vultr** (host coordinator/web).
- Verify prize text on the live MLH/Devpost pages before submitting; sponsor rubrics were not fully visible.

## 3. Engineering additions
UI provenance, journal inspection, readiness display and handoff requirements are
superseded by [COCKPIT_PLAN.md](COCKPIT_PLAN.md). A read-only replay has no live
readiness score. The coordinator still owns the hash chain and recovery state.

**Rescue Drill:** the physical button remains a labelled injected event. Drills
never induce actual overheating and never grant the UI recovery authority.

## 4. Who uses it (criterion 3)
- **NOC engineer at 3 a.m.:** gets one Photon message, replies `STATUS`, never opens a laptop.
- **ML engineer:** wants proof the job resumed at step K+1 with the same optimizer state.
- **Data-center manager:** wants a fleet-level readiness number and an auditable timeline.

## 5. Build order
Follow S0�S6 in [COCKPIT_PLAN.md](COCKPIT_PLAN.md) for the console. Continue core
hardware/cloud/provider phases in PHASE_TRACKER.md independently. No replay view
claims a missing live integration is working.

## 6. Do not
Claim real overheating, invent savings numbers, or show simulated data without the SIMULATED badge.
