// Plans: Ascentor sells exactly two plans, Seeker (stored as 'explorer') and Builder, through Billing v2.
// Prices come from lib/billing/catalog.ts; every retired plan value is free.
//   npm run test:plans
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role';

test('Seeker, Builder and Pinnacle are sold, at the catalog solo prices', async () => {
  const { getPlanPricing, planPriceLabel } = await import('../../lib/plans-config');
  const plans = getPlanPricing();
  assert.deepEqual(plans.map((p) => [p.id, p.name, p.monthlyPrice, p.yearlyPrice]), [
    ['explorer', 'Seeker', 3000, 30000],
    ['builder', 'Builder', 7000, 70000],
    ['pinnacle', 'Pinnacle', 12000, 120000],
  ]);
  assert.equal(planPriceLabel('builder', 'monthly'), '₦7,000 a month');
  assert.equal(planPriceLabel('explorer', 'annual'), '₦30,000 a year');
  assert.equal(planPriceLabel('climber', 'monthly'), '');
  assert.equal(planPriceLabel(null, null), '');
});

test('display names: Seeker, Builder, Pinnacle; retired plans show as Free', async () => {
  const { planDisplayName, FEATURED_PLANS } = await import('../../lib/plans-display');
  assert.deepEqual([...FEATURED_PLANS], ['explorer', 'builder', 'pinnacle']);
  assert.equal(planDisplayName('explorer'), 'Seeker');
  assert.equal(planDisplayName('pinnacle'), 'Pinnacle');
  assert.equal(planDisplayName('builder'), 'Builder');
  for (const old of ['climber', 'premium', 'basic', 'standard', 'pro', 'elite', 'nope', null]) {
    assert.equal(planDisplayName(old), 'Free', String(old));
  }
});

test('gating: Builder covers Seeker; retired plans get nothing; Leaders gate as Builder', async () => {
  const { canAccess, normalisePlan } = await import('../../lib/planTier');
  assert.equal(canAccess('builder', 'explorer'), true);
  assert.equal(canAccess('explorer', 'builder'), false);
  assert.equal(canAccess('climber', 'explorer'), false);
  assert.equal(canAccess('free', 'free'), true);
  assert.equal(canAccess('leader', 'builder'), true);
  assert.equal(normalisePlan('climber'), 'free');
  assert.equal(normalisePlan('seeker'), 'explorer');
});

test('effectivePlan respects the end date', async () => {
  const { effectivePlan } = await import('../../lib/planTier');
  const now = new Date('2026-11-11T12:00:00Z');
  const day = 864e5;
  const iso = (ms: number) => new Date(now.getTime() + ms).toISOString();
  assert.equal(effectivePlan({ subscription_plan: 'builder', subscription_status: 'active', subscription_end: iso(10 * day) }, now), 'builder');
  // A renewal a day late keeps access; long-expired "active" rows from the old system do not.
  assert.equal(effectivePlan({ subscription_plan: 'builder', subscription_status: 'active', subscription_end: iso(-1 * day) }, now), 'builder');
  assert.equal(effectivePlan({ subscription_plan: 'explorer', subscription_status: 'active', subscription_end: '2026-04-18T00:00:00Z' }, now), 'free');
  assert.equal(effectivePlan({ subscription_plan: 'climber', subscription_status: 'active', subscription_end: iso(10 * day) }, now), 'free');
  assert.equal(effectivePlan({ subscription_plan: 'explorer', subscription_status: 'cancelled', subscription_end: iso(day) }, now), 'explorer');
  assert.equal(effectivePlan({ subscription_plan: 'explorer', subscription_status: 'cancelled', subscription_end: iso(-day) }, now), 'free');
  assert.equal(effectivePlan({ subscription_plan: 'builder', subscription_status: 'free', subscription_end: null }, now), 'free');
});
