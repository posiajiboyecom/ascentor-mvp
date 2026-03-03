'use client';

import BottomNav from './BottomNav';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NotificationBell } from '@/components/Notifications';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AppShell · Brand Book v1.0 · 2026
// Header + BottomNav wrapper for all authenticated pages
// ─────────────────────────────────────────────────────────────────

// Height constants — shared so CoachPage can use the same values
// Header: 53px (12px pad top + 28px logo + 12px pad bottom + 1px border)
// BottomNav: 64px (standard mobile nav height)
export const SHELL_HEADER_HEIGHT = 53;
export const SHELL_BOTTOM_NAV_HEIGHT = 64;

export default function AppShell({
  children,
  initials = 'U',
  isAdmin = false,
}: {
  children: React.ReactNode;
  initials?: string;
  isAdmin?: boolean;
}) {
  const supabase = createClient();
  const router   = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div style={{
      height:        '100dvh', // use dvh so mobile browser chrome is accounted for
      display:       'flex',
      flexDirection: 'column',
      background:    '#0C0B08',
      overflow:      'hidden', // prevent the shell itself from scrolling
    }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink:          0,  // never compress
        position:            'sticky',
        top:                 0,
        zIndex:              50,
        display:             'flex',
        justifyContent:      'space-between',
        alignItems:          'center',
        padding:             '12px 20px',
        borderBottom:        '1px solid rgba(212,207,195,0.10)',
        background:          '#1E1C17',
        backdropFilter:      'blur(12px)',
        WebkitBackdropFilter:'blur(12px)',
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img
            src="/ascentor-color-for-dark-pages.svg"
            alt="Ascentor"
            style={{ height: '28px', width: 'auto' }}
          />
        </Link>

        {/* Right: bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NotificationBell />

          {/* Avatar */}
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
                width:        '160px',
                borderRadius: '10px',
                padding:      '6px 0',
                background:   '#1E1C17',
                border:       '1px solid rgba(212,207,195,0.12)',
                zIndex:       100,
                boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <Link
                  href="/referral"
                  onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontFamily: "'Syne', system-ui, sans-serif", fontSize: '13px', fontWeight: 500, color: '#E8A020', textDecoration: 'none' }}
                >
                  Invite &amp; Earn
                </Link>
                <Link
                  href="/account"
                  onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontFamily: "'Syne', system-ui, sans-serif", fontSize: '13px', fontWeight: 400, color: '#D4CFC3', textDecoration: 'none' }}
                >
                  Settings
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setShowMenu(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px', fontFamily: "'Syne', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: '#E8A020', textDecoration: 'none', background: 'rgba(232,160,32,0.06)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Admin Panel
                  </Link>
                )}
                <div style={{ height: '1px', background: 'rgba(212,207,195,0.08)', margin: '4px 0' }} />
                <button
                  onClick={handleSignOut}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontFamily: "'Syne', system-ui, sans-serif", fontSize: '13px', fontWeight: 400, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Dismiss menu on outside click */}
      {showMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
      )}

      {/* ── Page content ──────────────────────────────────────────────────
          flex: 1 + minHeight: 0 lets this shrink to fill exactly the space
          between header and bottom nav — no more, no less.

          overflow: hidden here is intentional: regular pages (dashboard,
          account, etc.) that need scrolling should wrap their content in
          their own overflow-y: auto container. The CoachPage already does
          this with its internal flex layout.

          padding-bottom is removed — the BottomNav is a real flex child
          that takes up its own space, so no padding hack is needed.
      ──────────────────────────────────────────────────────────────────── */}
      <main style={{
        flex:      '1 1 0',
        minHeight: 0,          // critical: allows flex child to shrink below content size
        width:     '100%',
        maxWidth:  '672px',
        margin:    '0 auto',
        padding:   '0 20px',
        overflowY: 'auto',     // regular pages scroll here
        overflowX: 'hidden',
      }}>
        {children}
      </main>

      {/* BottomNav is a real flex child — takes its natural height */}
      <BottomNav />
    </div>
  );
}
