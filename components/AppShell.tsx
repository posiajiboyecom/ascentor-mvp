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
        fontSize:        '16px',
        transition:      'background 0.15s, border-color 0.15s',
        flexShrink:      0,
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

function Shell({
  children,
  initials,
  isAdmin, // <-- Added isAdmin here
}: {
  children: React.ReactNode;
  initials: string;
  isAdmin?: boolean; // <-- Added TypeScript definition
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
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)', overflow: 'hidden' }}>

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
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ width: '100%', maxWidth: '672px', margin: '0 auto', padding: '0 20px 96px' }}>
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

// Wrap Shell in the theme provider so every child can useAppTheme()
export default function AppShell({
  children,
  initials = 'U',
  isAdmin = false, // <-- Added default value here
}: {
  children: React.ReactNode;
  initials?: string;
  isAdmin?: boolean; // <-- Added TypeScript definition here
}) {
  return (
    <AppThemeProvider>
      {/* Pass isAdmin down to the Shell component */}
      <Shell initials={initials} isAdmin={isAdmin}>{children}</Shell>
    </AppThemeProvider>
  );
}