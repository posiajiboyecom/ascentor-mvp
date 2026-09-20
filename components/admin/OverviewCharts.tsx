'use client';

// Admin overview: KPI strip + Recharts visualisations.
// Data: /api/admin/analytics (server-side aggregates, permission-aware).
// Colours are Ledger tokens so charts follow the admin light/dark theme.

import { useCallback, useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';

interface Analytics {
  canRevenue: boolean;
  generatedAt: string;
  kpis: {
    totalUsers: number; newUsers7d: number; newUsers30d: number;
    sessions7d: number; sessions30d: number; activeSubs: number;
    mrr: number | null; revenue30d: number | null; revenueSummit30d?: number | null; revenueSubscription30d?: number | null; summitPaidCount?: number | null; completionRate: number | null;
  };
  series: { date: string; signups: number; sessions: number; subscriptions: number; summit: number }[];
  plans: { plan: string; count: number }[];
  funnel: {
    started: number; completed: number; abandoned: number; pending: number;
    failed: number; duplicate: number; abandonedValue: number;
  } | null;
}

const C = {
  gold:  'var(--ledger-gold)',
  info:  'var(--ledger-info)',
  good:  'var(--ledger-good)',
  bad:   'var(--ledger-bad)',
  faint: 'var(--ledger-ink-faint)',
  grid:  'var(--ledger-line)',
  ink:   'var(--ledger-ink)',
  soft:  'var(--ledger-ink-soft)',
};
const PLAN_COLORS = [C.gold, C.info, C.good, C.faint, C.bad];

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
const nairaCompact = (n: number) =>
  `₦${new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const NON_WORD = /\W+/g;
const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// ── shared bits ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--ledger-bg-deep)', border: '1px solid var(--ledger-line-strong)',
        borderRadius: 10, padding: '8px 12px', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', fontSize: 12,
      }}
    >
      <div style={{ color: C.soft, marginBottom: 4, fontWeight: 600 }}>
        {ISO_DAY.test(String(label ?? '')) ? shortDate(String(label)) : String(label ?? '')}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.ink }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: C.soft }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700 }}>
            {money ? naira(Number(p.value)) : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, sub, children, style }: { title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="rounded-xl p-5 ledger-panel" style={style}>
      <div style={{ marginBottom: 14 }}>
        <h2 className="ledger-h2" style={{ fontSize: 15, margin: 0 }}>{title}</h2>
        {sub && <p className="ledger-mono" style={{ fontSize: 11.5, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Kpi({
  label, value, sub, color, spark, sparkKey,
}: {
  label: string; value: string; sub?: string; color: string;
  spark?: Analytics['series']; sparkKey?: 'signups' | 'sessions' | 'revenue';
}) {
  const gradId = `spark-${label.replace(NON_WORD, '-')}`;
  const data = spark?.map(d => ({
    d: d.date,
    v: sparkKey === 'revenue' ? d.subscriptions + d.summit : sparkKey ? d[sparkKey] : 0,
  }));
  return (
    <div className="rounded-xl p-4 ledger-panel" style={{ overflow: 'hidden', minHeight: 132 }}>
      <div className="ledger-label" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>{label}</div>
      <div className="ledger-number" style={{ color, fontSize: 26, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="ledger-mono" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
      {data && (
        <div style={{ width: '100%', height: 34, marginTop: 8, opacity: 0.9, pointerEvents: 'none' }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--ledger-ink-soft)', fontSize: 11 },
} as const;

// ── main ────────────────────────────────────────────────────────────────────

export default function OverviewCharts() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'You do not have access to analytics' : 'Could not load analytics');
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !data) {
    return (
      <div className="rounded-xl p-4 mb-5 text-xs" style={{ background: 'var(--ledger-bad-bg)', color: 'var(--ledger-bad)', border: '1px solid rgba(200,74,56,0.30)' }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl ledger-panel" style={{ height: 104, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  const { kpis, series, plans, funnel, canRevenue } = data;
  const funnelRows = funnel ? [
    { name: 'Started',   value: funnel.started,   fill: C.info },
    { name: 'Completed', value: funnel.completed, fill: C.good },
    { name: 'Abandoned', value: funnel.abandoned, fill: C.gold },
    { name: 'Failed',    value: funnel.failed,    fill: C.bad },
  ] : [];
  const planTotal = plans.reduce((t, p) => t + p.count, 0);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="ledger-btn ledger-btn-ghost" onClick={load} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} aria-label="Refresh analytics">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Total users" value={kpis.totalUsers.toLocaleString()} sub={`+${kpis.newUsers7d} this week`}
             color={C.info} spark={series} sparkKey="signups" />
        <Kpi label="Active subscribers" value={kpis.activeSubs.toLocaleString()} sub="paid + trialing" color={C.gold} />
        {canRevenue && (
          <>
            <Kpi label="MRR (est.)" value={nairaCompact(kpis.mrr ?? 0)} sub="excludes promo / manual" color={C.good} />
            <Kpi label="Subscription revenue, 30d" value={nairaCompact(kpis.revenueSubscription30d ?? 0)} sub="plans only (no Summit)"
                 color={C.good} spark={series} sparkKey="revenue" />
            <a href="/admin/summit-payments" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Kpi label="Summit tickets, 30d" value={naira(kpis.revenueSummit30d ?? 0)} sub={`${kpis.summitPaidCount ?? 0} paid · click to manage`} color={C.gold} />
            </a>
            <Kpi label="Checkout completion" value={kpis.completionRate == null ? '-' : `${kpis.completionRate}%`}
                 sub={funnel ? `${funnel.abandoned} abandoned` : undefined}
                 color={kpis.completionRate != null && kpis.completionRate < 60 ? C.gold : C.good} />
          </>
        )}
        <Kpi label="AI sessions, 7 days" value={kpis.sessions7d.toLocaleString()} sub={`${kpis.sessions30d.toLocaleString()} in 30 days`}
             color={C.gold} spark={series} sparkKey="sessions" />
      </div>

      {/* Revenue + plan mix */}
      {canRevenue && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Panel title="Revenue" sub="Daily, last 30 days (NGN)" style={{ gridColumn: 'span 2 / span 2' }}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={series} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} interval={4} {...axisProps} />
                  <YAxis tickFormatter={v => nairaCompact(Number(v))} width={56} {...axisProps} />
                  <Tooltip content={<ChartTooltip money />} cursor={{ fill: 'var(--ledger-bg-card-hover)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--ledger-ink-soft)' }} />
                  <Bar dataKey="subscriptions" name="Subscriptions" stackId="rev" fill={C.gold} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="summit" name="Summit tickets" stackId="rev" fill={C.info} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Subscriber mix" sub={`${planTotal} active`}>
            {plans.length === 0 ? (
              <p className="ledger-mono" style={{ fontSize: 12 }}>No active subscribers yet.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={plans} dataKey="count" nameKey="plan" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                      {plans.map((p, i) => <Cell key={p.plan} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--ledger-ink-soft)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Growth + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Growth & engagement" sub="New signups and AI coaching sessions per day"
               style={{ gridColumn: canRevenue ? 'span 2 / span 2' : 'span 3 / span 3' }}>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g-signups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.info} stopOpacity={0.35} /><stop offset="100%" stopColor={C.info} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-sessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} /><stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} interval={4} {...axisProps} />
                <YAxis allowDecimals={false} width={44} {...axisProps} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--ledger-ink-soft)' }} />
                <Area type="monotone" dataKey="signups" name="Signups" stroke={C.info} strokeWidth={2} fill="url(#g-signups)" />
                <Area type="monotone" dataKey="sessions" name="AI sessions" stroke={C.gold} strokeWidth={2} fill="url(#g-sessions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {canRevenue && funnel && (
          <Panel title="Checkout funnel" sub={`Last 30 days · ${naira(funnel.abandonedValue)} left unpaid`}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={funnelRows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} {...axisProps} />
                  <YAxis type="category" dataKey="name" width={78} {...axisProps} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--ledger-bg-card-hover)' }} />
                  <Bar dataKey="value" name="Attempts" radius={[0, 6, 6, 0]} barSize={22}>
                    {funnelRows.map(r => <Cell key={r.name} fill={r.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
