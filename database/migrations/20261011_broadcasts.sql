-- 20261011_broadcasts.sql
-- Admin broadcasts: a staff member writes one message and sends it in the app, by email, or both, to everyone or to a group
-- (a stage, a city, a language, or one Circle). Optionally it also shows as a card in the sidebar until a date.
--
-- Additive and idempotent. Apply with:
--   npx tsx scripts/apply-migration.ts database/migrations/20261011_broadcasts.sql --yes
-- Note for the statement splitter: no semicolons inside quoted strings in this file.

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  body         text NOT NULL,
  link_url     text,
  link_label   text,
  channel      text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','both')),
  audience     jsonb NOT NULL DEFAULT '{"kind":"all"}'::jsonb,
  pin_card     boolean NOT NULL DEFAULT false,
  pin_until    timestamptz,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','cancelled')),
  total        integer,
  in_app_sent  integer NOT NULL DEFAULT 0,
  emailed      integer NOT NULL DEFAULT 0,
  email_failed integer NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE INDEX IF NOT EXISTS broadcasts_created_idx ON public.broadcasts (created_at DESC);
CREATE INDEX IF NOT EXISTS broadcasts_pinned_idx ON public.broadcasts (pin_card, status) WHERE pin_card;

-- One row per person per broadcast. It is what makes a send safe to repeat and lets a long list finish over several runs:
-- anyone with a row has already been handled.
CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app       boolean NOT NULL DEFAULT false,
  pushed       boolean NOT NULL DEFAULT false,
  emailed      boolean NOT NULL DEFAULT false,
  skipped      text,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, user_id)
);

-- Server only: both tables are read and written with the service role by staff-checked code. Members have no access.
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.broadcasts, public.broadcast_deliveries FROM anon, authenticated;
