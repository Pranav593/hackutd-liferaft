# Replay fixture provenance

`replay.local-job.json` is the redacted output of the unchanged Python
`liferaft cockpit-data` verifier/projector over a real local two-process
`cooling-test` run on 2026-11-08 UTC. It contains 20 events and 70 actual measured
loss samples, checkpoint 30 → first resumed optimizer step 31, completed at 70,
derived RTO 5221.859 ms and graceful RPO 0. Worker IDs identify local processes;
they do not attest different computers.

The original private run is `.liferaft/phase2-ahf9ym0g` in this checkout. To
regenerate a new fixture, run the real demo and then project the printed run
directory. New runs have different IDs, timings and possibly checkpoint steps;
do not edit them to match historical examples.

The plan's historical local and campus-button-05 projections were not present.
No substitute campus fixture was fabricated. Single-sample and provider/error
browser cases are explicitly intercepted test inputs, never application data.

The fixture contract compile check tracks required Replay fields/primitive types;
JSON string literals are widened by TypeScript, so enum domains and finite
measurements are checked by the runtime unit suite.
