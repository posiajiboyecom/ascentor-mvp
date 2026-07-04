'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAdminTheme } from '@/components/AdminThemeProvider';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell · THE LEDGER · v2 · 2026
// Sidebar navigation for all /admin pages.
//
// Replaces the v1 flat 12-item list with the real, reconciled
// 17-section IA agreed with Anifie:
//   - Dropped: /admin/partners (white-label — not needed right now)
//   - Dropped: /admin/community  (superseded by /admin/community-intel)
//   - Dropped: /admin/content    (superseded by /admin/master)
//   - Added to nav: /admin/permissions, /admin/products, /admin/surveys
//     (built, working, but had no nav link in v1 — true orphans)
//
// Visual system: styles/admin-ledger.css ([data-ledger] scope).
// Theme: useAdminTheme() from AdminThemeProvider — dark is default
// ("Summit Black"), light is the explicit opt-out. The toggle here
// is the only UI control for it; everything else inherits via CSS
// custom properties so no other file needs to know the theme exists.
//
// Permission-based nav filtering: NOT implemented yet. lib/permissions.ts
// has no Permission entries for several of these sections (mentors,
// promo-codes, intel, master, careers, products, permissions itself,
// surveys), so filtering nav items by userPermissions would require
// extending that file first rather than guessing a mapping here.
// Today's gate is role-only (admin/moderator), already enforced
// server-side in app/admin/admin-layout.tsx before this component
// ever mounts. userPermissions is accepted and threaded through so
// it's ready to use the moment that permission map is extended.
// ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Permission required to see this item, once lib/permissions.ts covers it. Undefined = role-gate only. */
  permission?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const ICON = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  users: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  heart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  blog: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
    </svg>
  ),
  courses: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  products: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  careers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/>
    </svg>
  ),
  events: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  summit: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  launch: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    </svg>
  ),
  pages: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  community: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>
    </svg>
  ),
  chat: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  survey: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  newsletter: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  intel: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3a6 6 0 0 1 6 6c0 2.13-1.11 4-2.76 5.06L15 17H9l-.24-2.94A6.973 6.973 0 0 1 6 9a6 6 0 0 1 6-6z"/>
      <path d="M9 21h6"/>
    </svg>
  ),
  reports: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  logs: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  promo: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  pipeline: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  knowledge: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
};

// ── The reconciled IA — 17 real sections, 7 groups ──────────────
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Overview', icon: ICON.overview },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: ICON.users },
      { href: '/admin/permissions', label: 'Permissions', icon: ICON.shield },
      { href: '/admin/mentors', label: 'Mentors', icon: ICON.heart },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/blog', label: 'Blog', icon: ICON.blog },
      { href: '/admin/courses', label: 'Courses', icon: ICON.courses },
      { href: '/admin/knowledge', label: 'Knowledge Base', icon: ICON.knowledge },
      { href: '/admin/careers', label: 'Careers', icon: ICON.careers },
      { href: '/admin/marketing-pages', label: 'Marketing Pages', icon: ICON.pages },
      { href: '/admin/master', label: 'Marketing Pipeline', icon: ICON.pipeline },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/community-intel', label: 'Community', icon: ICON.community },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { href: '/admin/coaching', label: 'Chat Data', icon: ICON.chat },
      { href: '/admin/surveys', label: 'Surveys', icon: ICON.survey },
      { href: '/admin/newsletter', label: 'Newsletter', icon: ICON.newsletter },
    ],
  },
  {
    label: 'Events',
    items: [
      { href: '/admin/events', label: 'Public Events', icon: ICON.events },
      { href: '/admin/community-events', label: 'Community Events', icon: ICON.community },
      { href: '/admin/summit', label: 'Summit', icon: ICON.summit },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/admin/billboards', label: 'Rail Billboards', icon: ICON.launch },
      { href: '/admin/products', label: 'Products', icon: ICON.products },
      { href: '/admin/promo-codes', label: 'Promo Codes', icon: ICON.promo },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/admin/intel', label: 'Platform Intel', icon: ICON.intel },
      { href: '/admin/reports', label: 'Reports', icon: ICON.reports },
      { href: '/admin/logs', label: 'Audit Logs', icon: ICON.logs },
    ],
  },
];

export default function AdminShell({
  children,
  name,
  role,
  userPermissions,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  userPermissions?: any[] | null;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const { theme, toggle, isDark } = useAdminTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  const logoSrc = isDark ? '/ascentor-color-for-dark-pages.svg' : '/ascentor-color-for-light-pages.svg';

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo + role badge */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--ledger-line)' }}>
        <Link href="/admin" style={{ display: 'block', textDecoration: 'none', marginBottom: '10px' }}>
          <img src={logoSrc} alt="Ascentor" style={{ height: '26px', width: 'auto' }} />
        </Link>
        <span className="ledger-tag ledger-tag-new">{role}</span>
      </div>

      {/* Nav, grouped */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 4 }}>
            <p className="ledger-nav-group-label" style={{ marginTop: 14 }}>{group.label}</p>
            {group.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNav}
                className={`ledger-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isActive(item.href) ? 1 : 0.7 }}>
                    {item.icon}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                </span>
                {isActive(item.href) && <span className="ledger-status-dot ok" style={{ marginRight: 0 }} />}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — theme toggle, identity, sign out */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--ledger-line)' }}>
        <button
          onClick={toggle}
          className="ledger-nav-item"
          style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10, border: '1px solid var(--ledger-line-strong)' }}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isDark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
            {isDark ? 'Light mode' : 'Dark mode'}
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--ledger-gold-bg)', border: '1.5px solid var(--ledger-gold-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--ledger-font-ui)', fontSize: '11px',
            fontWeight: 700, color: 'var(--ledger-gold)', flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <p style={{
            fontFamily: 'var(--ledger-font-ui)', fontSize: '12px', fontWeight: 600,
            color: 'var(--ledger-ink)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', flex: 1, margin: 0,
          }}>
            {name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href="/dashboard" onClick={onNav} className="ledger-btn ledger-btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
            ← App
          </Link>
          <button onClick={handleSignOut} className="ledger-btn ledger-btn-danger" style={{ flex: 1 }}>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ledger-bg)', display: 'flex', flexDirection: 'column', overflowX: 'hidden', maxWidth: '100vw' }}>
      <style>{`
        @media (max-width: 1023px) { .ledger-desktop-sidebar { display: none !important; } }
        @media (min-width: 1024px) { .ledger-mobile-header { display: none !important; } }
      `}</style>

      {/* Mobile header */}
      <div
        className="ledger-mobile-header"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--ledger-bg-deep)',
          borderBottom: '1px solid var(--ledger-line)',
        }}
      >
        <img src={logoSrc} alt="Ascentor" style={{ height: '24px', width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="ledger-tag ledger-tag-new">{role}</span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 'var(--ledger-radius-lg)',
              background: 'var(--ledger-bg-card-hover)', border: '1px solid var(--ledger-line)',
              color: 'var(--ledger-ink)', cursor: 'pointer', fontSize: '14px',
            }}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{ width: '260px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--ledger-bg-deep)' }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent onNav={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside
          className="ledger-desktop-sidebar"
          style={{
            width: '248px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            height: '100vh', position: 'sticky', top: 0,
            background: 'var(--ledger-bg-deep)', borderRight: '1px solid var(--ledger-line)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden', background: 'var(--ledger-bg)' }}>
          <div style={{ maxWidth: '1320px', margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)', overflowX: 'hidden' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
