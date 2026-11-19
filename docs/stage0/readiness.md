# Stage 0 Environment Verification & Readiness

2026-11-19. **NO-GO: NAF-154 broker authorization and NAF-157 broker security
checks remain incomplete. Stage 1 has not started.** This report supersedes the
initial access-blocked snapshots, retained in Git/Linear history.

## Verified environment

| Component | Actual development target | Production boundary |
|---|---|---|
| GitHub | naftali-spitz/shopping-list-app; base develop; feature/flespi-home-backend | main code was never checked out, pushed or merged |
| Worktree | /home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend | Original checkout and DOCX edits preserved |
| Vercel | prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM, team_h5ZyD1rMpbgnak6COakN03nD / 0012ab-5576s-projects | Existing project, no replacement |
| Dev URL | https://shopping-list-app-git-develop-0012ab-5576s-projects.vercel.app/ | No production alias change |
| Production URL | https://shopping-list-app-eta-ten.vercel.app/ | Deployment dpl_A3CPtbgVJkQ3PagHjW8gkb8HkV8y unchanged |
| Supabase baseline | FutureCart Dev njomxqthjglqesxchlbm | inebdmynrfwmmxcyziyi never used for SQL/test writes |
| Local PostgreSQL | 127.0.0.1:55439, shopping_stage0, shopping_stage0_app | Existing localhost:5432, shopping_poc and cashflow_engine untouched |
| Debian | debian, Debian13.7, unprivileged uid1000 naf-w | No shared service stopped; no host reboot/firewall change |
| flespi | Reserved shopping-poc/naf-stage0-041d4f122bdd | No broker message or token mutation; saved credential invalid |

## Issue results

| Issue | Current evidence/result |
|---|---|
| NAF-149 | PASS: repository ID1239195094; feature based on origin/develop88af18681659fe69b0f2ca3122bc308de563e54f, upstream origin/develop, ancestry verified |
| NAF-150 | PASS: owner-approved PR requirement on main/develop, administrators enforced, force-push/deletion denied, zero reviewers for solo ownership; live API readback |
| NAF-151 | PASS: official CLI login repaired access; actual project/repository/branch/alias verified; Preview credentials separated; Preview rebuilt and browser/static smoke passes |
| NAF-152 | PASS: explicit dev/prod matrix, dev-only key source, production-target denial, dev tenant-isolation SQL suite passed with zero residual rows/users; no production database change |
| NAF-153 | PASS: dedicated user service, private directories, loopback-only port, resource controls, normal restart and crash recovery; owner approved Linger=yes for unattended startup |
| NAF-154 | BLOCKED: existing token invalid; no valid dedicated publisher/listener credentials or ACL/connect/exchange/denial evidence |
| NAF-155 | PASS: installed PostgreSQL17.12, separate data/roles, SCRAM, least-privilege denials, transaction/commit/restart/backup/restore |
| NAF-156 | PASS: inventory and trusted identity plan in auth-plan.md; no replacement auth implementation claimed |
| NAF-157 | PARTIAL/BLOCKED: cloud/env/DB/credential boundaries verified; flespi ACL/account/expiry and negative tests still missing |
| NAF-158 | PASS: safe Preview rollback and return, custom-format synthetic DB restore, automatic crash recovery, scheduled local backups; off-host limitation documented |
| NAF-159 | PASS: tooling/policy/build/browser checks and development CI pass; draft PR16 into develop |
| NAF-160 | NO-GO; cannot mark Done or start Stage1 while critical broker prerequisites remain unresolved |

## Access repair and approved scope changes

Vercel CLI66.2.0 was absent; installed in the separate user-owned
/home/naf-w/.local/share/shopping-list-tools with exact package-lock integrity.
Started official device login; owner approved in their browser. CLI verifies
0012ab-5576 has OWNER access to the expected Hobby team. The connected plugin
still had visibility failures, so the authenticated official CLI is the working
path. Local gh CLI access also verifies the repository and protection settings.
No passwords/PATs/2FA codes were requested in chat.

Linked only this feature worktree to the verified existing project. The CLI
created a fresh worktree-only .env.local with its development OIDC token;
subsequent explicit Development pulls supplied the verified dev URL/publishable
key. Files are0600; .vercel and private runtime files are ignored. The original
checkout .env.local was never loaded/copied/sourced. DEV_MODE does not establish
isolation. POC_APP_URL records the exact required dev URL locally; re-add it after
a future env pull because Vercel replaces the file.

Actual initial project settings had Supabase variables jointly scoped to
production+preview. GET-only inspection of the old preview's eight JS bundles
proved a production Supabase hostname was compiled into the dev app. Functional
testing of that build was prohibited.

The user authorized removing/changing dev's Supabase connection while preserving
production. Removed ONLY the Preview scope from original production entries
Pf068enU5tISIkB4 and69Svu0hHDycdnoYb; no value field was submitted. Compared
IDs/types/opaque stored-value fingerprints and production deployment ID before
and after: unchanged. Added separate Development and Preview-only values from
FutureCart Dev, plus develop-specific overrides. Feature-specific add initially
failed because the branch was not remote; did not push into the unsafe fallback.
After scope separation, effective feature Preview pull resolves to dev only.
Native CLI rejected a missing Preview-default row as already existing, so used
the documented create-env API with target[preview] and NO upsert. Existing
production entries were never overwritten or decrypted.

Rebuilt only existing develop source88af186 with explicit Preview environment.
First safe build: dpl_GcptEvxM2TyEGoSJKUCMeK8tyV7o. Second safe build:
dpl_EeL6gzAPKg9SY5r2TC5uZX4SvRjd. Reassigned ONLY the exact develop alias to the
first safe build and back to the second; readback proves rollback/return.
Never roll the dev alias back to the old production-compiled build.

Static audit confirms only njomxqthjglqesxchlbm.supabase.co in served bundles.
Anonymous browser smoke returns200, FutureCart/login screen, no page errors and
no attempted production requests. Vercel protection remains enabled; used CLI
curl and an origin-scoped dev OIDC header, never a global browser auth header.
Details: vercel-isolation.json, preview-browser.json, preview-recovery.json.

## Local services and recovery

The separate PostgreSQL17.12 instance uses SCRAM, TCP loopback55439, no Unix
sockets, private0700 runtime and0600 credentials/dumps. App role has no superuser,
createdb, createrole or bypassrls. CREATE DATABASE, SET ROLE admin and access to
cluster postgres DB were denied. Synthetic rollback/commit and exact restored
row checks pass. Full business schema remains Stage2 work.

Installed user units (copies in systemd/):
- shopping-list-stage0-postgres.service: uid1000, NoNewPrivileges,256MB memory,
  20% CPU,64 tasks; Restart=on-failure; only the dedicated data directory.
- shopping-list-stage0-backup.service and .timer: daily custom-format pg_dump,
  private local files, retain seven successful copies. Manual timer service run
  and restore into shopping_stage0_restore passed.

Normal service restart and a targeted SIGKILL of the verified dev main PID both
recovered automatically and preserved the committed synthetic row. Service is
currently active. The user explicitly approved enabling lingering; loginctl
reports Linger=yes, so enabled user units can start at boot without a login.
No actual reboot was performed because unrelated desktop/home workloads must be
preserved. Existing failed xfce4-notifyd user unit was observed and left alone.

No encrypted off-host copy exists: host/disk loss is NOT covered. This is an
explicit Stage0 limitation, with recurring/off-host operations evaluated in
later stages. Journald, dedicated unit status, private PG logs and operation-ID
correlation are the diagnosis paths; never log auth headers or full credentials.

## Tooling, guards and baseline checks

Node24.22.3/npm11.19.1/Git2.47.3/Next16.2.6; npm ci --ignore-scripts passed.
Pinned external tools: Vercel66.2.0, Playwright-core1.65.1 with installed Chrome.
Relevant installed Next docs read before edits; application TSX/business code is
unchanged. Current dev-target build and type checking pass. 55 guard tests pass;
changed JS lint clean. Preflight verifies actual cwd/root, origin fetch+push,
branch/upstream/develop ancestry, exact URL/project IDs, both env load orders,
public key role/project, DB targets, external env symlinks, and fresh provider
isolation evidence including exact dev key fingerprint. It allows only local
build/loopback smoke commands, never push/deploy. Passing it is NOT a Stage0 GO.
Provider evidence expires after six hours; regenerate through the audit script.

New .vercelignore excludes local credentials, databases and browser profiles from
CLI uploads. No secrets go into CI or artifacts. Development-only GitHub Actions
workflow targets PRs into develop, with pinned official action SHAs and Node,
55 denial tests, changed-script lint, and an inert loopback-placeholder build.
It does not deploy or run on main.

Full application ESLint has a pre-existing17 errors/1 warning in unchanged files:
React effect/static component checks and explicit-any. These remain visible in
lint-baseline.json; no rules were disabled. Treat as a nonblocking baseline style/
type-policy deviation for this infrastructure POC because build/typecheck,
tenant isolation, guard tests and read-only smoke pass; no new app code depends
on suppressing it. This does not waive broker/auth/security/recovery prerequisites.

## Remaining authorization blocker

flespi account metadata rejects the saved POC token (HTTP400/code1004 invalid or
non-existing token). No messages sent. No available flespi integration returned
from directory searches. Official realm OAuth needs an existing configured realm;
the user does not know one. Opened official account login in an isolated Debian
browser; user cannot access that desktop, so that unauthenticated browser was
closed. Credentials, not a login itself, are sufficient. Never ask for tokens,
passwords or 2FA codes in chat. Reserved namespace and exact least-privilege role
matrix are in flespi-authorization.json. Accept only a private credential source,
then verify account/expiry/ACL, connect/pub/sub/ack/reconnect and foreign-topic
denial. QoS ACK is not DB commit. Stage1 load/fault suites remain prohibited.

## Reproduction and rollback (agent-owned operations)

From this worktree after checking branch/status/targets:

```sh
node --test scripts/stage0-preflight.test.mjs
python3 scripts/stage0-vercel-audit.py
node scripts/stage0-preflight.mjs -- npm run build
python3 scripts/stage0-backup.py
systemctl --user status shopping-list-stage0-postgres.service
systemctl --user list-timers shopping-list-stage0-backup.timer
```

These are runbook commands for the agent, not work delegated to the user.
The Vercel audit requires official login plus the private dev-key metadata input;
never substitute the original production env. It reads provider metadata, pulls
only dev/Preview files, and checks static bundles without executing browser writes.
Native Vercel curl incorrectly forwards --non-interactive to curl; the script
omits that redundant flag only for curl and preserves explicit team/URL targeting.

To revert local service setup: stop/disable ONLY the two shopping-list-stage0
units/timer, remove ONLY their copied user-unit files after review, reload user
manager. Linger rollback is loginctl disable-linger naf-w only after checking
whether other user services now depend on it and obtaining approval. Preserve
runtime backups/data before moving this worktree, because units use its exact
path. Never operate on /var/lib/postgresql/17/main.

To revert dev environment configuration, remove/replace only new Preview and
Development entries with another isolated backend; do not reintroduce production
credentials to Preview. Source rollback uses reviewed feature-only commits or
patches, never resets the original checkout. Production branch/alias/secret
values remain unchanged; owner-approved GitHub branch protections are intentional
policy changes and should not be removed incidentally.

Draft PR: https://github.com/naftali-spitz/shopping-list-app/pull/16 (develop base, draft; no merge).
Initial setup head2c7d92c passed guard-and-build in34s:
https://github.com/naftali-spitz/shopping-list-app/actions/runs/44583991073/job/135771873623
Vercel Preview checks passed; feature-preview.json independently verifies its
feature/flespi-home-backend provenance and dev-only served bundles. Main refs
were not pushed or merged. HTTPS Git credential helper was configured through
gh auth setup-git; origin URL itself remains unchanged.

Every issue has evidence in Linear. Stage0 remains NO-GO until all critical
prerequisites pass; a future GO is never production migration authorization.
