# Billing: pay now, get 7 extra days

**This is how Ascentor works today: you pay when you choose a plan, full access starts straight away, and your first
payment includes 7 extra days.** There is no free trial.

`POST /api/pay/start` initialises a Paystack transaction for the plan amount; once it settles
(`lib/paymentSettlement.ts`, `fulfilSubscription`) the member gets full access, `subscription_status = 'trialing'`
(the internal name for "first paid period"), and `subscription_end` = one month (or one year) plus **7 extra days**.
Nothing is charged later by us: renewal is not an automatic card charge today. Members can cancel any time and keep access
until the paid period ends. Prices come from `lib/plans-config.ts` (`PLAN_SEEKER_PRICE_NGN`, `PLAN_BUILDER_PRICE_NGN`).

All member-facing wording says exactly that: *you pay now, access starts now, your first payment includes 7 extra days.*
It must not say "free trial", "nothing is charged today" or "no charge until Day 8".

**Wording kept as is:** the Terms page (`app/terms/page.tsx`, "Free Trial" clause) was deliberately not edited; the wording is
for the legal officer to review and still describes a free trial.

## Where the wording was updated, and what is left

Updated to "pay now, 7 extra days": the checkout and plan cards, the upgrade prompt, the help FAQ, the lead-magnet pages, partner checkout and partner admin labels, marketing buttons, referral and signup copy. Left on purpose, only:

- `app/terms/page.tsx`, "Free Trial" clause. Legal text: the wording is for the legal officer to review, so it was not edited and still describes a free trial that checkout does not give.

## Optional later: a real free trial

If a real "add a card now, pay on day 7" trial is wanted one day, it is **not** a copy change. It needs:

1. **A saved Paystack authorization.** Paystack can only charge later with a reusable `authorization_code`
   from a successful transaction. A card-capture step therefore means a small real charge (Paystack's minimum,
   often refunded) or a zero-amount authorization flow, and the card must be a reusable one (cards only; bank
   transfer, USSD and QR channels cannot be charged again).
2. **A scheduled charge.** A job (the existing cron/Trigger.dev setup) that, on day 7, calls Paystack's
   `charge_authorization` with the stored `authorization_code`, records a `payment_attempts` row, and settles it
   through the same `settleReference` path so amount, owner and exactly-once rules still apply.
3. **Reminder emails** on day 5, and a cancel flow that deletes the stored authorization before day 7.
4. **Failed-charge handling:** retries, the "light access" state the admin prototype describes, and recovery
   emails.

**Before building any of this, confirm with Paystack** that the account supports charging a saved authorization
for subscriptions in Nigeria, which channels allow it, the card-capture fee/refund behaviour, and their rules for
disclosing recurring charges to customers (and CBN requirements for recurring card payments). Do not change the
checkout copy back to "free trial" until that flow exists and has been tested in Paystack test mode.
