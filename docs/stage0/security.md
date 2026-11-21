# Stage 0 security and permission matrix

Verified 2026-11-20. Technical preflight passes; NAF-160 separately controls GO.
No production migration, external network change or implemented application
security is implied by this environment audit.

| Boundary | Actual authority and verified control | Evidence / residual requirement |
|---|---|---|
| GitHub | Owner CLI can administer repository1239195094; main/develop require PR even for administrators, zero reviewers, force/deletion denied | Live GET of both protections; branch/upstream/ancestry guard; broad owner credential is provisioning authority, never CI/application input |
| Vercel | Owner0012ab-5576 of team_h5ZyD1rMpbgnak6COakN03nD; exact existing project prj_jsqk7AsPGuxLmvWqYEsqyFClV1cM | Preview-only effective env and8 served bundles verified; production alias/deployment unchanged; write-only secret content cannot be compared |
| Supabase | Connector administration exists; queries restricted to FutureCart Dev njomxqthjglqesxchlbm | Six RLS tables, cross-household SQL denials, zero residual fixtures/users; no production SQL; browser only uses verified dev publishable key |
| Debian | uid1000 naf-w; dedicated unprivileged user service, NoNewPrivileges,256MB/20%CPU/64tasks | Service restart/crash recovery passed; owner approved Linger=yes; no new host-level privileges, firewall or router modifications |
| PostgreSQL | shopping_stage0_app on127.0.0.1:55439/shopping_stage0; SCRAM; no superuser/createdb/createrole/bypassrls | Denied CREATE DATABASE, admin SET ROLE and cluster postgres connection; system5432 untouched; no Unix socket |
| flespi publisher | Account2617576 token114509462, ACLtype2, exact commands publish/results subscribe, backend-only | TLS1.3 verified, wrong direction/foreign publish reason135, actual delivery filtering; administration/browser-origin403 |
| flespi listener | Account2617576 token114509463, inverse exact ACL, backend-only | Same positive/negative checks; fixed expiry2026-11-26T18:56:34Z, ttl0; no master credentials in MQTT clients |
| Temporary ACL auditor | New token114523424: publish+subscribe only commands/results/one synthetic foreign probe |10min fixed expiry2026-11-20T00:51:15Z, ttl0, private0600; independent publication control, not broad account access; renewed auditor required for rerun |
| Linear | Authenticated workspace access can read/update this project and its evidence | Only authorized project/issue/document evidence writes; no credential values |
| CI | contents:read, pinned official action SHAs, no persisted Git credentials, no service secrets |56 guard denials, changed-script lint, inert loopback build; only PRs into develop/manual feature; no deploy/production job |

## Network and authentication

The new database listener and browser debugger bind only127.0.0.1 (55439 and
55442 respectively), confirmed with ss. MQTT opens outbound TLS8883; HTTPS uses
certificate verification. No new public ingress, callback port, router mapping
or firewall exception was added. Existing shared listeners (SSH, Samba, web,
NoMachine, Ollama and unrelated apps) were observed and left untouched. This is
an audit of newly introduced exposure, not a claim the shared host or router was
fully hardened. No externally accessible database is needed for this POC.

The owner completed flespi login in the private dedicated Chrome profile via
NoMachine. Inspect only flespi-origin pages; do not inspect other user tabs or
password/2FA fields. The master session remains private browser state. CDP is
loopback-only and should be stopped when account-side authorization work ends,
without closing unrelated user tabs. Private profile/runtime paths must remain
excluded from commits and deployment uploads.

Current dev Google provider is disabled. Anonymous Preview shell smoke is
verified; end-user OAuth is not. This is a declared nonblocking baseline
limitation for transport/environment work, with no auth bypass. Before future
application integration, implement and verify the trusted identity, household
membership, signed callback/envelope and replay controls in auth-plan.md.
No public callback endpoint or browser MQTT credentials exist at Stage0.

## Operational risks and controls

- MQTT QoS1 permits duplicates and is only a broker-level acknowledgment. An
  application operation must use durable idempotency, transactional membership
  checks and an explicit DB-commit result; the baseline makes no DB-commit claim.
- Successful SUBACK does not establish authorization: both forbidden and
  wrong-direction subscriptions were accepted, but actual deliveries were filtered.
  Future regressions must preserve independent positive publication controls.
- Persistent sessions can accumulate stale work, duplicate IDs can disconnect
  clients, and reconnect latency can rise. Baseline uses unique private IDs,
 60second test expiry and cleans sessions with expiry0. Home-network/power loss,
  offline backlog and sustained performance remain Stage1 tests. The2.1s sample
  after reconnect is a risk to measure, not a performance acceptance pass.
- Actual account free-tier limits are captured in flespi-limits.json. Keep
  aggregate concurrent tests below50sessions/20000messages per minute and leave
  room for existing workloads. Never clear pre-existing retained data or sessions,
  increase a paid plan or rotate/revoke shared credentials incidentally.
- Rotate only newly provisioned development credentials before fixed expiry;
  validate replacement account/ACL/expiry privately, switch dev clients, then
  remove only the superseded dev tokens. No credentials in browser bundles,
  shell arguments, Git, CI, screenshots or Linear. Files0600, directories0700.
- Local daily seven-copy backups and synthetic restore passed. Host/disk loss
  remains uncovered because no encrypted off-host copy exists; later operational
  readiness must close this gap. No host reboot was performed for boot testing.
- Full-app lint has pre-existing17 errors/1warning. Changed infrastructure lint,
  build/typecheck and guard tests pass. This exception does not waive security,
  recovery or later application integration acceptance.

## Reproduce and revoke safely

Run node scripts/stage0-preflight.mjs before provider-backed development work.
The MQTT minimum harness is node scripts/stage0-mqtt.mjs and requires private
flespi-dev.json metadata plus a fresh short-lived flespi-auditor.json with the
three exact ACL topics. It refuses an expired auditor before broker traffic.
Publisher/listener metadata, delivery controls and denials are checked live;
no load/offline/replay suite runs here. Private credentials must be provisioned
through the official owner-authorized account flow; no secret chat input.

Rollback only dedicated new dev tokens/clients, dedicated local units and dev
Preview/Development configuration. Preserve production and shared resources.
See readiness.md for service/data preservation and safe Preview rollback.
