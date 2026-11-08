# Hardware readiness and next steps

**Current operator direction:** breadboard wiring and accessory tests are deferred.
The latest photo-based header reference and base-hardware handoff are in
`docs/HARDWARE_CONNECTION_REFERENCE.md`. Earlier inspection notes below retain
their historical context; the later physical ESP32 test supersedes initial
"not detected" observations.

Scope: Pi preparation alongside the software team's Phase 3. ESP32 wiring is
deferred at the hardware operator's request. Nothing here marks Phase 3 complete.

## Verified on the real Pi

Evidence came from the operator's Raspberry Pi Connect terminal screenshots and
HTTP output in the hardware setup chat on 2026-11-07 America/Chicago. These are
previous measurements, not a live health feed.

| Check | Observed result |
| --- | --- |
| Hardware | Raspberry Pi 5 Model B Rev 1.1 |
| Hostname / login | `liferaft` / `vedpatel` |
| OS base | Debian GNU/Linux 13 (trixie), version 13.7 |
| Architecture / Python | aarch64 / 3.13.5 |
| Memory | 4.0 GiB total, 3.5 GiB available at observation |
| Root filesystem | 57 GB total, 50 GB available at observation |
| CPU temperature | 41.7 C, measured by `vcgencmd measure_temp` |
| Power / thermal flags | `throttled=0x0` at observation |
| HTTPS | `curl -I --max-time 10 https://pypi.org` returned HTTP/2 200 |
| Remote administration | Raspberry Pi Connect desktop and remote shell observed |
| Direct SSH from Windows | TCP/22 timed out at the Pi address; cause unproven |
| Isolated Python | `~/liferaft-venv`, pip 25.1.1 on Python 3.13 |
| Cooling | No fan or cooler, per operator inventory |

The official 27W supply and card insertion were operator setup steps; the supply
rating and board placement were not independently physically inspected. A past
41.7 C measurement does not establish temperature under training load.

## Decisions already made

- Keep real training on the two laptops for the Phase 3 gate. The uncooled Pi is
  limited to light setup/diagnostics for now. No training auto-start.
- Keep Connect as the administration route. Campus discovery and direct SSH are
  unnecessary for the product's outbound HTTPS architecture.
- The current project requires Python >=3.11,<3.14, so this Pi's Python fits.
- Official PyPI metadata was queried on 2026-11-08 UTC. Exact project pins have
  CPython 3.13 Linux ARM64 wheels: `torch==2.15.0`, `numpy==2.4.1`, and
  `pydantic-core==2.41.5`. This is availability evidence, not a successful Pi
  installation or full dependency-resolution test. Do not build Torch from source
  on the fanless board if a wheel install fails.
- Workers need the foundation requirements plus the training extra. The
  `requirements-cloud.lock` Atlas driver and Gunicorn are coordinator dependencies;
  do not install these on the Pi merely because it uses the cloud API.
- The current `liferaft/worker.py` does not read Pi temperature, and its cloud CLI
  starts real training. Do not use it as a health-only process or auto-start it.
- The current coordinator binds primary/standby identity through role tokens;
  do not run the Pi and Laptop A simultaneously with the same primary credential.
  Pi enrollment and ownership must be coordinated with the software team.

## Prepared locally, not installed on the Pi

`scripts/pi_health.py` takes one standard-library-only, read-only sample. It does
not import Torch, load `.env`, claim leases, send telemetry, or control hardware.
Missing/invalid temperature, unknown power flags, wrong model/architecture or
temperature >=60 C produce ATTENTION and exit 1. The 60 C limit is our conservative
fanless setup policy, not the manufacturer's throttling threshold. Exit 0 means
LIGHT_SETUP_ONLY and explicitly never authorizes training.

`hardware/pi/liferaft-health.service` and `.timer` are optional systemd templates.
They are not installed or enabled anywhere by this work. They use a dedicated
dynamic non-root identity, read-only filesystem, journal output, bounded runtime,
CPU/memory limits, no restart loop and a one-minute timer. They have no network
access and do not report to the coordinator. This does not implement the worker
startup requirement.

After these files are available on the Pi, the engineering operator can perform
the following installation through an authorized shell. The computer-control
skill currently prevents this assistant from typing into terminal UIs; direct SSH
from this laptop failed. This is why on-device execution is still pending.

```sh
# Run from the project root on the Pi. No package installation required.
python3 scripts/pi_health.py
# Copy templates only; these commands DO NOT enable automatic startup.
sudo install -d -m 755 /opt/liferaft-hardware
sudo install -m 644 scripts/pi_health.py /opt/liferaft-hardware/pi_health.py
sudo install -m 644 hardware/pi/liferaft-health.service /etc/systemd/system/
sudo install -m 644 hardware/pi/liferaft-health.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/liferaft-health.service /etc/systemd/system/liferaft-health.timer
sudo systemctl daemon-reload
sudo systemctl start liferaft-health.service
sudo journalctl -u liferaft-health.service -n 5 --no-pager
systemctl is-enabled liferaft-health.timer
```

Success is one JSON sample and an expected `disabled` timer status. Dynamic-user
access to `vcgencmd` is unverified: if it cannot read power flags, the sample must
remain ATTENTION. Do not run it as root, change device permissions, or add broad
hardware access to hide the failure. Keep manual read-only measurements as the
fallback. Do not enable the timer until this on-device check passes. Stop a
running health sample with `sudo systemctl stop liferaft-health.service`;
it normally exits by itself. None of this shuts down the Pi.

## Hardware operator's remaining work

1. Keep the Pi on a dry, stable, nonconductive, uncovered surface, powered directly
   by its official supply. Leave GPIO and relay disconnected. No new cable is
   needed while Connect works. If the board behaves abnormally, stop software
   setup and get an on-site hardware mentor; do not experiment with power wiring.
2. At the next installation session, use Connect's screen-sharing page to open
   the Pi browser and retrieve the team's published, reviewed code revision.
   Do not copy a private repository token into a URL, chat or screenshot. If the
   hardware files are not yet published, wait for that handoff; avoid typing long
   scripts by hand or downloading an unrelated branch. Writing files locally on
   Windows has not transferred them to the Pi.
3. When Phase 3 is deployed and verified, obtain the public coordinator HTTPS
   origin and a Pi-approved scoped role credential through private sharing.
   Store only that role's token in its ignored profile (permissions 600). Never
   put the Atlas URI, server token set or operator credential on the Pi. The
   software owner must resolve primary identity before provisioning the Pi.
4. Then run the existing non-training command from the repo's Pi environment:
   `~/liferaft-venv/bin/python -m liferaft cloud --profile primary doctor`.
   Expected fields are `auth: true`, `database: true`, `role: primary`.
   This checks authenticated connectivity only; it does not prove checkpoint
   transfer. Missing credentials/service means BLOCKED, not a pass. Continue with
   the two-laptop local fallback in `docs/PHASE_3_ATLAS_SETUP.md`.
5. After cooling is physically confirmed and the software team adds tested thermal
   guards and graceful stop, install the pinned training environment in the venv
   and perform a bounded Pi test followed by a real Pi-to-laptop restore. No
   purchases, training, package installation or worker service is authorized or
   performed merely by this readiness document.
6. ESP32, button, OLED and DS18B20 remain deferred. Before wiring, identify actual
   board revision, USB data port, sensor pinout, OLED voltage/interface, and the
   4.7k pull-up resistor. Follow the staged safety runbook. Relay stays disconnected.

## Information needed from Phase 3, without secrets in chat

Deployment URL, verified code revision, successful live doctor and two-laptop
recovery evidence, approved Pi role/identity, and private credential delivery.
The hardware operator does not need to create another Atlas project or modify
Render, roles, leases, checkpoint storage or the cloud API.

## Sources

- [Exact Torch wheel metadata](https://pypi.org/pypi/torch/2.15.0/json)
- [Exact NumPy wheel metadata](https://pypi.org/pypi/numpy/2.4.1/json)
- [Exact pydantic-core wheel metadata](https://pypi.org/pypi/pydantic-core/2.41.5/json)
- [systemd service sandbox and DynamicUser](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
- [systemd monotonic timers](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html)

## ESP32 bench inventory — operator photos, 2026-11-07 local date

- Module shield is marked `ESP32-S3-N16R8`; PCB underside says `ESP32-S3`.
  This identifies the marked module family, not an authenticated manufacturer or
  confirmed flash/PSRAM capacity. The PCB is DevKitC-style; exact vendor/revision
  remains unknown. Do not assume the official Espressif board's entire circuit.
- Two USB-C sockets are present, labeled `COM` and `USB` on the underside. In the
  front photo with sockets at the top, `COM` is the right-hand socket. Start with
  that USB-to-UART route, connected to the laptop alone, with all jumpers removed.
  If no serial endpoint appears, check the cable and actual labels before trying
  driver installation. No driver or flash settings have yet been selected.
- OLED front header labels read `GND VCC SCL SDA`. Back marking reads
  `GME12864-11-12-13`, `V3.22`, with IIC address choices `0x3C`/`0x3D`.
  This supports an I2C module identification; controller and voltage rating remain
  unverified. No power wiring authorized from the photos alone.
- Temperature breakout header labels read `G R Y`, with an `S` nearby. A resistor
  appears marked `472` (4.7k ohms), but sensor part marking, traces and the
  resistor's electrical connection are not established. Do not assign VCC/GND/DQ
  from header letters or package shape. Need readable sensor marking and back
  photo before connecting it.
- Button and resistor-strip photos remain outstanding. A 4.7k four-band resistor
  is yellow-violet-red, followed by its tolerance band (often gold). A five-band
  4.7k resistor is yellow-violet-black-brown, followed by its tolerance band
  (often brown). Read bands from the correct end and verify by close-up or meter;
  an external pull-up may be unnecessary if the breakout's existing pull-up is
  confirmed. No resistor has been selected or connected.
- Serial enumeration immediately after reviewing photos still listed Bluetooth
  COM3–COM6 only. USB connection, chip identity, board-only firmware, accessory
  wiring and all physical bench tests remain pending.

### Subsequent observed USB and ROM test

The native `USB` socket powered the board and enumerated as COM7
(`VID:PID=303A:4001`). The application-mode chip query returned no serial data.
The operator held BOOT, briefly pressed/released RST, then released BOOT.
The ROM enumerated as COM8 (`VID:PID=303A:1001`). This was confirmed by an actual
successful esptool query, not inferred from the two red LEDs.

`esptool --port COM8 --before no-reset --after no-reset --no-stub
--connect-attempts 2 flash-id` reported ESP32-S3 QFN56 revision 0.2, 8 MB embedded
PSRAM, a 40 MHz crystal, quad 16 MB flash and 3.3 V flash voltage. This only reads
the eFuse voltage setting; it does not change it.

`esptool --port COM8 --before no-reset --after no-reset --connect-attempts 2
read-flash 0 ALL .liferaft/esp32-original-20261107/original-flash.bin` saved
16,777,216 bytes in 105.2 seconds. Local size and SHA-256 were checked:
`d73b6dd5a15e469a30629798664fb6e9e5c0ee30ef2679d75858d97a72b6fb15`.
Backup is ignored and private; restoration has not been tested.

The operator identified an available resistor as gold-red-purple-yellow, which
read from the opposite end is yellow-violet-red-gold (4.7k, 5%). It is set aside;
no sensor pull-up circuit is yet connected or validated.
