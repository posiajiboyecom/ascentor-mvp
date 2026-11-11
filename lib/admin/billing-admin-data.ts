// lib/admin/billing-admin-data.ts
// Server-only loaders for the Billing v2 admin pages. Read-only. They degrade to an empty list plus a note while the
// billing tables are not there yet. Nothing here returns card authorisation codes, group link tokens or full card data.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { availableCreditKobo, countActiveMembers, type LedgerRow } from '@/lib/billing/rules';
import { isCurrency, type Currency } from '@/lib/billing/catalog';
import {
  stateLabel, mrrByCurrency, moneyTotals, planLabel, priceTypeLabel, cycleLabel, koboToNaira, dayLabel, dayTimeLabel, groupStatusLabel, groupNotice,
  creditKindLabel, eventLabel,
} from '@/lib/admin/billing-admin';

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(e.code || '') || /does not exist|schema cache/i.test(e.message || ''));

const SETUP_NOTE = 'The billing tables are not in the database yet, so there is nothing to show.';
const LIMIT = 500;

async function namesFor(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', uniq.slice(i, i + 200));
    for (const p of data ?? []) out[p.id as string] = ((p.full_name as string | null) || (p.email as string | null) || '-').trim();
  }
  return out;
}

/** Ledger rows per member, keyed `${userId}|${currency}`: credit is earned and spent in one currency. */
async function ledgerFor(ids: string[]): Promise<Record<string, LedgerRow[]>> {
  const out: Record<string, LedgerRow[]> = {};
  const uniq = Array.from(new Set(ids));
  for (let i = 0; i < uniq.length; i += 200) {
    const { data } = await supabaseAdmin.from('credit_ledger').select('id, user_id, amount_kobo, reason, created_at, expires_at, currency').in('user_id', uniq.slice(i, i + 200));
    for (const r of (data ?? []) as { id: string; user_id: string; amount_kobo: number; reason: LedgerRow['reason']; created_at: string; expires_at: string | null; currency: string | null }[]) {
      (out[`${r.user_id}|${r.currency ?? 'NGN'}`] ??= []).push({ id: r.id, amountKobo: r.amount_kobo, reason: r.reason, createdAt: new Date(r.created_at), expiresAt: r.expires_at ? new Date(r.expires_at) : null });
    }
  }
  return out;
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export interface SubRow {
  userId: string; name: string; plan: string; planCode: string; priceType: string; cycle: string; state: string; leaving: boolean;
  trialEnd: string; nextCharge: string; lastCharge: string; failed: number; card: string; group: string; credit: string;
}
export interface SubKpis { trial: number; active: number; grace: number; lapsed: number; mrr: string; failedWeek: number }

export async function loadSubscriptions(): Promise<{ rows: SubRow[]; kpis: SubKpis; note: string }> {
  const empty: SubKpis = { trial: 0, active: 0, grace: 0, lapsed: 0, mrr: '-', failedWeek: 0 };
  const { data, error } = await supabaseAdmin.from('member_subscriptions').select('*').order('updated_at', { ascending: false }).limit(LIMIT);
  if (error) return { rows: [], kpis: empty, note: missing(error) ? SETUP_NOTE : 'We could not load subscriptions. Try again in a moment.' };
  const subs = (data ?? []) as Record<string, any>[];
  const ids = subs.map((s) => s.user_id as string);
  const cardIds = subs.map((s) => s.payment_method_id as string | null).filter(Boolean) as string[];

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [names, cardsRes, groupsRes, ledgers, failedRes, allStates] = await Promise.all([
    namesFor(ids),
    cardIds.length ? supabaseAdmin.from('payment_methods').select('id, brand, last4').in('id', cardIds) : Promise.resolve({ data: [] as any[] }),
    ids.length ? supabaseAdmin.from('billing_group_members').select('user_id, billing_groups(code)').in('user_id', ids).is('left_at', null) : Promise.resolve({ data: [] as any[] }),
    ledgerFor(ids),
    supabaseAdmin.from('billing_events').select('*', { count: 'exact', head: true }).eq('type', 'renewal_failed').gte('created_at', weekAgo),
    supabaseAdmin.from('member_subscriptions').select('plan_code, state, cancel_at_period_end, currency').limit(5000),
  ]);

  const cards: Record<string, string> = {};
  for (const c of (cardsRes.data ?? []) as { id: string; brand: string | null; last4: string | null }[]) {
    cards[c.id] = c.last4 ? `${(c.brand || 'Card').trim()} ending ${c.last4}` : '-';
  }
  const groups: Record<string, string> = {};
  for (const g of (groupsRes.data ?? []) as any[]) {
    const code = Array.isArray(g.billing_groups) ? g.billing_groups[0]?.code : g.billing_groups?.code;
    if (code) groups[g.user_id] = code;
  }

  const now = new Date();
  const rows: SubRow[] = subs.map((s) => {
    const currency: Currency = isCurrency(s.currency) ? s.currency : 'NGN';
    return {
    userId: s.user_id,
    name: names[s.user_id] || '-',
    plan: currency === 'USD' ? `${planLabel(s.tier)} (USD)` : planLabel(s.tier),
    planCode: String(s.plan_code ?? ''),
    priceType: priceTypeLabel(s.price_type),
    cycle: cycleLabel(s.cycle),
    state: stateLabel(s.state),
    leaving: !!s.cancel_at_period_end && s.state === 'active',
    trialEnd: dayLabel(s.trial_ends_at),
    nextCharge: dayLabel(s.next_charge_at),
    lastCharge: dayLabel(s.last_charge_at),
    failed: Number(s.failed_count ?? 0),
    card: (s.payment_method_id && cards[s.payment_method_id]) || '-',
    group: groups[s.user_id] || '-',
    credit: koboToNaira(availableCreditKobo(ledgers[`${s.user_id}|${currency}`] ?? [], now), currency),
  }; });

  const all = (allStates.data ?? []) as { plan_code: string; state: string; cancel_at_period_end: boolean; currency: string | null }[];
  const countOf = (st: string) => all.filter((s) => s.state === st).length;
  const kpis: SubKpis = {
    trial: countOf('trial'), active: countOf('active'), grace: countOf('grace'), lapsed: countOf('lapsed'),
    mrr: moneyTotals(mrrByCurrency(all.map((s) => ({ planCode: s.plan_code, state: s.state, cancelAtPeriodEnd: s.cancel_at_period_end, currency: s.currency })))),
    failedWeek: failedRes.count ?? 0,
  };
  return { rows, kpis, note: subs.length >= LIMIT ? `Showing the ${LIMIT} most recently changed subscriptions. The tiles count all of them.` : '' };
}

export interface EventLine { label: string; when: string; detail: string }

/** Timeline for one member. Only a short whitelist of fields is shown: never card data, references or authorisation codes. */
export async function loadSubscriptionEvents(userId: string): Promise<EventLine[]> {
  const { data } = await supabaseAdmin.from('billing_events').select('type, data, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  return ((data ?? []) as { type: string; data: Record<string, unknown> | null; created_at: string }[]).map((e) => {
    const d = e.data ?? {};
    const bits: string[] = [];
    const kobo = typeof d.amount_kobo === 'number' ? d.amount_kobo : typeof d.gross_kobo === 'number' ? d.gross_kobo : null;
    if (kobo != null) bits.push(koboToNaira(kobo, isCurrency(d.currency) ? d.currency : 'NGN'));
    if (typeof d.plan_code === 'string') bits.push(d.plan_code.replace(/_/g, ' '));
    if (typeof d.reason === 'string') bits.push(d.reason.replace(/_/g, ' '));
    if (typeof d.during === 'string') bits.push(`during ${d.during}`);
    if (typeof d.brand === 'string' && typeof d.last4 === 'string') bits.push(`${d.brand} ending ${d.last4}`);
    return { label: eventLabel(e.type), when: dayTimeLabel(e.created_at), detail: bits.join(', ') };
  });
}

// ── Groups ──────────────────────────────────────────────────────────────────

export interface GroupMemberRow { userId: string; name: string; joined: string; left: string; plan: string; state: string; freeLeader: boolean; active: boolean }
export interface GroupRow {
  id: string; code: string; status: string; flagged: boolean; flagReason: string; created: string; activeCount: number; notice: string;
  members: GroupMemberRow[]; planSummary: string;
}

export async function loadGroups(): Promise<{ rows: GroupRow[]; note: string }> {
  const { data, error } = await supabaseAdmin.from('billing_groups').select('id, code, status, flagged, flag_reason, created_at').order('created_at', { ascending: false }).limit(200);
  if (error) return { rows: [], note: missing(error) ? SETUP_NOTE : 'We could not load groups. Try again in a moment.' };
  const groups = (data ?? []) as { id: string; code: string; status: string; flagged: boolean; flag_reason: string | null; created_at: string }[];
  if (!groups.length) return { rows: [], note: '' };

  const { data: mem } = await supabaseAdmin.from('billing_group_members').select('group_id, user_id, joined_at, left_at, plan_code').in('group_id', groups.map((g) => g.id)).order('joined_at', { ascending: true });
  const members = (mem ?? []) as { group_id: string; user_id: string; joined_at: string; left_at: string | null; plan_code: string | null }[];
  const uids = Array.from(new Set(members.map((m) => m.user_id)));
  const [names, subsRes, profsRes] = await Promise.all([
    namesFor(uids),
    uids.length ? supabaseAdmin.from('member_subscriptions').select('user_id, state, tier, plan_code').in('user_id', uids) : Promise.resolve({ data: [] as any[] }),
    uids.length ? supabaseAdmin.from('profiles').select('id, leader_free').in('id', uids) : Promise.resolve({ data: [] as any[] }),
  ]);
  const subOf: Record<string, { state: string; tier: string; plan_code: string }> = {};
  for (const s of (subsRes.data ?? []) as any[]) subOf[s.user_id] = s;
  const free = new Set(((profsRes.data ?? []) as { id: string; leader_free: boolean | null }[]).filter((p) => p.leader_free).map((p) => p.id));

  const rows: GroupRow[] = groups.map((g) => {
    const ms = members.filter((m) => m.group_id === g.id);
    const list: GroupMemberRow[] = ms.map((m) => {
      const s = subOf[m.user_id];
      return {
        userId: m.user_id, name: names[m.user_id] || '-', joined: dayLabel(m.joined_at), left: m.left_at ? dayLabel(m.left_at) : '',
        plan: planLabel(s?.tier) !== '-' ? `${planLabel(s?.tier)}, ${cycleLabel(subPlanCycle(m.plan_code || s?.plan_code))}` : free.has(m.user_id) ? 'Leader (free)' : '-',
        state: s ? stateLabel(s.state) : '-', freeLeader: free.has(m.user_id), active: !m.left_at,
      };
    });
    const current = ms.filter((m) => !m.left_at);
    const activeCount = countActiveMembers(current.map((m) => ({ state: (subOf[m.user_id]?.state ?? 'cancelled') as any, leaderFree: free.has(m.user_id) })));
    const tiers = Array.from(new Set(current.map((m) => planLabel(subOf[m.user_id]?.tier)).filter((t) => t !== '-')));
    return {
      id: g.id, code: g.code, status: groupStatusLabel(g.status), flagged: !!g.flagged, flagReason: g.flag_reason || '', created: dayLabel(g.created_at),
      activeCount, notice: groupNotice(activeCount) ?? '', members: list, planSummary: tiers.length ? tiers.join(' and ') : '-',
    };
  });
  return { rows, note: groups.length >= 200 ? 'Showing the 200 newest groups.' : '' };
}

function subPlanCycle(planCode: string | null | undefined): string {
  return /annual|yearly/.test(planCode || '') ? 'yearly' : /monthly/.test(planCode || '') ? 'monthly' : '';
}

// ── Credits ─────────────────────────────────────────────────────────────────

export interface CreditBalanceRow { userId: string; name: string; balance: string; balanceKobo: number; earned: string; used: string; lost: string }
export interface CreditLedgerRow { id: string; member: string; kind: string; amount: string; source: string; flagged: boolean; date: string; expires: string }

export async function loadCredits(): Promise<{ balances: CreditBalanceRow[]; ledger: CreditLedgerRow[]; totalKobo: number; totalLabel: string; note: string }> {
  const { data, error } = await supabaseAdmin.from('credit_ledger').select('id, user_id, amount_kobo, reason, source_referral_id, created_at, expires_at, currency').order('created_at', { ascending: false }).limit(2000);
  if (error) return { balances: [], ledger: [], totalKobo: 0, totalLabel: '-', note: missing(error) ? SETUP_NOTE : 'We could not load credits. Try again in a moment.' };
  const rows = (data ?? []) as { id: string; user_id: string; amount_kobo: number; reason: string; source_referral_id: string | null; created_at: string; expires_at: string | null; currency: string | null }[];
  const curOf = (r: { currency: string | null }): Currency => (isCurrency(r.currency) ? r.currency : 'NGN');

  const refIds = Array.from(new Set(rows.map((r) => r.source_referral_id).filter(Boolean) as string[]));
  let refs: { id: string; referrer_id: string; referred_id: string; flagged_at?: string | null }[] = [];
  if (refIds.length) {
    const r1 = await supabaseAdmin.from('referrals').select('id, referrer_id, referred_id, flagged_at').in('id', refIds.slice(0, 500));
    if (!r1.error) refs = (r1.data ?? []) as typeof refs;
    else {
      const r2 = await supabaseAdmin.from('referrals').select('id, referrer_id, referred_id').in('id', refIds.slice(0, 500));
      refs = (r2.data ?? []) as typeof refs;
    }
  }
  const names = await namesFor([...rows.map((r) => r.user_id), ...refs.map((r) => r.referred_id)]);
  const refOf = new Map(refs.map((r) => [r.id, r]));

  const byUser: Record<string, LedgerRow[]> = {};
  const sums: Record<string, { earned: number; used: number; lost: number }> = {};
  // Balances are per member AND currency: naira and dollar credit are separate and never added together.
  for (const r of rows) {
    const key = `${r.user_id}|${curOf(r)}`;
    (byUser[key] ??= []).push({ id: r.id, amountKobo: r.amount_kobo, reason: r.reason as LedgerRow['reason'], createdAt: new Date(r.created_at), expiresAt: r.expires_at ? new Date(r.expires_at) : null });
    const s = (sums[key] ??= { earned: 0, used: 0, lost: 0 });
    if (r.reason === 'referral_earned') s.earned += r.amount_kobo;
    else if (r.reason === 'used') s.used += Math.abs(r.amount_kobo);
    else s.lost += Math.abs(r.amount_kobo);
  }
  const now = new Date();
  const totals: Record<Currency, number> = { NGN: 0, USD: 0 };
  const balances: CreditBalanceRow[] = Object.keys(byUser).map((key) => {
    const [uid, cur] = key.split('|') as [string, Currency];
    const b = availableCreditKobo(byUser[key], now);
    totals[cur] += b;
    const f = (n: number) => koboToNaira(n, cur);
    return { userId: uid, name: (names[uid] || '-') + (cur === 'USD' ? ' (USD)' : ''), balance: f(b), balanceKobo: b, earned: f(sums[key].earned), used: f(sums[key].used), lost: f(sums[key].lost) };
  }).sort((a, b) => b.balanceKobo - a.balanceKobo);

  const ledger: CreditLedgerRow[] = rows.slice(0, 300).map((r) => {
    const ref = r.source_referral_id ? refOf.get(r.source_referral_id) : undefined;
    return {
      id: r.id, member: names[r.user_id] || '-', kind: creditKindLabel(r.reason), amount: koboToNaira(Math.abs(r.amount_kobo), curOf(r)),
      source: ref ? `Referral of ${names[ref.referred_id] || '-'}` : '-', flagged: !!ref?.flagged_at, date: dayLabel(r.created_at), expires: dayLabel(r.expires_at),
    };
  });
  return { balances, ledger, totalKobo: totals.NGN, totalLabel: moneyTotals(totals), note: rows.length >= 2000 ? 'Balances use the 2,000 newest ledger rows.' : '' };
}
