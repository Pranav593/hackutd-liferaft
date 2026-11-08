# Phase 3 setup for two laptops

Liferaft runs the coordinator on Render and stores job state and private checkpoint bytes in MongoDB Atlas. Each laptop connects to Render over HTTPS. Only the Render service connects to Atlas. You need two laptops for the final proof and no Pi, ESP32, inbound port, or router change.

## 1. Create the Atlas project now

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/) and create a project named `Liferaft` in a team-controlled organization. If you already have a dedicated Liferaft project, reuse it.
2. Choose **Database → Create** or **Build a Cluster**. Select **Free**, name it `liferaft-demo`, and choose a nearby US region. Skip sample data. Confirm the Free tier before creating.
3. Under **Security → Database & Network Access → Database Users**, add a password user named `liferaft-coordinator`, or edit that user if it exists. For a new user, use a strong random alphanumeric password and save it in your password manager. Under **Specific Privileges**, select `readWrite`, enter `liferaft` in **Database**, and leave **Collection** blank so the service can access `job_state_v1` and `checkpoint_objects_v1`. Restrict the user to the `liferaft-demo` cluster if Atlas offers the toggle. After saving, the roles list should show `readWrite @ liferaft`. Use this scoped user in Render.
4. From the cluster, open **Connect → Drivers → Python**. Copy the `mongodb+srv://…` URI and replace the username and password placeholders with this database user's credentials. Keep it private in your password manager until step 3. The URI is only for Render.
5. Confirm the cluster is available and the scoped user is listed. If the connection wizard asks you to add a network entry now, leave it pending and return after Render supplies its IP ranges. Avoid an all-addresses entry such as `0.0.0.0/0`.

If you lack project permissions, ask the team’s Atlas project owner to complete these steps. If the Free tier is unavailable in the selected region, choose another US region where it is offered. The local demo still runs during cloud setup.

Sources [Atlas Free cluster setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) · [Atlas database user roles](https://www.mongodb.com/docs/atlas/tutorial/create-mongodb-user-for-cluster/) · [Python driver URI](https://www.mongodb.com/docs/atlas/driver-connection/)

## 2. Publish the Phase 3 code and create three device credentials

Use GitHub Desktop to create a branch such as `phase-3-atlas-coordinator`, commit the Phase 3 changes, and click **Publish branch**. Confirm GitHub shows the root `Dockerfile` on that branch. Render can deploy directly from the branch while you verify it.

On Laptop A, open Terminal in the repo and create three separate local profiles. The command below is for macOS or Linux. It refuses to overwrite an existing profile.

```sh
python3 - <<'PY'
import os
from pathlib import Path
import secrets

os.umask(0o077)
for role in ("operator", "primary", "standby"):
    path = Path(f".env.{role}")
    with path.open("x") as stream:
        stream.write("LIFERAFT_CLOUD_URL=\n")
        stream.write(f"LIFERAFT_CLOUD_TOKEN={secrets.token_hex(32)}\n")
    print(f"Created {path.name}")
PY
git check-ignore .env.operator .env.primary .env.standby
```

You should see all three filenames from `git check-ignore`. Open each file in your editor and copy the token value only when setting the matching Render variable. Keep them out of Git, chat, screenshots and shell command arguments. If the files already exist, keep the existing matching values or deliberately rotate all affected settings. Share only the standby credential with Laptop B using a password manager's private sharing feature.

## 3. Create the Render service

1. Sign in to [Render](https://dashboard.render.com/). Choose **New → Web Service**. Connect GitHub and grant access to `Pranav593/hackutd-liferaft`. Select the branch from step 2.
2. Set **Name** to `liferaft-coordinator` (add a suffix if taken), **Language** to **Docker**, **Instance Type** to **Free**, and choose a US region near Atlas. Leave **Root Directory** and **Docker Command** blank. If a Dockerfile path is requested, use `./Dockerfile`. Set **Health Check Path** to `/healthz`.
3. In **Environment Variables**, add the five entries below, then deploy. Keep auto-deploy off during the drill if you expect further pushes.

| Key | Value |
|---|---|
| `LIFERAFT_ATLAS_URI` | The completed private Atlas driver URI |
| `LIFERAFT_PRIMARY_TOKEN` | Token from `.env.primary` |
| `LIFERAFT_STANDBY_TOKEN` | Token from `.env.standby` |
| `LIFERAFT_OPERATOR_TOKEN` | Token from `.env.operator` |
| `LIFERAFT_ENABLE_DRILLS` | `1` to allow the injected cooling drill |

4. In the new Render service, choose **Connect → Outbound** and copy all listed CIDR ranges. In Atlas, go to **Security → Database & Network Access → IP Access List → Add IP Address**. Add each range separately and wait until the entries are active. The worker laptops' IP addresses are unnecessary.
5. Wait for Render to show **Live**. Open the public service origin with `/healthz` appended. The expected response is `{"ready": true}`, which confirms the web process is up. The authenticated doctor below checks Atlas connectivity. If Free Render went idle, open the health URL and allow the service to wake before starting the workers.
6. For UptimeRobot, point an HTTP(S) monitor at the public `/healthz` URL. Its free HTTP monitor uses `HEAD`. After deploying a revision that supports that method, `curl -fsSI https://liferaft-coordinator.onrender.com/healthz` should report HTTP 200, and the monitor should show **Up** after a successful probe.

If Render cannot see the repo, grant that repo access in the Render GitHub app settings. If Atlas auth fails, compare the URI placeholders, database user, and Render outbound CIDRs in their dashboards. If the host remains unavailable, run the local demo while diagnosing it. Keep the service on the Free tier.

Sources [Docker deploys](https://render.com/docs/docker) · [Render Free limits](https://render.com/docs/free) · [Environment variables](https://render.com/docs/configure-environment-variables) · [Outbound IP ranges](https://render.com/docs/outbound-ip-addresses)

## 4. Verify recovery on two laptops

Both laptops need the Phase 3 code, now on `main`, and the Python and CPU PyTorch setup in [README.md](../README.md). In Terminal, open the repository folder and run:

```sh
.venv/bin/python -m liferaft doctor --training --json --redact
```

Check for `"cpu_verified": true`. If your prompt already shows `(.venv)`, you can use `python -m liferaft` instead of `.venv/bin/python -m liferaft`. On Windows use `.venv\Scripts\python.exe` in place of `.venv/bin/python`. Keep both laptop clocks set automatically.

Fill in `LIFERAFT_CLOUD_URL` in the profiles with the same public Render origin, for example `https://liferaft-coordinator.onrender.com`. On Laptop B, create only `.env.standby` using that URL and the standby token. Laptop A needs `.env.operator` and `.env.primary`.

Before starting either worker, open the public Render URL with `/healthz` appended. Wait for `{"ready": true}`, then run the following in the laptops’ normal terminals. The expected response is `auth: true`, `database: true`, and the matching role. This confirms the Atlas ping. Job creation and the checkpoint drill verify the collection permissions. HTTP 401 means that profile's token does not match its Render environment variable. For HTTP 503, check the Render service logs, Atlas URI, IP access list, and database privileges.

```sh
# Laptop A
.venv/bin/python -m liferaft cloud --profile operator doctor
.venv/bin/python -m liferaft cloud --profile primary doctor

# Laptop B
.venv/bin/python -m liferaft cloud --profile standby doctor
```

Then run the drill.

1. **Laptop A, operator terminal.** Create the job. Use a fresh name for each attempt and substitute it in every command.

   ```sh
   .venv/bin/python -m liferaft cloud --profile operator create --job campus-drill-01
   ```

2. **Laptop B.** Start the standby and leave it running.

   ```sh
   .venv/bin/python -m liferaft cloud --profile standby worker --role standby --job campus-drill-01
   ```

3. **Laptop A, operator terminal.** Verify Laptop B is ready. The result must include `"standby_ready": true`. If it is false, check Laptop B's terminal before proceeding.

   ```sh
   .venv/bin/python -m liferaft cloud --profile operator status --job campus-drill-01
   ```

4. **Laptop A, separate terminal.** Start the primary.

   ```sh
   .venv/bin/python -m liferaft cloud --profile primary worker --role primary --job campus-drill-01
   ```

5. **Laptop A, operator terminal.** Once the primary reaches at least step 20 and while it is still running, request the injected drill.

   ```sh
   .venv/bin/python -m liferaft cloud --profile operator rescue --job campus-drill-01
   .venv/bin/python -m liferaft cloud --profile operator status --job campus-drill-01
   ```

6. On Laptop B, look for `STANDBY_CHECKPOINT_RESTORED` followed by `TRAINING_STEP_COMPLETED` at the checkpoint step plus one. Once Laptop B finishes, rerun status. The expected fields are `state: COMPLETED`, `owner: laptop-standby`, `epoch: 2`, and `last_step: 200`. Export the redacted timeline to the ignored local state directory.

   ```sh
   .venv/bin/python -m liferaft cloud --profile operator events --job campus-drill-01 > .liferaft/campus-drill-01.jsonl
   ```

The event export should show `chain_valid: true`, an injected `RESCUE_REQUESTED`, and `FIRST_RESUMED_STEP_COMPLETED` with the same checkpoint SHA-256. Keep the terminal output from both laptops for the evidence record. If a worker exits or a drill is missed, stop the worker processes in their own terminals with Ctrl+C and retry with a fresh job ID. The offline fallback is `.venv/bin/python -m liferaft demo --scenario cooling-test`.

## 5. First ESP32 button-triggered recovery

1. On Laptop B, confirm the button-only firmware emits the documented [USB frame](../INTEGRATION_CONTRACTS.md#10-hardware-serial-contract). Close its serial monitor so the bridge can open the port. In **Device Manager → Ports (COM & LPT)**, note the Espressif port that appears when the board is connected.
2. On Laptop B, from the repo in PowerShell, install pySerial and create an ignored `.env.gateway`. This command generates a new token in the file without printing it and refuses to overwrite an existing profile.

   ```powershell
   .\.venv\Scripts\python.exe -m pip install pyserial==3.5
   .\.venv\Scripts\python.exe -c "from pathlib import Path; import secrets; Path('.env.gateway').open('x').write('LIFERAFT_CLOUD_URL=https://liferaft-coordinator.onrender.com\nLIFERAFT_CLOUD_TOKEN=' + secrets.token_hex(32) + '\n')"
   git check-ignore .env.gateway
   ```

3. On the [Render service](https://dashboard.render.com/), open **Environment → Environment Variables**. Add `LIFERAFT_GATEWAY_TOKEN` with the token value from Laptop B's `.env.gateway` and keep `LIFERAFT_ENABLE_DRILLS=1`. Use a password manager to transfer the token privately if the dashboard is on another laptop. Keep it out of screenshots, Git, and ESP32 firmware. Deploy the code that includes the gateway action. On Laptop B, run `.\.venv\Scripts\python.exe -m liferaft cloud --profile gateway doctor` and check for `role: gateway` and `database: true`.
4. Start a fresh two-laptop job using §4. On Laptop B, open a second PowerShell and arm the bridge. Substitute the new job ID and the port from Device Manager. After `BUTTON_BRIDGE_ARMED` and the primary's first 20 steps, press the button once. The bridge listens for up to two minutes and exits after one valid press.

   ```powershell
   .\.venv\Scripts\python.exe -m liferaft cloud --profile gateway bridge --job campus-button-01 --port COM8
   ```

5. Check the operator events for `SENSOR_EVENT_RECEIVED` with `source_type: injected`, then a `RESCUE_REQUESTED` whose `trigger_event_id` matches that sensor event. Let Windows finish and confirm `COMPLETED` at step 200. If the button is unavailable, use the operator `rescue` command for the software-only drill. If the bridge reports a USB or HTTP error, use operator status to establish whether a request arrived before rearming.

## 6. Optional live cloud verification

Run the hosted access checks on a laptop with its existing `.env.standby`. These probes use a fresh nonexistent job ID and expect the coordinator to reject an anonymous download and an authenticated worker impersonation.

```sh
LIFERAFT_TEST_HOSTED=1 .venv/bin/python -m unittest discover -s tests -p test_cloud_live.py -v
```

For the transaction check, use a **separate test Atlas deployment** with a user scoped to its `liferaft` database and a network allowlist for the test machine. Install `requirements-cloud.lock` in the test venv. Supply its connection URI through the private `LIFERAFT_ATLAS_TEST_URI` environment variable and run `.venv/bin/python -m unittest discover -s tests -p test_cloud_live.py -v`. The test inserts uniquely named fixtures, aborts a checkpoint transaction after the artifact insert, checks that neither state nor bytes changed, then tests a successful commit and overwrite rejection. Cleanup targets only that run's fixture IDs.
