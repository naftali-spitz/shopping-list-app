# Stage 3 development integration

Worktree: `.worktrees/flespi-home-backend`, feature/flespi-home-backend,
upstream origin/develop, repository naftali-spitz/shopping-list-app, draft PR16.
Stage2 NAF-171 Done/CONDITIONAL GO independently checked before implementation.
Production is not a target. Stage4 remains gated by NAF-177.

## Authentication decision (NAF-172)

Owner chose simple login for testing on 2026-11-20, retaining Google later.
Use the existing FutureCart Dev Supabase Auth email/password provider, with three
dedicated test accounts. These are real provider accounts and sessions, not the
Stage2 fixture JWT issuer. Two users share development household A; the third
belongs to B. Google remains disabled; no Google success is claimed. Switching
to Google on this same project can retain the token/session verification path;
link identities explicitly rather than matching users by untrusted email.

The server-only identity adapter pins the development Auth and PostgREST URLs,
calls the Auth user endpoint, and calls stage3_dev_session_context. The narrow
RPC checks signed issuer/audience/role/expiry/subject, a current auth.sessions row,
user confirmation, anonymous/deleted/banned status, and current household membership.
The session RPC has no caller-supplied user, session or role. Its definer is needed
to inspect the protected session table; PUBLIC/anon execution is revoked, its
search path is pg_catalog, and every object reference is qualified. No admin
credential is sent to Vercel, Debian or browser for identity verification.

Vercel and Debian each verify the identity; Debian also locks current local
principal/membership rows in the existing transaction. Local membership remains
an independently enforced allowlist. A provider outage denies execution. Remote
verification is an admission check, not a distributed transaction with local
membership revocation: requests already admitted can finish. Revocation of a
pending, not-yet-admitted command is checked when it executes.

Passwords, access/refresh tokens and signing private keys are owner-only ignored
runtime files, never evidence. Provisioning used an ephemeral Ed25519-authenticated,
15-minute development Edge Function; after three accounts it was replaced by a
permanently disabled410 response with JWT protection enabled (version2). The
provider admin key remained only in its Edge runtime. Test email addresses are
reserved example.invalid addresses, administratively confirmed for this POC;
no mail was sent and no real user's email ownership was simulated.

## Alternatives and migration

Retaining existing Supabase Auth adds no identity service or paid resource and
uses existing browser refresh/logout machinery. Google needs a development OAuth
client/consent/redirect setup, so password testing does not claim Google parity.
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions) documents the
session row and JWT session_id. [getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
verifies with the Auth server; this alone does not establish immediate logout,
which is why the session-row check is mandatory.

Clerk is a separate managed identity option: its
[Hobby pricing](https://clerk.com/pricing) currently advertises a free tier with
50,000 monthly retained users; custom session lifetime is in Pro. It adds a new
account, subject mapping and browser/session migration, so it is not selected
merely to enable testing. [Better Auth](https://better-auth.com/docs/introduction)
offers application-managed sessions and social providers but adds auth database,
hosting, mail/provider configuration and security maintenance. Its library does
not eliminate those operational costs. No alternative provider was provisioned.

The replacement boundary is verifyDevelopmentIdentity → stable trusted principal,
session and household context. A future OIDC provider needs an explicit mapping
from (issuer,subject) to local principal UUID and equivalent revocation checks;
no decoded-only JWT or shared test password bypass is a migration strategy.

## Protocol and threat model

V2 commands bind version, key ID, pinned development issuer/audience, operation UUID,
correlation UUID, trusted user UUID, selected/authorized household UUID, typed payload,
expected version, issued/deadline milliseconds and provider token using Ed25519.
Creation validity is at most300s, matching MQTT expiry. Same-ID retries retain
intent, correlation, payload, version and deadline. The logical SHA256 excludes
only transport key ID/signature and renewable provider token. DB ledger uniqueness
and hash comparison resolve replays; changing logical intent under the same ID
conflicts. Expired intent may retrieve an existing result but cannot start a write.

Vercel command keys and Debian callback keys are separate. Verification key maps
support overlap during rotation; removing a key revokes it. Private material is
not part of those maps. Callback v2 binds the full authoritative result, issuer,
audience, fresh timestamp and delivery UUID. Timestamp tolerance is60s plus1s
future skew; each retry signs a fresh delivery attempt. Tuple checks bind the
callback to the previously accepted operation/user/household/correlation. Durable
terminal result equality/deduplication, rather than an in-memory nonce cache,
handles duplicate callback delivery. Actual cross-host initial clock skew still
requires operational verification.

| Threat | Enforcement |
|---|---|
| Browser supplies another user/role | Intent schema forbids these; identity comes from provider |
| Guessed household | Current provider membership and local transactional membership |
| Session expires/logout while pending | Current Auth/session check at execution, not cached getSession |
| MQTT token alone or Stage2 fixture issuer | V2 transport signature plus real pinned identity verifier |
| Payload tampering or wrong environment | Exact schema, typed payload, full signature and pinned issuer/audience |
| Duplicate/reordered intent | Durable global operation ID/hash and expected record version |
| Forged/cross-household callback | Separate key plus accepted tuple and immutable terminal result |
| Broker sees bearer token | Broker is a trusted TLS transport; scoped ACLs; no token/body logging |

## Evidence and reproduction

Run the existing preflight before any live work. Remote Vercel audit confirmed the
project/team/repository, main production branch, isolated Preview defaults/static
bundles and preserved production metadata. Actual DB identity query confirmed
shopping_stage0, shopping_stage2_runtime, PostgreSQL17 on127.0.0.1:55439.

```
node scripts/stage0-preflight.mjs
python3 scripts/stage0-vercel-audit.py
node scripts/stage3-auth-check.mjs
node --test integration/stage3/protocol.test.mjs backend/test/protocol.test.mjs
node backend/test/stage3-contract.mjs
```

The security suite currently has12passing tests. Live Auth report
attempts/auth-52dab5e3-6711-40ed-adfa-11aa01881381.json has7passing provider/session
groups. The initial auth run d5cd2512 failed because the invitation adapter used
the wrong existing field; it remains FAIL. Live direct contract report
attempts/contract-0adc7979-380f-43d1-958b-95692674c876.json has10passing groups:
durable acceptance, real identity/commit,8concurrent duplicate executions,
callback authentication/deduplication/household binding, result lookup and second
user snapshot. These direct tests do not claim MQTT, Vercel or browser execution.
Initial contract failures10bfb0d9 and1935542a are preserved. They exposed Date
canonicalization across JSON serialization; the shared canonicalizer now signs
PostgreSQL timestamps in their ISO JSON form, with a serialization regression test.

## Rollback

Stage3 uses a separate development flag and listener config. Existing Stage2
fixture service and database credentials remain available. Disable only the
feature branch Preview SHOPPING_STAGE3_ENABLED flag and dedicated Stage3 service;
retain operation ledgers, gateway results, outboxes, keys and test accounts for
reconciliation. Never drop data or reinterpret broker PUBACK as a commit. The
original application route remains available with its existing development
Supabase integration. Google provider remains unconfigured on that path.
