'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · BottomNav · Brand Book v1.0 · 2026
// Optimised for legibility — warm dark bg, high-contrast icons
// ─────────────────────────────────────────────────────────────────

const navItems = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
  },
  {
    href: '/coach',
    label: 'Mentor',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/experts',
    label: 'Sessions',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
    ),
  },
  {
    href: '/community',
    label: 'Circle',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3"/>
        <circle cx="17" cy="9" r="2.5"/>
        <path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>
        <path d="M18 14a3 3 0 0 1 3 3v1"/>
      </svg>
    ),
  },
  {
    href: '/learn',
    label: 'Learn',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .asc-bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 50;
          border-top: 1px solid rgba(232,160,32,0.18);
          background: #1E1C17;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -2px 20px rgba(0,0,0,0.60);
        }
        .asc-bottom-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 480px;
          margin: 0 auto;
          padding: 8px 0 10px;
        }
        .asc-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 6px 16px;
          text-decoration: none;
          border-radius: 10px;
          transition: all 0.15s ease;
          position: relative;
        }
        .asc-nav-label {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: color 0.15s;
        }
      `}</style>

      <nav className="asc-bottom-nav">
        <div className="asc-bottom-nav-inner">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className="asc-nav-item"
                style={{
                  color: active ? '#E8A020' : '#8A8272',
                  background: active ? 'rgba(232,160,32,0.10)' : 'transparent',
                }}
              >
                {/* Icon — active gets filled-look via strokeWidth bump */}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  strokeWidth: active ? 2.2 : 1.6,
                } as React.CSSProperties}>
                  {/* Clone icon with adjusted strokeWidth */}
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={active ? '#E8A020' : '#8A8272'}
                    strokeWidth={active ? 2.2 : 1.6}
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    {item.href === '/dashboard' && <>
                      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
                      <path d="M9 21V12h6v9"/>
                    </>}
                    {item.href === '/coach' && <>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </>}
                    {item.href === '/experts' && <>
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    </>}
                    {item.href === '/community' && <>
                      <circle cx="9" cy="7" r="3"/>
                      <circle cx="17" cy="9" r="2.5"/>
                      <path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>
                      <path d="M18 14a3 3 0 0 1 3 3v1"/>
                    </>}
                    {item.href === '/learn' && <>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </>}
                  </svg>
                </span>

                <span className="asc-nav-label" style={{ color: active ? '#E8A020' : '#8A8272', fontWeight: active ? 600 : 400 }}>
                  {item.label}
                </span>

                {/* Active dot indicator */}
                {active && (
                  <span style={{
                    position: 'absolute',
                    top: '4px', right: '10px',
                    width: '4px', height: '4px',
                    borderRadius: '50%',
                    background: '#E8A020',
                  }} />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
