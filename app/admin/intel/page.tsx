'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ASCENTOR INTEL — /admin/intel
// Living Business Intelligence Command Center.
//
// Pulls real data from every major table, builds a rich
// structured snapshot, and sends it to Claude for continuous
// AI analysis. Surfaces insights across 6 domains:
//   1. Growth & Acquisition
//   2. Revenue & Monetisation
//   3. Engagement & Retention
//   4. Product Usage (Sage AI, Courses, Community)
//   5. User Behaviour & Personas
//   6. Operational Health
//
// Auto-refreshes every 5 minutes. Admin can also run on demand.
// ============================================================

// ── Types ─────────────────────────────────────────────────────
interface Metric { label: string; value: string | number; delta?: string; deltaUp?: boolean; color?: string; }
interface Insight { id: string; domain: string; severity: 'critical' | 'warning' | 'opportunity' | 'healthy'; title: string; body: string; action: string; }
interface AIReport { generated_at: string; headline: string; insights: Insight[]; community_recs: CommRec[]; top_priority: string; }
interface CommRec { name: string; rationale: string; estimated_size: number; category: string; }

interface RawData {
  // Growth
  total_users: number; new_7d: number; new_30d: number; prev_7d: number; prev_30d: number;
  onboarded: number; onboard_rate: number;
  waitlist: number; newsletter_subs: number;
  // Revenue
  paid_users: number; free_users: number; conversion_rate: number;
  total_revenue: number; revenue_7d: number; revenue_30d: number;
  plan_breakdown: Record<string, number>;
  active_promos: number;
  // Engagement
  coaching_sessions_7d: number; coaching_sessions_30d: number;
  unique_coaches_7d: number; avg_sessions_per_user: number;
  total_coaching_tokens: number;
  course_completions_7d: number; total_progress_records: number;
  community_posts_7d: number; community_members: number;
  expert_registrations_7d: number;
  // Behaviour
  industry_breakdown: Record<string, number>;
  challenge_breakdown: Record<string, number>;
  goal_role_breakdown: Record<string, number>;
  time_commitment_breakdown: Record<string, number>;
  avg_lead_score: number; hot_leads: number;
  // Operational
  audit_logs_7d: number; deletion_requests: number;
  mentor_applications_pending: number; job_applications_new: number;
  content_calendar_items: number; social_queue_pending: number;
  referral_total: number; referral_converted: number;
  // Cohorts
  total_cohorts: number; avg_cohort_size: number; total_cohort_members: number;
}

// ── Brand ─────────────────────────────────────────────────────
const B = {
  gold: '#E8A020', goldMuted: 'rgba(232,160,32,0.08)', goldBorder: 'rgba(232,160,32,0.20)',
  teal: '#14B8A6', tealMuted: 'rgba(20,184,166,0.08)',
  purple: '#8B5CF6', purpleMuted: 'rgba(139,92,246,0.08)',
  green: '#22C55E', greenMuted: 'rgba(34,197,94,0.08)',
  red: '#EF4444', redMuted: 'rgba(239,68,68,0.08)',
  amber: '#F59E0B', amberMuted: 'rgba(245,158,11,0.08)',
  fontMono: "'DM Mono', monospace", fontUI: "'Syne', system-ui, sans-serif",
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
};

const SEVERITY_MAP = {
  critical:    { color: B.red,    bg: B.redMuted,    icon: '⚠' },
  warning:     { color: B.amber,  bg: B.amberMuted,  icon: '◆' },
  opportunity: { color: B.teal,   bg: B.tealMuted,   icon: '✦' },
  healthy:     { color: B.green,  bg: B.greenMuted,  icon: '✓' },
};

const DOMAIN_COLOR: Record<string, string> = {
  'Growth':      B.gold,   'Revenue':    B.green,
  'Engagement':  B.teal,   'Product':    B.purple,
  'Users':       B.amber,  'Operations': B.red,
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: unknown): string => { const num = typeof n === "number" ? n : Number(n); if (isNaN(num)) return "0"; return num >= 1000 ? `${(num/1000).toFixed(1)}k` : String(Math.round(num)); };
const pct = (a: number, b: number) => b > 0 ? `${Math.round((a/b)*100)}%` : '0%';
const delta = (now: number, prev: number): { text: string; up: boolean } => {
  if (prev === 0) return { text: prev === 0 && now > 0 ? '+∞' : '—', up: now >= 0 };
  const d = Math.round(((now - prev) / prev) * 100);
  return { text: d >= 0 ? `+${d}%` : `${d}%`, up: d >= 0 };
};

function Spinner({ size = 20, color = B.gold }: { size?: number; color?: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid var(--admin-bg-input)`, borderTopColor: color, animation: 'asc-spin 0.7s linear infinite', flexShrink: 0 }} />;
}

function MonoLabel({ children, color = 'var(--admin-text-faint)' }: { children: React.ReactNode; color?: string }) {
  return <p style={{ fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color, margin: '0 0 5px' }}>{children}</p>;
}

function KPICard({ label, value, delta: d, deltaUp, color = B.gold, sub }: {
  label: string; value: string | number; delta?: string; deltaUp?: boolean; color?: string; sub?: string;
}) {
  return (
    <div style={{ background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, padding: '16px 18px' }}>
      <MonoLabel>{label}</MonoLabel>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
        <span style={{ fontFamily: B.fontDisplay, fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
        {d && (
          <span style={{ fontFamily: B.fontMono, fontSize: 10, color: deltaUp ? B.green : B.red, marginBottom: 2 }}>{d}</span>
        )}
      </div>
      {sub && <p style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)', margin: '5px 0 0', letterSpacing: '0.06em' }}>{sub}</p>}
    </div>
  );
}

function BarChart({ data, color = B.gold }: { data: [string, number][]; color?: string }) {
  const max = Math.max(...data.map(d => d[1]), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {data.slice(0, 7).map(([label, val]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-muted)', width: 110, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <div style={{ flex: 1, height: 5, background: 'var(--admin-bg-input)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(val/max)*100}%`, background: color, borderRadius: 100, transition: 'width 0.6s ease' }} />
          </div>
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color, width: 24, textAlign: 'right', flexShrink: 0 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════
export default function IntelPage() {
  const supabase = createClient();

  const [rawData,      setRawData]      = useState<RawData | null>(null);
  const [report,       setReport]       = useState<AIReport | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [analysing,    setAnalysing]    = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const [error,        setError]        = useState('');
  const [activeTab,    setActiveTab]    = useState<'overview' | 'insights' | 'users' | 'community'>('overview');
  const [autoRefresh,  setAutoRefresh]  = useState(true);
  const [creatingRec,  setCreatingRec]  = useState<Record<string, boolean>>({});
  const [createdRec,   setCreatedRec]   = useState<Record<string, boolean>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch all platform data ──────────────────────────────────
  const fetchData = useCallback(async (): Promise<RawData | null> => {
    const now = new Date();
    const d7  = new Date(now.getTime() - 7  * 86400000).toISOString();
    const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    try {
      const [
        totalUsersRes, new7Res, new30Res, prev7Res, prev30Res,
        onboardedRes, waitlistRes, newsletterRes,
        paidRes, revenueAllRes, revenue7Res, revenue30Res,
        planRes, promoRes,
        sessions7Res, sessions30Res, uniqueCoach7Res,
        tokenRes, courseRes, progressRes,
        posts7Res, membersRes, expertReg7Res,
        profilesRes, leadRes, hotLeadRes,
        auditRes, deletionRes, mentorRes, jobAppRes,
        contentRes, socialRes, referralRes, referralConvRes,
        cohortsRes, cohortMembersRes,
      ] = await Promise.all([
        // Growth
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d14).lt('created_at', d7),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date(now.getTime() - 60 * 86400000).toISOString()).lt('created_at', d30),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
        supabase.from('waitlist_entries').select('id', { count: 'exact', head: true }),
        supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        // Revenue
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('subscription_status', ['active', 'trialing']),
        supabase.from('payments').select('amount').eq('status', 'success'),
        supabase.from('payments').select('amount').eq('status', 'success').gte('created_at', d7),
        supabase.from('payments').select('amount').eq('status', 'success').gte('created_at', d30),
        supabase.from('profiles').select('subscription_plan').in('subscription_status', ['active', 'trialing']),
        supabase.from('promo_codes').select('id', { count: 'exact', head: true }).eq('active', true),
        // Engagement
        supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).gte('created_at', d7),
        supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).gte('created_at', d30),
        supabase.from('coaching_sessions').select('user_id').gte('created_at', d7),
        supabase.from('coaching_sessions').select('token_usage').not('token_usage', 'is', null),
        supabase.from('user_progress').select('id', { count: 'exact', head: true }).eq('completed', true).gte('updated_at', d7),
        supabase.from('user_progress').select('id', { count: 'exact', head: true }),
        supabase.from('cohort_posts').select('id', { count: 'exact', head: true }).gte('created_at', d7),
        supabase.from('cohort_members').select('id', { count: 'exact', head: true }),
        supabase.from('session_registrations').select('id', { count: 'exact', head: true }).gte('registered_at', d7),
        // User behaviour
        supabase.from('profiles').select('industry, biggest_challenge, goal_role, time_commitment').eq('onboarding_completed', true),
        supabase.from('profiles').select('lead_score').not('lead_score', 'is', null),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('lead_score', 70).in('subscription_status', ['inactive', 'cancelled', null as any]),
        // Operational
        supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', d7),
        supabase.from('deletion_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('mentor_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('job_applications' as any).select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('content_calendar').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('social_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('referrals').select('id', { count: 'exact', head: true }),
        supabase.from('referrals').select('id', { count: 'exact', head: true }).in('status', ['subscribed', 'rewarded']),
        // Cohorts
        supabase.from('cohorts').select('id, member_count'),
        supabase.from('cohort_members').select('id', { count: 'exact', head: true }),
      ]);

      // Process plan breakdown
      const planBreakdown: Record<string, number> = {};
      (planRes.data || []).forEach((r: any) => {
        planBreakdown[r.subscription_plan] = (planBreakdown[r.subscription_plan] || 0) + 1;
      });

      // Revenue totals
      const totalRevenue = (revenueAllRes.data || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      const rev7  = (revenue7Res.data  || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
      const rev30 = (revenue30Res.data || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);

      // Unique coaches
      const uniqueCoaches = new Set((uniqueCoach7Res.data || []).map((r: any) => r.user_id)).size;

      // Token usage
      const totalTokens = (tokenRes.data || []).reduce((s: number, r: any) => s + (Number(r.token_usage) || 0), 0);

      // Behaviour breakdowns
      const industryBd: Record<string, number> = {};
      const challengeBd: Record<string, number> = {};
      const goalRoleBd: Record<string, number> = {};
      const timeBd: Record<string, number> = {};
      (profilesRes.data || []).forEach((p: any) => {
        if (p.industry)           industryBd[p.industry]          = (industryBd[p.industry] || 0) + 1;
        if (p.biggest_challenge)  challengeBd[p.biggest_challenge] = (challengeBd[p.biggest_challenge] || 0) + 1;
        if (p.goal_role)          goalRoleBd[p.goal_role]          = (goalRoleBd[p.goal_role] || 0) + 1;
        if (p.time_commitment)    timeBd[p.time_commitment]        = (timeBd[p.time_commitment] || 0) + 1;
      });

      // Lead scores
      const scores = (leadRes.data || []).map((r: any) => r.lead_score as number);
      const avgLeadScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Cohort stats
      const cohortList = cohortsRes.data || [];
      const avgCohortSize = cohortList.length > 0 ? Math.round(cohortList.reduce((s: number, c: any) => s + (c.member_count || 0), 0) / cohortList.length) : 0;

      const onboardedCount = onboardedRes.count || 0;
      const totalUsers = totalUsersRes.count || 0;

      return {
        total_users:               totalUsers,
        new_7d:                    new7Res.count  || 0,
        new_30d:                   new30Res.count || 0,
        prev_7d:                   prev7Res.count || 0,
        prev_30d:                  prev30Res.count || 0,
        onboarded:                 onboardedCount,
        onboard_rate:              Math.round((onboardedCount / Math.max(totalUsers, 1)) * 100),
        waitlist:                  waitlistRes.count       || 0,
        newsletter_subs:           newsletterRes.count     || 0,
        paid_users:                paidRes.count           || 0,
        free_users:                totalUsers - (paidRes.count || 0),
        conversion_rate:           Math.round(((paidRes.count || 0) / Math.max(totalUsers, 1)) * 100),
        total_revenue:             totalRevenue,
        revenue_7d:                rev7,
        revenue_30d:               rev30,
        plan_breakdown:            planBreakdown,
        active_promos:             promoRes.count          || 0,
        coaching_sessions_7d:      sessions7Res.count      || 0,
        coaching_sessions_30d:     sessions30Res.count     || 0,
        unique_coaches_7d:         uniqueCoaches,
        avg_sessions_per_user:     uniqueCoaches > 0 ? Math.round((sessions7Res.count || 0) / uniqueCoaches * 10) / 10 : 0,
        total_coaching_tokens:     totalTokens,
        course_completions_7d:     courseRes.count         || 0,
        total_progress_records:    progressRes.count       || 0,
        community_posts_7d:        posts7Res.count         || 0,
        community_members:         membersRes.count        || 0,
        expert_registrations_7d:   expertReg7Res.count     || 0,
        industry_breakdown:        industryBd,
        challenge_breakdown:       challengeBd,
        goal_role_breakdown:       goalRoleBd,
        time_commitment_breakdown: timeBd,
        avg_lead_score:            avgLeadScore,
        hot_leads:                 hotLeadRes.count        || 0,
        audit_logs_7d:             auditRes.count          || 0,
        deletion_requests:         deletionRes.count       || 0,
        mentor_applications_pending: mentorRes.count       || 0,
        job_applications_new:      jobAppRes.count         || 0,
        content_calendar_items:    contentRes.count        || 0,
        social_queue_pending:      socialRes.count         || 0,
        referral_total:            referralRes.count       || 0,
        referral_converted:        referralConvRes.count   || 0,
        total_cohorts:             cohortList.length,
        avg_cohort_size:           avgCohortSize,
        total_cohort_members:      cohortMembersRes.count  || 0,
      };
    } catch (e: any) {
      setError(`Data fetch error: ${e?.message}`);
      return null;
    }
  }, [supabase]);

  // ── Run AI analysis ──────────────────────────────────────────
  const runAnalysis = useCallback(async (data: RawData) => {
    setAnalysing(true);
    setError('');

    const prompt = `You are the AI business intelligence engine for Ascentor — an AI-powered leadership development platform for African professionals.

Analyse this real-time platform snapshot and generate a sharp, actionable business intelligence report.

PLATFORM DATA SNAPSHOT:
${JSON.stringify({
  growth: {
    total_users: data.total_users, new_signups_7d: data.new_7d, new_signups_30d: data.new_30d,
    prev_period_7d: data.prev_7d, onboarding_completion_rate: `${data.onboard_rate}%`,
    waitlist: data.waitlist, newsletter_subscribers: data.newsletter_subs,
    signup_trend: data.prev_7d > 0 ? `${Math.round(((data.new_7d - data.prev_7d)/data.prev_7d)*100)}% vs last week` : 'no prior data',
  },
  revenue: {
    paid_users: data.paid_users, free_users: data.free_users,
    conversion_rate: `${data.conversion_rate}%`, total_revenue_ngn: data.total_revenue,
    revenue_last_7d: data.revenue_7d, revenue_last_30d: data.revenue_30d,
    plan_distribution: data.plan_breakdown, active_promo_codes: data.active_promos,
  },
  engagement: {
    coaching_sessions_7d: data.coaching_sessions_7d, coaching_sessions_30d: data.coaching_sessions_30d,
    unique_active_users_7d: data.unique_coaches_7d, avg_sessions_per_active_user: data.avg_sessions_per_user,
    total_ai_tokens_used: data.total_coaching_tokens,
    course_completions_7d: data.course_completions_7d,
    community_posts_7d: data.community_posts_7d, total_community_members: data.community_members,
    expert_session_registrations_7d: data.expert_registrations_7d,
  },
  user_profiles: {
    top_industries: Object.entries(data.industry_breakdown).sort((a,b)=>b[1]-a[1]).slice(0,5),
    top_challenges: Object.entries(data.challenge_breakdown).sort((a,b)=>b[1]-a[1]).slice(0,5),
    top_goal_roles: Object.entries(data.goal_role_breakdown).sort((a,b)=>b[1]-a[1]).slice(0,5),
    time_commitment_split: data.time_commitment_breakdown,
    avg_lead_score: data.avg_lead_score, hot_unconverted_leads: data.hot_leads,
  },
  community: {
    total_cohorts: data.total_cohorts, total_cohort_members: data.total_cohort_members,
    avg_cohort_size: data.avg_cohort_size,
  },
  operations: {
    audit_events_7d: data.audit_logs_7d, pending_deletion_requests: data.deletion_requests,
    mentor_applications_pending: data.mentor_applications_pending,
    new_job_applications: data.job_applications_new,
    content_drafts_unpublished: data.content_calendar_items,
    social_posts_queued: data.social_queue_pending,
    referral_total: data.referral_total, referral_conversion: data.referral_converted,
  },
}, null, 2)}

Generate a JSON report. Respond ONLY with valid JSON, no markdown, no preamble:
{
  "generated_at": "<ISO timestamp>",
  "headline": "<1 punchy sentence — the single most important thing happening on this platform right now>",
  "top_priority": "<The ONE thing the founder should focus on this week and why, max 2 sentences>",
  "insights": [
    {
      "id": "<unique_slug>",
      "domain": "<one of: Growth, Revenue, Engagement, Product, Users, Operations>",
      "severity": "<one of: critical, warning, opportunity, healthy>",
      "title": "<sharp 5-8 word insight title>",
      "body": "<2-3 sentences explaining what the data says and why it matters for an African professional development platform>",
      "action": "<concrete 1-sentence action the founder should take>"
    }
  ],
  "community_recs": [
    {
      "name": "<community name>",
      "rationale": "<1 sentence — based specifically on the user profile data above>",
      "estimated_size": <number>,
      "category": "<Technology|Finance|Leadership|Entrepreneurship|Consulting|Career Growth|Executive|Diversity>"
    }
  ]
}

Rules:
- Generate 6-10 insights covering all domains
- Be specific to the data — reference actual numbers
- community_recs: 2-4 recommendations based on the user profile breakdown
- severity 'critical' = needs action today; 'warning' = needs action this week; 'opportunity' = potential upside; 'healthy' = going well
- Think like a $100M SaaS founder advising a fellow founder on their metrics`;

    try {
      const res = await fetch('/api/intel-analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const apiData = await res.json();
      if (!res.ok) throw new Error(apiData?.error || 'API error');

      const parsed: AIReport = apiData.report;
      setReport(parsed);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(`Analysis failed: ${e?.message}`);
    }
    setAnalysing(false);
  }, []);

  // ── Full refresh ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchData();
    setLoading(false);
    if (data) {
      setRawData(data);
      await runAnalysis(data);
    }
  }, [fetchData, runAnalysis]);

  // Initial load + auto-refresh every 5 min
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 5 * 60 * 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refresh]);

  // ── Create community from AI rec ─────────────────────────────
  async function createCommunity(rec: CommRec, key: string) {
    setCreatingRec(c => ({ ...c, [key]: true }));
    const { data: { user } } = await supabase.auth.getUser();
    const iconMap: Record<string, string> = { Technology: 'code', Finance: 'money', Leadership: 'target', Entrepreneurship: 'rocket', Consulting: 'chart', 'Career Growth': 'fire', Executive: 'bulb', Diversity: 'globe' };
    const { error: err } = await supabase.from('cohorts').insert({
      name: rec.name, description: rec.rationale, category: rec.category,
      icon: iconMap[rec.category] || 'users', is_public: true, member_count: 0, created_by: user?.id || null,
    });
    if (!err) setCreatedRec(c => ({ ...c, [key]: true }));
    setCreatingRec(c => ({ ...c, [key]: false }));
  }

  // ── Severity order for sorting ───────────────────────────────
  const severityOrder = { critical: 0, warning: 1, opportunity: 2, healthy: 3 };
  const sortedInsights = report?.insights?.slice().sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]) || [];

  const TABS = ['overview', 'insights', 'users', 'community'] as const;

  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ animation: 'asc-fade-up 0.3s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes asc-fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes asc-spin { to { transform: rotate(360deg); } }
        @keyframes asc-pulse { 0%,100%{opacity:1}50%{opacity:0.35} }
        .intel-tab { transition: all 0.15s; }
        .intel-tab:hover { color: var(--admin-text) !important; }
        .insight-card { transition: border-color 0.2s; }
        .insight-card:hover { border-left-width: 3px !important; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: B.fontDisplay, fontSize: 30, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 4px' }}>
            Ascentor Intel
          </h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', margin: 0 }}>
              Live platform intelligence
            </p>
            {lastRefresh && (
              <p style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)', margin: 0 }}>
                · Last updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}
            {(loading || analysing) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Spinner size={10} />
                <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.gold, animation: 'asc-pulse 1.5s ease infinite' }}>
                  {loading ? 'Fetching data…' : 'Analysing…'}
                </span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Auto-refresh toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 8 }}>
            <div
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{ width: 28, height: 16, borderRadius: 100, background: autoRefresh ? B.gold : 'var(--admin-bg-input)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ position: 'absolute', top: 2, left: autoRefresh ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Auto</span>
          </div>
          <button
            onClick={refresh}
            disabled={loading || analysing}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: B.gold, color: '#0C0B08', fontFamily: B.fontUI, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (loading || analysing) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {(loading || analysing) ? <Spinner size={12} color="#0C0B08" /> : null}
            Refresh Now
          </button>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: B.redMuted, border: `1px solid ${B.red}30`, color: B.red, fontFamily: B.fontMono, fontSize: 11 }}>{error}</div>
      )}

      {/* ── AI Headline ────────────────────────────────────────── */}
      {report?.headline && (
        <div style={{ padding: '14px 20px', borderRadius: 10, marginBottom: 20, background: B.goldMuted, border: `1px solid ${B.goldBorder}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: B.gold, fontSize: 16, flexShrink: 0 }}>✦</span>
          <div>
            <p style={{ fontFamily: B.fontDisplay, fontSize: 18, fontWeight: 700, color: 'var(--admin-text-heading)', margin: '0 0 4px' }}>{report.headline}</p>
            {report.top_priority && <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text)', margin: 0, lineHeight: 1.65 }}>
              <strong style={{ color: B.gold }}>This week: </strong>{report.top_priority}
            </p>}
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, padding: 4, background: 'var(--admin-bg-card)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, marginBottom: 24, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="intel-tab"
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: activeTab === tab ? 'var(--admin-bg-deep)' : 'transparent', color: activeTab === tab ? B.gold : 'var(--admin-text-faint)', fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {tab === 'overview' ? 'Overview' : tab === 'insights' ? `Insights ${report ? `(${sortedInsights.length})` : ''}` : tab === 'users' ? 'Users' : 'Community'}
          </button>
        ))}
      </div>

      {loading && !rawData ? (
        <div style={{ padding: '80px 0', display: 'flex', justifyContent: 'center' }}><Spinner size={36} /></div>
      ) : rawData ? (
        <>
          {/* ════════════════════════════════════════════════════
              TAB: OVERVIEW
          ════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Growth KPIs */}
              <div>
                <MonoLabel color={B.gold}>Growth</MonoLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
                  <KPICard label="Total Users" value={fmt(rawData.total_users)} color={B.gold} />
                  <KPICard label="New (7d)" value={rawData.new_7d} delta={delta(rawData.new_7d, rawData.prev_7d).text} deltaUp={delta(rawData.new_7d, rawData.prev_7d).up} color={B.gold} />
                  <KPICard label="New (30d)" value={rawData.new_30d} color={B.gold} />
                  <KPICard label="Onboard Rate" value={`${rawData.onboard_rate}%`} color={rawData.onboard_rate > 60 ? B.green : B.amber} sub={`${rawData.onboarded} completed`} />
                  <KPICard label="Waitlist" value={fmt(rawData.waitlist)} color={B.teal} />
                  <KPICard label="Newsletter" value={fmt(rawData.newsletter_subs)} color={B.teal} />
                </div>
              </div>

              {/* Revenue KPIs */}
              <div>
                <MonoLabel color={B.green}>Revenue</MonoLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
                  <KPICard label="Paid Users" value={rawData.paid_users} color={B.green} sub={`${rawData.conversion_rate}% conversion`} />
                  <KPICard label="Free Users" value={rawData.free_users} color="var(--admin-text-muted)" />
                  <KPICard label="Revenue (7d)" value={`₦${fmt(rawData.revenue_7d)}`} color={B.green} />
                  <KPICard label="Revenue (30d)" value={`₦${fmt(rawData.revenue_30d)}`} color={B.green} />
                  <KPICard label="Total Revenue" value={`₦${fmt(rawData.total_revenue)}`} color={B.green} />
                  <KPICard label="Hot Leads" value={rawData.hot_leads} color={B.amber} sub="Lead score ≥70, unpaid" />
                </div>
              </div>

              {/* Engagement KPIs */}
              <div>
                <MonoLabel color={B.teal}>Engagement</MonoLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
                  <KPICard label="AI Sessions (7d)" value={rawData.coaching_sessions_7d} color={B.teal} />
                  <KPICard label="Active Users (7d)" value={rawData.unique_coaches_7d} color={B.teal} sub={`${rawData.avg_sessions_per_user} avg sessions`} />
                  <KPICard label="Community Posts (7d)" value={rawData.community_posts_7d} color={B.purple} />
                  <KPICard label="Course Completions (7d)" value={rawData.course_completions_7d} color={B.purple} />
                  <KPICard label="Expert Regs (7d)" value={rawData.expert_registrations_7d} color={B.purple} />
                  <KPICard label="AI Tokens Used" value={fmt(rawData.total_coaching_tokens)} color="var(--admin-text-muted)" sub="All time" />
                </div>
              </div>

              {/* Operations */}
              <div>
                <MonoLabel color={B.amber}>Operations Queue</MonoLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
                  <KPICard label="Mentor Apps (pending)" value={rawData.mentor_applications_pending} color={rawData.mentor_applications_pending > 0 ? B.amber : 'var(--admin-text-muted)'} />
                  <KPICard label="Job Apps (new)" value={rawData.job_applications_new} color={rawData.job_applications_new > 0 ? B.amber : 'var(--admin-text-muted)'} />
                  <KPICard label="Deletion Requests" value={rawData.deletion_requests} color={rawData.deletion_requests > 0 ? B.red : 'var(--admin-text-muted)'} />
                  <KPICard label="Content Drafts" value={rawData.content_calendar_items} color="var(--admin-text-muted)" />
                  <KPICard label="Social Queue" value={rawData.social_queue_pending} color="var(--admin-text-muted)" />
                  <KPICard label="Referrals" value={rawData.referral_total} color={B.teal} sub={`${rawData.referral_converted} converted`} />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              TAB: INSIGHTS
          ════════════════════════════════════════════════════ */}
          {activeTab === 'insights' && (
            <div>
              {analysing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px', background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, marginBottom: 16 }}>
                  <Spinner />
                  <p style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-faint)', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Claude is analysing {rawData.total_users} users across all platform signals…
                  </p>
                </div>
              )}

              {sortedInsights.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sortedInsights.map(insight => {
                    const sev = SEVERITY_MAP[insight.severity];
                    const domColor = DOMAIN_COLOR[insight.domain] || B.gold;
                    return (
                      <div
                        key={insight.id}
                        className="insight-card"
                        style={{ background: 'var(--admin-bg-deep)', border: `1px solid var(--admin-bg-input)`, borderLeft: `2px solid ${sev.color}`, borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: B.fontMono, fontSize: 10, color: sev.color, background: sev.bg, padding: '2px 8px', borderRadius: 100, border: `1px solid ${sev.color}25`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {sev.icon} {insight.severity}
                            </span>
                            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: domColor, background: `${domColor}12`, padding: '2px 8px', borderRadius: 100, border: `1px solid ${domColor}25`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {insight.domain}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontFamily: B.fontUI, fontSize: 15, fontWeight: 700, color: 'var(--admin-text-heading)', margin: 0 }}>{insight.title}</p>
                        <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text)', lineHeight: 1.7, margin: 0 }}>{insight.body}</p>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', background: `${sev.color}08`, border: `1px solid ${sev.color}18`, borderRadius: 7 }}>
                          <span style={{ color: sev.color, fontSize: 11, flexShrink: 0 }}>→</span>
                          <p style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.6 }}>
                            <strong style={{ color: sev.color, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 9 }}>Action: </strong>
                            {insight.action}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !analysing ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10 }}>
                  <p style={{ fontFamily: B.fontDisplay, fontSize: 20, color: 'var(--admin-text-heading)', margin: '0 0 8px' }}>No insights yet</p>
                  <p style={{ fontFamily: B.fontUI, fontSize: 13, color: 'var(--admin-text-muted)', margin: 0 }}>Click "Refresh Now" to run a full analysis.</p>
                </div>
              ) : null}
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              TAB: USERS
          ════════════════════════════════════════════════════ */}
          {activeTab === 'users' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {[
                { title: 'Industries', data: rawData.industry_breakdown, color: B.teal },
                { title: 'Biggest Challenges', data: rawData.challenge_breakdown, color: B.red },
                { title: 'Goal Roles', data: rawData.goal_role_breakdown, color: B.gold },
                { title: 'Time Commitment', data: rawData.time_commitment_breakdown, color: B.purple },
              ].map(({ title, data, color }) => (
                <div key={title} style={{ background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, padding: '18px 20px' }}>
                  <MonoLabel color={color}>{title}</MonoLabel>
                  <div style={{ marginTop: 12 }}>
                    <BarChart data={Object.entries(data).sort((a,b) => b[1]-a[1]) as [string,number][]} color={color} />
                  </div>
                </div>
              ))}

              {/* Lead scores */}
              <div style={{ background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, padding: '18px 20px' }}>
                <MonoLabel color={B.amber}>Lead Quality</MonoLabel>
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <div>
                    <p style={{ fontFamily: B.fontDisplay, fontSize: 32, fontWeight: 700, color: B.amber, margin: 0 }}>{rawData.avg_lead_score}</p>
                    <p style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)', margin: '4px 0 0' }}>Avg lead score</p>
                  </div>
                  <div style={{ width: 1, background: 'var(--admin-bg-input)' }} />
                  <div>
                    <p style={{ fontFamily: B.fontDisplay, fontSize: 32, fontWeight: 700, color: B.red, margin: 0 }}>{rawData.hot_leads}</p>
                    <p style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)', margin: '4px 0 0' }}>Hot leads (≥70, unpaid)</p>
                  </div>
                </div>
              </div>

              {/* Plan breakdown */}
              <div style={{ background: 'var(--admin-bg-deep)', border: '1px solid var(--admin-bg-input)', borderRadius: 10, padding: '18px 20px' }}>
                <MonoLabel color={B.green}>Plan Distribution (Paid)</MonoLabel>
                <div style={{ marginTop: 12 }}>
                  <BarChart data={Object.entries(rawData.plan_breakdown).sort((a,b) => b[1]-a[1]) as [string,number][]} color={B.green} />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════
              TAB: COMMUNITY
          ════════════════════════════════════════════════════ */}
          {activeTab === 'community' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Cohort stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <KPICard label="Total Cohorts" value={rawData.total_cohorts} color={B.purple} />
                <KPICard label="Total Members" value={rawData.total_cohort_members} color={B.purple} />
                <KPICard label="Avg Cohort Size" value={rawData.avg_cohort_size} color={B.purple} />
                <KPICard label="Posts (7d)" value={rawData.community_posts_7d} color={B.teal} />
              </div>

              {/* AI Community Recommendations */}
              {report?.community_recs?.length ? (
                <div>
                  <MonoLabel color={B.gold}>AI-Recommended Communities (based on current user base)</MonoLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {report.community_recs.map((rec, i) => {
                      const key = `${rec.name}-${i}`;
                      const isCreated  = createdRec[key];
                      const isCreating = creatingRec[key];
                      const colorMap: Record<string, string> = { Technology: B.teal, Finance: B.green, Leadership: B.purple, Entrepreneurship: B.gold, Consulting: B.purple, 'Career Growth': B.teal, Executive: B.purple, Diversity: B.green };
                      const c = colorMap[rec.category] || B.gold;
                      return (
                        <div key={key} style={{ background: 'var(--admin-bg-deep)', border: `1px solid ${isCreated ? B.green + '40' : 'var(--admin-bg-input)'}`, borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', opacity: isCreated ? 0.75 : 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <p style={{ fontFamily: B.fontUI, fontSize: 15, fontWeight: 700, color: 'var(--admin-text-heading)', margin: 0 }}>{rec.name}</p>
                              <span style={{ fontFamily: B.fontMono, fontSize: 9, color: c, background: `${c}12`, border: `1px solid ${c}25`, padding: '1px 8px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rec.category}</span>
                              <span style={{ fontFamily: B.fontMono, fontSize: 9, color: 'var(--admin-text-faint)' }}>~{rec.estimated_size} users</span>
                            </div>
                            <p style={{ fontFamily: B.fontUI, fontSize: 12, color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.65 }}>
                              <span style={{ color: c }}>✦ </span>{rec.rationale}
                            </p>
                          </div>
                          <button
                            onClick={() => createCommunity(rec, key)}
                            disabled={isCreated || isCreating}
                            style={{ padding: '7px 16px', borderRadius: 7, border: `1px solid ${isCreated ? B.green + '40' : c + '40'}`, background: 'transparent', color: isCreated ? B.green : c, fontFamily: B.fontUI, fontWeight: 700, fontSize: 11, cursor: (isCreated || isCreating) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                          >
                            {isCreating ? <><Spinner size={10} color={c} /> Creating…</> : isCreated ? '✓ Created' : '+ Create'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : analysing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Spinner size={14} /><span style={{ fontFamily: B.fontMono, fontSize: 10, color: 'var(--admin-text-faint)' }}>Generating community recommendations…</span></div>
              ) : null}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
