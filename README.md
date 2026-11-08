# LIFERAFT

LIFERAFT preserves a CPU training job in verified checkpoints so a backup worker can eventually pick up where the primary left off. See [PHASE_TRACKER.md](PHASE_TRACKER.md) for observed results and the current phase.

## Local setup

Use Python 3.11–3.13. Open Terminal (macOS/Linux) or PowerShell (Windows) in the project folder.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-foundation.lock
.venv/bin/python -m pip install --no-deps -e .
.venv/bin/liferaft doctor --json --redact
.venv/bin/python -m unittest discover -s tests -p test_foundation.py -v
```

On Windows, use `py -3 -m venv .venv` and replace `.venv/bin/python` and `.venv/bin/liferaft` with `.venv\Scripts\python.exe` and `.venv\Scripts\liferaft.exe`. On a machine with the pinned packages already installed, use `python3 -m liferaft` without the editable install. Once installed, the local foundation runs offline.

Use `--network` on `doctor` to check outbound public HTTPS. Local operations have no peer network dependency. Serial device discovery only lists ports. It does not open ports or identify what is plugged in.

TypeScript contracts use Node 22 or later. Run `npm ci` and `npm exec -- tsc --strict --noEmit web/src/lib/contracts.ts`. Regenerate the wire-schema snapshot with `python3 -m liferaft.fixtures > contracts/v1.schema.json`.

For physical steps see [HARDWARE_SAFETY_AND_WIRING.md](HARDWARE_SAFETY_AND_WIRING.md). The relay and unverified fan stay disconnected.

## Train and resume locally

Install the training dependencies into your project environment. On Apple Silicon macOS:

```sh
.venv/bin/python -m pip install 'torch==2.15.0' 'numpy==2.4.1'
.venv/bin/python -m liferaft doctor --training --json --redact
```

On Linux or Windows, use the CPU-only PyTorch index for the Torch package. Pi-specific installability is verified separately in Phase 4.

```sh
python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.15.0+cpu'
python -m pip install 'numpy==2.4.1'
```

From the project folder on this Mac:

```sh
.venv/bin/python -m liferaft train --steps 120 --checkpoint-every 10 --seed 1729
.venv/bin/python -m liferaft resume --checkpoint 'PASTE THE .pt PATH HERE' --steps 200 --seed 1729
.venv/bin/python -m unittest discover -s tests -v
```

Copy the `path` value from the final `CHECKPOINT_VERIFIED` line into the second command. Keep the `.json` manifest next to the `.pt` file. The resumed process should emit `TRAINING_STEP_COMPLETED` with `step_completed` 121. `--steps` sets the total target step. The logs give actual loss and checkpoint SHA-256. Only resume files produced by your own trusted LIFERAFT run. The local proof compares losses and final tensors exactly on one host. Cross-architecture evidence is tracked separately.

## Open the recovery cockpit

From the repo root, with the Python environment set up and the saved campus drill
at `.liferaft/campus-button-05.jsonl`, run:

```bash
npm ci
LIFERAFT_COCKPIT_JOB=campus-button-05 npm run dev
```

Open [the local cockpit](http://127.0.0.1:3000). The topology highlights the
selected event's route. Use the flight recorder to switch between milestones and
all events, inspect evidence, and rerun journal verification.

The console shows saved evidence and listens on loopback. The campus export has
one measured loss point. To see a full local curve, run the local failover demo
below, then point the cockpit at the run directory printed in its output:

```bash
LIFERAFT_COCKPIT_JOB=local-job LIFERAFT_COCKPIT_LOCAL_RUN=.liferaft/phase2-REPLACE_ME npm run dev
```

`LIFERAFT_COCKPIT_EVENTS` selects a journal at a different path.
`LIFERAFT_COCKPIT_INVESTIGATION` optionally points to a saved JSON line from
`liferaft investigate` for the same job and incident. The console validates its
tool evidence against the journal before showing it. On PowerShell, set each
variable with `$env:NAME = "value"` before running `npm run dev`.

`npm run typecheck` and `npm run build` check the console. Use `npm start` after
building, with the same environment variables. A custom Python executable can
be selected using `LIFERAFT_COCKPIT_PYTHON`. Keep evidence files private and
serve the console locally.

## Run the local failover demo

From the project folder, run either scenario in the same environment that passed the training doctor check.

```sh
.venv/bin/python -m liferaft demo --scenario cooling-test
.venv/bin/python -m liferaft demo --scenario worker-crash
```

- **Cooling drill.** The command injects a simulated cooling incident in software. The primary saves a verified checkpoint and gives up its lease. The standby reads and rehashes the checkpoint, claims a new lease, and takes the next real training step.
- **Worker crash.** The command stops the dedicated primary training child process it launched. The standby waits for the primary's 12-second lease to expire, then continues from the last valid committed checkpoint. Recovery time in the report starts at detection, which occurs at lease expiry. Lost steps appear as `null` when the primary could not report its last step.

Success prints `LOCAL_RECOVERY_VERIFIED` with `owner: local-standby`, `epoch: 2` and `last_step: 70`. The output points to an `evidence.json` file under `.liferaft/phase2-*/`. The same directory holds each worker's loss log and the checkpoint artifacts. Both workers run on this computer, with no network or physical hardware required.

## Hosted recovery across two laptops

See the [Phase 3 Atlas and Render setup guide](docs/PHASE_3_ATLAS_SETUP.md) for the cloud deployment and recovery drill. Live verification status is in the phase tracker.

## Verify readiness and save a recovery brief

With the current coordinator revision deployed, the operator can check a job
without changing its lease or running recovery policy:

```sh
.venv/bin/python -m liferaft cloud --profile operator doctor --job campus-button-05
.venv/bin/python -m liferaft cloud --profile operator events --job campus-button-05 > .liferaft/campus-button-05.jsonl
.venv/bin/python -m liferaft evidence --job campus-button-05 --output .liferaft/campus-button-05-evidence.json
```

Substitute your actual job ID. On Windows use `.\.venv\Scripts\python.exe`.
The readiness result lists blocking reasons; a completed job correctly is not
ready for another drill. The events command captures all pages to a fixed hash
head and verifies them locally. `evidence` links checkpoint, ownership and measured
first-step records, keeps crash RPO unknown, and refuses to overwrite an existing
output. Saved legacy exports remain readable with `legacy_unanchored` completeness.
The brief is deterministic; Nemotron interpretation uses the separate command below.

See [software verification and remaining gates](docs/SOFTWARE_VERIFICATION.md)
for test commands, signed-transfer behavior, rolling compatibility and evidence limits.

## Investigate a rescue with NVIDIA Nemotron

Run the investigation from the dashboard station, Pranav's Mac. Ved's Windows laptop is the Raspberry Pi connection point. The investigator reads the job export, which identifies the workers that actually ran that job.

1. In the repo root on the Mac, add `NVIDIA_API_KEY=<your NVIDIA Build API key>` to the ignored `.env` file. `git check-ignore .env` should print `.env`. Keep the key in the local environment and out of Git and browser code. `NVIDIA_MODEL_ID` is optional and defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`.
2. From the repo root, run the command below. If the file for this job is missing, run the preceding export command first. For a fresh drill, replace the job ID in both commands with the new ID.

   ```sh
   mkdir -p .liferaft
   .venv/bin/python -m liferaft cloud --profile operator events --job campus-button-05 > .liferaft/campus-button-05.jsonl
   .venv/bin/python -m liferaft investigate --job campus-button-05
   ```

Success prints `NEMOTRON_INVESTIGATION` with `source_type: provider`, a structured report, and the two tool results with event IDs. The `investigate` command verifies the export's hash chain, sends allowlisted incident fields to NVIDIA Build, and uses the resulting report as advisory output. If the provider fails, use the original coordinator export for the demo evidence. A failed request produces `NEMOTRON_INVESTIGATION_FAILED` with a redacted reason and exits 2.
