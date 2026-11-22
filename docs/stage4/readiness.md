# Stage 4 readiness — CONDITIONAL GO

The bounded real-application development POC passes its demonstrated functional
acceptance. This is not complete parity or production readiness. Work stops at
this gate: no Stage 5 implementation, production change, migration or merge.

Application implementation: `6f499ab85d888f1f523c39d6f1698f7ecb3a1896`.
Verified source/evidence snapshot: `ee885a323db892ddb34d5c941062d156b917f1d6`.
The exact Git Preview and source checks are in [gate.json](gate.json); the
feature alias was explicitly assigned and checked against that SHA. Final
verification 554583fd passes the actual authenticated root UI, retained rollback
commit exactly once, expired neveraccepted ID still absent, and healthy dedicated
services with fault injection disabled. Source CI and Preview both pass.

## Demonstrated scope

The existing `/` UI uses a development-only selected adapter and the same durable
client as `/stage3`. Real Dev provider sessions, current session verification,
stable issuer/subject mapping and transactional PostgreSQL membership authorize
CRUD, quantities/checks, product movement/custom ordering, households/defaults/
invitations/removal, history/export and reconciliation. Optimistic feedback is
immediate; Saved requires an authoritative committed result. IDs survive offline,
refresh and simultaneous tabs; stale snapshots/results cannot lower authority.

[Acceptance evidence](test-results.md) records issue-specific browser, database,
ledger/outbox and source proofs for NAF-178/179/180/181/182/194/195/196. Those eight
issues are Done with their evidence and exceptions recorded in Linear. The
[comparison](feature-comparison.md) distinguishes source inspection from executed
baseline/feature scenarios; the [walkthrough](demo.md) is reproducible.

Focused final browser runs pass same-user tabs (3 groups), actual UI global
logout (1), real 300,720ms offline expiry/not_found/Failed with zero effects (2),
search/quick-add/missing-create/custom drag (4), dedicated MQTT/callback faults
(2), and full deployed rollback (4). Earlier broad actual-app and household runs
pass 16 and 14 groups; the 300-product/80-checked export run passes 5. The original
nine passing reliability groups remain inside a failed run, explicitly indexed
as partial evidence. No failed attempt was rewritten into a pass.

Genuine LibreOffice rendering exposed and verified the narrow Hebrew column and
alignment fix. The actual browser downloads four-column DOCX and commits history/
usage/check effects exactly once. Microsoft Word itself was not executed.
The 95-test offline security/regression suite and relevant changed-source lint
pass; the actual Stage 2 PostgreSQL regression has 12 passing groups. Existing
unrelated full-app lint baseline errors were not suppressed or refactored.

## Actual fallback and safety

Rollback17ad4958 rebuilds verified Git Preview with only Stage 4 disabled,
explicitly assigns only the feature alias, performs an actual original Supabase
Dev category write/reload with zero dual PostgreSQL write, preserves browser
pending IDs and authenticated prior outcomes, then rebuilds enabled and reconciles
the identical committed result. PostgreSQL data/ledgers/outboxes and existing
credentials remain. Production deployment/secret-record metadata match; secret
plaintext was not read or compared. Fresh provider isolation audit also passes.

Earlier rollback type/route/navigation failures and diagnostics are retained.
One transition-load timeout is not fully root-caused; the later complete pass is
not evidence of broad operational repeatability. The browser is paused on
about:blank during synchronous CLI rebuilds while the same origin storage remains.
No authentication, signature, membership or Deployment Protection guard was weakened.

The original checkout's unrelated DOCX edits/artifacts and its env remain
untouched. Development PostgreSQL remains exclusively 127.0.0.1:55439,
shopping_stage0. Dedicated services remain active, faults are disabled, production
is unchanged, and PR16 remains draft against develop.

## Conditions before expanding the POC

1. Google Dev OAuth remains unconfigured; preserve the existing Google path and use the documented owner-backed Dev setup before claiming Google parity or fresh Google-only fallback login.
2. Confirmation remains several seconds. Review actual UX before broader use; controlled cold-start, representative concurrent/soak samples and valid tail-latency targets remain unproven. No P95/P99/SLO claim.
3. Implement pagination/deltas and safe pending/result/outbox metadata retention before larger households or extended use. Current 300-product fixture is bounded evidence, not scale proof.
4. Member display uses stable principal IDs; display-name mapping is not implemented.
5. Choose unattended Preview/deployment identity and exercise live key rollover, session refresh/revocation maintenance and independent clock-skew evidence without weakening signatures or Deployment Protection.
6. Broader field/ISP/router interruptions, long-running quota/capacity/health tests and off-host encrypted backup/key recovery remain unproven.
7. Genuine LibreOffice rendering passed; Microsoft Word itself was not executed. Existing Linux title-emoji glyph limitation remains.
8. One retained in-place rollback transition timed out loading the browser; exact cause is not fully isolated. The corrected complete rollback passed, but broader rollback/reload repeatability remains an operational obligation.
9. Comparison combines source-grounded parity, actual Supabase Dev paced edits/fallback write and feature functional suites; not every baseline flow was independently repeated on both backends. Existing partial translations and current-quantity history restore are documented.

The small solo cohorts show create median tap→Saved 11.803s → 7.809s and quantity
12.044s → 5.747s, generally n=3. Confirmation remains slow despite much faster
visible feedback. [Performance](performance.md) records windows, correlated
traces, root cause and concrete mitigation; no tail-percentile or subjective
acceptability target was declared passed.

NAF-187 and NAF-188 receive these handoff obligations only. Their Stage 5 work
remains Backlog and is not started by this decision. Supabase Dev still supplies
identity and durable gateway metadata; no infrastructure was removed.
