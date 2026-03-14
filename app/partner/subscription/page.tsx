'use client';
// app/partner/subscription/page.tsx
// Shows current plan, billing details, usage meters, tier comparison table,
// and upgrade/downgrade request form.
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';

const S: Record<string,React.CSSProperties> = {
  card:  { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'20px', marginBottom:'16px' },
  label: { fontSize:'11px', fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'rgba(255,255,255,0.35)', marginBottom:'4px', display:'block' },
  btn:   { padding:'10px 22px', borderRadius:'8px', border:'none', fontSize:'13px', fontWeight:600, cursor:'pointer' },
};

function Bar({ pct, color='#E8A020' }: { pct:number; color?:string }) {
  return (
    <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:'4px', height:'6px', overflow:'hidden', marginTop:'6px' }}>
      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:pct>=90?'#EF4444':color, borderRadius:'4px', transition:'width 0.5s' }} />
    </div>
  );
}

function Check({ on }: { on:boolean }) {
  return on
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

const TIER_ORDER = ['starter','growth','pro'] as const;
const TIER_LABELS: Record<string,string> = { starter:'Starter', growth:'Growth', pro:'Pro' };
const FEATURE_LABELS: Record<string,string> = {
  customDomain:       'Custom domain',
  customAiPersona:    'Custom AI persona',
  ownCourses:         'Create own courses',
  ownEvents:          'Schedule expert events',
  hideAscentorBrand:  'Hide Ascentor branding',
  ragKnowledgeBase:   'AI knowledge base (RAG)',
  fullAnalytics:      'Full analytics dashboard',
  perMemberAnalytics: 'Per-member analytics',
  prioritySupport:    'Priority support',
};

export default function PartnerSubscriptionPage() {
  const [data,        setData]        = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [requesting,  setRequesting]  = useState(false);
  const [requested,   setRequested]   = useState(false);
  const [requestMsg,  setRequestMsg]  = useState('');
  const [cycle,       setCycle]       = useState<'monthly'|'annual'>('monthly');
  const [targetTier,  setTargetTier]  = useState<string>('');

  useEffect(() => {
    fetch('/api/partner/subscription')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    if (!targetTier) return;
    setRequesting(true);
    const res  = await fetch('/api/partner/subscription', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ requested_tier: targetTier, billing_cycle: cycle }),
    });
    const d = await res.json();
    setRequesting(false);
    if (res.ok) { setRequested(true); setRequestMsg(d.message); }
    else setRequestMsg(d.error || 'Failed to submit request.');
  };

  if (loading) return <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px' }}>Loading…</div>;
  if (!data)   return <div style={{ color:'#EF4444', fontSize:'13px' }}>Failed to load subscription data.</div>;

  const { plan, usage, subscription: sub, allTiers } = data;
  const currentTier = plan?.tier || 'starter';

  const fmt = (n: number) => `₦${n.toLocaleString('en-NG')}`;
  const maxLabel = (n: number) => n === -1 ? '∞' : n === 0 ? '—' : String(n);

  return (
    <div style={{ maxWidth:'640px' }}>
      <h1 style={{ fontSize:'20px', fontWeight:500, color:'#f8fafc', marginBottom:'4px' }}>Subscription</h1>
      <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'28px' }}>Your current plan and billing details.</p>

      {/* Current plan card */}
      <div style={{ ...S.card, border:`1px solid rgba(232,160,32,0.25)`, background:'rgba(232,160,32,0.04)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <span style={{ fontSize:'11px', fontWeight:700, color:'#E8A020', textTransform:'uppercase', letterSpacing:'0.06em' }}>Current plan</span>
            <h2 style={{ fontSize:'28px', fontWeight:500, color:'#f8fafc', margin:'4px 0 2px' }}>{plan?.name}</h2>
            <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', margin:0 }}>{fmt(plan?.monthlyNgn)}/month · {plan?.revenueShare}% revenue share</p>
          </div>
          <div style={{ textAlign:'right' }}>
            {sub && (
              <>
                <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)' }}>Next billing</span>
                <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.6)', margin:'2px 0 0' }}>
                  {new Date(sub.current_period_end).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Usage meters */}
      <div style={S.card}>
        <p style={{ fontSize:'13px', fontWeight:600, color:'#f8fafc', marginBottom:'16px' }}>Usage this period</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' }}>
          {[
            { label:'Members', cur: usage?.members?.current, max: usage?.members?.max, pct: usage?.members?.pct },
            { label:'Courses',  cur: usage?.courses?.current, max: usage?.courses?.max, pct: usage?.courses?.pct },
            { label:'Events this month', cur: usage?.eventsThisMonth?.current, max: usage?.eventsThisMonth?.max, pct: usage?.eventsThisMonth?.max > 0 ? Math.round((usage.eventsThisMonth.current/usage.eventsThisMonth.max)*100) : 0 },
          ].map(({ label, cur, max, pct }) => (
            <div key={label}>
              <span style={S.label}>{label}</span>
              <p style={{ fontSize:'22px', fontWeight:500, color:'#f8fafc', margin:0 }}>
                {cur ?? 0}<span style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>/{maxLabel(max ?? 0)}</span>
              </p>
              {max > 0 && <Bar pct={pct ?? 0} />}
              {max === -1 && <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', marginTop:'4px' }}>Unlimited</p>}
              {max === 0 && <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', marginTop:'4px' }}>Not on this plan</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Plan comparison */}
      <div style={S.card}>
        <p style={{ fontSize:'13px', fontWeight:600, color:'#f8fafc', marginBottom:'16px' }}>Plan comparison</p>

        {/* Billing cycle toggle */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
          {(['monthly','annual'] as const).map(c => (
            <button key={c} onClick={() => setCycle(c)} style={{ padding:'5px 14px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.1)', fontSize:'12px', background: cycle===c ? 'rgba(255,255,255,0.1)' : 'transparent', color: cycle===c ? '#f8fafc' : 'rgba(255,255,255,0.4)', cursor:'pointer', fontWeight: cycle===c ? 600 : 400 }}>
              {c.charAt(0).toUpperCase()+c.slice(1)} {c==='annual' && <span style={{ color:'#10B981', fontSize:'10px' }}>2 months free</span>}
            </button>
          ))}
        </div>

        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px', gap:'4px', marginBottom:'6px' }}>
          <div />
          {TIER_ORDER.map(t => (
            <div key={t} style={{ textAlign:'center' }}>
              <p style={{ fontSize:'12px', fontWeight:700, color: t===currentTier?'#E8A020':'rgba(255,255,255,0.5)', margin:0 }}>{TIER_LABELS[t]}</p>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.3)', margin:'2px 0 0' }}>
                {fmt(cycle==='annual' ? allTiers?.[t]?.annualNgn : allTiers?.[t]?.monthlyNgn)}{cycle==='monthly'?'/mo':'/yr'}
              </p>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'8px' }}>
          {/* Limits row */}
          {[
            { label:'Members',       vals: TIER_ORDER.map(t => maxLabel(allTiers?.[t]?.maxMembers)) },
            { label:'Courses',       vals: TIER_ORDER.map(t => maxLabel(allTiers?.[t]?.maxCourses)) },
            { label:'Events/month',  vals: TIER_ORDER.map(t => maxLabel(allTiers?.[t]?.maxEventsPerMonth)) },
            { label:'Revenue share', vals: TIER_ORDER.map(t => `${allTiers?.[t]?.revenueShare}%`) },
          ].map(({ label, vals }) => (
            <div key={label} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px', gap:'4px', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{label}</span>
              {vals.map((v, i) => (
                <div key={i} style={{ textAlign:'center' }}>
                  <span style={{ fontSize:'12px', fontWeight:600, color: TIER_ORDER[i]===currentTier?'#f8fafc':'rgba(255,255,255,0.45)' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
          {/* Feature rows */}
          {Object.entries(FEATURE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display:'grid', gridTemplateColumns:'1fr 90px 90px 90px', gap:'4px', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{label}</span>
              {TIER_ORDER.map(t => (
                <div key={t} style={{ display:'flex', justifyContent:'center' }}>
                  <Check on={allTiers?.[t]?.features?.[key] ?? false} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade / downgrade */}
      {!requested ? (
        <div style={S.card}>
          <p style={{ fontSize:'13px', fontWeight:600, color:'#f8fafc', marginBottom:'12px' }}>Change plan</p>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as const, marginBottom:'16px' }}>
            {TIER_ORDER.filter(t => t !== currentTier).map(t => (
              <button key={t} onClick={() => setTargetTier(t)} style={{ padding:'8px 18px', borderRadius:'7px', fontSize:'13px', fontWeight:600, cursor:'pointer', border:`1px solid ${targetTier===t?'rgba(232,160,32,0.5)':'rgba(255,255,255,0.1)'}`, background: targetTier===t?'rgba(232,160,32,0.1)':'transparent', color: targetTier===t?'#E8A020':'rgba(255,255,255,0.5)' }}>
                {TIER_LABELS[t]} — {fmt(cycle==='annual' ? allTiers?.[t]?.annualNgn : allTiers?.[t]?.monthlyNgn)}/{cycle==='annual'?'yr':'mo'}
              </button>
            ))}
          </div>
          <button onClick={handleUpgrade} disabled={!targetTier || requesting} style={{ ...S.btn, background: targetTier?'#E8A020':'rgba(255,255,255,0.08)', color: targetTier?'#0C0B08':'rgba(255,255,255,0.3)', opacity: requesting?0.7:1 }}>
            {requesting ? 'Submitting…' : `Request plan change`}
          </button>
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.25)', marginTop:'10px' }}>
            Plan changes are processed within 24 hours. Our team will contact you to complete payment.
          </p>
        </div>
      ) : (
        <div style={{ ...S.card, border:'1px solid rgba(16,185,129,0.2)', background:'rgba(16,185,129,0.05)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <p style={{ fontSize:'14px', fontWeight:600, color:'#10B981', margin:0 }}>Request submitted</p>
          </div>
          <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.5)', margin:0 }}>{requestMsg}</p>
        </div>
      )}
    </div>
  );
}
