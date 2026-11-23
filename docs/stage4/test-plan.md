# Stage 4 acceptance and evidence plan

This is the planned matrix, not a result report. Execute against the original
application `/` in isolated feature Preview. Preserve each failed run and its
corrective rerun separately. Every command must start from the verified feature
worktree after Stage 0 preflight. Never use production data or credentials.

## Evidence format

Each run should record unique run ID, UTC start/end, Git SHA, backend selection,
exact Preview deployment, client viewport/language/theme, sanitized operation and
correlation IDs, expected/observed outcome and paths to screenshots/SQL evidence.
Keep credential/session/browser storage outside Git in existing private runtime.
Record SQL targets explicitly as `127.0.0.1:55439/shopping_stage0`; read business
state, operation ledger and outbox counts after browser mutations. Browser
optimistic appearance, HTTP202 and MQTT PUBACK cannot establish Saved.

## Dependency order and minimum cases

| Issue | Actual-app cases | Required proof |
|---|---|---|
| NAF-178 | Existing Dev login session opens `/`; flag on original cards/list reach Debian; flag off restores baseline Supabase Dev; pending IDs remain retained across switch. Unauthorized deployment/production cannot select Debian mode. | Desktop screenshot both modes, selected data source, one browser mutation SQL/ledger/outbox, deployed rollback, no dual business writes. |
| NAF-179 | Category add/edit/icon/delete; product add/edit/delete/move; custom product order/rebalance; stable category creation order; empty inputs/invalid payloads; stale edit and two-client edit; duplicate operation delivery; cross-household category move; refresh/reload. | UI plus PostgreSQL fields/versions/tombstones, one effect per operation ID, denied requests zero effects, second client receives move/delete. |
| NAF-180 | Check/uncheck; quick add; missing-product checked create; quantity +/-; rapid repeated taps; concurrent same-product quantities; duplicate/same-ID delivery; lost acknowledgment; stale/out-of-order result; refresh pending; offline/reconnect. | Immediate optimistic feedback, explicit pending, Saved after commit only, one final intended absolute value, visible conflict and convergence; sounds occur only for user action. |
| NAF-194 | Real provisioned password sessions, new household with/without defaults and English/Hebrew defaults, list switch/rename, member view, owner/member invite, copy/join, duplicate invite use, forged/expired/revoked invite, removed membership, session expiry/logout, foreign household attempt. | Two real accounts share list and third stays isolated; verified issuer/subject mapping and current membership at commit; no fixture-membership prerequisite for new onboarding. Google gap recorded separately until actual OAuth works. |
| NAF-195 | Export selected products with quantities; history order/calculations; delete history, refresh and second-client removal; rejected delete leaves row; same-ID retry; restore selected/all history including quantity>1 and renamed/deleted products; global/local search; profile/preferences/modal behavior. | PostgreSQL immutable history and committed delete/usage counts; actual downloaded DOCX; localized desktop/mobile screenshots; exceptions explicit. |
| NAF-181 | Two authenticated contexts same list and third other list; product/category update/move/delete; checked/quantity conflict; refresh and reconnection; delayed snapshot/results; household switch with request in flight; logout/revocation while pending; realistically sized fixture. | Authoritative revision monotonicity, no data cross-over or stale resurrection, bounded requests/payloads, browser snapshots plus SQL. |
| NAF-196 | Similar original Supabase Dev and Debian app scenarios, warm/cold load, create/edit/check/uncheck/quantity and household switch; mobile feedback; short offline period. | Correlated tap→optimistic, request start, auth, durable accept, MQTT send/receive, SQL commit, callback receipt, browser result and Saved. Before/after raw samples, sample count/window definitions; avoid unsupported tail percentiles. |
| NAF-182 | Full realistic walkthrough both backends, actual `/`, desktop and mobile, Hebrew/English and theme settings, errors/conflicts/offline, multi-device, export/history and rollback. | Reproducible script, screenshots, SQL evidence, comparison table, CI/Preview checks at relevant SHA, no production impact. |
| NAF-183 | Review all required issue evidence/dependencies. | GO/CONDITIONAL GO/NO-GO with exact demonstrated scope, failures/open requirements and justified Stage5 obligations. No migration authorization. |

## Shared recovery matrix

Re-use Stage 1/3 evidence for unchanged transport details. Exercise the new
original-app adapter at least once for each applicable boundary:

1. Short controlled connection interruption; no unrelated network/service change.
2. Browser offline after durable enqueue, then reconnect and retrieve result.
3. Dedicated Debian listener temporarily disconnects; accepted intent persists.
4. PostgreSQL commits while callback is deliberately delayed; pending remains
   until authoritative result is retrieved, then Saved without duplicate effect.
5. Duplicate delivery/same-ID retry produces one effect/ledger/outbox outcome.
6. Refresh while pending reloads identical intent/operation ID and reconciles.
7. Expired never-committed intent reconciles after deadline and never shows Saved.
8. Concurrent quantity writes yield committed result and explicit version conflict.
9. Older snapshot/result cannot overwrite newer household/record version.
10. Session or membership revoked while pending denies any new unauthorized effect;
    a previously committed outcome remains immutable and recoverable through an
    authorized session. Preserve evidence of acceptance/commit/revocation order.

No need to rerun all 480-second transport scenarios if the transport is unchanged.
If command validity or transport behavior changes, add focused regression and
state the justified scope. Message expiry300s/session1800s remain baseline.

## DOCX inspection matrix

Generate at least English and Hebrew small-list and four-column documents through
actual app export. To force four columns, use estimated line count over78
(sum of item counts plus2 per category) while remaining within application bounds.
Check downloaded archive `word/document.xml`: landscape page, four table cells
when required, quantities/checkboxes, category order, no unchecked products,
RTL paragraphs/runs and expected table direction. Also open/render representative
DOCX using an available Word-compatible viewer to inspect visible column order
and print layout; XML properties alone do not prove visual correctness.

Baseline source reverses column array and sets `visuallyRightToLeft`; treat any
confirmed double reversal as a documented bug before editing. The unrelated
original checkout includes uncommitted DOCX work and must remain untouched; do
not copy those edits into the feature branch without independent justification.

Only DOCX is reachable in current source. Do not invent parity for PDF/CSV or
claim that four columns are used for every small list. Direction is currently
inferred from item text, so test Hebrew item text with English UI and vice versa.

## Rollback evidence

Disable only feature-specific Preview backend selection and redeploy verified Git
source on the existing feature alias. Confirm original Dev shopping behavior,
retained PostgreSQL business rows/immutable results/outboxes and pending browser
IDs. Re-enable compatible source and reconcile. Never delete data to manufacture
rollback success. Record unchanged production deployment/secret-row metadata and
absence of production SQL; metadata comparison does not prove secret plaintext.
