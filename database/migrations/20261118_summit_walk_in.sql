-- Walk-in self check-in at /walk-in. walkin_mode: 'auto' opens it on the Summit day only, 'open' / 'closed' override.
alter table public.summit_door_access add column if not exists walkin_mode text not null default 'auto' check (walkin_mode in ('auto', 'open', 'closed'));
alter table public.summit_door_access alter column code drop not null;
insert into public.summit_door_access (id, enabled, code, version) values (1, false, null, 0) on conflict (id) do nothing;
-- 'self': a registered attendee who checked themselves in on the walk-in page (not counted as a walk-in).
alter table public.summit_registrations drop constraint if exists summit_registrations_check_in_method_check;
alter table public.summit_registrations add constraint summit_registrations_check_in_method_check check (check_in_method in ('qr', 'search', 'walk_in', 'self'));
