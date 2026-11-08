# Hardware progress report

Date: 2026-11-07 America/Chicago (evidence timestamps use UTC on 2026-11-08).
Scope: hardware preparation, standalone firmware, operator documentation and
Windows bench tools. Phase 3 coordinator implementation is maintained separately.

## Result

The Pi is booted and available through Raspberry Pi Connect. The ESP32 has been
identified, backed up, flashed with a USB-only application and physically tested.
The button, OLED and temperature sensor are NOT yet wired or bench-verified.
This is not a claim that all hardware or the end-to-end system is complete.

## Raspberry Pi — observed evidence

| Item | Result |
| --- | --- |
| Board | Raspberry Pi 5 Model B Rev 1.1 |
| Hostname | `liferaft` |
| OS | Debian 13 trixie base, aarch64 |
| Python | 3.13.5; isolated `~/liferaft-venv`, pip 25.1.1 |
| Memory | 4.0 GiB total; 3.5 GiB available at observation |
| Disk | 50 GB available on root at observation |
| CPU temperature | 41.7 C at observation, measured through Pi OS |
| Power/thermal flags | `throttled=0x0` at observation |
| Outbound HTTPS | Actual HTTP/2 200 from PyPI |
| Administration | Connect desktop and shell observed; direct SSH timed out |
| Cooling | No fan or cooler available, per operator inventory |

Pi readings came from the operator's actual terminal output/screenshots in the
hardware setup chat. They are historical samples, not continuous monitoring or a
measurement of temperatures under training. Official PyPI metadata lists CPython
3.13 Linux ARM64 wheels for the project's exact Torch, NumPy and pydantic-core
pins. This establishes wheel availability, not a successful Pi package install.

Added a standalone read-only Pi health script and optional systemd oneshot/timer
templates. They are NOT installed or enabled on the Pi. The script fails closed
for missing/invalid data, wrong platform, power flags or the conservative fanless
setup threshold. It explicitly never authorizes training. The template uses a
dynamic non-root identity, bounded resources, read-only filesystem, no network
access and journal output. Dynamic-user access to `vcgencmd` is unverified; missing
access must remain an attention state rather than be hidden by broad privileges.

The existing training worker lacks Pi thermal guards, and no cooler is installed.
Keep Pi training off and use the two-laptop training arrangement for now.

## ESP32 — observed physical bench results

| Stage | Result |
| --- | --- |
| Photo identification | ESP32-S3-N16R8 marking; actual PCB vendor/revision unknown |
| COM socket with current C-to-C cable | Did not enumerate; cause unproven |
| Native USB socket | Powered board; COM7 application USB device observed |
| BOOT/RST sequence | ROM USB-Serial/JTAG enumerated on COM8 |
| Actual ROM identity | ESP32-S3 revision 0.2, 16 MB quad flash, 8 MB embedded PSRAM |
| Original-flash backup | 16,777,216 bytes, 105.2 s, local size/hash verified |
| Build | Passed, PlatformIO Espressif 8.0.0 / Arduino 3.3.12 |
| Upload | Passed, all four written components hash-verified |
| Application serial proof | Passed: three real increasing counters, 2 s intervals |

The original backup is private and ignored under
`.liferaft/esp32-original-20261107/`. Backup restoration is not tested. Firmware
uses no Wi-Fi, accessory GPIO, OLED, sensor, relay, cloud credential or actuator.
The build reported 314,434 bytes of program flash and 22,336 bytes of RAM. The
application binary is 319,632 bytes, SHA-256
`1982413572b9793d4da285226d2f6ca8f1499bd3fa1001d37674609f2ea4ed26`.

An interrupted upload was handled by checking for active processes, re-enumerating
USB and inspecting serial output before retrying. The completed upload took
8.13 s. The default reset retained manually entered download mode, so the first
post-upload capture correctly failed. Espressif's documented `watchdog-reset`
option performed a full ESP32 reset; the next capture passed with sequence
4/5/6 and uptime 8008/10008/12008 ms at
`2026-11-08T03:05:26.645250+00:00`. Proof is retained locally in
`board-only-proof.json`. No eFuse writes or entire-chip erase were performed.

## Files and reproducibility

- `hardware/esp32/`: pinned PlatformIO configuration, board-only application and
  exact setup/build/upload/reset instructions with the measured results.
- `scripts/esp32_capture.py`: explicit-port, Espressif-only serial capture,
  15-second deadline, bounded line size, three increasing counters required.
- `hardware/requirements-tools.txt` and `.lock`: isolated Windows hardware tools.
  Installed under ignored `.liferaft/hardware-tools`; compiler cache and build
  output remain under `.liferaft/`.
- `scripts/pi_health.py`, `tests/test_pi_health.py`, `hardware/pi/`: read-only Pi
  diagnostic, boundary tests and uninstalled startup templates.
- `docs/HARDWARE_READINESS.md`: detailed Pi plan, photo inventory, safety and
  software handoff requirements.
- `docs/WINDOWS_STANDBY_SETUP.md`: private scoped-credential provisioning guide
  and commands for the existing Windows standby environment.
- `PHASE_TRACKER.md`: retains software-team and hardware evidence, with accurate
  incomplete phase gates.

Verification commands and final release results are recorded in the tracker.
Actual hardware proof comes from serial capture, not compilation alone.

### Publication validation

- `.venv/Scripts/python.exe -m unittest discover -s tests -v`: 26 tests passed
  in 108.241 s on Windows. Includes the Pi health boundaries and existing
  cloud/foundation, real training/resume and two-process failover tests.
- The real 200-step training test resumed at step 121 with maximum same-host
  loss difference 0.0; this is a Windows local check, not Pi training evidence.
- `.venv/Scripts/python.exe -m compileall -q liferaft scripts tests`: passed.
- `git diff --check` and `git diff --cached --check`: passed.
- All 15 staged files were checked for merge markers, credential patterns and
  exact matches to privately configured local profile values. No findings.
  Environment files, original flash and build binaries remain ignored/excluded.
- Resolved the tracker conflict by retaining both the upstream cross-laptop
  software evidence/failure and this hardware session's independent results.
- Shareable summary in `docs/HARDWARE_SHARE_SUMMARY.md`: exactly 200 words.
- On-Pi execution of the new health script/systemd units, sensor/OLED/button bench
  tests and integrated cloud hardware recovery were not run. No TypeScript source
  was changed; no TypeScript build was claimed during this publication.

## Required next physical steps

1. Unplug ESP32 USB before adding/removing jumpers. Leave the relay disconnected.
2. Supply a clear separate-button photo, temperature-sensor printed part number
   and back-of-sensor-board photo. The G/R/Y header letters alone are insufficient
   to assign supply/data pins. If photos are unreadable, report exact markings.
3. Set aside the resistor read as yellow-violet-red-gold (4.7k, 5%). Its value has
   not been measured. The sensor board appears to contain a `472` resistor, but
   its role/connection is unverified; an extra pull-up may not be needed.
4. Verify OLED controller and supply rating. Photos show GND/VCC/SCL/SDA and a
   GME12864 board marking, but these do not establish all electrical ratings.
5. Once identified, wire and test button, OLED and temperature sensor separately,
   then combine them with validated serial firmware. Require actual press,
   display and measured ambient-temperature evidence, including disconnect cases.
6. Integrate with the software team's cloud API afterward. Sensor temperature is
   ambient, distinct from Pi CPU temperature. Button emergencies remain injected.
   A physical button must never switch Pi/laptop/fan power.

No new hardware purchase, Pi training workload, service enablement, relay wiring
or physical sensor test is represented as having occurred. No secrets or raw flash
backup should be committed or included in the shareable report.

## Software-team status at reporting time

The merged tracker records actual cloud authentication and cross-laptop checkpoint
handoff, followed by a failed finish-to-step-200 check. Preserve both observations:
the handoff is evidence, but the full completion gate remains open. No software
phase percentage or completed physical sensor integration is inferred.
