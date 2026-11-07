# LIFERAFT — 2-minute demo video + Devpost copy

Devpost needs: title, description, repo, tracks, demo video (**max 2 min, demo only**). Final edits lock **Sun Nov 8, 12:00pm CST**; team must be registered on Devpost by **11pm Sat Nov 7**.

## Video script (≈120 s)
| Time | Shot | Say |
|---|---|---|
| 0:00-0:12 | Cockpit hero, orbiting nodes | "AI jobs die with their servers. LIFERAFT saves the work and hands it to another machine." |
| 0:12-0:30 | Loss curve running, checkpoints committing, badges MEASURED | "A real PyTorch job on a Raspberry Pi checkpoints to private storage, each one SHA-256 verified." |
| 0:30-0:50 | Physical button press on ESP32, OLED reads TEST | "Our ESP32 sensor board sends a labeled drill. We never overheat anything; the badge says INJECTED." |
| 0:50-1:15 | Rescue timeline, epoch 4 to 5, resume at K+1 | "A deterministic controller fences the old owner, a laptop verifies the checkpoint and resumes. Recovery time is measured, not claimed." |
| 1:15-1:40 | Nemotron trace, then Photon chat STATUS/WHY | "Nemotron investigates with read-only tools and writes the handoff brief. Photon keeps the on-call engineer in the loop." |
| 1:40-2:00 | Lifeboat Score, Verify chain | "Before any incident, Lifeboat Score shows work at risk. Every event is hash-chained. Keep the world running." |

Record the real run if available; otherwise record the cockpit in sim mode and say "simulated replay" aloud.

## Devpost description skeleton
Problem (data-center handoffs and lost progress) > What it does > How we built it (ESP32, Pi 5, PyTorch, lease fencing, Nemotron tools, Photon) > Honest limits (checkpoint-aware workloads, drill not real overheating) > What's next.
