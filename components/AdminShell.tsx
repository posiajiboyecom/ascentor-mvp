'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell · Brand Book v1.0 · 2026
// Sidebar navigation for all /admin pages
// ─────────────────────────────────────────────────────────────────

const NAV = [
  {
    href: '/admin',
    label: 'Overview',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
      </svg>
    ),
  },
  {
    href: '/admin/experts',
    label: 'Expert Events',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <path d="M9 11l2 2 4-4" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    href: '/admin/courses',
    label: 'Courses',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    href: '/admin/coaching',
    label: 'Chat Data',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: '/admin/blog',
    label: 'Blog',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
  {
    href: '/admin/newsletter',
    label: 'Newsletter',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    href: '/admin/mentors',
    label: 'Mentors',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    href: '/admin/promo-codes',
    label: 'Promo Codes',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
  {
    href: '/admin/logs',
    label: 'Audit Logs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
];

const STYLES = `
  .admin-sidebar-nav { padding: 8px; }
  .admin-nav-group-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #4A4438; padding: 0 10px; margin: 8px 0 4px;
  }
  .admin-nav-link {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; margin-bottom: 1px;
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 13px; font-weight: 400;
    color: #7A7260; text-decoration: none;
    transition: background 0.15s, color 0.15s;
    position: relative;
  }
  .admin-nav-link:hover { background: rgba(232,160,32,0.07); color: #D4CFC3; }
  .admin-nav-link.active {
    background: rgba(232,160,32,0.12);
    color: #E8A020; font-weight: 600;
  }
  .admin-nav-link .nav-dot {
    width: 4px; height: 4px; border-radius: 50%;
    background: #E8A020; margin-left: auto; flex-shrink: 0;
  }
  @media (max-width: 1023px) {
    .admin-desktop-sidebar { display: none !important; }
  }
  @media (min-width: 1024px) {
    .admin-mobile-header { display: none !important; }
  }
`;

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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid rgba(212,207,195,0.10)',
      }}>
        <Link href="/admin" style={{ display: 'block', textDecoration: 'none', marginBottom: '10px' }}>
          <img
            src="/ascentor-color-for-dark-pages.svg"
            alt="Ascentor"
            style={{ height: '26px', width: 'auto' }}
          />
        </Link>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '9px', fontWeight: 500,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          color: '#E8A020',
          background: 'rgba(232,160,32,0.10)',
          border: '1px solid rgba(232,160,32,0.20)',
          padding: '3px 8px', borderRadius: '100px',
          display: 'inline-block',
        }}>
          {role}
        </span>
      </div>

      {/* Nav */}
      <nav className="admin-sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        <p className="admin-nav-group-label">Menu</p>
        {NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav}
            className={`admin-nav-link ${isActive(item.href) ? 'active' : ''}`}
          >
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isActive(item.href) ? 1 : 0.7 }}>
              {item.icon}
            </span>
            {item.label}
            {isActive(item.href) && <span className="nav-dot" />}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid rgba(212,207,195,0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'rgba(232,160,32,0.12)',
            border: '1.5px solid rgba(232,160,32,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontSize: '11px',
            fontWeight: 700, color: '#E8A020', flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <p style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: '12px', fontWeight: 600, color: '#D4CFC3',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link
            href="/dashboard"
            onClick={onNav}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
              color: '#7A7260', border: '1px solid rgba(212,207,195,0.12)',
              textDecoration: 'none', fontFamily: "'Syne', sans-serif",
              transition: 'color 0.15s',
            }}
          >
            ← App
          </Link>
          <button
            onClick={handleSignOut}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
              color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)',
              background: 'transparent', cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0C0B08', display: 'flex', flexDirection: 'column' }}>
      <style>{STYLES}</style>

      {/* Mobile header */}
      <div
        className="admin-mobile-header"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#1E1C17',
          borderBottom: '1px solid rgba(212,207,195,0.10)',
        }}
      >
        <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: '24px', width: 'auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontSize: '9px', fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase' as const,
            color: '#E8A020', background: 'rgba(232,160,32,0.10)',
            border: '1px solid rgba(232,160,32,0.20)',
            padding: '3px 8px', borderRadius: '100px',
          }}>
            {role}
          </span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              width: '34px', height: '34px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: '8px',
              background: '#2E2A22', border: '1px solid rgba(212,207,195,0.10)',
              color: '#D4CFC3', cursor: 'pointer', fontSize: '14px',
            }}
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
            style={{
              width: '240px', height: '100%', display: 'flex', flexDirection: 'column',
              background: '#1E1C17',
            }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent onNav={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside
          className="admin-desktop-sidebar"
          style={{
            width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            height: '100vh', position: 'sticky', top: 0,
            background: '#1E1C17',
            borderRight: '1px solid rgba(212,207,195,0.10)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowX: 'hidden', background: '#0C0B08' }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '24px' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
