# Reproduction, rollback and retained limits

Run only from the isolated feature worktree. The root checkout contains unrelated
user changes and must remain untouched. Never load its .env.local. Existing
private Stage3 accounts/configuration are already provisioned; the provisioning
function is disabled and initial env-add scripts deliberately refuse overwrites.

```
node scripts/stage0-preflight.mjs
python3 scripts/stage0-vercel-audit.py
node scripts/stage3-refresh-sessions.mjs
node --test scripts/stage0-preflight.test.mjs scripts/stage1-validity.test.mjs backend/test/protocol.test.mjs integration/stage3/*.test.mjs
node scripts/stage3-preview-check.mjs
node scripts/stage3-callback-check.mjs
node scripts/stage3-trace.mjs
node scripts/stage3-publisher-ack.mjs
node scripts/stage3-browser.mjs
node scripts/stage3-final-check.mjs
```

The browser harness briefly stops/restarts ONLY the Stage3 listener for its expiry
case. The failure harnesses must run separately from browser/latency tests because
they intentionally affect the same dedicated service:

```
node scripts/stage3-failures.mjs quick
node scripts/stage3-failures.mjs network
```

Each produces uniquely named reports. The network suite takes approximately15min;
the owned-stream interruptions are5/60/290/480s, with late-valid/fresh controls.
No router/ISP/firewall fault is claimed. Dedicated service control is through
python3 scripts/stage3-service.py status/restart/stop. Fault controls expire,
are owner-only, are disabled by default, and the harness resets them afterward.
Never run two service-affecting harnesses concurrently.

## Actual rollback

python3 scripts/stage3-rollback.py disables ONLY the feature Preview flag, rebuilds
a pinned verified Git Preview, explicitly switches ONLY the feature development
alias, verifies API404/original app200/retained committed result, then re-enables
the flag, rebuilds and restores result access. It checks production deployment
and secret-record metadata equality. This is an actual development rollback,
not an instruction to promote/merge or change production aliases. The original
Google path is still unconfigured in development; rollback does not claim it
suddenly becomes functional.

Two failed attempts are retained: d94d3127 did not move the branch alias;
712a13db switched raw CLI uploads, which lack required GitHub owner/repository
environment and correctly remained disabled. The known-good Git Preview was
restored before changing approach. Corrective rollback24b63c8c passes all4checks,
using verified Git redeploy rather than weakening the deployment guards.

For an operational rollback, stop only the Stage3 user service and disable its
feature Preview flag/redeploy that verified source. Keep PostgreSQL, its ledgers,
outboxes, backups, gateway rows and keys. Re-enable the compatible service/Preview
to reconcile. Do not DROP/TRUNCATE data or reset already committed operations.

## Rotation and deployment access

Command signer kid/private key are server-only configuration. Debian's resultKid
and private key are separate; verification registries accept overlapping public
keys. Add the new public key to Debian/Vercel/gateway first, deploy verifiers,
then switch the corresponding signer configuration. Keep old verification keys
for the bounded outstanding transport/callback windows and reconcile pending IDs
before removal. Removing an old key revokes it. Never log/export private material.
The gateway's pinned public registry changes through reviewed source deployment.
Offline contract tests exercise rotation/revocation; a live operational rollover
has not been performed.

Preview protection access is independent of the callback signature. An actual
invalid-token test proves feature Preview env-pull renewal and idempotent callback
delivery, with0600private files and unchanged protection settings. The owner CLI
login is still an operational dependency; if that login needs owner reauthentication,
the outbox retains results and retries. A future unattended deployment identity
must preserve this separation, not disable protection or expose MQTT credentials.

## Scope retained for Stage4

1. Adapt the original application's full CRUD/checked/history/export/household
   flows to the backend. Stage3's /stage3 proof covers real create/quantity and
   authoritative synchronization, not full UI parity.
2. Configure and verify development Google OAuth with the account owner when
   ready. Password sessions are verified now; no Google sign-in success is claimed.
   Resolve password-provider policy before any broader human-password rollout.
3. Complete household onboarding/invite adapters and stable issuer/subject mapping.
   Stage3 uses real provider identities plus an explicitly provisioned local
   membership allowlist; there is no implicit trust in client household/user IDs.
4. Add pagination/delta delivery and metadata retention/cleanup before larger
   households or extended use. Current command/callback bounds are16KiB/256KiB.
   Tests are small POC fixtures, not a sustained volume/quota benchmark.
5. Exercise live key rollover and choose unattended Preview/deployment identity;
   retain clock-health checks and the actual logout/membership rejection boundary.
6. Expand field testing if an actual router/ISP outage guarantee or meaningful
   tail-latency SLO is needed. Controlled owned-stream evidence covers the stated
   short-interruption POC; multi-hour availability/off-host disaster recovery is
   not established. P95/P99 need a larger representative sample.

These are conditions for expanding the POC, not authorization for a production
migration. No Supabase resources have been removed. Stage4 work has not begun.
