'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// Admin Report Generation — /admin/reports
// Brand-consistent with Ascentor Brand Book v1.0
// ============================================================

type ReportType = 'users' | 'revenue' | 'engagement' | 'coaching' | 'referrals' | 'content';
type DateRange  = '7d' | '30d' | '90d' | 'all';

const REPORTS: Record<ReportType, { label: string; desc: string; mono: string }> = {
  users:      { label: 'User Report',       desc: 'Signups, subscribers, demographics',  mono: 'USERS' },
  revenue:    { label: 'Revenue Report',    desc: 'Payments, MRR, promo usage',           mono: 'REVENUE' },
  engagement: { label: 'Engagement Report', desc: 'Sessions, posts, attendance',          mono: 'ENGAGEMENT' },
  coaching:   { label: 'Coaching Report',   desc: 'AI sessions, message counts',          mono: 'COACHING' },
  referrals:  { label: 'Referral Report',   desc: 'Funnel, conversions, top referrers',   mono: 'REFERRALS' },
  content:    { label: 'Content Report',    desc: 'Blog, courses, expert sessions',       mono: 'CONTENT' },
};

const RANGES: { key: DateRange; label: string }[] = [
  { key: '7d',  label: '7 DAYS' },
  { key: '30d', label: '30 DAYS' },
  { key: '90d', label: '90 DAYS' },
  { key: 'all', label: 'ALL TIME' },
];

export default function AdminReportsPage() {
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [range, setRange]       = useState<DateRange>('30d');
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState<any>(null);
  const supabase                = createClient();

  const getSinceDate = (r: DateRange): Date => {
    const now = new Date();
    if (r === '7d')  return new Date(now.getTime() - 7  * 86400000);
    if (r === '30d') return new Date(now.getTime() - 30 * 86400000);
    if (r === '90d') return new Date(now.getTime() - 90 * 86400000);
    return new Date(0);
  };

  const generate = async (type: ReportType) => {
    setLoading(true); setData(null);
    const since = getSinceDate(range).toISOString();

    try {
      let result: any = { type, range, generatedAt: new Date().toISOString(), rows: [] };

      if (type === 'users') {
        const { count: total }  = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: recent } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: subs }   = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active');
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
        const { count: coaching }      = await supabase.from('coaching_sessions').select('*', { count: 'exact', head: true }).gte('created_at', since);
        const { count: posts }         = await supabase.from('cohort_posts').select('*', { count: 'exact', head: true }).gte('created_at', since);
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
        const { count: blogs }         = await supabase.from('blog_posts').select('*', { count: 'exact', head: true });
        const { count: courses }       = await supabase.from('courses').select('*', { count: 'exact', head: true });
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
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ascentor_${data.type}_${range}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ascentor_${data.type}_${range}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .rp-root {
          padding: 32px 28px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Syne', sans-serif;
        }

        /* ── Header ── */
        .rp-header { margin-bottom: 32px; }
        .rp-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #E8A020; margin-bottom: 8px;
        }
        .rp-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 32px; letter-spacing: -0.3px;
          color: #fff; margin-bottom: 6px;
        }
        .rp-sub {
          font-size: 13px; color: #7A7260;
        }

        /* ── Date range ── */
        .rp-ranges {
          display: flex; gap: 6px; margin-bottom: 28px; flex-wrap: wrap;
        }
        .rp-range-btn {
          padding: 7px 16px; border-radius: 8px; border: none; cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.1em;
          transition: all 0.18s;
        }
        .rp-range-btn.active {
          background: #E8A020; color: #0C0B08; font-weight: 500;
        }
        .rp-range-btn.inactive {
          background: #1E1C17; color: #4A4438;
          border: 1px solid #2E2A22;
        }
        .rp-range-btn.inactive:hover { color: #D4CFC3; border-color: #4A4438; }

        /* ── Report type grid ── */
        .rp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px; margin-bottom: 28px;
        }
        .rp-type-btn {
          background: #141310;
          border-radius: 12px; padding: 20px;
          cursor: pointer; text-align: left;
          transition: all 0.2s; position: relative; overflow: hidden;
          border: 1px solid #2E2A22;
        }
        .rp-type-btn:hover { border-color: rgba(232,160,32,0.3); transform: translateY(-2px); }
        .rp-type-btn.active { border-color: rgba(232,160,32,0.5); background: rgba(232,160,32,0.04); }
        .rp-type-mono {
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #E8A020; margin-bottom: 10px;
        }
        .rp-type-label {
          font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;
        }
        .rp-type-desc { font-size: 12px; color: #4A4438; line-height: 1.4; }
        .rp-type-active-dot {
          position: absolute; top: 14px; right: 14px;
          width: 6px; height: 6px; border-radius: 50%; background: #E8A020;
        }

        /* ── Loading ── */
        .rp-loading {
          background: #141310; border: 1px solid #2E2A22;
          border-radius: 14px; padding: 48px;
          text-align: center;
        }
        .rp-loading-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #4A4438; animation: rp-pulse 1.5s ease-in-out infinite;
        }
        @keyframes rp-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }

        /* ── Result card ── */
        .rp-result {
          background: #141310; border: 1px solid #2E2A22;
          border-radius: 14px; overflow: hidden;
        }
        .rp-result-head {
          padding: 20px 24px;
          border-bottom: 1px solid #2E2A22;
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
        }
        .rp-result-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 22px; color: #fff; margin-bottom: 4px;
        }
        .rp-result-meta {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; color: #4A4438;
        }
        .rp-export-row { display: flex; gap: 8px; }
        .rp-export-btn {
          padding: 8px 16px; border-radius: 8px; cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em;
          background: #1E1C17; color: #7A7260;
          border: 1px solid #2E2A22;
          transition: all 0.18s;
        }
        .rp-export-btn:hover { color: #D4CFC3; border-color: #4A4438; }
        .rp-export-btn.primary { background: #E8A020; color: #0C0B08; border-color: transparent; }
        .rp-export-btn.primary:hover { background: #F5C55A; }

        /* ── Summary cards ── */
        .rp-summary {
          padding: 20px 24px;
          border-bottom: 1px solid #2E2A22;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        .rp-stat {
          background: #1E1C17; border-radius: 10px; padding: 14px 16px;
          border: 1px solid #2E2A22;
        }
        .rp-stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #4A4438; margin-bottom: 8px;
        }
        .rp-stat-value {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 26px; color: #fff; line-height: 1;
        }

        /* ── Table ── */
        .rp-table-wrap {
          overflow-x: auto;
        }
        .rp-table {
          width: 100%; border-collapse: collapse; font-size: 12px;
        }
        .rp-table th {
          padding: 10px 16px; text-align: left;
          font-family: 'DM Mono', monospace;
          font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #4A4438; font-weight: 400;
          border-bottom: 1px solid #2E2A22;
          white-space: nowrap;
          background: #141310;
        }
        .rp-table td {
          padding: 10px 16px; color: #7A7260;
          border-bottom: 1px solid #1E1C17;
          max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.02em;
        }
        .rp-table tr:last-child td { border-bottom: none; }
        .rp-table tr:hover td { background: rgba(232,160,32,0.02); color: #D4CFC3; }
        .rp-table-footer {
          padding: 12px 16px; text-align: center;
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; color: #4A4438;
          border-top: 1px solid #2E2A22;
        }

        /* Status badges in table */
        .rp-badge {
          display: inline-block; padding: 2px 8px; border-radius: 4px;
          font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 500;
        }
      `}</style>

      <div className="rp-root">

        {/* Header */}
        <div className="rp-header">
          <p className="rp-eyebrow">Admin · Analytics</p>
          <h1 className="rp-title">Reports</h1>
          <p className="rp-sub">Generate and export platform analytics.</p>
        </div>

        {/* Date range */}
        <div className="rp-ranges">
          {RANGES.map(r => (
            <button
              key={r.key}
              className={`rp-range-btn ${range === r.key ? 'active' : 'inactive'}`}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Report type grid */}
        <div className="rp-grid">
          {(Object.entries(REPORTS) as [ReportType, typeof REPORTS[ReportType]][]).map(([key, cfg]) => (
            <button
              key={key}
              className={`rp-type-btn ${selected === key ? 'active' : ''}`}
              onClick={() => { setSelected(key); generate(key); }}
            >
              {selected === key && <div className="rp-type-active-dot" />}
              <p className="rp-type-mono">{cfg.mono}</p>
              <p className="rp-type-label">{cfg.label}</p>
              <p className="rp-type-desc">{cfg.desc}</p>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="rp-loading">
            <p className="rp-loading-label">Generating report...</p>
          </div>
        )}

        {/* Result */}
        {data && !loading && (
          <div className="rp-result">

            {/* Header row */}
            <div className="rp-result-head">
              <div>
                <p className="rp-result-title">{REPORTS[data.type as ReportType]?.label}</p>
                <p className="rp-result-meta">
                  Generated {new Date(data.generatedAt).toLocaleString()} · {range === 'all' ? 'All time' : `Last ${range.replace('d', ' days')}`}
                </p>
              </div>
              <div className="rp-export-row">
                {data.rows?.length > 0 && (
                  <button onClick={exportCSV} className="rp-export-btn primary">Export CSV</button>
                )}
                <button onClick={exportJSON} className="rp-export-btn">Export JSON</button>
              </div>
            </div>

            {/* Summary stats */}
            {data.summary && (
              <div className="rp-summary">
                {Object.entries(data.summary).map(([key, val]) => (
                  <div key={key} className="rp-stat">
                    <p className="rp-stat-label">{key}</p>
                    <p className="rp-stat-value">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Data table */}
            {data.rows?.length > 0 && data.columns && (
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      {data.columns.map((c: string) => (
                        <th key={c}>{c.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 100).map((row: any, i: number) => (
                      <tr key={i}>
                        {data.columns.map((c: string) => {
                          const raw = row[c];
                          const val = raw === null || raw === undefined ? '—'
                            : typeof raw === 'object' ? JSON.stringify(raw).slice(0, 40)
                            : String(raw).slice(0, 50);

                          // Status badge colouring
                          if (c === 'subscription_status' || c === 'status') {
                            const isActive = ['active', 'subscribed', 'rewarded', 'success'].includes(val);
                            return (
                              <td key={c}>
                                <span className="rp-badge" style={{
                                  background: val === '—' ? 'transparent'
                                    : isActive ? 'rgba(20,184,166,0.1)' : 'rgba(74,68,56,0.3)',
                                  color: val === '—' ? '#4A4438'
                                    : isActive ? '#14B8A6' : '#7A7260',
                                }}>
                                  {val}
                                </span>
                              </td>
                            );
                          }

                          return <td key={c}>{val}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.rows.length > 100 && (
                  <div className="rp-table-footer">
                    Showing 100 of {data.rows.length} rows · Export for full dataset
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </>
  );
}
