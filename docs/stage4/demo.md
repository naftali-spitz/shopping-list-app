# Stage 4 reproducible development walkthrough

Use only the feature worktree, existing private Dev accounts, and protected
feature Preview documented in README.md. Never load the original checkout env.
This walkthrough describes the demonstrated POC; it does not authorize Stage 5,
production writes, migration, a merge, or infrastructure removal.

1. Refresh expired evidence with `python3 scripts/stage0-vercel-audit.py`, then
   run `node scripts/stage0-preflight.mjs`. Verify the feature alias's actual
   deployment SHA; Git checks alone do not move the manually pinned alias.
2. Sign in at `/` using an existing Dev account. Create an empty household and
   another with English/Hebrew defaults. Confirm five categories and 27 products,
   reload, rename as owner, and switch lists. Open the profile member section.
3. Copy an invitation and join in a second account/context. Duplicate acceptance
   retains one membership; a third account without membership cannot read the
   list. Remove the second member and verify fresh reads and reload deny access.
   Invitations remain reusable for 14 days unless revoked; membership removal
   alone does not invalidate an otherwise valid invitation.
4. Create a category with an icon, add/edit/move a product, select custom ordering,
   and check it. Change quantities in the shopping drawer. Verify pending is
   visible immediately and Saved appears only after the PostgreSQL result.
   Reload and compare the other authorized browser. Delete product/category and
   verify synchronized tombstones rather than stale resurrection.
5. Export checked quantities to DOCX. Verify history and cleared checks, download
   the document, and use History Add Selected. Reject a history deletion before
   acceptance, reload to retain it, then deliberately retry and verify persistent
   deletion and usage recalculation. History restoration retains current product
   quantities; it is not a promise to restore historical quantities.
6. Exercise global/local search and missing-product add. Open profile/preferences,
   change language/theme/sound, and inspect desktop plus phone-sized Hebrew RTL
   and English LTR. Existing partial translations and modal theme choices remain.
7. Run `node scripts/stage4-parity-browser.mjs` for focused search/quick-add/drag
   evidence. Run `node scripts/stage4-reliability-browser.mjs --cross-tab-only` for focused
   simultaneous-tab storage/refresh verification. The original nine passing
   reliability groups are retained in failed run b26c7b7d; do not call that full
   run a pass. Run `--logout-only` with all other sessions for that account idle.
8. Run `node scripts/stage4-expiry-browser.mjs` for actual 300-second browser
   offline expiry, authenticated not_found reconciliation, Failed, and zero
   PostgreSQL effects. Do not close the browser at the five-minute checkpoint.
9. After all other feature browsers close, run
   `node scripts/stage4-fault-browser.mjs`. It bounds faults to the dedicated
   listener MQTT stream/callback and restores faultInjectionEnabled=false.
10. Run `node scripts/stage4-rollback.mjs` alone. It rebuilds the verified Git
    Preview with only Stage 4 disabled, assigns only the feature alias, performs
    an original Supabase Dev UI write/reload, retains pending IDs and PostgreSQL
    outcomes, re-enables the feature, reconciles the same ID, and compares
    production metadata. This is not a production rollback procedure.

Automated suites create unique synthetic evidence and preserve failures under
attempts/. Credentials/auth state stay in ignored owner-only runtime files.
The broad functional scripts are reproduction options, not required repeats of
already passing evidence. Performance sampling commands and measurement windows
are in performance.md; compare equivalent windows and never infer P95/P99 from
the small cohorts. Genuine LibreOffice evidence is described in export-parity.md;
Microsoft Word itself was not executed.
