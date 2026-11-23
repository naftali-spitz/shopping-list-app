# Revised Stage 1 recovery acceptance (owner instruction 2026-11-20)

The two-second session-expiry investigations stay recorded as failed diagnostics.
They are superseded as a gate requirement by actual shopping-list recovery needs;
they are not rewritten as passing tests. Stage 2 remains blocked until NAF-165
records the new evidence-backed CONDITIONAL GO and is Done.

## Live matrix protocol

`node scripts/stage1-recovery.mjs` uses messageExpiryInterval300 seconds and
sessionExpiryInterval1800 seconds, QoS1, retain=false, unique dedicated dev IDs
and the existing exact commands/results ACL tokens. The configurable
SHOPPING_POC_MESSAGE_EXPIRY_SECONDS defaults to300; exploratory other values cannot
produce acceptance PASS. Nine listener sessions run in one suite, below the
verified50-session limit; bodies/operation counts are deliberately tiny relative
to storage, traffic and20000messages/min limits. Actual pre/post account snapshots
are retained. CONNACK expiry overrides smaller than900 seconds fail setup.

Faults destroy only owned TLS sockets. MQTT.js retries automatically every1s;
the owned stream factory refuses connections during the requested interval and
then permits real TLS connections again. No manual reconnect is called. This is
a live-broker synthetic client-network interruption, not an ISP/router outage or
host firewall experiment. Every receiver installs handlers before reconnect.

For each5/15/30/60/120/240/290/310/480-second interruption, publish10 early unique
operations while disconnected plus2 late operations approximately1.5s before the
network is restored. Publish a fresh control after automatic recovery. Record
each send/PUBACK/receive timestamp, message age, remaining MQTT expiry property,
session-present flag, missing/duplicate/order observations and recovery latency.
Late messages remain valid even when the outage exceeds300 seconds.

At5–290 seconds, every individually valid operation must arrive and normal
operation resume. At310/480 seconds the early expired operations must not be
applied; late valid messages and the new control must arrive. Expiry age is
calculated from each publication, never simply from outage duration. A further
owned clean-start reconnect deliberately loses its session; unresolved IDs must
be identified and same-ID resends recovered while still valid.

The receiver's application deadline is independent of broker queue removal.
MQTT PUBACK records transport acceptance only, not PostgreSQL commit. No message
expiry failure notification is assumed. Original baseline/load/fault/security
evidence is reused instead of repeating those investigations.

## Required application reconciliation and Stage 2 obligations

The future frontend/API persists a pending-operation ID, canonical payload hash,
authenticated identity/household, expected record version, validity and response
correlation before reporting a request as pending. It never reports saved on
MQTT PUBACK. After timeout/reconnect it performs authenticated status lookup and
authoritative state synchronization. A committed ledger result is returned even
if the transport reply was lost. A still-valid uncommitted operation may retry
with the same ID. Renewal after expiry requires confirmed not-found/rejected
status plus current-state/version checks and an explicit conflict policy, never
blind fresh IDs or an automatic silent overwrite.

PostgreSQL must enforce current membership, typed payload validation, global
operation-ID uniqueness bound to canonical logical payload, record versions,
transactional business changes plus stored result/outbox, and crash recovery.
Expired commands may not mutate inventory. A committed effect is never undone
merely because its message/reply later expires. Status and synchronization reads
must recheck current permissions, including revoked membership.

Later Stage3–5 must verify real dev authentication, Vercel API/callback routing,
durable pending/results storage, optimistic UI reconciliation, cross-device
authorization/synchronization, real network interruptions, clock health/skew,
issuer/key rotation and full end-to-end commit/response latency. Stage1 synthetic
transport success is not evidence those paths already work.
