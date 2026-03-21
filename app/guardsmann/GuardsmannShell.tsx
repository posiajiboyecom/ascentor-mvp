'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

// ─── Guardsmann Nav ────────────────────────────────────────────
// Personal brand + GRC job search command centre
// Separate from Ascentor admin — Posi's career tools

const NAV = [
  {
    group: 'Brand',
    items: [
      {
        href: '/guardsmann',
        label: 'Overview',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
      },
      {
        href: '/guardsmann/content',
        label: 'Content Engine',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Jobs',
    items: [
      {
        href: '/guardsmann/jobs',
        label: 'Job Search',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        ),
      },
      {
        href: '/guardsmann/alerts',
        label: 'Alerts & Monitoring',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        ),
      },
      {
        href: '/guardsmann/recruiters',
        label: 'Recruiter Finder',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: '/guardsmann/tracker',
        label: 'Application Tracker',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        ),
      },
    ],
  },
];

const STYLES = `
  :root {
    --gm-bg:        #0C0B08;
    --gm-sidebar:   #111008;
    --gm-border:    rgba(212,207,195,0.10);
    --gm-gold:      #E8A020;
    --gm-text:      #D4CFC3;
    --gm-muted:     #6B6456;
    --gm-card:      #18160F;
    --gm-font-ui:   'Inter', 'Helvetica Neue', sans-serif;
    --gm-font-mono: 'DM Mono', 'Fira Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--gm-bg); color: var(--gm-text); font-family: var(--gm-font-ui); }

  .gm-shell { display: flex; min-height: 100vh; }

  /* Sidebar */
  .gm-sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--gm-sidebar);
    border-right: 1px solid var(--gm-border);
    display: flex; flex-direction: column;
    position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto;
    z-index: 50;
  }
  .gm-logo-area {
    padding: 20px 16px 16px;
    border-bottom: 1px solid var(--gm-border);
  }
  .gm-brand {
    font-family: var(--gm-font-mono);
    font-size: 13px; font-weight: 700;
    color: var(--gm-gold);
    letter-spacing: 0.06em;
    text-decoration: none;
    display: block;
    margin-bottom: 6px;
  }
  .gm-subbrand {
    font-family: var(--gm-font-mono);
    font-size: 9px; color: var(--gm-muted);
    letter-spacing: 0.10em; text-transform: uppercase;
  }
  .gm-nav { padding: 12px 8px; flex: 1; }
  .gm-group-label {
    font-family: var(--gm-font-mono);
    font-size: 9px; font-weight: 600;
    color: var(--gm-muted);
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 14px 10px 6px;
  }
  .gm-nav-link {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 10px; border-radius: 8px;
    font-size: 13px; font-weight: 500;
    color: var(--gm-muted);
    text-decoration: none;
    transition: all 0.15s;
    margin-bottom: 1px;
  }
  .gm-nav-link:hover { background: rgba(232,160,32,0.07); color: var(--gm-text); }
  .gm-nav-link.active {
    background: rgba(232,160,32,0.12);
    color: var(--gm-gold);
    border-left: 2px solid var(--gm-gold);
    padding-left: 8px;
  }
  .gm-nav-link svg { flex-shrink: 0; opacity: 0.7; }
  .gm-nav-link.active svg { opacity: 1; }

  /* Admin link at bottom */
  .gm-admin-link {
    padding: 12px 16px;
    border-top: 1px solid var(--gm-border);
    margin-top: auto;
  }
  .gm-admin-link a {
    font-family: var(--gm-font-mono);
    font-size: 10px; color: var(--gm-muted);
    text-decoration: none; letter-spacing: 0.06em;
    display: flex; align-items: center; gap: 6px;
  }
  .gm-admin-link a:hover { color: var(--gm-text); }

  /* Main */
  .gm-main { margin-left: 220px; flex: 1; min-height: 100vh; }
  .gm-topbar {
    height: 52px; padding: 0 28px;
    border-bottom: 1px solid var(--gm-border);
    display: flex; align-items: center; justify-content: space-between;
    background: var(--gm-sidebar);
    position: sticky; top: 0; z-index: 40;
  }
  .gm-topbar-title {
    font-family: var(--gm-font-mono);
    font-size: 11px; color: var(--gm-muted);
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .gm-topbar-user {
    font-family: var(--gm-font-mono);
    font-size: 10px; color: var(--gm-muted);
  }
  .gm-content { padding: 28px; }

  /* Cards */
  .gm-card {
    background: var(--gm-card);
    border: 1px solid var(--gm-border);
    border-radius: 12px;
    padding: 20px 24px;
  }
  .gm-card-title {
    font-size: 14px; font-weight: 600;
    color: var(--gm-text); margin-bottom: 4px;
  }
  .gm-card-sub {
    font-family: var(--gm-font-mono);
    font-size: 10px; color: var(--gm-muted);
    letter-spacing: 0.05em;
  }

  /* Buttons */
  .gm-btn-primary {
    padding: 9px 18px; border-radius: 10px; border: none;
    background: var(--gm-gold); color: #0C0B08;
    font-weight: 700; font-size: 13px; cursor: pointer;
    transition: opacity 0.15s;
  }
  .gm-btn-primary:hover { opacity: 0.88; }
  .gm-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
  .gm-btn-secondary {
    padding: 8px 16px; border-radius: 9px; cursor: pointer;
    background: transparent;
    border: 1px solid var(--gm-border);
    color: var(--gm-muted); font-size: 12px;
    transition: all 0.15s;
  }
  .gm-btn-secondary:hover { border-color: var(--gm-gold); color: var(--gm-gold); }

  /* Badge */
  .gm-badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 999px;
    font-family: var(--gm-font-mono);
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
  .gm-badge-gold  { background: rgba(232,160,32,0.15); color: var(--gm-gold); border: 1px solid rgba(232,160,32,0.25); }
  .gm-badge-green { background: rgba(16,185,129,0.12); color: #10B981; border: 1px solid rgba(16,185,129,0.25); }
  .gm-badge-red   { background: rgba(239,68,68,0.10);  color: #EF4444; border: 1px solid rgba(239,68,68,0.20); }
  .gm-badge-blue  { background: rgba(59,130,246,0.12); color: #60A5FA; border: 1px solid rgba(59,130,246,0.25); }
  .gm-badge-grey  { background: rgba(107,100,86,0.15); color: var(--gm-muted); border: 1px solid var(--gm-border); }

  /* Input / select */
  .gm-input, .gm-select, .gm-textarea {
    width: 100%; padding: 9px 12px; border-radius: 9px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--gm-border);
    color: var(--gm-text); font-size: 13px;
    font-family: var(--gm-font-ui);
    outline: none; transition: border 0.15s;
  }
  .gm-input:focus, .gm-select:focus, .gm-textarea:focus {
    border-color: rgba(232,160,32,0.5);
  }
  .gm-textarea { resize: vertical; min-height: 80px; }
  .gm-label {
    font-family: var(--gm-font-mono);
    font-size: 10px; color: var(--gm-muted);
    letter-spacing: 0.05em; display: block;
    margin-bottom: 5px; text-transform: uppercase;
  }
  .gm-field { margin-bottom: 16px; }

  /* Toast */
  .gm-toast {
    position: fixed; bottom: 24px; right: 24px;
    padding: 10px 18px; border-radius: 10px;
    font-size: 13px; z-index: 9999;
    font-family: var(--gm-font-mono);
  }
  .gm-toast.ok  { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #10B981; }
  .gm-toast.err { background: rgba(239,68,68,0.12);  border: 1px solid rgba(239,68,68,0.25); color: #EF4444; }

  @media (max-width: 768px) {
    .gm-sidebar { width: 100%; height: auto; position: relative; }
    .gm-main { margin-left: 0; }
  }
`;

const PAGE_TITLES: Record<string, string> = {
  '/guardsmann':            'Overview',
  '/guardsmann/content':    'Content Engine',
  '/guardsmann/jobs':       'Job Search',
  '/guardsmann/alerts':     'Alerts & Monitoring',
  '/guardsmann/recruiters': 'Recruiter Finder',
  '/guardsmann/tracker':    'Application Tracker',
};

export default function GuardsmannShell({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/guardsmann'
      ? pathname === '/guardsmann'
      : pathname.startsWith(href);

  const pageTitle = PAGE_TITLES[pathname] || 'Guardsmann';

  return (
    <>
      <style>{STYLES}</style>
      <div className="gm-shell">
        {/* Sidebar */}
        <aside className="gm-sidebar">
          <div className="gm-logo-area">
            <Link href="/guardsmann" className="gm-brand">GUARDSMANN</Link>
            <div className="gm-subbrand">GRC Career Command Centre</div>
          </div>

          <nav className="gm-nav">
            {NAV.map(({ group, items }) => (
              <div key={group}>
                <p className="gm-group-label">{group}</p>
                {items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`gm-nav-link ${isActive(item.href) ? 'active' : ''}`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="gm-admin-link">
            <Link href="/admin">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Back to Ascentor Admin
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="gm-main">
          <div className="gm-topbar">
            <span className="gm-topbar-title">{pageTitle}</span>
            <span className="gm-topbar-user">{name}</span>
          </div>
          <div className="gm-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
