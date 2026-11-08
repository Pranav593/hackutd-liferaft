# Windows standby setup

The repository environment is `.venv`, created with the existing Python 3.13.
Use its executable explicitly in PowerShell; activation is optional.

## Provision the private standby credential

The ignored root `.env.standby` contains the coordinator origin recorded in the
phase tracker. Its token is initially empty. This laptop needs the existing
standby credential so the coordinator can recognize its role.

1. Ask the coordinator operator to share the existing standby token through your
   team's password manager. It must match **Render dashboard →
   liferaft-coordinator → Environment → LIFERAFT_STANDBY_TOKEN**.
2. In your editor, choose **File → Open File**, then open `.env.standby` in this
   repository. After `LIFERAFT_CLOUD_TOKEN=`, paste that exact 64-character
   hexadecimal token, with no spaces. Save the file. Keep the URL unchanged
   unless the operator supplies a different verified HTTPS coordinator origin.
3. Never paste the token into chat, a terminal command, screenshots, or Git.
   Do not use the primary/operator credential or MongoDB connection string.
4. In PowerShell in the repository root, run:

   ```powershell
   .\.venv\Scripts\python.exe -m liferaft cloud --profile standby doctor
   ```

   Success reports `auth: true`, `database: true`, and `role: standby` (JSON).
   This check does not start a worker or prove cross-device recovery.
5. If it fails, check that the file was saved and the credential matches the
   operator's standby setting. HTTP 401 means authentication failed. For service
   or database failures, have the operator follow the Phase 3 setup guide.
   While credentials or hosting are unavailable, local training checks still
   work without them:

   ```powershell
   .\.venv\Scripts\python.exe -m liferaft doctor --training --json --redact
   .\.venv\Scripts\python.exe -m unittest discover -s tests -p test_training.py -v
   ```

Follow [the Phase 3 guide](PHASE_3_ATLAS_SETUP.md#4-verify-recovery-on-two-laptops)
to start a worker against an agreed job after the authenticated doctor succeeds.
