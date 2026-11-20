# NAF-156: identity and household authorization preflight

Verified against develop `88af18681659fe69b0f2ca3122bc308de563e54f` on 2026-11-19.
This is a Stage 0 design/inventory; implementation remains gated by NAF-160.

## Current flow and dependencies

`components/auth-button.tsx` calls Supabase Google OAuth and requests a redirect
back to the current browser origin/path/query. `hooks/use-session.ts` reads the
browser session and listens to Auth state changes. That session is UI state; it
is not sufficient proof for a new server backend. `lib/supabase.ts` creates one
browser client from public URL/anon-key variables.

`lib/db/households.ts` calls get_or_create_current_household, list_my_households,
create_household, delete_household, create_household_invite and
accept_household_invite. categories/products/history use direct table operations
and RPCs; product authorization follows its category's household. The checked-in
baseline and later migrations define six RLS tables, membership checks and
SECURITY DEFINER functions. The September hardening constrains history JSON
product IDs to the caller's household and authenticates helper RPCs.
`lib/realtime/products-channel.ts` listens to product changes without a client
household filter; database/RLS enforcement remains the security boundary.
Storage is not referenced by the inspected application Supabase calls.

FutureCart Dev (`njomxqthjglqesxchlbm`) is restored and healthy. Its existing
transactional `supabase/tests/authorization_isolation.sql` passed through the
project-specific connector. Follow-up counts: zero auth users and zero rows in
households, household_members, categories, products, shopping_history and
household_invites. All six application tables report RLS enabled. No production
SQL was executed and no production data was copied.

Security advisors report households has RLS with no policy (intentional direct
SELECT denial, exercised by the suite), six anon-callable definer functions and
eight authenticated-callable definer functions. Callability alone is not proof
of an exploit: inspect each auth/membership guard and retain explicit denial
cases before any later integration. Do not disable RLS to silence warnings.

## Development identity plan

1. Keep Supabase Auth during the POC using FutureCart Dev only, with synthetic
   accounts. Confirm a development Google OAuth client/consent configuration,
   Google callback `https://njomxqthjglqesxchlbm.supabase.co/auth/v1/callback`, and
   exact isolated preview/local redirect allowlist. Actual provider settings are
   not available through the current connector; browser sign-in is unverified.
   No production OAuth configuration change is authorized.
2. The Vercel API verifies the access token's signature, approved algorithm,
   issuer, audience and expiration with the dev issuer's trusted verification
   mechanism. Never authorize from getSession(), decoded-only JWT claims,
   user_metadata or a supplied user/household ID. Private keys/service-role
   credentials stay server-side. Reverification/revocation requirements must be
   explicit for sensitive actions.
3. Debian independently verifies trusted identity (dev JWT against its issuer),
   validates the signed transport envelope and looks up current local membership
   for every operation. Resource UUIDs are constrained through category/household
   joins in the same transaction. Revoked membership must deny even an unexpired
   JWT. Roles/ownership come from trusted database records.
4. MQTT credentials grant transport only. Use distinct server-only signing keys
   for authenticated envelopes, pinned intended audience/environment, body hash,
   operation ID, nonce and short validity window. Persist deduplication/replay
   decisions. Never infer a successful commit from MQTT QoS acknowledgment.
5. Authenticate callbacks with a separate rotated server-only signature over the
   exact body, operation ID and timestamp. Reject stale/duplicate/foreign-audience
   callbacks; persist the result before browser retrieval. Result lookup and
   realtime delivery recheck user/household authorization. No shared browser MQTT
   credential, caller-selected callback URL or caller-supplied privileged role.
6. Eventual replacement of Supabase Auth requires a separately verified dev OIDC
   issuer, stable subject mapping and equivalent checks. Do not migrate live users
   or reuse production provider secrets in this project.

## Authorization test matrix

| Principal/action | Expected | Current evidence / later test |
|---|---|---|
| No/invalid/expired/wrong-issuer JWT | Reject before publish/DB work | Future API/bridge test; not implemented |
| A reads A's categories/products | Only A rows | Existing dev SQL suite passed |
| A reads B's categories/products | Zero rows | Existing dev SQL suite passed |
| Direct households access | Deny by default | Existing dev SQL suite passed |
| list_my_households as A | A only | Existing dev SQL suite passed |
| A inserts history for B | Denied | Existing dev SQL suite passed |
| A invokes helper RPC for B | Denied | Existing dev SQL suite passed |
| A's history contains B product ID | B usage count unchanged | Existing regression passed |
| Forged household/product ownership | Deny every CRUD path | Expand later dev API/DB matrix |
| Invite absent/expired/reused/foreign ownership | Deny; valid invite grants intended household only | Later fixture tests; provider/config required |
| Revoked membership + old JWT | Deny reads/writes/events/results | Later integration test |
| Valid MQTT token + forged identity/envelope | Deny | Later integration test |
| Replayed request/callback, wrong audience | Reject or return prior durable result | Later integration test |
| Cross-device event/result as B | No A payload or result leakage | Later integration test |

No authentication bypass is proposed. The later environment audit verified
Preview isolation and disabled dev Google provider. Actual Google sign-in is an
explicit nonblocking baseline limitation for this transport/environment stage;
a working trusted identity flow remains required before application integration.
This issue delivers a design and inventory, not an implemented replacement.

Follow-up environment verification: dev `/auth/v1/settings` returns200 with
Google provider disabled. Anonymous Preview shell smoke passes; no Google sign-in
is claimed. The owner clarified development need not retain Supabase, so no
production OAuth credentials/provider settings were copied or altered. The trusted
identity plan above remains a requirement for later implementation; a disabled
baseline provider is not permission to bypass authentication.
