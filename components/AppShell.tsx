'use client';

import BottomNav from './BottomNav';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NotificationBell } from '@/components/Notifications';
import { AppThemeProvider, useAppTheme } from '@/components/AppThemeProvider';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AppShell · Brand Book v1.0 · 2026
// Header + BottomNav wrapper for all authenticated pages
// Supports light / dark theme toggle (mirrors admin pattern)
// ─────────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { isDark, toggle } = useAppTheme();
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width:           '34px',
        height:          '34px',
        borderRadius:    '8px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'var(--app-bg-card)',
        border:          '1px solid var(--app-border)',
        color:           'var(--app-text-dim)',
        cursor:          'pointer',
        transition:      'background 0.15s, border-color 0.15s, color 0.15s',
        flexShrink:      0,
      }}
    >
      {isDark ? (
        /* Sun icon — shown in dark mode, click to go light */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* Moon icon — shown in light mode, click to go dark */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

function Shell({
  children,
  initials,
  isAdmin,
  chatLayout,
}: {
  children: React.ReactNode;
  initials: string;
  isAdmin?: boolean;
  chatLayout?: boolean;
}) {
  const supabase        = createClient();
  const router          = useRouter();
  const { isDark }      = useAppTheme();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const logoSrc = isDark
    ? '/ascentor-color-on-dark.svg'
    : '/ascentor-color-on-light.svg';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)' }}>

      {/* ── Header ── */}
      <header style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        display:              'flex',
        justifyContent:       'space-between',
        alignItems:           'center',
        padding:              '12px 20px',
        borderBottom:         '1px solid var(--app-border)',
        background:           'var(--app-bg-card)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img
            src={logoSrc}
            alt="Ascentor"
            onError={e => { (e.target as HTMLImageElement).src = '/ascentor-color-on-dark.svg'; }}
            style={{ height: '28px', width: 'auto' }}
          />
        </Link>

        {/* Right: theme toggle + bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ThemeToggle />
          <NotificationBell />

          {/* Avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                width:          '34px',
                height:         '34px',
                borderRadius:   '50%',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'rgba(232,160,32,0.12)',
                border:         '1.5px solid rgba(232,160,32,0.35)',
                color:          '#E8A020',
                fontFamily:     "'Syne', system-ui, sans-serif",
                fontSize:       '12px',
                fontWeight:     700,
                cursor:         'pointer',
                letterSpacing:  '0.04em',
              }}
            >
              {initials}
            </button>

            {showMenu && (
              <div style={{
                position:     'absolute',
                right:        0,
                marginTop:    '8px',
                width:        '180px',
                borderRadius: '10px',
                padding:      '6px 0',
                background:   'var(--app-bg-card)',
                border:       '1px solid var(--app-border)',
                zIndex:       50,
                boxShadow:    '0 8px 32px rgba(0,0,0,0.25)',
              }}>
                
                {/* ── Optional: Show Admin Link if isAdmin is true ── */}
                {isAdmin && (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setShowMenu(false)}
                      style={{ display: 'block', padding: '10px 16px', fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 600, color: '#10B981', textDecoration: 'none' }}
                    >
                      Admin Dashboard
                    </Link>
                    <div style={{ height: '1px', background: 'var(--app-border)', margin: '4px 0' }} />
                  </>
                )}

                <Link
                  href="/referral"
                  onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 500, color: '#E8A020', textDecoration: 'none' }}
                >
                  Invite &amp; Earn
                </Link>
                <Link
                  href="/account"
                  onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 400, color: 'var(--app-text)', textDecoration: 'none' }}
                >
                  Settings
                </Link>
                <div style={{ height: '1px', background: 'var(--app-border)', margin: '4px 0' }} />
                <button
                  onClick={handleSignOut}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 400, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
      )}

      {/* Page content */}
      <main style={chatLayout
        ? { flex: 1, width: '100%', maxWidth: '672px', margin: '0 auto', padding: '0 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }
        : { flex: 1, width: '100%', maxWidth: '672px', margin: '0 auto', padding: '0 20px 96px', overflowY: 'auto' }
      }>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

// Wrap Shell in the theme provider so every child can useAppTheme()
export default function AppShell({
  children,
  initials = 'U',
  isAdmin = false,
  chatLayout = false,
}: {
  children: React.ReactNode;
  initials?: string;
  isAdmin?: boolean;
  chatLayout?: boolean;
}) {
  return (
    <AppThemeProvider>
      <Shell initials={initials} isAdmin={isAdmin} chatLayout={chatLayout}>{children}</Shell>
    </AppThemeProvider>
  );
}