# Hardware connection reference — breadboard assembly deferred

**Current update: standalone OLED bring-up PASSED.** The matching GME family
manufacturer documentation establishes SSD1306 / I2C / 3.3–5 V support;
use 3.3 V with this ESP32. Actual 0x3C responses were captured and the operator
confirmed the expected visible test text. Working reported mapping is GND j1,
VCC j21 (3V3), SCL j8 (GPIO9), SDA j11 (GPIO8). Button is disconnected while
oled_test firmware runs. See `hardware/esp32/OLED_SETUP.md`. Historical deferral
and unknown-rating notes below describe earlier observations. Combined button
and live coordinator display integration remain unverified.

Updated from operator photos on 2026-11-07 America/Chicago. The operator has
explicitly deferred OLED/temperature testing and will connect parts later on a
large breadboard. Treat external-button wiring as part of that later assembly.
No accessory is verified merely because its labels are recorded here.

## Visible labels and orientation

| Part | Orientation in supplied photo | Visible header order | What is established |
| --- | --- | --- | --- |
| Temperature breakout | Component side facing you, three metal pins pointing down | Left to right: `G`, `R`, `Y`; `S` printed nearby | Labels only; supply/data assignments and sensor part number remain unverified |
| OLED | Screen facing you, four-pin header at top | Left to right: `GND`, `VCC`, `SCL`, `SDA` | Printed ground/supply/I2C labels; controller and supply rating unverified |
| OLED rear | Component side, header at top | Read the front labels for header assignments; back view reverses physical left/right | Board marking `GME12864-11-12-13`, `V3.22`; address-selection markings `0x3C`/`0x3D` |
| ESP32 | Component side facing you, USB-C sockets at top | Native `USB` at left; `COM` at right, labels on underside | Use native `USB`: it powered/enumerated and passed the USB-only application test |

The temperature board appears to have `472` on a resistor (4.7k). Neither that
resistor's circuit role nor the header's pin functions have been verified.
The operator reports no identifying text on its back. Do not infer GND/VCC/data
from the letters G/R/Y or the sensor's three-legged shape. At the future assembly
session, establish part identity and connections from a matching schematic or
unpowered continuity checks before supplying power.

The selected loose resistor's colors, read from yellow, are
yellow-violet-red-gold (4.7k, 5%). Its value is color-identified, not meter-tested.
Do not add it until deciding whether the module already supplies the pull-up.

## Base hardware completed and remaining limits

- Pi: actual boot, model/ARM64 OS, Connect administration, Python virtual
  environment, public HTTPS and a 41.7 C/no-throttling idle sample verified.
  No cooler installed. Keep training off; worker/cloud integration and on-device
  execution of the new health service are pending.
- ESP32: actual chip/flash identity, original-flash backup, firmware upload with
  hash verification, and three increasing `LIFERAFT_BOOT_OK` serial messages
  verified. The installed application is USB-only and drives no accessory pins.
- Laptop: isolated hardware tools and compiler installed. Bounded serial proof
  capture works. COM8 was the observed native USB port; re-enumerate after a
  reconnect because Windows can change the number.
- Breadboard: button, OLED and temperature wiring, combined firmware and physical
  tests are intentionally pending. No external-button pinout has been established.
- Relay: excluded and disconnected. No Pi GPIO connections are required.

There is no further safe accessory wiring or bench validation to perform while
the breadboard assembly is deferred. Preserve the working USB-only test until
assembly resumes. Do not load combined firmware that drives unverified pins.

## Resume later

### Button identified from the subsequent videos

The operator supplied two local videos (27.17 s and 76.41 s). Extracted frames
were inspected locally under ignored `.liferaft/video-review/`; no video was
uploaded elsewhere. The second video clearly shows a three-pin pushbutton
breakout, with `S` at left and `-` at right when component side faces the viewer
and the pins point down; the middle pin is unlabeled in the visible frame.
It is KY-004-style, not a bare four-leg button. The matching Joy-IT manual
describes active-low switch-to-ground operation. For the initial test, use the
S/- pair with the firmware's internal pull-up and leave the middle pin open.
Physical switch behavior and final wire placement are not yet tested.

The breadboard video shows numbered rows and columns a-e/f-j on either side of
the center gap. Exact ESP32 header row placement must be checked from the actual
assembled still before assigning jumper coordinates. Keep all three button pins
on distinct numbered rows. Sensor/OLED work remains deferred.

Bring the large breadboard, jumpers, separate button and the identified parts.
Unplug ESP32 USB before inserting/removing any wire. First establish the actual
breadboard rail continuity and board placement, then verify the separate button
terminals. Wire and test one accessory at a time. We will provide an exact
row-by-row plan against the real layout, not guess breadboard rows now.

Success at that later stage requires actual button events, OLED output, valid
ambient-temperature samples and disconnected-sensor rejection. Cloud forwarding,
authoritative OLED recovery status and physical-button rescue require subsequent
software integration; those results are not claimed by the standalone USB test.
