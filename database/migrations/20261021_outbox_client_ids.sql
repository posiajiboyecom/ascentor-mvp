-- 20261021_outbox_client_ids.sql
-- NOT APPLIED. Run it in the Supabase SQL editor, then set circle_message and dm_message to true in
-- OUTBOX_ENABLED (lib/outbox.ts) to let Circle and direct messages wait in the outbox on a bad connection.
--
-- The browser gives every message a uuid (client_id) before sending. The server uses it so a retry of a
-- message that already arrived returns the same message instead of posting it twice.
-- Safe to run more than once. Existing rows keep client_id NULL and are not affected.

alter table public.circle_messages add column if not exists client_id uuid;
alter table public.dm_messages     add column if not exists client_id uuid;

create unique index if not exists circle_messages_client_id_uniq
  on public.circle_messages (user_id, client_id) where client_id is not null;

create unique index if not exists dm_messages_client_id_uniq
  on public.dm_messages (sender_id, client_id) where client_id is not null;
