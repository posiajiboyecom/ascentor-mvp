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
    </div>
  );
}
