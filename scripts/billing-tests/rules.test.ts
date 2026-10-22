import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../lib/billing/rules';
import * as C from '../../lib/billing/catalog';

const d = (s: string) => new Date(s);
const T0 = d('2026-11-01T10:00:00Z');

test('catalog: eight plans, prices from the handoff', () => {
  assert.equal(C.PLANS.length, 8);
  assert.equal(C.priceFor('explorer', 'solo', 'monthly'), 300_000);
  assert.equal(C.priceFor('explorer', 'solo', 'yearly'), 3_000_000);
  assert.equal(C.priceFor('explorer', 'group', 'monthly'), 200_000);
  assert.equal(C.priceFor('explorer', 'group', 'yearly'), 2_200_000);
  assert.equal(C.priceFor('builder', 'solo', 'monthly'), 700_000);
  assert.equal(C.priceFor('builder', 'solo', 'yearly'), 7_000_000);
  assert.equal(C.priceFor('builder', 'group', 'monthly'), 500_000);
  assert.equal(C.priceFor('builder', 'group', 'yearly'), 5_500_000);
  assert.equal(C.planCodeFor('builder', 'group', 'yearly'), 'builder_group_annual');
  assert.equal(C.getPlan('seeker_solo_monthly')?.tier, 'explorer');
  assert.equal(C.getPlan('nope'), null);
  assert.equal(C.perMonthKobo(C.getPlan('builder_solo_annual')!), 583_333);
  assert.equal(C.formatNaira(300_000), '₦3,000');
  assert.equal(C.tierLabel('explorer'), 'Seeker');
  for (const p of C.PLANS) assert.equal(C.planCodeFor(p.tier, p.priceType, p.cycle), p.code);
});

test('trial ends day 7, first charge day 8 boundary', () => {
  assert.equal(R.trialEndsAt(T0).toISOString(), '2026-11-08T10:00:00.000Z');
  assert.equal(R.firstChargeAt(T0).toISOString(), '2026-11-08T10:00:00.000Z');
});

test('addMonths clamps to month end and yearly adds 12', () => {
  assert.equal(R.addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString(), '2026-02-28T00:00:00.000Z');
  assert.equal(R.nextPeriodEnd(d('2026-03-15T08:00:00Z'), 'monthly').toISOString(), '2026-04-15T08:00:00.000Z');
  assert.equal(R.nextPeriodEnd(d('2026-03-15T08:00:00Z'), 'yearly').toISOString(), '2027-03-15T08:00:00.000Z');
  assert.equal(R.addMonths(d('2026-12-31T00:00:00Z'), 2).toISOString(), '2027-02-28T00:00:00.000Z');
});

test('states and access', () => {
  for (const s of ['trial', 'active', 'grace'] as const) assert.equal(R.isActiveState(s), true);
  for (const s of ['lapsed', 'cancelled'] as const) assert.equal(R.isActiveState(s), false);
  assert.equal(R.accessLevel({ state: 'grace' }, T0), 'full');
  assert.equal(R.accessLevel({ state: 'lapsed' }, T0), 'light');
  assert.equal(R.accessLevel({ state: 'cancelled', periodEnd: d('2026-11-20T00:00:00Z') }, T0), 'full');
  assert.equal(R.accessLevel({ state: 'cancelled', periodEnd: d('2026-10-20T00:00:00Z') }, T0), 'light');
  assert.equal(R.accessLevel({ state: 'cancelled', periodEnd: null }, T0), 'light');
  assert.equal(R.stateAfterChargeSuccess(), 'active');
});

test('group completeness: >=3 active, free leaders excluded, mixed tiers and yearly count', () => {
  assert.equal(R.countActiveMembers([{ state: 'trial' }, { state: 'active' }, { state: 'grace' }]), 3);
  assert.equal(R.countActiveMembers([{ state: 'trial' }, { state: 'active' }, { state: 'lapsed' }, { state: 'cancelled' }]), 2);
  assert.equal(R.countActiveMembers([{ state: 'active', leaderFree: true }, { state: 'active' }, { state: 'trial' }]), 2);
  assert.equal(R.isGroupComplete(2), false);
  assert.equal(R.isGroupComplete(3), true);
});

test('first charge: complete group pays group price', () => {
  assert.deepEqual(R.decideFirstChargePrice({ inGroup: true, activeCount: 3, extensionUsed: false, trialStart: T0 }), { action: 'charge', priceType: 'group' });
});

test('first charge: group of 2 gets one extension to day 14, then solo', () => {
  const first = R.decideFirstChargePrice({ inGroup: true, activeCount: 2, extensionUsed: false, trialStart: T0 });
  assert.equal(first.action, 'extend');
  if (first.action === 'extend') assert.equal(first.nextChargeAt.toISOString(), '2026-11-14T10:00:00.000Z'); // day 14 (day 8 is +7 days, so day 14 is +13)
  assert.deepEqual(R.decideFirstChargePrice({ inGroup: true, activeCount: 2, extensionUsed: true, trialStart: T0 }), { action: 'charge', priceType: 'solo' });
  // the group fills during the extension
  assert.deepEqual(R.decideFirstChargePrice({ inGroup: true, activeCount: 3, extensionUsed: true, trialStart: T0 }), { action: 'charge', priceType: 'group' });
  assert.deepEqual(R.decideFirstChargePrice({ inGroup: false, activeCount: 0, extensionUsed: false, trialStart: T0 }), { action: 'charge', priceType: 'solo' });
});

test('renewal price: protection holds 14 days, then solo', () => {
  const base = { inGroup: true, activeCount: 2, currentPriceType: 'group' as const, now: d('2026-12-01T00:00:00Z') };
  assert.equal(R.resolveRenewalPriceType({ ...base, belowSince: d('2026-11-25T00:00:00Z') }), 'group'); // 6 days
  assert.equal(R.resolveRenewalPriceType({ ...base, belowSince: d('2026-11-17T00:00:00Z') }), 'solo'); // exactly 14 days
  assert.equal(R.resolveRenewalPriceType({ ...base, belowSince: null }), 'group');
  assert.equal(R.resolveRenewalPriceType({ ...base, activeCount: 3, belowSince: d('2026-01-01T00:00:00Z') }), 'group');
});

test('renewal price: yearly lock, solo joining a complete group, not in a group', () => {
  const now = d('2026-12-01T00:00:00Z');
  assert.equal(R.resolveRenewalPriceType({ inGroup: true, activeCount: 1, currentPriceType: 'group', lockedGroupPriceUntil: d('2027-06-01T00:00:00Z'), belowSince: d('2026-01-01T00:00:00Z'), now }), 'group');
  assert.equal(R.resolveRenewalPriceType({ inGroup: true, activeCount: 1, currentPriceType: 'group', lockedGroupPriceUntil: d('2026-06-01T00:00:00Z'), belowSince: d('2026-01-01T00:00:00Z'), now }), 'solo');
  assert.equal(R.resolveRenewalPriceType({ inGroup: true, activeCount: 4, currentPriceType: 'solo', now }), 'group');
  assert.equal(R.resolveRenewalPriceType({ inGroup: true, activeCount: 2, currentPriceType: 'solo', now }), 'solo');
  assert.equal(R.resolveRenewalPriceType({ inGroup: false, activeCount: 0, currentPriceType: 'group', now }), 'solo');
});

test('group warning: 7 days before the renewal that will be solo', () => {
  const nextChargeAt = d('2026-12-10T00:00:00Z');
  const base = { currentPriceType: 'group' as const, activeCount: 2, belowSince: d('2026-11-20T00:00:00Z'), nextChargeAt };
  assert.equal(R.groupWarningDue({ ...base, now: d('2026-12-02T00:00:00Z') }), false); // 8 days out
  assert.equal(R.groupWarningDue({ ...base, now: d('2026-12-03T00:00:00Z') }), true); // 7 days out
  assert.equal(R.groupWarningDue({ ...base, now: d('2026-12-10T00:00:01Z') }), false); // past renewal
  assert.equal(R.groupWarningDue({ ...base, activeCount: 3, now: d('2026-12-05T00:00:00Z') }), false);
  assert.equal(R.groupWarningDue({ ...base, belowSince: d('2026-12-05T00:00:00Z'), now: d('2026-12-06T00:00:00Z') }), false); // protection still running at renewal
  assert.equal(R.groupWarningDue({ ...base, lockedGroupPriceUntil: d('2027-01-01T00:00:00Z'), now: d('2026-12-05T00:00:00Z') }), false);
  assert.equal(R.groupWarningDue({ ...base, currentPriceType: 'solo', now: d('2026-12-05T00:00:00Z') }), false);
});

test('retry schedule +1, +3, +5 days then grace end at +7', () => {
  const f = d('2026-11-08T10:00:00Z');
  assert.equal(R.nextRetryAfterFailure(f, 1).at.toISOString(), '2026-11-09T10:00:00.000Z');
  assert.equal(R.nextRetryAfterFailure(f, 2).at.toISOString(), '2026-11-11T10:00:00.000Z');
  assert.equal(R.nextRetryAfterFailure(f, 3).at.toISOString(), '2026-11-13T10:00:00.000Z');
  const last = R.nextRetryAfterFailure(f, 4);
  assert.equal(last.final, true);
  assert.equal(last.at.toISOString(), '2026-11-15T10:00:00.000Z');
  assert.equal(R.nextRetryAfterFailure(f, 1).final, false);
  assert.equal(R.graceEndsAt(f).toISOString(), '2026-11-15T10:00:00.000Z');
});

test('grace expiry', () => {
  const g = d('2026-11-15T10:00:00Z');
  assert.equal(R.graceExpired(g, d('2026-11-15T09:59:59Z')), false);
  assert.equal(R.graceExpired(g, d('2026-11-15T10:00:00Z')), true);
  assert.equal(R.graceExpired(null, T0), false);
});

test('credit per referral is 20% of the inviter monthly price', () => {
  assert.equal(R.creditPerReferralKobo(200_000), 40_000); // Seeker group 400
  assert.equal(R.creditPerReferralKobo(300_000), 60_000); // Seeker solo 600
  assert.equal(R.creditPerReferralKobo(500_000), 100_000); // Builder group 1000
  assert.equal(R.creditPerReferralKobo(700_000), 140_000); // Builder solo 1400
  assert.equal(R.creditPerReferralKobo(700_000) * 5, 700_000); // five referrals = one free month
});

const earn = (id: string, kobo: number, at: string): R.LedgerRow => ({ id, amountKobo: kobo, reason: 'referral_earned', createdAt: d(at) });
const use = (id: string, kobo: number, at: string): R.LedgerRow => ({ id, amountKobo: -kobo, reason: 'used', createdAt: d(at) });

test('credit applies up to 100%, remainder carries, oldest first', () => {
  const rows = [earn('a', 60_000, '2026-01-01T00:00:00Z'), earn('b', 60_000, '2026-02-01T00:00:00Z')];
  const lots = R.computeCreditLots(rows, d('2026-03-01T00:00:00Z'));
  const r = R.applyCredit(70_000, lots);
  assert.equal(r.appliedKobo, 70_000);
  assert.equal(r.chargeKobo, 0);
  assert.equal(r.skipCharge, true);
  assert.deepEqual(r.draws, [{ lotId: 'a', kobo: 60_000 }, { lotId: 'b', kobo: 10_000 }]);
  const after = [...rows, use('u1', 70_000, '2026-03-01T00:00:00Z')];
  assert.equal(R.availableCreditKobo(after, d('2026-03-02T00:00:00Z')), 50_000);
});

test('credit partially covers a charge', () => {
  const lots = R.computeCreditLots([earn('a', 60_000, '2026-01-01T00:00:00Z')], d('2026-02-01T00:00:00Z'));
  const r = R.applyCredit(300_000, lots);
  assert.equal(r.appliedKobo, 60_000);
  assert.equal(r.chargeKobo, 240_000);
  assert.equal(r.skipCharge, false);
});

test('credit more than the charge: remainder carries', () => {
  const lots = R.computeCreditLots([earn('a', 700_000, '2026-01-01T00:00:00Z')], d('2026-02-01T00:00:00Z'));
  const r = R.applyCredit(300_000, lots);
  assert.equal(r.chargeKobo, 0);
  assert.equal(r.skipCharge, true);
  assert.equal(r.draws[0].kobo, 300_000);
  assert.equal(R.availableCreditKobo([earn('a', 700_000, '2026-01-01T00:00:00Z'), use('u', 300_000, '2026-02-01T00:00:00Z')], d('2026-02-02T00:00:00Z')), 400_000);
});

test('no credit and zero charge edge cases', () => {
  assert.deepEqual(R.applyCredit(300_000, []), { appliedKobo: 0, chargeKobo: 300_000, draws: [], skipCharge: false });
  assert.equal(R.applyCredit(0, []).skipCharge, false);
});

test('credit expires 12 months after it is earned', () => {
  const rows = [earn('a', 60_000, '2026-01-01T00:00:00Z')];
  assert.equal(R.availableCreditKobo(rows, d('2026-12-31T23:59:59Z')), 60_000);
  assert.equal(R.availableCreditKobo(rows, d('2027-01-01T00:00:00Z')), 0);
  assert.deepEqual(R.expiredLots(rows, d('2027-01-02T00:00:00Z')).map((l) => [l.id, l.remainingKobo]), [['a', 60_000]]);
  assert.equal(R.expiredLots(rows, d('2026-06-01T00:00:00Z')).length, 0);
});

test('expired lots are skipped when drawing, newer lot is used', () => {
  const rows = [earn('old', 60_000, '2026-01-01T00:00:00Z'), earn('new', 60_000, '2026-11-01T00:00:00Z'), use('u', 60_000, '2027-02-01T00:00:00Z')];
  assert.equal(R.availableCreditKobo(rows, d('2027-02-02T00:00:00Z')), 0); // old expired, new consumed
  assert.equal(R.availableCreditKobo([rows[0], rows[1]], d('2027-02-02T00:00:00Z')), 60_000);
});

test('cancelled credit (refund) removes it', () => {
  const rows: R.LedgerRow[] = [earn('a', 60_000, '2026-01-01T00:00:00Z'), { id: 'c', amountKobo: -60_000, reason: 'cancelled', createdAt: d('2026-01-20T00:00:00Z') }];
  assert.equal(R.availableCreditKobo(rows, d('2026-02-01T00:00:00Z')), 0);
});

test('quorum table from the handoff', () => {
  const table: [number, number][] = [[10, 6], [9, 6], [8, 5], [7, 5], [6, 4], [5, 3], [4, 3], [3, 3], [2, 3], [0, 3]];
  for (const [active, need] of table) assert.equal(R.quorumNeeded(active), need, `active ${active}`);
  assert.equal(R.offersMerge(4), true);
  assert.equal(R.offersMerge(5), false);
});

test('paystack fee estimate', () => {
  assert.equal(R.estimatePaystackFeeKobo(200_000), 3_000); // 2,000 naira: 1.5% = 30, no flat
  assert.equal(R.estimatePaystackFeeKobo(250_000), 3_750 + 10_000); // 2,500 naira: 37.50 + 100
  assert.equal(R.estimatePaystackFeeKobo(300_000), 4_500 + 10_000);
  assert.equal(R.estimatePaystackFeeKobo(20_000_000), 200_000); // capped at 2,000
  assert.equal(R.estimatePaystackFeeKobo(300_000, true), 11_700 + 10_000);
  assert.equal(R.estimatePaystackFeeKobo(5_000, false), 75); // 50 naira charge
});

test('charge reference is idempotent per hour', () => {
  const u = '11111111-2222-3333-4444-555555555555';
  assert.equal(R.chargeReference(u, d('2026-11-08T09:59:59Z')), `sub_${u}_2026110809`);
  assert.equal(R.chargeReference(u, d('2026-11-08T09:00:00Z')), R.chargeReference(u, d('2026-11-08T09:30:00Z')));
  assert.notEqual(R.chargeReference(u, d('2026-11-08T09:00:00Z')), R.chargeReference(u, d('2026-11-08T10:00:00Z')));
});
