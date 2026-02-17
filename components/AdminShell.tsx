'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/cohorts', label: 'Cohorts', icon: '🏘️' },
  { href: '/admin/experts', label: 'Expert Events', icon: '🎓' },
  { href: '/admin/courses', label: 'Courses', icon: '📚' },
  { href: '/admin/coaching', label: 'Coaching Data', icon: '💬' },
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Logo */}
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

        {/* Nav */}
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

        {/* Footer */}
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
