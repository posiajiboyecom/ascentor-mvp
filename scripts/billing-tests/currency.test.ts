// USD billing: members in Nigeria pay naira, everyone else pays US dollars.
//   npm run test:billing
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../lib/billing/catalog';
import * as P from '../../lib/billing/preview';
import { currencyForCountry } from '../../lib/geo-currency';
import { mrrByCurrency, moneyTotals, mrrKobo } from '../../lib/admin/billing-admin';
import { buildEmail } from '../../lib/billing/notify';
import { DONATION_LIMITS, donateFormSchemaFor } from '../../app/(marketing)/donate/donateFormSchema';

test('location: Nigeria and unknown pay naira, everyone else pays US dollars', () => {
  assert.equal(currencyForCountry('NG'), 'NGN');
  assert.equal(currencyForCountry('ng'), 'NGN');
  assert.equal(currencyForCountry(null), 'NGN');
  assert.equal(currencyForCountry(''), 'NGN');
  assert.equal(currencyForCountry('XX'), 'NGN');
  assert.equal(currencyForCountry('Nigeria'), 'NGN'); // not a code: never charge dollars by accident
  for (const cc of ['GB', 'US', 'GH', 'KE', 'CA', 'ZA', 'DE']) assert.equal(currencyForCountry(cc), 'USD', cc);
});

test('USD prices: Seeker $5 / $50, Builder $10 / $100, no group discount', () => {
  assert.equal(C.priceFor('explorer', 'solo', 'monthly', 'USD'), 500);
  assert.equal(C.priceFor('explorer', 'solo', 'yearly', 'USD'), 5000);
  assert.equal(C.priceFor('builder', 'solo', 'monthly', 'USD'), 1000);
  assert.equal(C.priceFor('builder', 'solo', 'yearly', 'USD'), 10000);
  for (const t of ['explorer', 'builder'] as const) for (const c of ['monthly', 'yearly'] as const) {
    assert.equal(C.priceFor(t, 'group', c, 'USD'), C.priceFor(t, 'solo', c, 'USD'), `${t} ${c}`);
  }
  assert.equal(C.groupDiscountApplies('USD'), false);
  assert.equal(C.groupDiscountApplies('NGN'), true);
});

test('naira prices are unchanged, and naira is the default everywhere', () => {
  assert.equal(C.priceFor('explorer', 'solo', 'monthly'), 300_000);
  assert.equal(C.priceFor('explorer', 'group', 'monthly'), 200_000);
  assert.equal(C.priceFor('builder', 'solo', 'yearly'), 7_000_000);
  assert.equal(C.priceFor('builder', 'group', 'yearly', 'NGN'), 5_500_000);
  const p = C.getPlan('builder_solo_annual')!;
  assert.equal(C.perMonthKobo(p), Math.round(7_000_000 / 12));
  assert.equal(C.perMonthKobo(p, 'USD'), Math.round(10_000 / 12));
});

test('formatMoney', () => {
  assert.equal(C.formatMoney(300_000, 'NGN'), '₦3,000');
  assert.equal(C.formatMoney(500, 'USD'), '$5');
  assert.equal(C.formatMoney(10_000, 'USD'), '$100');
  assert.equal(C.formatMoney(833, 'USD'), '$8.33');
  assert.equal(C.formatMoney(100, 'USD'), '$1');
  assert.equal(C.formatMoney(300_000), '₦3,000');
});

test('preview: a USD member in a complete group still pays the solo price', () => {
  const now = new Date('2026-11-11T10:00:00Z');
  const usd = P.previewNextCharge({ tier: 'explorer', cycle: 'monthly', currentPriceType: 'solo', inGroup: true, groupComplete: true, creditBalanceKobo: 0, currency: 'USD', now });
  assert.equal(usd.currency, 'USD');
  assert.equal(usd.priceType, 'solo');
  assert.equal(usd.grossKobo, 500);
  const ngn = P.previewNextCharge({ tier: 'explorer', cycle: 'monthly', currentPriceType: 'solo', inGroup: true, groupComplete: true, creditBalanceKobo: 0, now });
  assert.equal(ngn.priceType, 'group');
  assert.equal(ngn.grossKobo, 200_000);
  // A locked yearly group price cannot exist in USD either.
  const locked = P.previewNextCharge({ tier: 'builder', cycle: 'yearly', currentPriceType: 'group', lockedGroupPriceUntil: new Date('2027-01-01'), inGroup: true, groupComplete: false, creditBalanceKobo: 300, currency: 'USD', now });
  assert.equal(locked.priceType, 'solo');
  assert.equal(locked.grossKobo, 10_000);
  assert.equal(locked.payKobo, 9_700);
});

test('checkout summary in USD has no group line', () => {
  const s = P.checkoutSummary({ tier: 'builder', cycle: 'monthly', withGroup: true, start: new Date('2026-11-11T10:00:00Z'), currency: 'USD' }, (d) => d.toISOString().slice(0, 10));
  assert.match(s.chargeLine, /\$10 a month/);
  assert.doesNotMatch(s.chargeLine, /group/);
  assert.equal(s.groupLine, null);
  const n = P.checkoutSummary({ tier: 'builder', cycle: 'monthly', withGroup: true, start: new Date('2026-11-11T10:00:00Z') }, (d) => d.toISOString().slice(0, 10));
  assert.match(n.chargeLine, /₦7,000 a month/);
  assert.ok(n.groupLine && /₦5,000/.test(n.groupLine));
});

test('admin MRR never adds naira and dollars together', () => {
  const subs = [
    { planCode: 'seeker_solo_monthly', state: 'active', currency: 'NGN' },
    { planCode: 'builder_solo_monthly', state: 'active', currency: 'USD' },
    { planCode: 'builder_solo_annual', state: 'grace', currency: 'USD' },
    { planCode: 'seeker_solo_monthly', state: 'trial', currency: 'USD' },
  ];
  const t = mrrByCurrency(subs);
  assert.equal(t.NGN, 300_000);
  assert.equal(t.USD, 1000 + Math.round(10_000 / 12));
  assert.equal(mrrKobo(subs), 300_000);
  assert.equal(moneyTotals({ NGN: 300_000, USD: 0 }), '₦3,000');
  assert.equal(moneyTotals({ NGN: 300_000, USD: 1500 }), '₦3,000 · $15');
});

test('emails show the subscription currency', () => {
  const usd = buildEmail('payment_succeeded', { amountKobo: 1000, currency: 'USD', planName: 'Builder, monthly', brand: 'visa', last4: '4242' });
  assert.match(usd.subject, /\$10/);
  assert.doesNotMatch(usd.text, /₦/);
  const ngn = buildEmail('payment_succeeded', { amountKobo: 700_000, planName: 'Builder, monthly' });
  assert.match(ngn.subject, /₦7,000/);
});

test('donations: naira limits in Nigeria, dollar limits elsewhere', () => {
  assert.equal(DONATION_LIMITS.NGN.min, 500);
  assert.equal(DONATION_LIMITS.USD.min, 5);
  const usd = donateFormSchemaFor('USD');
  const base = { full_name: 'Ada Obi', email: 'ada@example.com', phone: '+447700900123', message: '' };
  assert.equal(usd.safeParse({ ...base, amount: 5 }).success, true);
  assert.equal(usd.safeParse({ ...base, amount: 4 }).success, false);
  assert.equal(donateFormSchemaFor('NGN').safeParse({ ...base, amount: 400 }).success, false);
});

test('Pinnacle: ₦12,000 / ₦120,000, group ₦9,000 / ₦99,000; $15 / $150 with no group discount', () => {
  assert.equal(C.priceFor('pinnacle', 'solo', 'monthly'), 1_200_000);
  assert.equal(C.priceFor('pinnacle', 'solo', 'yearly'), 12_000_000);
  assert.equal(C.priceFor('pinnacle', 'group', 'monthly'), 900_000);
  assert.equal(C.priceFor('pinnacle', 'group', 'yearly'), 9_900_000);
  assert.equal(C.priceFor('pinnacle', 'solo', 'monthly', 'USD'), 1500);
  assert.equal(C.priceFor('pinnacle', 'group', 'yearly', 'USD'), 15000);
  assert.equal(C.planCodeFor('pinnacle', 'group', 'yearly'), 'pinnacle_group_annual');
  assert.equal(C.tierLabel('pinnacle'), 'Pinnacle');
  assert.deepEqual([...C.PAID_TIERS], ['explorer', 'builder', 'pinnacle']);
  assert.equal(C.PLANS.length, 12);
});
