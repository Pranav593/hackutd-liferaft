# LIFERAFT Phases 3–8 bring-up

Run these from the repository root. Use a new job ID for every drill. The
coordinator supports one primary-to-standby transfer per job. Keep all
`.env.*` files private. In PowerShell, replace `.venv/bin/python` with
`.\.venv\Scripts\python.exe`.

## 1. Deploy and verify the coordinator

Merge the software branch into the GitHub branch that your Render service tracks.
In Render, open the existing LIFERAFT service, choose **Manual Deploy**, then
**Deploy latest commit**. Verify the deployed commit matches the source you
intend to test. Preserve the existing Atlas URI, laptop role tokens and gateway
token. Use `LIFERAFT_ENABLE_DRILLS=1` for controlled button drills.

```bash
.venv/bin/python -m liferaft cloud --profile operator doctor
.venv/bin/python -m liferaft cloud --profile operator create --job laptop-edge-01
```

The first command should report `database: true`, `checkpoint_transfer: signed-v1`,
`event_export: paged-v1` and `edge_protocol: v1`. Start standby and primary on
their separate laptops using the worker commands in
[the Atlas setup guide](PHASE_3_ATLAS_SETUP.md). On the operator Mac, check the
job before pressing the button:

```bash
.venv/bin/python -m liferaft cloud --profile operator doctor --job laptop-edge-01
```

Wait for `ready_for_drill: true`. After the drill, export and verify the journal.
A current export should include a checked head sequence and hash.

```bash
.venv/bin/python -m liferaft cloud --profile operator events --job laptop-edge-01 > .liferaft/laptop-edge-01.jsonl
.venv/bin/python -m liferaft evidence --job laptop-edge-01
```

The isolated Atlas rollback test is opt-in. Use the disposable repository and
commands in [software verification](SOFTWARE_VERIFICATION.md) for storage rollback
and concurrency. A successful drill provides separate cross-device evidence.

## 2. Bring up the Pi worker or use telemetry-only mode

Check [hardware safety](../HARDWARE_SAFETY_AND_WIRING.md) first. Use 64-bit
Raspberry Pi OS, a normal non-root account, verified compatible cooling and the
official power supply. Keep the Pi ventilated. Generate a distinct 64-character
hex credential in a private terminal or password manager. In Render, open
**Environment → Environment Variables** and set `LIFERAFT_PI_PRIMARY_TOKEN`
to that credential. On the Pi, store the same value in the ignored
`.env.pi_primary` as `LIFERAFT_CLOUD_TOKEN`, along with the coordinator origin
as `LIFERAFT_CLOUD_URL`. Keep the Pi token separate from the laptop and gateway
tokens.

With Python 3.11–3.13 in the Pi virtual environment, install the pinned
project training extra and run the read-only preflight.

```bash
.venv/bin/python -m pip install -e '.[training]'
.venv/bin/python -m liferaft doctor --pi --training --json
.venv/bin/python scripts/pi_health.py
.venv/bin/python -m liferaft cloud --profile pi_primary doctor
```

Expect the PyTorch CPU smoke test to pass, no Pi health reasons, and
`worker_id: pi-primary` from the coordinator. The worker refuses to train
when Pi identity, CPU temperature, or throttling state cannot be verified,
or at 60 °C or above. If the checks pass, create a new job on the operator Mac,
start the existing standby worker against it, then start the Pi worker.

```bash
# Operator Mac
.venv/bin/python -m liferaft cloud --profile operator create --job pi-edge-01 --primary pi-primary

# Pi
.venv/bin/python -m liferaft cloud --profile pi_primary worker --job pi-edge-01 --role primary
```

Run the operator job doctor and the same controlled drill. Verify the chosen
checkpoint producer is `pi-primary`, and the other computer completed the next
optimizer step. The user service template in
[`hardware/pi/liferaft-pi-worker.service`](../hardware/pi/liferaft-pi-worker.service)
assumes the checkout is at `~/liferaft`. For a repeatable launch, copy it into
`~/.config/systemd/user/`, set `LIFERAFT_JOB` in
`~/.config/liferaft/pi-worker.env`, then use `systemctl --user daemon-reload`
and `systemctl --user start liferaft-pi-worker.service`. Keep the test
one-shot so the service does not restart a completed job.

If Pi PyTorch or the thermal preflight fails, use a laptop-primary job and
optionally run this read-only workload telemetry publisher on the Pi:

```bash
.venv/bin/python -m liferaft cloud --profile pi_primary pi-telemetry --job laptop-edge-01 --seconds 240
```

A Pi sample in that mode is auxiliary evidence. It cannot change the laptop's
checkpoint interval or request rescue.

## 3. Build and verify the ESP32 monitor

After identifying the exact board and both accessories, follow the bench order
in [hardware safety](../HARDWARE_SAFETY_AND_WIRING.md). The button-only and
OLED-only firmware targets are still available. Start with the build command,
which requires the pinned PlatformIO tools and downloads the declared ESP32
packages when needed. On macOS or Linux:

```bash
python3 -m venv .liferaft/esp32-tools
.liferaft/esp32-tools/bin/python -m pip install -r hardware/requirements-tools.lock
.liferaft/esp32-tools/bin/python -m platformio run -d hardware/esp32 -e edge
```

After the separate button, OLED and DS18B20 checks pass, upload only to the
confirmed Espressif native USB serial port using the same command with
`-t upload --upload-port YOUR_VERIFIED_PORT`. On Windows, use
[`BUTTON_SETUP.md`](../hardware/esp32/BUTTON_SETUP.md) to identify the native
USB port and set up the toolchain. Close serial monitors before starting the
bridge. If the bridge environment lacks its USB library, install
`pyserial==3.5` there. The existing one-shot bridge remains a fallback.

```bash
.venv/bin/python -m liferaft cloud --profile gateway bridge --job pi-edge-01 --port YOUR_VERIFIED_PORT --monitor
```

The monitor accepts at most one drill within the first 120 seconds. The
OLED should advance through coordinator-reported states. `TEST / RECOVERED`
requires the matching incident to have a verified optimizer step. An invalid
sensor should read `SENSOR INVALID`. A stopped or disconnected bridge should
leave the display in `CLOUD OFFLINE` after the freshness timeout. Restart
the bridge explicitly after USB disconnect to re-arm the drill. Keep the relay
disconnected.

## 4. Review adaptive checkpoint evidence

Run the operator job doctor during training to see the interval, risk reasons,
estimated unprotected steps and Lifeboat Score when both fresh telemetry
streams are present. The policy can shorten a healthy Pi primary from the
configured cadence to five steps while a standby is ready and the measured
checkpoint cost fits the budget. It restores the default when eligibility is
lost. Do not heat the Pi for a demo. The local comparison test uses injected
policy inputs and real optimizer steps.

```bash
.venv/bin/python -m unittest discover -s tests -p test_edge_policy.py -v
```

## 5. Save the Nemotron evidence

The default investigation uses the two already demonstrated tool calls.
`--extended` includes the six added read-only evidence tools. It is a
separate provider smoke test and needs the configured NVIDIA key and model.

```bash
.venv/bin/python -m liferaft investigate --job pi-edge-01 --extended --output .liferaft/pi-edge-01-investigation.json
```

Point `LIFERAFT_COCKPIT_INVESTIGATION` at that saved file when running the
cockpit. Keep the corresponding journal. If the extended call reaches the
provider deadline, run the same investigation without `--extended` and save
it to a new output filename.

## 6. Provision and check Photon 2.0 iMessage

Use one consenting operator and a fresh demo job. In the Photon Beta project,
follow the [iMessage quickstart](https://photon.codes/docs/beta/get-started/imessage).
On a shared line, the operator sends the first message from the assigned
identity. Use the project's **Messages** view or the project's List Messages
API playground to find that inbound message. Its `sentBy.id` is the operator
user ID, and its `space.id` is the direct-space ID. The other ID in
`space.participantIds` is the agent ID. Use provider IDs in the app config and
keep the phone number out of the repo and evidence.

In the project's webhook destination configuration, use
`https://YOUR_RENDER_HOST/v1/photon/webhook` and subscribe to
`message.received`, `message.delivered` and `message.failed` for API version
`2026-07-01`. Copy the signing secret privately. Configure these server-side
values in Render:

| Variable | Value |
|---|---|
| `LIFERAFT_ENABLE_PHOTON` | `1` when the configuration is complete |
| `PHOTON_JOB` | The one fresh demo job ID |
| `PHOTON_PROJECT_ID` | Project ID |
| `PHOTON_SPACE_ID` | Direct space from the inbound message |
| `PHOTON_OPERATOR_USER_ID` | Consenting operator's Photon user ID |
| `PHOTON_AGENT_USER_ID` | Agent's Photon user ID |
| `PHOTON_WEBHOOK_SECRET` | Destination signing secret |
| `LIFERAFT_PHOTON_TOKEN` | A new, distinct 64-character hex runner token |

On the operator computer, create an ignored `.env.photon` with
`LIFERAFT_CLOUD_URL`, `LIFERAFT_CLOUD_TOKEN` set to the Photon runner token,
and `PHOTON_API_KEY` set to the project-scoped Photon key. The runner uses
outbound HTTPS. The hosted coordinator receives the webhook and does not need
the project API key. Run `curl --version` on the operator computer before
starting the runner. It uses curl to submit messages to Photon.

```bash
.venv/bin/python -m liferaft cloud --profile photon doctor
.venv/bin/python -m liferaft cloud --profile photon photon --job YOUR_JOB_ID --seconds 240
```

Run one controlled drill, then reply `STATUS`, `CHECKPOINT`, and `ACK` from
the allowlisted conversation. In the journal, verify the recorded command,
the incident-bound ACK, and a delivered callback if the channel reports one.
A provider acceptance means the request was queued by Photon. Delivery requires
a separate signed event. `WHY` reports the recorded trigger and explicitly
indicates when Nemotron context is unavailable in the channel. After exporting
a verified recovery and saving its Nemotron investigation, run the same Photon
command with `--investigation .liferaft/YOUR_JOB_ID-investigation.json` to
queue the advisory and make it available to `WHY`. If messaging is unavailable, continue the drill and verify recovery through the operator
journal.

Reference: [Photon 2.0 API](https://photon.codes/docs/beta/api-reference),
[OpenAPI wire schema](https://api.photon.codes/openapi.json), and
[Standard Webhooks signing](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).
