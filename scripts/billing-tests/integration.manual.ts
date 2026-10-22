// MANUAL integration run (not part of test:billing). Paystack TEST mode only (aborts otherwise); needs a headed Chromium for the
// hosted checkout (Cloudflare blocks headless). Creates temporary billtest-* users and deletes everything it created. Run:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/billing-tests/integration.manual.ts
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

process.env.NEXT_PUBLIC_URL = 'http://localhost:3000';
if (!(process.env.PAYSTACK_SECRET_KEY ?? '').startsWith('sk_test_')) { console.error('ABORT: not Paystack test mode'); process.exit(2); }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ts = Date.now();
const results: { n: string; ok: boolean; d: string }[] = [];
const rec = (n: string, ok: boolean, d = '') => { results.push({ n, ok, d }); console.log(ok ? 'PASS' : 'FAIL', n, d); };
const created: string[] = [];
const H = 3_600_000, D = 24 * H;

async function mkUser(label: string) {
  const email = `billtest-${label}-${ts}@example.com`;
  const { data, error } = await sb.auth.admin.createUser({ email, password: `Vz7!kRt-${ts}-Bill`, email_confirm: true, user_metadata: { full_name: 'BILLTEST ' + label } });
  if (error) throw error;
  created.push(data.user.id);
  for (let i = 0; i < 12; i++) { const { data: p } = await sb.from('profiles').select('id').eq('id', data.user.id); if (p && p.length) break; await new Promise((r) => setTimeout(r, 500)); }
  await sb.from('profiles').update({ onboarding_completed: true }).eq('id', data.user.id);
  return { id: data.user.id, email };
}

async function payHosted(url: string, option = 'Success') {
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText(option, { exact: true }).first().click({ timeout: 90000 });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /Pay NGN/i }).first().click({ timeout: 30000 });
    await page.waitForTimeout(12000);
  } finally { await browser.close(); }
}

const count = async (table: string, f: Record<string, string>) => {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(f)) q = q.eq(k, v);
  return (await q).count ?? 0;
};
const evCount = (uid: string, type: string) => count('billing_events', { user_id: uid, type });

async function cleanup() {
  for (const id of created) {
    for (const t of ['billing_events', 'credit_ledger', 'payments', 'notifications', 'member_subscriptions', 'payment_methods']) await sb.from(t).delete().eq('user_id', id);
    await sb.from('referrals').delete().or(`referrer_id.eq.${id},referred_id.eq.${id}`);
  }
  for (const id of created) await sb.auth.admin.deleteUser(id);
}

(async () => {
  try {
    const { count: others } = await sb.from('member_subscriptions').select('*', { count: 'exact', head: true });
    if ((others ?? 0) > 0) { console.error('ABORT: member_subscriptions has rows that are not ours'); process.exit(3); }

    const cardsMod = await import('../../lib/billing/cards');
    const subsMod = await import('../../lib/billing/subscriptions');
    const engine = await import('../../lib/billing/engine');
    const hook = await import('../../lib/billing/webhook');
    const crypt = await import('../../lib/crypto');
    const { effectivePlan } = await import('../../lib/planTier');
    const { verifyTransaction } = await import('../../lib/billing/paystack');

    const A = await mkUser('a');
    const prof = async (uid = A.id) => (await sb.from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', uid).single()).data as { subscription_plan: string; subscription_status: string; subscription_end: string | null };
    const sub = async (uid = A.id) => (await sb.from('member_subscriptions').select('*').eq('user_id', uid).single()).data as Record<string, any>;
    const setSub = (patch: Record<string, unknown>, uid = A.id) => sb.from('member_subscriptions').update(patch).eq('user_id', uid);
    const notes = async (uid = A.id) => ((await sb.from('notifications').select('title, link, type').eq('user_id', uid)).data ?? []) as { title: string; link: string; type: string }[];

    // 1. card verification via Paystack hosted checkout -------------------------------------------------------
    const start = await cardsMod.startCardVerification(A.id, A.email);
    rec('card verify: initialize', start.ok, start.ok ? new URL(start.authorizationUrl).host : (start as any).error);
    if (!start.ok) throw new Error('cannot continue');
    let hosted = true;
    try { await payHosted(start.authorizationUrl); } catch (e) { hosted = false; console.log('hosted checkout failed:', (e as Error).message.slice(0, 120)); }
    rec('card verify: hosted checkout paid with Paystack test option', hosted);
    const v0 = await verifyTransaction(start.reference);
    rec('card verify: transaction success at Paystack', v0.ok && v0.data.status === 'success', v0.ok ? `${v0.data.status} ${v0.data.amount}` : v0.error);
    if (!(v0.ok && v0.data.status === 'success')) throw new Error('payment did not complete');
    console.log('authorization reusable=', v0.data.authorization?.reusable, 'channel=', v0.data.authorization?.channel);

    const done = await cardsMod.completeCardVerification(A.id, start.reference);
    rec('card verify: card saved', done.ok && done.added, done.ok ? `${done.card.brand} ${done.card.last4} default=${done.card.isDefault} refund=${done.refund}` : (done as any).error);
    if (!done.ok) throw new Error('card not saved: ' + done.error);
    rec('card verify: first card is default', done.card.isDefault);
    rec('card verify: refund issued', done.refund === 'refunded');
    const { data: pmRow } = await sb.from('payment_methods').select('auth_enc, signature').eq('user_id', A.id).single();
    rec('card: authorization code stored encrypted', typeof pmRow?.auth_enc === 'string' && pmRow.auth_enc.startsWith('enc:v1:'));
    rec('card: decrypts to a Paystack code', crypt.decryptSecret(pmRow!.auth_enc).startsWith('AUTH_'));
    const list = await cardsMod.listCards(A.id);
    rec('card: list exposes safe fields only', list.length === 1 && !('auth_enc' in list[0]) && Object.keys(list[0]).sort().join() === 'bank,brand,expMonth,expYear,id,isDefault,last4');
    const again = await cardsMod.completeCardVerification(A.id, start.reference);
    rec('card verify: second call idempotent (no duplicate card, no second refund)', again.ok && !again.added && again.refund === 'already_refunded' && (await cardsMod.listCards(A.id)).length === 1);
    rec('events: card_added logged once', (await evCount(A.id, 'card_added')) === 1);
    rec('events: card_verify_refunded logged once', (await evCount(A.id, 'card_verify_refunded')) === 1);
    let n = await notes();
    rec('notification: card_added in-app with billing link', n.some((x) => x.title === 'Card added' && x.link === '/settings/billing'));

    // webhook: card_verify charge.success for an already saved card is a no-op that returns 200
    const wh1 = await hook.handleBillingV2Event({ event: 'charge.success', data: { reference: start.reference, metadata: { purpose: 'card_verify', user_id: A.id } } });
    rec('webhook: card_verify replay handled, 200, no duplicate card', wh1?.status === 200 && (await cardsMod.listCards(A.id)).length === 1);
    const wh2 = await hook.handleBillingV2Event({ event: 'charge.success', data: { reference: 'x', metadata: { purpose: 'something_else' } } });
    rec('webhook: other purposes fall through (null)', wh2 === null);

    rec('card verify: second call detail', again.ok, JSON.stringify(again.ok ? { added: again.added, refund: again.refund } : again));

    // declined hosted card: nothing saved, nothing refunded
    const start2 = await cardsMod.startCardVerification(A.id, A.email);
    if (start2.ok) {
      try { await payHosted(start2.authorizationUrl, 'Declined'); } catch (e) { console.log('declined flow note:', (e as Error).message.slice(0, 100)); }
      const dec = await cardsMod.completeCardVerification(A.id, start2.reference);
      rec('card verify: declined card is not saved', !dec.ok && (await cardsMod.listCards(A.id)).length === 1 && (await evCount(A.id, 'card_added')) === 1, dec.ok ? 'ok?!' : dec.error);
    }

    // wrong user cannot claim someone else's verification
    const B = await mkUser('b');
    const steal = await cardsMod.completeCardVerification(B.id, start.reference);
    rec('card verify: another member cannot claim the reference', !steal.ok);

    // 2. trial ------------------------------------------------------------------------------------------------
    const noCard = await subsMod.startTrial(B.id, { tier: 'explorer', cycle: 'monthly' });
    rec('trial: refused without a default card', !noCard.ok);
    const t = await subsMod.startTrial(A.id, { tier: 'explorer', cycle: 'monthly' });
    rec('trial: started', t.ok);
    let s = await sub();
    rec('trial: state trial, trial 7 days, first charge at trial end', s.state === 'trial' && Math.abs(new Date(s.trial_ends_at).getTime() - Date.now() - 7 * D) < 60_000 && s.next_charge_at === s.trial_ends_at);
    let p = await prof();
    rec('profile mirror (trial): trialing + explorer + effectivePlan explorer', p.subscription_status === 'trialing' && effectivePlan(p) === 'explorer');
    rec('events: trial_started', (await evCount(A.id, 'trial_started')) === 1);
    n = await notes();
    rec('notification: trial_started', n.some((x) => x.title === 'Your trial has started'));
    const lastCard = await cardsMod.removeCard(A.id, list[0].id);
    rec('card: last card cannot be removed during trial', !lastCard.ok);

    // 3. dry mode ---------------------------------------------------------------------------------------------
    process.env.BILLING_V2_CHARGING = 'off';
    await setSub({ next_charge_at: new Date(Date.now() - H).toISOString() });
    let sum = await engine.runBillingCycle();
    rec('engine off: returns immediately, nothing written', sum.mode === 'off' && sum.due === 0 && (await evCount(A.id, 'would_charge')) === 0);
    process.env.BILLING_V2_CHARGING = 'dry';
    sum = await engine.runBillingCycle();
    rec('engine dry: one would_charge, no payment, state unchanged', sum.wouldCharge === 1 && (await evCount(A.id, 'would_charge')) === 1 && (await count('payments', { user_id: A.id })) === 0 && (await sub()).state === 'trial');
    await engine.runBillingCycle();
    rec('engine dry: repeat run does not duplicate the event', (await evCount(A.id, 'would_charge')) === 1);
    const { data: wc } = await sb.from('billing_events').select('data').eq('user_id', A.id).eq('type', 'would_charge').single();
    rec('engine dry: event carries amount and plan', (wc as any).data.amount_kobo === 300000 && (wc as any).data.plan_code === 'seeker_solo_monthly', JSON.stringify((wc as any).data));

    // 4. live: first charge -----------------------------------------------------------------------------------
    process.env.BILLING_V2_CHARGING = 'live';
    const T1 = new Date(Date.now() + 1 * H);
    sum = await engine.runBillingCycle(T1);
    s = await sub();
    rec('engine live: first charge succeeded', sum.charged === 1 && s.state === 'active' && s.failed_count === 0, JSON.stringify({ charged: sum.charged, errors: sum.errors, state: s.state }));
    const { data: pay1 } = await sb.from('payments').select('*').eq('user_id', A.id);
    rec('payments row compatible with admin screen', pay1?.length === 1 && pay1[0].amount_cents === 300000 && pay1[0].status === 'success' && pay1[0].provider === 'paystack' && pay1[0].plan_id === 'explorer' && pay1[0].billing === 'monthly', JSON.stringify({ amount_cents: pay1?.[0]?.amount_cents, status: pay1?.[0]?.status }));
    rec('first_charge event + sub dates', (await evCount(A.id, 'first_charge')) === 1 && !!s.last_charge_ref && new Date(s.period_end).getTime() > T1.getTime() + 27 * D && s.next_charge_at === s.period_end, s.last_charge_ref);
    p = await prof();
    rec('profile mirror (active)', p.subscription_status === 'active' && effectivePlan(p) === 'explorer');
    n = await notes();
    rec('notification: payment_succeeded', n.some((x) => x.title === 'Payment received'));
    sum = await engine.runBillingCycle(T1);
    rec('engine live: second run same moment does nothing', sum.due === 0 && (await count('payments', { user_id: A.id })) === 1);
    // same-hour replay of the same reference never double charges
    await setSub({ next_charge_at: new Date(Date.now() - H).toISOString(), state: 'active' });
    sum = await engine.runBillingCycle(T1);
    rec('engine live: replay in the same hour (duplicate reference) is not charged twice', (await count('payments', { user_id: A.id })) === 1);
    await setSub({ next_charge_at: (await sub()).period_end });

    // 5. credit -----------------------------------------------------------------------------------------------
    await sb.from('credit_ledger').insert({ user_id: A.id, amount_kobo: 60000, reason: 'referral_earned', expires_at: new Date(Date.now() + 365 * D).toISOString() });
    rec('credit balance read', (await subsMod.creditBalanceKobo(A.id)) === 60000);
    await setSub({ next_charge_at: new Date(Date.now() - H).toISOString() });
    const T2 = new Date(Date.now() + 3 * H);
    sum = await engine.runBillingCycle(T2);
    const { data: pay2 } = await sb.from('payments').select('amount_cents').eq('user_id', A.id).order('created_at', { ascending: false });
    rec('credit: applied to the charge (3000 - 600 = 2400 charged)', sum.charged === 1 && pay2?.length === 2 && pay2[0].amount_cents === 240000, JSON.stringify(pay2));
    rec('credit: ledger used row + balance 0 + event', (await subsMod.creditBalanceKobo(A.id)) === 0 && (await evCount(A.id, 'credit_used')) === 1);
    await sb.from('credit_ledger').insert({ user_id: A.id, amount_kobo: 400000, reason: 'referral_earned', expires_at: new Date(Date.now() + 365 * D).toISOString() });
    await setSub({ next_charge_at: new Date(Date.now() - H).toISOString() });
    const T3 = new Date(Date.now() + 5 * H);
    sum = await engine.runBillingCycle(T3);
    rec('credit: covers the whole charge, no card charge, stays active, remainder carries', sum.skippedForCredit === 1 && (await count('payments', { user_id: A.id })) === 2 && (await sub()).state === 'active' && (await subsMod.creditBalanceKobo(A.id)) === 100000, `balance ${await subsMod.creditBalanceKobo(A.id)}`);
    n = await notes();
    rec('notification: credit covered cycle', n.some((x) => x.title === 'Nothing to pay this time'));

    // 6. failure path -----------------------------------------------------------------------------------------
    const goodAuth = (await sb.from('payment_methods').select('auth_enc').eq('user_id', A.id).single()).data!.auth_enc;
    await sb.from('payment_methods').update({ auth_enc: crypt.encryptSecret('AUTH_invalidcode0') }).eq('user_id', A.id);
    await sb.from('credit_ledger').delete().eq('user_id', A.id);
    const base = new Date(Date.now() + 10 * H);
    await setSub({ next_charge_at: new Date(Date.now() - H).toISOString() });
    sum = await engine.runBillingCycle(base);
    s = await sub();
    rec('failure 1: grace started, failed_count 1, access stays full', sum.failed === 1 && s.state === 'grace' && s.failed_count === 1 && !!s.grace_ends_at, `${s.state} ${s.failed_count}`);
    const graceEnd = new Date(s.grace_ends_at).getTime();
    rec('failure 1: grace is 7 days, retry in 1 day', Math.abs(graceEnd - (base.getTime() + 7 * D)) < 5000 && Math.abs(new Date(s.next_charge_at).getTime() - (base.getTime() + 1 * D)) < 5000);
    p = await prof();
    rec('profile mirror (grace): still active, effectivePlan explorer (full access)', p.subscription_status === 'active' && effectivePlan(p) === 'explorer');
    rec('events: renewal_failed + grace_started + charge_retry', (await evCount(A.id, 'renewal_failed')) === 1 && (await evCount(A.id, 'grace_started')) === 1 && (await evCount(A.id, 'charge_retry')) === 1);
    n = await notes();
    rec('notification: payment_failed once', n.filter((x) => x.title === 'Your payment did not go through').length === 1);
    const fRef = (await sb.from('billing_events').select('data').eq('user_id', A.id).eq('type', 'renewal_failed').single()).data!.data.reference as string;
    const dup = await engine.recordChargeFailure(A.id, fRef, 'again');
    rec('failure path idempotent per reference', !dup.counted && (await sub()).failed_count === 1);

    sum = await engine.runBillingCycle(new Date(base.getTime() + 1 * D + 1000));
    s = await sub();
    rec('failure 2 at +1 day: next retry at +3 days', s.failed_count === 2 && Math.abs(new Date(s.next_charge_at).getTime() - (base.getTime() + 3 * D)) < 5000);
    await engine.runBillingCycle(new Date(base.getTime() + 3 * D + 1000));
    s = await sub();
    rec('failure 3 at +3 days: next retry at +5 days', s.failed_count === 3 && Math.abs(new Date(s.next_charge_at).getTime() - (base.getTime() + 5 * D)) < 5000);
    await engine.runBillingCycle(new Date(base.getTime() + 5 * D + 1000));
    s = await sub();
    rec('failure 4 at +5 days: retries used up, next step is grace end', s.failed_count === 4 && s.state === 'grace' && Math.abs(new Date(s.next_charge_at).getTime() - graceEnd) < 5000);
    sum = await engine.runBillingCycle(new Date(graceEnd + 1000));
    s = await sub();
    rec('after grace: lapsed, no more charges', sum.lapsed === 1 && s.state === 'lapsed' && s.next_charge_at === null);
    p = await prof();
    rec('profile mirror (lapsed): free status keeps the plan name, effectivePlan free (light access)', p.subscription_status === 'free' && p.subscription_plan === 'explorer' && effectivePlan(p) === 'free');
    rec('events: lapsed + seat_release_pending logged', (await evCount(A.id, 'lapsed')) === 1 && (await evCount(A.id, 'seat_release_pending')) === 1);
    n = await notes();
    rec('notification: lapsed', n.some((x) => x.title === 'Your subscription has paused'));

    // 7. reactivation with a good card -----------------------------------------------------------------------------
    await sb.from('payment_methods').update({ auth_enc: goodAuth }).eq('user_id', A.id);
    process.env.BILLING_V2_CHARGING = 'dry';
    const dryReact = await subsMod.reactivate(A.id);
    rec('reactivate refused unless charging is live', !dryReact.ok);
    process.env.BILLING_V2_CHARGING = 'live';
    const react = await subsMod.reactivate(A.id);
    s = await sub();
    rec('reactivate: charged, back to active', react.ok && s.state === 'active' && s.failed_count === 0 && s.grace_ends_at === null, react.ok ? '' : (react as any).error);
    rec('events: reactivated', (await evCount(A.id, 'reactivated')) === 1);
    p = await prof();
    rec('profile mirror (reactivated): active + explorer', p.subscription_status === 'active' && effectivePlan(p) === 'explorer');

    // 8. cancel / resume -----------------------------------------------------------------------------------------
    const c1 = await subsMod.cancel(A.id);
    s = await sub();
    rec('cancel (paid): cancel_at_period_end, still active', c1.ok && s.cancel_at_period_end === true && s.state === 'active');
    p = await prof();
    rec('profile mirror (cancel pending): cancelled with future end keeps access', p.subscription_status === 'cancelled' && effectivePlan(p) === 'explorer');
    const r1 = await subsMod.resume(A.id);
    rec('resume: pending cancel undone', r1.ok && (await sub()).cancel_at_period_end === false);
    const ch = await subsMod.changePlan(A.id, { tier: 'builder', cycle: 'yearly' });
    rec('changePlan (paid): scheduled for next billing date, current plan unchanged', ch.ok && (ch as any).effective === 'next_billing_date' && (await sub()).tier === 'explorer');
    const sched = await subsMod.scheduledChange(A.id, subsMod.toSubscription(await sub()));
    rec('scheduled change readable by the engine', sched?.tier === 'builder' && sched?.cycle === 'yearly');
    const plan = await subsMod.resolveChargePlan(subsMod.toSubscription(await sub()), new Date());
    rec('charge plan applies scheduled change (builder yearly solo = 70,000)', plan.action === 'charge' && plan.amountKobo === 7_000_000 && plan.planCode === 'builder_solo_annual');

    // trial cancel on a second member
    const cardB = await sb.from('payment_methods').insert({ user_id: B.id, auth_enc: crypt.encryptSecret('AUTH_x'), signature: 'SIG_' + ts, brand: 'visa', last4: '0000', exp_month: '12', exp_year: '2030', is_default: true });
    const tb = await subsMod.startTrial(B.id, { tier: 'builder', cycle: 'monthly' });
    const cb = await subsMod.cancel(B.id);
    s = await sub(B.id);
    rec('cancel during trial: cancelled at once, never charged', !cardB.error && tb.ok && cb.ok && s.state === 'cancelled' && s.next_charge_at === null && (await count('payments', { user_id: B.id })) === 0);
    p = await prof(B.id);
    rec('profile mirror (trial cancelled): no access', effectivePlan(p) === 'free');

    // 9. referral credit earn + cancel on refund --------------------------------------------------------------------
    // Restore A to a clean paid explorer solo plan, B is the referred member with a first charge 15 days ago.
    await setSub({ tier: 'explorer', cycle: 'monthly', plan_code: 'seeker_solo_monthly', price_type: 'solo', next_charge_at: new Date(Date.now() + 20 * D).toISOString() });
    const refPay = `test_first_${ts}`;
    await sb.from('payments').insert({ user_id: B.id, reference: refPay, provider_reference: refPay, amount_cents: 700000, amount: 7000, currency: 'NGN', provider: 'paystack', status: 'success', plan_id: 'builder', billing: 'monthly' });
    const old = new Date(Date.now() - 15 * D).toISOString();
    await sb.from('billing_events').insert({ user_id: B.id, type: 'first_charge', data: { reference: refPay }, created_at: old });
    const { data: refRow, error: refErr } = await sb.from('referrals').insert({ referrer_id: A.id, referred_id: B.id, referral_code: 'BILLTEST' }).select('id').single();
    rec('fixture: referral row', !refErr, refErr?.message ?? '');
    sum = await engine.runBillingCycle(new Date(Date.now() + 20 * H));
    const { data: led } = await sb.from('credit_ledger').select('amount_kobo, reason, expires_at, source_payment_ref').eq('user_id', A.id).eq('reason', 'referral_earned');
    rec('referral: credit earned = 20% of inviter monthly (600) after 14 days', sum.creditEarned === 1 && led?.length === 1 && led[0].amount_kobo === 60000 && led[0].source_payment_ref === refPay, JSON.stringify(led));
    const expDays = led?.[0] ? (new Date(led[0].expires_at!).getTime() - Date.now()) / D : 0;
    rec('referral: credit expires in about 12 months', expDays > 360 && expDays < 370, String(Math.round(expDays)));
    rec('referral: credit_earned_at set', !!(await sb.from('referrals').select('credit_earned_at').eq('id', refRow!.id).single()).data?.credit_earned_at);
    n = await notes();
    rec('notification: credit_earned', n.some((x) => x.title.startsWith('You earned')));
    await engine.runBillingCycle(new Date(Date.now() + 21 * H));
    rec('referral: not earned twice', ((await sb.from('credit_ledger').select('id').eq('user_id', A.id).eq('reason', 'referral_earned')).data ?? []).length === 1);
    const can = await engine.cancelCreditForPayment(refPay);
    rec('refund cancels the credit it earned, balance back to 0', can.cancelledKobo === 60000 && (await subsMod.creditBalanceKobo(A.id)) === 0);
    const can2 = await engine.cancelCreditForPayment(refPay);
    rec('credit cancel is idempotent', can2.cancelledKobo === 0 && (await evCount(A.id, 'credit_cancelled')) === 1);

    // flagged referral does not earn
    await sb.from('referrals').update({ credit_earned_at: null, flagged_at: new Date().toISOString() }).eq('id', refRow!.id);
    await engine.runBillingCycle(new Date(Date.now() + 22 * H));
    rec('referral: flagged referral earns nothing', ((await sb.from('credit_ledger').select('id').eq('user_id', A.id).eq('reason', 'referral_earned')).data ?? []).length === 1);

    // 10. webhook subscription_charge --------------------------------------------------------------------------------
    const okRef = (await sb.from('member_subscriptions').select('last_charge_ref').eq('user_id', A.id).single()).data!.last_charge_ref as string;
    const wh3 = await hook.handleBillingV2Event({ event: 'charge.success', data: { reference: okRef, metadata: { purpose: 'subscription_charge', user_id: A.id } } });
    rec('webhook: subscription_charge success replay is idempotent (no second payment)', wh3?.status === 200 && (await count('payments', { user_id: A.id })) === 3, `payments ${await count('payments', { user_id: A.id })}`);
    const wh4 = await hook.handleBillingV2Event({ event: 'charge.failed', data: { reference: okRef, metadata: { purpose: 'subscription_charge', user_id: A.id } } });
    rec('webhook: charge.failed for a reference that actually succeeded is ignored', wh4?.status === 200 && (await sub()).state === 'active' && (await sub()).failed_count === 0);

    // 11. cleanup safety: other users' rows untouched -----------------------------------------------------------------
  } catch (e) {
    console.error('SCRIPT ERROR', e instanceof Error ? e.stack : e);
    rec('script completed', false, e instanceof Error ? e.message : String(e));
  } finally {
    await cleanup();
    const leftovers = await sb.from('member_subscriptions').select('*', { count: 'exact', head: true });
    console.log('cleanup done; member_subscriptions rows left:', leftovers.count);
    const pass = results.filter((r) => r.ok).length;
    console.log(`\nRESULT ${pass}/${results.length} passed`);
    for (const r of results.filter((x) => !x.ok)) console.log('FAILED:', r.n, r.d);
    process.exit(results.every((r) => r.ok) ? 0 : 1);
  }
})();
