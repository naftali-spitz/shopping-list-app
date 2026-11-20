# Shared durable browser client

`integration/stage3/client.ts` extracts the Stage 3 durable browser protocol into
one typed client used by the proof surface and original application adapter.
It retains same-ID retry, authenticated status checks, persisted pending intent,
expected versions and authoritative reconciliation. Neither a successful HTTP
acceptance nor broker PUBACK marks a mutation Saved. Only the committed result
does; lifecycle read queries separately accept their authoritative snapshot reply.

The original `/stage3` page now selects `mode=stage3` and unprefixed existing
commands. Its old storage key is retained. Stage 4 uses the same implementation
with `stage4.*` commands and an added `:stage4` storage-key suffix. This prevents
concurrent proof/app surfaces overwriting each other’s pending queues and does
not erase existing proof IDs. Local storage contains no access/refresh token.
Every API call reads the refreshed provider session and verifies its user matches
the queue owner before transmitting. Logout disposal clears in-memory snapshots,
preserves durable intent IDs, and terminates polling.

`read()` coalesces initial or explicitly refreshed authoritative snapshot loads;
`current()` returns the last authoritative data and `view()` adds only pending
presentation patches. `subscribe()` starts polling and stops it after the last
reader/subscriber/mutation waiter leaves. Pending operation status is targeted;
idle snapshots refresh at a bounded interval. Result versions and household
revisions prevent a delayed snapshot or older result reverting newer authority.
A committed partial result also establishes a minimum allowed snapshot revision.
List-wide effects require a fresh full snapshot. Snapshot commands currently use
the existing bounded payload transport; pagination/deltas remain a separate
Stage 4/5 obligation, not an implemented guarantee of this extraction.

`mutateLatest()` reserves consecutive expected versions for preceding local
queued record mutations, and sends own commands serially. It does not silently
rebase queued changes over another user’s write: a conflict remains visible.
Mutation promises resolve only on terminal confirmation (or explicit pre-acceptance
HTTP validation rejection). Network errors leave the operation pending. Expired
unresolved intents use an authenticated `operation.status` under the existing
transactional lane before declaring an uncommitted operation Failed. Legacy
Stage 3 expiry retains its explicit Reconcile control; Stage 4 reconciles
automatically. No sound or toast plays when a callback is polled.

Verification: `node --test integration/stage3/client.test.mjs` exercises the actual
compiled client with substituted provider/network boundaries. These focused tests
cover storage-before-render, authoritative confirmation, serial quantity intent
versions, stale snapshots/results, immutable lost-ack retry, safe expiry, storage
failure, logout/provider identity changes and namespace separation. They do not
replace real browser/Preview/PostgreSQL acceptance evidence.
