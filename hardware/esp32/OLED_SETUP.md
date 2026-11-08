# OLED first bring-up

**Bench result: PASS.** The OLED acknowledged 0x3C and emitted three real
OLED_TEST_READY reports. The operator then confirmed all five expected text
lines were visible. Actual reported wiring uses GND at j1 (also a GND pin),
VCC at j21, SCL at j8 and SDA at j11. Earlier swapped SCL/SDA wiring caused
non-detection; correcting it resolved the failure. Button is disconnected and
the installed firmware is this standalone display test, without live cloud
status or button processing. USB proof is retained in ignored
`.liferaft/oled-proof/corrected-wiring-093113.json`.

The saved photos/video show a four-pin I2C module marked GME12864-11-12-13,
V3.22, with GND/VCC/SCL/SDA labels and 0x3C/0x3D address-select markings.
The matching [GoldenMorning manufacturer family page](https://goldenmorninglcd.com/oled-display-module/0.96-inch-128x64-ssd1306-gme12864-11/)
specifies SSD1306, 128x64, I2C and 3.3–5 V operation. This establishes a matching
documented family; the physical unit passed the bench test recorded above.
Use 3.3 V supply and logic with this ESP32, not 5 V.

## Unpowered wiring

Unplug ESP32 USB before changing any wire. The existing button can stay wired.
Leave the temperature sensor and relay disconnected. This wiring assumes the
operator's existing ESP32 placement: left header a1-a22, right header i1-i22,
USB sockets toward row 1, exposed j-column connected to the right header.

Place OLED header pins in four DIFFERENT numbered rows, for example:

| OLED printed pin | Header hole | Jumper from | Jumper to | ESP32 label to verify |
| --- | --- | --- | --- | --- |
| GND | a40 | b40 | j3 | GND beside i3 |
| VCC | a41 | b41 | j21 | 3V3 beside i21 |
| SCL | a42 | b42 | j8 | 9 beside i8 |
| SDA | a43 | b43 | j11 | 8 beside i11 |

Orient the module to match its actual printed labels; do not infer order from
the back view or force/bend the connector. If the module is rotated, the printed
pin names govern. If any ESP32 label differs from the table, stop before power
and correct the row mapping. Four pins across a single a-e row would short them.
No external resistor or breadboard power rail is required for this test.

## Firmware

The separate `oled_test` environment leaves the original `button_only` source
available. The existing button may stay connected, but this OLED-only test does
not emit button rescue frames. It uses Wire on SDA GPIO8 / SCL GPIO9 at 100 kHz,
a 50 ms bus timeout, and probes only 0x3C and 0x3D. No response or two responding
addresses prevents initialization; it does not guess, change voltage, or loop
through unsafe settings.

Pinned official libraries: Adafruit SSD1306 2.5.17, GFX 1.13.0, BusIO 1.17.4.
Their current headers were verified for the explicit Wire constructor and
`begin(..., reset=false, periphBegin=false)` so initialization preserves GPIO8/9.

```powershell
$env:PLATFORMIO_CORE_DIR=Join-Path (Get-Location) '.liferaft/pio'
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32 --environment oled_test
# Re-enumerate the native USB port before upload; replace COM8 if needed.
.\.venv\Scripts\python.exe -m serial.tools.list_ports -v
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32 --environment oled_test --target upload --upload-port COM8
```

Expected first display, per the hardware runbook's initial test requirement:

```text
LIFERAFT
Training
ID: #---
Cloud: Online
```

Title and training fields use size-2 text, split across three 16-pixel rows.
The live `edge` layout uses the remaining two rows for cloud and safety status.
The bridge sends a strict `DISPLAY_TRAINING` command containing the job's
one-to-three-digit suffix, zero padded (job `campus-button-05` shows `#005`).
Jobs without that suffix show `#---`; the number is a short display label,
not a replacement for the full job ID. Stale status hides the old number.
`Cloud: Linked` requires fresh coordinator-backed status; after seven seconds
without status, the screen shows `Cloud: Offline`. The standalone bench test
has no network connection or training ID. Its operator-requested `Cloud: Online`
text is a static presentation label; serial reports retain `cloud_connected=false`.
Text APIs checked against the [official GFX guide](https://learn.adafruit.com/adafruit-gfx-graphics-library/graphics-primitives).

The USB reporter emits OLED_TEST_READY only while the address acknowledges.
That means device response and test initialization, not proof a person saw correct
pixels. The operator must confirm actual visible text. Missing/ambiguous I2C,
initialization failure or later disconnect produce explicit serial error states.
If blank or undetected, unplug USB and inspect wiring; never increase to 5 V as
a troubleshooting guess. Do not remove GPIO wires while powered.

## Required final status behavior (later combined integration)

These are requirements, not implemented live behavior in `oled_test`:

| Evidence/state | Required display |
| --- | --- |
| First bench test | LIFERAFT / TEST BOARD, clearly local |
| Physical test-button event | TEST EMERGENCY; source remains injected |
| Coordinator-confirmed rescue/checkpoint activity | TEST / RESCUING or SAVING |
| Coordinator confirms real first resumed optimizer step | TEST / RESUMED or RECOVERED |
| Cloud link absent/stale | CLOUD OFFLINE / SAFE MODE |
| Attached sensor invalid | SENSOR ERROR |
| Recovery not yet verified | RECOVERY PENDING |

Never display success on a timer, on a button press alone, or just because the
bridge acknowledged a request. The current one-shot gateway bridge cannot read
job status and exits after sending the press, so it does not yet provide live
coordinator state to the OLED. A defined, validated DISPLAY_STATUS serial command
and authorized status transport are needed for combined integration. No gateway
permissions, cloud API or leases are changed by this bench-test firmware.
