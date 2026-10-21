-- 20261024d_circle_health.sql
-- Additive only. Lets an admin mark a Circle healthy from the console (Circles > Mark healthy).
-- The Circles screen derives Healthy / Needs facilitator / Low quorum / Forming from live data; this column stores a manual
-- "healthy" override that wins over the derived state. Null means no override. Safe to re-run. Nothing is dropped.
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS health_override text;
