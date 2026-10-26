-- Summit confirmation email delivery tracking: status, attempts and the last error CODE (never a password or a message body).
-- Additive and safe to run more than once. Nothing is dropped and no existing row is changed: new columns take their default.
alter table public.summit_registrations add column if not exists confirmation_email_status text;            -- 'sent' | 'failed' | 'sending'
alter table public.summit_registrations add column if not exists confirmation_email_attempts integer not null default 0;
alter table public.summit_registrations add column if not exists confirmation_email_error_code text;        -- e.g. EAUTH, 535, ETIMEDOUT
alter table public.summit_registrations add column if not exists confirmation_email_last_attempt_at timestamptz;
