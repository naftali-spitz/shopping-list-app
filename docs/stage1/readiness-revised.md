# Stage 1 revised readiness — CONDITIONAL GO

Configured MQTT message expiry300s; session expiry1800s. Controlled live-broker owned-stream interruption; no ISP/firewall fault, database or frontend benchmark. All original diagnostic failures retained.

|Outage s|Valid delivered|Expired discarded|Missing valid|Duplicates|Out of order|Recovery ms|
|---|---|---|---|---|---|---|
|5|13/13|0|0|0|False|264|
|15|13/13|0|0|0|False|324|
|30|13/13|0|0|0|False|341|
|60|13/13|0|0|0|False|421|
|120|13/13|0|0|0|False|548|
|240|13/13|0|0|0|True|540|
|290|13/13|0|0|0|False|653|
|310|3/3|10|0|0|False|999|
|480|3/3|10|0|0|False|987|

290s: oldest message290.654s, all13valid.310s:10early expired;2late ages2.498/2.421s and fresh control delivered.480s:10early expired;2late ages2.486/2.410s and fresh control delivered. Persistent sessions remained available throughout.

Lost-session scenario: own clean-start reconnect deliberately loses12queued operations; sender detects their unresolved IDs and resends same IDs while valid,12/12recover. No per-message expiry failure notification is assumed.

Reused evidence: baseline600/600,p95=326.8ms; offline100/100; sustained1200/1200,p95=316.81ms,p99=590.25ms; seven original fault scenarios plus signed-deadline/replay controls and broker security results. These are synthetic transport tests, not application/database commits.

Five-minute message expiry is suitable as a bounded POC transport retention period only when paired with durable pending IDs, authenticated operation-status lookup, canonical same-ID retry and authoritative state/version reconciliation. The240s out-of-order observation makes version checks mandatory. Session cleanup is not a validity/security boundary.

CONDITIONAL GO authorizes Stage2 isolated PostgreSQL development. Required safeguards and later-stage obligations are in recovery-plan.md and gate.json. Precise2s session expiry still fails; delayed cleanup is supported but exact scheduling/root cause remains unconfirmed. No production migration, paid changes or full frontend-sync claim.
