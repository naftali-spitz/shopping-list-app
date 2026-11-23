# Stage 4 source-grounded feature parity inventory

Baseline inspected: `939fbed46bb674bde3cebd009334939b9c171f9c`, feature worktree,
2026-11-20. This is a source inventory, not browser acceptance evidence. The
original checkout contains unrelated DOCX work and was not loaded or modified.
Supabase behavior below is derived from committed development source/migrations;
it does not assert live schema equivalence with production.

## Routes and architecture

| Entry point | Existing behavior and source | Stage 4 issue / required adapter |
|---|---|---|
| `/` | One client `app/page.tsx` composes existing cards, search, drawer, modals, profile, onboarding, history. All actual shopping UI is here. | NAF-178: retain this UI and its components; select one backend per session/context. |
| `/stage3` | Dedicated password-login proof in `app/stage3/stage3-client.tsx`; durable queue, operation status, conflict/reconcile, authenticated snapshots. | Reuse established protocol/reconciliation; proof alone does not satisfy original-UI acceptance. |
| `/api/stage3` | `integration/stage3/server.mjs`: strict deployment/resource guards, identity check, durable gateway acceptance, signed MQTT publish, signed callback, authenticated status. | NAF-178/180/181: reuse proven boundary and operation IDs. |
| `/api/export-doc` | Generates DOCX entirely from request categories; does not read a DB or invoke an RPC. | NAF-195: shared rendering for both backends, actual downloaded document checks. |

## Actual shopping interface and calls

| Feature | Existing source and behavior | Debian mapping / acceptance owner |
|---|---|---|
| Initial data | `hooks/use-shared-categories.ts` → `lib/db/categories.ts:fetchCategories`: categories with nested products for active household, categories ordered by `created_at` ascending. Maps `usage_count`, `display_order`, checked, quantity and normalized icon. | NAF-178/179: authorized PostgreSQL snapshot; retain category creation ordering and product fields. |
| Category cards | `components/categories-section.tsx`, `category-card.tsx`; open category and edit; empty/create affordance. | NAF-179/195: same cards and responsive layout. |
| Category CRUD | `hooks/use-category-management.ts` → `createCategory/updateCategory/deleteCategory`; category create/edit share `edit-category-modal.tsx`; trim/empty validation, delete confirmation including product count. Update verifies a returned row. | NAF-179: `category.create/update/delete`; record versions, tombstones and cascading product removal. |
| Icons | `category-icon-picker.tsx` is a dropdown/listbox with localized labels, selected icon, light/dark styling and action sounds. `lib/category-icons.ts` has 15 allowed icon values; unknown values normalize to `general`. | NAF-179/195: persist icon keys, preserve picker and labels. |
| Product CRUD/move | `use-category-management.ts` → `lib/db/products.ts`; category modal add, edit-product modal name and category selector, confirmed delete with optimistic removal. Missing/global-search add is a second path. | NAF-179: `product.create/update/delete`, authorized destination category, version conflicts, refresh persistence. |
| Category ordering | DB fetch uses `created_at` ascending. No category drag/reorder control or category display-order property exists in current source. | NAF-179/195: preserve creation order. Do not claim existing custom category ordering. |
| Product ordering | `category-modal.tsx`, `lib/category-product-list.ts`: popular (usage descending/name), A–Z, or custom (`displayOrder`/name). Drag handles only in custom mode without search; autoscroll near edges. `app/page.tsx` computes integer midpoint or rebalances all products using `lib/product-ordering.ts`. | NAF-179: `product.update display_order`; batch reorder currently issues parallel per-product updates. Preserve sorts and safe conflicts; do not claim atomic batch behavior from current UI. |
| Search/quick add | Global case-insensitive substring search, maximum 8 matches (`lib/product-search.ts`). Existing match quick-add checks it. Unmatched name opens category selection modal and creates already-checked product (`use-missing-product-add.ts`). Category-local search filters before sorting. | NAF-179/180/195: both create paths and check path must use selected backend. |
| Checked state | Checked means **included in the shopping list**, not purchased. Category row calls by product name; `use-shopping-state.ts` resolves first matching name. Shopping drawer remove unchecks by ID. Local overrides render immediately; pending Set blocks repeated check writes until response, then refresh. | NAF-180: absolute desired checked state, persist operation before interaction result, authoritative commit confirmation, preserve flicker guard; test duplicate names/name-based selection ambiguity. |
| Quantities | `use-shopping-state.ts`: drawer +/-; optimistic category patch, minimum 1, DB update, rollback/error on failure. No pending quantity guard exists at baseline. | NAF-180/196: version-aware serialization/conflicts and rapid intent handling; no retry-based increments. |
| Loading/errors | `app/page.tsx` gates initial auth/household/category/history loading with `LoadingScreen`; `AppFeedback` shows success/error overlays. Most DB errors are logged and passed to existing callbacks. | NAF-178/196: preserve initial loading; operations need subtle pending state, no full-screen save overlay, explicit failure/conflict. |
| Notifications | `lib/realtime/products-channel.ts` subscribes to `products` only and triggers a complete `fetchCategories`; no category/history realtime subscription. | NAF-181: authorized revision-aware sync for products, categories, history; stale request/snapshot protection. |

## Identity, households and invitations

| Feature | Source-grounded baseline | Required work / policy |
|---|---|---|
| Login/logout | `use-session.ts` uses Supabase getSession/onAuthStateChange; `components/auth-button.tsx` signs in with Google and redirects to same origin/path/query; page signs out. Existing `/` login has only Google. `/stage3` uses real Dev password login. | NAF-178/194: reuse Dev password sessions/accounts without resets, preserve Google path. Google Dev parity unconfigured and requires separate evidence. |
| List/select/create | `useCurrentHousehold.ts` calls `list_my_households`, retains `futurecart.activeHouseholdId` only if current result includes it, otherwise first result. Page creates explicitly from onboarding/profile. `get_or_create_current_household` helper exists but is not called by current UI. | NAF-194: authenticated lifecycle, correct scoped storage/reset and first-login flow; do not rely on fixture memberships forever. |
| Starter content | `lib/default-household-template.ts` directly calls Supabase outside `lib/db`: 5 categories, 27 products, checked false, quantity 1, display order 1000 increments per category, English/Hebrew templates. Optional in create modal. Categories and product batches are inserted sequentially, so baseline is not atomic across the template. | NAF-194/195: route this call too; never write starter data to Supabase while Debian mode selected. |
| Delete household | Profile contains another `useCurrentHousehold` instance; owner-only delete confirmation then page reload. `delete_household` RPC deletes products, history, invites, categories, memberships and household. | NAF-194: role-authorized transactional equivalent; retain durable operation/reconciliation records and safe tombstones. |
| Invite create/copy/join | `create_household_invite`/`accept_household_invite` in `lib/db/households.ts`; page builds `/?invite=TOKEN`, copies clipboard or prompt fallback. Join token retained through login, accepted when authenticated, removed from address after attempt. | NAF-194: transactional local membership + verified provider subject; invalid token/expired/auth denies. |
| Committed invite policy | `supabase/migrations/20260530213646_household_invites.sql`: random 24-byte hex token, **14-day expiry**, any current household member can create; any authenticated accepter gets member role; insert only if not already member; reusable token until expiry; tracks last acceptance. | Preserve authenticated reusable policy, test duplicate acceptance. Existing UI has no revoke control, but required new lifecycle controls must deny revoked/expired grants safely. Token knowledge alone must not permit data access. |
| Rename/member list/removal | No rename RPC/UI, member-list component or removal UI appears in actual baseline. Profile shows current user's email and role, plus household names/roles. | NAF-194 explicitly requests rename/member visibility/removal verification, so implement as Stage 4 requirement without mislabeling these as previously working UI. |

## Shopping history and export

| Feature | Source-grounded baseline | Required work / acceptance |
|---|---|---|
| History read/display | `fetchHistory` selects household rows by `exported_at` descending; `use-shopping-state.ts` maps object/string items to labels and quantities `name ×N`; `HistoryModal` lists dates/counts and previews/selects items. | NAF-195: consistent local history records and ordering, household scope, synchronized updates. |
| Export side effects | `export_shopping_list` RPC atomically unchecks selected products, records immutable item ID/name/category/quantity history, increments usage once per selected product. It inserts an empty history record for an empty export. UI optimistically clears checks, awaits RPC, then generates DOCX from earlier selected categories, reloads history/categories. | NAF-195/180: reuse `list.export` expected household revision and idempotency; document/export authoritative committed snapshot so races cannot produce different history and DOCX. |
| History deletion | `deleteShoppingHistoryEntry` calls hardened `delete_shopping_history_entry`; latest September SQL authorizes household, deletes persisted row, errors if absent and decrements same-household product usage (minimum zero). UI removes only after RPC success, then reloads categories. Confirmation promises recalculation, although SQL decrements rather than full recomputation. | NAF-195: durable deletion, same-ID retries/tombstones, failed delete remains visible, usage correctness and browser+SQL refresh proof. |
| Restore selected history | `setShoppingList` optimistically checks matching names and calls `add_products_to_shopping_list`; it adds without clearing prior selected products. `HistoryModal` can select individual/all items. RPC matches current names, not IDs. | NAF-195: `list.restore` adapter; **baseline defect:** quantity>1 labels include ` ×N` and therefore fail exact name matching. Preserve historical IDs/quantities for correct restore; document correction. |
| Supported export formats | Actual reachable UI invokes DOCX only (`lib/export-doc.ts` → `/api/export-doc`). No PDF, CSV, JSON or print action exists in current app. `html-docx-js` dependency is not proof of another reachable format. | NAF-195: preserve DOCX; do not claim unimplemented formats. |
| DOCX selection/order | `buildShoppingExportCategories` keeps current category and product array order, filters checked products/nonempty categories, includes quantity. Client downloads `shopping-list-YYYY-MM-DD.docx`. | NAF-195: preserve category ordering and checked/quantity semantics; custom/modal sort is not currently applied separately to export array. |
| DOCX layout | `app/api/export-doc/route.ts`: landscape page, margins top700/right620/bottom620/left620; borderless single-row table, 1–4 columns computed by ceil(estimated lines/26), max4; category continuation headings, minimum3 items when splitting, checkbox text; title/summary/footer. | NAF-195: verify four-column case with enough content, not assume every export has four columns. Large lists overflow final column by current algorithm. |
| DOCX direction | Direction inferred from majority item-name direction, not UI language. Hebrew output uses RTL paragraphs and TextRuns, right alignment, Hebrew summary/continuation; table reverses logical columns **and** sets `visuallyRightToLeft`. Footer remains LTR. | NAF-195: inspect actual generated XML/rendered Word behavior for column direction/double reversal; no correctness claim from code inspection alone. |

## Visual and local behavior

`use-app-language.ts` stores `futurecart.appLanguage`, defaults to browser en/he
(otherwise Hebrew), and derives RTL/LTR; `lib/i18n.ts` drives most primary UI copy.
Some baseline history/edit-product/missing-product strings remain hardcoded in
English or Hebrew, so do not claim complete translation parity from a language
switch. `use-dark-mode.ts` stores `futurecart.darkMode`; page/cards use shared
`theme-classes.ts`, while many existing modal interiors intentionally use fixed
dark backgrounds. Preserve appearance before judging new changes.

Profile household and preferences sections collapse independently. Body scroll
locks while modals/drawer views are active through `use-body-scroll-lock.ts`.
Framer Motion animations, mobile bottom profile sheet, responsive category grid,
shopping drawer quantities/remove/export, existing feedback and confirmation
modals must remain shared across backend modes. NAF-195/182 require actual desktop
and mobile screenshots, English/Hebrew and light/dark; source review is not proof.

Sound choice is `futurecart.soundOn`, default true. `lib/app-sounds.ts` synthesizes
`tap/open/add/remove/quantity/success/delete/toggle`; missing-product flow uses
separate `lib/ui-sounds.ts` click/success/delete/error presets. Calls occur on
user actions. Reconciliation/callback/snapshot delivery must not replay them.

`lib/storage.ts` exports legacy category/list/history helpers. Current reachable
UI uses `saveHistory` (global `futurecart-history` cache), but not `loadHistory`,
`saveCategories` or category/list loaders. `hooks/use-category-product-actions.ts`
is unused legacy code with a constant HOUSEHOLD_ID. `createHistory` and
`getOrCreateCurrentHousehold` helpers are not current UI call paths. Do not treat
unused helpers as implemented user-facing features or revive unsafe constants.

## Adapter boundary checklist

All selected-backend data access must cover `lib/db/{categories,products,history,
households}.ts`, direct starter seeding in `lib/default-household-template.ts`,
and `lib/realtime/products-channel.ts`. Supabase Auth remains the trusted Dev
identity provider; `/api/export-doc` stays a DB-independent rendering endpoint.
No operation may write both business databases. Feature-off must independently
exercise original Dev behavior with pending IDs/committed Debian data retained.

Stage 3 proves transport/operation correctness, not parity of the above paths.
NAF-178 owns original-UI adapter/rollback proof; NAF-179 CRUD/move/order;
NAF-180 check/quantity/idempotency; NAF-194 identity/lifecycle; NAF-195 history/
exports/preferences; NAF-181 current-membership cross-device synchronization;
NAF-196 measured real UI responsiveness; NAF-182 comparative walkthrough; NAF-183
gate. Every row needs evidence before its owner issue is Done.
