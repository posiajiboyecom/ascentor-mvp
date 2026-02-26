'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Each tab gets its own brand color from the Ascentor palette
const navItems = [
  {
    href: '/dashboard', label: 'Home',
    color: '#6662FF', glow: 'rgba(102,98,255,0.2)',
    icon: (active: boolean, color: string) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : '#5E5C7A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/coach', label: 'Coach',
    color: '#A6A2FF', glow: 'rgba(166,162,255,0.2)',
    icon: (active: boolean, color: string) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? 'rgba(166,162,255,0.15)' : 'none'} stroke={active ? color : '#5E5C7A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/experts', label: 'Experts',
    color: '#CFFF5E', glow: 'rgba(207,255,94,0.18)',
    icon: (active: boolean, color: string) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? color : '#5E5C7A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
    ),
  },
  {
    href: '/community', label: 'Cohort',
    color: '#FD81FD', glow: 'rgba(253,129,253,0.18)',
    icon: (active: boolean, color: string) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? color : '#5E5C7A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/learn', label: 'Learn',
    color: '#14B8A6', glow: 'rgba(20,184,166,0.18)',
    icon: (active: boolean, color: string) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active ? color : '#5E5C7A'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        borderTop: '1px solid var(--border)',
        background: 'rgba(15, 15, 20, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        maxWidth: 576, margin: '0 auto', padding: '6px 0 10px',
      }}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 12, textDecoration: 'none',
                position: 'relative', transition: 'all 0.18s',
                background: active ? `${item.glow}` : 'transparent',
              }}
            >
              {/* Active top indicator */}
              {active && (
                <span style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  width: 24, height: 2.5, borderRadius: 2,
                  background: item.color,
                }} />
              )}

              {item.icon(active, item.color)}

              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 400,
                fontFamily: 'Inter, sans-serif', letterSpacing: '0.01em',
                color: active ? item.color : '#5E5C7A',
                transition: 'color 0.18s',
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
