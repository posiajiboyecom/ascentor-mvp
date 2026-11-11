-- Security hardening (Supabase advisors 0010 / 0028 / 0029).
-- 1. Trigger functions: nobody needs to call these over the API; triggers run regardless of EXECUTE grants.
revoke execute on function public.create_profile_on_signup() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.notify_new_post() from public, anon, authenticated;
revoke execute on function public.notify_new_reply() from public, anon, authenticated;
revoke execute on function public.notify_post_upvote() from public, anon, authenticated;
revoke execute on function public.notify_reply_upvote() from public, anon, authenticated;
revoke execute on function public.rx_agenda_touch() from public, anon, authenticated;
revoke execute on function public.sync_cohort_member_count() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
revoke execute on function public.update_cohort_member_count() from public, anon, authenticated;
revoke execute on function public.update_post_reply_count() from public, anon, authenticated;

-- 2. RLS helpers only referenced by policies for signed-in users: signed-out visitors don't need them.
--    is_admin() stays callable by anon: shop and product policies for the public role use it.
revoke execute on function public.is_moderator() from public, anon;
revoke execute on function public.is_moderator_or_admin() from public, anon;
revoke execute on function public.rx_blocked_in_thread(uuid) from public, anon;
revoke execute on function public.rx_can_see_group(uuid) from public, anon;
revoke execute on function public.rx_in_circle(uuid) from public, anon;
revoke execute on function public.rx_in_group(uuid) from public, anon;
revoke execute on function public.rx_in_match(uuid) from public, anon;
revoke execute on function public.rx_is_match_member(uuid) from public, anon;
revoke execute on function public.rx_is_match_mentor(uuid) from public, anon;
revoke execute on function public.rx_is_staff() from public, anon;
revoke execute on function public.rx_mentors_circle(uuid) from public, anon;
revoke execute on function public.rx_agenda_circle(uuid) from public, anon;
grant execute on function public.is_moderator(), public.is_moderator_or_admin(), public.rx_blocked_in_thread(uuid),
  public.rx_can_see_group(uuid), public.rx_in_circle(uuid), public.rx_in_group(uuid), public.rx_in_match(uuid),
  public.rx_is_match_member(uuid), public.rx_is_match_mentor(uuid), public.rx_is_staff(), public.rx_mentors_circle(uuid),
  public.rx_agenda_circle(uuid) to authenticated;

-- 3. Functions the app only calls with the service role (or not at all).
revoke execute on function public.get_profile_name(uuid) from public, anon, authenticated;
revoke execute on function public.rx_next_circle_name() from public, anon, authenticated;
revoke execute on function public.get_session_registrant_count(uuid) from public, anon;

-- 4. rx_member_cards (name, city, stage, interests of every member) is read only by the server now.
alter view public.rx_member_cards set (security_invoker = true);
revoke select on public.rx_member_cards from anon, authenticated;

-- rx_group_stats filters by rx_can_see_group() inside; signed-out visitors never need it.
revoke select on public.rx_group_stats from anon;

-- 5. Pin search_path on SECURITY DEFINER helpers flagged as mutable.
alter function public.get_profile_name(uuid) set search_path = public;
alter function public.get_session_registrant_count(uuid) set search_path = public;
alter function public.notify_new_post() set search_path = public;
alter function public.notify_new_reply() set search_path = public;
alter function public.notify_post_upvote() set search_path = public;
alter function public.notify_reply_upvote() set search_path = public;
alter function public.sync_cohort_member_count() set search_path = public;
alter function public.update_cohort_member_count() set search_path = public;
alter function public.create_profile_on_signup() set search_path = public;
alter function public.confirm_waitlist_email(text) set search_path = public;

-- The server (service role) keeps everything it uses.
grant execute on function public.rx_next_circle_name(), public.get_profile_name(uuid), public.get_session_registrant_count(uuid) to service_role;
grant select on public.rx_member_cards, public.rx_group_stats to service_role;
