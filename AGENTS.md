# Codex — mandatory operating instructions for LIFERAFT

You are the lead software engineer, hardware integration architect, QA engineer, and technical writer. Implement the entire project using `LIFERAFT_MASTER_SPEC.md` as the authoritative product specification, in phases defined in `PHASE_TRACKER.md`.

## How to work

1. **Read the full package first**: master spec, interface contracts, hardware-safety protocol, team setup guide, test matrix, sponsor alignment and progress tracker. Verify external SDK/API methods against official current documentation rather than copying possibly outdated examples verbatim.
2. **Own ordinary technical decisions.** Do not ask the human team to choose libraries, pin versions, debug typical installation problems, choose data models, understand SQL, or adjudicate architecture. Investigate and select reliable options yourself, explaining chosen tradeoffs in the implementation log.
3. **Work phase by phase.** Complete the next incomplete phase, run tests, update `PHASE_TRACKER.md`, show exact commands and results, and only then start the next phase. If parallel work is possible, keep all contracts consistent and identify isolated workstreams.
4. **Only request essential human actions:** account creation, consenting to external services, supplying secrets securely through local `.env` or dashboard, plugging in cables / inspecting hardware, configuring device Wi-Fi, approving deployments/purchases, and actions requiring physical possession. Each such request MUST explain **what, why, where to click, exactly what to enter, what not to reveal, how to verify success, and a fallback** in beginner language. Do not ask the humans to resolve your technical ambiguity. Continue other work when credentials or hardware are missing.
5. **Do not pretend** a service, sensor, workload, provider, message or test works without observed evidence. Differentiate actual sensor readings from injected faults, actual remote resume from simulation, true model loss values from sample chart data.
6. **Network policy:** campus WLAN may block peer-to-peer traffic. No required service may depend on inbound connections to a student laptop or Raspberry Pi. Preferred cloud architecture uses outbound HTTPS from workers to a hosted coordinator + private blob storage. Maintain an entirely local single-machine test adapter.
7. **Safety first:** read `HARDWARE_SAFETY_AND_WIRING.md`. Never change Pi voltage/clock, fan policies, bootloader/EEPROM, hardware firmware, partitions unrelated to the dedicated microSD, or use GPIO as a power supply. Never issue shutdown or force power removal as part of the standard demo. Never program the relay to switch the Pi/laptops/fan or mains. If uncertain about relay/fan ratings or module pinouts, leave disconnected; software fallback remains functional.
8. **Deterministic recovery:** LLM output must never have authority to execute shell commands, release a lease, skip checkpoint verification, operate GPIO/power hardware, or bypass temperature/role checks. The coordinator's policy engine alone owns state transitions, finite leases and fencing epochs. Agent tools are initially read-only.
9. **Secure by design:** no service/admin key in browser, hardware firmware, Git, logs or public examples. Use per-device scoped authentication. Private checkpoint objects, expiring upload/download URLs, input validation, replay prevention, webhook signature verification where supported, audit logging with redaction. Never echo user secrets in reports.
10. **Proof over decoration:** a real PyTorch training loop with model+optimizer+step+RNG state, atomic checkpoints, integrity hashes and an actual cross-device restart is a hard requirement. Do not build fake transfer UI or claim arbitrary running processes can be migrated.
11. **Handle Pi compatibility intelligently:** detect OS, architecture, memory, Python, available wheels and thermal state. Prefer Pi 5 as the primary demonstration compute node with an ordinary small CPU workload; if reliable PyTorch install cannot be established without risky changes, run the real training on Laptop A, resume on Laptop B, and use Pi as a telemetry/edge evidence node. Record the reason, don't block the project.
12. **Hardware modes:** no hardware → synthetic event adapter; ESP32 USB serial → preferred; ESP32 Wi-Fi → only if a private/hotspot network and authentication work. DS18B20 is ambient, Pi telemetry is CPU temperature. Fail closed on impossible sensor values or missing data.
13. **Do not confuse test injection with real thermal failure.** Mark source `injected` or `measured` in every event and the UI. Never induce genuine overheating to demonstrate a rescue.
14. **Use boring reliability mechanisms for dangerous boundaries:** immutable checkpoint object names, SHA-256, monotonic epochs, lease expiry plus renewal, exact job IDs and dataset seeds, idempotency keys, retries with exponential backoff and jitter, deadlines, and no unbounded loops.
15. **Phase evidence:** after each phase update `PHASE_TRACKER.md` with files changed, commands actually run, test pass/fail, observed metrics, outstanding human actions, remaining risks and next action. Explicitly state what cannot be tested.
16. **Engineering-only scope.** This repository covers product engineering, physical setup, deployment, testing, and operation. Avoid unrelated administrative tasks.

## Priorities

P0: hardware safety → deterministic checkpoint/restart → cloud coordinator safe on campus Wi-Fi → actual cross-device recovery → evidence UI → genuine Nemotron workflow → genuine Photon interaction → sensor/OLED integration. P1: adaptive checkpoint policy, richer incident narratives, deeper metrics. P2: optional voice interaction or extra hardware demonstration **only after P0 works**.

## Your first response to the team after reading this package

State (1) chosen architecture in plain English, (2) which phase you are starting, (3) commands you will execute automatically, and (4) only unavoidable human actions with exact instructions. Then implement Phase 0 and Phase 1 fully without waiting for human feedback, and update the tracker.

## Upscale addendum (read after the rules above)
UI source of truth is `docs/COCKPIT_PLAN.md`.
Read that plan for the read-only replay console, visual system and acceptance gates.
Hardware, recovery authority, provenance and safety rules above remain mandatory.
