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
// Gold: #E8A020  Dark: #0C0B08  Font: Syne / Cormorant Garamond
// ─────────────────────────────────────────────────────────────────

export default function AppShell({
  children,
  initials = 'U',
}: {
  children: React.ReactNode;
  initials?: string;
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0C0B08' }}>

      {/* ── Header ── */}
      <header style={{
        position:        'sticky',
        top:             0,
        zIndex:          50,
        display:         'flex',
        justifyContent:  'space-between',
        alignItems:      'center',
        padding:         '12px 20px',
        borderBottom:    '1px solid rgba(212,207,195,0.10)',
        background:      'rgba(12,11,8,0.92)',
        backdropFilter:  'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img
            src="/ascentor-color-on-dark.svg"
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
                width:           '34px',
                height:          '34px',
                borderRadius:    '50%',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                background:      'rgba(232,160,32,0.12)',
                border:          '1.5px solid rgba(232,160,32,0.35)',
                color:           '#E8A020',
                fontFamily:      "'Syne', system-ui, sans-serif",
                fontSize:        '12px',
                fontWeight:      700,
                cursor:          'pointer',
                letterSpacing:   '0.04em',
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
                zIndex:       50,
                boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <Link
                  href="/referral"
                  onClick={() => setShowMenu(false)}
                  style={{
                    display:        'block',
                    padding:        '10px 16px',
                    fontFamily:     "'Syne', system-ui, sans-serif",
                    fontSize:       '13px',
                    fontWeight:     500,
                    color:          '#E8A020',
                    textDecoration: 'none',
                  }}
                >
                  Invite &amp; Earn
                </Link>
                <Link
                  href="/account"
                  onClick={() => setShowMenu(false)}
                  style={{
                    display:        'block',
                    padding:        '10px 16px',
                    fontFamily:     "'Syne', system-ui, sans-serif",
                    fontSize:       '13px',
                    fontWeight:     400,
                    color:          '#D4CFC3',
                    textDecoration: 'none',
                  }}
                >
                  Settings
                </Link>
                <div style={{ height: '1px', background: 'rgba(212,207,195,0.08)', margin: '4px 0' }} />
                <button
                  onClick={handleSignOut}
                  style={{
                    width:      '100%',
                    textAlign:  'left',
                    padding:    '10px 16px',
                    fontFamily: "'Syne', system-ui, sans-serif",
                    fontSize:   '13px',
                    fontWeight: 400,
                    color:      '#EF4444',
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                  }}
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

      {/* Page content */}
      <main style={{
        flex:        1,
        width:       '100%',
        maxWidth:    '672px',
        margin:      '0 auto',
        padding:     '0 20px 96px',
        overflowY:   'auto',
      }}>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
