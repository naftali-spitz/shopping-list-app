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


## Expanded instrumentation cohort (primary evidence)

Application source `4dd003e1ac2fb31813eb298c418c04eb5910e361`; protected Git Preview
`dpl_EVkAxGUmQpDSGy8vaTv6TVW6tv4Z`, source and feature alias checked before workload.
Same 14-operation mix per mode, no overlapping functional browser suites.
Raw: `attempts/overhead-a6e58202-849d-4cd5-bf39-7b981458c7fb.json`.

| Mode | n | Feedback P50 ms | Saved P50 ms | Average Saved ms | Chrome task s | Chrome heap MB | Diagnostic HTTP bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| OFF | 14 | 258 | 9408 | 10015 | 4.626 | 9.48 | 6198 |
| MID | 14 | 265 | 6914 | 7200 | 3.783 | 8.92 | 23860 |
| ON | 14 | 246 | 6926 | 6424 | 4.007 | 9.23 | 31545 |

Observed Saved P50 deltas versus OFF are -26.5% MID and -26.4% ON. These are
observational comparisons, not causal instrumentation overhead estimates.
Feedback P50 deltas are +2.7% MID and -4.7% ON, with only 14 mixed-operation
samples per mode; neither passes nor fails a meaningful 2% budget.
OFF still performs runtime configuration checks (24 completed diagnostic HTTP
requests), with no history ingest. MID had 32 and ON 30 completed diagnostic HTTP
requests including config and ingestion. Bytes are browser request+response bodies,
not TLS/header/MQTT/worker/callback wire traffic. HTTP count varies with run length.
No delayed operation was excluded. P95/P99 remain unreported.

Chrome long-task observations: OFF 0, MID 1 (68ms), ON 0. CDP ScriptDuration:
1.232s / 1.037s / 1.101s. CDP metrics are whole-document cumulative values, with
heap sampled at the end, not peaks or per-operation CPU. Listener CPU deltas:
1.666s / 1.381s / 1.176s; end MemoryCurrent 60.5 / 62.9 / 63.7 MB. Different
cohort durations, V8 warm-up/GC and network/provider variation remain confounders.

Authoritative query after all cohorts: OFF has 0 optional operation/source records;
MID 14/14 committed summaries, 98 source records, 0 spans, 55,844 source JSON bytes;
ON 14/14 committed summaries, 100 source records, 250 spans, 78,937 source JSON
bytes. This is insert cardinality/serialized source size, not complete WAL/write
amplification. Summary updates, indexes, audit and service traffic are additional.
Both enabled modes had 26 browser records (summary/frame pairs for 13 operations);
one operation's browser evidence was absent in each mode. Durable summaries
survived. No trace-completeness or loss-free claim is made. Full source coverage
is recorded in expanded-history-coverage.json.

## Isolated collector cost

`attempts/collector-cost.json` executes the actual BrowserMonitoring class in
Node/V8, 5,000 synthetic lifecycles per mode with asynchronous flush every 50.
Capture P50: OFF 1.530 microseconds, MID 8.966, ON 11.304. MID/ON each delivered
5,000 records in 100 batches, depth/drop/failure 0. Batched JSON serialization:
MID 7.57ms for 3.26MB, ON 22.12ms for 5.12MB. Warm-up/order/GC effects explain why
ON capture need not exceed MID in this small experiment. This excludes UI,
network and browser storage, and is not a browser latency percentage.

## Concurrent and failure observations

Concurrent test `concurrent-1be84869` uses two verified Dev actors and legitimate
invitation membership. Same-version UI edits yielded one commit (9753ms) and one
explicit conflict (9371ms), one actual quantity increment. This is n=2 functional
and exploratory latency evidence, not a capacity benchmark. A separate inspector
browser was active on another synthetic household; these are loaded observations.
Identical-ID simultaneous publication produced one ledger/business/history row;
history remained actor-isolated within the shared household.

Fault browser `5d031f5b` passed owned 8s MQTT interruption and 22s local callback
refusal. The latter committed exactly once while UI stayed pending; outbox had
19 attempts before Saved. Faults were disabled and dedicated service restored.
Callback `7c7c55b4` passed actual Preview duplicate/stale/forged/conflicting replay
checks. Monitoring attempts can lose optional tail records on service restart;
the durable business outbox remains authoritative. No router/ISP/firewall or
shared-provider outage was injected.

At the final audit, Dev PostgreSQL occupied about 19.3MB and the monitoring schema
0.934MB (89 operations / 459 source records), no capacity or missing-summary
rejections. This is a point-in-time capacity observation, not a long-run forecast.
Independent Vercel spans, retired latency distributions, large randomized cohorts,
physical Android, sustained concurrency and backup restore remain unverified.


## 300-operation crossover and measurement boundary correction

Evidence: `attempts/tail-36c6923d-8519-4c3b-bc5d-baacf64664f3/report.json`
and its `history-coverage.json`. Application source 4dd003e. Six isolated cohorts,
OFF/MID/ON/ON/MID/OFF, 50 operations each, 100 per mode. All 300 committed; no
slow operation was excluded. This mixed workload supports exploratory P95;
per-type samples remain below 100 and P99 is suppressed.

| Mode | n | Action-start → client Saved P50 ms | P95 ms | Feedback P50 ms | Feedback P95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| OFF | 100 | 7014 | 10566 | 293 | 692 |
| MID | 100 | 6642 | 8332 | 292 | 705 |
| ON | 100 | 6622 | 8965 | 292 | 580 |

These runs start **before Playwright actionability/click dispatch** and stop at
committed client storage. They are automation action-start observations, not
exact physical tap-to-paint measurements. The earlier 14-operation runs use the
same boundary. They must not be mixed with the corrected trusted-click benchmark
or the new `home_action_entry` diagnostic metrics. A lower enabled-mode median
is not proof of negative overhead or satisfaction of the proposed 2% budget.
Provider variation, warm-up, cohort ordering and client polling remain confounders.

Historical verification: OFF 0 optional summaries/records; MID 100 committed
summaries, 725 source records, 0 spans, 413916 serialized source bytes; ON 100
committed summaries, 728 records, 1831 spans, 576685 bytes. Browser evidence exists
for 96 MID and 97 ON operations. Durable summaries cover all accepted operations,
but optional tail loss remains visible and completeness is not claimed.

The corrected harness records a trusted DOM click timestamp and waits for both
committed local storage and the React Saved state. This still does not establish
physical display paint. Instrumentation distinguishes home action entry from
legacy operation creation, keeping their distributions and archived sums separate.
