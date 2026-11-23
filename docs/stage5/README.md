# Stage 5 development observability — persistent monitoring, acceptance still incomplete

NAF-197 remains incomplete. No Stage 5 gate, production readiness, or <2% overhead
claim is made. This work is only on feature/flespi-home-backend; PR16 stays draft.
No direct LAN or Debian frontend implementation is included.

## Architecture and security

The existing operation/correlation IDs and commit-based Saved semantics remain.
An additive acceptance trigger snapshots the global runtime mode with one local
settings read. It never writes a telemetry record or invokes an external service;
its exception boundary cannot reject acceptance. All optional storage runs in a
separate collector timer. Vercel has no fire-and-forget telemetry promise.

The separate `dev_monitoring` schema is in **Supabase Dev PostgreSQL**, not Debian
PostgreSQL. This deliberate boundary reuses the reachable durable gateway without
opening a Debian inbound port or adding infrastructure. Debian business data,
ledger and result outbox remain unchanged. Optional local Debian measurements are
batched to the same independent authenticated Edge endpoint.

The schema has settings, operator allowlist, mode audit, operations, immutable
source records (metrics/spans/attempts), aggregates and collection health. Every
source record has immutable record/operation/correlation IDs. All private tables
have forced RLS and no public schema/table access. Service-only invoker RPCs are
called after online provider user AND current-session verification, or dedicated
Ed25519 signed batch validation. The telemetry signature binds action and payload.
Raw shopping contents, bearer tokens, credentials and personal fields are excluded
by a closed schema. Auth IDs are internal authorization bindings and removed from
query/export responses. Queries and exports expose only a configured operator's
own actor AND selected household records. They do not expose a whole household to
another actor; a removed member retains only their own prior diagnostic evidence,
matching the existing gateway's own-operation status access model.

Only the two existing synthetic development tester accounts are initial operators;
the third account is deliberately unauthorized. Configuration is server-side,
never user metadata. Production Vercel gates deny the API before reading the body.
The dedicated Edge function is pinned to the exact Dev project. Its platform JWT
check is disabled because it accepts both signed Debian traffic and browser
sessions; the handler independently authenticates both paths. Existing gateway
configuration and Deployment Protection were not weakened.

## Runtime modes and batching

Exactly OFF / MID / ON, persisted globally in Dev settings with actor/time audit.
MID is the initial default. OFF rejects ingestion and stops summary derivation
immediately. Config polling remains necessary for runtime re-enablement. Browser
mode cache TTL is 10 seconds, checked on a 5-second timer; I/O and scheduling can
delay refresh. Debian polls on a 5-second timer. The server rejects OFF ingestion immediately.
OFF advances an epoch: delayed old batches cannot reappear after re-enabling.
Turning OFF during an operation deliberately leaves a partial historical trace.

MID derives a compact row for every durable accepted business operation, including
pending/failing/conflicting/expired outcomes, independently of browser survival.
Internal snapshot/status commands are excluded. ON adds source-local spans for
all observed operations; there is no intentional sampling. Both modes use the
same asynchronous batch buffer. Debian: capacity 500, batch 50, flush 5s. Browser:
capacity 200 per user/household/client, batch 50, flush 5s. Both buffers also cap
each serialized batch at 96,000 UTF-8 bytes before transport; byte sizing runs
only in the asynchronous flush task. Oversized/unserializable records are dropped
and counted, so one bad event cannot block the delivery lane. Limits can be configured
in the buffer constructor / collector options; dashboard configuration of limits
is not implemented. Overflow drops optional measurements, increments counters,
and never alters the business outcome. Failed/unacknowledged delivery retains the
same immutable IDs. Server-side IDs deduplicate retried batches. Source records
are capped at 100 per operation. Telemetry capacity defaults: 10k operations /
30k source records with conservative 32 MiB storage admission; reaching the cap rejects optional history, not shopping writes.

Browser timestamps and capture use performance.now. JSON/localStorage/network
work runs on the independent flush task. Per-record scoped storage keys permit
concurrent-tab delivery without replacing another tab's queue. Buffered uploads
retry with a current matching session. Page-hide and collector disposal attempt a local queue snapshot; abrupt process
termination before a flush can still lose optional client measurements. Local
storage exhaustion also loses persistence. No persistence is claimed without acknowledgement. Browser history
itself comes from PostgreSQL and survives refresh/logout/testing sessions.
Debian optional in-memory spans can be lost on crash/restart; durable operation
summaries can be recovered from gateway facts. This is explicitly a partial trace.

## Retention and backup

Default 90-day operations/source records, 365-day daily aggregates, configurable
within capacity bounds in settings. Hourly collector maintenance aggregates old
volume/outcomes/callback receipt counts, then deletes only monitoring operations
(and cascading optional records). It never deletes gateway or business evidence.
The timer runs in the dedicated Debian process; no cleanup runs while it is down
or monitoring is OFF. Capacity caps remain in force after restart. Aggregates preserve exact latency sums/sample counts and daily means, plus volume and outcomes; detailed quantiles are not reconstructed after retention. The schema uses standard PostgreSQL tables/indexes/functions, but Supabase Dev
backup coverage has not been verified. Existing Debian business backups do not
include this schema. Independent observability restore rehearsal remains unverified.

## UI and clocks

Integrated into root home-backend Save details area for authorized operators.
Supports 24h/7d/30d/90d/custom UTC bounds; route/mode/type/outcome/UUID filters;
pagination; build/latency history filters; full-range hourly median and outcome metric bars; operation
metrics/local waterfalls; redacted full-range JSON/CSV (5 MiB limit). Layout supports narrow
screens and RTL, with translated primary labels. Some technical labels remain
English. Direct LAN is clearly future/unmeasured and has no implementation.

Statistics and trends cover the whole authorized filtered date range in PostgreSQL,
independent of the 200-row history pagination. Version/latency filters currently
apply to history/export only, not the aggregate tiles. P95 requires 100 samples;
P99 requires 1000. A rollback-only 250-operation fixture verifies full-range counts,
duplicate source evidence, percentile interpolation, route isolation and access.
Exports paginate with fixed time bounds and fail explicitly above 5 MiB.
Client notification and post-React-commit frame opportunities are separate metrics.
Two animation frames after the status component's commit provide optimistic and
Saved frame evidence; this is not a hardware paint timestamp. Background documents
omit frame evidence. Saved does not wait for telemetry or frames. Tap→client Saved
is recorded only for locally observed committed outcomes, with one document's
monotonic clock. Refresh loses that timeline and does not invent a duration using
clocks from different pages. The verified Vercel API build SHA is carried in browser records; stale-tab frontend bundle versions are not independently tagged.
Vercel high-level timings relayed by the browser are client-reported provenance,
not an independently durable server trace. Cross-host transit remains unknown.
Spans overlap and are never summed to create an end-to-end total.

## Open acceptance work

- Complete independent durable Vercel phase evidence; gateway internal spans;
  listener broker/parser queue; outbox queue; callback durable
  write; browser full-snapshot reconciliation detail and exact hardware paint confirmation. The parent DB metric spans
  pool wait through transaction completion including rollback; separate pool, lock
  and COMMIT acknowledgement spans are now recorded. A duration alone is
  not proof of a committed business outcome. Durable outcome is the proof.
- Capture pre-acceptance rejection/offline-never-accepted history safely without
  confusing browser reports with authoritative business outcomes.
- Persist detailed attempts and collector loss/health across process restarts;
  detect absent source batches, not only buffer overflow/missing operation rows.
- Retired latency distributions/quantiles, period comparison, richer retry/attempt attribution,
  slowest-stage diagnosis, whole-range version/latency statistic filters and complete translation.
- Representative concurrent-device OFF/MID/ON CPU/memory/network/database
  write-volume benchmark, valid tail samples, independent storage-failure recovery,
  extended soak/capacity audit, Android device and independent backup rehearsal.

These are incomplete requirements, not passes. The bounded Stage 5 reruns are
listed below; older Stage 4 reports remain prior evidence.


## Executed evidence and handoff

See [HANDOFF.md](HANDOFF.md) for the current application SHA/verified Preview,
117 offline tests,12 PostgreSQL regression groups, six Dev SQL suites, live
mode/security/callback tests, all 10 browser reliability groups, pinned desktop/
Android viewport RTL inspector and failure checks. Prior failed attempts are
retained. Create→update validation exposed a pre-existing shared-object mutation
of immutable queued results;6db258a clones live-view data and keeps the checks.

[performance.md](performance.md) separates the100-operation/mode crossover from
the corrected14/mode trusted-click cohort. The latter's MID median is 7.7% above
OFF; the proposed 2% overhead target is not verified. Detailed historical source
coverage and counters are retained, including missing browser uploads. The
correctness clone's final-source overhead is not independently benchmarked.

Mode is restored MID; fault injection disabled; dedicated listener healthy.
NAF-197 remains In Progress and gate.json records partial acceptance. Dev signing
key rotation and its passing callback checks are documented in attempts/key-rotation.json.
