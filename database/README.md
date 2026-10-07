# Database

Source of truth: the Supabase project. This folder makes it reproducible.

## Applying to a NEW project

1. `migrations/00000000_baseline.sql`: the whole `public` schema (tables, types, sequences, constraints,
   indexes, functions, triggers including the `auth.users` hooks, views, RLS and policies). Exported from the
   live database by `scripts/export-schema.ts`. Structure only, no data.
2. `migrations/20261004_auth_hardening.sql`
3. `migrations/20261005_member_features.sql`
4. `migrations/20261005_lock_down_open_policies.sql` (security fix, see below)
5. `migrations/20261006_fix_signup_trigger.sql` (sign-up trigger functions use schema-qualified names)
6. `migrations/20261006_signup_otp.sql` (sign-up code purpose column)
7. `migrations/20261007_member_directory.sql` (`member_directory` view; profile rows readable by their owner only)
8. `migrations/20261008_reimagine.sql` (data model for the reimagined member app: onboarding profile, weekly practice and check-ins, pathway lessons, Circles, Groups, feed, direct messages, human mentorship, Sage notes, announcements, growth scores; row level security throughout; seeds lessons, groups and two announcements; realtime for chat tables)

9. `migrations/20261008b_member_profile_grant_fix.sql` and `20261008c_member_profile_upsert_fix.sql` (column grants so members can save their own `member_profile`)
10. `migrations/20261009_reimagine_v2.sql` (stage and slot Circle matching, Sage conversation storage, admin chat access log, moderation flags, private survey tables, Circle mentorship tables, call attendance, 12 pathway lessons)

Older dated migrations (2026-07 to 2026-09) are already reflected in the baseline. They are idempotent and may
still be run on an existing database, but they are not needed on a new one.

Run each file in the Supabase SQL editor, `psql`, or `npx tsx scripts/apply-migration.ts <file> --yes` (single transaction). Every file is idempotent.

## Applying to the EXISTING project

Do not run the baseline there (it is a snapshot of it). Run the dated files you have not applied, in filename order. `scripts/apply-migration.ts` applies one file in a single transaction; `scripts/db.ts` shows what is already in place.

## Reading other members

The `profiles` table holds private columns (billing details, referral codes, role). A member can read only their own row. Anything that needs another member's name or avatar (Circle authors, course discussions) reads the `member_directory` view, which exposes `id`, `full_name` and `avatar_url` to signed-in users and nothing to the public key. Server routes that need more (for example the referral list) use the service-role client after authorising the caller.

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
