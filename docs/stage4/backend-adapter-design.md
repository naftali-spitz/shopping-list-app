# Development application backend adapter

The existing shopping interface was moved intact from app/page.tsx into
components/shopping-app.tsx. The server page selects one backend using
stage4Enabled(): Stage3 resource/deployment guards plus SHOPPING_STAGE4_ENABLED=1
and the exact feature Preview branch. Client selection comes from that server
prop; no browser setting, invitation parameter or public build variable enables it.

Existing lib/db entry points dispatch to the selected backend. Supabase branches
retain their original operations. Home branches use lib/backend/home.ts and the
shared integration/stage3/client.ts. There are no dual business writes. Supabase
Dev remains the real identity provider and the existing durable gateway metadata
store; those metadata writes do not copy local business records into Supabase.
Starter seeding is also routed, closing a direct-write path outside lib/db.

The actual app and /stage3 now share one client implementation. Stage3 preserves
its old storage key; Stage4 adds :stage4 so two open surfaces cannot overwrite
one another's queue. Operations persist immutable IDs, payloads, expected versions,
correlations and deadlines before optimism; accepted/PUBACK is never Saved.
Reconciliation after expiry asks PostgreSQL's operation.status before showing
failure. Snapshots must meet the revision floor established by committed results.

Existing cards/modals/search/drawer/export/theme/language/sounds remain shared.
A small status line shows pending/Saved/conflict/failure without a screen overlay.
Development password login is added only to the experimental login card. The
existing Google button and original production path remain present.

Household IDs from a cache select command scope only. All commands verify the
current provider session and local PostgreSQL membership. Stage4 session-only
provider verification is necessary for PostgreSQL-only onboarding; Stage3 remote
membership verification remains unchanged. Account discovery and invitation join
use an actor scope. Restricted private lifecycle functions provision principal
mapping and journal business changes, result and outbox atomically.

Rollback disables the Stage4 flag and redeploys the feature Preview. It does not
delete local data, pending IDs or gateway results; existing callback/status
recovery stays available while new Stage4 command intake is disabled. Stage3's
independently tested infrastructure rollback remains a separate option.

Known limitations pending verification: same-namespace browser tabs need storage
event coordination; snapshots remain bounded by the existing callback limit;
physical Word column order needs visual inspection; Google Dev OAuth is not
configured. See feature inventory and test plan for acceptance, not this design
narrative.
