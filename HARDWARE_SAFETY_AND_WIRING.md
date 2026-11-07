# LIFERAFT — Hardware identification, wiring, safety and firmware runbook

**Read this before plugging in any sensor or writing firmware.** All current hardware is borrowed or personally valuable. The top priority is to avoid electrical, thermal, storage or physical damage.

## A. Absolute prohibitions

1. **Never route Raspberry Pi 5, laptop, charger, power brick or official fan power through the relay.** Do not energize the relay in software by default. Leave its inputs and screw terminals disconnected for core LIFERAFT.
2. **Never intentionally overheat the Pi or laptops:** no covering vents, disconnecting the operating Pi fan, removing heatsinks, driving a CPU at maximum load for an extended period, direct heating with a heat gun/candle/hair dryer, or changing Pi thermal thresholds/fan curves. Demonstrate danger using a button-injected event, and separately show real read-only temperatures.
3. Do not connect an unverified fan to Pi GPIO, ESP32 GPIO or Arduino pins. Fans/motors are inductive loads; power/current and protection must be designed explicitly. An official Raspberry Pi 5 Active Cooler uses a dedicated four-pin fan connector—not a generic GPIO connection.
4. Do not connect 5V directly to ESP32-S3 GPIO or connect Arduino Uno's 5V logic outputs directly to ESP32. ESP32 board GPIOs are **3.3V domain**.
5. Do not connect/disconnect GPIO wiring while boards are powered. Remove USB power first, inspect then connect, then power up for a low-risk test.
6. Do not use the Pi USB-C power adapter as a general breadboard 5V supply. It is dedicated to Pi power. Do not reverse 3V3, GND and data leads.
7. Do not use bootloader flashes, EEPROM updates, voltage/overclock changes, filesystem formatting scripts, `dd` writes or unsafe low-level Pi utilities as part of the demo. A human may intentionally flash the known 64GB microSD using Raspberry Pi Imager, after visually checking the selected disk.
8. Do not kill Pi's operating system or cut its supply to show a crash. Only stop the project's normal worker Python process for a controlled crash test. Stop workloads using normal application commands before final shutdown.
9. No mains voltage. No Pi relay power cutting. No relay controlled fan cutting. No direct external heating. These operations have **no place** in our core feature scope.
10. Stop immediately if anything is hot to the touch, smells abnormal, is sparking, reports undervoltage repeatedly, or a fan is obstructed. Unplug the affected **unpowered accessory** only when safe; seek on-site hardware mentor assistance for damaged/electrical equipment.

Official reference links: Pi power https://www.raspberrypi.com/documentation/computers/getting-started.html ; Pi 5 cooling https://www.raspberrypi.com/documentation/computers/raspberry-pi.html ; ESP32 S3 board https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide.html .

## B. Physical inventory inspection — no power yet

Record a real photo/label (do not save private credentials) of each component:

1. **Pi 5**: confirm printed model is *Raspberry Pi 5*; inspect all ports, no bent pins, no damaged fan header.
2. **Fan**: is it the official Pi 5 Active Cooler, official case fan or generic two-wire fan? Look for the correct four-pin JST-SH plug, heatsink/pins, voltage/current label. **If not clearly official-compatible, do not install or power it.** Do not remove an installed Active Cooler; Raspberry Pi warns its mounting hardware and pads can degrade on removal.
3. **Pi power brick**: label must identify the official 27W USB-C supply recommended for Pi 5. Connect it *directly* to Pi power USB-C port only after microSD and verified cooling are ready.
4. **microSD**: verify 64GB card and reader from earlier inventory are present. If missing, treat as human supply blocker before Pi boot; laptops can still do software work.
5. **ESP32-S3-DevKitC-1**: photograph front/back; identify exact revision and module variant printed on radio module; inspect whether USB-to-UART port uses Micro-USB or USB-C. Not all boards share a connector. A **data-capable** matching cable is needed; the team's USB-C-to-USB-C cable may not fit the board.
6. **DS18B20**: identify whether a 3-pin bare TO-92 device, waterproof probe on wires, or module breakout with 3 pins. Inspect the printed labels/pinout. Never assume wire color/pin placement. Confirm if module includes a pull-up resistor. If bare, acquire **4.7kΩ resistor** before wiring.
7. **SSD1306 OLED**: inspect whether it has 4 pins labeled `GND VCC SCL SDA` (I2C) or 7+ pins (SPI). Read power rating; if it lacks proof it tolerates 3.3V, do not energize it. Most 4-pin I2C displays have addresses `0x3C`/`0x3D`; scan rather than hard-code blindly.
8. **Button**: identify momentary normally-open two/4 terminal wiring. Test continuity with a meter if available. Do not connect to 5V.
9. **Relay**: label make/model and coil/control logic; put aside, no wiring in core.
10. **Breadboard and wires**: check for bent/jammed pins, test no accidental connected rails.

## C. Minimum safe electronics plan

**Preferred board:** ESP32-S3-DevKitC-1 powered **only by its recommended USB data port from Laptop B**. Connect only these low-voltage accessories:

| Function | ESP32-S3 planned GPIO | External connection | Safety check |
|---|---|---|---|
| DS18B20 1-Wire data | GPIO4 | `DQ` → GPIO4; VDD → 3V3; GND → GND; pull-up ~4.7kΩ DQ → 3V3 for bare sensor | Verify sensor model/orientation, resistor availability |
| OLED I2C SDA | GPIO8 | OLED `SDA` → GPIO8 | Confirm it's **I2C** OLED, and module 3.3V compatible |
| OLED I2C SCL | GPIO9 | OLED `SCL` → GPIO9 | Verify same bus/common GND |
| OLED supply | n/a | VCC → ESP32 3V3; GND → GND | Do not use 5V unless exact OLED electronics justify it; ESP32 IO remains 3.3V |
| Emergency-test button | GPIO5 | GPIO5 → momentary switch → GND | Configure `INPUT_PULLUP`, active low, software debounce 50–100ms |
| Relay | **NONE** | **Leave completely disconnected** | Not part of demo |
| Fan | **NONE** | If official Pi 5 fan, connect only as manufacturer specifies to Pi fan header with power removed | Never switch it during failure tests |

**Pin assignments are proposals, not authority:** Before wiring, Codex must cross-check ESP32-S3-DevKitC-1 revision/module pinout and ensure chosen GPIO are not flash/PSRAM, USB D+/D-, boot-strapping/USB debugging conflicts. If revision forces different pins, Codex updates pin table AND firmware together, with a reason. Espressif documents reserved pins and board-specific variants. Do not build physically until pinout verified.

**DS18B20 bare sensor caution:** TO-92 flat face orientation diagrams depend on viewing side; check actual datasheet before identifying VDD/GND/DQ. Incorrect orientation can damage the part. With 3.3V supply + three-wire normal power, do not use parasite-power mode. The 1-Wire line needs approximately a 4.7kΩ pull-up resistor; a breakout may already include one. If no pull-up is available, code the button/OLED first and defer temperature sensing—never improvise by shorting pins.

**OLED caution:** Some SSD1306 modules are sold as 5V tolerant while others are 3.3V-only. The board label alone does not prove it is safe to drive at 5V. Supply from a documented 3.3V-compatible rail. Never trust common internet pinout examples over the actual board markings.

## D. Incremental bring-up: never wire everything at once

**Step 1 — ESP32 USB board-only.** Remove all jumpers. Connect board USB data port to Laptop B. Verify board power LED, serial port/USB device enumerates, upload a minimal program that prints `LIFERAFT_BOOT_OK` every 2s. Codex supplies toolchain and OS-specific port instructions. If flash fails: try verified port/cable/driver and BOOT/RESET manufacturer procedure; do not short random pins. Evidence: serial output and detected board identity.

**Step 2 — Button alone.** Unplug USB. Wire button between verified GPIO5 and GND. Flash `INPUT_PULLUP` handler with debounce and incremental sequence. Reconnect; pressing button produces one `source_type=injected` event. Verify release/repress. Never interpret button as real overheating.

**Step 3 — OLED alone.** Unplug, wire I2C+3.3V/GND per verified board. Reconnect, run I2C scanner and print found addresses. Show `LIFERAFT / TEST BOARD`. If no address, power off and check labeled pins before trying again. No guessing with higher voltages.

**Step 4 — DS18B20 alone.** Unplug, verify exact pinout and 4.7k pull-up (or breakout resistor), wire. Reconnect; read sane ambient temp every 1–2s. Reject impossible `-127°C`, suspicious default `85°C` at startup, CRC errors, disconnects and repeated unchanging value; display `SENSOR INVALID`, not a healthy value. Finger-warm sensor gently without heater *only* if comfortable and safe; not necessary to prove safety. **Ambient temperature is not CPU temperature.**

**Step 5 — Combined firmware.** Integrate OLED/button/sensor with watchdog, serial JSON and outbound status updates. Test disconnect/reconnect. Keep USB cables secure to avoid accidental unplugging. ESP32 Wi-Fi support is P2 optional; don't block launch on it.

**Step 6 — Pi 5 setup without microcontroller wiring.** Place Pi on insulated open desk, mounted compatible cooling with correct manufacturer's instructions. Insert prepared microSD. Connect display if using, then official supply. Do not attach jumper wires from Pi to ESP32. Enable SSH via Raspberry Pi Imager settings and connect via approved network. Measure CPU temp via read-only sysfs or `vcgencmd measure_temp` (if installed). Pi thermal readings are shown separately from DS18B20.

**Step 7 — First software rescue with physical button.** Run Pi training worker (or fallback laptop primary), standby on other laptop, controller cloud mode, ESP32 bridge on Laptop B. Button triggers a **fake cooling incident**, that initiates a **real graceful training handoff**. Confirm Pi is never shut down or fan disconnected. OLED shows `TEST EVENT` → `SAVING` → `RECOVERED` based on *acknowledged state*, not self-generated timers.

## E. Firmware schema and defensive implementation

Board emits one line per event, max 512 bytes, always syntactically valid JSON when possible:

```json
{"protocol_version":1,"device_id":"esp32-s3-01","seq":17,"uptime_ms":30122,"ambient_temp_c":24.63,"ambient_valid":true,"button_pressed":false,"event_type":"TELEMETRY","source_type":"measured"}
```

Button event:

```json
{"protocol_version":1,"device_id":"esp32-s3-01","seq":18,"uptime_ms":30802,"ambient_temp_c":24.63,"ambient_valid":true,"button_pressed":true,"event_type":"COOLING_FAILURE_TEST","source_type":"injected"}
```

The Laptop B bridge adds server UTC receipt time, authenticated device identity, correlation/incident ID and a fresh request idempotency key before cloud upload. No secrets need to be on the ESP32. Bridge must reject serial lines that are too long, invalid JSON, impossible temps, duplicate/reordered sequence numbers beyond expected wrap handling, and event floods. The cloud validates again. Board receives serial JSON commands ONLY of type `DISPLAY_STATUS`, `PING` or `SET_BRIGHTNESS` with strict formats; never generic execution or power-control instructions.

OLED status should always say `TEST` while a button-injected incident is in progress. If cloud is down: `CLOUD OFFLINE / SAFE MODE`; if sensor invalid: `SENSOR ERROR`; if recovery incomplete: `RECOVERY PENDING`, never `SUCCESS` until coordinator confirms a new training step on backup.

## F. Pi 5 safe operating limits

- Dedicated official 27W Pi 5 power brick directly into Pi USB-C power input.
- Keep board ventilated and on nonconductive surface; properly install only compatible cooler by official directions. If fan is generic/unverified, do not wire it; use a light workload and monitor CPU temperature. If overheating/throttling becomes likely, reduce workload or use laptop primary fallback. Do **not** circumvent firmware thermal protection.
- Check CPU temperature via read-only system interfaces. Print `temp_c` and telemetry timestamp. Avoid any code that uses overclocking, `vcgencmd` write controls, `rpi-eeprom-update`, boot config writes or fan-overlay manipulation.
- PyTorch workload must be CPU-only, small dataset, bounded step duration, optional explicit sleep, bounded memory. Limit concurrency to one primary job. Show warnings when temperature high or throttling/undervoltage detected; **software preemption** only.
- Stop training cleanly first (`liferaft worker stop` or SIGTERM handled by worker), then shut down the Pi using normal OS shutdown only when team is actually finished, then disconnect power after shutdown completes. Software must not turn off Pi during the demonstration.
- Do not attach Arduino Uno's 5V output or power rail to Pi GPIO. In this design Pi does not use any GPIO at all.

## G. Unavailable/missing small parts

| Missing/unidentified part | Safe path |
|---|---|
| 4.7kΩ resistor for bare DS18B20 | Get correctly rated resistor from mentors/store or use verified breakout with resistor; skip temp sensor for now |
| No data-capable USB cable that fits ESP32 | Borrow correct data cable; implement software serial simulator until available |
| Unknown fan type | Leave fan disconnected; CPU workload low-power/monitored or run primary on laptop |
| OLED pins/voltage uncertain | Do not wire display; use laptop dashboard; verify manufacturer marking |
| Arduino Uno board already available | ESP32 remains preferred; Uno fallback only with correctly adapted 5V circuitry; never connect Uno 5V logic directly to ESP32 |
| No spare safe power source for accessory fan | Do not use accessory fan; simulation works with button |
| No Ethernet on Pi | Pi 5 has Wi-Fi; use an allowed network/hotspot and outbound HTTPS |

## H. Safety validation checklist

- [ ] Component models/labels identified and photographed for team reference.
- [ ] Fan confirmed compatible or deliberately left disconnected.
- [ ] Pi power connected directly using official PSU.
- [ ] No relay in any Pi/fan/laptop power path.
- [ ] All ESP32 connected electronics at verified 3.3V logic.
- [ ] DS18B20 pinout and pull-up verified before wiring.
- [ ] OLED interface (I2C vs SPI), pin labels and voltage verified.
- [ ] Button to GND with pull-up, no 5V input.
- [ ] Only simulation changes software workload; no real forced heating.
- [ ] Every measurement has its physical source and freshness in the UI.
- [ ] Board disconnected and safely powered down before rewiring.
