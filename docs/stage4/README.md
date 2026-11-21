# Stage 4 — Real Shopping List functional POC

Stage 4 is in progress. No readiness or parity pass is implied by implementation
or this inventory. All work belongs to `feature/flespi-home-backend`, draft
[PR #16](https://github.com/naftali-spitz/shopping-list-app/pull/16) targeting
`develop`; production migration, production writes and automatic merge are excluded.

The existing application at `/` must use one selected data adapter through the
shared UI. `/stage3` remains reusable transport/authentication evidence, not the
Stage 4 user interface.

- [Feature parity inventory](feature-parity-inventory.md): source-grounded baseline,
  actual data paths, existing invite policy, visible features and known defects.
- [Stage 3 readiness](../stage3/readiness.md), [implementation](../stage3/implementation.md)
  and [operations](../stage3/operations.md): proven components and retained limits.
- [Stage 2 readiness](../stage2/readiness.md) and [Stage 1 revised readiness](../stage1/readiness-revised.md).

Work order: NAF-178 adapter → NAF-179 CRUD → NAF-180 checks/quantities → NAF-194
household/identity → NAF-195 history/export → NAF-181 synchronization → NAF-196
performance → NAF-182 comparative demo/rollback → NAF-183 evidence-backed gate.
Respect actual Linear blockers; independent source inspection may happen together.

Use existing provisioned Supabase Dev password accounts; do not recreate accounts,
reset passwords or ask the owner to retrieve credentials. Preserve Google login;
Google Dev configuration remains unproven until explicitly configured and tested.

Feature Preview:
https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/

Keep raw test artifacts and screenshots under `docs/stage4/`; preserve failed and
corrected runs with distinct IDs. Never commit tokens, passwords, auth state or
private browser/runtime files. Each verified issue update must include source,
commit, commands, actual result/evidence, limitations and rollback. Do not advance
Stage 5 before a recorded Stage 4 gate; a gate never authorizes production.
