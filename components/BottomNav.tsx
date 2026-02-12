'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '◈' },
  { href: '/coach', label: 'Coach', icon: '💬' },
  { href: '/experts', label: 'Experts', icon: '🎓' },
  { href: '/community', label: 'Cohort', icon: '👥' },
  { href: '/learn', label: 'Learn', icon: '📚' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t pb-safe"
      style={{
        borderColor: 'var(--border)',
        background: 'rgba(10, 14, 23, 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
      <div className="flex justify-around max-w-xl mx-auto" style={{ padding: '8px 0 12px' }}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
              style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px]" style={{ fontWeight: active ? 600 : 400 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
