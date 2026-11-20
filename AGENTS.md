<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Shopping List — Home Backend & flespi POC

## Mandatory targets and gates

- Repository: `naftali-spitz/shopping-list-app` (ID1239195094).
  Origin fetch/push must be its exact SSH or HTTPS `.git` URL.
- Development base: `develop`, NEVER `main` or older `dev`.
  Working branch: `feature/flespi-home-backend`, upstream `origin/develop`;
  `git merge-base --is-ancestor origin/develop HEAD` must succeed.
- Run from `/home/naf-w/projects/self/shopping-list-app/.worktrees/flespi-home-backend`.
  Check actual cwd, branch, HEAD, remote, status and resource target before mutations.
  Preserve original checkout/DOCX changes; never reset/stash/discard them.
- Existing Vercel project: `shopping-list-app` / `prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM`.
  Team: `0012ab-5576s-projects` / `team_h5ZyD1rMpbgnak6COakN03nD`.
  Development URL: `https://shopping-list-app-git-develop-0012ab-5576s-projects.vercel.app/`.
  Production URL (hands off): `https://shopping-list-app-eta-ten.vercel.app/`.
  Production branch remains `main`; use explicit project/team/environment/URL.
  Never create a replacement project on a visibility/auth failure.
- Supabase development: `njomxqthjglqesxchlbm` / FutureCart Dev.
  Production: `inebdmynrfwmmxcyziyi` — NO writes or user-data copies.
  Supabase is an isolated interim baseline, not a required final dev backend.
- NAF-149–159 must pass, then NAF-160 must record GO and be Done before Stage1+.
  Stage0 passed: NAF-160 GO/Done2026-11-20T00:54:50Z, gate.json records evidence.
  Stage1 NAF-165 is currently NO-GO: session-expiry discrepancy in NAF-162.
  Do not begin Stage2 until NAF-161–164 pass and NAF-165 records GO/Done.
  Local guard/CI/build success alone does not authorize Stage1 or migration.
- No main checkout/commit/push/merge, production deploy/promotion/domain/secret
  changes, shared token changes, paid plan or unrelated service disruption.
  Feature pushes/PRs into develop may occur only after live branch protections
  and Preview isolation are verified; they remain development setup, not Stage1.

## Credentials and preflight

- NEVER load/copy/source the original checkout `.env.local`, even with DEV_MODE.
  It points to production. Use only verified dev credentials in this worktree.
- `node scripts/stage0-preflight.mjs` checks cwd/root/remotes/branch/ancestry,
  exact targets and fresh provider evidence. Use its wrapper for local build or
  loopback smoke; it cannot wrap push/deploy/arbitrary commands. Evidence expires
  after six hours; regenerate with `python3 scripts/stage0-vercel-audit.py`.
  This supplementary local guard is not remote IAM or a Stage0 GO decision.
- Preview/default, develop overrides and Development credentials are isolated.
  Original production variable records retain their IDs and production-only scope.
  Scope-only requests submitted no value changes; write-only secret plaintext
  cannot be independently compared. Never hash redacted values as content proof.
  Do not undo that isolation. Before any further change, inspect actual scopes
  without printing values; updating a shared row changes ALL of its environments.
- Keep passwords, tokens, JWTs, env files, auth state and DB dumps out of Git,
  Linear, screenshots, console/debug output and CLI upload bundles. Use private
  0700 directories/0600 files, stdin or programmatic tool arguments, never shell
  arguments containing secrets. Public browser keys must belong to the dev project;
  never expose service-role/admin credentials. Scope browser auth headers to the
  exact dev origin; retain Vercel Deployment Protection.
- .gitignore and .vercelignore exclude private runtime, .env and browser files.
  Inspect staged/uploaded paths; do not assume ignore rules are enough.
- flespi topics reserved: `shopping-poc/naf-stage0-041d4f122bdd`.
  Publisher: commands publish/results subscribe; listener: inverse. Require explicit
  expiry and denial outside the namespace. Credential input is a private local
  source only, never chat. No broker tests with shared/master credentials. Do not
  reuse existing listener IDs. QoS ACK is not proof of database commit.
  Tokens114509462/114509463 expire2026-11-26T18:56:34Z, fixed expiry/ttl0,
  backend-only ACLs. Renew only these dev credentials before expiry. Foreign
  subscriptions may receive successful SUBACK; verify actual delivery filtering,
  not SUBACK alone. Temporary auditor must have only the three exact probe topics
  and short fixed expiry; validate metadata/permissions before sending probes.

## Autonomy and tools

- Codex owns safe development setup and its commands; do not hand terminal work
  to the user. Read latest NAF-151/159/160 before access remediation.
- Official Vercel CLI66.2.0 is pinned in the separate user-owned installation:
  `/home/naf-w/.local/share/shopping-list-tools/node_modules/.bin/vercel`.
  Playwright-core1.65.1 uses installed Chrome; MQTT5.16.1 is pinned alongside it.
  Keep CLI-only tooling out of app deps.
  Installed `--help` is command syntax authority. Use explicit current project context.
- Initiate official login yourself if needed. Involve the owner only for required
  browser OAuth/2FA/account authorization, privileged/repository-wide policy changes,
  financial commitments or production-related exceptions. Never ask for passwords,
  PATs or 2FA codes in chat. The owner can access Debian through NoMachine from
  their phone and approved flespi login there. Inspect only the intended service
  page; never read unrelated browser tabs or account authentication inputs.
- Prior explicit approvals: main/develop PR protections (administrators enforced,
  zero reviewers, force/deletion denied), removal of Preview from shared env scopes
  while retaining production values, and lingering for naf-w. Do not request these
  same approvals again within their agreed scope.
- Actual Vercel login/project repair, dev env setup, Preview rebuild and safe
  Preview rollback are complete; do not repeat them without a new reason.
  Native CLI curl forwards --non-interactive to curl incorrectly; omit that flag
  only for curl while preserving exact URL/team. No raw env JSON/debug token output.

## Debian development and recovery

- Separate PostgreSQL17.12: TCP127.0.0.1:55439, DBshopping_stage0,
  role shopping_stage0_app, private .stage0-runtime/data, SCRAM; Unix sockets off.
  Do not use system5432, shopping_poc, cashflow_engine or system PG data directory.
- Dedicated user unit shopping-list-stage0-postgres.service is ACTIVE: unprivileged
  uid1000 naf-w, NoNewPrivileges,256MB/20%CPU/64tasks, automatic restart. Linger=yes.
  Daily shopping-list-stage0-backup.timer runs scripts/stage0-backup.py, retaining
  seven owner-only local dumps. Synthetic transaction/restore/crash checks pass.
- Preserve unrelated NoMachine/desktop/nginx/Samba/Ollama/Docker/home workloads.
  No host reboot or firewall change is authorized incidentally. No off-host backup
  exists; document host/disk-loss limitation rather than claiming full DR.
- Units reference this exact worktree: stop/disable ONLY dedicated units and
  preserve DB/backups before removing/moving it. Script stage0-postgres.py refuses
  an existing runtime; never force a fresh initialization over it.

## Evidence and review

- Record actual SHA/resource IDs, commands, test results, changes, failures,
  rollback and limitations in each Linear issue. Mark Done only on acceptance.
  Keep NAF-160 NO-GO while any critical broker/security prerequisite is missing.
- Run relevant checks once; repeat only for changes/failures/new concerns. Existing
  full-app lint17 errors/1 warning is documented in lint-baseline.json and unchanged;
  don't suppress rules or refactor unrelated app code during environment setup.
- Development CI covers guard denials, changed-script lint and an inert loopback
  build with NO service secrets, and only PRs into develop/manual feature runs.
- Any future Stage0 GO or POC recommendation is NOT production migration approval.
