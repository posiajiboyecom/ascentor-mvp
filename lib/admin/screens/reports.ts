// lib/admin/screens/reports.ts
// Spec copied from the admin prototype (Insights · Reports). Generate builds the CSV from live data and downloads it; "Last generated"
// is read back from the audit log (the console records every Generate and Export), so nothing extra is stored.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { listAudit } from '@/lib/admin/audit';
import type { ActionResult, ScreenModule, ScreenSpec, StaffCtx } from '@/lib/admin/types';

export const spec: ScreenSpec = {
  area: "reports",
  group: "Insights",
  title: "Reports",
  sub: "Downloadable reports for the team and partners.",
  cols: [
    "Report",
    "Range",
    "Last generated",
    "Status"
  ],
  statusCol: 3,
  actions: [
    {
      id: "generate",
      label: "Generate",
      col: 3,
      to: "Ready"
    },
    {
      id: "export",
      label: "Export",
      when: "Ready",
      admin: true,
      done: "Export ready to download.",
      keep: true
    }
  ],
  quick: 0
};

const TZ = 'Africa/Lagos';
const DAY = 86400000;
const ROW_CAP = 20000;

interface ReportDef { id: string; label: string; range: string }
const REPORTS: ReportDef[] = [
  { id: 'members', label: 'Members', range: 'All time' },
  { id: 'revenue', label: 'Revenue', range: 'This month' },
  { id: 'engagement', label: 'Engagement', range: 'Last 30 days' },
  { id: 'coaching', label: 'Coaching', range: 'Last 30 days' },
  { id: 'content', label: 'Content', range: 'Last 30 days' },
  { id: 'referrals', label: 'Referrals', range: 'All time' },
];

// CSV with a guard against spreadsheet formulas: a cell that starts with = + - @ is prefixed with an apostrophe.
const FORMULA_START = /^([=+\-@\t\r])/;
const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(FORMULA_START, "'$1")}"`;
const toCsv = (head: string[], rows: unknown[][]) => [head.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n');
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) : '');
const naira = (n: number) => n.toFixed(2);

function monthStartIso(): string {
  const [y, m] = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 3600000).toISOString(); // Lagos is UTC+1, no daylight saving
}

async function createdSince(table: string, since: string, col = 'created_at'): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from(table).select(col).gte(col, since).order(col, { ascending: false }).limit(ROW_CAP);
  if (error) return [];
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[col]);
}

function perDay(since: string, series: Record<string, string[]>): { head: string[]; rows: unknown[][] } {
  const keys = Object.keys(series);
  const counts: Record<string, Map<string, number>> = {};
  for (const k of keys) {
    const m = new Map<string, number>();
    for (const iso of series[k]) { const d = day(iso); m.set(d, (m.get(d) ?? 0) + 1); }
    counts[k] = m;
  }
  const rows: unknown[][] = [];
  const start = new Date(since).getTime();
  for (let t = start; t <= Date.now() + DAY / 2; t += DAY) {
    const d = day(new Date(t).toISOString());
    rows.push([d, ...keys.map((k) => counts[k].get(d) ?? 0)]);
  }
  return { head: ['Date', ...keys], rows };
}

async function build(id: string, ctx: StaffCtx): Promise<{ filename: string; csv: string; count: number }> {
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  if (id === 'members') {
    // Emails only for teammates with Full access to Reports.
    const withEmail = ctx.level('reports') === 'full';
    const [{ data: profiles }, { data: mp }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, subscription_plan, subscription_status, created_at, referral_count').order('created_at', { ascending: false }).limit(ROW_CAP),
      supabaseAdmin.from('member_profile').select('user_id, city, stage, is_demo').limit(ROW_CAP),
    ]);
    const m = new Map(((mp ?? []) as { user_id: string; city: string | null; stage: string | null; is_demo: boolean | null }[]).map((r) => [r.user_id, r]));
    const rows = ((profiles ?? []) as { id: string; full_name: string | null; email: string | null; subscription_plan: string | null; subscription_status: string | null; created_at: string; referral_count: number | null }[])
      .filter((p) => !m.get(p.id)?.is_demo)
      .map((p) => [p.full_name ?? '', ...(withEmail ? [p.email ?? ''] : []), m.get(p.id)?.city ?? '', m.get(p.id)?.stage ?? '', p.subscription_plan ?? '', p.subscription_status ?? '', day(p.created_at), p.referral_count ?? 0]);
    return { filename: 'members-report.csv', count: rows.length, csv: toCsv(['Name', ...(withEmail ? ['Email'] : []), 'City', 'Stage', 'Plan', 'Subscription', 'Joined', 'Members referred'], rows) };
  }
  if (id === 'revenue') {
    const since = monthStartIso();
    const [a, p] = await Promise.all([
      supabaseAdmin.from('payment_attempts').select('reference, kind, plan_id, billing, amount_kobo, currency, paid_at').eq('status', 'success').gte('paid_at', since).limit(ROW_CAP),
      supabaseAdmin.from('payments').select('reference, plan_id, billing, amount, amount_cents, currency, provider, promo_code, paid_at, created_at').eq('status', 'success').gte('created_at', since).limit(ROW_CAP),
    ]);
    const seen = new Set<string>();
    const rows: unknown[][] = [];
    for (const r of (a.data ?? []) as { reference: string; kind: string | null; plan_id: string | null; billing: string | null; amount_kobo: number | null; currency: string | null; paid_at: string | null }[]) {
      seen.add(r.reference);
      rows.push([day(r.paid_at), r.reference, r.kind ?? '', r.plan_id ?? '', r.billing ?? '', r.currency ?? 'NGN', naira(Number(r.amount_kobo ?? 0) / 100), '']);
    }
    for (const r of (p.data ?? []) as { reference: string | null; plan_id: string | null; billing: string | null; amount: number | null; amount_cents: number | null; currency: string | null; promo_code: string | null; paid_at: string | null; created_at: string }[]) {
      if (r.reference && seen.has(r.reference)) continue;
      rows.push([day(r.paid_at ?? r.created_at), r.reference ?? '', 'subscription', r.plan_id ?? '', r.billing ?? '', r.currency ?? 'NGN', naira(r.amount != null ? Number(r.amount) : Number(r.amount_cents ?? 0) / 100), r.promo_code ?? '']);
    }
    rows.sort((x, y) => String(y[0]).localeCompare(String(x[0])));
    return { filename: 'revenue-report.csv', count: rows.length, csv: toCsv(['Date', 'Reference', 'Kind', 'Plan', 'Billing', 'Currency', 'Amount', 'Promo code'], rows) };
  }
  if (id === 'engagement') {
    const [signups, checkins, circle, group, dms, posts] = await Promise.all([
      createdSince('profiles', since30), createdSince('practice_checkins', since30), createdSince('circle_messages', since30),
      createdSince('rx_group_messages', since30), createdSince('dm_messages', since30), createdSince('feed_posts', since30),
    ]);
    const t = perDay(since30, { 'New members': signups, 'Check-ins': checkins, 'Circle messages': circle, 'Group messages': group, 'Direct messages': dms, 'Posts': posts });
    return { filename: 'engagement-report.csv', count: t.rows.length, csv: toCsv(t.head, t.rows) };
  }
  if (id === 'coaching') {
    const [{ data: msgs }, convs] = await Promise.all([
      supabaseAdmin.from('sage_messages').select('created_at').eq('role', 'user').gte('created_at', since30).limit(ROW_CAP),
      createdSince('sage_conversations', since30, 'started_at'),
    ]);
    const mm = (msgs ?? []) as { created_at: string }[];
    const t = perDay(since30, { 'Conversations started': convs, 'Member messages to Sage': mm.map((x) => x.created_at) });
    return { filename: 'coaching-report.csv', count: t.rows.length, csv: toCsv(t.head, t.rows) };
  }
  if (id === 'content') {
    const [{ data: lessons }, { data: done }, { data: blog }] = await Promise.all([
      supabaseAdmin.from('rx_lessons').select('id, title, dimension, published').order('sort').limit(1000),
      supabaseAdmin.from('rx_lesson_progress').select('lesson_id').not('completed_at', 'is', null).gte('completed_at', since30).limit(ROW_CAP),
      supabaseAdmin.from('blog_posts').select('title, is_published, published_at, views').order('views', { ascending: false }).limit(500),
    ]);
    const c = new Map<string, number>();
    for (const r of (done ?? []) as { lesson_id: string }[]) c.set(r.lesson_id, (c.get(r.lesson_id) ?? 0) + 1);
    const rows: unknown[][] = [];
    for (const l of (lessons ?? []) as { id: string; title: string; dimension: string | null; published: boolean }[]) rows.push(['Lesson', l.title, l.dimension ?? '', l.published ? 'Published' : 'Draft', c.get(l.id) ?? 0, '']);
    for (const b of (blog ?? []) as { title: string; is_published: boolean; views: number | null }[]) rows.push(['Blog post', b.title, '', b.is_published ? 'Published' : 'Draft', '', b.views ?? 0]);
    return { filename: 'content-report.csv', count: rows.length, csv: toCsv(['Type', 'Title', 'Dimension', 'State', 'Completions (last 30 days)', 'Views (all time)'], rows) };
  }
  if (id === 'referrals') {
    const [{ data: refs }, { data: profs }] = await Promise.all([
      supabaseAdmin.from('referrals').select('referrer_id, status').limit(ROW_CAP),
      supabaseAdmin.from('profiles').select('id, full_name, referral_code').gt('referral_count', 0).limit(2000),
    ]);
    const by = new Map<string, { total: number; done: number }>();
    for (const r of (refs ?? []) as { referrer_id: string; status: string }[]) {
      const e = by.get(r.referrer_id) ?? { total: 0, done: 0 };
      e.total++;
      if (r.status === 'completed' || r.status === 'rewarded' || r.status === 'converted') e.done++;
      by.set(r.referrer_id, e);
    }
    const names = new Map(((profs ?? []) as { id: string; full_name: string | null; referral_code: string | null }[]).map((p) => [p.id, p]));
    const rows = [...by.entries()].sort((a, b) => b[1].total - a[1].total).map(([rid, e]) => [names.get(rid)?.full_name ?? '', names.get(rid)?.referral_code ?? '', e.total, e.done]);
    return { filename: 'referrals-report.csv', count: rows.length, csv: toCsv(['Referrer', 'Code', 'People referred', 'Converted'], rows) };
  }
  throw new Error('Unknown report.');
}

async function lastGenerated(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const rows = await listAudit({ limit: 500 });
  for (const r of rows) {
    if (r.area !== 'Reports' || (r.what !== 'Generate' && r.what !== 'Export')) continue;
    if (!out.has(r.item)) out.set(r.item, r.when);
  }
  return out;
}

const screen: ScreenModule = {
  spec,
  async load() {
    const last = await lastGenerated();
    return {
      rows: REPORTS.map((r) => ({ id: r.id, cells: [r.label, r.range, last.get(r.label) ?? 'Not yet', last.has(r.label) ? 'Ready' : 'Pending'] })),
      note: 'Reports are built from live data each time. Generate downloads a CSV; the time shown is when a teammate last generated or exported it.',
    };
  },

  async act(ctx, actionId, rowId): Promise<ActionResult> {
    if (actionId !== 'generate' && actionId !== 'export') return { ok: false, error: 'Unknown action.' };
    const def = REPORTS.find((r) => r.id === rowId);
    if (!def) return { ok: false, error: 'Unknown report.' };
    const r = await build(rowId, ctx);
    return { ok: true, message: `${def.label} report ready: ${r.count.toLocaleString('en-NG')} rows.`, download: { filename: r.filename, mime: 'text/csv;charset=utf-8', content: r.csv } };
  },
};

export default screen;
