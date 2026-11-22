# Stage 4 acceptance evidence

Implementation source at the start of final verification: `6f499ab85d888f1f523c39d6f1698f7ecb3a1896`.
Earlier cohorts ran the implementation revisions recorded by each report; their
harness HEAD is not automatically their served source. The feature alias was
independently verified at `dpl_Hr7RToM69ob52HAz6e2rtA4upyD6` for focused final
browser verification. Final source/CI/Preview and the decision belong in gate.json.

## Completed evidence inherited from the implementation

All paths below are relative to attempts/. A PASS group inside a failed run is
narrow evidence for that group, never a relabeling of the whole run.

| Acceptance | Evidence and result | Limits |
|---|---|---|
| Real shared root UI CRUD, checks/quantities, refresh, movement and deletion, isolated third user | browser-8892301b-67b9-40e1-bbf6-ef3de44ad29e/report.json: 16 groups PASS | Unique synthetic household; browser/SQL/ledger/outbox and second-client checks |
| Household defaults, rename, invitations/duplicate/invalid/expired, member removal and switching | household-browser-a7cec2a9-f52c-4154-9d0d-58bb1c52d02b/report.json: 14 groups PASS | Deployed 7ab774d; stable IDs displayed; Google not configured |
| Local lifecycle authorization and invitation revocation | lifecycle-6d569014-942f-4833-aa0b-e53d38c7a1f0.json: 12 groups PASS | Backend/provider/gateway evidence, not all browser paths |
| Account/outcome reconciliation and starter ordering | reconciliation-efca70b9-b657-4ef7-991d-79cb1da4c870.json: 6 groups PASS | Own prior immutable outcomes remain recoverable after membership removal |
| First-seen verified subject mapping | identity-rehearsal-6774e72d-5dc2-4ed2-ac0d-9e2e847e38f2/report.json: 4 groups PASS | Marked disposable rebuild DB, existing real provider identity; not new signup |
| Dedicated logout and controlled exact-session expiry | session-boundary-437418ed-6122-4548-8ce4-d5f93ad04aa2/report.json: 7 PASS; session-boundary-8d67755f-7992-4025-919d-009541a9ac8c/report.json: 5 PASS | Denied before durable acceptance; zero effects; lifecycle separately covers accepted membership removal |
| Original mobile/desktop and history/export | browser-8892301b screenshots/SQL plus docx-browser-6c9fb3a1-d137-4b3f-b7cd-2d02ae9a7241/report.json: 5 PASS | 300 SQL fixture products, 99,794-byte snapshot; actual 80-item export/history restoration |
| Genuine Hebrew/English DOCX rendering | docx-render-24586aef-df42-4d28-91f6-510cde36fb03/visual-review.json: four inspected cases PASS | LibreOffice, not Microsoft Word; preceding failed render preserved |
| Real reliability before cross-tab continuation | reliability-browser-b26c7b7d-0b0f-4a14-9418-295cecf4f16c/report.json: 9 passing groups in FAIL run | Rapid checks/quantities, offline, duplicate, refresh pending, concurrent conflict, stale snapshot; failure was exiting-modal harness reuse |
| Small-sample save improvement | performance-5e56cd02-5c95-4ee9-a6fc-74f84e5349ac vs performance-1a018cc5-c7a4-4391-a962-6f52077a7547 | Generally n=3; create median 11.803s → 7.809s, quantity 12.044s → 5.747s; no P95/P99/SLO/cold-start claim |
| Baseline comparison | baseline-performance-81b0cdbc-dd2d-4e2c-a0e8-dce3c9968aa1/report.json | Actual Supabase Dev UI, 41 paced edits; windows differ from durable confirmation |
| Existing PostgreSQL regression | ../../stage2/attempts/integration-c87e5b8e-f299-4ef1-b689-c493eec60a88.json | 12 groups PASS; fixed loopback development target |
| Final offline security/regression tests | security-tests-stage4-final.log | 95 tests PASS; includes actual compiled shared client, auth overlap and protocol/guard cases |

## Final focused verification

- Actual UI Logout: reliability-browser-45984ea1-8066-4e6e-94f1-1ca3f4383692/report.json
  PASS, original global logout, rendered data cleared, prior token new command
  HTTP401 and zero ledger effects. Account's other feature tests were idle.
- Cross-tab group: reliability-browser-7516cf98-7ef3-4813-88ac-7a34d1429594/report.json
  has three passing groups, including both independent offline IDs surviving tab
  closure/refresh with one effect each. Overall FAIL is retained: logout selector
  expected Sign out instead of the actual Logout label. A separate corrected
  focused run and logout probe avoid repeating the original nine passing groups.
- Failed logout probe d28855bb is retained: nonexistent status ID returned404;
  corrected command-admission probe above proves the current-session boundary.
- Original expiry-browser-13cec058 is retained as FAIL: pending ID/zero effects
  proved, but browser closed before final reconciliation. It is not expiry success.

Focused cross-tab continuation
`reliability-browser-5e212db7-77a7-460f-af79-c6f0a9a7877a/report.json` passes
all three groups at deployed 6f499ab. The remaining completed focused reports
follow. Final exact-source verification passes; the decision and conditions are in gate.json.

Actual elapsed expiry continuation
`expiry-browser-3cc95db1-321d-4400-b227-87805d42f1aa/report.json` passes two
groups on deployed 6f499ab: 300,720ms offline, unchanged intent/ID, no premature
Saved, authenticated PostgreSQL operation.status → not_found → Failed/expired,
and zero original operation/product/outbox effects. The original failed run is
retained separately.

Focused original-UI parity report
`parity-browser-6f84864e-e86a-4701-b93f-e3c537eabbca/report.json` passes four
groups: local search/A–Z, real custom drag with SQL display_order and reload,
existing-product global quick-add, and unmatched-name checked create in a selected
category. Each write has one authoritative ledger/outbox; no new UI was built.

Actual bounded fault report
`fault-browser-0871e9d2-0fdb-44a2-9b71-120796e22ffe/report.json` passes both
groups on deployed 6f499ab. The dedicated listener's MQTT stream was interrupted
for eight seconds; pending recovered with one product/ledger/outbox. A separate
22-second callback refusal left the committed product UI-pending, then Saved;
19 outbox attempts and a same-ID retry still produced one effect. The PostgreSQL
PID was unchanged. Cleanup restored faultInjectionEnabled=false and the dedicated
listener is connected/clock-healthy. No router/ISP/firewall or unrelated-service
fault is claimed.

Actual development rollback
`rollback-17ad4958-8833-4712-b897-bf4b0593f77e/report.json` passes four groups:
committed-but-pending original UI operation, verified flag-off Git rebuild and
feature-only alias assignment, original Supabase Dev UI write/reload with zero
PostgreSQL dual write, retained browser ID/prior outcome lookup, and flag-on
rebuild/reconciliation of the identical result. Production deployment and secret
record metadata match before/after. Source is 6f499ab in both builds; the report
records their distinct deployment IDs and screenshots. Browser storage remains
in the same context; about:blank pauses polling during synchronous rebuilds.

Failed rollback attempts remain separate: 0e730a55 rejected an existing encrypted
Config row before mutation and hit a disposed-route cleanup error; bafea2ab saw
the old browser selection and restored the enabled Preview; c3c3b79e verified the
Supabase server selection but timed out loading the retained browser. Emergency
restores passed. Fresh immutable-URL and same-context navigation diagnostics are
retained under rollback-diagnostic-*. No app authentication or deployment guard
was weakened. The exact cause of the intermittent transition-load timeout is
not fully isolated; the corrected full pass does not establish broad operational
repeatability. Broader rollback/reload testing is an explicit remaining limit.

Final source verification
`final-check-554583fd-dc63-43d4-b8b4-13bb5b0e8613.json` passes four groups at
source ee885a3 / Git Preview dpl_7yjesvBxch1SjxxLd75MCDxJhWDf. It verifies
actual alias SHA, draft develop PR and passing CI/Preview, authenticated root
home UI, unchanged one-effect rollback commit/zero-effect expired ID, active
dedicated services, disabled faults and production audit. [readiness.md](readiness.md)
and [gate.json](gate.json) record CONDITIONAL GO and the exact limits.
