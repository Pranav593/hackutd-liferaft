# LIFERAFT — Target CLI flows and beginner-operable scenarios

This file tells Codex which commands and everyday procedures to *implement*. Commands are target interface contracts, not assertions that they already run. Codex may adjust syntax if it documents equivalent commands in `README.md` and keeps automated tests.

## A. Development mode, no hardware or cloud required

```bash
# Codex generates the actual environment creation/installation commands per OS.
# Run local tests without internet credentials.
liferaft doctor --redact
liferaft train --mode local --job demo-job-001 --steps 200 --seed 1729 --checkpoint-every 10
liferaft resume --mode local --job demo-job-001 --checkpoint <path-to-actual-owned-checkpoint>
liferaft demo --scenario cooling-test
liferaft demo --scenario worker-crash
python -m unittest discover -s tests -v
```

Expected: real numerical loss, checkpoint SHA and resume step, not a fake UI. Failed checkpoint test yields refusal, not silent restart from zero. Use own generated dataset.

## B. Cloud workspace bring-up

Follow the [Phase 3 Atlas and Render setup guide](docs/PHASE_3_ATLAS_SETUP.md) for
hosted setup, authenticated readiness checks and the two-laptop recovery drill.
Each laptop connects to the coordinator over HTTPS.

## C. Pi 5 primary worker (preferred)

```bash
# Executed on Raspberry Pi 5 as ordinary non-root user, with official Pi supply and safe cooling.
liferaft doctor --pi --redact
liferaft worker start --mode cloud --role primary --job demo-job-001 --steps 200
```

Expected: genuine CPU training steps; read-only actual Pi CPU temp; cloud checkpoints. At any hazard: stop through the worker's graceful CLI. Do NOT use a relay/physical power disconnect.

## D. Laptop A standby

```bash
liferaft doctor --cloud --redact
liferaft worker start --mode cloud --role standby --job demo-job-001
```

Expected: standby remains idle until legitimate lease claim; downloads verified checkpoint; after transfer completes real optimizer step. The same code should work if Pi unavailable and another laptop is primary.

## E. Laptop B hardware bridge and operator UI

```bash
liferaft doctor --hardware --redact
liferaft sensor bridge --transport usb-serial --port <detected-device-port> --baud 115200
# in separate terminal:
cd web && npm run dev
```

Expected: ESP32 sends measured ambient temperature and injected button events; bridge validates, publishes to cloud; OLED shows cloud-confirmed state. USB unplugging triggers `SENSOR_OFFLINE`, not forced rescue. Browser on Laptop B opens operator console from Next.js.

## F. Physical safe rescue

1. Check `pi-primary` and `laptop-standby` are online. Check at least one checkpoint is committed and verified.
2. Verify Pi CPU temperature is in a normal range; fan (if compatible) operating normally; laptop remains plugged in. No fan manipulation.
3. On ESP32 press the **test button** once. UI must show `INJECTED COOLING TEST`, not a factual thermal emergency.
4. Primary worker is asked to save/yield through cloud polling. Backup obtains a **new epoch**, downloads checkpoint and completes first real new step.
5. OLED displays `TEST RESCUED` only after cloud confirmation; UI shows RTO/RPO and checkpoints; Nemotron and Photon independently record explanatory/communication actions.
6. To run again, use project-scoped `liferaft demo reset --job demo-job-001` only after stopping worker processes. It must never delete unrelated cloud records, OS data or other people's files.

## G. Crash mode (software only)

1. While job is running, Codex-provided command targets **only** the LIFERAFT training child process PID, not `python` system-wide, Pi OS, network manager, fan daemon, or a classmate's program.
2. Watch the lease expire; standby claims and resumes from previous committed checkpoint. RPO may be nonzero and must be measured honestly.
3. Old worker returning later must be fenced and pause.

## H. Evidence script

`liferaft evidence export --job demo-job-001 --redact` should produce: event timeline, hardware event origin, checkpoint IDs/hashes, primary and backup identities, real loss history, RTO/RPO, lease epochs, cloud transport mode, Nemotron provider status/tool trace, Photon provider status/ACK, `test_mode=true` for injected emergency, and list of gaps. Never put secrets or operator phone number in export.

## I. Shutdown and cleanup

1. Stop active training processes gracefully through LIFERAFT CLI.
2. Close serial monitor/bridge and unplug ESP32 USB only after firmware is idle. Do not rewire live board.
3. Shut down Pi through ordinary OS shutdown **when finished**, then remove official power supply after shutdown is complete. Do not pull powered Pi microSD card.
4. Leave active cooler installed if manufacturer recommends not removing it. Do not disassemble borrowed hardware.
5. Cloud cleanup is **manual, scoped and non-destructive**: Codex must show exactly which LIFERAFT-owned objects/tables would be affected and request approval before deleting anything.
