# LIFERAFT — Agent instructions for Codex

Read `LIFERAFT_CODEX_MASTER_PLAN.md` before changing code. This file defines implementation style and quality gates.

## Mandatory behavior

1. Work only on the next incomplete phase in `PROGRESS.md` unless explicitly directed otherwise.
2. Every phase must have working code, tests, and a concise repeatable local demo. Report actual test output; do not invent results.
3. Build local mode first. Both laptops are on campus Wi-Fi, which may block direct device-to-device connections. **No system component may require inbound network access to either laptop.** Use hosted HTTPS storage/coordination in cloud mode.
4. Implement a genuine CPU PyTorch job with checkpoint, optimizer state, integrity hash, and resume. Never substitute a simulated progress bar for a real training job.
5. Use deterministic job ownership/lease rules and verified committed checkpoints. A completed cloud upload alone is not enough; mark committed in data store before failover can use it.
6. LLMs may investigate and recommend but never directly authorize dangerous shell commands, file deletes, or forced worker ownership transfer. Keep control deterministic.
7. For services without credentials, implement documented adapters/fakes and do not claim a live integration.
8. Keep secrets in untracked environment files. Never print secret tokens, put service-role keys in a frontend, or store operator phone numbers in public logs.
9. Use Pydantic/typed interfaces in Python and corresponding TypeScript types; keep API and events stable across contributors.
10. After every phase, update `PROGRESS.md` with checklist, modified files, commands to run, test results, assumptions, and blockers. Do not skip negative tests.

## Preferred stack

Python 3.11+, PyTorch CPU, Pytest, Ruff, Supabase Postgres/Auth/Storage for internet-safe cloud mode, Next.js/TypeScript for dashboard, NVIDIA hosted Nemotron model via OpenAI-compatible API, Photon 2.0 messaging, PySerial optional for Arduino.

## First instruction

Immediately implement Phase 0 and Phase 1 in the master plan, including a deterministic 100-step unbroken-vs-resume test. Do not start hardware, Photon, Nemotron or frontend integration before proving real checkpoint continuity.
