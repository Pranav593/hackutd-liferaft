# LIFERAFT — Codex handoff, version 2.0

**Purpose:** Implement the entire LIFERAFT project, phase by phase, with the exact hardware the team has. This package contains implementation instructions and setup/runbooks; it is **not** an already-built application.

## What to hand Codex

Place all files in this package at the root of a new Git repository. Start Codex with `CODEX_START_PROMPT.txt`. Codex must read `AGENTS.md`, `LIFERAFT_MASTER_SPEC.md`, `PHASE_TRACKER.md`, `TEAM_SETUP_GUIDE.md`, `HARDWARE_SAFETY_AND_WIRING.md`, `INTEGRATION_CONTRACTS.md`, `TEST_MATRIX.md`, and `SPONSOR_ALIGNMENT.md` before writing code.

**One-line product:** LIFERAFT is an infrastructure rescue system that saves a real computing job before or after a server failure and continues it on another machine from a verified checkpoint, coordinated through independent sensors, an NVIDIA Nemotron diagnostic agent, and Photon operator messaging.

## Actual equipment

- One Raspberry Pi 5, one fan (exact kind not yet identified), official Raspberry Pi 27W USB-C power supply, micro-HDMI-to-HDMI cable, USB-C-to-USB-C cable.
- One ESP32-S3-DevKitC-1; one Arduino Uno + breadboard, jumper wires; one DS18B20 temperature sensor (called "18B20 Temp" by the team); one SSD1306 0.96-inch OLED display; one button; one relay module.
- Two laptops.
- Previous conversation also identified one 64GB microSD card and a card reader: verify they are still available before setting up the Pi.

## Important deployment choice

The campus Wi-Fi may isolate devices. **Do not rely on direct laptop-to-laptop, Pi-to-laptop or ESP32-to-laptop network connectivity.** In cloud mode all workers independently use **outbound HTTPS** to a cloud coordinator + private checkpoint storage. For physical sensing, ESP32 **USB serial into the operator laptop** is the most reliable default; ESP32 Wi-Fi is optional.

## Read in this order

1. `AGENTS.md` — Codex rules; no questions about ordinary technical decisions.
2. `LIFERAFT_MASTER_SPEC.md` — full product, design, state machine, phase-by-phase work.
3. `INTEGRATION_CONTRACTS.md` — API, event, checkpoint and token contracts.
4. `HARDWARE_SAFETY_AND_WIRING.md` — read **before powering or wiring components**.
5. `TEAM_SETUP_GUIDE.md` — exact human account/device setup and information Codex must request when actually required.
6. `TEST_MATRIX.md` — negative tests and proof of actual recovery.
7. `SPONSOR_ALIGNMENT.md` — verified wording and what integrations must do.
8. `PHASE_TRACKER.md` — record phase completions and evidence.
9. `.env.example` — names of needed environment variables; NEVER commit real values.

## Hard boundaries

Never control the Pi 5 power supply, its cooling fan or a laptop's power with the relay. Never intentionally overheat hardware, use a hair dryer, cover vents, cut power to a storage device, or drive more than 3.3V into ESP32 GPIO. An injected button event represents a **simulated cooling failure** and must be labeled as such. A DS18B20 mounted nearby measures ambient/local temperature, **not Pi CPU temperature**. Measure Pi CPU temperature separately using read-only OS telemetry.

## Definition of done

A real job runs on the Pi 5 (preferred, after compatibility checks) or on Laptop A (fallback); checkpoints move to authenticated private cloud storage; a deliberately injected incident triggers a recovery policy; another physical computer fetches the latest valid checkpoint and resumes training; measured training progress and integrity proof appear in the console; a real Nemotron tool-call trace and a real Photon round trip are available when credentials are configured; the ESP32 button/temperature sensor and OLED participate in the live workflow. All steps have automated tests and reproducible setup docs.

The package stays focused on engineering, physical setup, testing, and operation.
