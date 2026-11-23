# ADR-2026-11-23: FutureCart must have ZERO Supabase runtime dependencies

**Status:** Accepted architecture direction, NOT yet implemented / validated. **Blocking:** NAF-199…NAF-206.  
**Decision owner:** Project owner (2026-11-23).  
**Linear project:** https://linear.app/naftali/project/futurecart-supabase-free-debian-flespi-43e8373b25c8  
**Architecture sign-off:** https://linear.app/naftali/issue/NAF-206

## Why this ADR exists

The project was started to remove Supabase entirely, including Supabase free-plan project pausing and service dependency. The Stage 3/4 POC inadvertently retained Supabase Dev for identity/auth, durable gateway/correlation and result delivery; Stage 5 reused Supabase Dev PostgreSQL for persistent monitoring. **This is an architectural blocker.** Previous Stage 3/4 gates remain historical test evidence but do not approve the original replacement goal.

## Accepted end-state

```text
 Vercel serves FutureCart web/PWA (static frontend, limited secure login bootstrap if necessary)
       |
       v
 Browser/PWA -- secure MQTT over WSS (publish requests, receive results & updates) --+
                                                                                      |
                                                                       flespi MQTT broker
                                                                                      |
                              private Debian MQTT listener / domain logic / auth ------+
                                                                                      |
                                               Debian PostgreSQL (single source of truth)
```

- Vercel **hosts** the frontend. No Vercel API is required for normal product/category mutations; an authorization/bootstrap endpoint may be used only if required and demonstrably secure, with no cloud durable store.
- Browser ↔ flespi MQTT over WSS 443; broker is only transport. Debian connects outbound to flespi; there are **no publicly exposed inbound Debian or PostgreSQL ports**.
- Debian is authoritative for users, household memberships, roles, sessions, operation authorization, data and **durable** operation/results ledger. PostgreSQL persists every successfully confirmed shopping operation. Confirm "Saved" **only after DB COMMIT** and matching durable operation ID, *not* broker PUBACK.
- Instant optimistic UI feedback is fine but must be shown separately from committed Saved. Publish committed changes to other authorized devices; on refresh/disconnection reconcile from Debian snapshots/results. QoS1 duplicates/reordered/lost acks must not duplicate writes.
- All historical monitoring, event details, aggregates and operational logs belong to **Debian PostgreSQL**. Reuse redacted OFF/MID/ON performance inspector and bounded, asynchronous batching. Logging outage must not affect shopping operations.

## Absolutely prohibited in accepted dev candidate

- Any Supabase Auth, Supabase database/RPC, Supabase Realtime, Supabase storage, Supabase-hosted gateway / callback/result metadata, Supabase metrics/monitoring, Supabase bootstrap or silent Supabase fallback.
- Replacing Supabase with a different external cloud database/durable server without explicit owner approval.
- Client-visible shared flespi privileged credentials. An MQTT access token in browser is visible to that browser: provision genuinely restricted, short-lived/revocable per-session/per-user credentials, broker topic ACLs and **independent Debian-side auth** for every mutation. Do not trust topic ACL alone as household authorization.
- Fake completed Saved states, fake missing time spans or assertion that direct MQTT is automatically faster without comparable benchmarks.
- Second Debian-hosted frontend, direct-LAN transport, production migration or production Vercel/Supabase changes under this POC.

## Authentication/bootstrap: mandatory feasibility checkpoint

The current app relies on Supabase Auth and household identity/session mechanics, which must be replaced. Google can remain the login identity provider, but verify Google ID/OIDC data correctly and issue server-controlled app sessions. Design how a new browser gets narrowly scoped flespi MQTT credentials, refreshes and revokes them, with Debian on a private network (no inbound access). A Vercel bootstrap API may participate only in login/session setup, not each shopping mutation, and cannot become a hidden durable database. Validate provider token ACL/expiry/quota behavior and per-household permission removal, including compromised device/token and session expiry; never put a broker master token in browser, environment exposed via NEXT_PUBLIC, URLs or logs. **If this design cannot be proven secure and workable at acceptable cost, stop with explicit NO-GO and report alternatives.**

## Acceptance / gates

1. **NAF-199:** Complete dependency inventory of source, build, third parties, requests, secrets (names only), auth, storage, monitoring and tests; identify reusable Debian/PWA POC parts.
2. **NAF-200:** Prove Supabase-free Google login, session and secure broker credential bootstrap.
3. **NAF-201:** Prove browser ↔ flespi MQTT WSS and constrained topics, realtime updates and realistic broker limits.
4. **NAF-202:** Implement Debian authoritative membership, idempotent ledger, commit-bound ack and recovery.
5. **NAF-203:** Integrate existing UI with direct MQTT, preserve all functionality without Supabase/fallback.
6. **NAF-204:** Move monitoring/history from Supabase Dev to Debian PostgreSQL; keep Off/Mid/On and bounded async batching.
7. **NAF-205:** Test full app with **Supabase unreachable/disabled**, fresh OAuth, household invites/revocation, CRUD, offline/reconnect, multi-user/multi-tab, retries, logs, backups/restore, real Android and sustained latency/resource measurements.
8. **NAF-206:** Sign off complete Supabase elimination before resuming Stage 5/6. A POC GO never authorizes a production migration.

**Existing** draft PR #16 may preserve reusable implementation and tests, but **must remain draft/unmerged** until reviewed against the new gate. Keep all production configuration, main branch, existing production data and unrelated Debian services untouched. Do not delete Supabase Dev resources or backups incidentally.

## Key provider capabilities to verify against real test account

- WSS MQTT client support and token/ACL per topic: https://flespi.com/kb/how-to-consume-telematics-hub-messages-via-mqtt
- Flespi token lifetime/origin restrictions: https://flespi.com/kb/tokens-access-keys-to-flespi-platform
- Current free plan quotas and inactivity consequences: https://flespi.com/kb/how-flespi-pricing-works
