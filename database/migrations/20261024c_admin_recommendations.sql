-- 20261024c_admin_recommendations.sql
-- Admin console, Recommendations: what a teammate did with each recommendation (created it, dismissed it, or put it back).
-- The recommendations themselves are worked out live from member signals; only this decision is stored.
--   id          stable id of the recommendation (hash of its type and subject)
--   state       'created' | 'dismissed' | 'open'
--   by_user     the teammate who decided
-- Additive and safe to re-run. RLS is on with NO policies, so only the server (service role) can read or write it.

create table if not exists public.admin_recommendation_state (
  id          text primary key,
  state       text not null check (state in ('created', 'dismissed', 'open')),
  by_user     uuid,
  updated_at  timestamptz not null default now()
);

alter table public.admin_recommendation_state enable row level security;
