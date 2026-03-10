'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ADMIN COMMUNITY INTEL — /admin/community-intel
// AI-powered analysis of user onboarding data to surface
// cohort/community recommendations for admin to act on.
//
// Flow:
//  1. Fetch all completed-onboarding profiles + their goals
//  2. Send a structured summary to Claude (Anthropic API)
//  3. Claude returns JSON: clusters of users + recommended
//     community names, descriptions, rationale, size estimate
//  4. Admin reviews, edits name/desc, then clicks
//     "Create Community" → inserts into cohorts table
// ============================================================

interface ProfileRow {
  id: string;
  full_name: string | null;
  current_role: string | null;
  industry: string | null;
  goal_role: string | null;
  biggest_challenge: string | null;
  time_commitment: string | null;
  created_at: string;
}

interface GoalRow {
  user_id: string;
  goal_text: string;
}

interface CommunityRec {
  id: string; // ephemeral client-side id
  name: string;
  description: string;
  category: string;
  icon: string;
  rationale: string;
  estimated_members: number;
  user_ids: string[];
  tags: string[];
  // editing state
  editing: boolean;
}

interface AnalysisResult {
  total_users_analysed: number;
  summary: string;
  recommendations: CommunityRec[];
}

// ── Brand tokens ────────────────────────────────────────────────
const B = {
  gold:       '#E8A020',
  goldMuted:  'rgba(232,160,32,0.08)',
  goldBorder: 'rgba(232,160,32,0.20)',
  teal:       '#14B8A6',
  purple:     '#8B5CF6',
  green:      '#22C55E',
  red:        '#EF4444',
  fontMono:   "'DM Mono', monospace",
  fontUI:     "'Syne', system-ui, sans-serif",
  fontDisplay:"'Cormorant Garamond', Georgia, serif",
};

const CARD: React.CSSProperties = {
  background: 'var(--admin-bg-deep)',
  border: '1px solid var(--admin-bg-input)',
  borderRadius: 12,
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 13px', borderRadius: 8,
  border: '1px solid var(--admin-bg-input)',
  background: 'var(--admin-bg-card)',
  color: 'var(--admin-text)', fontSize: 13,
  fontFamily: B.fontUI, outline: 'none', boxSizing: 'border-box',
};

const MONO_LABEL: React.CSSProperties = {
  fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'var(--admin-text-faint)',
  display: 'block', marginBottom: 5,
};

const CATEGORY_ICON: Record<string, string> = {
  Technology: 'code', Finance: 'money', Leadership: 'target',
  Entrepreneurship: 'rocket', Consulting: 'chart',
  'Career Growth': 'fire', Executive: 'bulb', Diversity: 'globe',
  Other: 'users',
};

const CATEGORY_COLOR: Record<string, string> = {
  Technology: B.teal, Finance: B.gold, Leadership: B.purple,
  Entrepreneurship: B.gold, Consulting: B.purple,
  'Career Growth': B.teal, Executive: B.purple, Diversity: B.green,
  Other: B.gold,
};

// ── Spinner ──────────────────────────────────────────────────────
function Spinner({ size = 22 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid var(--admin-bg-input)`,
      borderTopColor: B.gold,
      animation: 'asc-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ── Tag pill ─────────────────────────────────────────────────────
function Tag({ text, color = B.gold }: { text: string; color?: string }) {
  return (
    <span style={{
      fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.1em',
      textTransform: 'uppercase', color,
      padding: '2px 8px',
      background: `${color}12`,
      border: `1px solid ${color}28`,
      borderRadius: 100, whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

// ══════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════
export default function CommunityIntelPage() {
  const supabase = createClient();

  const [profiles,    setProfiles]    = useState<ProfileRow[]>([]);
  const [goals,       setGoals]       = useState<GoalRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [analysing,   setAnalysing]   = useState(false);
  const [result,      setResult]      = useState<AnalysisResult | null>(null);
  const [error,       setError]       = useState('');
  const [creating,    setCreating]    = useState<Record<string, boolean>>({});
  const [created,     setCreated]     = useState<Record<string, boolean>>({});
  const [globalMsg,   setGlobalMsg]   = useState('');

  // ── Load user data ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, current_role, industry, goal_role, biggest_challenge, time_commitment, created_at')
      .eq('onboarding_completed', true)
      .order('created_at', { ascending: false });

    const { data: goalData } = await supabase
      .from('user_goals')
      .select('user_id, goal_text');

    setProfiles(profileData || []);
    setGoals(goalData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Build prompt payload ───────────────────────────────────────
  function buildPrompt(profiles: ProfileRow[], goals: GoalRow[]): string {
    const goalMap: Record<string, string> = {};
    goals.forEach(g => { goalMap[g.user_id] = g.goal_text; });

    const userSummaries = profiles.map(p => ({
      current_role:       p.current_role || 'Unknown',
      industry:           p.industry || 'Unknown',
      goal_role:          p.goal_role || 'Unknown',
      biggest_challenge:  p.biggest_challenge || 'None specified',
      time_commitment:    p.time_commitment || 'Unknown',
      goal_text:          goalMap[p.id] || 'No goal set',
    }));

    return `You are an expert community strategist for Ascentor — an AI-powered leadership development platform for African professionals.

Analyse the following ${profiles.length} user profiles from our onboarding data and recommend the BEST communities (cohorts) to create that would serve meaningful clusters of these users.

USER PROFILES:
${JSON.stringify(userSummaries, null, 2)}

Your task:
1. Identify 3–6 distinct clusters of users with shared career stage, industry, goals, or challenges
2. For each cluster, recommend a community with a compelling name and description
3. Be specific to the African professional context — acknowledge real career paths in Africa
4. Communities should feel aspirational, peer-driven, and actionable

Respond ONLY with a valid JSON object — no markdown, no preamble:
{
  "total_users_analysed": <number>,
  "summary": "<2-3 sentence overview of the user base patterns you noticed>",
  "recommendations": [
    {
      "id": "<unique_slug like tech-founders-01>",
      "name": "<compelling community name, max 5 words>",
      "description": "<1–2 sentence description of who this is for and what value they get>",
      "category": "<one of: Technology, Finance, Leadership, Entrepreneurship, Consulting, Career Growth, Executive, Diversity, Other>",
      "icon": "<one of: users, code, money, bank, rocket, globe, target, chart, fire, bulb>",
      "rationale": "<1 sentence explaining WHY you're recommending this based on the data>",
      "estimated_members": <number of users from the data likely to fit>,
      "user_ids": [],
      "tags": ["<tag1>", "<tag2>", "<tag3>"],
      "editing": false
    }
  ]
}`;
  }

  // ── Run AI analysis ────────────────────────────────────────────
  async function runAnalysis() {
    if (profiles.length < 2) {
      setError('Need at least 2 completed onboarding profiles to analyse.');
      return;
    }
    setAnalysing(true);
    setError('');
    setResult(null);

    try {
      const prompt = buildPrompt(profiles, goals);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'API error');

      const text = data.content
        ?.filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('') || '';

      // Strip any accidental markdown fences
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed: AnalysisResult = JSON.parse(clean);

      // Assign ephemeral IDs if missing
      parsed.recommendations = parsed.recommendations.map((r, i) => ({
        ...r,
        id: r.id || `rec-${i}`,
        editing: false,
      }));

      setResult(parsed);
    } catch (e: any) {
      setError(e?.message || 'Analysis failed. Please try again.');
    }
    setAnalysing(false);
  }

  // ── Update a recommendation field ─────────────────────────────
  function updateRec(id: string, field: keyof CommunityRec, value: any) {
    if (!result) return;
    setResult({
      ...result,
      recommendations: result.recommendations.map(r =>
        r.id === id ? { ...r, [field]: value } : r
      ),
    });
  }

  // ── Create community in Supabase ───────────────────────────────
  async function createCommunity(rec: CommunityRec) {
    setCreating(c => ({ ...c, [rec.id]: true }));
    const { data: { user } } = await supabase.auth.getUser();

    const { error: err } = await supabase.from('cohorts').insert({
      name:         rec.name.trim(),
      description:  rec.description.trim(),
      category:     rec.category,
      icon:         CATEGORY_ICON[rec.category] || 'users',
      is_public:    true,
      member_count: 0,
      created_by:   user?.id || null,
    });

    if (err) {
      setGlobalMsg(`Error creating "${rec.name}": ${err.message}`);
    } else {
      setCreated(c => ({ ...c, [rec.id]: true }));
      setGlobalMsg(`"${rec.name}" created successfully! View it in Cohorts.`);
      setTimeout(() => setGlobalMsg(''), 4000);
    }
    setCreating(c => ({ ...c, [rec.id]: false }));
  }

  // ── Stats ──────────────────────────────────────────────────────
  const industryBreakdown = profiles.reduce<Record<string, number>>((acc, p) => {
    const k = p.industry || 'Unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const topIndustries = Object.entries(industryBreakdown)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ animation: 'asc-fade-up 0.35s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes asc-spin { to { transform: rotate(360deg); } }
        @keyframes asc-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        input:focus, textarea:focus, select:focus { border-color: rgba(232,160,32,0.5) !important; }
        .rec-card { transition: border-color 0.2s; }
        .rec-card:hover { border-color: rgba(232,160,32,0.25) !important; }
        .create-btn:hover:not(:disabled) { background: #E8A020 !important; color: #0C0B08 !important; }
        select option { background: var(--admin-bg-card); color: var(--admin-text); }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: B.fontDisplay, fontSize: 28, fontWeight: 700, color: 'var(--admin-text-heading)', margin: 0 }}>
            Community Intelligence
          </h1>
          <p style={{ fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginTop: 4 }}>
            AI analysis of user profiles → cohort recommendations
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analysing || loading || profiles.length < 2}
          style={{
            padding: '10px 22px', borderRadius: 9, border: 'none',
            background: analysing ? 'var(--admin-bg-input)' : B.gold,
            color: analysing ? 'var(--admin-text-muted)' : '#0C0B08',
            fontFamily: B.fontUI, fontWeight: 700, fontSize: 13,
            cursor: (analysing || loading || profiles.length < 2) ? 'not-allowed' : 'pointer',
            opacity: (loading || profiles.length < 2) ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {analysing ? <><Spinner size={14} /> Analysing…</> : '✦ Run AI Analysis'}
        </button>
      </div>

      {/* ── Global message ──────────────────────────────────────── */}
      {globalMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: globalMsg.startsWith('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${globalMsg.startsWith('Error') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
          color: globalMsg.startsWith('Error') ? B.red : B.green,
          fontFamily: B.fontMono, fontSize: 11, letterSpacing: '0.06em',
        }}>{globalMsg}</div>
      )}

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: B.red, fontFamily: B.fontMono, fontSize: 11, letterSpacing: '0.06em',
        }}>{error}</div>
      )}

      {/* ── Stats row ───────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}><Spinner /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Users', value: profiles.length, color: B.gold },
              { label: 'With Goals Set', value: goals.length, color: B.teal },
              { label: 'Industries', value: Object.keys(industryBreakdown).length, color: B.purple },
              { label: 'Top Industry', value: topIndustries[0]?.[0] || '—', color: B.green, small: true },
            ].map(stat => (
              <div key={stat.label} style={{ ...CARD, padding: '16px 18px' }}>
                <p style={{ ...MONO_LABEL, marginBottom: 8 }}>{stat.label}</p>
                <p style={{
                  fontFamily: stat.small ? B.fontUI : B.fontDisplay,
                  fontSize: stat.small ? 14 : 28,
                  fontWeight: 700, color: stat.color, margin: 0,
                }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* ── Industry breakdown ──────────────────────────────── */}
          <div style={{ ...CARD, padding: '18px 20px', marginBottom: 24 }}>
            <p style={MONO_LABEL}>User breakdown by industry</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {topIndustries.map(([industry, count]) => (
                <div key={industry} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'var(--admin-bg-card)',
                  border: '1px solid var(--admin-bg-input)',
                }}>
                  <span style={{ fontFamily: B.fontUI, fontSize: 12, color: 'var(--admin-text)' }}>{industry}</span>
                  <span style={{
                    fontFamily: B.fontMono, fontSize: 10, color: B.gold,
                    background: B.goldMuted, border: `1px solid ${B.goldBorder}`,
                    padding: '1px 7px', borderRadius: 100,
                  }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Analysing state ─────────────────────────────────── */}
          {analysing && (
            <div style={{ ...CARD, padding: '48px 24px', textAlign: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <Spinner size={32} />
              </div>
              <p style={{ fontFamily: B.fontDisplay, fontSize: 20, color: 'var(--admin-text-heading)', margin: '0 0 8px' }}>
                Analysing {profiles.length} user profiles…
              </p>
              <p style={{ fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.1em', color: 'var(--admin-text-faint)', margin: 0, textTransform: 'uppercase' }}>
                Claude is clustering users by career stage, industry, and goals
              </p>
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────── */}
          {result && !analysing && (
            <div>
              {/* Summary */}
              <div style={{ ...CARD, padding: '18px 22px', marginBottom: 24, borderColor: B.goldBorder }}>
                <p style={{ ...MONO_LABEL, color: B.gold }}>AI Analysis Summary</p>
                <p style={{ fontFamily: B.fontUI, fontSize: 14, color: 'var(--admin-text)', lineHeight: 1.75, margin: '8px 0 12px' }}>
                  {result.summary}
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-faint)' }}>
                    {result.total_users_analysed} users analysed
                  </span>
                  <span style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-faint)' }}>
                    {result.recommendations.length} communities recommended
                  </span>
                  <span style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-faint)' }}>
                    {result.recommendations.filter(r => created[r.id]).length} created so far
                  </span>
                </div>
              </div>

              {/* Recommendation cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {result.recommendations.map((rec, idx) => {
                  const color = CATEGORY_COLOR[rec.category] || B.gold;
                  const isCreated  = created[rec.id];
                  const isCreating = creating[rec.id];

                  return (
                    <div
                      key={rec.id}
                      className="rec-card"
                      style={{
                        ...CARD,
                        border: isCreated
                          ? `1px solid rgba(34,197,94,0.35)`
                          : `1px solid var(--admin-bg-input)`,
                        opacity: isCreated ? 0.75 : 1,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Card header */}
                      <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--admin-bg-input)',
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', gap: 12,
                      }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
                          {/* Index */}
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            background: `${color}14`, border: `1px solid ${color}28`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: B.fontMono, fontSize: 11, color, fontWeight: 500,
                          }}>
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          <div style={{ flex: 1 }}>
                            {rec.editing ? (
                              <input
                                value={rec.name}
                                onChange={e => updateRec(rec.id, 'name', e.target.value)}
                                style={{ ...INPUT, fontSize: 16, fontWeight: 700, fontFamily: B.fontDisplay, marginBottom: 4 }}
                              />
                            ) : (
                              <p style={{ fontFamily: B.fontDisplay, fontSize: 20, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 4px' }}>
                                {rec.name}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <Tag text={rec.category} color={color} />
                              <Tag text={`~${rec.estimated_members} members`} color="var(--admin-text-faint)" />
                              {rec.tags?.map(t => <Tag key={t} text={t} color="var(--admin-text-faint)" />)}
                              {isCreated && <Tag text="✓ Created" color={B.green} />}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => updateRec(rec.id, 'editing', !rec.editing)}
                            disabled={isCreated}
                            style={{
                              padding: '5px 12px', borderRadius: 6, fontSize: 11,
                              border: '1px solid var(--admin-bg-input)',
                              background: 'transparent', color: 'var(--admin-text-muted)',
                              fontFamily: B.fontMono, cursor: 'pointer',
                              opacity: isCreated ? 0.4 : 1,
                            }}
                          >
                            {rec.editing ? 'Done' : 'Edit'}
                          </button>
                          <button
                            className="create-btn"
                            onClick={() => createCommunity(rec)}
                            disabled={isCreated || isCreating || rec.editing}
                            style={{
                              padding: '5px 14px', borderRadius: 6, fontSize: 11,
                              border: `1px solid ${isCreated ? 'rgba(34,197,94,0.3)' : `${color}40`}`,
                              background: 'transparent',
                              color: isCreated ? B.green : color,
                              fontFamily: B.fontUI, fontWeight: 700,
                              cursor: (isCreated || isCreating || rec.editing) ? 'not-allowed' : 'pointer',
                              opacity: (isCreated || rec.editing) ? 0.6 : 1,
                              display: 'flex', alignItems: 'center', gap: 6,
                              transition: 'background 0.15s, color 0.15s',
                            }}
                          >
                            {isCreating ? <><Spinner size={11} /> Creating…</> :
                             isCreated  ? '✓ Created' : '+ Create Community'}
                          </button>
                        </div>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Description */}
                        <div>
                          <span style={MONO_LABEL}>Description</span>
                          {rec.editing ? (
                            <textarea
                              value={rec.description}
                              onChange={e => updateRec(rec.id, 'description', e.target.value)}
                              rows={3}
                              style={{ ...INPUT, resize: 'vertical', lineHeight: 1.7 }}
                            />
                          ) : (
                            <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text)', lineHeight: 1.75, margin: 0 }}>
                              {rec.description}
                            </p>
                          )}
                        </div>

                        {/* Category (editable) */}
                        {rec.editing && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                              <span style={MONO_LABEL}>Category</span>
                              <select
                                value={rec.category}
                                onChange={e => updateRec(rec.id, 'category', e.target.value)}
                                style={{ ...INPUT, cursor: 'pointer' }}
                              >
                                {['Technology', 'Finance', 'Leadership', 'Entrepreneurship', 'Consulting', 'Career Growth', 'Executive', 'Diversity', 'Other'].map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span style={MONO_LABEL}>Est. Members</span>
                              <input
                                type="number"
                                value={rec.estimated_members}
                                onChange={e => updateRec(rec.id, 'estimated_members', Number(e.target.value))}
                                style={INPUT}
                              />
                            </div>
                          </div>
                        )}

                        {/* AI rationale */}
                        <div style={{
                          padding: '10px 14px', borderRadius: 8,
                          background: `${color}08`, border: `1px solid ${color}18`,
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}>
                          <span style={{ color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✦</span>
                          <p style={{ fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.04em', color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.7 }}>
                            <strong style={{ color, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 9 }}>AI Rationale: </strong>
                            {rec.rationale}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Run again */}
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <button
                  onClick={runAnalysis}
                  style={{
                    padding: '10px 24px', borderRadius: 8,
                    border: '1px solid var(--admin-bg-input)',
                    background: 'transparent', color: 'var(--admin-text-muted)',
                    fontFamily: B.fontMono, fontSize: 10, letterSpacing: '0.1em',
                    textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >
                  ↺ Re-run Analysis
                </button>
              </div>
            </div>
          )}

          {/* ── Empty state ─────────────────────────────────────── */}
          {!result && !analysing && profiles.length >= 2 && (
            <div style={{ ...CARD, padding: '56px 24px', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
                background: B.goldMuted, border: `1px solid ${B.goldBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>✦</div>
              <p style={{ fontFamily: B.fontDisplay, fontSize: 22, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 8px' }}>
                Ready to analyse {profiles.length} users
              </p>
              <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text-muted)', margin: '0 0 24px' }}>
                Click "Run AI Analysis" to cluster your users by career stage, industry, and goals — then get community recommendations you can create in one click.
              </p>
              <button
                onClick={runAnalysis}
                style={{
                  padding: '11px 28px', borderRadius: 9, border: 'none',
                  background: B.gold, color: '#0C0B08',
                  fontFamily: B.fontUI, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                ✦ Run AI Analysis
              </button>
            </div>
          )}

          {/* ── Not enough users ────────────────────────────────── */}
          {profiles.length < 2 && (
            <div style={{ ...CARD, padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: B.fontDisplay, fontSize: 20, color: 'var(--admin-text-heading)', margin: '0 0 8px' }}>
                Not enough data yet
              </p>
              <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text-muted)', margin: 0 }}>
                Need at least 2 users who have completed onboarding. You currently have {profiles.length}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
