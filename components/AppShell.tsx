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
      <header className="sticky top-0 z-50 flex justify-between items-center px-5 py-3"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'rgba(10, 14, 23, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl" style={{ color: 'var(--accent)' }}>⬆</span>
          <span className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
            Ascentor
          </span>
        </Link>

        {/* Right side: Notification bell + Avatar */}
        <div className="flex items-center gap-3">
          <NotificationBell />

          {/* Avatar with dropdown */}
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.27))',
                border: '1.5px solid rgba(245,158,11,0.33)',
                color: 'var(--accent)',
              }}>
              {initials}
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg py-1 z-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                
                {/* New Invite & Earn Link */}
                <Link href="/referral" onClick={() => setShowMenu(false)}
                  className="block px-4 py-2.5 text-sm hover:opacity-80"
                  style={{ color: 'var(--accent)' }}>
                  🔗 Invite & Earn
                </Link>

                <Link href="/account" onClick={() => setShowMenu(false)}
                  className="block px-4 py-2.5 text-sm hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}>
                  Settings
                </Link>
                
                <button onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 text-sm hover:opacity-80"
                  style={{ color: 'var(--error)' }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Close menu when clicking outside */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}

      {/* Page Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 pb-24 overflow-y-auto">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}