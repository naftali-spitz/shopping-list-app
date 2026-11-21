# Stage 1 session-expiry hypotheses

User requested tests of two possible explanations: delayed broker cleanup and
different interpretation of expiry settings. Neither explanation is accepted
as a root cause in advance. Original failed assertions and raw results remain.

## Protocol fixed before measurement

Run `node scripts/stage1-expiry-hypotheses.mjs` from the verified feature
worktree after preflight passes. This is one suite, with multiple unique owned
sessions, using only the existing dedicated publisher/listener tokens. It takes
about seven minutes including setup/cleanup. No application/database effects,
production access, shared-session administration or retained publications.
No environment loader is used. New immutable result directory under attempts/.

The two hypotheses have separate probes:

1. **Delayed cleanup:** establish three sessions with expiry 2 seconds in both
   CONNECT and DISCONNECT. Keep them offline without reconnecting until 90,
   360 and 360 seconds. The first two receive read-only metadata observations;
   the last receives none, providing a control for possible observation effects.
   A fresh reconnect is used only at each final boundary. Record whether the
   old subscription/session resumes and the original queued marker arrives.
   Survival at 360 seconds refutes cleanup within that observed window, but
   cannot disprove a longer cleanup cycle. Disappearance only at a later boundary
   supports delayed cleanup without establishing its implementation or period.

2. **Expiry interpretation:** compare the following distinct sessions. Each
   waits at least 5 seconds after disconnect. Capture whitelisted CONNECT and
   DISCONNECT properties, any server CONNACK expiry override, own-session
   metadata and actual queued-marker delivery. A fresh allowed marker must arrive
   in every case, so absence of queued work is not mistaken for a broken receiver.

| CONNECT expiry | DISCONNECT expiry | Expected old session/backlog at 5s |
|---|---|---|
| 0, Clean Start=true | omitted | absent (clean-session control) |
| 2 | omitted | absent |
| 2 | 2 | absent |
| 120 | omitted | present (persistence control) |
| 120 | 2 | absent (shortening) |
| 2 | 120 | present (extension) |
| 120 | 0 | absent (explicit deletion) |
| 2 | abrupt own socket close, no DISCONNECT | absent |

All observation reconnects use Clean Start=false and request a new 120-second
interval, recording actual Session Present before resubscribing. This reconnect
setting is not part of the preceding offline interval. Each observed session is
then disconnected with expiry 0. Final cleanup also uses Clean Start=true/expiry0
for only IDs created by this run. It never enumerates or clears shared sessions.

Metadata reads use an existing intended flespi browser page, keeping its account
credential inside that page. Requests address only session IDs returned for this
run's own MQTT connections, and whitelist safe fields. If metadata access is
unavailable, it is explicitly recorded; direct MQTT probes remain authoritative.
Packet observations whitelist control fields, never username or full packets.

Positive/negative controls permit comparison; they do not by themselves prove
whether a discrepancy originates in the broker, negotiated policy, or a client
interaction. A server override, if returned, must be considered before treating
a requested interval as the effective interval. Unexpected control failures keep
the experiment unresolved. No result automatically changes the Stage 1 gate.

Rollback: revert this harness and its CI lint entry if needed; preserve raw
evidence. No provider configuration, schema or service change is involved.

## Results

Completed 2026-11-20, run 59b8e898-4939-498c-b4cb-ceee41e23ed3. Raw report,
whitelisted packet/events log, source hashes and account counters are under
attempts/expiry-hypotheses-59b8e898-4939-498c-b4cb-ceee41e23ed3/.
Base HEAD was ccb8ef3; provenance.json hashes the actual new harness source.

### Delayed cleanup

| Offline duration | Old session present | Original queued marker delivered | Fresh allowed control |
|---|---|---|---|
| 90.052s | yes | yes | received |
| 360.390s, untouched twin | no | no | received |
| 361.814s, metadata-attempt twin | no | no | received |

These are separate, equivalently configured sessions established close together,
not repeated reconnects of the same session. They support delayed removal of
expired persistent state as the leading explanation: stale state can survive
90 seconds but was gone in both six-minute probes. They do not establish a
universal 90–360 second bound, exact sweep interval, scheduled cleanup task,
minimum retention policy, or confirmed broker implementation defect.

The selected existing browser page had no usable metadata authentication;
attempts explicitly record unavailable, and no new login was requested. Thus
neither six-minute probe obtained session metadata. The named observed/untouched
twins differ only in attempted observations; this run cannot establish whether
successful authenticated metadata reads would affect cleanup. Direct MQTT
Session Present and queued delivery observations above remain valid.

### Expiry interpretation

All eight matrix cases received a fresh allowed control. No connection returned
a server Session Expiry Interval override. These are control-packet observations
from MQTT.js, not a separate raw-network capture or independent client stack.

| CONNECT / DISCONNECT expiry | Actual old state at about 5s | Outcome |
|---|---|---|
| 0 clean / omitted | absent; no queued marker | clean control PASS |
| 2 / omitted | resumed; marker delivered | expiry FAIL |
| 2 / 2 | resumed; marker delivered | expiry FAIL |
| 120 / omitted | resumed; marker delivered | persistence control PASS |
| 120 / 2 | resumed; marker delivered | shortening expectation FAIL |
| 2 / 120 | resumed; marker delivered | extension expectation PASS, but not proof the override was applied |
| 120 / 0 | absent; no queued marker | explicit zero control PASS |
| 2 / abrupt socket loss | resumed; marker delivered | expiry FAIL |

The discrepancy is not specific to passing a property in DISCONNECT: it also
occurs with CONNECT-only expiry and abrupt socket closure. Zero expiry works
immediately, while short nonzero expiry is not enforced by the observed 5s
reconnect boundary. The extension case is compatible with correct handling but
does not prove it, because stale state also survives in the failing short-expiry
cases. Server policy, reconnect behavior and cleanup scheduling remain possible
contributors; the exact cause is not confirmed by these probes alone.

Overall report: EXPECTATION_FAILURES (6 expectations pass, 5 fail), gate NO-GO.
The successful six-minute observations do not turn the original two-second
assertion into PASS. The prior message-TTL/signed-deadline/replay evidence remains
the separate command-validity mitigation, not a repair of session expiration.
NAF-162 remains In Progress; NAF-165 NO-GO; Stage 2 has not started.

Validation: 58 offline guard/validity tests pass, new-script ESLint and diff
whitespace checks pass. CI lints the new script but does not execute live broker
tests or receive credentials. Final cleanup uses only this run's created IDs.
