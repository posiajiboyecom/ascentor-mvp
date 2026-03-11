'use client';

// ============================================================
// components/partner/PartnerMemberShell.tsx
//
// Partner platform member wrapper — rebuilt:
// ✦ Top bar: logo + account avatar dropdown + admin button
// ✦ Bottom nav only (no top nav links)
// ✦ Nav includes: Home, Learn, Mentor, Circle, Sessions
// ✦ Account as dropdown (avatar → settings, plan, sign out)
// ✦ Owner banner: slim, dismissible
// ============================================================

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

interface NavItem {
  label: string;
  segment: string;
  icon: React.ReactNode;
}

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/>
  </svg>
);
const LearnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);
const CoachIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const CommunityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/>
    <path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><path d="M18 14a3 3 0 0 1 3 3v1"/>
  </svg>
);
const SessionsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
);
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
);
const PlanIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);
const AdminIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
);
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
);

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(232,160,32,0.15)',
      border: '1.5px solid rgba(232,160,32,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 700, color: 'var(--accent)',
      flexShrink: 0, cursor: 'pointer',
      fontFamily: "'Syne', system-ui, sans-serif",
    }}>
      {initials}
    </div>
  );
}

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
  const pathname    = usePathname();
  const supabase    = createClient();
  const router      = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const [userName, setUserName]               = useState('');
  const [userEmail, setUserEmail]             = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const sub      = partner.subdomain;
  const brand    = partner.brand;
  const features = partner.features;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email || '');
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single();
      setUserName(profile?.full_name || user.email?.split('@')[0] || 'Member');
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems: NavItem[] = [
    { label: 'Home',     segment: 'dashboard',  icon: <HomeIcon /> },
    ...(features.courses   ? [{ label: 'Learn',    segment: 'courses',    icon: <LearnIcon /> }]     : []),
    ...(features.ai_coach  ? [{ label: 'Mentor',   segment: 'coach',      icon: <CoachIcon /> }]     : []),
    ...(features.community ? [{ label: 'Circle',   segment: 'community',  icon: <CommunityIcon /> }] : []),
    ...(features.experts   ? [{ label: 'Sessions', segment: 'sessions',   icon: <SessionsIcon /> }]  : []),
  ];

  const isActive = (segment: string) =>
    pathname === `/p/${sub}/${segment}` || pathname.startsWith(`/p/${sub}/${segment}/`);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push(`/p/${sub}/login`);
  }

  const menuItem = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button key={label} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', padding: '10px 14px',
      border: 'none', background: 'transparent',
      color: danger ? '#EF4444' : 'var(--text)',
      fontSize: 13, cursor: 'pointer', textAlign: 'left' as const,
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <span style={{ opacity: 0.7 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 54,
      }}>
        <Link href={`/p/${sub}/dashboard`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.platform_name} style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            : <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                {brand.platform_name}
              </span>
          }
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isOwner && (
            <Link href="/partner/brand" style={{
              padding: '5px 11px', borderRadius: 8,
              background: 'rgba(232,160,32,0.10)',
              border: '1px solid rgba(232,160,32,0.30)',
              color: 'var(--accent)', fontSize: 11, fontWeight: 700,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <AdminIcon /> Admin
            </Link>
          )}

          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button onClick={() => setDropdownOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: dropdownOpen ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: '1px solid var(--border)', borderRadius: 20,
              padding: '3px 10px 3px 4px', cursor: 'pointer',
            }}>
              <Avatar name={userName || 'M'} size={28} />
              <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600,
                maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName.split(' ')[0] || 'Account'}
              </span>
              <span style={{
                color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
                transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
              }}>
                <ChevronIcon />
              </span>
            </button>

            {dropdownOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden', minWidth: 200,
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  padding: '12px 14px', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Avatar name={userName || 'M'} size={36} />
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {userName}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {userEmail}
                    </p>
                  </div>
                </div>
                {menuItem(<SettingsIcon />, 'Account Settings', () => { router.push(`/p/${sub}/account`); setDropdownOpen(false); })}
                {menuItem(<PlanIcon />, 'My Plan', () => { router.push(`/p/${sub}/checkout`); setDropdownOpen(false); })}
                <div style={{ borderTop: '1px solid var(--border)' }} />
                {menuItem(<SignOutIcon />, 'Sign out', () => { setDropdownOpen(false); handleSignOut(); }, true)}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Owner banner ─────────────────────────────────────── */}
      {isOwner && !bannerDismissed && (
        <div style={{
          background: 'rgba(232,160,32,0.05)',
          borderBottom: '1px solid rgba(232,160,32,0.12)',
          padding: '7px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 11, color: 'rgba(232,160,32,0.8)', fontWeight: 600 }}>
            Previewing as member ·{' '}
            <Link href="/partner/brand" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Go to Admin Panel →
            </Link>
          </p>
          <button onClick={() => setBannerDismissed(true)} style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: 2,
          }}>
            <XIcon />
          </button>
        </div>
      )}

      {/* ── Page content ─────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '24px 16px 96px' }}>
        {children}
      </main>

      {/* ── Bottom navigation ─────────────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        height: 62, padding: '0 4px',
      }}>
        {navItems.map(item => {
          const active = isActive(item.segment);
          return (
            <Link key={item.segment} href={`/p/${sub}/${item.segment}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '6px 14px', borderRadius: 10,
              color: active ? 'var(--accent)' : 'var(--text-dim)',
              textDecoration: 'none', position: 'relative', minWidth: 52,
            }}>
              {active && (
                <span style={{
                  position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)',
                }} />
              )}
              <span style={{ opacity: active ? 1 : 0.55 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {!brand.hide_ascentor_branding && (
        <div style={{ textAlign: 'center', paddingBottom: 70, fontSize: 10, color: 'var(--text-dim)', opacity: 0.4 }}>
          Powered by{' '}
          <a href="https://ascentorbi.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ascentor</a>
        </div>
      )}
    </div>
  );
}
