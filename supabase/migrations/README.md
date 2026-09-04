# Supabase migrations

This directory is the version-controlled database definition for FutureCart.

## Baseline

`00000000000000_baseline.sql` is a read-only capture of the production database state taken on 2026-09-04. It exists so a fresh Supabase project can be rebuilt from version control without changing the historical migration files that were already committed.

The baseline is intentionally **fail-fast**, not idempotent. It is meant to run against a fresh database. If an object that the baseline owns already exists, the migration should fail rather than silently hide schema drift.

Do **not** run the baseline DDL against the existing production database merely to register migration history. Production already contains these objects. If migration history ever needs reconciliation, do that explicitly rather than re-executing the baseline.

## Build order

For a fresh database:

1. Start with a new Supabase project.
2. Apply `00000000000000_baseline.sql`.
3. Apply the remaining migrations in filename order.
4. Run the authorization/isolation test suite before using the project for application development.
5. Configure Auth providers, redirect URLs, and environment-specific settings separately from schema migrations.

The existing historical migrations are intentionally left unchanged. Some objects are omitted from the baseline because those later checked-in migrations create or replace them.

## Environment safety

- `main` / production must remain pointed at the production Supabase project.
- Development and Preview should use the separate FutureCart Dev project.
- Do not copy production user data into development.
- Production schema inspection should be read-only unless a specific production change is explicitly approved.
- New schema/security changes should be added as new migrations, tested on FutureCart Dev first, and promoted to production only after the isolation tests pass.

## Authorization model

RLS is enabled on the application tables. Some operations intentionally use `SECURITY DEFINER` RPCs with explicit authentication and household-membership checks. Other direct table access is governed by RLS policies.

The baseline records the production state; security improvements discovered during audit belong in later migrations rather than rewriting the baseline snapshot.
