# Stage 2 readiness — CONDITIONAL GO

Core isolated backend complete; Stage3 not started. No production migration authorization.

|Issue|Result / evidence|
|---|---|
|NAF-166|Repository schema/RPC/auth/realtime inventory and explicit Stage3–4 gaps: inventory.md|
|NAF-167|Four immutable migrations; fixed dedicated DB/roles; forced RLS, constraints/indexes; fresh rebuild PASS; migration.json/rebuild.json/privileges.json/immutable-privileges.json|
|NAF-168|12actual PostgreSQL groups PASS;5actual live MQTT/PostgreSQL groups PASS; docs/stage2/attempts/integration-e21d4433-b2b2-47d4-996f-98ca15ca1bda.json; docs/stage2/attempts/mqtt-f7709e96-449d-41c6-847c-e3ad940d4883.json|
|NAF-169|Enabled dedicated unprivileged user service; normal restart+targeted SIGKILL autorecovery PASS; PG PID/business fingerprints unchanged; docs/stage2/attempts/service-6852c5cc-e96d-40a3-92f3-e857c2a0527e.json|
|NAF-170|AES-GCM snapshot backup/restore all10tables including ledger/outbox/migrations match; wrong key/tampering refused before restore; existing timer works; docs/stage2/attempts/backup-e3347338-7714-4dc5-a398-2201850c862f.json|
|NAF-171|CONDITIONAL GO for isolated backend core; later-stage authentication/UI/callback/recovery obligations retained|

64offline guard/protocol/crypto/backup-format tests, changed-script lint and local Next build/typecheck pass. Remote CI/Preview results are recorded in Linear against the pushed commit. No full-app lint suppression; baseline17errors/1warning remains unchanged.

Actual database tests cover normal CRUD/checked/quantity/order,20concurrent duplicate requests→1effect/result/outbox, lost response retry, conflicting operation body, stale/out-of-order versions, concurrent different users, current/foreign/revoked household access, invalid signature/identity/expiry, admitted-operation revocation locking, rollback including partial export, immutable results/history, atomic export/restore/history counts and tombstones.

Actual MQTT+PostgreSQL tests kill the listener after COMMIT before incoming ACK/application reply; restart resumes session/redelivery, returns prior result and drains durable outbox with one DB effect. They recover queued valid writes across process restart, retrieve signed status, reject conflicting reuse and prove invalid signatures have no DB effect. Fixture issuer/signers are synthetic; no frontend/API/real Google path is claimed.

Persistent service has no inbound API port; PostgreSQL stays127.0.0.1:55439. Health/logging contain no credentials. Current broker count3includes the new stable listener plus2pre-existing sessions; queue0/retained128KiB. Both original sessions and unrelated host services are preserved.

Remaining conditions: Synthetic signed fixture issuer, not real browser/dev OAuth; No Vercel callback or browser pending/realtime/multidevice implementation yet; Household onboarding/invite/name-helper adapters remain Stage4 parity work; Backups/key local only; legacy owner-only plaintext dumps preserved; no off-host DR; Clock step detection does not prove cross-host initial skew; key/issuer/token lifecycle obligations remain; Owned-stream interruption tests are not real ISP/router/host reboot tests; Original2s broker-session diagnostic remains FAIL and exact cleanup mechanism is unconfirmed.

Next recommended work: Stage3 dev authentication/verified identity bridge, Vercel→MQTT API, authenticated durable callback/status store, then browser pending/save/sync and multi-device proof. Complete household/invite parity before Stage4 acceptance. Do not begin Stage3 incidentally in this Stage2 request.

Rollback and owner-only backup/restore procedures are in README.md. Failed initial runs remain under attempts/; fixes are additive migrations and code corrections, not relabeled PASS artifacts.
