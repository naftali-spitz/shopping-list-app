# Monitoring overhead — exploratory cohorts, no budget acceptance

The <2% MID latency increase is a proposed target, not a verified result.
No P95/P99, representative concurrency or extended soak claim is made.

## Initial instrumentation cohort

Source 54e47d6100a92831a28f435121b0ac83c446c914, Git Preview
`dpl_HvGCKwNnvoqCmsVDBfhu5ukvAJtL`. Each mode has the same 14 paced actual-root
UI operations (category create 1, product create 3, check 4, uncheck 3, quantity 3).
Own synthetic households; one browser; no fault injection; sequential OFF, MID,
ON ordering; network/free-tier/provider conditions uncontrolled. All operations
remain in the sample. No delay exclusions. UI feedback is independently observed
in Chrome and Saved is the existing authoritative client committed state.

| Mode | n | Feedback P50 ms | Tap→Saved P50 ms | Average Saved ms |
|---|---:|---:|---:|---:|
| OFF | 14 | 266 | 8258 | 8574 |
| MID | 14 | 263 | 6997 | 6967 |
| ON | 14 | 264 | 7838 | 8032 |

Combined P50 uses nearest rank; by-operation medians in the raw report average the
two central values for even sample counts. Different operation types are mixed
in this overview; stratified values are the appropriate comparison. MID's lower
observed latency is not evidence that instrumentation speeds up shopping, and
cannot establish the <2% target in either direction.

Listener process CPU deltas: OFF 1.670s / 161.0s cohort; MID 1.412s / 133.9s;
ON 1.544s / 147.1s. MemoryCurrent after cohort: 61.6 / 63.7 / 64.6 MB respectively.
These include normal listener/reconciliation work; different cohort durations,
process age, and uncontrolled conditions prevent causal overhead attribution.
These are endpoint memory readings, not peaks. Initial run did not capture browser
CPU/long tasks or wire/write amplification; the expanded harness adds CDP task,
script and heap metrics, long tasks and completed browser API request sizes.

Raw evidence: `attempts/overhead-93317caf-702d-4e2f-bff1-79ed1da8fc02.json` and
its referenced Stage4-format performance directories. The first alias-mismatched
cohort is invalid/aborted and retained separately in provenance-correction.json.

## Current collection boundaries

Browser client-state Saved, React-commit/frame opportunities and visible feedback
are separate observations. Hardware paint is not proven. Database transaction
start timestamps in prior reports are not COMMIT wall times. Current COMMIT spans
use local monotonic query/ack timing. MQTT connect/PUBACK never means DB commit.
Callback success means durable gateway receipt, not browser receipt/render.
The UI shows partial completeness and unknown broker/network/internal gaps.

No elapsed time is calculated by subtracting wall timestamps from different
hosts. Nested DB/listener/polling spans overlap and are not summed as total time.
Metrics relayed by a browser are identified as browser-source evidence. Independent
Vercel/gateway detailed timing persistence remains an open acceptance requirement.
