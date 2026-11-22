# Same-user tab persistence

Stage4 stores each operation under a separate localStorage key:
`shopping-stage3-v2:<user>:<household>:stage4:operation:<operation-id>`.
The old array key remains a compatibility index for existing evidence/UI tooling.
It is not the Stage4 source of truth. The original Stage3 mode remains unchanged.

A new tab merges legacy index entries and individual operation records before
rendering optimism. Each persistence pass merges all individual records first,
then writes changed records. Concurrent tabs can write separate keys without
removing each other's unresolved IDs. A stale pending writer cannot replace a
terminal result. Storage events make other tabs reconcile the same immutable IDs;
the PostgreSQL operation ledger still provides transactional idempotency and
expected versions still expose conflicting user intent.

Different local tabs can publish the same operation ID. This is safe retry, not
another business operation. No in-browser lock is treated as authorization or as
proof of a commit. An operation is Saved only for an authoritative committed
result delivered through the existing protocol.

Only terminal records are eligible for the existing last30 retention policy.
Unresolved operation records are never deleted by trimming. If the compatibility
index write fails after individual records succeeded, the operation remains
locally durable and refresh reconstructs it. Failure of an individual record
write refuses the new intent before optimistic rendering. Changed immutable
bindings or conflicting terminal records fail visibly and stop further sends.

Focused tests use the actual transpiled client with a mocked provider boundary:
interleaved stale tab writes and refresh retain both IDs; another tab's terminal
storage event resolves the initiating tab; changed stored intent fails closed.
These tests do not replace actual browser/transport/database acceptance.

Actual original-app browser continuation
`attempts/reliability-browser-5e212db7-77a7-460f-af79-c6f0a9a7877a/report.json`
passes all three focused groups on deployed `6f499ab`. Two same-user offline tabs
persist distinct product-quantity intent IDs; both per-operation records survive
interleaved storage, tab closure and refresh; reconnection recovers one PostgreSQL
ledger/outbox per ID, intended quantities, and second-user convergence. This
completes the cross-tab portion that the earlier nine-group run did not reach.
Failed modal/logout harness attempts remain preserved, not relabeled.
