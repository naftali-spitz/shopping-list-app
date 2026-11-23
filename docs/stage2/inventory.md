# Stage 2 inventory and behavior mapping

Reviewed repository HEAD f5253f0 after NAF-165 CONDITIONAL GO/Done06:25:58Z.
Sources: lib/db/{products,categories,history,households}.ts, types/shopping.ts,
lib/realtime/products-channel.ts, all six supabase/migrations SQL files, existing
authorization_isolation.sql and docs/stage0/auth-plan.md. Schema source already
exists in the repository; no production database connection or data copy occurred.
No reusable home-db.mjs was found in the prior shopping-mqtt-poc directory.

| Existing feature/dependency | Local PostgreSQL / protocol mapping | Later obligation |
|---|---|---|
| Google OAuth/browser session | Separate verified Ed25519 fixture JWT issuer + signed backend envelope for synthetic development principals | Real dev issuer/session/revocation/Vercel verification in Stage3; fixture keys never authenticate live users |
| Households/membership roles | households/principals/household_members; current active principal+membership row locks per request, including cached-result/status reads | Provisioning/create/list/delete household API and identity mapping adapter in Stage3–4 |
| Invitations | household_invites reserved table stores token hash rather than plaintext | Owner/member invite policy, acceptance/revocation/expiry flows require Stage4 implementation/testing; no invite operation exposed now |
| Categories CRUD/icon | category.create/update/delete, versioned rows; delete tombstones category and products | UI adapter and icon normalization parity |
| Products CRUD/checked/quantity/order/category move | product.create/update/delete with validated typed patch and expected record version; composite category/household FK | Optimistic UI, batch reorder adapter and conflict presentation |
| Fetch categories/products/history | Authenticated snapshot returns consistent current household revision and nondeleted rows | Pagination/delta cursors/response size bounds before realistic large households |
| Export shopping list | list.export with expected household revision; checked=false, usage increment, immutable history snapshot, operation result/outbox atomically | Document/download generation stays existing frontend; no frontend route changes |
| History delete and restore | history.delete decrements usage only in the same household; list.restore checks all product IDs and household revision | UI history adapter; product-name matching helper adapter remains Stage4 |
| Realtime products channel | Durable result_outbox + authoritative snapshot/status; no assumption of ordered MQTT or exactly-once delivery | Household-authorized event/callback storage and cross-device browser subscriptions in Stage3–5 |
| Browser local storage/pending state | Protocol specifies persisted pending ID/hash/version/deadline/correlation; only committed authoritative result is saved | Durable pending frontend queue, safe same-ID retry/status/sync still unimplemented |

The September hardening fixes a history JSON foreign-product authorization bug;
local history effects always include household predicates and RLS. Legacy grants
to anon/authenticated are not copied. This is a new private shopping schema, not
a production schema migration. Tombstones prevent record-ID resurrection and
preserve operation-result history. Quantity remains numeric(10,2), minimum1;
checked retains the application's meaning of selected for the shopping list.

The development POC implements the transactional shopping core, not complete
Supabase RPC/frontend parity. Reserved invite schema and documented adapters are
explicit later-stage gaps, not claimed complete functionality.
