// app/partner/page.tsx
// Partner portal overview — shows key stats and quick actions

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

export default async function PartnerOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null; // layout handles the redirect

  // Fetch tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  // Fetch basic stats
  const stats = { users: 0, sessions: 0, activeSubscriptions: 0 };

  if (tenant) {
    const [usersRes, sessionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id),
      supabase
        .from('coaching_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id),
    ]);
    stats.users = usersRes.count || 0;
    stats.sessions = sessionsRes.count || 0;
  }

  // Setup checklist
  const checklist = [
    {
      done: !!(tenant?.logo_url),
      label: 'Upload your logo',
      href: '/partner/branding',
    },
    {
      done: !!(tenant?.accent_color && tenant.accent_color !== '#14b8a6'),
      label: 'Set your brand colours',
      href: '/partner/branding',
    },
    {
      done: !!(tenant?.ai_persona_prompt && tenant.ai_persona_prompt.length > 100),
      label: 'Configure AI coach persona',
      href: '/partner/ai-persona',
    },
    {
      done: stats.users > 0,
      label: 'Invite your first user',
      href: '/partner/users',
    },
  ];

  const setupDone = checklist.filter((c) => c.done).length;

  return (
    <div>
      <h1
        style={{ fontSize: '22px', fontWeight: 500, marginBottom: '6px', color: '#f8fafc' }}
      >
        Welcome back{tenant ? `, ${tenant.name}` : ''}
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '32px' }}>
        {tenant
          ? `Your platform is live at ${tenant.subdomain}.ascentor.co`
          : 'Complete setup to launch your platform'}
      </p>

      {/* Setup progress */}
      {setupDone < checklist.length && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontWeight: 500, fontSize: '14px' }}>
              Setup checklist
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              {setupDone}/{checklist.length} done
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              marginBottom: '16px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(setupDone / checklist.length) * 100}%`,
                background: '#14b8a6',
                borderRadius: '2px',
                transition: 'width 0.5s',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {checklist.map(({ done, label, href }) => (
              <Link
                key={label}
                href={done ? '#' : href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
                  textDecoration: 'none',
                  opacity: done ? 0.6 : 1,
                }}
              >
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: done ? 'none' : '1.5px solid rgba(255,255,255,0.3)',
                    background: done ? '#14b8a6' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : ''}
                </span>
                {label}
                {!done && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>
                    →
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {[
          { label: 'Total users', value: stats.users },
          { label: 'Coaching sessions', value: stats.sessions },
          { label: 'Active plans', value: stats.activeSubscriptions },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: '24px', fontWeight: 500, color: '#f8fafc' }}>
              {value.toLocaleString()}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Link
          href="/partner/branding"
          style={{
            padding: '10px 18px',
            background: 'rgba(20,184,166,0.15)',
            border: '1px solid rgba(20,184,166,0.3)',
            borderRadius: '8px',
            color: '#14b8a6',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Edit branding →
        </Link>
        <Link
          href="/partner/ai-persona"
          style={{
            padding: '10px 18px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Configure AI Persona →
        </Link>
        <Link
          href="/partner/users"
          style={{
            padding: '10px 18px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          View users →
        </Link>
      </div>
    </div>
  );
}
