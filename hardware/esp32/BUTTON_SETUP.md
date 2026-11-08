# External-button-only setup

The main branch at `82c31f7` added the gateway bridge, but did not include
button firmware. `src/button_only.cpp` supplies that missing hardware-side piece.
The original `board_only` firmware remains available and is the default build.

## Physical action first

The operator's second video now shows a three-pin KY-004-style pushbutton module,
not a bare four-leg switch. Component side facing you with pins pointing down:
left pin is marked `S`, right is marked `-`, and the middle pin is not clearly
labeled. The visible tact switch and layout match the KY-004 family, but exact
vendor is unknown. [Joy-IT's KY-004 manual](https://joy-it.net/files/files/Produkte/COM-KY004TM/COM-KY004TM_Manual_2024-05-06.pdf)
describes a switch that connects signal to ground when pressed.

Use only S and - for the initial internal-pull-up test; leave the middle pin
unconnected. No external supply or resistor is needed for that two-wire test.
An actual electrical press/release test is still required before accepting this
part's behavior. No raw video or extracted frames are committed.

First unplug ESP32 USB. Place it across the breadboard's center gap with its
USB sockets toward row 1. The video shows columns a-e and f-j and numbered rows.
Try the two header rows in columns b and i, leaving columns a and j accessible;
do not force the board if the header spacing does not fit. Put the button header
in three DIFFERENT numbered rows away from the ESP32. Three holes in one a-e
row would short its pins. Send a still of the unpowered arrangement before
connecting jumpers, so exact GPIO5/GND rows can be verified against visible labels.

The planned circuit is only GPIO5 to a normally-open button to GND, using the
internal pull-up. GPIO5 is the header labeled `5`, not physical header pin 5.
Unplug USB before any wiring changes. Never connect the button to 5V, 3V3, a
relay or Pi GPIO. Exact button/breadboard positions follow physical inspection.
OLED and temperature sensor remain disconnected.

## Firmware preparation and local verification

```powershell
$env:PLATFORMIO_CORE_DIR=Join-Path (Get-Location) '.liferaft/pio'
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32 --environment button_only
# Re-enumerate and replace COM8 with the actual native Espressif port before upload.
.\.liferaft\hardware-tools\Scripts\python.exe -m serial.tools.list_ports -v
.\.liferaft\hardware-tools\Scripts\python.exe -m platformio run --project-dir hardware/esp32 --environment button_only --target upload --upload-port COM8
```

Its first build passed in 39.738 s, reporting flash 315,206 bytes and RAM 22,344 bytes.
The synthetic format check extracted the firmware's actual printf format and
passed `ButtonEvent` and `wait_for_button` with a 201-byte fixture. This is not
hardware evidence. If normal upload cannot enter ROM mode, use the documented
BOOT/RST procedure; after manually entering download mode, normal application
start may require a brief RST with BOOT released, as in the board-only test.

**Physical verification now passed:** reconnected native USB enumerated on COM8.
The button-only upload passed in 8.976 s; all written components passed hash
verification. The running firmware emitted three readiness banners. The local
checker then received a real frame with seq 1, uptime 54483 ms, event type
COOLING_FAILURE_TEST, source injected, ambient null/invalid. The actual bridge
parser accepted it; the checker exited 0 and released the port. No cloud rescue
was sent. Proof is retained under ignored
`.liferaft/button-proof/first-physical-press.json`. Application binary is 320,496
bytes, SHA-256 `ba9418ba07ce97ce3d22f6df6216da640dc5983d6477bd4dfab1b88eea4382d4`.
Wiring placement was reported by the operator; no assembled-wiring still was
provided. A valid press proves the signal path; sustained hold/repress and full
recovery tests are separate remaining checks.

Firmware uses a 75 ms stable debounce, requires release before the first event,
does not repeat while held, and rate-limits accepted presses to 500 ms apart.
The `LIFERAFT_BUTTON_READY` banner is not a valid recovery frame.

When the engineer starts the local check below and it reports `BUTTON_CHECK_ARMED`,
press once within 45 s. The script uses the actual software bridge parser, validates
the real frame, makes no cloud request, and releases the serial port on exit.
Do not have another monitor open on the same port.

```powershell
.\.venv\Scripts\python.exe -m scripts.esp32_button_check --port COM8
```

Expected physical-press data (example counters only):

```json
{"protocol_version":1,"device_id":"esp32-s3-01","seq":1,"uptime_ms":1000,"ambient_temp_c":null,"ambient_valid":false,"button_pressed":true,"event_type":"COOLING_FAILURE_TEST","source_type":"injected"}
```

## Gateway profile — prepared privately

pySerial 3.5 is installed in the project `.venv`. The assistant created an ignored
`.env.gateway` with the correct HTTPS origin, a newline, and a fresh 64-character
hex token without displaying it. Creation refuses to overwrite an existing
profile. Do not use the malformed Markdown/escaped URL from pasted instructions.
`git check-ignore .env.gateway` passed and `pip check` passed.

Actual `cloud --profile gateway doctor` returned HTTP 401. The local token has
not been verified against the deployed service. The endpoint was reached, but
this does not establish that the new gateway code or matching token is deployed.

**Subsequent verification:** at `2026-11-08T04:50:33.614973+00:00`, the existing
profile's doctor exited 0 with `auth: true`, `database: true`, `role: gateway`.
The credential blocker is resolved. The account-holder instructions below are
retained for setup/recovery and do not need repeating or token regeneration now.
Physical button-frame and recovery verification are still pending.

Required account-holder step, which keeps the credential private:

1. In the laptop editor, open the repository's `.env.gateway`. Copy only the
   value after `LIFERAFT_CLOUD_TOKEN=`. Do not copy it into chat or screenshots.
2. In Render, open the existing `liferaft-coordinator` service, then
   **Environment → Environment Variables → Edit**. Add or set
   `LIFERAFT_GATEWAY_TOKEN` to that exact value. Keep `LIFERAFT_ENABLE_DRILLS=1`.
3. Save/redeploy the service with the merged gateway implementation from main
   (`82c31f7` or a later revision). Changing the local file alone cannot authorize
   the role. If Render controls are unavailable, the service account holder must
   make this scoped credential change; do not substitute an operator token.
4. Tell the engineer only that the gateway secret is configured and service is
   Live. The engineer will run the doctor again. Success must show `auth: true`,
   `database: true`, `role: gateway`. If still 401, compare the private values and
   deployed revision; retain the local-only button test as fallback.

The actual rescue requires a fresh agreed job ID, Laptop A primary training,
Laptop B standby and a ready verified checkpoint. Only then arm the one-shot
gateway bridge and press the physical button. Do not launch the bridge against
an old job or call a synthetic button request to manufacture physical evidence.

If the button is recorded but standby exits with download HTTP 403, investigate
the worker/HTTP path rather than changing the button wiring. The client now
refreshes its own standby presence before download and claim to avoid readiness
expiring between requests. The same coordinator safety checks remain in place.
Keep the two Windows processes running concurrently; the serial bridge exits
after its single request, while the standby must run through completion.
