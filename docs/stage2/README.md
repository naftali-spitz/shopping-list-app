# Stage 2 isolated PostgreSQL backend

Started only after NAF-165 CONDITIONAL GO/Done2026-11-20T06:25:58Z under the
owner's revised recovery requirements. Stage1 evidence is in ../stage1/gate.json
and readiness-revised.md; original two-second diagnostic failures remain intact.

## Scope and architecture

The implemented path is dedicated development MQTT → Debian listener →
PostgreSQL → durable result/outbox → signed MQTT result. PostgreSQL17 on
127.0.0.1:55439/shopping_stage0 is authoritative. No Vercel API/callback or
frontend behavior changed. The Vercel development API/HTTPS callback and durable
browser pending/results/synchronization paths remain Stage3–5.

The existing public preflight table/cluster/service are preserved. Four additive
checksum-verified migrations create a private shopping schema, row-level policies,
indexes, constraints and context-function hardening. Fresh rebuild uses only the
dedicated disposable shopping_stage2_rebuild database on this same isolated
cluster. No system5432, production Supabase, production Vercel or real user data.

Service login shopping_stage2_runtime has no superuser/createdb/createrole/bypassrls
or schema/table creation privileges. A NOLOGIN schema owner holds objects. A
separate dispatcher login can read outbox results and update delivery metadata,
not business rows. Every tenant table forces RLS; principal/membership reads are
scoped to the authenticated subject. Narrow identity-column UPDATE permissions
and matching policies permit FOR SHARE authorization locks, not privilege or
revocation changes. The trusted service sets transaction-local context only
after cryptographic identity verification. DB credentials remain backend-only.
Migration004 makes operation results immutable to the runtime role and restricts
updates to permitted business columns, preserving history snapshot contents.

## Request and correctness contract

Each signed command has version/kid, pinned development audience, unique operation
UUID, verified user UUID, household UUID, allowed type/payload, expected version,
correlation UUID, issued/expires milliseconds and a signed identity JWT. Validity
is at most300seconds. Payload size, UUIDs, names, quantities, flags, patch fields,
versions and extra fields are validated. TLS verifies the broker certificate.

Stage2 uses a pinned Ed25519 **synthetic fixture issuer**, with a separate transport
signing key and result-signing key. The listener knows only public request/identity
keys; fixture private keys are in a separate owner-only excluded file. This proves
actual signature/issuer/audience/subject/expiry enforcement and current local
membership for synthetic principals. It does not prove real Google/Supabase/OIDC
browser authentication. No decoded-only JWT, user_metadata, caller-supplied role,
anonymous request or MQTT credential alone authorizes a shopping write.

The transaction flow is:

1. Verify the identity/envelope and typed payload; pin DB targets/configuration.
2. BEGIN, set transaction-local user/household, lock the household's operation
   lane and current principal/membership rows. Revocation waits for already
   admitted work; once committed, later requests, retries and reads are denied.
3. Look up the global operation ID. Match canonical logical hash and actor;
   conflicting reuse returns conflict. Hash includes payload, operation/type,
   identity/household, correlation, version and logical validity. A renewed JWT
   does not change logical intent. Expired uncommitted work cannot mutate data.
4. Enforce expected record or household revision; apply same-household CRUD or
   atomic export/history effects. Composite FK prevents foreign category moves;
   tombstones prevent ID resurrection. Do not depend on MQTT ordering.
5. Store the authoritative committed/rejected result and outbox row in the same
   transaction. Commit before emitting any application result or incoming MQTT ACK.
6. Release MQTT.js's incoming parser before waiting for outgoing result PUBACK;
   otherwise the ACK parser deadlocks. An independent outbox worker retries
   delivery. Response duplicates are expected and identified by operation UUID.

All transaction SQL is parameterized; dynamic table/column identifiers originate
only in validated internal allowlists. Household lanes deliberately serialize
this small POC's writes; no high-volume database throughput claim is made.
Current membership is checked even before returning cached results. A committed
operation can return its prior result after its original command deadline when
identity/permission checks still pass; expired uncommitted commands record an
expired rejection. Read/status commands must themselves be current.

operation.status returns the requesting actor's durable result or not_found;
snapshot returns authorized nondeleted household state and its revision. The
future API/UI keeps pending IDs and status checks after lost/expired messages.
MQTT expiry produces no assumed per-operation failure notification. A not_found
status is not evidence no request is in flight; same-ID retries/constraints
resolve races. Expired rejected intent needs explicit state/version reconciliation
before a new user-approved intent; changing timestamps/payload under an existing
recorded ID is a conflict. Deadline is admission before writes, not a guarantee
that commit finishes before wall-clock expiry. Clock-step detection is fail
closed but does not prove initial clock accuracy across hosts.

The shopping-core mapping and explicit household/invite/adapter gaps are in
[inventory.md](inventory.md). No claim of complete application/RPC parity or
frontend synchronization is made.

## Reproduction and operational safety

From the exact feature worktree, with current provider evidence and private
development configuration, agent-owned commands are:

```sh
node scripts/stage0-preflight.mjs
npm ci --prefix backend --ignore-scripts --no-audit --no-fund
node backend/scripts/setup.mjs
node backend/scripts/setup.mjs --rebuild
node backend/test/integration.mjs
node backend/test/mqtt-integration.mjs
node backend/scripts/backup.mjs --verify
python3 scripts/stage2-service-check.py
node --test scripts/stage0-preflight.test.mjs scripts/stage1-validity.test.mjs backend/test/protocol.test.mjs
```

Setup generates private development keys/passwords once and refuses drift through
migration checksums. It does not rotate pre-existing role credentials on rerun.
Tests use only synthetic fixture households. MQTT test listeners have unique
audiences/client IDs, so the persistent service does not process their commands.
All source/dependency versions are pinned in backend/package-lock.json. The
backend and node_modules are excluded from Vercel uploads; private runtime and
env/auth files remain excluded from Git/uploads. The original checkout's
.env.local is never loaded or copied.

The dedicated enabled user unit shopping-list-stage2-backend.service has
Restart=on-failure, NoNewPrivileges,128MiB/10%CPU/32tasks/0077umask and no inbound
HTTP port. It runs as unprivileged naf-w with the existing approved lingering,
not a separate Linux UID or container sandbox. Private health JSON reports
PID/time/DB/MQTT/clock state without credentials. Structured journal events contain
operation IDs/status only. Invalid startup/config failures are redacted. Keep
this exact worktree present while either dedicated service references it.

## Backup, recovery and rollback

The existing daily shopping-list-stage0-backup.timer still owns scheduling; its
script delegates to the Stage2 encrypted helper once private Stage2 configuration
exists. A privileged stage0_owner connection is used **only against the isolated
development cluster** to export an MVCC snapshot and dump all forced-RLS tables;
runtime/dispatcher credentials never gain backup/admin privileges. This is a
documented privileged backup path, not a least-privilege runtime operation.

New dumps are AES-256-GCM authenticated encrypted files, atomic owner-only writes,
retaining7 encrypted local copies. The encryption key is separately0600 in the
same private runtime. Older Stage0 plaintext owner-only backups are preserved as
legacy evidence; they were not silently deleted or converted. There is no
off-host copy and co-located keys do not cover host/disk loss or host compromise.

Verification fully authenticates/decrypts before invoking pg_restore into only
shopping_stage2_restore, a marked disposable local database. The dump and
fingerprints use the same exported PostgreSQL snapshot; every shopping table,
operation ledger, outbox and migration row must match after restore. Corrupted
ciphertext and wrong keys are rejected before any restore process receives data.

For a failed service deploy, stop/disable ONLY shopping-list-stage2-backend.service
and revert its source to a compatible feature commit; retain schema/ledger/outbox,
keys and backups. SQL rollback is forward corrective migrations after review,
not automated DROP/TRUNCATE over committed data. Rebuild/restore scripts can
recreate only their fixed marked disposable databases; they never overwrite the
main development database. Before actual recovery, stop only the dedicated
backend, verify/decrypt/restore to the disposable target, compare integrity, then
review the explicit dev-only recovery/cutover procedure. No automatic main-DB
overwrite or production cutover is implemented or authorized.

## Verification and known failures

See attempts/ for immutable actual PostgreSQL, live MQTT, backup and service
reports. Initial setup failed when spreading pg Pool options dropped the hidden
password field; explicit connection options fixed it. A UUID/text parameter
ambiguity was fixed before fixture seeding. The first DB integration failed
because row-locking SELECT requires matching UPDATE RLS policies; migration002
adds narrow lock policies. Failed report integration-d654356a remains preserved.

MQTT reports547618a8 and8caae49b preserve initial partial failures. The listener
had awaited an outgoing result PUBACK while holding MQTT.js's incoming handler,
blocking ACK parsing and graceful shutdown. Releasing the parser after commit
and publishing afterward, with bounded waits, fixed the deadlock. This was a
new listener implementation bug, separate from flespi's old2s cleanup discrepancy.
No failed run was relabeled. Private credential-bearing diagnostics remain private.

Stage2 tests distinguish actual PostgreSQL and live MQTT from Stage1's file-journal/
in-memory simulators. No host reboot was performed; only the dedicated user unit
was restarted/crashed, preserving the PostgreSQL PID and business fingerprints.
The final Stage2 gate/issue reports enumerate results and remaining Stage3–5
authentication, UI, callback, key lifecycle, pagination and network obligations.
