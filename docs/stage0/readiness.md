# Stage 0 environment verification and readiness report

Date: 2026-11-19. Decision: **NO-GO**. NAF-160 must remain incomplete.
Stage 1 has not started. Evidence belongs to Linear NAF-149–160 and these files.
All results below are scoped; a local pass does not establish remote readiness.

## Environment matrix

| Issue | Result | Actual resource and evidence | Remaining requirement |
|---|---|---|---|
| NAF-149 repository | PASS | GitHub naftali-spitz/shopping-list-app, ID 1239195094; HTTPS fetch; feature/flespi-home-backend based on origin/develop 88af18681659fe69b0f2ca3122bc308de563e54f; clean initial separate worktree | None for this issue |
| NAF-150 protections/CI | FAIL/BLOCKED | main and develop protected:false; rulesets []; detailed protection GET 403; no tracked .github workflow | Owner-approved repository protection policy and actual admin access; deployment mapping |
| NAF-151 Vercel | BLOCKED | Historical shopping-list-app in team 0012ab-5576s-projects; current connection lists zero projects, direct project/deployment GET 404 | Current project visibility, production branch, domains, preview URL, env targets and smoke |
| NAF-152 Supabase | PARTIAL/BLOCKED | Production inebdmynrfwmmxcyziyi; FutureCart Dev njomxqthjglqesxchlbm restored ACTIVE_HEALTHY; existing dev isolation SQL passes; zero rows/users remain | Prove preview targets dev exclusively; provider config and remote credential boundaries |
| NAF-153 Debian | PARTIAL/BLOCKED | Current host debian, Debian 13.7, uid1000 naf-w; 15GB disk free, about 27GB available RAM; dedicated process restart demonstrated | Intended deployment host confirmation; durable unprivileged service identity/boot startup; firewall/NAT evidence |
| NAF-154 flespi | BLOCKED | Existing shopping-mqtt-poc/src/poc.mjs found; token metadata GET returns HTTP400/code1004 Invalid or non-existing token | Dedicated dev account/token ACL/expiry and namespace; minimal exchange/reconnect/denial proof |
| NAF-155 PostgreSQL | PASS (local dev scope) | Separate PostgreSQL 17.12 cluster, 127.0.0.1:55439, shopping_stage0, role shopping_stage0_app; rollback/commit/restart/restore and privilege denials passed | Service boot/host mapping separately blocked in NAF-153 |
| NAF-156 auth inventory | PASS (plan scope) | auth-plan.md; dev tenant SQL suite passed | Actual OAuth/bridge implementation is not claimed |
| NAF-157 security | PARTIAL/BLOCKED | 15 local guard tests pass; private runtime modes 0700/0600; dev RLS and isolation suite verified | Remote least-privilege scopes, ACLs, firewall/NAT and provider boundaries |
| NAF-158 recovery | PARTIAL/BLOCKED | Custom-format local synthetic backup/restore and restart passed | Verified preview rollback, boot recovery and off-host backup |
| NAF-159 tooling | PARTIAL/BLOCKED | Node24.22.3/npm11.19.1/Git2.47.3/Next16.2.6; lockfile npm ci; build PASS; loopback HTTP200/404; AGENTS rules and tests; Linear writes verified | Lint baseline has 17 errors/1 warning; real preview/browser OAuth smoke and remote access |

## Repository and production baseline

Original checkout remains on local main 5f18c5e with its existing DOCX route edit,
DOCX file and verification-exports preserved. Fetched origin/main is
409eb9056bf59772c08e30e7939d10509d1d3b88. No commits/pushes/merges/checkouts
of main and no remote feature pushes were performed. Feature worktree is
`/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend`.
Origin remains the existing SSH URL. SSH fetch fails publickey authentication;
public HTTPS fetch works. Local gh authentication is invalid; the connected
GitHub integration supports reads but rejects protection administration reads.

Historical Vercel links from GitHub commit status:
- develop: https://vercel.com/0012ab-5576s-projects/shopping-list-app/F6psAnt3LMBxHQsUosQwcDH22Ay7
- main: https://vercel.com/0012ab-5576s-projects/shopping-list-app/A3CPtbgVJkQ3PagHjW8gkb8HkV8y

These are dashboard deployment records, not verified live preview URLs. Team ID
is team_h5ZyD1rMpbgnak6COakN03nD. Current 404 responses do not prove deletion;
project visibility/identity must be restored before any deployment or push.

Original .env.local points to production Supabase despite DEV_MODE=true. It was
not copied into the feature worktree. All local build/smoke work used only
127.0.0.1:54321 plus an explicit noncredential placeholder. No production SQL,
production OAuth settings, user data, Vercel configuration or shared MQTT token
was changed. One authorized dev-only service change: restored FutureCart Dev.

## Reproduce local checks

Run from the feature worktree, after branch/status/target inspection:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test scripts/stage0-preflight.test.mjs
node scripts/stage0-preflight.mjs --offline-build -- npm run build
node scripts/stage0-preflight.mjs --offline-build -- npm run start -- --hostname 127.0.0.1 --port 55440
npm run lint
```

HTTP smoke: GET / returns 200 and FutureCart metadata; unknown route returns 404.
Stop the test server afterward. This proves local HTTP rendering only, not a
browser sign-in, authorized data workflow, preview deployment or realtime flow.
Missing dev credentials make the default guard return BLOCKED as intended.
The guard is a local command wrapper and policy check, not a remote IAM/firewall
control or a replacement for provider verification. Opaque publishable key
ownership still needs provider evidence. Do not bypass it with direct commands.

The first sandboxed build failed because its CSS worker could not bind a socket;
the approved unsandboxed rerun passed. No config workaround was introduced.
Nested worktree lockfiles cause a Next workspace-root warning; the build passed
and no app configuration was changed. Confirm file tracing/root before deployment.
Lint reports 17 errors/1 warning in unchanged TSX/TS files (React effect/static
component checks and explicit-any). No lint rules were disabled. No acceptance
of this baseline deviation has been assumed.

Supabase existing suite: execute supabase/tests/authorization_isolation.sql only
against verified FutureCart Dev. It wraps synthetic fixtures in BEGIN/ROLLBACK.
Follow up with aggregate row counts: all six app tables and auth.users were zero.
Do not run against production, even though the script rolls back.

## Local database recovery and rollback

`python3 scripts/stage0-postgres.py` creates a NEW private cluster only when
.stage0-runtime is absent. It pins the existing PostgreSQL binary directory,
records exact 17.12 package version, writes new random SCRAM credentials to
0600 files inside a 0700 ignored directory, and uses TCP loopback port 55439.
It never connects to system port 5432. It verifies rollback, commit, administrative
and other-database connection denial, pg_dump custom format, pg_restore into
shopping_stage0_restore, exact synthetic row recovery, and persistence after
restart. It stops its server in finally. Inspect .stage0-runtime/result.json and
postgres.log. Successful run left no postmaster.pid. The first attempt failed on
a too-long Unix socket path; artifacts remain in .stage0-runtime-failed-start.
The corrected cluster disables Unix sockets and requires SCRAM over loopback TCP.

No existing shopping_poc or cashflow_engine database was altered. Existing system
PostgreSQL17-main listens localhost:5432. Current OS database role naf-w has no
superuser/createdb/createrole/bypassrls privileges. New app role likewise has all
four flags false and cannot connect to its isolated cluster's postgres DB.
Runtime admin is private and used only for cluster provisioning/recovery.

For another preflight run, preserve/review the stopped runtime before moving it
aside; the script refuses reuse. For diagnosis/start/stop use the installed
/usr/lib/postgresql/17/bin/pg_ctl with the exact .stage0-runtime/data path and
private log file, never /var/lib/postgresql/17/main. Use pg_dump -Fc and
pg_restore --no-owner --exit-on-error as the app role, with the private password
passed via environment, not command-line/Linear. Full app schema is Stage 2.

Proposed dev backup retention: daily, seven local copies, test restore after each
schema change. Current artifact is synthetic only; no automatic retention job or
encrypted off-host copy exists. Host/disk loss remains unrecovered. Do not claim
full operational DR until off-host storage and service boot recovery are verified.
Use request/operation IDs and sanitized journald/app logs for future MQTT/DB
correlation; never log tokens or complete auth/request payloads.

Rollback local source edits: review git diff and revert only the files introduced
by this preflight; preserve unrelated original checkout edits. No remote deployment
rollback has been tested. Removing this worktree/feature ref requires checking
its uncommitted artifacts first. FutureCart Dev was unpaused; do not re-pause an
active shared dev project without checking current users and receiving approval.

## Access/security gaps and concrete next actions

1. Restore Vercel access to the identified existing project; inspect production
   branch, preview URLs, environment names/scopes and nonproduction targets before
   pushing this branch. A 404 is not permission to recreate a project.
2. Review/authorize GitHub main/develop protection policy and supply a connection
   capable of applying/verifying it. Repository metadata reports unprotected
   branches; no repository-wide policy was changed without approval.
3. Supply valid dedicated flespi dev token(s) through a private credential file,
   with ACL/account/expiry metadata. Current token is invalid; cannot be used to
   create scoped replacements. No broker messages sent.
4. Confirm intended Debian deployment host and authorize only the dedicated
   unprivileged service/boot setup; inspect firewall/NAT without modifying shared
   network rules. Preserve NoMachine, desktop, Docker, nginx, Samba, Ollama,
   existing port3000/4000/7001 and unrelated workloads. No WAN scan was attempted.
5. Verify FutureCart Dev Google provider, exact OAuth callbacks and preview
   redirects, dev-only keys and synthetic account sign-in. Provider settings are
   unavailable in the current connector. Inventory and design are in auth-plan.md.
6. Resolve or explicitly disposition existing lint failures; verify preview
   rollback and operational recovery. Publish evidence, then reassess NAF-160.

TLS MQTT/HTTPS, dedicated callback signatures, timestamp/nonces, durable operation
IDs, household membership checks, rotation and rate limits are required designs,
not implemented/verified controls. Home-network failures, broker expiry/storage,
long-lived sessions and database commit ambiguity remain risks. No account scopes
were expanded, paid plans purchased, firewall changed or unrelated service stopped.

Official references checked:
- https://supabase.com/changelog.md (CLI v3 behavior changed; no CLI migration run)
- https://flespi.com/kb/tokens-access-keys-to-flespi-platform
- https://flespi.com/mqtt-broker
- https://flespi.com/kb/how-flespi-pricing-works

The readiness decision is NO-GO until every critical row above passes. This report
and any future Stage 0 GO never authorize a production migration.
