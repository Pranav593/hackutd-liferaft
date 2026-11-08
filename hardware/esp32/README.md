# ESP32-S3 board-only bench test

For the external-button build and scoped gateway setup, see
[BUTTON_SETUP.md](BUTTON_SETUP.md). The default environment still builds this
board-only test; use `--environment button_only` explicitly for button firmware.
For OLED wiring and the separate local display test, see [OLED_SETUP.md](OLED_SETUP.md).

This environment is a first physical USB test, not the integrated sensor firmware.
It drives no accessory GPIO, starts no Wi-Fi and controls no power hardware.
`LIFERAFT_BOOT_OK` means the board-only application is running; it does not mean
the cloud, sensor, button, OLED or recovery flow works.

## Identified hardware

Operator photos show an ESP32-S3-N16R8-marked, DevKitC-style board with USB-C
ports labeled COM and USB. The vendor and exact PCB revision are unconfirmed.
The native USB port works on this laptop; the COM port did not enumerate using
the available C-to-C connection. No claim is made that the COM port is defective.

After holding BOOT while briefly pressing RST, Windows enumerated the ROM
USB-Serial/JTAG interface on COM8. Read-only esptool `flash-id` identified an
ESP32-S3 revision 0.2, quad flash of 16 MB, flash voltage 3.3 V, 40 MHz crystal,
and 8 MB embedded PSRAM. This test does not initialize or rely on PSRAM.

A 16,777,216-byte original flash backup is stored locally under ignored
`.liferaft/esp32-original-20261107/`, with its SHA-256 in `backup.json`.
Do not publish raw flash backups: they may contain unknown prior settings.
Backup existence does not prove that a full restoration has been tested.

## Reproduce on the hardware laptop

Install `hardware/requirements-tools.lock` into the isolated hardware-tool venv.
Use `.liferaft/pio` as `PLATFORMIO_CORE_DIR` to isolate build downloads from
other developers' toolchains. All commands below run on Windows in the repo root.

```powershell
$env:PLATFORMIO_CORE_DIR=Join-Path (Get-Location) '.liferaft/pio'
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32
```

`platformio.ini` pins the official PlatformIO Espressif platform to 8.0.0,
selects the ESP32-S3 dev board, enables native USB Serial/JTAG CDC, and overrides
flash size to the observed 16 MB. It uses a small standard partition layout.
Do not change the CPU/flash settings to experiment with performance. Build
outputs and downloaded packages stay under ignored `.liferaft/`.

Before any upload, re-enumerate USB ports and match the identified ESP32.
Never upload to Bluetooth COM3–COM6. COM numbers may change after reset.
Keep all external wiring disconnected for this test. The existing application
will be replaced by the board-only firmware; no entire-chip erase is needed.

```powershell
.\.liferaft\hardware-tools\Scripts\python.exe -m serial.tools.list_ports -v
# Replace COM8 only if a fresh enumeration identifies the ESP32 elsewhere.
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32 --target upload --upload-port COM8
```

After upload, inspect the native USB serial output at 115200 baud. Expected:

```text
LIFERAFT_BOOT_OK seq=1 uptime_ms=2000 mode=board_only source_type=measured accessories=not_tested cloud=not_connected
```

The uptime shown here is illustrative. Acceptance requires actual repeated lines
from the device with increasing sequence and uptime values. The tracker records
whether this has actually passed. Firmware activity may change the LED pattern;
LED colors are not acceptance evidence.

### Actual result: PASS on 2026-11-07 America/Chicago

First build passed using PlatformIO platform 8.0.0, Arduino core 3.3.12
(`framework-arduinoespressif32@4.30312.261024`), the S3 libraries 3.3.12 and
Xtensa compiler 14.2.0+20260121. The first build including downloads took 554.96 s.
Build reported 314,434 bytes of program flash and 22,336 bytes of RAM. The
application binary is 319,632 bytes. `esptool image-info` confirmed its generated
bootloader targets ESP32-S3 with a 16 MB flash header and valid checksum/hash.
The PlatformIO board's displayed N8/8MB title is the base board manifest label;
the image header and physical flash size were independently checked as 16 MB.

After the interrupted first upload attempt, the engineer checked for running
uploaders and USB enumeration before acting. A bounded serial check produced no
test messages. A fresh upload then passed in 8.13 s. The uploader verified hashes
for the bootloader, partitions, boot_app0 and application. No entire-chip erase,
eFuse programming, external GPIO or power control was used.

Because download mode was entered with BOOT/RST, the uploader's default core
reset left this native USB device in download mode. The bounded serial test
correctly failed with zero samples. The documented ESP32-S3 full-reset option
resolved it without re-flashing:

```powershell
.\.liferaft\hardware-tools\Scripts\python.exe -m esptool --port COM8 --before no-reset --after watchdog-reset --no-stub --connect-attempts 2 flash-id
.\.liferaft\hardware-tools\Scripts\python.exe scripts/esp32_capture.py --port COM8
```

The subsequent real capture passed with sequences 4, 5, 6 and uptimes 8008,
10008, 12008 ms at `2026-11-08T03:05:26.645250+00:00`. Evidence is retained in
ignored `.liferaft/esp32-original-20261107/board-only-proof.json`, including the
application SHA-256. The capture rejects non-Espressif serial ports before opening
them; the Bluetooth COM3 negative check was rejected. Capture has a 15-second
deadline, accepts only the expected banner and requires increasing counters.

Full-reset behavior source: [Espressif esptool troubleshooting](https://github.com/espressif/esptool/blob/master/docs/en/troubleshooting.rst),
"Leaving Download Mode in USB-Serial/JTAG Mode". A brief RST press with BOOT
released is the physical fallback. Do not hold BOOT for normal application boot.

## Next bench stages

Identify the separate button and the temperature module's readable part number
and rear traces before assigning their pins. Confirm OLED supply/controller from
its documentation. Add and test button, OLED, temperature module, then combined
firmware in order, unplugging USB before every wiring change. Keep the relay
entirely disconnected. None of these accessories connects to Pi GPIO.
