'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · BottomNav · Brand Book v2.0 · 2026
// The Elevation Summit Platform
// Uses --app-* CSS vars so it responds to light/dark theme toggle
// ─────────────────────────────────────────────────────────────────

const navItems = [
  {
    href: '/dashboard',
    label: 'Home',
    paths: () => <>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </>,
  },
  {
    href: '/coach',
    label: 'Coach',
    paths: () => <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </>,
  },
  {
    href: '/community',
    label: 'The Circle',
    paths: () => <>
      <circle cx="9" cy="7" r="3"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>
      <path d="M18 14a3 3 0 0 1 3 3v1"/>
    </>,
  },
  {
    href: '/experts',
    label: 'Sessions',
    paths: () => <>
      <circle cx="12" cy="8" r="4"/>
      <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
    </>,
  },
  {
    href: '/learn',
    label: 'Resources',
    paths: () => <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </>,
  },
];

// Gold — elevation gold from brand token
const GOLD = '#C8A96E';

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .asc-bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 50;
          border-top: 1px solid var(--app-border-gold, rgba(200,169,110,0.20));
          background: var(--app-bg-card);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -2px 20px var(--app-nav-shadow, rgba(0,0,0,0.08));
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
          padding: 6px 12px;
          text-decoration: none;
          border-radius: 10px;
          transition: all 0.15s ease;
          position: relative;
        }
        .asc-nav-label {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: color 0.15s;
        }
      `}</style>

      <nav className="asc-bottom-nav lg:hidden">
        <div className="asc-bottom-nav-inner">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            const color  = active ? GOLD : 'var(--app-text-dim)';

            return (
              <Link
                key={item.href}
                href={item.href}
                className="asc-nav-item"
                style={{
                  color,
                  background: active ? 'rgba(200,169,110,0.10)' : 'transparent',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={color}
                  strokeWidth={active ? 2.2 : 1.6}
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  {item.paths()}
                </svg>

                <span className="asc-nav-label" style={{ color, fontWeight: active ? 600 : 400 }}>
                  {item.label}
                </span>

                {active && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '10px',
                    width: '4px', height: '4px', borderRadius: '50%',
                    background: GOLD,
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
