'use client';

import type { Partner } from '@/types/partner';

// ============================================================
// components/partner/PartnerMemberShell.tsx
//
// Navigation wrapper for partner platform MEMBERS
// (not the partner admin — that's PartnerAdminShell).
//
// Shows a branded top bar with the partner logo and a
// bottom nav for mobile. Links are relative to the partner
// subdomain so /p/[subdomain]/dashboard, /p/[subdomain]/coach etc.
//
// Uses partner CSS vars from layout.tsx — fully branded.
// ============================================================

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  label: string;
  segment: string;
  icon: React.ReactNode;
}

function AdminIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>; }
function HomeIcon()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>; }
function CoachIcon()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function ExpertsIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>; }
function CommunityIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/></svg>; }
function AccountIcon()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a8 8 0 0 1 16 0v1"/></svg>; }

export default function PartnerMemberShell({
  children,
  partner,
  isOwner = false,
}: {
  children: React.ReactNode;
  isOwner?: boolean;
  partner: {
    subdomain: string;
    name: string;
    brand: {
      platform_name: string;
      logo_url: string | null;
      hide_ascentor_branding: boolean;
    };
    features: {
      ai_coach:  boolean;
      community: boolean;
      experts:   boolean;
      courses:   boolean;
    };
  };
}) {
  const pathname  = usePathname();
  const supabase  = createClient();
  const router    = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const sub = partner.subdomain;
  const brand = partner.brand;
  const features = partner.features;

  const navItems: NavItem[] = [
    { label: 'Home',      segment: 'dashboard',  icon: <HomeIcon /> },
    ...(features.ai_coach  ? [{ label: 'Mentor',    segment: 'coach',      icon: <CoachIcon /> }]     : []),
    ...(features.community ? [{ label: 'Circle',    segment: 'community',  icon: <CommunityIcon /> }] : []),
    ...(features.experts   ? [{ label: 'Sessions',  segment: 'sessions',   icon: <ExpertsIcon /> }]   : []),
    { label: 'Account',   segment: 'account',    icon: <AccountIcon /> },
  ];

  // Deduplicate by segment
  const uniqueNav = navItems.filter((item, idx, self) =>
    self.findIndex(i => i.segment === item.segment) === idx
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push(`/p/${sub}/login`);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56,
      }}>
        {/* Logo / platform name */}
        <Link href={`/p/${sub}/dashboard`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.platform_name} style={{ height: 28, width: 'auto' }} />
            : <span style={{
                fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700,
                color: 'var(--accent)',
              }}>
                {brand.platform_name}
              </span>
          }
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="partner-desktop-nav">
          {uniqueNav.map(item => {
            const href    = `/p/${sub}/${item.segment}`;
            const active  = pathname.includes(`/p/${sub}/${item.segment}`);
            return (
              <Link key={item.segment} href={href} style={{
                padding: '6px 14px', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                color: active ? 'var(--accent)' : 'var(--text-dim)',
                background: active ? 'rgba(var(--accent-rgb, 232,160,32), 0.08)' : 'transparent',
                textDecoration: 'none', transition: 'color 0.15s, background 0.15s',
              }}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: admin link + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isOwner && (
            <Link
              href="/partner/brand"
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: 'rgba(232,160,32,0.10)',
                border: '1px solid rgba(232,160,32,0.30)',
                color: 'var(--accent)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              Admin
            </Link>
          )}
          <button
            onClick={handleSignOut}
            style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-dim)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Owner admin banner ───────────────────────────────── */}
      {isOwner && (
        <div style={{
          background: 'rgba(232,160,32,0.06)',
          borderBottom: '1px solid rgba(232,160,32,0.15)',
          padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            You are viewing your platform as a member.
          </p>
          <Link
            href="/partner/brand"
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--accent)',
              textDecoration: 'none', whiteSpace: 'nowrap',
              padding: '4px 12px', borderRadius: 6,
              border: '1px solid rgba(232,160,32,0.30)',
              background: 'rgba(232,160,32,0.08)',
            }}
          >
            Go to Admin Panel →
          </Link>
        </div>
      )}

      {/* ── Page content ────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '0 0 80px' }}>
        {children}
      </main>

      {/* ── Bottom nav (mobile) ──────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        height: 60, padding: '0 8px',
      }} className="partner-bottom-nav">
        {uniqueNav.map(item => {
          const href   = `/p/${sub}/${item.segment}`;
          const active = pathname.includes(`/p/${sub}/${item.segment}`);
          return (
            <Link key={item.segment} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '6px 12px', borderRadius: 10,
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              textDecoration: 'none', transition: 'color 0.15s',
            }}>
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Powered by footer ────────────────────────────────── */}
      {!brand.hide_ascentor_branding && (
        <div style={{
          textAlign: 'center', paddingBottom: 70, fontSize: 10,
          color: 'var(--text-dim)', opacity: 0.5,
        }}>
          Powered by{' '}
          <a href="https://ascentorbi.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Ascentor
          </a>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .partner-bottom-nav { display: none !important; }
          .partner-desktop-nav { display: flex !important; }
        }
        @media (max-width: 767px) {
          .partner-desktop-nav { display: none !important; }
          .partner-bottom-nav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
