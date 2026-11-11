-- 20261115_lock_view_writes_and_search_path.sql
-- Production-readiness security pass (Supabase advisor findings).
--
-- 1. CRITICAL: public.member_directory (SELECT id, full_name, avatar_url FROM profiles) and
--    public.rx_group_stats are simple, auto-updatable views owned by postgres (BYPASSRLS) and
--    not security_invoker. The default Supabase grants gave anon/authenticated INSERT, UPDATE and
--    DELETE on them, so any signed-in member could rename or delete ANY profile, or delete groups,
--    straight through PostgREST (/rest/v1/member_directory), bypassing every RLS policy on the base
--    tables. The app only ever SELECTs from views, so every write privilege on every public view is
--    revoked from the API roles. SELECT stays exactly as it was.
--    The two views stay security definer on purpose: member_directory deliberately exposes only
--    id/name/avatar of members a caller cannot otherwise read, and rx_group_stats filters itself
--    with rx_can_see_group()/rx_is_staff(). With writes gone they are read-only projections.
--
-- 2. WARN: functions with a role-mutable search_path. Pinned to public, pg_temp (what every caller
--    already resolves to), so a caller-controlled search_path can't shadow the objects they use.
--
-- Idempotent: safe to re-run.

do $$
declare v record;
begin
  for v in select viewname from pg_views where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated, public', v.viewname);
  end loop;
end $$;

-- NOTE for future migrations: a new view inherits Supabase's default ALL grant. Create views with
-- `with (security_invoker = on)`, or follow them with
-- `revoke insert, update, delete, truncate on public.<view> from anon, authenticated;`

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      and d.objid is null                               -- skip functions owned by extensions (vector, pg_trgm)
      and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;
