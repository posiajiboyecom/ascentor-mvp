'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · BottomNav · Brand Book v1.0 · 2026
// Gold: #E8A020  Dark: #0C0B08  Font: Syne / DM Mono
// ─────────────────────────────────────────────────────────────────

const navItems = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
  },
  {
    href: '/coach',
    label: 'Coach',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/experts',
    label: 'Experts',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>
    ),
  },
  {
    href: '/community',
    label: 'Cohort',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
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
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
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
          border-top: 1px solid rgba(212,207,195,0.10);
          background: rgba(12,11,8,0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        .asc-bottom-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 448px;
          margin: 0 auto;
          padding: 8px 0 10px;
        }
        .asc-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 4px 12px;
          text-decoration: none;
          transition: opacity 0.15s ease;
        }
        .asc-nav-item:hover { opacity: 0.75; }
        .asc-nav-label {
          font-family: 'DM Mono', 'Courier New', monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        /* Active gold indicator bar */
        .asc-nav-item-active .asc-nav-icon-wrap {
          position: relative;
        }
        .asc-nav-item-active .asc-nav-icon-wrap::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 2px;
          background: #E8A020;
          border-radius: 2px;
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
                className={`asc-nav-item ${active ? 'asc-nav-item-active' : ''}`}
                style={{ color: active ? '#E8A020' : '#4A4438' }}
              >
                <div className="asc-nav-icon-wrap">
                  {item.icon(active)}
                </div>
                <span className="asc-nav-label" style={{ fontWeight: active ? 500 : 400 }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
