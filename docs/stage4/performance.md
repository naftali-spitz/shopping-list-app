# Stage 4 observed responsiveness

The app updates optimistically and keeps pending state until an authoritative
PostgreSQL result. Save confirmation is still several seconds; no subjective
speed target or production SLO is declared passed. Tests support a functional
POC and a measured improvement, with the limits below.

## Windows and cohorts

All values below are milliseconds. Original Supabase Dev uses the real develop
UI and authenticated PostgREST write acknowledgement. Experimental uses the real
root UI and observed committed-result/Saved state. These are authoritative but
different architectures/windows, not MQTT-only latency.

| Operation | Supabase n / median DB HTTP ack | Home before n / median Saved | Home after n / median Saved | Home after median visible feedback |
|---|---:|---:|---:|---:|
| product.create | 10 / 524 | 3 / 11803 | 3 / 7809 | 262 |
| product.check | 11 / 549 | 4 / 10202 | 4 / 7556 | 260 |
| product.uncheck | 10 / 518 | 3 / 10762 | 3 / 9241 | 266 |
| product.quantity | 10 / 403 | 3 / 12044 | 3 / 5747 | 110 |

Before/after home runs used the same Debian machine, headless Chrome desktop,
own synthetic lists, n3 per main edit type (n4checks), same pacing and no other
functional browser suites. Before served6c416f2; after served7ab774d. The baseline
original run was on the previous day at unchanged develop88af186 and n10 per
main operation (n11checks). Network/free-tier conditions are uncontrolled; do
not interpret the cross-backend comparison as a controlled causal benchmark.
The earlier22operation home run overlapped functional suites and is labelled
loaded; it is retained separately and excluded from the solo comparison.

Small cohorts support observed medians only. No reliable P95/P99, sustained
capacity, availability or general-population latency claim follows. Stage3's
single10.140screate and twelve accepted-to-confirmed observations remain
separate evidence; Stage1MQTT-only317msP95 is not a browser save metric.

## Trace-supported changes

1. Keep both live provider checks, but overlap independent getUser and current-
   session RPC calls and require matching verified identities. This applies at
   Vercel, the signed durable gateway and Debian. No admission cache, authentication
   bypass or weaker expiry/member rule was added.
2. A complete contiguous product/category result patches the known snapshot;
   avoid an immediate redundant full snapshot after every such save. Revision
   gaps, list/history effects, category deletion and explicit refresh still fetch
   full authoritative snapshots. The revision floor remains mandatory.
3. Keep immediate durable optimistic overlays, per-operation local storage for
   simultaneous tabs, serial expected versions and no duplicate action sounds.

The after cohort's measured Vercel handler medians: {"authentication_ms": 655, "durable_gateway_ms": 756, "mqtt_ms": 377, "handler_ms": 1634}.
Local Debian trace medians: {"authentication_ms": 366, "database_ms": 7}. These are local monotonic durations;
publish/receive/callback timestamps across hosts include clock uncertainty.
Same operation/correlation IDs link browser samples, Vercel acceptance/publish/
callback and Debian receipt/database/outbox events in correlated-traces.json.

The sample field database_commit_at comes from the PostgreSQL ledger's
committed_at DEFAULT now(): it marks the transaction timestamp, not an exact
wall-clock COMMIT boundary. The listener's operation_result occurs after COMMIT;
database_ms spans execution through commit. Do not subtract cross-host timestamps
to invent precise commit/network latency. Callback duplication/outbox retries are
safe and visible; direct callback success can precede outbox delivered_at marking.

## Remaining bottleneck and concrete next work

The client still serializes mutation/status work with snapshot retrieval. A user
intent arriving while a snapshot command/status request is in flight waits even
when its optimistic UI is already visible. Some provider/gateway invocations also
show seconds of variable latency. New MQTT connections contribute a measured
bounded part. Under concurrent browser suites periodic snapshots increase the
single listener lane's verified work; this is not a capacity test.

Next optimization: separately schedule snapshot read/status retrieval from the
serial mutation lane, retaining minimum revisions, per-record versions, identity
cancellation and bounded requests; add delayed/out-of-order/error tests before
turning it on. Evaluate targeted/delta snapshots and safe bounded publisher
connection reuse only after measuring them. Do not relax current session checks,
durable acceptance, commit confirmation, replay protection or idempotency.

First-browser-context and warm reload timings are in both raw reports. Actual
platform cold-start state is unknown; no controlled cold-instance result is
claimed. Stage5must sample explicit cold/warm invocations, realistic simultaneous
users, longer runs, quotas/metadata retention and field-network conditions before
setting performance acceptance targets or tail-percentile claims.

## Raw evidence

- attempts/baseline-performance-81b0cdbc-dd2d-4e2c-a0e8-dce3c9968aa1/
- attempts/performance-5e56cd02-5c95-4ee9-a6fc-74f84e5349ac/ (solo before)
- attempts/performance-1a018cc5-c7a4-4391-a962-6f52077a7547/ (solo after + correlated trace)
- attempts/performance-fdd9d194-4425-4d9c-9370-a37f28b9e3a6/ (concurrent suites)
- attempts/vercel-acceptance-before.jsonl
- attempts/shared-client-snapshot-optimization-20261121.log
- attempts/auth-overlap-tests.log

The raw before/loaded reports' sha field records the harness checkout, not the
served deployment. The after script records harness_sha and actual deployment
separately. Deployment provenance above uses the verified alias/CI records.
