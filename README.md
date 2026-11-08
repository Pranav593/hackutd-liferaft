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
