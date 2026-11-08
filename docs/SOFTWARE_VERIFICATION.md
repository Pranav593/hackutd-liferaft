# Software verification and evidence limits

The November 8 software updates strengthen Phase 3 without requiring a device,
provider account, production database access or new secrets. They do not complete
the remaining live/hardware gates in [PHASE_TRACKER.md](../PHASE_TRACKER.md).

## What is implemented

- Expiring authenticated binary checkpoint transfers, rechecked against current
  policy and verified by SHA-256 on both server and restoring worker.
- Bounded retry/backoff for safe operations, strict remote lease validation and
  finite response parsing. Uncertain ownership mutations stop without retry.
- Independent Atlas artifact checks and repository rollback/retry fault tests.
- Complete journal exports across the old 500-event boundary, anchored to a
  captured head and independently verified locally.
- Read-only job doctor and deterministic evidence brief with explicit unknowns.

The real numerical test saves checkpoint 25, rejects a corrupted download before
publishing it or claiming ownership, then resumes at 26 and finishes 200. It
compares actual loss history and final model tensors to an uninterrupted baseline.
The new signed-path test uses an in-process WSGI adapter on one computer. Existing
two-process tests independently cover local graceful and crash recovery. Neither
is substituted for a new physical cross-laptop signed-transfer drill.

## Reproduce on Windows

From the repo root, using the existing environment with the training dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install pymongo==4.15.5 dnspython==2.8.0
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m compileall -q liferaft tests scripts
npm ci --ignore-scripts
node node_modules/typescript/bin/tsc --strict --noEmit web/src/lib/contracts.ts
git diff --check
```

The first command installs the existing cloud lockfile pins so offline repository
fault tests can import the driver; it does not connect to Atlas. Those three
tests skip if the optional driver is absent. Hosted and isolated-Atlas tests also
skip unless explicitly enabled. Foundation/training setup remains in the README.
On macOS/Linux replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`.
The npm command installs the pinned TypeScript compiler; invoking its local file
avoids npm fetching an unrelated package if dependencies have not been installed.

Focused suites use `-p test_signed_training.py`, `-p test_event_export.py`,
`-p test_evidence.py`, `-p test_readiness.py`, `-p 'test_cloud*.py'` or
`-p 'test_atlas*.py'` after `-s tests`. Test names identify injected fixtures;
test output is not presented as live provider/sensor evidence.

## Read a saved run without external access

```powershell
.\.venv\Scripts\python.exe -m liferaft evidence --job campus-button-05 --events .liferaft/campus-button-05.jsonl --output .liferaft/campus-button-05-evidence.json
```

Use an actual saved `CLOUD_EVENTS` export for that job. No credentials, network or
LLM are used by `evidence`. Choose a new output filename if one exists; output
publication refuses overwrites. The command exits 2 for wrong-job, truncated,
reordered, corrupt or oversized evidence. Successful validation of an empty or
incomplete recovery history yields `verified_resumed: false`, never fake success.

`verified_resumed` requires matching committed hash/step/producer, transfer to a
different worker at the next epoch, and a measured first step K+1 with finite loss.
`completed_after_resume` also requires completion by that owner/epoch. The report
keeps crash RPO unknown without primary-yield evidence. RTO comes from recorded
coordinator measurements. Every brief states that physical device identity is
not independently attested and the report did not rehash checkpoint bytes.

Legacy exports have a locally checked chain but `legacy_unanchored` completeness:
their last record cannot prove no later records existed. New exports include a
head hash/sequence and `complete: true`; removing their tail fails validation.
These hashes are tamper evidence, not signatures from an external trust authority.

## Rolling compatibility and remaining gates

Updated workers negotiate `signed-v1` and otherwise retain the legacy private
base64 transfer path. New event export requires a `paged-v1` server; update the
coordinator before using that command against an older deployed revision. Existing
saved exports and Nemotron investigations remain readable.

No deployment was initiated during these software updates. The new endpoints,
hosted signed URL expiry/refresh, concurrent Atlas claims and rollback still need
fresh hosted/isolated-Atlas verification. The existing setup guide describes those
opt-in checks. No live failure was induced, and no production fixture was inserted.

Pi heterogeneous compute, combined button/OLED status, ambient sensor validation,
Photon delivery and fresh physical rescues retain their tracker gates. This batch
did not flash hardware, open serial devices, change Wi-Fi/cooling/power, send
messages or invoke NVIDIA. The Next.js cockpit remains unimplemented; the existing
HTML demo remains explicitly simulated.
