<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ARCHITECTURE HOLD — 2026-11-23 (OVERRIDES OUTDATED STAGE 3/4/5 INSTRUCTIONS BELOW)

**The original project objective is to eliminate Supabase ENTIRELY.** Prior Stage 3/4 implementation and tests reused Supabase Dev for Auth, durable gateway/callback/results and Stage 5 historical monitoring. Those old gates are *historical passes for a different architecture*, **not** approval of the Supabase-free migration. **Stop Stage 5/6 and do not merge draft PR #16** until the new 4R blocking gate NAF-206 passes.

**Accepted target:** Vercel hosts FutureCart/PWA (optional limited secure login/bootstrap only). Browser/phone communicates **directly** with flespi via secure MQTT over WebSockets for mutations and subscribed results. Private Debian MQTT listener authenticates/authorizes each operation and uses its own PostgreSQL for **all** business data, user/household/session state, durable results, and OFF/MID/ON performance history. Browser shows Saved only after Debian DB COMMIT. Reconnect/resubscribe with idempotent operation IDs and server snapshot replay. No public Debian inbound port.

**No Supabase anywhere in accepted runtime:** not Auth, Realtime, gateway, callback/status, RPC, storage, monitoring or silent fallback; no replacement hosted durable cloud DB without owner approval. Do **not** expose master/shared flespi token in browser. Require short-lived, scoped/revocable tokens and proven secure OAuth/bootstrap mechanism; if infeasible, report NO-GO rather than weaken security. Full final E2E must pass with Supabase entirely inaccessible.

**Binding architecture ADR:** `docs/architecture/ADR-2026-11-23-zero-supabase.md`. Linear issues NAF-199 through NAF-206 define audit, design, implementation and signoff. Follow their dependency sequence before returning to NAF-197 or NAF-184…189. Keep production and original checkout untouched. Preserve reusable POC work/evidence; no destructive cleanup in Dev without separate authorization.

---

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
  Owner revised Stage1 acceptance2026-11-20: five-minute message retention and
  safe short-interruption recovery, NOT precise two-second session expiration.
  Preserve all old diagnostic failures. NAF-165 recorded CONDITIONAL GO/Done
  2026-11-20T06:25:58Z after the new5/15/30/60/120/240/290/310/480s matrix passed
  with message expiry300s/session1800s and same-ID lost-session recovery12/12.
  Stage2 isolated PostgreSQL is authorized; see docs/stage1/gate.json. Full app
  auth/frontend synchronization and production migration remain unproven/excluded.
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

### Stage2 backend boundaries

- Local backend code lives in backend/; it is excluded from Vercel uploads.
  Use only .stage0-runtime/stage2-config.json (0600) and the fixed development
  127.0.0.1:55439/shopping_stage0 target. Runtime/dispatcher roles are separate
  non-superusers; schema owner is NOLOGIN. Never substitute system5432 or a URL.
- Synthetic Ed25519 fixture JWT issuer is Stage2 test identity ONLY. Real browser
  dev authentication/Vercel API/callback/pending UI/multi-device sync remain
  Stage3–5. Never treat a supplied user/household or MQTT token as identity.
- Normal recovery uses session expiry1800s and message expiry300s. Keep current
  membership, canonical operation-ID binding, immutable durable results, expected
  versions and atomic outbox mandatory. Broker ACK is never frontend saved.
- New enabled user unit shopping-list-stage2-backend.service references this exact
  worktree; preserve its private config/keys/ledger/backups. Stop/disable ONLY it
  for backend rollback, leaving PostgreSQL and unrelated services intact.
- Existing shopping-list-stage0-backup.timer now delegates to encrypted Stage2
  snapshots through scripts/stage0-backup.py. New backups retain7 AES-GCM copies;
  legacy owner-only Stage0 backups remain. Key is co-located; no off-host DR claim.
- Fresh rebuild/restore may recreate ONLY marked shopping_stage2_rebuild and
  shopping_stage2_restore in the isolated cluster, never overwrite the main dev
  DB. Use additive checksum migrations, not destructive schema rollback.
- Stage2 evidence and remaining integration obligations: docs/stage2/README.md,
  inventory.md and gate.json. Do not claim full frontend consistency from these
  database/transport tests or begin Stage3 work incidentally.

- Record actual SHA/resource IDs, commands, test results, changes, failures,
  rollback and limitations in each Linear issue. Mark Done only on acceptance.
  Keep NAF-160 NO-GO while any critical broker/security prerequisite is missing.
- Run relevant checks once; repeat only for changes/failures/new concerns. Existing
  full-app lint17 errors/1 warning is documented in lint-baseline.json and unchanged;
  don't suppress rules or refactor unrelated app code during environment setup.
- Development CI covers guard denials, changed-script lint and an inert loopback
  build with NO service secrets, and only PRs into develop/manual feature runs.
- Any future Stage0 GO or POC recommendation is NOT production migration approval.
