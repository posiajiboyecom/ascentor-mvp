-- Elevation Summit entrance check-in.
-- A registration is checked in once: checked_in_at is set atomically by the door scanner (update ... where checked_in_at is null),
-- so two scanners reading the same ticket at once can't both admit it. checked_in_by is the staff member who scanned it.
alter table public.summit_registrations
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id) on delete set null,
  add column if not exists check_in_method text check (check_in_method in ('qr', 'search', 'walk_in'));

create index if not exists summit_registrations_checked_in_at_idx on public.summit_registrations (checked_in_at) where checked_in_at is not null;

-- The door team needs its own area so a volunteer can be given check-in and nothing else.
update public.admin_roles
   set levels = levels || jsonb_build_object('checkin', 'full'), updated_at = now()
 where id = 'summit' and not (levels ? 'checkin');
