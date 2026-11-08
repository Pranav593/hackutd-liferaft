# Live hardware demo

The Mac's loopback cockpit creates one fresh Pi job. The Pi, Windows standby
and Windows ESP32 bridge discover it using their existing scoped credentials
over outbound HTTPS. The coordinator waits for a verified checkpoint and a
fresh standby before the bridge arms. The physical button sends an injected
cooling incident. The existing worker and coordinator policies execute the
handoff. The dashboard shows only measured samples and verified journal
records. An active provider runner and a signed delivery receipt are separate.

## Verify a previous attempt

Start the Mac dashboard from the repo root with `npm ci` and `npm run dev`.
Visit [the live cockpit](http://127.0.0.1:3000/live), enter `pi-mvp-03` (or the
actual job ID) and click **Verify job**. This is a read-only query against the
existing Render coordinator. No redeployment or device agents are required.
The Mac's ignored `.env.operator` must contain the existing Render
`LIFERAFT_OPERATOR_TOKEN` as `LIFERAFT_CLOUD_TOKEN` and the Render URL as
`LIFERAFT_CLOUD_URL`.

A successful Pi handoff shows a checkpoint from `pi-primary`, the next
optimizer step on `laptop-standby` at epoch 2, and **Handoff verified**.
The flight recorder identifies a physical button event as an injected drill.
A verified resume can appear before the full job has completed.

## Prepare once before the demo

1. Deploy the revision containing live demo support to the existing Render
   service. Open **Environment** and set `LIFERAFT_ENABLE_LIVE_DEMO=1` and
   `LIFERAFT_ENABLE_DRILLS=1`. Keep the scoped Pi, standby, gateway and
   operator credentials in their existing profiles. If using the same
   consented Photon conversation for the live runs, set `PHOTON_JOB=live-demo-control`
   so the signed webhook and runner follow the active job. Keep the existing
   Photon project, space, operator and sender IDs and signing secret. If Photon
   is unavailable, recovery still proceeds and the panel reports its status.
2. Sync this revision to the Pi and Windows. Keep the Pi's temperature and
   power checks passing. Run the Pi cloud doctor twice if it reconnected to
   Wi-Fi, since the earlier temporary DNS override can disappear on reconnect.
   Connect the ESP32 over native USB to Windows and close serial monitors.
3. Stop older job-specific worker or bridge commands in their terminals. Run
   these agents once and leave the terminals open. They wait for assignments
   for two hours by default. Rerun them before the demo if needed.

   **Raspberry Pi**

   ```bash
   .venv/bin/python -m liferaft.demo_agent pi_primary
   ```

   **Windows PowerShell, first window**

   ```powershell
   .\.venv\Scripts\python.exe -m liferaft.demo_agent standby
   ```

   **Windows PowerShell, second window** (use the Espressif COM port)

   ```powershell
   .\.venv\Scripts\python.exe -m liferaft.demo_agent gateway --port COM8
   ```

4. **Mac**

   ```bash
   npm ci
   LIFERAFT_LIVE_OPERATOR=1 npm run dev
   ```

   Open [the live cockpit](http://127.0.0.1:3000/live). Its Start Training button
   requires all three agents to be ready. For real provider activity, keep
   `NVIDIA_API_KEY` in the Mac's ignored `.env`, and the Photon API key and
   scoped runner credential in its ignored `.env.photon`. Keep all key values
   private.

## During the demo

1. Click **Start Training**. The Pi and standby start, and the bridge waits for
   the first committed checkpoint and a ready standby.
2. Press the physical ESP32 button once when the cockpit says to press it. Watch
   the verified handoff, next optimizer step, and continued training in the
   Windows pane. Nemotron starts when it sees the incident in a verified
   journal. Photon sends its initial and recovery messages through the existing
   durable outbox. A Nemotron follow-up is queued only once resume is verified
   and the advisory cites the same incident.

## Diagnose a failure

- **Agent offline or unavailable** means the coordinator has no recent
  readiness check-in. Check that terminal for `DEMO_AGENT_STATUS` or
  `DEMO_AGENT_FAILED`. Verify the scoped profile, the Pi DNS timing, or the
  current Windows COM number as appropriate.
- **Waiting for a verified checkpoint** means the bridge has not armed. Check
  the readiness reasons and the Pi terminal for a checkpoint error. The
  bridge stops waiting after two minutes.
- **Button armed** requires the serial port to be open. If it times out without
  a valid frame, check the physical button and the gateway terminal.
- **Provider unavailable** leaves the training and handoff in progress. The Mac
  keeps redacted provider diagnostics under `.liferaft/live/<job>/providers.log`.
  The flight recorder shows real provider receipts only after they are journaled.
- Existing manual commands in [the Pi runbook](PHASES_3_8_OPERATOR_STEPS.md)
  remain a fallback. Use a fresh job ID for a fresh trial.
