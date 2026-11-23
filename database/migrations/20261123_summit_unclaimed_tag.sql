-- 20261123_summit_unclaimed_tag.sql
-- Contacts tagged summit_unclaimed are Summit free-year attendees who have not claimed yet. A scheduled reminder can
-- target the tag, and claiming (or removal from the list) takes the tag off, so nobody who has claimed is reminded again.
create or replace function public.summit_grant_untag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.claimed_user_id is not null or new.revoked_at is not null then
    update email_contacts set tags = array_remove(tags, 'summit_unclaimed'), updated_at = now()
     where email = new.email and 'summit_unclaimed' = any(tags);
  end if;
  return new;
end $$;
revoke all on function public.summit_grant_untag() from public, anon, authenticated;
drop trigger if exists summit_grant_untag on public.summit_access_grants;
create trigger summit_grant_untag after update of claimed_user_id, revoked_at on public.summit_access_grants
  for each row execute function public.summit_grant_untag();

update email_contacts c set tags = array(select distinct unnest(c.tags || array['summit_unclaimed'])), updated_at = now()
 from summit_access_grants g
 where g.email = c.email and g.revoked_at is null and g.claimed_user_id is null;
