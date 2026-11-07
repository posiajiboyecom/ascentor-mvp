-- Email system: one contact book built from every place Ascentor collects an email, plus campaigns sent from the
-- Hostinger mailbox under a daily cap. Additive and idempotent. Run in the Supabase SQL editor, or:
--   npx tsx scripts/apply-migration.ts database/migrations/20261109_email_system.sql --yes
--
--   email_contacts    one row per address, with every category it came from (sources) and event tags
--   email_campaigns   a message, its audience and its progress
--   email_sends       one row per recipient of a campaign: the queue, delivery result, opens, clicks, unsubscribe
--   email_templates   reusable designs
--   email_settings    sender name, reply-to, daily cap, sending pace, footer
--
-- Only the service role reads or writes these (admin console and the dispatcher). RLS is on with no policies.

-- ── contacts ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_contacts (
  email              text PRIMARY KEY CHECK (email = lower(email)),
  name               text,
  phone              text,
  sources            text[] NOT NULL DEFAULT '{}',
  tags               text[] NOT NULL DEFAULT '{}',
  source_seen        jsonb  NOT NULL DEFAULT '{}'::jsonb,   -- { "summit": "2026-10-02T…", … } first time seen per category
  first_seen_at      timestamptz,
  last_seen_at       timestamptz,
  unsubscribed_at    timestamptz,
  unsubscribe_source text,                                  -- link, admin, newsletter, deletion_request, import
  resubscribed_at    timestamptz,
  bounced_at         timestamptz,
  bounce_reason      text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_contacts_sources_idx ON public.email_contacts USING gin (sources);
CREATE INDEX IF NOT EXISTS email_contacts_tags_idx    ON public.email_contacts USING gin (tags);
CREATE INDEX IF NOT EXISTS email_contacts_seen_idx    ON public.email_contacts (last_seen_at DESC);

-- ── templates, campaigns, sends, settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  subject    text NOT NULL DEFAULT '',
  preheader  text NOT NULL DEFAULT '',
  body_html  text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL DEFAULT 'Untitled',
  subject       text NOT NULL DEFAULT '',
  preheader     text NOT NULL DEFAULT '',
  heading       text NOT NULL DEFAULT '',
  body_html     text NOT NULL DEFAULT '',
  -- { "all": bool, "sources": [..], "tags": [..], "exclude": [..], "emails": [..] }
  audience      jsonb NOT NULL DEFAULT '{"all": false, "sources": [], "tags": [], "exclude": [], "emails": []}'::jsonb,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','paused','sent','cancelled')),
  scheduled_at  timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  total         integer NOT NULL DEFAULT 0,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON public.email_campaigns (status, scheduled_at);

CREATE TABLE IF NOT EXISTS public.email_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email           text NOT NULL,
  name            text,
  token           uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,  -- unsubscribe and tracking links
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','skipped')),
  claimed_at      timestamptz,
  sent_at         timestamptz,
  error           text,
  opened_at       timestamptz,
  open_count      integer NOT NULL DEFAULT 0,
  clicked_at      timestamptz,
  click_count     integer NOT NULL DEFAULT 0,
  unsubscribed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS email_sends_queue_idx ON public.email_sends (status, created_at);
CREATE INDEX IF NOT EXISTS email_sends_sent_idx  ON public.email_sends (sent_at) WHERE sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_sends_email_idx ON public.email_sends (email);

CREATE TABLE IF NOT EXISTS public.email_settings (
  id          boolean PRIMARY KEY DEFAULT true CHECK (id),
  from_name   text    NOT NULL DEFAULT 'Ascentor',
  reply_to    text,
  daily_limit integer NOT NULL DEFAULT 800 CHECK (daily_limit BETWEEN 1 AND 50000),
  per_minute  integer NOT NULL DEFAULT 20  CHECK (per_minute BETWEEN 1 AND 300),
  footer_text text    NOT NULL DEFAULT 'Ascentor · Lagos, Nigeria',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.email_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.email_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_contacts, public.email_templates, public.email_campaigns, public.email_sends, public.email_settings FROM anon, authenticated;

-- ── contact sync ────────────────────────────────────────────────────────────
-- Gathers every address from every source table that exists, with whatever name/phone/date columns it has, then
-- rebuilds each contact's categories. Categories added by an admin ('manual', 'imported') are kept. Safe to run often.
CREATE OR REPLACE FUNCTION public.email_sync_contacts() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- table, category, extra WHERE (optional)
  src text[][] := ARRAY[
    ['newsletter_subscribers', 'newsletter',      ''],
    ['profiles',               'members',         ''],
    ['summit_registrations',   'summit',          ''],
    ['summit_interest',        'summit_interest', ''],
    ['summit_donations',       'donors',          ''],
    ['event_registrations',    'events',          ''],
    ['shop_orders',            'shop',            ''],
    ['shop_leads',             'shop_leads',      ''],
    ['waitlist_entries',       'waitlist',        ''],
    ['lead_magnet_downloads',  'lead_magnets',    ''],
    ['contact_messages',       'contact_form',    ''],
    ['mentor_applications',    'mentors',         ''],
    ['partner_enquiries',      'partners',        ''],
    ['partner_members',        'partners',        ''],
    ['job_applications',       'careers',         '']
  ];
  r text[];
  t text; cat text;
  cols text[];
  name_x text; phone_x text; seen_x text; tag_x text; join_x text; where_x text;
  n_before integer; n_after integer; per jsonb := '{}'::jsonb; got integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _ec_stage (email text, name text, phone text, source text, tag text, seen_at timestamptz) ON COMMIT DROP;
  TRUNCATE _ec_stage;
  SELECT count(*) INTO n_before FROM email_contacts;

  FOREACH r SLICE 1 IN ARRAY src LOOP
    t := r[1]; cat := r[2];
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    SELECT array_agg(column_name::text) INTO cols FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t;
    IF NOT ('email' = ANY(cols)) THEN CONTINUE; END IF;

    name_x := CASE
      WHEN 'full_name' = ANY(cols) THEN 'x.full_name'
      WHEN 'first_name' = ANY(cols) AND 'last_name' = ANY(cols) THEN 'nullif(trim(concat_ws('' '', x.first_name, x.last_name)), '''')'
      WHEN 'first_name' = ANY(cols) THEN 'x.first_name'
      WHEN 'name' = ANY(cols) THEN 'x.name'
      ELSE 'NULL' END;
    phone_x := CASE
      WHEN 'whatsapp' = ANY(cols) THEN 'x.whatsapp'
      WHEN 'whatsapp_phone' = ANY(cols) THEN 'x.whatsapp_phone'
      WHEN 'phone' = ANY(cols) THEN 'x.phone'
      ELSE 'NULL' END;
    seen_x := CASE
      WHEN 'created_at' = ANY(cols) THEN 'x.created_at'
      WHEN 'subscribed_at' = ANY(cols) THEN 'x.subscribed_at'
      WHEN 'requested_at' = ANY(cols) THEN 'x.requested_at'
      ELSE 'now()' END;
    tag_x := 'NULL'; join_x := ''; where_x := '';

    -- Public events: tag each registrant with the event's title so a single event can be targeted.
    IF t = 'event_registrations' AND 'event_id' = ANY(cols) AND to_regclass('public.events') IS NOT NULL THEN
      join_x := ' LEFT JOIN public.events ev ON ev.id = x.event_id';
      tag_x := '''event:'' || ev.title';
    END IF;
    -- Members: never the demo accounts.
    IF t = 'profiles' AND to_regclass('public.member_profile') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='member_profile' AND column_name='is_demo') THEN
      where_x := ' AND NOT EXISTS (SELECT 1 FROM public.member_profile mp WHERE mp.user_id = x.id AND mp.is_demo)';
    END IF;

    EXECUTE format(
      'INSERT INTO _ec_stage (email, name, phone, source, tag, seen_at)
       SELECT lower(trim(x.email)), nullif(trim(%s), ''''), nullif(trim(%s::text), ''''), %L, %s, %s
       FROM public.%I x%s
       WHERE x.email IS NOT NULL AND lower(trim(x.email)) ~ ''^[^@\s]+@[^@\s]+\.[^@\s]+$''%s',
      name_x, phone_x, cat, tag_x, seen_x, t, join_x, where_x);
    GET DIAGNOSTICS got = ROW_COUNT;
    per := per || jsonb_build_object(cat, COALESCE((per->>cat)::int, 0) + got);
  END LOOP;

  WITH by_src AS (
    SELECT email, source, min(seen_at) AS first_at, max(seen_at) AS last_at FROM _ec_stage GROUP BY email, source
  ), agg AS (
    SELECT s.email,
      (SELECT st.name  FROM _ec_stage st WHERE st.email = s.email AND st.name  IS NOT NULL ORDER BY st.seen_at DESC NULLS LAST LIMIT 1) AS name,
      (SELECT st.phone FROM _ec_stage st WHERE st.email = s.email AND st.phone IS NOT NULL ORDER BY st.seen_at DESC NULLS LAST LIMIT 1) AS phone,
      array_agg(DISTINCT s.source ORDER BY s.source) AS sources,
      COALESCE((SELECT array_agg(DISTINCT st.tag) FROM _ec_stage st WHERE st.email = s.email AND st.tag IS NOT NULL), '{}') AS tags,
      jsonb_object_agg(s.source, s.first_at) AS source_seen,
      min(s.first_at) AS first_at, max(s.last_at) AS last_at
    FROM by_src s GROUP BY s.email
  )
  INSERT INTO email_contacts AS c (email, name, phone, sources, tags, source_seen, first_seen_at, last_seen_at)
  SELECT email, name, phone, sources, tags, source_seen, first_at, last_at FROM agg
  ON CONFLICT (email) DO UPDATE SET
    name          = COALESCE(EXCLUDED.name, c.name),
    phone         = COALESCE(EXCLUDED.phone, c.phone),
    sources       = ARRAY(SELECT DISTINCT u FROM unnest(EXCLUDED.sources || ARRAY(SELECT k FROM unnest(c.sources) k WHERE k IN ('manual','imported'))) u ORDER BY u),
    tags          = ARRAY(SELECT DISTINCT u FROM unnest(EXCLUDED.tags || ARRAY(SELECT k FROM unnest(c.tags) k WHERE k NOT LIKE 'event:%')) u ORDER BY u),
    source_seen   = c.source_seen || EXCLUDED.source_seen,
    first_seen_at = LEAST(c.first_seen_at, EXCLUDED.first_seen_at),
    last_seen_at  = GREATEST(c.last_seen_at, EXCLUDED.last_seen_at),
    updated_at    = now();

  -- Someone who unsubscribed from the old newsletter stays unsubscribed here (unless an admin resubscribed them later).
  IF to_regclass('public.newsletter_subscribers') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='newsletter_subscribers' AND column_name='is_active') THEN
    UPDATE email_contacts c SET unsubscribed_at = now(), unsubscribe_source = 'newsletter', updated_at = now()
    FROM newsletter_subscribers ns
    WHERE lower(ns.email) = c.email AND ns.is_active = false AND c.unsubscribed_at IS NULL
      AND c.resubscribed_at IS NULL;
  END IF;

  -- Anyone who asked for their data to be deleted is never emailed.
  IF to_regclass('public.deletion_requests') IS NOT NULL THEN
    UPDATE email_contacts c SET unsubscribed_at = COALESCE(c.unsubscribed_at, now()), unsubscribe_source = 'deletion_request', updated_at = now()
    FROM deletion_requests d
    WHERE lower(d.email) = c.email AND (c.unsubscribed_at IS NULL OR c.unsubscribe_source <> 'deletion_request');
  END IF;

  SELECT count(*) INTO n_after FROM email_contacts;
  RETURN jsonb_build_object('total', n_after, 'added', n_after - n_before, 'rows_by_source', per);
END
$$;

-- ── audience ────────────────────────────────────────────────────────────────
-- The addresses a campaign reaches: everyone (all = true), or anyone in one of the chosen categories or tags, plus
-- named addresses; minus excluded categories; never unsubscribed or bounced contacts.
CREATE OR REPLACE FUNCTION public.email_audience(aud jsonb) RETURNS TABLE (email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.email, c.name FROM email_contacts c
  WHERE c.unsubscribed_at IS NULL AND c.bounced_at IS NULL
    AND (
      COALESCE((aud->>'all')::boolean, false)
      OR c.sources && ARRAY(SELECT jsonb_array_elements_text(COALESCE(aud->'sources', '[]'::jsonb)))
      OR c.tags    && ARRAY(SELECT jsonb_array_elements_text(COALESCE(aud->'tags', '[]'::jsonb)))
      OR c.email = ANY(ARRAY(SELECT lower(jsonb_array_elements_text(COALESCE(aud->'emails', '[]'::jsonb)))))
    )
    AND NOT (c.sources && ARRAY(SELECT jsonb_array_elements_text(COALESCE(aud->'exclude', '[]'::jsonb))));
$$;

CREATE OR REPLACE FUNCTION public.email_audience_count(aud jsonb) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT count(*)::int FROM public.email_audience(aud); $$;

-- Fills a campaign's queue from its audience (once; later runs add nobody twice).
CREATE OR REPLACE FUNCTION public.email_enqueue(cid uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aud jsonb; n integer;
BEGIN
  SELECT audience INTO aud FROM email_campaigns WHERE id = cid;
  IF aud IS NULL THEN RETURN 0; END IF;
  INSERT INTO email_sends (campaign_id, email, name)
  SELECT cid, a.email, a.name FROM public.email_audience(aud) a
  ON CONFLICT (campaign_id, email) DO NOTHING;
  SELECT count(*) INTO n FROM email_sends WHERE campaign_id = cid;
  UPDATE email_campaigns SET total = n, updated_at = now() WHERE id = cid;
  RETURN n;
END
$$;

-- Hands the dispatcher up to n queued messages from campaigns that are sending, oldest campaign first. Rows claimed
-- by a run that died more than 15 minutes ago are handed out again. SKIP LOCKED keeps two runs from taking the same row.
CREATE OR REPLACE FUNCTION public.email_claim(n integer) RETURNS SETOF public.email_sends
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE email_sends s SET status = 'sending', claimed_at = now()
  WHERE s.id IN (
    SELECT q.id FROM email_sends q JOIN email_campaigns c ON c.id = q.campaign_id
    WHERE c.status = 'sending'
      AND (q.status = 'queued' OR (q.status = 'sending' AND q.claimed_at < now() - interval '15 minutes'))
    ORDER BY c.started_at NULLS LAST, q.created_at
    LIMIT GREATEST(n, 0)
    FOR UPDATE OF q SKIP LOCKED
  )
  RETURNING s.*;
END
$$;

-- Messages sent in the last 24 hours (the Hostinger cap is a rolling 24 hours).
CREATE OR REPLACE FUNCTION public.email_sent_last_24h() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM email_sends WHERE sent_at > now() - interval '24 hours';
$$;

-- Per-campaign numbers for the console.
CREATE OR REPLACE FUNCTION public.email_campaign_stats(cids uuid[]) RETURNS TABLE (
  campaign_id uuid, total int, queued int, sent int, failed int, skipped int, opened int, clicked int, unsubscribed int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.campaign_id,
    count(*)::int,
    count(*) FILTER (WHERE s.status IN ('queued','sending'))::int,
    count(*) FILTER (WHERE s.status = 'sent')::int,
    count(*) FILTER (WHERE s.status = 'failed')::int,
    count(*) FILTER (WHERE s.status = 'skipped')::int,
    count(*) FILTER (WHERE s.opened_at IS NOT NULL)::int,
    count(*) FILTER (WHERE s.clicked_at IS NOT NULL)::int,
    count(*) FILTER (WHERE s.unsubscribed_at IS NOT NULL)::int
  FROM email_sends s WHERE s.campaign_id = ANY(cids) GROUP BY s.campaign_id;
$$;

-- Counts per category for the contacts screen (reachable = not unsubscribed or bounced).
CREATE OR REPLACE FUNCTION public.email_source_counts() RETURNS TABLE (source text, total int, reachable int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s, count(*)::int, count(*) FILTER (WHERE c.unsubscribed_at IS NULL AND c.bounced_at IS NULL)::int
  FROM email_contacts c, unnest(c.sources) s GROUP BY s;
$$;

CREATE OR REPLACE FUNCTION public.email_tag_counts() RETURNS TABLE (tag text, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t, count(*)::int FROM email_contacts c, unnest(c.tags) t GROUP BY t ORDER BY t;
$$;

DO $g$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['email_sync_contacts()','email_audience(jsonb)','email_audience_count(jsonb)','email_enqueue(uuid)',
                           'email_claim(integer)','email_sent_last_24h()','email_campaign_stats(uuid[])','email_source_counts()','email_tag_counts()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END
$g$;

-- ── dispatcher lease, tracking, unsubscribe ────────────────────────────────
-- Only one dispatcher sends at a time (so the pace and the daily cap hold). The lease expires on its own.
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.email_settings ADD COLUMN IF NOT EXISTS lease_owner text;

CREATE OR REPLACE FUNCTION public.email_lease(owner text, seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  UPDATE email_settings SET lease_until = now() + make_interval(secs => seconds), lease_owner = owner
  WHERE id AND (lease_until IS NULL OR lease_until < now() OR lease_owner = owner)
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END
$$;

CREATE OR REPLACE FUNCTION public.email_release(owner text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_settings SET lease_until = NULL, lease_owner = NULL WHERE id AND lease_owner = owner;
$$;

CREATE OR REPLACE FUNCTION public.email_track(t uuid, kind text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE email_sends SET
    opened_at   = COALESCE(opened_at, now()),
    open_count  = open_count + CASE WHEN kind = 'open' THEN 1 ELSE 0 END,
    clicked_at  = CASE WHEN kind = 'click' THEN COALESCE(clicked_at, now()) ELSE clicked_at END,
    click_count = click_count + CASE WHEN kind = 'click' THEN 1 ELSE 0 END
  WHERE token = t AND status = 'sent';
$$;

-- Unsubscribes the address behind a send token from everything. Returns the address (NULL for an unknown token).
CREATE OR REPLACE FUNCTION public.email_unsubscribe(t uuid, src text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e text;
BEGIN
  UPDATE email_sends SET unsubscribed_at = COALESCE(unsubscribed_at, now()) WHERE token = t RETURNING email INTO e;
  IF e IS NULL THEN RETURN NULL; END IF;
  INSERT INTO email_contacts (email, unsubscribed_at, unsubscribe_source) VALUES (e, now(), src)
  ON CONFLICT (email) DO UPDATE SET unsubscribed_at = COALESCE(email_contacts.unsubscribed_at, now()),
    unsubscribe_source = COALESCE(email_contacts.unsubscribe_source, src), resubscribed_at = NULL, updated_at = now();
  IF to_regclass('public.newsletter_subscribers') IS NOT NULL THEN
    EXECUTE 'UPDATE public.newsletter_subscribers SET is_active = false WHERE lower(email) = $1 AND is_active' USING e;
  END IF;
  RETURN e;
END
$$;

DO $g2$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['email_lease(text,integer)','email_release(text)','email_track(uuid,text)','email_unsubscribe(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END
$g2$;

-- First fill.
SELECT public.email_sync_contacts();
