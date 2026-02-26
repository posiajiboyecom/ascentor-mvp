'use client';

import BottomNav from './BottomNav';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NotificationBell } from '@/components/Notifications';

export default function AppShell({
  children,
  initials = 'U',
}: {
  children: React.ReactNode;
  initials?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15, 15, 20, 0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}>
        {/* Logo */}
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L22 20H2L12 3Z" fill="#6662FF" fillOpacity="0.12" stroke="#6662FF" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M12 8L18 20H6L12 8Z" fill="#6662FF" fillOpacity="0.35"/>
            <path d="M9 20H15" stroke="#A6A2FF" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '17px', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Ascentor
          </span>
        </Link>

        {/* Right: bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell />

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(102,98,255,0.14)',
                border: '1.5px solid rgba(102,98,255,0.32)',
                color: 'var(--accent)',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                transition: 'all 0.18s',
              }}>
              {initials}
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                width: 168, borderRadius: 10, overflow: 'hidden', zIndex: 50,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              }}>
                <Link href="/referral" onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>
                  🔗 Invite & Earn
                </Link>
                <Link href="/account" onClick={() => setShowMenu(false)}
                  style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'Inter, sans-serif', borderTop: '1px solid var(--border)' }}>
                  ⚙️ Settings
                </Link>
                <button onClick={handleSignOut}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, color: 'var(--error)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />}

      {/* Content */}
      <main style={{ flex: 1, width: '100%', maxWidth: 672, margin: '0 auto', padding: '0 20px 96px', overflowY: 'auto' }}>
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
