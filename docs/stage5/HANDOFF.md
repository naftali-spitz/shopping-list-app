# NAF-197 handoff — implementation delivered, full acceptance open

Branch: `feature/flespi-home-backend`. PR16 remains DRAFT targeting develop.
Application: `6db258ae3ed89dcffd564c5516679734eebb4333`, CI passed in 35s.
Verified protected Preview:
https://shopping-list-4tm7s1psu-0012ab-5576s-projects.vercel.app
Deployment provenance: `attempts/fixed-preview.json` and pinned inspector b40501b4.
Benchmark source:4e0d421, before the separately tested immutable-result fix.
No production configuration/data writes, main push, merge, paid infrastructure,
direct-LAN communication or Debian frontend implementation occurred.

## Delivered

- Persisted, audited, server-authorized OFF/MID/ON, restored to MID at handoff.
- Bounded asynchronous batches in MID and ON:50 records/5s; browser 200, Debian 500;
 96000-byte UTF-8 batches; immutable IDs, duplicate protection and best-effort retry.
- Durable accepted-operation summaries from existing gateway evidence, independently
 of browser survival; sanitized local timing fragments/spans with explicit gaps.
- Seven additive migrations applied only to Supabase Dev PostgreSQL project
 njomxqthjglqesxchlbm. Private dev_monitoring tables, indexes, invoker RPCs,
 forced RLS, service-only grants, actor+household history/export authorization.
- 90-day details/365-day daily aggregates, configurable limits and hourly cleanup.
 Archived exact sums/counts/means; never deletes business/reconciliation evidence.
- Integrated history overview, hourly charts, filters, pagination, local waterfalls,
 mode control, redacted CSV/JSON and full trace JSON, mobile/RTL primary labels.
- Actual vercel/flespi dimensions; direct LAN is visibly future/unmeasured.

## Evidence

117 offline tests, TypeScript, changed-source lint and Next/CI builds pass.
Including the existing shopping-app.tsx in full-file lint still exposes its prior
invite-effect setState error/unused-expression warning; this task changes only
its diagnostics actor/household key. 12 real local PostgreSQL regression groups
pass, including rollback, duplicates, stale writes and current membership.
Six transactionally rolled-back Dev SQL suites verify history/aggregates,
authorization, capacity, retention, read outcomes, backfill and timing boundaries.

Real Edge checks80dbf712 and callback replay07e800a5 pass after Dev key rotation.
Concurrent-actor test1be84869 verifies one commit/one conflict, duplicate MQTT
idempotence and actor-isolated shared-household history. Fault browser5d031f5b
verifies owned MQTT interruption and callback refusal/retry without duplicate
business effects. These are bounded functional checks, not sustained capacity.

Pinned inspector b40501b4 passes fresh-session desktop and Android viewport RTL,
trace/range JSON and CSV exports, Jerusalem chart-hour filtering, viewport fit,
and actual committed Saved with diagnostic HTTP requests blocked. Screenshots
and sanitized traces are in its attempt folder. Physical Android is untested.

Full reliability3172a6d8 passes all 10 groups on application 6db258a: offline ID
preservation, lost acknowledgement, refresh during delayed confirmation,
two-user conflict, stale result protection, rapid edits and same-user offline
cross-tab closure/refresh. Two earlier failed runs are retained. Their failure
was reproduced without telemetry by a new create→update regression: applying a
later result mutated a record shared with immutable queued history.6db258a clones
live-view data while retaining strict immutable checks. The regression failed
before and passes after the fix; no Saved/persistence guarantee was weakened.

## Benchmark interpretation

`performance.md` and overhead6e3df5dd record42 committed UI operations at4e0d421:
trusted DOM click → observed React Saved,14/mode. P50 OFF7109ms, MID7656ms,
ON6273ms; feedback82/86/84ms. P95/P99 suppressed. MID +7.7% in this small sequential
cohort means the proposed 2% target is NOT verified. All14 enabled-mode samples
have durable summaries and browser evidence; ON has 287 spans. A separate
300-operation crossover supports exploratory mixed-workload P95 with its older
automation-action start/client-storage end boundary. Never combine these windows.
No slow operation was excluded. The final correctness clone is not independently
benchmarked; final-source causal overhead remains open.

## Acceptance and next work

Full DoD is INCOMPLETE; keep NAF-197 In Progress. Independent durable Vercel and
gateway phases need a reliable additive handoff rather than response-lifetime
promises. Current Vercel timings are browser-relayed and can be lost with that
browser. Pre-acceptance history needs actor-bound staging without forged outcomes.
Source loss/health across worker restarts, complete attempt attribution, retired
quantiles/period comparison, whole-range version/latency analytics filters,
complete technical translation, representative sustained concurrent/device
benchmarks, long soak, physical Android and backup restore remain open.

Cross-host transit and physical paint are unknown. Post-React frame opportunities
are not hardware paint. Optional browser/worker tails can be lost; headers recover
from gateway facts. Cleanup pauses while the collector is down/OFF, capacity
admission is conservative rather than a filesystem reservation, and no independent
Supabase Dev backup/restore is verified. Debian backups do not cover this schema.

The dedicated listener is healthy, fault injection disabled, mode MID. Original
checkout's unrelated changes are preserved. See final-state.json and gate.json.
Close these NAF-197 gaps before broader NAF-187 benchmarking; keep NAF-198 deferred.

Development security follow-up: a shell status check accidentally printed the
Dev callback signing key. It was treated as exposed and rotated; old verification
keys were removed from Dev gateway/monitoring and feature Preview configuration.
Actual callback/security checks pass with the replacement. Private values are not
in the repository, and no revoked private-key copies remain in runtime files.
See attempts/key-rotation.json. Production credentials were untouched.
