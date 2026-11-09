-- Member meetups for city groups. Members of a city group plan meetups and RSVP; the exact venue is shown only to people
-- going (and the host). All reads and writes go through server actions with the service role, so RLS is on with no policies:
-- nothing is reachable from the browser directly.
CREATE TABLE IF NOT EXISTS public.rx_meetups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.rx_groups(id) ON DELETE CASCADE,
  host_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  area text NOT NULL CHECK (char_length(area) BETWEEN 2 AND 120),
  venue text NOT NULL CHECK (char_length(venue) BETWEEN 2 AND 200),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS rx_meetups_group_start ON public.rx_meetups (group_id, starts_at);

CREATE TABLE IF NOT EXISTS public.rx_meetup_rsvps (
  meetup_id uuid NOT NULL REFERENCES public.rx_meetups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going', 'maybe', 'no')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);

ALTER TABLE public.rx_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rx_meetup_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rx_meetups FROM anon, authenticated;
REVOKE ALL ON public.rx_meetup_rsvps FROM anon, authenticated;
