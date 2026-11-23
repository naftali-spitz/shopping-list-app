# Stage 4 identity and household lifecycle

## Authority and unchanged Stage 3 path

The real Shopping List root route uses the same Supabase Dev email/password
sessions already provisioned in Stage 3. No test-account recreation, password
reset, anonymous session or bypass was introduced. The existing Google button
continues to call `signInWithOAuth({provider:'google'})` and preserves the current
origin/path/query redirect. Production configuration was not changed.

Stage 3's unprefixed commands retain the original remote current-session plus
Supabase-household-membership check. Stage 4 commands use a signed `stage4.`
namespace. At Vercel, gateway and Debian, the new
`stage4_dev_session_context()` RPC verifies the real current provider session,
confirmed identity, issuer, audience, anonymous/ban/deletion status and expiry.
It makes no membership claim. PostgreSQL transactionally authorizes the selected
household against its own active membership and principal mapping.

This separation is required for PostgreSQL-only households: mirroring business
households into Supabase to satisfy Stage 3's existing FK would produce two
business authorities. The development gateway metadata household FK was removed;
its `auth.users` FK, forced RLS and restricted immutable acceptance/result RPCs
remain. Local operation journaling similarly permits account-scoped discovery
and invite acceptance before a household exists. Business rows still retain their
household foreign keys. No production migration was run.

`backend/migrations/005_stage4_household_lifecycle.sql` adds a private fixed-search-
path lifecycle function. The restricted runtime role has no direct membership
INSERT and no superuser/BYPASSRLS rights. Identity mapping is issuer plus verified
provider subject, never browser email or user metadata. An inactive mapping is
not reactivated by login. `006` adds own-outcome reconciliation after revocation
or before household creation; `007` preserves trusted starter category order.
All applied migration checksums are retained in raw migration reports.

## Existing policy and implemented flows

The prior Supabase application uses reusable, 14-day invitations created by a
current member. The PostgreSQL implementation preserves this policy. Knowledge
of a token grants no unauthenticated read: acceptance requires a verified current
identity and creates one active local membership transactionally. Duplicate
acceptance does not create duplicate membership. Invalid, expired, revoked or
foreign invitations do not enroll a user. Removal blocks fresh household reads
and writes; an otherwise valid reusable invitation can be accepted again, as in
the existing invitation policy. Revoke the invitation when continued rejoining
must be prevented.

The root app preserves create/switch/delete/invite controls. Stage 4 adds owner
rename and member listing/removal inside the existing profile expansion. Members
are displayed by their stable provider principal ID (first eight characters,
full ID in the title), not by an invented email display mapping. This is a known
identity-display limitation. Owner-only rename/removal/delete is enforced by
PostgreSQL. New household defaults are a trusted server template: five categories
and 27 products, English or Hebrew, with atomic seeding and preserved ordering.

Durable acceptance, operation-ID binding, expected versions and result/outbox
commit are shared with Stage 3. After local membership removal, an actor may
recover **their own immutable prior operation outcome**, including a previous
snapshot's bytes, while their provider session remains valid. This is required
to reconcile an operation that committed before removal. It is not fresh access:
new snapshots and mutations require current membership. Logout/session expiry
blocks gateway status retrieval as well. Do not describe this as retroactive
revocation of data already read or previously committed outcomes.

## Existing backend evidence

- `attempts/lifecycle-6d569014-942f-4833-aa0b-e53d38c7a1f0.json`: 12 actual
  provider/gateway/PostgreSQL groups passed, including duplicate invite use,
  forged/revoked/expired tokens, two-member access, third-user denial, membership
  removal while an accepted write was pending (zero product effect), logout,
  role/RLS checks and retained soft deletion. This is backend evidence.
- `attempts/reconciliation-efca70b9-b657-4ef7-991d-79cb1da4c870.json`: six actual
  provider/gateway/PostgreSQL groups passed, including exact starter ordering,
  account-scoped and nonexistent-household reconciliation, foreign outcome deny
  and historical-own-result recovery after deletion. This is backend evidence.
- `attempts/household-browser-a7cec2a9-f52c-4154-9d0d-58bb1c52d02b/report.json`:
  fourteen actual original-UI browser groups PASS on Git Preview
  `7ab774d2543f28a979e43f1d27ba4867dfe238aa`. Three existing identities log in;
  English and Hebrew defaults preserve five categories/27 products and category
  ordering, owner rename survives reload, clipboard invitation joins a second
  browser, duplicate acceptance preserves one membership, invalid/expired links
  do not enroll the third user, profile displays stable member IDs, third-user
  fresh read is forbidden, owner removal blocks fresh reads and removed-user
  refresh, and list switching/refresh retrieve the authoritative list. Screenshots
  include member view and Hebrew defaults. Final browser contexts were closed.
  Global UI logout was deliberately omitted while other test clients could share
  accounts; dedicated-session logout below is separately evidenced.
- Earlier household browser selector/target/process failures remain separately
  preserved under `attempts/household-browser-*`, including the partial eleven-
  group run. A persistent-profile expansion selector was corrected in the
  harness; its incomplete run is not relabeled as a full PASS.

## First-seen provider mapping rehearsal

`attempts/identity-rehearsal-6774e72d-5dc2-4ed2-ac0d-9e2e847e38f2/report.json`
passes four groups in the existing **marked disposable** `shopping_stage2_rebuild`
database on `127.0.0.1:55439`. A verified session of an already provisioned Dev
account had no local principal there. Account discovery inserted the issuer/subject
mapping automatically; creating a household committed exactly one owner membership,
ledger and outbox, and duplicate execution returned the same outcome. Discovery
then returned the local-only household without any Supabase business-household
mirror. This proves the first-mapping branch with a real provider identity; it is
not a new account signup or browser first-login claim. The main development DB and
all prior Stage2 evidence were preserved.

## Current-session boundary reproduction

`scripts/stage4-session-boundary.mjs logout` uses a fresh dedicated session for
one existing account and logs out only that session with `scope=local`.
`arm-expiry`/`check-expiry` permit an exact-session controlled `auth.sessions.not_after`
expiry in Supabase Dev, with the pending signed intent and credentials held only
in an owner-only ignored state file. The check requires a state created within four
minutes, rejects new API/gateway acceptance and local execution, and verifies zero
business/journal/outbox effects. These scripts do not reset passwords, create
accounts, revoke global sessions or change production. Raw evidence:

- `attempts/session-boundary-437418ed-6122-4548-8ce4-d5f93ad04aa2/report.json`:
  seven groups PASS for dedicated `scope=local` logout.
- `attempts/session-boundary-8d67755f-7992-4025-919d-009541a9ac8c/report.json`:
  five groups PASS after exact-session deadline expiry. The signed JWT and
  operation's own natural deadlines were still valid, isolating the session gate.
- `attempts/session-expiry-control-64621a7c.json`: one exact freshly created Dev
  session changed; no other sessions/account credentials changed.

Both paths reject current provider verification, local execution and gateway
acceptance, return actual protected Vercel HTTP401, and produce zero household,
operation-ledger and outbox rows. The signed pending intent was prepared before
invalidation and **was not durably accepted**; this evidence must not be described
as a post-acceptance race test. The separate lifecycle backend suite proves the
accepted-then-membership-removed boundary.

## Exact Google Dev OAuth dependency

Read-only `GET https://njomxqthjglqesxchlbm.supabase.co/auth/v1/settings` on
2026-11-21 returned HTTP200 (raw report `attempts/google-settings-925b44c7-b058-46d0-a861-f3f5f389e952.json`), `external.google=false`, `external.email=true`.
This confirms Google Dev sign-in is unconfigured; no Google success is claimed.
No owner action is needed to continue password-based functional work.

When ready, the owner of the Google Cloud OAuth application must authorize a
**development** OAuth web client and its consent/test-user settings, with the
Supabase development callback:

`https://njomxqthjglqesxchlbm.supabase.co/auth/v1/callback`

The owner must configure that development client ID/secret in **FutureCart Dev**
project `njomxqthjglqesxchlbm` under Auth → Providers → Google. Keep production
client/project settings unchanged and do not paste the secret into chat or Git.
Then allow the exact feature Preview origin and its intended redirect paths
(including the `/?invite=...` journey) in the Dev Auth URL configuration:

`https://shopping-list-app-git-feature-fles-b8db25-0012ab-5576s-projects.vercel.app/`

A narrowly scoped path pattern for this one origin can preserve query-bearing
invite redirects; do not add an all-domain wildcard. The application already
passes its current origin/path/query as `redirectTo`. After configuration, run
an actual Google sign-in, return-to-invitation, membership creation, logout and
cross-household denial walkthrough before claiming Google parity. Required
owner work is external Google account/client authorization, not retrieval or
reset of the existing Stage 3 password accounts.

Configuration guidance checked against the official
[Google sign-in guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls).

## Rollback

Disable only `SHOPPING_STAGE4_ENABLED` for the feature Preview and rebuild that
verified branch. The root route returns to the original Supabase Dev adapter.
Retain PostgreSQL rows, memberships, ledgers, outboxes, pending browser IDs and
keys. Callbacks/status for prior accepted operations remain available; new Stage4
commands are disabled. Re-enable the compatible feature deployment to reconcile.

## Completed actual UI logout

`attempts/reliability-browser-45984ea1-8066-4e6e-94f1-1ca3f4383692/report.json`
passes the focused actual profile Logout action with other sessions for that
account idle. The original global sign-out policy remains unchanged. The UI
returns to the real login form, clears rendered household data, and a fresh
command using the prior browser token receives HTTP401 with no operation ledger
row. The first focused run d28855bb used a nonexistent status ID, which returns
404 before an operation-bound identity check; that assertion failure is preserved.
The corrected probe exercises new command admission explicitly.
