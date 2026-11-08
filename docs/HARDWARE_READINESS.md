# Hardware status and safe continuation

Consolidated 2026-11-08 from the hardware readiness, connection and progress
reports. These are historical observations, not a live health feed. Exact
bench procedures remain in hardware/esp32/README.md, BUTTON_SETUP.md and
OLED_SETUP.md; safety requirements remain in HARDWARE_SAFETY_AND_WIRING.md.
Phase completion and subsequent evidence remain in PHASE_TRACKER.md.

## Observed equipment

| Item | Observed result and limit |
| --- | --- |
| Pi | Pi 5 Model B Rev 1.1, Debian 13/aarch64, Python 3.13.5 |
| Pi resources | 4 GiB RAM, 3.5 GiB available; about 50 GB free at observation |
| Pi health | 41.7 C, throttled=0x0 at observation; no cooler reported |
| Pi access | Raspberry Pi Connect worked; direct SSH timed out; outbound PyPI HTTPS worked |
| Pi environment | ~/liferaft-venv; wheel availability was checked, installation/training not established |
| ESP32 | S3 revision 0.2, 16 MB flash, 8 MB embedded PSRAM; exact PCB vendor unknown |
| USB | Native USB worked; COM socket did not enumerate with the tested cable |
| Backup | Original 16,777,216-byte flash saved privately; restore untested |
| Firmware | USB-only upload/hash check and three increasing boot counters physically observed |
| OLED | Standalone SSD1306 I2C bench passed, address 0x3C and visible text confirmed |
| Button/sensor | See dedicated button guide for staged setup; no combined ambient/button/OLED cloud proof inferred |

Original flash is ignored under .liferaft/esp32-original-20261107/; SHA-256
was d73b6dd5a15e469a30629798664fb6e9e5c0ee30ef2679d75858d97a72b6fb15.
The boot-counter sample was captured at 2026-11-08T03:05:26.645250+00:00.
Neither saved flash nor local proof files belong in Git. COM7/COM8 were observed
ports, not permanent assignments: re-enumerate after reconnecting.

## Wiring facts and unresolved identity

- ESP32 component side facing you, sockets at top: native USB on left, COM on
  right. Follow actual board labels, not an assumed DevKitC clone pinout.
- OLED labels are GND/VCC/SCL/SDA. GME12864-11-12-13 V3.22 matches the documented
  SSD1306 I2C family. Use 3.3 V supply and logic. Last working reported layout:
  GND j1, VCC j21 (3V3), SCL j8 (GPIO9), SDA j11 (GPIO8). Coordinates apply only
  to that photographed assembly; recheck placement before using them.
- Button is a KY-004-style three-pin module, not a bare four-leg switch.
  Component side facing you, pins down: S left, - right, middle unverified.
  Initial staged test uses S/- and internal pull-up; middle stays disconnected.
  See BUTTON_SETUP.md for exact procedure and required press/release evidence.
- Temperature breakout reads G/R/Y with S nearby; part identity and supply/data
  assignments are unverified. Never infer pins from those letters or package
  shape. A visible 472 resistor may be 4.7k, but its circuit role is unverified.
- Loose yellow-violet-red-gold resistor is color-identified as 4.7k, 5%, not
  meter-tested. Do not add a pull-up before verifying the module's circuit.
- Disconnect USB before changing jumpers. Verify breadboard continuity and board
  placement; keep each button pin on a separate row. Test accessories separately
  before combined firmware. Do not flash unverified pin assignments.

## Pi diagnostic and operating boundary

Keep training on the laptops until cooling, dependencies, thermal guards and
bounded Pi workload/restart are actually verified. Never manipulate cooling,
Pi power, voltage/clock, EEPROM, or unrelated storage to produce a drill. The
relay stays disconnected and no Pi GPIO connections are required.

`scripts/pi_health.py` is a standalone read-only diagnostic, not a training
permission or coordinator client. Run on the Pi from the repository:

```sh
python3 scripts/pi_health.py
```

Missing/invalid measurements, unknown power flags, wrong platform or >=60 C
produce ATTENTION. This is a conservative fanless setup threshold, not the
manufacturer throttle threshold. LIGHT_SETUP_ONLY does not authorize training.

hardware/pi/ contains optional, uninstalled systemd templates. No service or
timer is enabled by this documentation. Dynamic-user access to vcgencmd remains
unverified; keep ATTENTION on failure rather than granting broad privileges.
Manual read-only sampling is the fallback. The separate worker template is
not evidence of a configured or safe auto-starting Pi worker.

## Resume physical work

Breadboard assembly was deferred; this cleanup requests no physical action.
When it resumes, use the dedicated accessory guides and matching manufacturer
information. Unknown sensor identity means leave it disconnected. OLED bench
success does not establish live recovery status; combined firmware, sensor
failure handling and coordinator forwarding require separate observation.

Pi/cloud credentials must be per-device scoped and privately provisioned in an
ignored profile, never an Atlas URI, coordinator admin set or browser bundle.
Resolve role identity before enrollment; two devices must not share a primary
credential. Use docs/PHASES_3_8_OPERATOR_STEPS.md and PHASE_3_ATLAS_SETUP.md for
implemented CLI commands, and WINDOWS_STANDBY_SETUP.md for that laptop.

All workers use outbound HTTPS; direct campus peer connections are optional.
Without hardware/cloud, use the local two-process demo, labelled same-host.
Button emergencies are injected drills; DS18B20 is ambient, Pi temperature is
CPU. Actual cross-device resume, Photon delivery and Nemotron provider success
must each have their own evidence.
