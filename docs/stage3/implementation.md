# Development integration implementation and evidence

The implemented primary path is real Supabase Dev browser session → development
Vercel API → durable development command metadata → flespi QoS1 command → Debian
PostgreSQL atomic business/result/outbox commit → signed outbound HTTPS callback
→ durable metadata result → authenticated browser polling and household snapshot.
The API never needs an inbound Debian port. Production remains excluded.

## NAF-173: acceptance and publishing

app/api/stage3/route.ts delegates to integration/stage3/server.mjs. Every enabled
deployment must match Preview, the allowed feature/develop refs, repository owner/
name, development Supabase URL, project ID and dedicated command topic. The
SHOPPING_STAGE3_ENABLED flag and server-only JSON configuration were created only
for feature/flespi-home-backend Preview. The baseline develop URL and production
configuration were not changed. Feature Preview alias was independently obtained
from the existing deployment record, not guessed from the branch name:
https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/

Browser bearer sessions are verified online; the selected household is a selector,
not authorization. Exact intent schema and shared typed operations impose UUID,
version, allowed-operation and payload bounds. Origin checks deny cross-origin
browser requests; no CORS permission is added. The request stream is bounded.
No MQTT credential is public. A fresh MQTT TLS connection publishes QoS1 with
remaining expiry at most300s; the server bounds connect/publish time and never
claims PUBACK proves a business commit.

The gateway Edge Function verifies the complete command signature and real
identity before invoking a service-only atomic acceptance RPC. A per-user advisory
lock serializes acceptance/deduplication and limits new operations to60/minute.
The durable table has forced RLS, no anon/authenticated table privileges, and no
client policy. Privileged credentials stay inside the development Edge runtime.
The accepted tuple/hash is immutable through the public adapter. Same-ID/same-hash
retry returns the existing acceptance/result; changed intent conflicts. The API
returns202 only after durable insertion. A publish timeout leaves accepted_pending;
Debian's signed outbound reconciliation reads the store and retries execution.
This covers death after insertion but before publish, without Vercel memory.

Statuses are derived from durable facts: requests rejected before insertion;
accepted_pending before execution; processing, failed_retryable or
reconciliation_required from separately signed Debian progress; and
reconciliation_required after deadline without proof. Progress is durably ordered
by its signed timestamp and cannot replace a terminal result. Committed,
validation/conflict/expired/forbidden states require authoritative results. A
pending row is not evidence that no execution is in flight. Retryability preserves
the original ID and intent.

## NAF-174: execution, callback and recovery

The existing restricted PostgreSQL roles, transactional operation ledger, forced
RLS, household lane locks, local membership checks, expected versions and durable
outbox are reused. V2 snapshot/status replies also gain durable result/outbox
records. The separate shopping-list-stage3-backend user service keeps Stage2's
existing fixture service available; PostgreSQL stays on127.0.0.1:55439. Service
limits are512MiB/20%CPU/96tasks/0077umask/NoNewPrivileges. There is no inbound API.

Debian callback identity is a separate Ed25519 key and pinned issuer/audience.
Each retry signs a fresh timestamp/delivery UUID. Both Vercel and the durable
gateway verify it. The gateway matches the previously accepted full tuple; its
atomic RPC locks the record, permits equal duplicate results and refuses a
different terminal result. Caller-supplied callback URLs are never accepted.
Callback delivery is independent of MQTT connectivity and browser connectivity.
Outbox attempts are persisted before sending and delivery is recorded only after
the callback endpoint has durably stored the result.

Vercel Deployment Protection remains enabled. HTTPS attaches an origin-scoped,
short-lived Preview OIDC token, separately from the callback signature. The
existing owner CLI login can refresh the feature Preview token on platform
rejection; tokens remain in owner-only ignored files. Loss of owner CLI access
leaves results queued, not falsely delivered. This POC operational dependency
needs a deployment identity decision before unattended long-term operation.

When current identity verification fails, the listener does not manufacture a
terminal forbidden result: an earlier commit may already exist with a pending
outbox callback. It leaves the acceptance requiring reconciliation, while the
independent outbox still delivers any prior authoritative commit. This prevents
a logout/provider outage from downgrading an already committed operation.

## NAF-175: browser proof

/stage3 is a flag-gated development proof page, leaving the original app route
available. It uses the chosen simple login, household selector and existing
Supabase session refresh/logout. Its scoped localStorage queue persists immutable
operation IDs, correlation IDs, intent, version and deadline before rendering
optimistic changes. Storage failure refuses the change. Status polling marks
Saved only for committed results; offline requests retain their IDs. Conflicts
are explicit. Expired unresolved requests remain in reconciliation state; the
Reconcile action asks Debian's authenticated operation.status under its household
lane. A not_found result after the original deadline can then show Failed; a
found result recovers the original authoritative outcome. New intent requires a
new deliberate user action against current versions.

Household snapshots use authenticated polling, with bounded per-household
requests and no long-lived Vercel process. Only equal/newer household revisions
are applied. Per-record versions prevent an old saved result overlay from
overwriting newer records. Separate devices converge through the same PostgreSQL
snapshot, without assuming ordered notifications or a connected initiating tab.

Actual browser report browser-32a26432-abc6-468e-910f-afee09e1c736.json passes9groups:
two independent real sessions; offline while commit; reconnect to Saved; second
device sync; repeated polling without duplicates; refresh while pending with same
ID; simultaneous quantity changes yielding one commit/one visible conflict and
convergence; refresh after conflict; other-household browser isolation. The
associated PNG is a real Chrome screenshot. Confirmation was7203ms for that
single observed browser operation, not a percentile benchmark. An earlier browser
run failed because the harness queried with its expired saved session even though
the operation committed; it is preserved as browser-57d7d2d7…json.

## NAF-176: fault evidence

scripts/stage3-failures.mjs writes each case to JSONL and a final uniquely named
report. The bounded owner-only test control is disabled by default and was reset
to disabled after each suite. It cannot be set by browser/API input. The original
PostgreSQL PID was preserved throughout both suites.

Quick suite failure-de7a6b8e-0b18-4a54-86c9-2cd747cca7e8.json:8PASS. Bad MQTT
credentials were actually denied by the broker with zero database effects.
Simultaneous duplicate API requests, lost incoming MQTT ACK, pre-commit SIGKILL,
post-commit/pre-callback SIGKILL, one failed transaction and retry,15s controlled
callback refusal, and expired command all passed. Every committed intent has one
business effect and one ledger row. Crash confirmation times were16.774s/14.046s;
lost-ACK confirmation5.667s, transaction retry8.760s. Callback refusal produced
12outbox attempts and one effect. The22s owned-stream expiry case produced zero
business effects and an authoritative expired result.

Network suite failure-e977c762-6fc0-4cc9-8b4e-bcc12992839d.json:4PASS. These are
controlled owned MQTT TLS stream refusals plus paused callback/reconciliation,
using the real broker/API/database. No router, ISP, host firewall or production
network was disrupted. Each scenario also verifies a fresh control afterwards.

| Requested interruption | Early outcome | Business effects | Confirmation after unblock, including fresh control |
|---|---|---|---|
|5s|committed|1|11.266s|
|60s|committed|1|12.079s|
|290s|committed|1|14.091s|
|480s|expired|0|21.128s|

The480s scenario also published a later still-valid operation, which committed.
The early expired message was resolved from durable acceptance by reconciliation,
not assumed delivered by MQTT. The table's measured recovery includes confirming
the early outcome and fresh control; it is not pure MQTT reconnect latency.

The final quick rerun fa5977f8-07b5-4414-8625-2c831adc7d71 passes all8groups with
durable progress enabled. Database failure is observed as failed_retryable →
processing → committed. Callback refusal is22s/20outbox attempts; an older signed
progress message is ignored. Crash confirmation times are15.687s/16.723s; lost
ACK7.588s and transaction retry9.388s. This is a corrective status-feature rerun,
not a relabeling of the earlier suite.

Callback report callback-290cb3fd-4c49-49d8-a0a8-002b84aa521b.json passes5actual
Preview tests, including immutable committed outcome under a conflicting later
signed callback. The initial callback check386bdefc used an expired test session
and is preserved as FAIL. The expired-session rejection was expected security
behavior; the harness was corrected by obtaining a fresh provider session.

The original Stage2 actual SQL regression suite also passes all12groups after
the shared changes: attempts/stage2-regression-a09eb348-bcd9-4a17-b754-2f65cd153201.json.
Offline guard/protocol tests passed70groups before adding the2server guard tests.
The final checks/rollback/latency evidence will be attached to the gate.

## Operational limits for the gate

Google has intentionally not been configured. Household onboarding/invite parity,
provider-independent subject mapping, realistic pagination/snapshot limits, durable
metadata retention/cleanup, deployment identity without owner CLI dependence and
operational key rotation are later obligations. The current snapshot callback
limit is256KiB and command limit16KiB. No claim covers large households or
indefinite offline home-server availability. Supabase stores acceptance/results
and remains the chosen test identity provider; removing it requires replacing
those explicit adapters. No Supabase infrastructure was removed or production
data migrated. Long outage tests are controlled faults, not real ISP failures.
