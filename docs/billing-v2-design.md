# Billing v2: build design

Source of truth: `C:\Users\oyedo\Desktop\Build\ascentor-secrets\Ascentor Payments Developer Handoff.md` (Posi's spec; every rule there is Decided unless marked Proposed, and where it conflicts with older code, docs or earlier owner messages, the handoff wins). This file says HOW we build it. Money is involved: read the safety rules first.

## Safety rules (non-negotiable)

1. Two switches, both default OFF in production (read at request time from env, never from the client):
   - `BILLING_V2=on` shows the new checkout, Billing screen and card management. Off: today's checkout and screens keep working unchanged.
   - `BILLING_V2_CHARGING=off|dry|live` controls the renewal engine. `off` (default) does nothing, `dry` computes and logs what it WOULD charge into `billing_events` (event `would_charge`) without calling Paystack, `live` charges. Production stays `off` until the owner says so.
2. The engine only touches rows in `member_subscriptions`. Existing members (legacy `profiles.subscription_*`) keep their access exactly as it is until they subscribe again through v2. Nothing is migrated or charged automatically.
3. Paystack local keys are `sk_test_`. Never print keys. Production Paystack mode is unknown: code must work in both and must never log secrets, authorization codes or full card data. Only last4, brand, expiry month/year, bank are shown or logged.
4. Authorization codes are secrets: store them encrypted with `lib/crypto.ts` (APP_SECRET_KEY). Never send them to the client.
5. All migrations are additive (create if not exists / add column if not exists, RLS on). No DROP/DELETE/TRUNCATE. The lead applies them after a backup.
6. Naira only. Prices live in ONE place: `lib/billing/catalog.ts` (kobo integers), copied from the handoff table. Never hard-code a price elsewhere.
7. Tests use temporary users and Paystack TEST mode only; delete what you create. No real emails to real people: use the mailer only to the test user's own throwaway address or assert on built HTML.

## Catalog (from the handoff, naira)

| code | tier | price type | cycle | NGN |
|---|---|---|---|---|
| seeker_solo_monthly | Seeker | solo | monthly | 3,000 |
| seeker_solo_annual | Seeker | solo | yearly | 30,000 |
| seeker_group_monthly | Seeker | group | monthly | 2,000 |
| seeker_group_annual | Seeker | group | yearly | 22,000 |
| builder_solo_monthly | Builder | solo | monthly | 7,000 |
| builder_solo_annual | Builder | solo | yearly | 70,000 |
| builder_group_monthly | Builder | group | monthly | 5,000 |
| builder_group_annual | Builder | group | yearly | 55,000 |

Existing DB plan ids stay: Seeker = `explorer`, Builder = `builder`, Leader = `leader` (free), legacy `climber` untouched. `lib/plans-config.ts` and its env prices (15k/25k/40k) are superseded when `BILLING_V2=on`; keep the file working for the legacy path.

## Data model (migration `database/migrations/20261026a_billing_v2.sql`, additive)

- `payment_methods`: id uuid pk, user_id uuid not null, paystack_customer_code text, auth_enc text not null (encrypted authorization_code), signature text (Paystack card signature, used to dedupe the same card), brand, last4, exp_month, exp_year, bank, card_type, country_code, reusable bool, is_default bool default false, created_at, removed_at timestamptz (soft delete). Unique (user_id, signature) where removed_at is null. At most one default per user (partial unique index where is_default and removed_at is null).
- `member_subscriptions`: user_id uuid pk, plan_code text, tier text ('explorer'|'builder'), price_type ('solo'|'group'), cycle ('monthly'|'yearly'), state ('trial'|'active'|'grace'|'lapsed'|'cancelled'), trial_ends_at, next_charge_at, period_end, payment_method_id, failed_count int default 0, last_failed_at, grace_ends_at, extension_used bool default false, cancel_at_period_end bool default false, started_at, last_charge_at, last_charge_ref text, locked_group_price_until timestamptz, created_at, updated_at.
- `billing_events`: id, user_id, type text, data jsonb, created_at. Types (log every one): trial_started, first_charge, renewal_succeeded, renewal_failed, grace_started, lapsed, reactivated, group_joined, group_left, group_price_applied, group_price_removed, credit_earned, credit_used, credit_expired, credit_cancelled, card_added, card_removed, card_default_changed, would_charge, charge_retry.
- `billing_groups`: id, code text unique (like ASC-7K2Q), link_token text unique, created_by, status ('forming'|'active'|'broken'), flagged bool, flag_reason, created_at. `billing_group_members`: group_id, user_id, joined_at, left_at, plan_code; unique active membership per user (partial unique where left_at is null).
- `credit_ledger`: id, user_id, amount_kobo int (+earned/-used/-expired/-cancelled), reason, source_referral_id, source_payment_ref, expires_at, created_at.
- Referral codes: reuse `profiles.referral_code` and the existing `referrals` table (add `flagged_at` already exists, `credit_earned_at` timestamptz new).
- Facilitator invites are built separately (`leader_invites`, see docs/leader-invites.md): invitees skip the card, Leader is free (`profiles.leader_free`).

## Modules (all under `lib/billing/`)

- `catalog.ts` prices, plan lookup, `priceFor(tier, priceType, cycle)`, per-month display.
- `rules.ts` PURE logic with unit tests (`scripts/billing-tests/*.test.ts`, run with `npx tsx --test`): state machine transitions; trial end = start + 7 days; first charge day 8; group completeness (>=3 active, free Leaders do not count, mixed tiers all count, yearly counts as active); group price at first charge with one extension to day 14 then solo; group protection (14-day grace to replace, warn 7 days before renewal, solo at renewal); failed payment: retry at +1, +3, +5 days (within the 3 to 7 day window) with a 7-day grace that keeps full access then light access; seat released at the end of grace; credit math (20% of the inviter's own monthly price per referral, applies up to 100% of the next charge, remainder carries, expires after 12 months oldest first, charge amount after credit; zero amount means skip charge and keep active); quorum (60% of active members rounded up, minimum 3, 4 or fewer offers merge); Paystack fee estimate.
- `paystack.ts` server-only thin client: initializeTransaction, verifyTransaction, chargeAuthorization (custom amount, reference, idempotent), refund, listAuthorizations helper from verify payloads. Handles test/live transparently. Never logs secrets.
- `cards.ts` payment-method service: addFromVerifiedTransaction (extract reusable authorization, dedupe by signature, encrypt), list (safe fields only), setDefault, remove (soft delete; cannot remove the last card while the subscription is trial/active/grace unless they cancel first; if removing the default, require choosing another or auto-promote the newest), all writing billing_events and sending notifications.
- `subscriptions.ts` start trial (needs a default card; invited Leaders skip), cancel (during trial: never charged), reactivate, change plan or price type at next billing date, state sync into `profiles` (subscription_plan, subscription_status, subscription_end, billing_cycle) so existing access code and screens keep working.
- `engine.ts` the renewal runner: finds due subscriptions (`next_charge_at <= now`), resolves price (group or solo, credit), then per CHARGING mode: off (return), dry (log would_charge), live (chargeAuthorization with idempotent reference `sub_<userId>_<yyyymmddHH>` and settle). Handles retries, grace, lapse, reactivation. Runs from `app/api/cron/billing/route.ts` (secured the same way as the existing cron routes) and is added to vercel.json crons hourly.
- `notify.ts` ONE function per event that sends BOTH an in-app notification (table `notifications`, link to /settings/billing) AND a branded email (reuse the repo's email layout: see `lib/rx/notifications.ts` buildNoticeEmail and `lib/nodemailer.ts`): card_added, card_removed, card_default_changed, payment_succeeded (with amount and next date), payment_failed (with a payment link or the update-card link and the grace end date), trial_started, trial_ending (day 6), grace_started, lapsed, reactivated, group_warning, credit_earned. Copy: plain, no em dashes, never show more than brand and last4.

## Screens (member)

- Settings > Billing (`/settings/billing`, or the existing billing tab; reuse the shell): current plan, state, next charge date and amount, "Payment methods" list (brand, last4, expiry, Default badge), Add a card, Make default, Remove (confirm), cancel/resume, receipts list. Behind `BILLING_V2`.
- Checkout v2: choose tier (default from onboarding stage; any member may choose Builder), monthly or yearly, "Pay as a group" or "Join a group" (code or link), shows BOTH prices ("₦2,000 once 3 friends join, ₦3,000 until then"), then add a card (Paystack hosted/inline, card channel only): the card is verified with a small NGN 50 charge that is refunded immediately; the authorization is saved; the trial starts; first charge on day 8.
- Group status page (active count only, never who failed to pay).

## Admin (console areas that already exist)

- `payments`: add refund/failed views as they exist; `plans`: show the new catalog (read-only prices from catalog.ts, open/closed switches kept); `referrals`: balances and ledger; add Subscriptions and Groups as bespoke pages under existing areas (`/admin/c/payments/subscriptions`, `/admin/c/members/groups` guarded by requireArea('payments'|'members', ...)), because area keys are fixed in lib/admin/areas.ts.

## Access rules

- Lapsed (after grace) keeps: Today and daily practices, own growth record, open house group, direct messages. Loses: Sage, Circle chat, advanced Learn, mentor sessions. Existing light-access code (profiles.subscription_status 'free'/light) and the admin 'light access' settings must map onto this.
- Leader: free while facilitating; after a 90-day cycle with no Circle, moves to the Builder price (flag for the engine; owner to confirm mechanics).
- Open decisions in the handoff (Sage limits, DM conflict between the access table and light access, Circle placement of groups, two-person group discount, Builder partner offers, monthly refunds, bank transfer/USSD renewals): use the Proposed defaults, change nothing that exists for those, and list each in the final report.
