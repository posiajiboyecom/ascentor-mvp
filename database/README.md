# Database

Source of truth: the Supabase project. This folder makes it reproducible.

## Applying to a NEW project

1. `migrations/00000000_baseline.sql`: the whole `public` schema (tables, types, sequences, constraints,
   indexes, functions, triggers including the `auth.users` hooks, views, RLS and policies). Exported from the
   live database by `scripts/export-schema.ts`. Structure only, no data.
2. `migrations/20261004_auth_hardening.sql`
3. `migrations/20261005_member_features.sql`
4. `migrations/20261005_lock_down_open_policies.sql` (security fix, see below)

Older dated migrations (2026-07 to 2026-09) are already reflected in the baseline. They are idempotent and may
still be run on an existing database, but they are not needed on a new one.

Run each file in the Supabase SQL editor, `psql`, or `npx tsx scripts/apply-migration.ts <file> --yes` (single transaction). Every file is idempotent.

## Applying to the EXISTING project

Do not run the baseline there (it is a snapshot of it). Run, in order, the dated files you have not applied:
`20261004_auth_hardening.sql`, `20261005_member_features.sql`, then `20261005_lock_down_open_policies.sql` (already applied to production on 2026-10-05; it removes policies that exposed data to the public anon key).

## Regenerating the baseline

```bash
npx tsx scripts/export-schema.ts      # needs DATABASE_URL in .env.local; read-only catalog queries
```

Regenerate after any schema change made directly in the dashboard, and commit the diff.

## Inspecting

```bash
npx tsx scripts/db.ts "select count(*) from profiles"      # read-only by default
```

`scripts/audit-rls.sql` (paste into the SQL editor) lists tables without Row Level Security. The verification
query at the end of `20261005_lock_down_open_policies.sql` lists open write policies.

## Not in the baseline

Storage buckets and their policies, Auth provider settings, Edge Functions (`supabase/functions`), and
`pg_cron` jobs are configured in the Supabase dashboard or by their own tooling.
