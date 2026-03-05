'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import SageLoader from '@/components/SageLoader';

// ============================================================
// MASTER ADMIN — /admin/master
// Full Ascentor Marketing System Dashboard
// Sections: KPIs · MailerLite · Content Calendar · Lead Magnets
//           Social Queue · AI Agents
// Brand: #0C0B08 · #E8A020 · Cormorant Garamond · Syne · DM Mono
// ============================================================

// ── Types ────────────────────────────────────────────────────────────────────
interface KPIData {
  totalUsers: number;
  newSignups7d: number;
  newSignups30d: number;
  paidSubscribers: number;
  mrr: number;
  wacu: number; // Weekly Active Coached Users
  conversionRate: number;
  referralPct: number;
  coachingSessions7d: number;
}

interface MailerLiteData {
  totalSubscribers: number;
  activeSubscribers: number;
  avgOpenRate: number;
  avgClickRate: number;
  unsubscribed: number;
  groups: { id: string; name: string; total: number }[];
  recentCampaigns: {
    id: string; name: string; subject: string;
    opens_count: number; clicks_count: number;
    sent_at: string; status: string;
  }[];
}

interface ContentItem {
  id: string;
  week: number;
  pillar: string;
  type: string;
  title: string;
  status: 'draft' | 'scheduled' | 'published';
  platform: string;
  scheduled_for: string | null;
}

interface LeadMagnet {
  id: string;
  name: string;
  type: string;
  downloads: number;
  conversions: number;
  active: boolean;
}

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  scheduled_for: string;
  status: 'queued' | 'published' | 'failed';
  pillar: string;
}

interface AgentStatus {
  id: string;
  name: string;
  description: string;
  schedule: string;
  toolStack: string;
  type: string;
  triggerTaskId: string | null;
  canTrigger: boolean;
  requiresPayload: boolean;
  payloadSchema: Record<string, string> | null;
  lastRun: string | null;
  lastStatus: string | null;
  status: 'active' | 'idle' | 'error' | 'building';
  runsThisWeek: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PILLARS = [
  { id: 'leadership', label: 'African Leadership Stories', color: '#E8A020' },
  { id: 'career',     label: 'Career Growth Tactics',      color: '#14B8A6' },
  { id: 'ai',         label: 'AI & Future of Work',        color: '#8B5CF6' },
  { id: 'coaching',   label: 'Coaching Insights',          color: '#3B82F6' },
  { id: 'community',  label: 'Community & Peer Success',   color: '#10B981' },
];

const PLATFORMS = ['LinkedIn', 'Twitter/X', 'WhatsApp', 'Instagram', 'Email'];
const CONTENT_TYPES = ['Blog Post', 'LinkedIn Post', 'Twitter Thread', 'Email Newsletter', 'Carousel', 'WhatsApp Broadcast', 'Lead Magnet'];
const STATUS_COLORS = {
  draft:     { bg: 'rgba(74,68,56,0.3)',   color: '#7A7260', label: 'Draft'     },
  scheduled: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', label: 'Scheduled' },
  published: { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: 'Published' },
  queued:    { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', label: 'Queued'    },
  failed:    { bg: 'rgba(239,68,68,0.1)',  color: '#EF4444', label: 'Failed'    },
  active:    { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: 'Active'    },
  idle:      { bg: 'rgba(74,68,56,0.3)',   color: '#7A7260', label: 'Idle'      },
  error:     { bg: 'rgba(239,68,68,0.1)',  color: '#EF4444', label: 'Error'     },
  building:  { bg: 'rgba(232,160,32,0.1)', color: '#E8A020', label: 'Building'  },
};

// Agents loaded dynamically from /api/admin/agents

// ── Shared styles ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#141310', border: '1px solid #2E2A22', borderRadius: 14,
};
const inputStyle: React.CSSProperties = {
  padding: '9px 13px', borderRadius: 8, border: '1px solid #2E2A22',
  background: '#1E1C17', color: '#D4CFC3',
  fontFamily: "'Syne', sans-serif", fontSize: 13, outline: 'none', width: '100%',
};
const mono = (text: string, gold = false, small = true): React.CSSProperties => ({
  fontFamily: "'DM Mono', monospace",
  fontSize: small ? 10 : 12,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: gold ? '#E8A020' : '#4A4438',
});

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
      <div>
        <p style={mono(eyebrow, true)}>{eyebrow}</p>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: '#FEF9EC', margin: '4px 0 0', lineHeight: 1.1 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_COLORS }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.idle;
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      padding: '3px 9px', borderRadius: 100,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

function KPICard({ label, value, sub, color, trend }: { label: string; value: string | number; sub?: string; color?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div style={{ ...card, padding: '20px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color || '#E8A020'}, transparent)` }} />
      <p style={mono(label)}>{label}</p>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, color: color || '#E8A020', margin: '6px 0 4px', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#4A4438', letterSpacing: '0.06em' }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MasterAdminPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab]       = useState<'kpi' | 'email' | 'content' | 'leads' | 'social' | 'agents'>('kpi');
  const [kpi,       setKpi]             = useState<KPIData | null>(null);
  const [mlData,    setMlData]          = useState<MailerLiteData | null>(null);
  const [content,   setContent]         = useState<ContentItem[]>([]);
  const [magnets,   setMagnets]         = useState<LeadMagnet[]>([]);
  const [social,    setSocial]          = useState<SocialPost[]>([]);
  const [agents,    setAgents]          = useState<AgentStatus[]>([]);
  const [loading,   setLoading]         = useState<Record<string, boolean>>({});
  const [msg,       setMsg]             = useState('');
  const [filterPillar, setFilterPillar] = useState('all');
  const [filterWeek,   setFilterWeek]   = useState('all');
  const [agentMsg,     setAgentMsg]     = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [agentPayload, setAgentPayload] = useState<Record<string, string>>({});
  const [expandedAgent,   setExpandedAgent]   = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);

  // Content form
  const [showAddContent, setShowAddContent] = useState(false);
  const [newContent, setNewContent] = useState({ pillar: 'leadership', type: 'Blog Post', title: '', platform: 'LinkedIn', status: 'draft' as const, week: 1, scheduled_for: '' });

  // Lead magnet form
  const [showAddMagnet, setShowAddMagnet] = useState(false);
  const [newMagnet, setNewMagnet] = useState({ name: '', type: 'PDF', downloads: 0, conversions: 0, active: true });

  // Social post form
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [newSocial, setNewSocial] = useState({ platform: 'LinkedIn', content: '', pillar: 'leadership', scheduled_for: '', status: 'queued' as const });

  const load = useCallback(async (tab: string) => {
    setLoading(p => ({ ...p, [tab]: true }));
    try {
      if (tab === 'kpi') await loadKPI();
      if (tab === 'email') await loadMailerLite();
      if (tab === 'content') await loadContent();
      if (tab === 'leads') await loadMagnets();
      if (tab === 'social') await loadSocial();
      if (tab === 'agents') await loadAgents();
    } catch (e) { console.error(e); }
    setLoading(p => ({ ...p, [tab]: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(activeTab); }, [activeTab, load]);

  // ── KPI loader ───────────────────────────────────────────────────────────────
  async function loadKPI() {
    const now = new Date();
    const d7  = new Date(now.getTime() - 7  * 86400000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [all, new7d, new30d, paid, sessions7d, wacuRes, referrals] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', d30),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('subscription_status', ['active', 'trialing']),
      supabase.from('coaching_sessions').select('id', { count: 'exact', head: true }).gte('created_at', d7),
      supabase.from('coaching_sessions').select('user_id').gte('created_at', weekStart),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('referred_by', 'is', null).gte('created_at', d30),
    ]);

    const totalUsers   = all.count || 0;
    const paidCount    = paid.count || 0;
    const wacuCount    = new Set((wacuRes.data || []).map((r: any) => r.user_id)).size;
    const refCount     = referrals.count || 0;
    const newMonth     = new30d.count || 1;

    // Estimate MRR from paid subscribers (assuming avg $15/mo)
    const mrr = paidCount * 15;

    setKpi({
      totalUsers,
      newSignups7d:   new7d.count || 0,
      newSignups30d:  new30d.count || 0,
      paidSubscribers: paidCount,
      mrr,
      wacu: wacuCount,
      conversionRate: totalUsers > 0 ? Math.round((paidCount / totalUsers) * 1000) / 10 : 0,
      referralPct:    newMonth > 0 ? Math.round((refCount / newMonth) * 100) : 0,
      coachingSessions7d: sessions7d.count || 0,
    });
  }

  // ── MailerLite loader ────────────────────────────────────────────────────────
  async function loadMailerLite() {
    try {
      const res = await fetch('/api/admin/mailerlite');
      if (!res.ok) throw new Error('MailerLite API error');
      const data = await res.json();
      setMlData(data);
    } catch {
      // Fallback: show empty state so UI doesn't break
      setMlData({ totalSubscribers: 0, activeSubscribers: 0, avgOpenRate: 0, avgClickRate: 0, unsubscribed: 0, groups: [], recentCampaigns: [] });
    }
  }

  // ── Content loader ───────────────────────────────────────────────────────────
  async function loadContent() {
    const { data } = await supabase.from('content_calendar').select('*').order('week').order('created_at');
    setContent(data || []);
  }

  // ── Lead magnets loader ──────────────────────────────────────────────────────
  async function loadMagnets() {
    const { data } = await supabase.from('lead_magnets').select('*').order('downloads', { ascending: false });
    setMagnets(data || []);
  }

  // ── Social queue loader ──────────────────────────────────────────────────────
  async function loadSocial() {
    const { data } = await supabase.from('social_queue').select('*').order('scheduled_for');
    setSocial(data || []);
  }

  // ── Agents loader + trigger ────────────────────────────────────────────────────────────
  async function loadAgents() {
    try {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to load agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) {
      console.error('loadAgents error:', e);
    }
  }

  async function triggerAgent(agentId: string, payload: Record<string, string> = {}) {
    setTriggering(agentId);
    setAgentMsg(null);
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setAgentMsg({ id: agentId, text: `✓ ${data.message} · Run ID: ${data.runId?.substring(0, 12)}...`, ok: true });
        setTimeout(() => load('agents'), 3000);
      } else {
        setAgentMsg({ id: agentId, text: `✗ ${data.error}`, ok: false });
      }
    } catch (e: any) {
      setAgentMsg({ id: agentId, text: `✗ ${e.message}`, ok: false });
    }
    setTriggering(null);
  }

  // ── Content CRUD ─────────────────────────────────────────────────────────────
  async function addContent() {
    const { error } = await supabase.from('content_calendar').insert({
      ...newContent, scheduled_for: newContent.scheduled_for || null,
    });
    if (!error) { setShowAddContent(false); setNewContent({ pillar: 'leadership', type: 'Blog Post', title: '', platform: 'LinkedIn', status: 'draft', week: 1, scheduled_for: '' }); load('content'); }
  }

  async function updateContentStatus(id: string, status: ContentItem['status']) {
    await supabase.from('content_calendar').update({ status }).eq('id', id);
    load('content');
  }

  async function deleteContent(id: string) {
    if (!confirm('Delete this content item?')) return;
    await supabase.from('content_calendar').delete().eq('id', id);
    load('content');
  }

  // ── Lead magnet CRUD ─────────────────────────────────────────────────────────
  async function addMagnet() {
    const { error } = await supabase.from('lead_magnets').insert(newMagnet);
    if (!error) { setShowAddMagnet(false); setNewMagnet({ name: '', type: 'PDF', downloads: 0, conversions: 0, active: true }); load('leads'); }
  }

  async function toggleMagnet(id: string, active: boolean) {
    await supabase.from('lead_magnets').update({ active: !active }).eq('id', id);
    load('leads');
  }

  // ── Social CRUD ──────────────────────────────────────────────────────────────
  async function addSocial() {
    const { error } = await supabase.from('social_queue').insert(newSocial);
    if (!error) { setShowAddSocial(false); setNewSocial({ platform: 'LinkedIn', content: '', pillar: 'leadership', scheduled_for: '', status: 'queued' }); load('social'); }
  }

  async function deleteSocial(id: string) {
    if (!confirm('Remove this post from the queue?')) return;
    await supabase.from('social_queue').delete().eq('id', id);
    load('social');
  }

  const tabs = [
    { id: 'kpi',     label: 'KPI Dashboard'   },
    { id: 'email',   label: 'MailerLite'       },
    { id: 'content', label: 'Content Calendar' },
    { id: 'leads',   label: 'Lead Magnets'     },
    { id: 'social',  label: 'Social Queue'     },
    { id: 'agents',  label: 'AI Agents'        },
  ];

  const filteredContent = content.filter(c =>
    (filterPillar === 'all' || c.pillar === filterPillar) &&
    (filterWeek   === 'all' || c.week === parseInt(filterWeek))
  );

  const isLoading = loading[activeTab];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'ma-fade 0.35s ease both' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Syne:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes ma-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        select option { background:#1E1C17; color:#D4CFC3; }
        input:focus, textarea:focus, select:focus { border-color: rgba(232,160,32,0.5) !important; }
        .ma-tab { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:0.1em; text-transform:uppercase; transition:all 0.15s; }
        .ma-tab.active { background:#141310; color:#E8A020; border:1px solid rgba(232,160,32,0.25); }
        .ma-tab.inactive { background:transparent; color:#4A4438; border:1px solid transparent; }
        .ma-tab.inactive:hover { color:#7A7260; }
        .ma-row:hover { background: rgba(46,42,34,0.4) !important; }
        textarea { resize: vertical; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#E8A020', marginBottom: 6 }}>
          Marketing System Control
        </p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, color: '#FEF9EC', margin: 0, lineHeight: 1.1 }}>
          Master Admin
        </h1>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', letterSpacing: '0.08em', marginTop: 6 }}>
          Ascentor Master Marketing System · MailerLite · 4 Systems Fully Automated
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 28, padding: 4, background: '#141310', borderRadius: 12, border: '1px solid #2E2A22', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} className={`ma-tab ${activeTab === t.id ? 'active' : 'inactive'}`}
            onClick={() => setActiveTab(t.id as any)}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <SageLoader message="Loading…" />}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — KPI DASHBOARD                                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'kpi' && !isLoading && kpi && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* North Star */}
          <div style={{ ...card, padding: '24px', background: 'linear-gradient(135deg, #141310 60%, rgba(232,160,32,0.05))', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #E8A020 40%, #E8A020 60%, transparent)' }} />
            <p style={mono('⭐ North Star Metric', true)}>⭐ North Star Metric</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 72, fontWeight: 700, color: '#E8A020', margin: '8px 0 4px', lineHeight: 1 }}>{kpi.wacu}</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 600, color: '#FEF9EC', margin: 0 }}>Weekly Active Coached Users (WACU)</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', marginTop: 6, letterSpacing: '0.08em' }}>Users with ≥1 coaching session this week · drives retention, word-of-mouth, conversion</p>
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <KPICard label="Total Users"        value={kpi.totalUsers.toLocaleString()}           sub={`+${kpi.newSignups7d} this week`}           trend="up"     color="#E8A020" />
            <KPICard label="New Signups (30d)"  value={kpi.newSignups30d.toLocaleString()}         sub="Monthly acquisition"                                        color="#3B82F6" />
            <KPICard label="Paid Subscribers"   value={kpi.paidSubscribers.toLocaleString()}       sub={`${kpi.conversionRate}% conversion rate`}   trend={kpi.conversionRate >= 5 ? 'up' : 'down'} color="#10B981" />
            <KPICard label="Est. MRR"            value={`$${kpi.mrr.toLocaleString()}`}             sub="Target: $450 M3 · $7,500 M12"               color="#E8A020" />
            <KPICard label="Coach Sessions (7d)" value={kpi.coachingSessions7d.toLocaleString()}   sub="Platform engagement"                         trend="up"     color="#14B8A6" />
            <KPICard label="Referral Signups"    value={`${kpi.referralPct}%`}                     sub="Target: 30% by Month 6"                     trend={kpi.referralPct >= 10 ? 'up' : 'neutral'} color="#8B5CF6" />
          </div>

          {/* Targets progress */}
          <div style={{ ...card, padding: 24 }}>
            <p style={mono('90-Day Growth Targets', true, false)}>90-Day Growth Targets</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              {[
                { label: 'Email Subscribers',     current: 0,                  m3: 500,  m12: 10000 },
                { label: 'Monthly New Signups',   current: kpi.newSignups30d,  m3: 200,  m12: 2000  },
                { label: 'Paid Subscribers',      current: kpi.paidSubscribers,m3: 30,   m12: 500   },
                { label: 'Conversion Rate (%)',   current: kpi.conversionRate, m3: 5,    m12: 8     },
                { label: 'WACU',                  current: kpi.wacu,           m3: 100,  m12: 1000  },
              ].map(row => {
                const pct = Math.min(Math.round((row.current / row.m3) * 100), 100);
                return (
                  <div key={row.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#D4CFC3' }}>{row.label}</span>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020' }}>{row.current} / {row.m3} M3</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438' }}>M12: {row.m12}</span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: '#2E2A22', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10B981' : pct >= 50 ? '#E8A020' : '#3B82F6', borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Funnel stages */}
          <div style={{ ...card, padding: 24 }}>
            <p style={mono('AIDA Funnel Status', true, false)}>AIDA Funnel Status</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
              {[
                { stage: 'AWARENESS',  tactic: 'LinkedIn + Twitter + SEO', status: 'building' },
                { stage: 'INTEREST',   tactic: 'Free session + Lead magnets', status: 'building' },
                { stage: 'DESIRE',     tactic: '14-email nurture (MailerLite)', status: 'building' },
                { stage: 'ACTION',     tactic: 'Promo codes + Paystack', status: 'active' },
                { stage: 'RETENTION',  tactic: 'Community + Expert sessions', status: 'active' },
                { stage: 'ADVOCACY',   tactic: 'Referral rewards + UGC', status: 'active' },
              ].map(f => (
                <div key={f.stage} style={{ padding: '12px 14px', background: '#1E1C17', borderRadius: 10, border: '1px solid #2E2A22' }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.12em', color: '#E8A020', margin: '0 0 6px' }}>{f.stage}</p>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#7A7260', margin: '0 0 8px', lineHeight: 1.4 }}>{f.tactic}</p>
                  <StatusBadge status={f.status as any} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — MAILERLITE                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'email' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionHeader eyebrow="Email Marketing" title="MailerLite Dashboard"
            right={<button onClick={() => load('email')} style={{ ...inputStyle, width: 'auto', padding: '7px 14px', cursor: 'pointer', fontSize: 11 }}>↻ Refresh</button>}
          />

          {!mlData ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#4A4438', letterSpacing: '0.1em', marginBottom: 12 }}>
                MAILERLITE NOT CONNECTED
              </p>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#7A7260', lineHeight: 1.6 }}>
                Add <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#E8A020' }}>MAILERLITE_API_KEY</code> to your Vercel environment variables and redeploy.
              </p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                <KPICard label="Total Subscribers"  value={mlData.totalSubscribers.toLocaleString()} sub="Target: 500 M3 · 10k M12" color="#E8A020" />
                <KPICard label="Active"             value={mlData.activeSubscribers.toLocaleString()} color="#10B981" />
                <KPICard label="Avg Open Rate"      value={`${mlData.avgOpenRate}%`} sub="Target: 35%+" trend={mlData.avgOpenRate >= 35 ? 'up' : 'down'} color="#3B82F6" />
                <KPICard label="Avg Click Rate"     value={`${mlData.avgClickRate}%`} color="#14B8A6" />
                <KPICard label="Unsubscribed"       value={mlData.unsubscribed.toLocaleString()} trend="down" color="#EF4444" />
              </div>

              {/* Groups */}
              {mlData.groups.length > 0 && (
                <div style={{ ...card, padding: 20 }}>
                  <p style={mono('Subscriber Groups / Sequences', true, false)}>Subscriber Groups</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 14 }}>
                    {mlData.groups.map((g, i) => (
                      <div key={g.id} className="ma-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < mlData.groups.length - 1 ? '1px solid #2E2A22' : 'none' }}>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#D4CFC3' }}>{g.name}</span>
                        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: '#E8A020' }}>{g.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent campaigns */}
              {mlData.recentCampaigns.length > 0 && (
                <div style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #2E2A22' }}>
                    <p style={mono('Recent Campaigns', true, false)}>Recent Campaigns</p>
                  </div>
                  {mlData.recentCampaigns.map((c, i) => (
                    <div key={c.id} className="ma-row" style={{ padding: '14px 20px', borderBottom: i < mlData.recentCampaigns.length - 1 ? '1px solid #2E2A22' : 'none', display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 16, alignItems: 'center' }}>
                      <div>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#D4CFC3', margin: '0 0 2px', fontWeight: 600 }}>{c.name}</p>
                        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', margin: 0, letterSpacing: '0.06em' }}>{c.subject}</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#3B82F6', margin: 0 }}>{c.opens_count}</p>
                        <p style={mono('opens')}>opens</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: '#10B981', margin: 0 }}>{c.clicks_count}</p>
                        <p style={mono('clicks')}>clicks</p>
                      </div>
                      <StatusBadge status={c.status === 'sent' ? 'published' : 'scheduled'} />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438' }}>
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* 14-email sequence tracker */}
          <div style={{ ...card, padding: 20 }}>
            <p style={mono('14-Email Welcome & Nurture Sequence', true, false)}>14-Email Welcome Sequence</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#4A4438', marginTop: 4, marginBottom: 16 }}>Build once in MailerLite automation · runs forever · write all 14 with Claude</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { day: 0,  subject: 'Welcome + lead magnet delivery' },
                { day: 1,  subject: 'Why I built Ascentor — founder story' },
                { day: 3,  subject: 'The #1 leadership mistake African professionals make' },
                { day: 5,  subject: 'Meet Sage — your AI coach (demo)' },
                { day: 7,  subject: 'Social proof — member transformation story' },
                { day: 10, subject: 'The 3 pillars of Ascentor (soft product intro)' },
                { day: 12, subject: 'Objection killer — is AI coaching real?' },
                { day: 14, subject: 'Case study — specific member transformation' },
                { day: 18, subject: 'Value — the 5-minute leadership habit' },
                { day: 21, subject: 'Peer cohorts — you don\'t have to grow alone' },
                { day: 24, subject: '🔥 Founders Promo — 50% off (first CTA)' },
                { day: 26, subject: 'FAQ — remove all friction to purchase' },
                { day: 28, subject: '⏰ Last chance — Founders Promo expires' },
                { day: 30, subject: 'Re-engagement — if not now, when?' },
              ].map((email, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', background: '#1E1C17', borderRadius: 8, border: '1px solid #2E2A22' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', width: 44, flexShrink: 0, letterSpacing: '0.06em' }}>Day {email.day}</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260', flex: 1 }}>{email.subject}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#2E2A22' }}>#{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 3 — CONTENT CALENDAR                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'content' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionHeader eyebrow="Content Marketing Engine" title="Content Calendar"
            right={
              <button onClick={() => setShowAddContent(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                + Add Content
              </button>
            }
          />

          {/* Content pillar legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PILLARS.map(p => (
              <span key={p.id} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, background: `${p.color}15`, border: `1px solid ${p.color}30`, color: p.color }}>
                {p.label}
              </span>
            ))}
          </div>

          {/* 4-1-1 rule reminder */}
          <div style={{ padding: '12px 16px', background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', letterSpacing: '0.1em', margin: '0 0 4px' }}>LINKEDIN 4-1-1 RULE / WEEK</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260', margin: 0 }}>4 value posts · 1 social proof post · 1 soft CTA post — never hard sell</p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={filterPillar} onChange={e => setFilterPillar(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="all">All Pillars</option>
              {PILLARS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="all">All Weeks</option>
              {[1,2,3,4,5,6,7,8].map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>

          {/* Add form */}
          {showAddContent && (
            <div style={{ ...card, padding: 20 }}>
              <p style={mono('New Content Item', true, false)}>New Content Item</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                <div><label style={mono('Title')}>Title</label><input value={newContent.title} onChange={e => setNewContent(p => ({ ...p, title: e.target.value }))} placeholder="Content title..." style={{ ...inputStyle, marginTop: 6 }} /></div>
                <div>
                  <label style={mono('Pillar')}>Pillar</label>
                  <select value={newContent.pillar} onChange={e => setNewContent(p => ({ ...p, pillar: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {PILLARS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mono('Type')}>Type</label>
                  <select value={newContent.type} onChange={e => setNewContent(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mono('Platform')}>Platform</label>
                  <select value={newContent.platform} onChange={e => setNewContent(p => ({ ...p, platform: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mono('Week')}>Week #</label>
                  <input type="number" min={1} max={52} value={newContent.week} onChange={e => setNewContent(p => ({ ...p, week: parseInt(e.target.value) }))} style={{ ...inputStyle, marginTop: 6 }} />
                </div>
                <div>
                  <label style={mono('Schedule Date')}>Schedule Date</label>
                  <input type="datetime-local" value={newContent.scheduled_for} onChange={e => setNewContent(p => ({ ...p, scheduled_for: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={addContent} disabled={!newContent.title} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: !newContent.title ? 0.4 : 1 }}>Save</button>
                <button onClick={() => setShowAddContent(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2E2A22', background: 'transparent', color: '#7A7260', fontFamily: "'Syne', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Content list */}
          {filteredContent.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#4A4438', letterSpacing: '0.1em' }}>NO CONTENT YET — ADD YOUR FIRST ITEM ABOVE</p>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 120px 80px', padding: '10px 16px', borderBottom: '1px solid #2E2A22' }}>
                {['Week', 'Title', 'Type', 'Platform', 'Pillar', 'Scheduled', 'Status'].map(h => (
                  <span key={h} style={mono(h)}>{h}</span>
                ))}
              </div>
              {filteredContent.map((item, i) => {
                const pillar = PILLARS.find(p => p.id === item.pillar);
                const isExpanded = expandedContent === item.id;
                const cd = item.content_data as any;

                // Extract readable text from content_data based on type
                function getPreviewText() {
                  if (!cd) return null;
                  if (item.type === 'Blog Post') return cd.content || cd.title || null;
                  if (item.type === 'LinkedIn Post') return cd.content || cd.hook || null;
                  if (item.type === 'Twitter Thread') {
                    const tweets = [cd.opener, ...(cd.tweets || []), cd.cta].filter(Boolean);
                    return tweets.join('\n\n');
                  }
                  if (item.type === 'Email Newsletter') return cd.body || cd.subject || null;
                  return JSON.stringify(cd, null, 2);
                }

                const previewText = getPreviewText();

                return (
                  <div key={item.id} style={{ borderBottom: i < filteredContent.length - 1 ? '1px solid #2E2A22' : 'none' }}>
                    {/* Row */}
                    <div className="ma-row" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 100px 100px 120px 100px', padding: '12px 16px', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8A020' }}>W{item.week}</span>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#D4CFC3', fontWeight: 600 }}>{item.title}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#7A7260', letterSpacing: '0.06em' }}>{item.type}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#7A7260' }}>{item.platform}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: pillar?.color || '#4A4438' }}>{pillar?.label.split(' ')[0]}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438' }}>
                        {item.scheduled_for ? new Date(item.scheduled_for).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={item.status} onChange={e => updateContentStatus(item.id, e.target.value as any)}
                          style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, background: 'transparent', border: 'none', color: STATUS_COLORS[item.status]?.color || '#7A7260', cursor: 'pointer', outline: 'none', padding: 0 }}>
                          <option value="draft">Draft</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="published">Published</option>
                        </select>
                        {previewText && (
                          <button
                            onClick={() => setExpandedContent(isExpanded ? null : item.id)}
                            style={{ background: 'none', border: '1px solid #2E2A22', borderRadius: 4, color: isExpanded ? '#E8A020' : '#4A4438', cursor: 'pointer', fontSize: 10, padding: '2px 6px', fontFamily: "'DM Mono', monospace" }}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                        <button onClick={() => deleteContent(item.id)} style={{ background: 'none', border: 'none', color: '#4A4438', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
                      </div>
                    </div>

                    {/* Expanded content preview */}
                    {isExpanded && previewText && (
                      <div style={{ padding: '0 16px 16px', background: '#0F0E0C' }}>
                        <div style={{ borderRadius: 10, border: '1px solid #2E2A22', overflow: 'hidden' }}>
                          {/* Header */}
                          <div style={{ padding: '10px 16px', background: '#1A1815', borderBottom: '1px solid #2E2A22', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#E8A020', letterSpacing: '0.1em' }}>
                              {item.type.toUpperCase()} · {item.platform}
                            </span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(previewText); }}
                              style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#7A7260', background: 'none', border: '1px solid #2E2A22', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                            >
                              Copy
                            </button>
                          </div>
                          {/* Content */}
                          <div style={{ padding: '16px', maxHeight: 400, overflowY: 'auto' }}>
                            {/* Blog post meta */}
                            {item.type === 'Blog Post' && cd?.meta_description && (
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7260', margin: '0 0 12px', padding: '8px 12px', background: '#1E1C17', borderRadius: 6 }}>
                                SEO: {cd.meta_description}
                              </p>
                            )}
                            {/* Email subject */}
                            {item.type === 'Email Newsletter' && cd?.subject && (
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', margin: '0 0 4px' }}>
                                Subject: {cd.subject}
                              </p>
                            )}
                            {item.type === 'Email Newsletter' && cd?.preview_text && (
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7260', margin: '0 0 12px' }}>
                                Preview: {cd.preview_text}
                              </p>
                            )}
                            {/* LinkedIn hook */}
                            {item.type === 'LinkedIn Post' && cd?.hook && (
                              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#E8A020', fontWeight: 700, margin: '0 0 8px', lineHeight: 1.4 }}>
                                Hook: {cd.hook}
                              </p>
                            )}
                            {/* Main content */}
                            <pre style={{
                              fontFamily: item.type === 'Blog Post' || item.type === 'Email Newsletter'
                                ? "'Syne', sans-serif" : "'DM Mono', monospace",
                              fontSize: item.type === 'Blog Post' || item.type === 'Email Newsletter' ? 13 : 12,
                              color: '#D4CFC3',
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              lineHeight: 1.7,
                            }}>
                              {previewText}
                            </pre>
                            {/* Blog CTA */}
                            {item.type === 'Blog Post' && cd?.cta && (
                              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', margin: '12px 0 0', padding: '8px 12px', background: 'rgba(232,160,32,0.06)', borderRadius: 6, border: '1px solid rgba(232,160,32,0.15)' }}>
                                CTA: {cd.cta}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Weekly workflow reminder */}
          <div style={{ ...card, padding: 20 }}>
            <p style={mono('Monday Content Flywheel — One Input → 12 Outputs', true, false)}>Monday Content Flywheel</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {[
                { time: '6:00', step: 'Research Agent', desc: 'Perplexity AI — 5 trending African leadership topics' },
                { time: '8:00', step: 'Content Writer Agent', desc: 'Claude API — 1 blog post, 5 LinkedIn posts, 3 Twitter threads, 1 newsletter' },
                { time: '10:00', step: 'Founder Review', desc: '5-min approval window before scheduler fires' },
                { time: '10:30', step: 'Social Scheduler Agent', desc: 'Buffer API — entire week of posts queued automatically' },
                { time: 'Async', step: 'Canva Graphics', desc: '5x quote cards from article — schedule across week' },
                { time: 'Friday', step: 'Newsletter Send', desc: '"The African Leader" — 400–600 words, written by Claude in 20 mins' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: '#1E1C17', borderRadius: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', width: 44, flexShrink: 0, paddingTop: 1 }}>{s.time}</span>
                  <div>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 600, color: '#D4CFC3', margin: '0 0 2px' }}>{s.step}</p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#4A4438', margin: 0 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 4 — LEAD MAGNETS                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'leads' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionHeader eyebrow="Lead Capture Engine" title="Lead Magnets"
            right={<button onClick={() => setShowAddMagnet(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Add Magnet</button>}
          />

          <div style={{ padding: '12px 16px', background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', margin: '0 0 4px', letterSpacing: '0.1em' }}>TARGET: 3 ACTIVE LEAD MAGNETS MINIMUM</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260', margin: 0 }}>Each magnet feeds a dedicated MailerLite automation sequence · A subscriber is 40× more likely to convert than a social follower</p>
          </div>

          {/* Canonical 4 from the marketing doc */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {[
              { name: 'The African Leadership Blueprint', type: 'PDF', desc: '10-page guide · 7 frameworks used by Africa\'s top CEOs · created with Claude in 2 hours' },
              { name: 'Free 30-Day Leadership Challenge', type: 'Email Series', desc: 'Daily email · 1 leadership exercise per day · builds habit + proves value before payment' },
              { name: 'Career Acceleration Audit', type: 'Quiz', desc: '10-question Typeform quiz · reveals leadership gaps · personalised email sequence trigger' },
              { name: 'African Professional Salary Negotiation Toolkit', type: 'Template Pack', desc: 'Scripts, email templates, prep frameworks · high perceived value · viral LinkedIn potential' },
            ].map(m => (
              <div key={m.name} style={{ ...card, padding: 18 }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#E8A020', background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)', borderRadius: 100, padding: '2px 8px' }}>{m.type}</span>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#FEF9EC', margin: '10px 0 6px', lineHeight: 1.3 }}>{m.name}</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#4A4438', lineHeight: 1.6, margin: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Add form */}
          {showAddMagnet && (
            <div style={{ ...card, padding: 20 }}>
              <p style={mono('Track New Lead Magnet', true, false)}>Track New Lead Magnet</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
                <div><label style={mono('Name')}>Name</label><input value={newMagnet.name} onChange={e => setNewMagnet(p => ({ ...p, name: e.target.value }))} placeholder="Lead magnet name" style={{ ...inputStyle, marginTop: 6 }} /></div>
                <div>
                  <label style={mono('Type')}>Type</label>
                  <select value={newMagnet.type} onChange={e => setNewMagnet(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {['PDF', 'Email Series', 'Quiz', 'Template Pack', 'Video', 'Webinar', 'Checklist'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label style={mono('Initial Downloads')}>Downloads</label><input type="number" value={newMagnet.downloads} onChange={e => setNewMagnet(p => ({ ...p, downloads: parseInt(e.target.value) }))} style={{ ...inputStyle, marginTop: 6 }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={addMagnet} disabled={!newMagnet.name} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: !newMagnet.name ? 0.4 : 1 }}>Save</button>
                <button onClick={() => setShowAddMagnet(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2E2A22', background: 'transparent', color: '#7A7260', fontFamily: "'Syne', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Tracked magnets from DB */}
          {magnets.length > 0 && (
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #2E2A22' }}>
                <p style={mono('Tracked Performance', true, false)}>Tracked Performance</p>
              </div>
              {magnets.map((m, i) => {
                const convRate = m.downloads > 0 ? Math.round((m.conversions / m.downloads) * 100) : 0;
                return (
                  <div key={m.id} className="ma-row" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 80px', padding: '14px 20px', borderBottom: i < magnets.length - 1 ? '1px solid #2E2A22' : 'none', alignItems: 'center', gap: 12 }}>
                    <div>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#D4CFC3', margin: '0 0 2px' }}>{m.name}</p>
                      <span style={mono(m.type)}>{m.type}</span>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#3B82F6', margin: 0 }}>{m.downloads}</p>
                      <p style={mono('downloads')}>downloads</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#10B981', margin: 0 }}>{m.conversions}</p>
                      <p style={mono('conversions')}>paid conversions</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#E8A020', margin: 0 }}>{convRate}%</p>
                      <p style={mono('conv. rate')}>conv. rate</p>
                    </div>
                    <button onClick={() => toggleMagnet(m.id, m.active)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${m.active ? '#10B981' : '#4A4438'}20`, background: 'transparent', color: m.active ? '#10B981' : '#4A4438', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
                      {m.active ? 'Live' : 'Paused'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Referral tiers */}
          <div style={{ ...card, padding: 20 }}>
            <p style={mono('Referral Reward Tiers', true, false)}>Referral Growth Engine</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#4A4438', marginTop: 4, marginBottom: 16 }}>Target: 30% of all new users from referrals by Month 6 · Lowest CAC · Highest LTV</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { trigger: 'Free user refers 1 paid user',   reward: '1 free month Premium · Referee gets 20% off first month' },
                { trigger: 'Free user refers 3 paid users',  reward: '3 months free + Community Champion badge' },
                { trigger: 'Paid user refers 2 paid users',  reward: '1 month free + early access to new features' },
                { trigger: 'Corporate referral (5+ seats)',  reward: '$50 cash via Paystack + enterprise relationship' },
                { trigger: 'Newsletter — refer 3 readers',   reward: 'Merch or premium coaching session (Beehiiv built-in)' },
              ].map((tier, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 14px', background: '#1E1C17', borderRadius: 8, border: '1px solid #2E2A22' }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', width: 260, flexShrink: 0 }}>{tier.trigger}</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260' }}>{tier.reward}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 5 — SOCIAL QUEUE                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'social' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionHeader eyebrow="Social Media Automation" title="Social Queue"
            right={<button onClick={() => setShowAddSocial(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Queue Post</button>}
          />

          {/* Platform priority */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {[
              { platform: 'LinkedIn',   priority: '#1', note: 'ICP lives here · organic reach strong · founder must post daily', color: '#0A66C2' },
              { platform: 'Twitter/X',  priority: '#2', note: 'African tech/business community · threads go viral', color: '#1DA1F2' },
              { platform: 'WhatsApp',   priority: '#3', note: '95%+ penetration · 3×/week · Mon/Wed/Fri cadence', color: '#25D366' },
              { platform: 'Instagram',  priority: '#4', note: 'Visual storytelling · carousels · younger segment', color: '#E1306C' },
              { platform: 'YouTube',    priority: 'M4+', note: 'Long-form coaching demos · highest SEO value', color: '#FF0000' },
              { platform: 'TikTok',     priority: 'M6+', note: 'Gen Z African professionals · short coaching tips', color: '#010101' },
            ].map(p => (
              <div key={p.platform} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#D4CFC3' }}>{p.platform}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: p.color, border: `1px solid ${p.color}30`, borderRadius: 100, padding: '2px 7px', letterSpacing: '0.06em' }}>{p.priority}</span>
                </div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#4A4438', margin: 0, lineHeight: 1.5 }}>{p.note}</p>
              </div>
            ))}
          </div>

          {/* Add form */}
          {showAddSocial && (
            <div style={{ ...card, padding: 20 }}>
              <p style={mono('Queue New Post', true, false)}>Queue New Post</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
                <div>
                  <label style={mono('Platform')}>Platform</label>
                  <select value={newSocial.platform} onChange={e => setNewSocial(p => ({ ...p, platform: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {PLATFORMS.map(pl => <option key={pl}>{pl}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mono('Content Pillar')}>Pillar</label>
                  <select value={newSocial.pillar} onChange={e => setNewSocial(p => ({ ...p, pillar: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                    {PILLARS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mono('Schedule Date/Time')}>Schedule</label>
                  <input type="datetime-local" value={newSocial.scheduled_for} onChange={e => setNewSocial(p => ({ ...p, scheduled_for: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={mono('Post Content')}>Content</label>
                <textarea value={newSocial.content} onChange={e => setNewSocial(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="Write your post..." style={{ ...inputStyle, marginTop: 6, lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={addSocial} disabled={!newSocial.content || !newSocial.scheduled_for} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#E8A020', color: '#0C0B08', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: (!newSocial.content || !newSocial.scheduled_for) ? 0.4 : 1 }}>Queue Post</button>
                <button onClick={() => setShowAddSocial(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2E2A22', background: 'transparent', color: '#7A7260', fontFamily: "'Syne', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Queue list */}
          {social.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#4A4438', letterSpacing: '0.1em' }}>QUEUE IS EMPTY — ADD POSTS OR CONNECT BUFFER API</p>
            </div>
          ) : (
            <div style={{ ...card, overflow: 'hidden' }}>
              {social.map((post, i) => {
                const pillar = PILLARS.find(p => p.id === post.pillar);
                return (
                  <div key={post.id} className="ma-row" style={{ padding: '16px 20px', borderBottom: i < social.length - 1 ? '1px solid #2E2A22' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#D4CFC3', fontWeight: 600 }}>{post.platform}</span>
                        <StatusBadge status={post.status as any} />
                        {pillar && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: pillar.color }}>{pillar.label.split(' ')[0]}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#4A4438' }}>
                          {post.scheduled_for ? new Date(post.scheduled_for).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <button onClick={() => deleteSocial(post.id)} style={{ background: 'none', border: 'none', color: '#4A4438', cursor: 'pointer', fontSize: 16 }}>×</button>
                      </div>
                    </div>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: '#7A7260', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{post.content}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monthly template */}
          <div style={{ ...card, padding: 20 }}>
            <p style={mono('Monthly Content Calendar Template', true, false)}>Monthly Theme Rotation</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              {[
                { week: 1, theme: 'Leadership Foundations',  mix: '2 LinkedIn long-form + 3 Twitter threads + 4 carousels + WhatsApp daily' },
                { week: 2, theme: 'African Success Stories', mix: 'Founder story + member spotlight + 1 viral Twitter poll + email newsletter' },
                { week: 3, theme: 'AI & Career Future',      mix: 'Thought leadership + coaching tip series + WhatsApp broadcast + 1 lead magnet push' },
                { week: 4, theme: 'Community & Conversion',  mix: 'Cohort preview + social proof + Founders Promo activation + monthly review post' },
              ].map(row => (
                <div key={row.week} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#1E1C17', borderRadius: 8 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', width: 52, flexShrink: 0, paddingTop: 1 }}>Week {row.week}</span>
                  <div>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: '#D4CFC3', margin: '0 0 2px' }}>{row.theme}</p>
                    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#4A4438', margin: 0 }}>{row.mix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 6 — AI AGENTS                                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'agents' && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <SectionHeader
            eyebrow="Automation Architecture"
            title="AI Agent Control Centre"
            right={
              <button onClick={() => load('agents')} style={{ ...inputStyle, width: 'auto', padding: '7px 14px', cursor: 'pointer', fontSize: 11 }}>
                ↻ Refresh Status
              </button>
            }
          />

          <div style={{ padding: '12px 16px', background: 'rgba(232,160,32,0.04)', border: '1px solid rgba(232,160,32,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#E8A020', margin: '0 0 4px', letterSpacing: '0.1em' }}>LIVE AGENTS — CONNECTED TO TRIGGER.DEV</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260', margin: 0 }}>
              Trigger agents manually · view last run status · monitor cron schedules · all runs logged to audit trail
            </p>
          </div>

          {agents.length === 0 && (
            <div style={{ ...card, padding: 40, textAlign: 'center' }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#4A4438', letterSpacing: '0.1em' }}>
                LOADING AGENTS... · Deploy Trigger.dev tasks first if this persists
              </p>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#4A4438', marginTop: 8 }}>
                Run <code style={{ color: '#E8A020' }}>npx trigger.dev@latest deploy</code> from your project root
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agents.map((agent, i) => {
              const isExpanded = expandedAgent === agent.id;
              const isTriggeringThis = triggering === agent.id;
              const myMsg = agentMsg?.id === agent.id ? agentMsg : null;

              return (
                <div key={agent.id} style={{ ...card, overflow: 'hidden' }}>
                  {/* Agent header row */}
                  <div
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
                    onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}
                  >
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 0 }}>
                      {/* Number badge */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: agent.status === 'building' ? 'rgba(74,68,56,0.3)' : 'rgba(232,160,32,0.1)',
                        border: `1.5px solid ${agent.status === 'building' ? '#2E2A22' : 'rgba(232,160,32,0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700,
                        color: agent.status === 'building' ? '#4A4438' : '#E8A020',
                      }}>{i + 1}</div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#FEF9EC', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {agent.name}
                        </p>
                        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 11, color: '#4A4438', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {agent.description}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                      <StatusBadge status={agent.status as any} />
                      <span style={{ color: '#4A4438', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #2E2A22', padding: '16px 20px', background: '#0F0E0C' }}>

                      {/* Stats row */}
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div>
                          <p style={mono('Schedule')}>Schedule</p>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#D4CFC3', margin: '3px 0 0' }}>{agent.schedule}</p>
                        </div>
                        <div>
                          <p style={mono('Last Run')}>Last Run</p>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: agent.lastRun ? '#D4CFC3' : '#4A4438', margin: '3px 0 0' }}>
                            {agent.lastRun || 'Never'}
                          </p>
                        </div>
                        <div>
                          <p style={mono('Last Status')}>Last Status</p>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, margin: '3px 0 0',
                            color: agent.lastStatus === 'COMPLETED' ? '#10B981' : agent.lastStatus === 'FAILED' ? '#EF4444' : '#4A4438',
                          }}>
                            {agent.lastStatus || '—'}
                          </p>
                        </div>
                        <div>
                          <p style={mono('Runs This Week')}>Runs This Week</p>
                          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#E8A020', margin: '3px 0 0', lineHeight: 1 }}>
                            {agent.runsThisWeek}
                          </p>
                        </div>
                        <div>
                          <p style={mono('Tool Stack')}>Tool Stack</p>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7260', margin: '3px 0 0' }}>{agent.toolStack}</p>
                        </div>
                        <div>
                          <p style={mono('Type')}>Type</p>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7260', margin: '3px 0 0', textTransform: 'capitalize' as const }}>{agent.type}</p>
                        </div>
                      </div>

                      {/* Payload fields for agents that need input */}
                      {agent.requiresPayload && agent.payloadSchema && (
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ ...mono('Payload', true), marginBottom: 8 }}>Run Parameters</p>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {Object.entries(agent.payloadSchema).map(([key, hint]) => (
                              <div key={key} style={{ flex: '1 1 160px', minWidth: 140 }}>
                                <label style={{ ...mono(key), display: 'block', marginBottom: 4 }}>{key}</label>
                                <input
                                  value={agentPayload[`${agent.id}:${key}`] || ''}
                                  onChange={e => setAgentPayload(p => ({ ...p, [`${agent.id}:${key}`]: e.target.value }))}
                                  placeholder={hint as string}
                                  style={{ ...inputStyle }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        {agent.canTrigger ? (
                          <button
                            onClick={() => {
                              const payload: Record<string, string> = {};
                              if (agent.payloadSchema) {
                                Object.keys(agent.payloadSchema).forEach(key => {
                                  payload[key] = agentPayload[`${agent.id}:${key}`] || '';
                                });
                              }
                              triggerAgent(agent.id, payload);
                            }}
                            disabled={isTriggeringThis}
                            style={{
                              padding: '8px 20px', borderRadius: 8, border: 'none',
                              background: isTriggeringThis ? '#2E2A22' : '#E8A020',
                              color: isTriggeringThis ? '#4A4438' : '#0C0B08',
                              fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 12,
                              cursor: isTriggeringThis ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isTriggeringThis ? '⏳ Triggering...' : '▶ Run Now'}
                          </button>
                        ) : (
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', padding: '8px 14px', border: '1px solid #2E2A22', borderRadius: 8 }}>
                            {agent.triggerTaskId ? 'SCHEDULED ONLY' : 'NOT YET BUILT'}
                          </span>
                        )}

                        {agent.triggerTaskId && (
                          <a
                            href={`https://cloud.trigger.dev/projects/v3/proj_zwrdqutfrrdneuwbjvxi/runs?tasks=${agent.triggerTaskId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7A7260', textDecoration: 'none', padding: '8px 14px', border: '1px solid #2E2A22', borderRadius: 8 }}
                          >
                            View in Trigger.dev ↗
                          </a>
                        )}
                      </div>

                      {/* Result message */}
                      {myMsg && (
                        <div style={{
                          marginTop: 12, padding: '10px 14px', borderRadius: 8,
                          background: myMsg.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          border: `1px solid ${myMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          fontFamily: "'DM Mono', monospace", fontSize: 11,
                          color: myMsg.ok ? '#10B981' : '#EF4444',
                          letterSpacing: '0.04em',
                        }}>
                          {myMsg.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Deployment banner */}
          <div style={{ ...card, padding: 20, border: '1px solid rgba(232,160,32,0.2)', background: 'rgba(232,160,32,0.03)' }}>
            <p style={mono('Deploy Trigger.dev Tasks First', true, false)}>Required: Deploy to Trigger.dev</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: '#7A7260', margin: '8px 0 14px', lineHeight: 1.7 }}>
              Agent controls won't work until tasks are deployed to Trigger.dev cloud. Run this command once from your project root:
            </p>
            <div style={{ padding: '12px 16px', background: '#0C0B08', borderRadius: 8, border: '1px solid #2E2A22' }}>
              <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#E8A020', letterSpacing: '0.04em' }}>
                npx trigger.dev@latest deploy
              </code>
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', margin: '10px 0 0', letterSpacing: '0.06em' }}>
              Add FOUNDER_EMAIL to .env.local for the Analytics Reporter weekly email
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
