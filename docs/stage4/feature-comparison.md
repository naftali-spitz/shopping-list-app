# Existing Supabase Dev and experimental home backend

The source inventory is feature-parity-inventory.md. Browser evidence exercises
the actual shared `/` app, not only `/stage3`. This table separates source-based
comparison from executed checks; it does not claim every baseline flow was
independently repeated against both backends.

| Behavior | Original Supabase Dev | Stage 4 feature adapter / demonstrated scope |
|---|---|---|
| Shared UI and auth | Existing cards/modals/drawer/profile; Google path with Dev provider unconfigured | Same UI; existing real Dev password accounts; Google path preserved and still unconfigured |
| Shopping writes | PostgREST/RPC responses, existing optimistic state | Durable immutable operation IDs, current provider session plus transactional local membership, PostgreSQL result/outbox; Saved only on committed result |
| CRUD/move/order | Category creation order; product popular/A–Z/custom order | Equivalent selected-backend operations and tombstones; original-UI CRUD/move/delete/reload plus backend ordering tests |
| Checks/quantities | Existing rapid-check guard and optimistic quantity changes | Absolute desired values, successive expected versions, safe same-ID retries, explicit conflicts and revision convergence |
| Synchronization | Product changes trigger full refetch | Authorized revision-aware polling; category/product/history changes, deletion/move, stale-response protection; 300-product snapshot measured at 99,794 bytes |
| Households/defaults | Create/switch/delete, sequential starter seeding | Transactional local create/defaults; five categories/27 products in English/Hebrew; owner rename/member removal added as explicit Stage 4 scope |
| Invitations | Authenticated reusable member-created links, 14-day expiry | Policy retained with verified issuer/subject mapping and local membership; duplicate/invalid/expired/revoked/removed-member checks |
| History/export | Atomic export RPC; DOCX route; existing restore matches current names | Local atomic history/usage/check effects; persistent delete/tombstone; same route with independently demonstrated Hebrew DOCX fixes; current quantities retained on restore |
| Preferences/mobile | Device language, theme, sound and shared responsive components | Same controls, desktop/mobile English/Hebrew screenshots; partial baseline translations remain explicit |
| Rollback | Baseline Dev backend remains available | Feature-only Stage 4 flag; retain committed outcomes and browser pending IDs; Actual verified Git rebuild, Supabase Dev write/reload, retained ID and failback: rollback-17ad4958 PASS |
| Responsiveness | 41 paced browser edits with authoritative Dev HTTP acknowledgements | Small solo before/after samples, correlated traces and immediate feedback; confirmation remains several seconds, no SLO or cold-start guarantee |

Baseline browser evidence: baseline-performance-81b0cdbc (source 88af186).
Feature functional evidence: browser-8892301b, household-browser-a7cec2a9,
docx-browser-6c9fb3a1, and the focused reliability/expiry/fault/rollback reports
indexed in test-results.md. Sources differ across the staged implementation;
each report's deployment/source field governs its actual claim.

Known limits: Google Dev OAuth; member names represented by stable IDs;
pagination/delta delivery and metadata retention before scale; owner CLI token
renewal dependency; live key rollover and independent clock-skew evidence;
controlled platform cold starts; representative tail latency/soak/field outages;
off-host backup/key recovery; Microsoft Word execution. The home backend still
uses Supabase Dev for identity and durable gateway metadata. This POC does not
claim to eliminate Supabase or establish production readiness.
