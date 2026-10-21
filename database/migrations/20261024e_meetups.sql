-- 20261024e_meetups.sql
-- Member-organised meetups, read by the admin console (Community, Meetups). Server only: RLS on, no policies.
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.member_meetups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  city_group_id uuid,
  host_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  starts_at     timestamptz,
  venue         text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','removed','reported')),
  going_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_meetups_created_idx ON public.member_meetups (created_at DESC);

ALTER TABLE public.member_meetups ENABLE ROW LEVEL SECURITY;
