'use client';
// app/admin/intelligence/page.tsx
// Central Intelligence — on-demand AI analysis of all platform data
// Claude analyzes: coach sessions, community chats, signups, logins,
// subscriptions, content performance, survey responses, referrals
// NO auto-analysis. Admin clicks Analyze. Results stream in.

import { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const G = '#E8A020';
const mono: React.CSSProperties = { fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:'0.09em', textTransform:'uppercase' as const, color:'var(--admin-text-faint)' };
const card: React.CSSProperties = { background:'var(--admin-bg-deep)', border:'1px solid var(--admin-bg-input)', borderRadius:12 };
const inp: React.CSSProperties  = { padding:'9px 13px', borderRadius:8, border:'1px solid var(--admin-bg-input)', background:'var(--admin-bg-card)', color:'var(--admin-text)', fontSize:13, fontFamily:"'Syne',sans-serif", outline:'none' };

const REPORT_TYPES = [
  {
    id: 'platform_overview',
    label: 'Platform Overview',
    icon: '🏛',
    description: 'Signups, logins, DAU/MAU, retention, plan distribution',
    dataFns: ['getSignupStats', 'getLoginStats', 'getPlanStats'],
  },
  {
    id: 'coaching_deep_dive',
    label: 'Coaching Analysis',
    icon: '🧠',
    description: 'Session types, avg depth, themes, drop-off points, user progress',
    dataFns: ['getCoachingStats'],
  },
  {
    id: 'community_health',
    label: 'Community Health',
    icon: '💬',
    description: 'Message volume, top channels, engagement patterns, reaction sentiment',
    dataFns: ['getCommunityStats'],
  },
  {
    id: 'revenue_intelligence',
    label: 'Revenue Intelligence',
    icon: '💰',
    description: 'MRR, plan upgrades/downgrades, churn signals, LTV patterns',
    dataFns: ['getRevenueStats'],
  },
  {
    id: 'user_behaviour',
    label: 'User Behaviour',
    icon: '👤',
    description: 'Top engaged users, role distribution, industry breakdown, referral ROI',
    dataFns: ['getUserBehaviourStats'],
  },
  {
    id: 'content_performance',
    label: 'Content Performance',
    icon: '📊',
    description: 'Blog reads, video plays, newsletter opens, content-to-coach conversion',
    dataFns: ['getContentStats'],
  },
  {
    id: 'survey_insights',
    label: 'Survey Insights',
    icon: '📋',
    description: 'Survey completion rates, NPS trends, open-ended theme extraction',
    dataFns: ['getSurveyStats'],
  },
  {
    id: 'custom',
    label: 'Custom Question',
    icon: '✏️',
    description: 'Ask Claude anything about your platform data',
    dataFns: [],
  },
];

// ── Data fetchers — pull raw platform data from Supabase ─────────────────────
async function fetchPlatformData(supabase: any, reportId: string, dateRange: { from: string; to: string }) {
  const from = dateRange.from;
  const to = dateRange.to;
  const data: Record<string, any> = {};

  if (['platform_overview', 'user_behaviour'].includes(reportId)) {
    const [signups, logins, plans] = await Promise.all([
      supabase.from('profiles').select('created_at, role, subscription_plan, current_role, industry').gte('created_at', from).lte('created_at', to),
      supabase.from('profiles').select('last_sign_in, created_at').not('last_sign_in', 'is', null),
      supabase.from('profiles').select('subscription_plan, subscription_status, role').not('id', 'is', null),
    ]);
    data.signups = signups.data || [];
    data.logins  = logins.data || [];
    data.plans   = plans.data || [];
  }

  if (['coaching_deep_dive', 'platform_overview'].includes(reportId)) {
    const { data: sessions } = await supabase
      .from('coaching_sessions')
      .select('user_id, session_type, created_at, message_count, ai_response')
      .gte('created_at', from).lte('created_at', to)
      .limit(500);
    data.coachingSessions = sessions || [];
  }

  if (['community_health', 'platform_overview'].includes(reportId)) {
    const [msgs, reactions] = await Promise.all([
      supabase.from('community_messages').select('channel, created_at, user_id, likes, deleted').gte('created_at', from).lte('created_at', to).eq('deleted', false).limit(2000),
      supabase.from('community_messages').select('likes, channel').not('likes', 'eq', '[]').limit(1000),
    ]);
    data.communityMessages = msgs.data || [];
    data.communityReactions = reactions.data || [];
  }

  if (['revenue_intelligence'].includes(reportId)) {
    const { data: subs } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end, created_at')
      .not('subscription_plan', 'is', null);
    data.subscriptions = subs || [];
  }

  if (['survey_insights'].includes(reportId)) {
    const { data: surveys } = await supabase
      .from('survey_responses')
      .select('*')
      .gte('created_at', from).lte('created_at', to)
      .limit(300);
    data.surveys = surveys || [];
  }

  if (['content_performance'].includes(reportId)) {
    const { data: content } = await supabase
      .from('content_posts')
      .select('title, view_count, created_at, content_type')
      .order('view_count', { ascending: false })
      .limit(50);
    data.content = content || [];
  }

  return data;
}

// ── Summarise raw data for prompt (keep tokens manageable) ───────────────────
function summariseData(data: Record<string, any>, reportId: string): string {
  const lines: string[] = [];

  if (data.signups) {
    const total = data.signups.length;
    const byPlan: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    data.signups.forEach((u: any) => {
      byPlan[u.subscription_plan || 'free'] = (byPlan[u.subscription_plan || 'free'] || 0) + 1;
      byRole[u.role || 'member']            = (byRole[u.role || 'member']            || 0) + 1;
    });
    lines.push(`SIGNUPS (in range): ${total}`);
    lines.push(`Plan distribution: ${JSON.stringify(byPlan)}`);
    lines.push(`Role distribution: ${JSON.stringify(byRole)}`);
  }

  if (data.plans) {
    const total = data.plans.length;
    const active = data.plans.filter((p: any) => p.subscription_status === 'active').length;
    const byPlan: Record<string, number> = {};
    data.plans.forEach((p: any) => { byPlan[p.subscription_plan || 'free'] = (byPlan[p.subscription_plan || 'free'] || 0) + 1; });
    lines.push(`TOTAL USERS: ${total}, Active paid: ${active}`);
    lines.push(`All-time plan breakdown: ${JSON.stringify(byPlan)}`);
  }

  if (data.coachingSessions) {
    const total = data.coachingSessions.length;
    const byType: Record<string, number> = {};
    let totalMsgs = 0;
    data.coachingSessions.forEach((s: any) => {
      byType[s.session_type || 'unknown'] = (byType[s.session_type || 'unknown'] || 0) + 1;
      totalMsgs += s.message_count || 0;
    });
    lines.push(`COACHING SESSIONS: ${total}, Avg messages: ${total ? (totalMsgs/total).toFixed(1) : 0}`);
    lines.push(`Session type breakdown: ${JSON.stringify(byType)}`);
  }

  if (data.communityMessages) {
    const total = data.communityMessages.length;
    const byChannel: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    data.communityMessages.forEach((m: any) => {
      byChannel[m.channel] = (byChannel[m.channel] || 0) + 1;
      uniqueUsers.add(m.user_id);
    });
    lines.push(`COMMUNITY MESSAGES: ${total} from ${uniqueUsers.size} unique users`);
    lines.push(`Messages per channel: ${JSON.stringify(byChannel)}`);
  }

  if (data.subscriptions) {
    const byStatus: Record<string, number> = {};
    data.subscriptions.forEach((s: any) => { byStatus[s.subscription_status || 'unknown'] = (byStatus[s.subscription_status || 'unknown'] || 0) + 1; });
    lines.push(`SUBSCRIPTION STATUSES: ${JSON.stringify(byStatus)}`);
  }

  if (data.surveys) {
    lines.push(`SURVEY RESPONSES: ${data.surveys.length}`);
  }

  if (data.content) {
    const top5 = data.content.slice(0, 5).map((c: any) => `"${c.title}" (${c.view_count || 0} views)`);
    lines.push(`TOP CONTENT: ${top5.join(', ')}`);
  }

  return lines.join('\n');
}

interface AnalysisResult {
  id: string;
  reportType: string;
  label: string;
  dateRange: string;
  content: string;
  streaming: boolean;
  createdAt: string;
}

export default function AdminIntelligencePage() {
  const supabase = createClient();
  const [reportType,   setReportType]   = useState('platform_overview');
  const [dateFrom,     setDateFrom]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo,       setDateTo]       = useState(() => new Date().toISOString().split('T')[0]);
  const [customQ,      setCustomQ]      = useState('');
  const [analysing,    setAnalysing]    = useState(false);
  const [results,      setResults]      = useState<AnalysisResult[]>([]);
  const [fetchStatus,  setFetchStatus]  = useState('');
  const streamRef = useRef<string>('');

  const selectedReport = REPORT_TYPES.find(r => r.id === reportType)!;

  const runAnalysis = useCallback(async () => {
    if (analysing) return;
    setAnalysing(true);
    setFetchStatus('Fetching platform data…');

    const resultId = `result-${Date.now()}`;
    const newResult: AnalysisResult = {
      id: resultId,
      reportType,
      label: selectedReport.label,
      dateRange: `${dateFrom} → ${dateTo}`,
      content: '',
      streaming: true,
      createdAt: new Date().toISOString(),
    };
    setResults(prev => [newResult, ...prev]);
    streamRef.current = '';

    try {
      // 1. Fetch raw data
      const rawData = await fetchPlatformData(supabase, reportType, { from: dateFrom, to: dateTo });
      const summary = summariseData(rawData, reportType);
      setFetchStatus('Data ready — Claude is analyzing…');

      // 2. Build prompt
      const question = reportType === 'custom' && customQ
        ? customQ
        : `Provide a comprehensive ${selectedReport.label} analysis. Include: key insights, trends, risks, actionable recommendations. Be specific, data-driven, and strategic. Format with clear sections.`;

      const systemPrompt = `You are the AI Intelligence engine for Ascentor, an AI-powered career coaching platform for purposeful individuals. You analyze platform data and provide strategic insights to the admin team. Be concise, specific, and actionable. Use markdown with headers (##), bullet points, and bold for emphasis. Focus on what matters most for growing the platform.`;

      const userPrompt = `REPORT TYPE: ${selectedReport.label}
DATE RANGE: ${dateFrom} to ${dateTo}

PLATFORM DATA SUMMARY:
${summary}

QUESTION/FOCUS:
${question}

Analyze this data and provide strategic insights.`;

      // 3. Stream from Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok || !response.body) throw new Error('API call failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === 'content_block_delta' && evt.delta?.text) {
                streamRef.current += evt.delta.text;
                setResults(prev => prev.map(r =>
                  r.id === resultId ? { ...r, content: streamRef.current } : r
                ));
              }
            } catch { /* skip */ }
          }
        }
      }

      setResults(prev => prev.map(r => r.id === resultId ? { ...r, streaming: false } : r));
      setFetchStatus('');
    } catch (err: any) {
      console.error('Intelligence error:', err);
      setResults(prev => prev.map(r =>
        r.id === resultId ? { ...r, content: `Error: ${err.message}`, streaming: false } : r
      ));
      setFetchStatus('');
    }
    setAnalysing(false);
  }, [analysing, reportType, dateFrom, dateTo, customQ, selectedReport, supabase]);

  function clearResult(id: string) {
    setResults(prev => prev.filter(r => r.id !== id));
  }

  // Simple markdown renderer
  function renderMarkdown(text: string) {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:'var(--admin-text-heading)', margin:'18px 0 8px', borderBottom:'1px solid var(--admin-bg-input)', paddingBottom:6 }}>{line.slice(3)}</h3>;
      if (line.startsWith('### ')) return <h4 key={i} style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:G, margin:'14px 0 6px' }}>{line.slice(4)}</h4>;
      if (line.startsWith('- ') || line.startsWith('• ')) return (
        <div key={i} style={{ display:'flex', gap:8, margin:'4px 0', paddingLeft:4 }}>
          <span style={{ color:G, flexShrink:0, marginTop:2 }}>▸</span>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'var(--admin-text-muted)', lineHeight:1.6 }}>
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, '**$1**')}
          </span>
        </div>
      );
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:'var(--admin-text)', margin:'8px 0 2px' }}>{line.slice(2,-2)}</p>;
      if (!line.trim()) return <div key={i} style={{ height:8 }} />;
      // Bold inline
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'var(--admin-text-muted)', lineHeight:1.7, margin:'2px 0' }}>
          {parts.map((part, pi) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={pi} style={{ color:'var(--admin-text)', fontWeight:700 }}>{part.slice(2,-2)}</strong>
              : part
          )}
        </p>
      );
    });
  }

  return (
    <div style={{ maxWidth:1200, margin:'0 auto' }}>
      <style>{`
        @keyframes asc-spin { to { transform:rotate(360deg); } }
        @keyframes asc-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .report-card:hover { border-color:rgba(232,160,32,0.4) !important; }
        .report-card.selected { border-color:${G} !important; background:rgba(232,160,32,0.06) !important; }
        .asc-input:focus { border-color:${G} !important; }
        * { box-sizing:border-box; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, color:'var(--admin-text-heading)', margin:0, marginBottom:8 }}>
          Intelligence Center
        </h1>
        <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14, color:'var(--admin-text-faint)', margin:0, lineHeight:1.6 }}>
          On-demand AI analysis of all platform data. Select a report type, set your date range, and run analysis when you're ready. No automatic reports.
        </p>
      </div>

      {/* ── CONTROLS ─────────────────────────────────────────────────────── */}
      <div style={{ ...card, padding:24, marginBottom:24 }}>
        <div style={{ ...mono, marginBottom:16 }}>Configure Analysis</div>

        {/* Report type grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10, marginBottom:20 }}>
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              className={`report-card ${reportType === r.id ? 'selected' : ''}`}
              onClick={() => setReportType(r.id)}
              style={{ padding:'12px 14px', borderRadius:10, border:'1px solid var(--admin-bg-input)', background:'var(--admin-bg-card)', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
            >
              <div style={{ fontSize:20, marginBottom:6 }}>{r.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, color:'var(--admin-text)', marginBottom:3, lineHeight:1.3 }}>{r.label}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:'var(--admin-text-faint)', lineHeight:1.4 }}>{r.description}</div>
            </button>
          ))}
        </div>

        {/* Custom question textarea */}
        {reportType === 'custom' && (
          <textarea
            value={customQ}
            onChange={e => setCustomQ(e.target.value)}
            placeholder="What would you like to know about your platform? E.g. 'Which users are most at risk of churning and why?'"
            className="asc-input"
            rows={3}
            style={{ ...inp, width:'100%', resize:'vertical', marginBottom:16, lineHeight:1.6 }}
          />
        )}

        {/* Date range + run button */}
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <div style={{ ...mono, marginBottom:6 }}>Date from</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="asc-input" style={{ ...inp }} />
          </div>
          <div>
            <div style={{ ...mono, marginBottom:6 }}>Date to</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="asc-input" style={{ ...inp }} />
          </div>
          <button
            onClick={runAnalysis}
            disabled={analysing || (reportType === 'custom' && !customQ.trim())}
            style={{
              padding:'10px 28px', borderRadius:10, border:'none',
              background: analysing ? 'var(--admin-bg-input)' : G,
              color: analysing ? 'var(--admin-text-faint)' : '#0C0B08',
              fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700,
              cursor: analysing ? 'default' : 'pointer',
              display:'flex', alignItems:'center', gap:10, transition:'all 0.15s',
            }}
          >
            {analysing ? (
              <>
                <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid var(--admin-text-faint)', borderTopColor:'var(--admin-text)', animation:'asc-spin 0.8s linear infinite' }} />
                Analyzing…
              </>
            ) : (
              <>
                <span style={{ fontSize:16 }}>⚡</span>
                Run Analysis
              </>
            )}
          </button>
          {fetchStatus && (
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:G, alignSelf:'center' }}>
              {fetchStatus}
            </div>
          )}
        </div>
      </div>

      {/* ── RESULTS ──────────────────────────────────────────────────────── */}
      {results.length === 0 && (
        <div style={{ ...card, padding:48, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>⚡</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:'var(--admin-text-heading)', marginBottom:8 }}>No analyses yet</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, color:'var(--admin-text-faint)', lineHeight:1.6, maxWidth:380, margin:'0 auto' }}>
            Select a report type above and click Run Analysis. Claude will fetch your platform data and generate strategic insights.
          </div>
        </div>
      )}

      {results.map(result => (
        <div key={result.id} style={{ ...card, padding:28, marginBottom:20 }}>
          {/* Result header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:700, color:'var(--admin-text-heading)' }}>
                  {REPORT_TYPES.find(r => r.id === result.reportType)?.icon} {result.label}
                </span>
                {result.streaming && (
                  <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:G, letterSpacing:'0.1em', textTransform:'uppercase', background:'rgba(232,160,32,0.1)', padding:'2px 8px', borderRadius:4, border:'1px solid rgba(232,160,32,0.2)' }}>
                    Streaming
                  </span>
                )}
              </div>
              <div style={{ ...mono, fontSize:9 }}>
                {result.dateRange} · {new Date(result.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              onClick={() => clearResult(result.id)}
              style={{ background:'none', border:'1px solid var(--admin-bg-input)', borderRadius:6, color:'var(--admin-text-faint)', cursor:'pointer', padding:'4px 10px', fontSize:12, fontFamily:"'DM Mono',monospace" }}
            >
              ✕ Clear
            </button>
          </div>

          {/* Divider */}
          <div style={{ height:1, background:'var(--admin-bg-input)', marginBottom:20 }} />

          {/* Analysis content */}
          <div style={{ minHeight:80 }}>
            {result.content ? (
              <>
                {renderMarkdown(result.content)}
                {result.streaming && (
                  <span style={{ display:'inline-block', width:10, height:16, background:G, marginLeft:2, animation:'asc-blink 1s ease infinite', verticalAlign:'text-bottom', borderRadius:1 }} />
                )}
              </>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:12, color:'var(--admin-text-faint)' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid var(--admin-bg-input)`, borderTopColor:G, animation:'asc-spin 0.8s linear infinite', flexShrink:0 }} />
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>Fetching data and initializing analysis…</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
