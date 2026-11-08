# LIFERAFT — Required verification matrix and evidence standards

**For Codex:** This is not a wish list. Automate these tests wherever feasible, record measured outcomes and distinguish `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, `NOT_RUN`, and `SIMULATED`. Do not mark a service integration PASS merely because mocks pass. Never perform physical overheating, power cutting, fan shutoff or unsafe relay switching as a test.

## 1. Core checkpoint correctness

| ID | Scenario | Expected assertion | Required evidence |
|---|---|---|---|
| CK01 | Uninterrupted train 200 steps | Real optimizer makes 200 updates; actual loss logged | file containing timestamped step/loss |
| CK02 | Stop after step 120, checkpoint 120, resume | Next new update is 121, not 1; optimizer state restored | step log and checkpoint hash |
| CK03 | Same-machine baseline vs resume | Final tensor/loss discrepancy within documented tolerance | pytest numeric comparison |
| CK04 | ARM Pi checkpoint → x86 Laptop | New machine loads, advances real step, compatible model | two actual worker IDs + hashes |
| CK05 | Truncate checkpoint test copy | SHA mismatch; never loaded | explicit REJECTED event |
| CK06 | Change model version/dataset fingerprint | Refuses resume with compatibility error | diagnostic message |
| CK07 | Crash while writing temp checkpoint | Previous committed checkpoint stays readable | fault-injection unit test |
| CK08 | Duplicate uploaded object path | No overwrite; request rejected or idempotent same hash | storage result |
| CK09 | Timeout in upload | No `COMMITTED` state until verifiable | event log |
| CK10 | Only hash prefix displayed publicly | Full hash retained server-side, never exposed download token | UI/API snapshot |

## 2. Ownership, failover and consistency

| ID | Scenario | Expected assertion | Required evidence |
|---|---|---|---|
| FA01 | Graceful injected cooling test | Primary commits checkpoint, yields, new epoch claimed, backup real step | incident timeline |
| FA02 | Kill only training Python process | Lease eventually expires; backup resumes from last good checkpoint | process exit + event traces |
| FA03 | Two backup claims race | Only one transaction wins; owner epoch increases once | parallel test |
| FA04 | Previous primary reappears | Stale epoch writes refused; old worker pauses | rejected write event |
| FA05 | Network disconnect 10–30 s | Bounded retries, stale health; no duplicate accepted owner | fault simulation |
| FA06 | Standby not ready | No false success; explicit `STANDBY_UNAVAILABLE` | state trace |
| FA07 | No verified checkpoint | No unsafe load, `NO_VALID_CHECKPOINT` error | state trace |
| FA08 | Cloud upload delayed | Previous committed candidate remains rescueable | controlled delayed storage |
| FA09 | Repeat same incident request | One incident/lease action, idempotent response | DB uniqueness proof |
| FA10 | Operator unauthorized | Rejects mutate/claim/unsafe API | 401/403 tests |
| FA11 | Coordinator unavailable | Current workers honor lease grace; UI `STALE` | offline test |
| FA12 | Restore on different architecture | Still real training; compare within reasonable tolerance | Pi→laptop run |

## 3. Campus Wi-Fi and cloud path

| ID | Scenario | Expected assertion | Evidence |
|---|---|---|---|
| NET01 | Pi on hotspot, Laptop A campus Wi-Fi | Both make outbound HTTPS to coordinator, no peer connection | successful cloud status calls |
| NET02 | Laptop A and B cannot ping each other | Workload transfer still works via private storage | download + verify + train |
| NET03 | Anonymous tries private checkpoint GET | Denied | 401/403 response |
| NET04 | Wrong device token sends heartbeat | Denied, no state mutation | response log |
| NET05 | Attacker passes old lease epoch | Claim/commit rejected | 409 event |
| NET06 | Cloud signed URL expires | Safe refresh only for authorized worker | test/HTTP status |
| NET07 | 429 / transient 5xx | Exponential bounded retry, no duplicate effects | stubbed API test |
| NET08 | No internet | Local simulator remains usable, cloud claims not faked | mode/status label |

## 4. Hardware and sensor integrity — non-destructive only

| ID | Scenario | Expected assertion | Evidence |
|---|---|---|---|
| HW01 | ESP32 board-only serial hello | Clean boot message over correct data USB port | redacted serial log |
| HW02 | Button pressed once | Exactly one injected event after debounce | seq + event id |
| HW03 | Button bounced/repeated rapidly | Rate-limit/debounce, no duplicate rescues | test trace |
| HW04 | DS18B20 ambient valid | value within plausible room range and labeled ambient | reading + source |
| HW05 | DS18B20 disconnected | reports invalid/stale; never false hot/cold trigger | `SENSOR_INVALID` |
| HW06 | OLED I2C address discovered | Correct 3.3V-compatible module and text shows | actual scan/board observation |
| HW07 | USB unplugged | bridge reports sensor offline; job remains safe | loss-of-serial test |
| HW08 | ESP32 reconnect | resumes with new sequence/session safely | bridge log |
| HW09 | Pi OS CPU telemetry | separately shows `pi_cpu_temp_c` timestamp | sysfs/vcgencmd read |
| HW10 | Any simulated high temp | never changes physical fan or device power | static audit + trace |
| HW11 | Relay in default build | no relay-control GPIO code or wiring | wiring photo/code search |
| HW12 | Pi workload with normal cooler | CPU/memory bounded, no thermal shutdown or undervoltage | syslog/telemetry |

## 5. Nemotron and Photon truth tests

| ID | Scenario | Expected assertion | Evidence |
|---|---|---|---|
| AI01 | No NVIDIA key | provider offline, mock labeled, test mode still works | UI indication |
| AI02 | Valid key + live incident | >=2 distinct real tool calls and grounded answer | redacted provider trace |
| AI03 | Unknown tool requested | reject not execute | negative unit test |
| AI04 | Model asks for arbitrary shell / power cut | no tool available; reject unsafe action | allowlist test |
| AI05 | Model invents a temperature | answer checker requires evidence; marked unknown | validation test |
| AI06 | Tool response late | bounded timeout, fallback report | timeout test |
| PH01 | Photon outbound to consenting contact | real provider ID and message receipt | redacted event |
| PH02 | Actual `STATUS` inbound | live correct worker and step returned | actual inbound event |
| PH03 | Unknown sender `ACK` | rejected, no change | auth test |
| PH04 | Duplicate provider delivery | one ACK/event record | idempotence test |
| PH05 | Photon offline | training rescue succeeds anyway | inject provider timeout |
| PH06 | Fake adapter running | UI clearly says `SIMULATED MESSAGING` | screenshot/test |

## 6. Risk/checkpoint algorithm tests

- Risk score is deterministic given time-stamped telemetry window + configuration. Same input yields same output; no LLM involvement.
- External temperature and Pi CPU temperature are different metrics. Missing or old sensor readings cannot be interpreted as current.
- Injection flag is preserved end-to-end; official event names never say a real overheat was measured if the only trigger was a button.
- Adaptive checkpointing must not exceed configured minimum interval, maximum storage rate, maximum uploads, maximum CPU/memory overhead; actual overhead is measured.
- One absurd `85°C` sensor startup reading with failed CRC cannot autonomously trigger destructive actions; it yields an invalid-sensor warning.
- Job remains correct if checkpoint is in progress when rescue occurs; use previous verified candidate.
- RTO is measured from event detection to first actual new step on backup. RPO shows unknown if primary last step cannot be measured; do not always report zero.

## 7. Product UI evidence tests

- Every UI status maps to coordinator state/event or real worker telemetry, otherwise display "not connected / no data".
- `Rescue complete` appears **only** after a verified first completed optimizer step on new owner.
- Distinguish hardware-button-injected event from actual measured CPU/ambient temperature.
- Loss chart uses actual step/loss data; checkpoint and failure markers align to times.
- Authenticated UI view can show redacted tool trace and message receipts; unauthenticated view cannot read checkpoints or phone IDs.
- All visible actions have actual working handler. `Cancel`, `reset` or `inject` buttons cannot inadvertently power off hardware.
- Browser bundle does not contain secrets or server-only environment variables.
- Basic responsiveness and keyboard navigation pass.

## 8. Full-system repeatability protocol

Run at least **three** complete controlled rescue cycles after hardware integration. For each:

1. Reset **only project-owned job and incident state** with the documented safe reset command. Do not wipe system disks or entire Atlas collections that might contain other projects.
2. Start Pi primary worker (or label laptop fallback), Laptop A standby, Laptop B sensor bridge/console, and cloud coordinator.
3. Wait for a real `COMMITTED` checkpoint. Observe `pi_cpu_temp_c`, `ambient_temp_c`, and job loss separately.
4. Press ESP32 button. Observe one `injected` event, verified preemption and ownership transition. Observe first actual optimizer step on standby.
5. Send/receive real Photon message and run real Nemotron tool investigation if credentials/channels present. If unavailable, record `BLOCKED_EXTERNAL`, not PASS.
6. Capture measured RTO, checkpoint age, known RPO or `unknown`, resumed worker ID and hash status. Verify no device overheating, no relay switching and no forced shutdown.
7. Repeat twice, recording raw redacted evidence and failure reasons.

Do not quote synthetic benchmark measurements as actual results. Codex should generate an `evidence.json` report and an `experiments.md` summary with timestamps and test classifications, and include only measured values in UI.
