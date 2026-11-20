# Stage 1 transport experiments

Started only after NAF-160 GO/Done2026-11-20T00:54:50.877Z. These are synthetic
Debian-to-flespi transport experiments, not shopping-list application benchmarks.
No Vercel API, PostgreSQL commit, authenticated household request or second phone
is in the measured path. Production resources are excluded.

## Original experiment and reproducibility

Original source: /home/naf-w/projects/self/shopping-mqtt-poc/src/poc.mjs.
SHA256 bd419ce8177efc35650d0b30c7635a8a243ec92a2f18e09a7232a719d611ec89.
Source, README and package lock found; no saved historical raw results found.
Historical600/600,p95=662ms,100/100offline are user/project claims, not new
measurements. Original source/invalid old credential remain untouched.

New scripts use the same synthetic5ms processor and QoS1 request/response shape,
separate child listener, current pinned MQTT5.16.1/Node24.22.3, exact new dev ACLs
and unique private session IDs. Receiver handlers attach before connect so queued
messages are not lost before application setup. Per-operation JSONL includes run
and operation IDs, timestamps, duration and synthetic quantity, never credentials.
Quantiles follow the original script's ceil((n-1)*p) indexing.

From the verified feature worktree, with private Stage0 credential files present:

```sh
node scripts/stage0-preflight.mjs
node scripts/stage1-mqtt.mjs baseline
node scripts/stage1-mqtt.mjs load
node scripts/stage1-failures.mjs
node scripts/stage1-security.mjs
```

The commands are agent-owned runbook instructions. Do not run concurrent suites
against the same namespace. No original .env is loaded. The security suite uses
only the already expired temporary auditor as a negative credential; it does not
require provisioning broad tokens. All exceptions suppress credential-bearing
messages. Artifacts are regenerated; preserve failed raw runs before rerunning.

## Criteria fixed before execution

- Baseline600/600 confirmed,0missing,p95<=1000ms (original README target).
- Offline100/100 eventually confirmed within120second session expiry; report
  outage-inclusive latency separately, never apply online latency target to it.
- Sustained5minutes,10publisher clients and1listener,10simultaneous publications
  every2.5seconds (~4requests/s aggregate),0missing/timeouts,p95<=1000ms,
  p99<=2000ms. Keep below actual50sessions/20000messages per minute. No destructive
  account-limit saturation, paid upgrades or shared session deletion.
- Fault suite: characterize actual failure/recovery with controls and mitigations.
  Expected queue loss after expiry and in-memory state loss after process crash
  are risks to address, not evidence of durable processing.
- Security: invalid/expired broker credentials explicitly refused; current role
  metadata exactly matches directional ACL/account/fixed expiry, administration
  and browser use denied. Reference independent actual delivery controls from
  Stage0 for the same token IDs; successful SUBACK alone is insufficient.

## Fresh baseline result

baseline.json:600/600 confirmed,0missing/duplicates,p50=253.46ms,
p95=326.8ms,p99=356.57ms,max406.04ms;600operations in15.43seconds.
Offline100/100 recovered with resumed session. Outage-inclusive p95=8682.08ms,
including the time spent serially queueing100messages and deliberate downtime.
Baseline meets the original<=1000ms target; exact662ms is not asserted.
Raw records: baseline-operations.jsonl (600online+100offline).

Further load/failure/security results and the explicit Stage1 decision must be
reviewed in Linear NAF-161–165 before Stage2. A PASS here never authorizes
production migration or claims the application's eventual end-to-end latency.

## Sustained load and capacity/cost disposition

load.json:1200/1200 confirmed over300seconds,0missing/timeouts/duplicate results;
p50=198.36ms,p95=316.81ms,p99=590.25ms,max817.45ms. All criteria pass.
Raw1200records: load-operations.jsonl. Actual account snapshots are account-*.json.
Peak sampled sessions13/50 (11test+2pre-existing); messages3376/20000per minute;
traffic935727/52428800bytes per minute; queued session storage0. Samples are
point-in-time, not an exact global maximum. Retained128KiB remained unchanged.
After cleanup sessions returned to the original2; shared sessions were not touched.

Verified operating point:4synthetic operations/s with10backend simulators and
single listener. No higher sustainable capacity,50-session saturation, cold
Vercel function overhead, mobile/cross-network latency or30minute evening soak is
claimed. Result fanout across10subscribers increases broker traffic; production
architecture must avoid leaking results across households and reserve capacity
for reconnect bursts. Transport throughput is not database throughput.

Current Free/SLA0 account stayed within existing limits with no paid plan change;
measured test adds no plan charge. This is not a billing guarantee or proof of
production availability. Hardware/electricity, external backups, Vercel and
future traffic costs remain unmeasured. A paid upgrade requires owner approval.

## Failure matrix and current NO-GO

The first failed run and raw records are retained in attempts/. The current
failure suite records actual expected/observed state with positive controls.

| Scenario | Actual observation | Disposition |
|---|---|---|
| Concurrent duplicate requests |10publishes,1synthetic effect,9duplicate results | Durable operation uniqueness still required |
| Out-of-order completion | Result2 precedes result1; IDs correlate correctly | Use versions/sequence policy for conflicting operations |
| Same-ID replay | Prior result returned, including changed payload index | Bind canonical payload hash; reject conflicting reuse |
| Lost application ACK / timeout | Broker PUBACK succeeded, reply absent; same-ID retry returned prior result | Bounded retries, durable dedup/result lookup |
| Listener process crash before result | Own child SIGKILL; broker session resumes; quantity5 resets to1 | In-memory state is not durable; transactional dedup/outbox required |
| Lost MQTT PUBACK | Actual first delivery unacknowledged; reconnect redelivers same packetID with DUP=true | At-least-once requires business operation IDs |
| Broker disconnect | Own client-ID takeover closes old connection, reason142 | Enforce unique listener ownership; no shared broker restart |
| Session expiry |2s requested, queued work still delivered after3.5–4s; own session still present after66.59s | FAIL/unresolved; no Stage2 GO |

Wire DISCONNECT sessionExpiryInterval2 and owner-authorized GET of ONLY the new
test session show an expiration UTC timestamp already passed, yet sessionPresent
remains true. Samples at0/6.5/16.7s and0/6.5/66.6s are retained in
attempts/expiry-metadata*.json. No credential contents or other sessions were
queried. Metadata survival after66s does not alone prove message delivery after
66s; direct queued-message delivery was observed after4s. The distinction is
preserved. No assertion that all future expiries fail or that the cause is a
confirmed provider bug is made.

**Stage1 decision: NO-GO for Stage2 while NAF-162 is incomplete.** Clarify the
broker's observed expiry behavior and verify an application command-validity
mitigation (signed expiry/audience/body and durable replay controls) before
accepting delayed work. Do not silently redefine the failed expectation as PASS,
use production credentials or start backend implementation around the gate.

## Security result

security.json: invalid credential and expired own auditor both receive MQTT134
and HTTP400/code1004, explicitly refused rather than timed out. Current dedicated
role IDs/account/ACL/fixed expiry/ttl reconfirmed; admin and browser-origin403.
Stage0 independent positive/negative delivery tests reference the same token IDs.
TLS verification remains enabled. No new tokens or account scopes were required.
The simulator is not a household authentication or durable replay implementation.
See ../stage0/auth-plan.md and security.md for the required trusted-identity plan.

Official behavior references (actual observations above remain authoritative for
this run): https://flespi.com/mqtt-broker and live schema
https://flespi.io/mqtt/api.json (expires is a session expiration UTC timestamp).
No external support message or billing/plan change was made.

## Expiry and replay follow-up (2026-11-20 03:45 UTC)

The subsequent controlled tests of delayed cleanup and CONNECT/DISCONNECT expiry
interpretation are documented in [expiry-hypotheses.md](expiry-hypotheses.md).

NAF-162 remains In Progress and NAF-165 remains **NO-GO**. The original failed
session-expiry assertion in failures.json and its script is unchanged. A separate
Stage 1 synthetic harness now distinguishes three independent properties:

| Property | Fresh evidence | Decision |
|---|---|---|
| Session expiry, requested 2 seconds | Session resumes and queued command without message TTL arrives after 4.442 and 70.418 seconds | Original expectation still FAIL; root cause unconfirmed |
| MQTT message expiry, set to 2 seconds | Message absent after both waits; fresh allowed controls arrive | Observed defense in depth, not command authorization |
| Signed application deadline | Expired queued envelope rejected; zero synthetic effects | PASS for this isolated experiment |

Unlike the earlier 66.59-second metadata observation, the new 70-second probe
directly observes queued-message delivery. Two live runs independently reproduced
delivery after roughly 70.4 seconds. This does not establish a universal retention
duration or prove a provider bug. No broker/session administration API, shared
session, new token, retained publication or production resource was used.

Reproduce from this worktree, with preflight/provider evidence current:

```sh
node --test scripts/stage0-preflight.test.mjs scripts/stage1-validity.test.mjs
node scripts/stage1-expiry.mjs
```

The second command generates an immutable run directory under attempts/ and a
private synthetic ledger under .stage0-runtime/. It takes about 90 seconds and
logs progress every 20 seconds. Do not run it concurrently with another broker
suite. It uses only the existing dedicated dev publisher/listener tokens, whose
fixed expiry remains 2026-11-26T18:56:34Z; validity is checked before connecting.
No .env loader is used. Any credential-bearing errors are suppressed.

Raw evidence:

- attempts/expiry-126e9137-17bd-45da-83da-6ae69c48c14b/report.json:
  sandbox DNS denial (EAI_AGAIN), no scenario completed.
- attempts/expiry-48f4f4d4-6ffe-4832-8ca1-5428651ea461/report.json:
  both delivery/TTL/deadline probes completed; subsequent child startup failed.
  The child argument `worker` collided with stage1-mqtt.mjs's import-time worker
  dispatch. Corrected to `validity-worker`; the failed run is preserved.
- attempts/expiry-3f58890f-28eb-42ac-a557-c95506ced766/report.json and
  decisions.jsonl: complete corrected run, mitigation_status PASS, status NO-GO.

The experiment signs an exact version/audience/operation ID/issued time/deadline/
body using a fresh per-run Ed25519 key kept only in parent memory. Listener uses
the public key. A canonical digest binds the same ID to the same complete command;
missing signatures, tampered deadlines, wrong audiences, future issue times and
expired commands are rejected. Strict body validation also rejects modified body
shapes/values. Expiry is checked before cached replay lookup and immediately
before the synchronous synthetic effect, with a conservative 250ms margin.

An append-only, fsynced, single-writer journal row IS the synthetic effect. After
an actual child SIGKILL following fsync and before its modeled application reply,
a new process reloads quantity 1; replay returns duplicate/quantity 1, while
conflicting reuse is refused. Fresh allowed controls still execute. Replaying a
previously accepted short-lived operation after its deadline returns expired and
leaves quantity unchanged. Unit tests additionally reject a torn journal on
startup and detect large wall-clock steps. All 58 guard/validity tests pass, as
does lint of the changed scripts. Sandbox restrictions initially suppressed one
existing guard test's child stderr; the unchanged suite passes outside sandbox.

Limits: this is not a PostgreSQL implementation, transactional inventory/outbox,
multi-writer store, household authentication or a browser response path. IPC
observations model an absent application reply; no end-to-end response guarantee
is claimed. Fsync+SIGKILL demonstrates process recovery, not power/disk-loss
recovery. Trusted initial clock accuracy is not proven by step detection; 250ms
is a test margin, not a measured cross-host skew bound. Unknown signer keys,
key rotation, replay-record retention and clock-health integration need explicit
design and verification before real application integration. Expiry cannot undo
a committed effect; a timed-out client must query operation status rather than
minting a new ID and assuming the first request failed.
The signed deadline is an admission check before the journal append; it does not
promise that an fsync or a future database commit finishes before that deadline.

Read-only cleanup snapshot account-after-expiry.json records 2 sessions and zero
queued storage after cleanup. Retained storage is 64KiB, compared with 128KiB in
the earlier Stage 1 snapshots. No before-this-run snapshot was taken, so this
change cannot be attributed here. The harness never sets retain=true or uses a
retained-message deletion API; unrelated account data was not investigated.

The [provider's MQTT checklist](https://flespi.com/mqtt-broker) describes message
TTL for queued/retained data separately from sessions. Its
[MQTT API guide](https://flespi.com/mqtt-api) describes persistent sessions, but
neither source establishes why these 2-second sessions resume past the observed
boundary. These sources informed the separate probes; they do not resolve the
failed assertion. Next work must resolve the session-expiry semantics or a
reviewable gate disposition satisfying the original criteria. No failed check
has been waived, no external support message was sent, and no Stage 2 work began.

Rollback: revert only the new harness/core/tests and their CI additions if needed;
retain raw failed/successful evidence. No service, schema, environment or provider
configuration change needs rollback. Preserve private runtime ledgers with the
other excluded experiment state; never upload them or any credentials.
