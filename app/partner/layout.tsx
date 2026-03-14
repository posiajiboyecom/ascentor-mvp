// app/partner/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
// PARTNER PORTAL LAYOUT
// Accessible at: ascentorbi.com/partner
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

  // 2. Partner access check — user must own a row in the partners table.
  // Previously this checked profiles.role = 'partner', which is fragile:
  //   - The role field must be manually set and kept in sync
  //   - An admin visiting /partner would pass the check but have no partner row
  //   - A pending/rejected applicant with role='partner' would get access
  // Fix: the canonical source of truth is the partners table itself.
  // Ascentor admin (profiles.role = 'admin') retains full access for support.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const isAscentorAdmin = profile?.role === 'admin';

  // Check if user owns an active or pending partner account
  const { data: partnerCheck } = await supabase
    .from('partners')
    .select('id, status')
    .eq('owner_id', user.id)
    .single();

  const isPartnerOwner = !!partnerCheck;

  if (!isAscentorAdmin && !isPartnerOwner) {
    // Not a partner owner and not Ascentor admin — redirect to main app
    redirect('/dashboard');
  }

  // 3. Fetch this partner's config — FIX: was querying dead `tenants` table
  const { data: tenant } = await supabase
    .from('partners')
    .select('id, name, subdomain, brand, status')
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
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
              href={`https://${tenant.subdomain}.ascentorbi.com`}
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
            { href: '/partner',            label: 'Overview',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
            { href: '/partner/brand',      label: 'Branding',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
            { href: '/partner/ai/persona', label: 'AI Persona', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { href: '/partner/members',    label: 'Members',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg> },
            { href: '/partner/pricing',    label: 'Pricing',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
            { href: '/partner/revenue',      label: 'Revenue',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
            { href: '/partner/analytics',    label: 'Analytics',    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            { href: '/partner/courses',      label: 'Courses',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
            { href: '/partner/events',       label: 'Events',       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { href: '/partner/subscription', label: 'Subscription',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
            { href: '/partner/settings',     label: 'Settings',     icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
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
              {icon}
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
