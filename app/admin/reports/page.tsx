'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// FEATURE #11: Admin Report Generation — /admin/reports
// ============================================================

type ReportType = 'users' | 'revenue' | 'engagement' | 'coaching' | 'referrals' | 'content';
type DateRange = '7d' | '30d' | '90d' | 'all';

const REPORTS: Record<ReportType, { label: string; desc: string; icon: string }> = {
  users:      { label: 'User Report', desc: 'Signups, subscribers, demographics', icon: '👥' },
  revenue:    { label: 'Revenue Report', desc: 'Payments, MRR, promo usage', icon: '💰' },
  engagement: { label: 'Engagement Report', desc: 'Sessions, posts, attendance', icon: '📊' },
  coaching:   { label: 'Coaching Report', desc: 'AI sessions, message counts', icon: '🤖' },
  referrals:  { label: 'Referral Report', desc: 'Funnel, conversions, top referrers', icon: '🔗' },
  content:    { label: 'Content Report', desc: 'Blog, courses, expert sessions', icon: '📝' },
};

export default function AdminReportsPage() {
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const supabase = createClient();

  const getSinceDate = (r: DateRange): Date => {
    const now = new Date();
    if (r === '7d') return new Date(now.getTime() - 7 * 86400000);
    if (r === '30d') return new Date(now.getTime() - 30 * 86400000);
    if (r === '90d') return new Date(now.getTime() - 90 * 86400000);
    return new Date(0);
  };

  const generate = async (type: ReportType) => {
    setLoading(true);
    setData(null);
    const since = getSinceDate(range).toISOString();

    try {
      let result: any = { type, range, generatedAt: new Date().toISOString(), rows: [] };

      if (type === 'users') {
        const { count: total } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: recent } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: subs } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active');
        const { data: profiles } = await supabase.from('profiles').select('full_name, current_role, industry, subscription_status, created_at').order('created_at', { ascending: false }).limit(200);

        result.summary = { 'Total Users': total, 'New (period)': recent, Subscribers: subs, 'Conversion Rate': total ? `${((subs || 0) / total * 100).toFixed(1)}%` : '0%' };
        result.rows = profiles || [];
        result.columns = ['full_name', 'current_role', 'industry', 'subscription_status', 'created_at'];
      }

      if (type === 'revenue') {
        const { data: payments } = await supabase.from('payments').select('*').gte('created_at', since).eq('status', 'success').order('created_at', { ascending: false });
        const totalRev = payments?.reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0) || 0;

        result.summary = { 'Total Revenue': `$${totalRev.toFixed(2)}`, Transactions: payments?.length || 0, 'Avg Transaction': payments?.length ? `$${(totalRev / payments.length).toFixed(2)}` : '$0' };
        result.rows = payments || [];
        result.columns = ['reference', 'amount', 'currency', 'provider', 'status', 'created_at'];
      }

      if (type === 'engagement') {
        const { count: coaching } = await supabase.from('coaching_sessions').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: posts } = await supabase.from('cohort_posts').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: registrations } = await supabase.from('session_registrations').select('*', { count: 'exact', head: true }).gte('registered_at', since);

        result.summary = { 'Coaching Sessions': coaching, 'Community Posts': posts, 'Expert Registrations': registrations };
      }

      if (type === 'coaching') {
        const { data: sessions } = await supabase.from('coaching_sessions').select('id, user_id, messages, summary, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(200);
        const avg = sessions?.length ? (sessions.reduce((s: number, x: any) => s + (x.messages?.length || 0), 0) / sessions.length).toFixed(1) : '0';

        result.summary = { 'Total Sessions': sessions?.length || 0, 'Avg Messages/Session': avg };
        result.rows = (sessions || []).map((s: any) => ({ ...s, message_count: s.messages?.length || 0, messages: undefined }));
        result.columns = ['id', 'user_id', 'message_count', 'created_at'];
      }

      if (type === 'referrals') {
        const { data: refs } = await supabase.from('referrals').select('*').gte('created_at', since).order('created_at', { ascending: false });
        const converted = refs?.filter((r: any) => ['subscribed', 'rewarded'].includes(r.status)).length || 0;

        result.summary = { 'Total Referrals': refs?.length || 0, Converted: converted, 'Conversion Rate': refs?.length ? `${(converted / refs.length * 100).toFixed(1)}%` : '0%' };
        result.rows = refs || [];
        result.columns = ['referral_code', 'status', 'referrer_reward', 'created_at'];
      }

      if (type === 'content') {
        const { count: blogs } = await supabase.from('blog_posts').select('*', { count: 'exact', head: true });
        const { count: courses } = await supabase.from('courses').select('*', { count: 'exact', head: true });
        const { count: expertSessions } = await supabase.from('expert_sessions').select('*', { count: 'exact', head: true });

        result.summary = { 'Blog Posts': blogs, Courses: courses, 'Expert Sessions': expertSessions };
      }

      setData(result);
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data?.rows?.length || !data?.columns) return;
    const headers = data.columns.join(',');
    const rows = data.rows.map((r: any) => data.columns.map((c: string) => {
      const val = r[c];
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',')).join('\n');
    const csv = headers + '\n' + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascentor_${data.type}_report_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascentor_${data.type}_report_${range}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const card: React.CSSProperties = { background: 'var(--bg-card, #12151F)', border: '1px solid var(--border, #2A2D3A)', borderRadius: '12px', padding: '16px' };
  const input: React.CSSProperties = { padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border, #2A2D3A)', background: 'var(--bg-input, #1A1D2E)', color: 'var(--text)', fontSize: '14px', cursor: 'pointer' };
  const btnPrimary: React.CSSProperties = { ...input, background: 'var(--accent, #F59E0B)', color: '#000', fontWeight: 600, border: 'none' };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>Reports</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Generate and export platform analytics reports.</p>

      {/* Date Range Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            ...input,
            background: range === r ? 'var(--accent, #F59E0B)' : 'var(--bg-input)',
            color: range === r ? '#000' : 'var(--text)',
            fontWeight: range === r ? 600 : 400,
          }}>
            {r === 'all' ? 'All Time' : `Last ${r.replace('d', ' days')}`}
          </button>
        ))}
      </div>

      {/* Report Type Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {(Object.entries(REPORTS) as [ReportType, typeof REPORTS[ReportType]][]).map(([key, cfg]) => (
          <button key={key} onClick={() => { setSelected(key); generate(key); }} style={{
            ...card, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
            borderColor: selected === key ? 'var(--accent)' : 'var(--border)',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{cfg.icon}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{cfg.label}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cfg.desc}</div>
          </button>
        ))}
      </div>

      {/* Report Results */}
      {loading && (
        <div style={{ ...card, textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Generating report...
        </div>
      )}

      {data && !loading && (
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {REPORTS[data.type as ReportType]?.icon} {REPORTS[data.type as ReportType]?.label}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '4px 0 0' }}>
                Generated {new Date(data.generatedAt).toLocaleString()} • {range === 'all' ? 'All time' : `Last ${range.replace('d', ' days')}`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {data.rows?.length > 0 && (
                <button onClick={exportCSV} style={input}>Export CSV</button>
              )}
              <button onClick={exportJSON} style={input}>Export JSON</button>
            </div>
          </div>

          {/* Summary Cards */}
          {data.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {Object.entries(data.summary).map(([key, val]) => (
                <div key={key} style={{
                  background: 'var(--bg-input, #1A1D2E)', borderRadius: '8px', padding: '14px',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{key}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{String(val)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Data Table */}
          {data.rows?.length > 0 && data.columns && (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {data.columns.map((c: string) => (
                      <th key={c} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {c.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.slice(0, 100).map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {data.columns.map((c: string) => (
                        <td key={c} style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row[c] === null || row[c] === undefined ? '—' : typeof row[c] === 'object' ? JSON.stringify(row[c]).slice(0, 40) : String(row[c]).slice(0, 50)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length > 100 && (
                <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                  Showing 100 of {data.rows.length} rows. Export for full data.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
