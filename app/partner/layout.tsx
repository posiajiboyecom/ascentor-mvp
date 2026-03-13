// app/partner/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PARTNER PORTAL LAYOUT
// Accessible at: ascentor.co/partner
//
// This is the admin/settings portal for white-label partners (licensees).
// It is completely separate from the main app and the tenant subdomain system.
//
// A "partner" is an organisation that has licensed Ascentor to create their
// own branded coaching platform (their subdomain). This portal lets them:
//   - Set their brand (logo, colours, AI persona prompt)
//   - View their users and usage
//   - Configure payment plans
//   - Invite team members
//
// ACCESS CONTROL:
//   - User must be logged in
//   - User must have role = 'partner' in the profiles table
//   - If not, redirect to /login
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Partner Portal',
    template: '%s | Ascentor Partner Portal',
  },
};

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/partner');
  }

  // 2. Role check — must be a partner
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || !['partner', 'admin'].includes(profile.role || '')) {
    // Not a partner — redirect to main app
    redirect('/dashboard');
  }

  // 3. Fetch this partner's tenant config
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, subdomain, accent_color')
    .eq('owner_id', user.id)
    .single();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Partner Portal Top Nav */}
      <header
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0f172a',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>⬆</span>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>Partner Portal</span>
          {tenant && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 4px' }}>/</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                {tenant.name}
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {tenant && (
            <a
              href={`https://${tenant.subdomain}.ascentor.co`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                textDecoration: 'none',
              }}
            >
              ↗ View site
            </a>
          )}
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            {profile.full_name || user.email}
          </span>
        </div>
      </header>

      {/* Side Nav + Content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar */}
        <nav
          style={{
            width: '200px',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            padding: '24px 0',
            flexShrink: 0,
          }}
        >
          {[
            { href: '/partner', label: 'Overview', icon: '◻' },
            { href: '/partner/branding', label: 'Branding', icon: '🎨' },
            { href: '/partner/ai-persona', label: 'AI Persona', icon: '🤖' },
            { href: '/partner/users', label: 'Users', icon: '👥' },
            { href: '/partner/billing', label: 'Billing', icon: '💳' },
            { href: '/partner/settings', label: 'Settings', icon: '⚙' },
          ].map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '14px' }}>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, padding: '32px', maxWidth: '900px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
