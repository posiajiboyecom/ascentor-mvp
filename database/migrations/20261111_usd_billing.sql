-- USD billing. Members in Nigeria pay naira; everyone else pays US dollars (lib/geo.ts).
-- Amount columns named *_kobo hold MINOR units of the row's currency: kobo for NGN, cents for USD.
-- Everything existing is naira, so every new column defaults to 'NGN'.

alter table public.member_subscriptions
  add column if not exists currency text not null default 'NGN';
alter table public.member_subscriptions
  add constraint member_subscriptions_currency_check check (currency in ('NGN', 'USD'));

-- A saved card belongs to the currency it was verified in; a subscription only charges a card of its own currency.
alter table public.payment_methods
  add column if not exists currency text not null default 'NGN';
alter table public.payment_methods
  add constraint payment_methods_currency_check check (currency in ('NGN', 'USD'));

-- Referral credit is earned and spent in one currency.
alter table public.credit_ledger
  add column if not exists currency text not null default 'NGN';
alter table public.credit_ledger
  add constraint credit_ledger_currency_check check (currency in ('NGN', 'USD'));

alter table public.payment_attempts
  add constraint payment_attempts_currency_check check (currency in ('NGN', 'USD'));

-- payments.currency defaulted to 'USD' (from an old schema); every payment so far was naira. Writers always set it, but
-- the default must never mislabel a naira payment.
alter table public.payments alter column currency set default 'NGN';
