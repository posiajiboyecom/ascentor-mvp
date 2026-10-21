-- 20261023_profiles_billing_cycle.sql
-- profiles.billing_cycle is read and written by checkout settlement (lib/paymentSettlement.ts), the subscription
-- webhooks, the account plan API, admin analytics and the admin "grant access" action, but the column was never
-- created (the baseline only has it on the partner tables). Additive and safe to re-run: nothing is dropped or rewritten.
-- Existing rows get 'monthly'; admin-granted access is marked 'manual' by the admin route itself.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly';
