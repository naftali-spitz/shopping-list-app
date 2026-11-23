# Stage 3 readiness — CONDITIONAL GO

The core development integration passes. This permits the next isolated
development stage subject to the conditions below; it is not a production
migration or merge. Stage4 has not begun. Implementation source:
f557426cd97f3919b8994a854aa4812caa5d187d. Failed runs and corrective reruns remain
separate under attempts/. The machine-readable decision/evidence index is gate.json.

## Architecture and real operation

Verified Supabase Dev password session → feature Vercel API → durable development
command/status metadata → scoped flespi MQTT → Debian PostgreSQL atomic
business/result/outbox commit → separately signed outbound HTTPS callback →
durable authenticated polling/snapshots. No inbound Debian port or Vercel-memory
correlation store is used. Existing Stage0–2 roles, RLS, version checks, deduplication
and backups are reused. Existing Supabase Dev avoids another service or paid
resource; identity and metadata are explicit replaceable adapters. The owner
chose simple password testing, retaining Google later.

Proof page: https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/stage3
The original develop alias retains its baseline app. Draft PR16 targets develop
and is not merged. Production deployment/database/configuration were not changed.

Real browser operation658088ff-7337-49ae-9a9d-5a987a97bba7 / correlation
6479689c-7c3e-4811-8709-ff2e565abae7 created product
42daa2b4-7f99-4af2-b36e-5798c34c367b. Chrome rendered it optimistically, kept it
pending while offline, then retrieved the PostgreSQL commit and showed Saved.
A second authorized device synchronized. Concurrent quantity updates produced
one commit/one visible conflict; both converged to quantity2/version2. Independent
SQL confirms one create ledger row, one delivered outbox row and one product row.

## Evidence-backed acceptance

| Requirement | Actual result / report prefix in attempts/ |
|---|---|
| Real identity, refresh/logout, household isolation |7live Auth groups PASS; auth-52dab5e3 |
| Pending membership revocation/session expiry |Controlled actual dev row removal/deadline expiry denies execution with zero effects; auth-boundary-c7fe33a1/d2bf6e38 |
| Contracts and guards |73offline security tests PASS; security-tests-final.log |
| Actual Preview→MQTT→DB→callback/status |4final groups PASS; preview-03682262 |
| Duplicate/lost ACK/crash/rollback/retry |8quick groups PASS; failure-fa5977f8; one ledger/effect per commit |
| Publisher PUBACK loss |Actual ACK suppressed in an owned local publisher; hosted same-ID retry recovers commit; publisher-ack-70395755 |
| Callback integrity, replay, ordering and retry |5actual Preview security groups PASS; callback-290cb3fd;22s controlled delivery refusal/20outbox attempts; older progress ignored |
| Interruption/expiry recovery |5/60/290/480s real-services controlled-stream scenarios4PASS; failure-e977c762 |
| Browser pending/Saved/offline/Failed/conflict/sync |11actual Chrome groups PASS; browser-ba940e4a.json/png, including stale snapshot rejection and safe expired-intent reconciliation |
| Correlated operation trace |API publish/acceptance, MQTT receipt, DB, outbox/callback/status PASS; trace-d92df90e |
| Actual deployed rollback |Flagoff API404/original app200/retained commit; flagon recovered; production metadata unchanged; rollback-24b63c8c |
| Preview access-token renewal |Actual invalid-token rejection, scoped CLI renewal/idempotent callback PASS; token-refresh-f1d8572e |
| Existing backend regression |12actual PostgreSQL groups PASS; stage2-regression-a09eb348 |
| Final counts/health/safety |final-check-08f727eb; intended expired record absent, services healthy, fault controls disabled |
| Required CI/Preview |PASS on f557426; links in gate.json and PR16 |

Network faults affect only owned MQTT TLS streams and the dedicated service's
callback/reconciliation path, using actual services. They are not ISP/router
outages or synthetic file-journal transport. The480s early command expired with
zero effects; late-valid and fresh controls committed. Confirmation after unblock,
including outcome/control retrieval, was11.266/12.079/14.091/21.128s respectively.
These are not pure reconnect times. MQTT expiry300s/session expiry1800s are retained.

## Actual latency, separately scoped

Final browser create→Saved10.140s (one observation; earlier run7.203s). Actual
trace: client acceptance5.529s, status confirmation9.559s, publish→receive
cross-host wall-clock delta516ms, authentication1180ms, DB62ms. Cross-host deltas
include clock uncertainty; local DB/outbox durations use monotonic timing.
Normal final browser snapshots:12samples, durable acceptance→confirmation
P502619.1ms; empirical P953405.4ms is exploratory. Reliable P95/P99/SLO claims
are not supported by this small sample. Intentional listener-pause samples and
Stage1 synthetic transport measurements are excluded from normal latency.

## Precise Stage4 conditions

1. Complete the original application's full CRUD/checked/history/export adapters
   and UI parity. Stage3 proves a dedicated development page; retain fallback.
2. Configure/verify development Google OAuth with the owner when ready. Preserve
   current session/membership checks; no Google or human-email ownership success
   is claimed for the administratively provisioned random-password test accounts.
3. Complete household onboarding/invite adapters and issuer/subject mapping,
   retaining remote checks plus the local transactional membership allowlist.
4. Add pagination/deltas and metadata retention before larger/extended use.
   Current bounds16KiB/256KiB; observed metadata90rows/589824bytes, not a load test.
5. Choose unattended deployment identity and exercise live operational key rollover.
   Current owner CLI dependency has tested short-lived renewal; do not disable
   protection or expose broker credentials.
6. Expand field/outage and latency sampling before stronger availability/SLO claims.
   Actual ISP/router failure, multi-hour outages and off-host recovery remain
   unproven. Earlier Stage1 two-second cleanup/local-backup limits remain recorded.

No critical Stage3 requirement remains failed. Security findings/rationale and
reproduction/rollback are in implementation.md and operations.md. No production
SQL, paid-plan enablement, infrastructure removal or automatic merge occurred.
The original checkout's unrelated user changes remain untouched.
