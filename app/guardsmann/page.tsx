'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function GuardsmannOverview() {
  const [stats, setStats] = useState({
    postsGenerated: 0,
    jobsSaved: 0,
    applicationsTracked: 0,
    lastGenerated: null as string | null,
  });

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('social_queue').select('*', { count: 'exact', head: true }).eq('pillar', 'personal'),
      supabase.from('guardsmann_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('guardsmann_applications').select('*', { count: 'exact', head: true }),
      supabase.from('social_queue').select('created_at').eq('pillar', 'personal').order('created_at', { ascending: false }).limit(1),
    ]).then(([posts, jobs, apps, last]) => {
      setStats({
        postsGenerated:      posts.count || 0,
        jobsSaved:           jobs.count  || 0,
        applicationsTracked: apps.count  || 0,
        lastGenerated:       (last.data?.[0] as any)?.created_at || null,
      });
    });
  }, []);

  const statCards = [
    { label: 'Posts in Queue',        value: stats.postsGenerated,      href: '/guardsmann/content', colour: '#E8A020' },
    { label: 'Jobs Saved',            value: stats.jobsSaved,           href: '/guardsmann/jobs',    colour: '#10B981' },
    { label: 'Applications Tracked',  value: stats.applicationsTracked, href: '/guardsmann/tracker', colour: '#60A5FA' },
  ];

  const quickActions = [
    { label: '⚡ Generate GRC Post',  href: '/guardsmann/content', desc: 'LinkedIn + Twitter from 7 GRC pillars' },
    { label: '🔍 Search Remote Jobs', href: '/guardsmann/jobs',    desc: 'GRC roles open to foreign remote — USD pay' },
    { label: '📋 Log Application',    href: '/guardsmann/tracker', desc: 'Track every application and follow-up' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#F5F3EE', marginBottom: 6 }}>
          Guardsmann
        </h1>
        <p style={{ fontSize: 13, color: 'var(--gm-muted)', fontFamily: 'var(--gm-font-mono)', letterSpacing: '0.04em' }}>
          GRC AUTHORITY ENGINE · REMOTE GLOBAL ROLES · USD COMPENSATION
        </p>
      </div>

      {/* Strategy brief */}
      <div className="gm-card" style={{ marginBottom: 24, borderLeft: '3px solid var(--gm-gold)' }}>
        <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-gold)', letterSpacing: '0.08em', marginBottom: 12 }}>
          MISSION
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {[
            { label: 'Target roles', value: 'GRC Analyst · Risk Analyst · Compliance Analyst · InfoSec Analyst' },
            { label: 'Content mix',  value: '80% GRC (frameworks, risk, compliance, audit) · 20% Technical' },
            { label: 'Job criteria', value: 'Remote · USD pay · Global companies · Open to foreign applicants' },
            { label: 'Goal',         value: 'Well-paying remote GRC role · Global standard compensation' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 9, color: 'var(--gm-muted)', letterSpacing: '0.06em', marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: 'var(--gm-text)', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {statCards.map(s => (
          <Link href={s.href} key={s.label} style={{ textDecoration: 'none' }}>
            <div className="gm-card" style={{ borderTop: `3px solid ${s.colour}`, cursor: 'pointer' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.colour, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', letterSpacing: '0.05em' }}>{s.label.toUpperCase()}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 8, fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', letterSpacing: '0.08em' }}>
        QUICK ACTIONS
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {quickActions.map(a => (
          <Link href={a.href} key={a.label} style={{ textDecoration: 'none' }}>
            <div className="gm-card" style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,160,32,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(212,207,195,0.10)')}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gm-text)', marginBottom: 6 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: 'var(--gm-muted)' }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Push notifications */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontFamily: 'var(--gm-font-mono)', fontSize: 10, color: 'var(--gm-muted)', marginBottom: 12, letterSpacing: '0.08em' }}>
          JOB ALERTS
        </div>
        <PushToggle />
      </div>
    </div>
  );
}

// ── Push notification toggle ──────────────────────────────────────────────
function PushToggle() {
  const [status,  setStatus]  = useState<'idle' | 'granted' | 'denied' | 'requesting' | 'unsupported'>('idle');
  const [testing, setTesting] = useState(false);
  const [toast,   setToast]   = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    const p = (window as any).Notification?.permission;
    if (p === 'granted') setStatus('granted');
    else if (p === 'denied') setStatus('denied');
    else setStatus('idle');
  }, []);

  async function enable() {
    setStatus('requesting');
    try {
      const permission = await (window as any).Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }
      const reg     = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      let sub = existing;
      if (!sub) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) { setStatus('idle'); return; }
        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64  = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw     = atob(base64);
        const key     = Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key.buffer as ArrayBuffer });
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (res.ok) { setStatus('granted'); localStorage.setItem('push_granted', '1'); }
      else setStatus('idle');
    } catch { setStatus('idle'); }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res  = await fetch('/api/guardsmann/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      const data = await res.json();
      setToast(data.ok ? 'Test push sent — check your phone' : 'Error: ' + (data.error || 'unknown'));
    } catch (e: any) { setToast('Error: ' + e.message); }
    setTesting(false);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="gm-card" style={{ borderLeft: '3px solid var(--gm-gold)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: status === 'granted' ? 'rgba(16,185,129,0.12)' : 'rgba(232,160,32,0.10)',
            border: `1px solid ${status === 'granted' ? 'rgba(16,185,129,0.3)' : 'rgba(232,160,32,0.25)'}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={status === 'granted' ? '#10B981' : '#E8A020'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F3EE', marginBottom: 2 }}>
              {status === 'granted' ? 'Job alerts active' : 'Enable job alerts on your phone'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gm-muted)' }}>
              {status === 'granted'
                ? 'Guardsmann scans for fresh GRC jobs 3× daily — 07:00, 13:00, 18:00 WAT — and pushes when it finds something'
                : status === 'denied'
                ? 'Notifications blocked in browser settings — enable in Settings → Safari/Chrome → Notifications'
                : status === 'unsupported'
                ? 'Push not supported in this browser — open the app in Safari on iOS or Chrome on Android'
                : 'Get notified within seconds when fresh GRC jobs are posted — 3× daily auto-scan'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {status === 'granted' && (
            <button className="gm-btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={sendTest} disabled={testing}>
              {testing ? 'Sending…' : '🧪 Test Push'}
            </button>
          )}
          {(status === 'idle' || status === 'requesting') && (
            <button className="gm-btn-primary" onClick={enable} disabled={status === 'requesting'}>
              {status === 'requesting' ? 'Enabling…' : '🔔 Enable Alerts'}
            </button>
          )}
          {status === 'denied' && (
            <span className="gm-badge gm-badge-red" style={{ fontSize: 11, padding: '6px 12px' }}>Blocked in settings</span>
          )}
          {status === 'granted' && (
            <span className="gm-badge gm-badge-green" style={{ fontSize: 11, padding: '6px 12px' }}>✓ Active</span>
          )}
        </div>
      </div>
      {toast && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          fontFamily: 'var(--gm-font-mono)', fontSize: 11, color: '#10B981' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
