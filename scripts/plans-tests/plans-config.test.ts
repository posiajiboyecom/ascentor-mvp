// Plan prices: env parsing, annual maths, and that settlement compares against the same module checkout charges from.
//   npm run test:plans
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role';

test('defaults are 15000, 25000 and 40000 (Leader) when the variables are unset or blank', async () => {
  const { readPlanPrices } = await import('../../lib/plans-config');
  assert.deepEqual(readPlanPrices({}), { seeker: 15000, builder: 25000, leader: 40000 });
  assert.deepEqual(readPlanPrices({ PLAN_SEEKER_PRICE_NGN: '  ', PLAN_BUILDER_PRICE_NGN: '', PLAN_LEADER_PRICE_NGN: ' ' }), { seeker: 15000, builder: 25000, leader: 40000 });
});

test('valid overrides are used', async () => {
  const { readPlanPrices } = await import('../../lib/plans-config');
  assert.deepEqual(readPlanPrices({ PLAN_SEEKER_PRICE_NGN: '18000', PLAN_BUILDER_PRICE_NGN: ' 30000 ', PLAN_LEADER_PRICE_NGN: '45000' }), { seeker: 18000, builder: 30000, leader: 45000 });
});

test('bad values fail loudly, never silently fall back', async () => {
  const { readPlanPrices } = await import('../../lib/plans-config');
  for (const bad of ['abc', '-5', '0', '1.5', '15,000', '₦15000', '1e4', '0x10', '999999999999']) {
    assert.throws(() => readPlanPrices({ PLAN_SEEKER_PRICE_NGN: bad }), /PLAN_SEEKER_PRICE_NGN/, `seeker "${bad}"`);
    assert.throws(() => readPlanPrices({ PLAN_BUILDER_PRICE_NGN: bad }), /PLAN_BUILDER_PRICE_NGN/, `builder "${bad}"`);
    assert.throws(() => readPlanPrices({ PLAN_LEADER_PRICE_NGN: bad }), /PLAN_LEADER_PRICE_NGN/, `leader "${bad}"`);
  }
});

test('annual is 12 months less 20%', async () => {
  const { buildPlanPricing } = await import('../../lib/pricing');
  const seeker = buildPlanPricing('explorer', 'Seeker', 15000);
  assert.equal(seeker.yearlyPrice, 144000);
  assert.equal(seeker.yearlyPerMonth, 12000);
  assert.equal(seeker.yearlySavings, 36000);
  const builder = buildPlanPricing('builder', 'Builder', 25000);
  assert.equal(builder.yearlyPrice, 240000);
  const leader = buildPlanPricing('leader', 'Leader', 40000);
  assert.equal(leader.yearlyPrice, 384000);
  assert.equal(leader.yearlySavings, 96000);
});

test('settlement and checkout use the same amounts (kobo)', async () => {
  const { subscriptionAmountKobo } = await import('../../lib/paymentSettlement');
  assert.equal(subscriptionAmountKobo('explorer', 'monthly'), 15000 * 100);
  assert.equal(subscriptionAmountKobo('explorer', 'annual'), 144000 * 100);
  assert.equal(subscriptionAmountKobo('builder', 'monthly'), 25000 * 100);
  assert.equal(subscriptionAmountKobo('builder', 'annual'), 240000 * 100);
  assert.equal(subscriptionAmountKobo('leader', 'monthly'), 40000 * 100);
  assert.equal(subscriptionAmountKobo('leader', 'annual'), 384000 * 100);
  assert.equal(subscriptionAmountKobo('climber', 'monthly'), 60000 * 100); // legacy, fixed
  assert.equal(subscriptionAmountKobo('nope', 'monthly'), null);
  assert.equal(subscriptionAmountKobo('builder', 'weekly'), null);
});

test('price label prefers what the member actually paid', async () => {
  const { planPriceLabel } = await import('../../lib/plans-config');
  assert.equal(planPriceLabel('builder', 'monthly'), '₦25,000 a month');
  assert.equal(planPriceLabel('leader', 'monthly'), '₦40,000 a month');
  assert.equal(planPriceLabel('explorer', 'annual'), '₦144,000 a year');
  assert.equal(planPriceLabel('explorer', 'monthly', 12000), '₦12,000 a month'); // legacy price kept
  assert.equal(planPriceLabel(null, null), '');
});

test('Leader keeps its name and gets top-tier access', async () => {
  const { planDisplayName, planKey, FEATURED_PLANS } = await import('../../lib/plans-display');
  const { canAccess, effectivePlan } = await import('../../lib/planTier');
  assert.equal(planDisplayName('leader'), 'Leader');
  assert.equal(planKey('leader'), 'leader');
  assert.ok(FEATURED_PLANS.includes('leader'));
  assert.equal(canAccess('leader', 'climber'), true);
  assert.equal(canAccess('leader', 'builder'), true);
  assert.equal(canAccess('builder', 'climber'), false);
  assert.equal(effectivePlan({ subscription_plan: 'leader', subscription_status: 'active', subscription_end: new Date(Date.now() + 864e5).toISOString() }), 'climber');
  assert.equal(planDisplayName('explorer'), 'Seeker');
  assert.equal(planDisplayName('climber'), 'Climber');
});

test('Leader is accepted by the checkout request schema', async () => {
  const { payStart } = await import('../../lib/validation/schemas/commerce');
  assert.equal(payStart.safeParse({ planId: 'leader', billing: 'monthly' }).success, true);
  assert.equal(payStart.safeParse({ planId: 'ceo', billing: 'monthly' }).success, false);
});
