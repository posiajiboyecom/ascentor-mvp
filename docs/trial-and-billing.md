# Trial and billing: what checkout does today

**Today, checkout charges the full plan price immediately.** `POST /api/pay/start` initialises a Paystack
transaction for the plan amount; once it settles (`lib/paymentSettlement.ts`, `fulfilSubscription`) the member
gets full access, `subscription_status = 'trialing'`, and `subscription_end` = one month (or one year) plus
**7 extra days**. Nothing is charged later by us: renewal is not an automatic card charge today.

So the checkout copy says: *you pay now, access starts now, your first payment includes 7 extra days, cancel
any time and keep access until the paid period ends.* It must not say "free trial", "nothing is charged today"
or "no charge until Day 8".

## Copy that still promises a free trial (not changed yet)

These say or imply a no-charge trial and will contradict checkout until they are reworded or a real trial exists:

- `app/terms/page.tsx`, "Free Trial" clause (legal text: decide the wording with whoever owns the terms).
- `components/UpgradePrompt.tsx` ("Start 7-Day Free Trial", "No charge for 7 days").
- `components/LeadMagnetPage.tsx` and `app/free/*/download/page.tsx` ("Try Sage free for 7 days").
- Partner checkout (`app/p/[subdomain]/checkout/PartnerCheckoutClient.tsx`) uses a partner-set `trialDays`.

## What a real free trial needs

A real "add a card now, pay on day 7" trial is **not** a copy change. It needs:

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
