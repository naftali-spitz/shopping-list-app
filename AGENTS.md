<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Home Backend & flespi POC — production protection

- Work is restricted to Linear project `Shopping List — Home Backend & flespi POC`.
- Stage 0 issues NAF-149–159 must pass with current evidence, then NAF-160 must
  record GO and be complete before any Stage 1 or later implementation/testing.
  An audit report or local smoke test alone never authorizes the next stage.
- Before a mutating command, verify `pwd`, `git branch --show-current`,
  `git status --short`, and the exact service/environment target. Use the isolated
  `feature/flespi-home-backend` worktree based on verified `origin/develop`.
- Preserve unrelated edits and artifacts in the original checkout. Do not switch,
  commit, push or merge main. PRs target develop only. Do not push this feature
  until the Vercel deploy mapping and preview credentials have been verified.
- No production Supabase writes, user-data copies, production Vercel changes,
  deployments/promotions, production credentials, or changes to unrelated services.
  The original checkout's DEV_MODE flag does not establish environment isolation.
- Production Supabase ref: `inebdmynrfwmmxcyziyi`. Development ref:
  `njomxqthjglqesxchlbm` (FutureCart Dev). Treat unknown targets as blocked.
  Run `node scripts/stage0-preflight.mjs` before app builds or smoke tests.
  This local guard is supplementary; it does not enforce remote IAM or networking.
- Keep tokens, passwords, JWTs, connection strings and .env files out of logs,
  commits and Linear. Only publish resource IDs, names/scopes and redacted results.
  Browser keys must be publishable/anon; never use browser service-role keys.
- Use dedicated dev MQTT topics/tokens with verified ACLs and unique client IDs.
  Do not publish using an unverified/shared token or reuse an existing listener ID.
  QoS acknowledgement is not database commit evidence.
- PostgreSQL must stay local-only. Do not reuse/change existing `shopping_poc`,
  `cashflow_engine` or the system cluster. Use dedicated roles, directories,
  logs, ports and synthetic fixtures for preflight; keep runtime files ignored.
- Pin installed versions through lockfiles; inspect install scripts. Never change
  firewall, system services, root-owned paths or shared credentials incidentally.
  Escalate commands denied by the sandbox through the approval tool.
- Production changes, account authorization, paid plans, irreversible operations
  and repository-wide protection changes require explicit approval. Verify exact
  target, proposed change, impact and rollback before asking for that approval.
- Record commands, SHA, environment, actual results, failures, changes and rollback
  per Linear issue. Only mark Done when every acceptance criterion passes. Keep
  NAF-160 incomplete and record NO-GO while any critical prerequisite is unknown.
- Verify baseline build/lint and relevant smoke/denial/recovery tests. Record
  pre-existing failures; do not silently weaken checks or fix unrelated app code.
