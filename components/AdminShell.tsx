'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/cohorts', label: 'Cohorts', icon: '🏘️' },
  { href: '/admin/experts', label: 'Expert Events', icon: '🎓' },
  { href: '/admin/courses', label: 'Courses', icon: '📚' },
  { href: '/admin/coaching', label: 'Chat Data', icon: '💬' },
];

export default function AdminShell({
  children,
  name,
  role,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleNav = () => setMenuOpen(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-xl" style={{ color: 'var(--accent)' }}>⬆</span>
          <span className="text-lg font-semibold"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
            Ascentor
          </span>
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.19)' }}>
            {role}
          </span>
        </Link>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
          <span className="text-lg" style={{ color: 'var(--text)' }}>{menuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMenuOpen(false)}>
          <div className="w-64 h-full flex flex-col"
            style={{ background: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-lg font-semibold"
                style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
                ⬆ Ascentor
              </span>
            </div>
            <nav className="flex-1 py-3 px-3">
              {NAV.map((item) => {
                const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} onClick={handleNav}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg mb-0.5 text-sm transition-all"
                    style={{
                      background: active ? 'rgba(245,158,11,0.09)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: active ? 600 : 400,
                    }}>
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{name}</p>
              <div className="flex gap-2 mt-2">
                <Link href="/dashboard" onClick={handleNav}
                  className="text-[11px] px-2 py-1 rounded"
                  style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                  ← App
                </Link>
                <button onClick={handleSignOut}
                  className="text-[11px] px-2 py-1 rounded"
                  style={{ color: 'var(--error)' }}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r h-screen sticky top-0"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-xl" style={{ color: 'var(--accent)' }}>⬆</span>
              <span className="text-lg font-semibold"
                style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
                Ascentor
              </span>
            </Link>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1 inline-block px-2 py-0.5 rounded"
              style={{ background: 'rgba(245,158,11,0.09)', color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.19)' }}>
              {role}
            </span>
          </div>
          <nav className="flex-1 py-3 px-3">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all"
                  style={{
                    background: active ? 'rgba(245,158,11,0.09)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 400,
                  }}>
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{name}</p>
            <div className="flex gap-2 mt-2">
              <Link href="/dashboard"
                className="text-[11px] px-2 py-1 rounded"
                style={{ color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                ← App
              </Link>
              <button onClick={handleSignOut}
                className="text-[11px] px-2 py-1 rounded"
                style={{ color: 'var(--error)' }}>
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
