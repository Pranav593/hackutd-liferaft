# LIFERAFT — Beginner team setup: exact human actions, why, verification and fallbacks

**Who this is for:** a team that has never configured a cloud database, Raspberry Pi, ESP32, NVIDIA API or Photon. Codex is responsible for technical implementation and chooses tools/versions. Humans provide physical access, provider accounts, consent, secrets in their own environment and simple point-and-click actions.

## 0. Rules before you begin

- **Do not send API keys, password strings, OAuth codes or personal phone numbers in the chat.** Put secrets in the local `.env` file or secure provider dashboard only. Codex should tell you exactly which variable name to fill and how to confirm without revealing the value.
- Do not type commands from an unverified blog that writes/erases disks or changes Pi power/fan/boot settings. Only use commands supplied by Codex after it has matched your OS and identified devices.
- Use the same private Git repository for the team, but never commit `.env`, keys, operator phone numbers or confidential logs.
- Anything labeled `OPTIONAL` is not needed to prove a real rescue. Build the real checkpoint/restart first.
- Only pay for cloud/API service or attach credit-card details if your team explicitly agrees after checking current free credits and limits. Codex must not initiate billable subscriptions without approval.

## 1. Identify the three computers and their job

**Preferred setup:**

| Computer | Name | What it does | What the human physically does |
|---|---|---|---|
| Raspberry Pi 5 | `pi-primary` | Runs a small real AI-training job and reports CPU temperature | Insert prepared microSD, power with official 27W supply, keep correctly cooled |
| Laptop A | `laptop-standby` | Receives checkpoint and resumes the training job | Install Git/Python and keep running worker CLI |
| Laptop B | `laptop-operator` | Shows dashboard, connects ESP32 over USB, runs human control tools | Open browser; plug in ESP32 USB cable; keep laptop on power |

**If Pi setup or PyTorch is blocked:** Laptop A becomes primary and Laptop B becomes standby; Pi 5 may still be a health/temperature node. Codex records the active mode honestly in the dashboard. Two laptops plus ESP32 still demonstrate LIFERAFT completely.

## 2. Network — campus Wi-Fi isolation does not stop us

You do **not** need to connect Pi/laptops directly to each other. Each runs outgoing requests to the same cloud service over HTTPS. This resembles how two mobile phones can both reach a website even though they cannot reach each other locally.

### Human actions

1. On **each laptop**, connect to an internet network and open a normal browser to `https://www.mongodb.com` and `https://build.nvidia.com`. The page must load.
2. If Pi 5 connects to campus Wi-Fi, confirm it can browse/public HTTPS from its own shell (Codex provides `liferaft doctor --network` after login). If school enterprise sign-in or network policy prevents Pi joining, connect Pi to a **permitted personal hotspot or travel router** instead. Campus policy takes precedence.
3. You may use different networks for different devices; that is fine as long as all have internet access. A laptop on campus Wi-Fi and Pi on a phone hotspot can still communicate by cloud relay.
4. Do not ask campus IT for opened inbound ports; we don't need them. Do not run `nc`, expose server to all interfaces or try campus port-forwarding for the primary path.
5. We connect ESP32 to Laptop B over USB by default, so **ESP32 Wi-Fi is not needed**; no campus Wi-Fi password must be stored on it.

### How to verify

Codex runs `liferaft doctor --network` on the Pi and both laptops. Green checks for `cloud HTTPS reachable` on each device; direct local pings may fail and that's expected. A later integration test checks actual cross-device checkpoint movement.

### Fallback

If a network blocks service URLs, use another allowed network or team hotspot. If cloud service temporarily fails, run the local simulator to continue coding but do not call it a cross-machine success.

## 3. Install standard software on the laptops

**Human action:** Tell Codex whether each laptop runs **Windows, macOS or Linux**. This is an acceptable factual input; Codex must choose commands and solve installation issues. If already obvious from the terminal, Codex should discover it instead of asking.

Install (as Codex directs via OS-specific verified methods):

1. **Git** — downloads/updates code so team members share one project.
2. **Python 3.11+** — runs training, Pi worker and telemetry bridge. Codex chooses a pinned Python version compatible with chosen PyTorch and cloud packages.
3. **Node.js current supported LTS** — runs Next.js dashboard. Codex checks which version its chosen Next.js version requires.
4. **Code editor/Codex** — runs the development workflow; use one repository, separate folders/branches as appropriate.
5. **USB device drivers**, only if necessary — ESP32-S3 board revision determines if a USB-UART driver is needed. Codex identifies connector/port/VID:PID, then gives exact driver link and instructions.

**Verification:** Codex runs `python --version`, `git --version`, `node --version`, `npm --version`, and an installation/doctor script. You should see versions, not `command not found`. Do not manually guess version numbers.

## 4. Create cloud coordination and checkpoint storage

Use the [Phase 3 Atlas and Render setup guide](docs/PHASE_3_ATLAS_SETUP.md) for
account setup, scoped credentials, deployment and the two-laptop drill.

## 5. Get an NVIDIA Nemotron API key

**What it is:** An API key lets a hosted Nemotron model receive operational evidence and issue structured tool calls; you do not run the large model on the Pi.

**Human steps:**

1. Open `https://build.nvidia.com/search/models?q=Nemotron` and sign in/create NVIDIA developer access as needed.
2. Browse model cards and choose a currently available Nemotron that **supports tool/function calling**. Codex will recommend and verify model ID and invocation based on actual provider docs. Do not manually pick a model solely by its marketing name.
3. Open its API/"Get API Key"/deployment instructions (current wording may differ). Generate a key with only the rights needed. Check any free-credit/quota or pricing information before proceeding.
4. On the **trusted backend/runtime** set `NVIDIA_API_KEY`; choose `NVIDIA_MODEL_ID` equal to the documented actual hosted model identifier. Do not expose the key in frontend source or browser.
5. Notify Codex only **"the NVIDIA key is configured"**, not the value.

**Verification:** Codex sends one minimal real request with model ID and then verifies tool calling by giving it a small read-only `get_incident` tool; captured trace must show real provider tool-call structure and a final answer grounded in returned tool data.

**Fallback:** If account quotas block live calls, Codex implements/test-drives a faithful mock adapter and keeps Phase 7 status `BLOCKED_EXTERNAL` rather than pretending live Nemotron works. It may use alternate available Nemotron models as long as they truly support tool calls.

## 6. Set up Photon for two-way messages

**What it is:** A communications API that sends a real incident text/message to an engineer and receives their reply. Using the API is different from drawing a text bubble on a website.

**Human steps:**

1. Open `https://photon.codes/docs/beta/api-reference` and follow its current project setup. Sign up/login to Photon; create a project named `LIFERAFT`. Review the channel availability, any costs, regional restrictions, and what your account currently supports.
2. In the Photon dashboard, find the **project ID** and create a **project API key** (`pho_sk_...` as the official docs currently describe). Store them in the trusted backend's secret settings as `PHOTON_PROJECT_ID` and `PHOTON_API_KEY`. Never expose the key to browser/Pi/ESP32 code, and never paste it in chat.
3. Choose one supported messaging channel available to your team's account and location (for example, a supported messaging app or phone number). Different channels have different provisioning and carrier-compliance requirements. **Do not assume free SMS, iMessage or voice is instantly enabled.** Codex must read current channel docs and produce exact UI instructions *specific to the available channel* before you click purchase/activation. An explicit team decision is required for charges.
4. Ask one consenting teammate to use their personal phone/account for the test. Enter that contact **privately** as `PHOTON_OPERATOR_DESTINATION`, not in public source or logs.
5. Codex configures either a secure hosted Photon webhook destination or officially supported event WebSocket for inbound messages, verifies provider-specified signature/auth and event ID, and maps messages to a live incident.
6. Send a minimal test `LIFERAFT connection test — reply STATUS`. Reply on the real device. Codex must show actual provider message IDs and map the inbound `STATUS` to live coordinator data.

**Verification:** outbound message received, inbound `STATUS` delivered to cloud function, authenticated operator allowlist passes, returned data is real, duplicate provider delivery doesn't duplicate action.

**Fallback:** If no eligible messaging channel is available, keep outbound/inbound adapter fully unit-tested in fake mode, mark live mode blocked and document exactly which human/provider action is missing. Never fake an SMS as real.

**Important API note:** Photon 2.0 currently uses base `https://api.photon.codes`, with routes under `/v1`, and project-scoped keys only work under `/v1/projects/{projectId}`. Codex must verify *specific* paths/schema using current official OpenAPI; do not guess URLs from old documentation. Beta iMessage currently has a limited feature set; plain text first.

## 7. Prepare the Raspberry Pi 5 using microSD

**What it is:** Pi 5 is a small Linux computer. The microSD card is its main storage. Correct initial flashing happens on your laptop, not via relay or hardware wiring.

**Human actions:**

1. Confirm you still have the **64GB microSD** and card reader from your earlier inventory. If not, get a compatible spare. **Back up any existing contents**: installing Pi OS erases the selected card.
2. On a laptop install official **Raspberry Pi Imager** from `https://www.raspberrypi.com/software/`. This is the preferred supported tool.
3. Insert only the intended Pi microSD card in the reader. In Imager, choose **Raspberry Pi 5**, **Raspberry Pi OS 64-bit**, and the 64GB target microSD. Carefully cross-check capacity and device identity. **Never choose your laptop's internal drive.** If uncertain which storage is selected, stop and ask Codex to help identify it from the OS—not to guess.
4. Use Imager's advanced settings to set hostname `liferaft-pi`, create a new non-default user and strong password or SSH public key, enable SSH, and configure an approved Wi-Fi network where supported. Avoid committing Wi-Fi credentials. If the campus network needs enterprise authentication and cannot be configured safely, use a team hotspot/private network permitted by policy.
5. Write/verify the card through Imager and eject cleanly. Insert in Pi 5 while power is unplugged.
6. Inspect the fan. If it is the official compatible Pi 5 active cooler, follow manufacturer's attachment directions **with Pi unpowered**. If type is unknown, do not wire. Keep Pi ventilated and run tiny workloads only after confirming temps.
7. Plug the **official Raspberry Pi 27W USB-C supply directly into the Pi**. Optionally connect the micro-HDMI cable to a monitor, or connect via SSH configured above. Keyboard/mouse/display need not be assumed for headless mode.
8. Run only the install/health commands Codex supplies after detecting Pi OS, RAM and architecture. Do not run arbitrary `sudo` scripts or firmware changes from the internet. Pi OS may already have Python; Codex installs pinned dependencies in a virtual environment, not system Python, when possible.
9. Do not remove the SD card while Pi is on. To finish, stop LIFERAFT worker normally, shut down Pi through the OS, wait for shutdown to complete, then unplug power.

**Verification:** Pi boots, SSH/login works, `hostname`, `uname -m`, `python3 --version`, `df -h`, CPU temperature and HTTPS cloud doctor report sane values. Test a short CPU workload before anything long-running.

**Fallback:** If Pi setup takes too long or ARM PyTorch wheel problems arise, no unsafe system changes: keep Pi as read-only edge telemetry node and use Laptop A as actual primary compute worker.

## 8. Connect ESP32, OLED, button and DS18B20 safely

Do **NOT** start by wiring all components. Read `HARDWARE_SAFETY_AND_WIRING.md` and follow its stages in order: USB board-only, button, OLED, DS18B20, cloud bridge. You may need a **4.7kΩ pull-up resistor** if the 18B20 is a bare sensor; ask on-site mentors/store before connecting it if missing. Your current list says "Arduino wires" but does **not** confirm a 4.7k resistor or a correct ESP32 USB data cable. Don't improvise a substitute.

For each stage, humans perform only the physical plugging/unplugging and visible inspection. Codex writes firmware, determines board variant/pin map/compilation toolchain, flashes firmware, tests serial data and UI, and explains what expected output looks like. The relay stays disconnected.

**Verification:** press button and see one event labeled `injected`, real DS18B20 ambient reading if wired, OLED displays cloud-confirmed state, no fan/power manipulation, no unsafe temperature.

## 9. What Codex is permitted to ask us for

Codex should use this template whenever it truly needs team action:

```text
ACTION NEEDED FROM TEAM (only if the step cannot be done by Codex)
Goal: What this unlocks and why it is required.
What you need: exact account/device/cable, not jargon.
Exact steps: numbered clicks/physical actions, matching our OS/board/provider.
What to enter: safe configuration values and environment variable names; NEVER paste keys into chat.
What you should see: literal expected indicator/text/LED/success message.
Safety check: steps that could erase data, cost money or damage hardware; what NOT to do.
If it fails: specific recovery/alternate supported option.
Reply with: only non-secret status information, e.g. "done" or redacted error.
```

Do not ask us which SQL locking strategy to use, which libraries are best, how to handle ARM dependencies, what a Python package error means, what GPIO to use, how to parse API payloads, what cloud auth scheme is most appropriate or whether to fake an integration. These are Codex's decisions.

## 10. Quick glossary

- **Checkpoint:** a saved model + optimizer + training state so a job can continue after interruption.
- **Primary:** the computer currently working on the job.
- **Standby:** the computer ready to take over if primary cannot safely continue.
- **Heartbeat:** the worker's periodic "I am alive" signal to cloud coordinator.
- **Lease:** time-limited permission to act as current owner of one job.
- **Fencing epoch:** increasing number that invalidates old workers after ownership transfers.
- **Cloud coordinator:** hosted service deciding which machine owns the job; both devices contact it themselves.
- **Private storage bucket:** hosted private folder for checkpoint bytes.
- **API key:** password-like secret a service recognizes. Never share in chat or commit.
- **Firmware:** small program flashed to ESP32 for reading the button/sensor and displaying state.
- **I2C:** low-speed two-wire communication used by OLED, with SDA data and SCL clock.
- **1-Wire:** sensor protocol used by DS18B20; needs data line and typically pull-up resistor.
- **RTO:** how long rescue takes until first new training step on backup.
- **RPO:** how many completed training steps might be lost since the last committed checkpoint.
- **Actual vs injected:** `measured` data comes from sensor/OS; `injected` means a test button or software scenario.
