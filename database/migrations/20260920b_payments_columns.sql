-- ============================================================================
-- 20260920b_payments_columns.sql   (idempotent, safe to re-run)
--
-- The live public.payments table has no "amount" column, but the app reads and
-- writes payments.amount (subscription fulfilment, renewals, admin revenue).
-- Every subscription payment insert would fail and the dashboard revenue query
-- silently returned nothing. This adds every column the app uses.
--
-- FIRST run this to see what the table really has (read-only):
--   select column_name, data_type, is_nullable
--   from information_schema.columns where table_name = 'payments' order by ordinal_position;
-- ============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS amount     numeric,
  ADD COLUMN IF NOT EXISTS currency   text DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS plan_id    text,
  ADD COLUMN IF NOT EXISTS billing    text,
  ADD COLUMN IF NOT EXISTS provider   text,
  ADD COLUMN IF NOT EXISTS status     text,
  ADD COLUMN IF NOT EXISTS paid_at    timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
