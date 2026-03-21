'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell · Brand Book v1.0 · 2026
// Sidebar navigation for all /admin pages
// ─────────────────────────────────────────────────────────────────

// ─── Nav item type ─────────────────────────────────────────────
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  /** If set, only render this link when role matches one of these values */
  roles?: string[];
};



const NAV: NavItem[] = [
  // ── Core ──────────────────────────────────────────────────────
  {
    group: 'Core',
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
    group: 'Core',
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
    group: 'Core',
    href: '/admin/intel',
    label: 'Intel',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    group: 'Core',
    href: '/admin/community-intel',
    label: 'Community Intel',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    group: 'Core',
    href: '/admin/cohorts',
    label: 'Cohorts',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    group: 'Core',
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
    group: 'Core',
    href: '/admin/mentors',
    label: 'Mentors',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    group: 'Core',
    href: '/admin/partners',
    label: 'Partners',
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
    group: 'Core',
    href: '/admin/courses',
    label: 'Courses',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    group: 'Core',
    href: '/admin/coaching',
    label: 'Chat Data',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },

  // ── Content & Marketing ───────────────────────────────────────
  {
    group: 'Content & Marketing',
    href: '/admin/master',
    label: 'Master Admin',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    roles: ['admin'],
  },
  {
    group: 'Content & Marketing',
    href: '/admin/content',
    label: 'Content Pipeline',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="4" rx="1"/>
        <rect x="3" y="10" width="12" height="4" rx="1"/>
        <rect x="3" y="17" width="7" height="4" rx="1"/>
        <polyline points="17 15 19 17 23 13"/>
      </svg>
    ),
  },
  {
    group: 'Content & Marketing',
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
    group: 'Content & Marketing',
    href: '/admin/newsletter',
    label: 'Newsletter',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
  {
    group: 'Content & Marketing',
    href: '/admin/products',
    label: 'Products',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },

  // ── Careers ───────────────────────────────────────────────────
  {
    group: 'Careers',
    href: '/admin/careers',
    label: 'Careers',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/>
      </svg>
    ),
  },

  // ── Finance & Reporting ───────────────────────────────────────
  {
    group: 'Finance & Reporting',
    href: '/admin/promo-codes',
    label: 'Promo Codes',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
  {
    group: 'Finance & Reporting',
    href: '/admin/reports',
    label: 'Reports',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },

  // ── System ────────────────────────────────────────────────────
  {
    group: 'System',
    href: '/admin/logs',
    label: 'Audit Logs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  
  {
    group: 'Guardsmann',
    href: '/guardsmann',
    label: 'Guardsmann',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    roles: ['admin'],
  },
  {
    group: 'System',
    href: '/admin/permissions',
    label: 'Permissions',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    roles: ['admin'],
  },

  {
  group: 'Core',
  href: '/admin/surveys',
  label: 'Surveys',
  icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
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
    color: var(--admin-text-faint, #4A4438); padding: 0 10px; margin: 8px 0 4px;
  }
  .admin-nav-link {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; margin-bottom: 1px;
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 13px; font-weight: 400;
    color: var(--admin-text-muted, #7A7260); text-decoration: none;
    transition: background 0.15s, color 0.15s;
    position: relative;
  }
  .admin-nav-link:hover { background: rgba(232,160,32,0.07); color: var(--admin-text, #D4CFC3); }
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

// ── Inline theme toggle (no provider needed) ────────────────
function useAdminTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const stored = localStorage.getItem('asc-admin-theme') as 'dark' | 'light' | null;
    if (stored) setTheme(stored);
  }, []);
  const toggle = () => setTheme(prev => {
    const next = prev === 'dark' ? 'light' : 'dark';
    localStorage.setItem('asc-admin-theme', next);
    return next;
  });
  return { theme, toggle, isDark: theme === 'dark' };
}

export default function AdminShell({
  children,
  name,
  role,
  userPermissions: _userPermissions,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  userPermissions?: unknown[] | null;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme: adminTheme, toggle: toggleTheme, isDark: isDarkTheme } = useAdminTheme();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  const ThemeToggleBtn = () => (
    <button
      onClick={toggleTheme}
      title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 28, height: 28, borderRadius: '7px',
        color: 'var(--admin-text-muted)', border: '1px solid rgba(212,207,195,0.12)',
        background: 'transparent', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, padding: 0,
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {isDarkTheme
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  );

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
        {(() => {
          // Use custom per-user permissions if set, otherwise fall back to role
          const effectivePerms = (_userPermissions as string[] | null);
          const visibleItems = NAV.filter(item => {
            // No role restriction — always show
            if (!item.roles) return true;
            // Admin always sees everything
            if (role.toLowerCase() === 'admin') return item.roles.includes('admin');
            // Moderator with custom permissions: check if they have a permission
            // that maps to this page
            if (effectivePerms && effectivePerms.length > 0) {
              // They have custom permissions — check if any maps to this nav item
              // Import PERMISSION_LABELS would cause circular dep so inline the check
              const pagePermsMap: Record<string, string[]> = {
                '/admin/master':      ['payments.view', 'admin.view_stats'],
                '/admin/intel':       ['reports.generate'],
                '/admin/users':       ['users.view'],
                '/admin/permissions': ['admin.access'],
                '/admin/promo-codes': ['payments.view'],
                '/admin/careers':     ['content.blog.create'],
                '/admin/content':     ['content.pipeline.view', 'content.pipeline.approve'],
                '/admin/blog':        ['content.blog.create', 'content.blog.edit'],
                '/admin/newsletter':  ['newsletter.compose', 'newsletter.send'],
                '/admin/courses':     ['content.courses.create', 'content.courses.edit'],
                '/admin/experts':     ['experts.create', 'experts.edit'],
                '/admin/cohorts':     ['community.cohorts.create', 'community.cohorts.edit'],
                '/admin/community':   ['community.posts.moderate', 'community.posts.delete'],
              };
              const needed = pagePermsMap[item.href];
              if (needed) return needed.some(p => effectivePerms.includes(p));
            }
            return item.roles.includes(role.toLowerCase());
          });
          const groups = Array.from(new Set(visibleItems.map(i => i.group)));
          return groups.map(group => (
            <div key={group}>
              <p className="admin-nav-group-label">{group}</p>
              {visibleItems.filter(i => i.group === group).map(item => (
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
            </div>
          ));
        })()}
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
            fontSize: '12px', fontWeight: 600, color: 'var(--admin-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Link
            href="/dashboard"
            onClick={onNav}
            style={{
              fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
              color: 'var(--admin-text-muted)', border: '1px solid rgba(212,207,195,0.12)',
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
          <ThemeToggleBtn />
        </div>
      </div>
    </>
  );

  return (
    <div
      data-admin-theme={adminTheme}
      style={{
        minHeight: '100vh',
        background: adminTheme === 'light' ? '#F5F4F1' : '#0C0B08',
        display: 'flex', flexDirection: 'column',
        '--admin-bg': adminTheme === 'light' ? '#F5F4F1' : '#0C0B08',
        '--admin-bg-card': adminTheme === 'light' ? '#FFFFFF' : '#1E1C17',
        '--admin-bg-deep': adminTheme === 'light' ? '#F0EEE9' : '#141210',
        '--admin-bg-input': adminTheme === 'light' ? 'rgba(42,40,32,0.12)' : 'rgba(212,207,195,0.10)',
        '--admin-text': adminTheme === 'light' ? '#2A2820' : '#D4CFC3',
        '--admin-text-faint': adminTheme === 'light' ? '#6B6456' : '#4A4438',
        '--admin-text-muted': adminTheme === 'light' ? '#4A4438' : '#7A7260',
        '--admin-text-heading': adminTheme === 'light' ? '#0C0B08' : '#FEF9EC',
      } as React.CSSProperties}
    >
      <style>{STYLES}</style>

      {/* Mobile header */}
      <div
        className="admin-mobile-header"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: adminTheme === 'light' ? '#FFFFFF' : '#1E1C17',
          borderBottom: adminTheme === 'light' ? '1px solid rgba(42,40,32,0.10)' : '1px solid rgba(212,207,195,0.10)',
          position: 'sticky', top: 0, zIndex: 40,
        }}
      >
        <img src={isDarkTheme ? "/ascentor-color-for-dark-pages.svg" : "/ascentor-color-for-light-pages.svg"} alt="Ascentor" style={{ height: '24px', width: 'auto' }} />
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
              background: adminTheme === 'light' ? '#F0EEE9' : '#2E2A22', border: '1px solid rgba(212,207,195,0.10)',
              color: 'var(--admin-text)', cursor: 'pointer', fontSize: '14px',
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
              background: adminTheme === 'light' ? '#FFFFFF' : '#1E1C17',
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
            background: adminTheme === 'light' ? '#FFFFFF' : '#1E1C17',
            borderRight: adminTheme === 'light' ? '1px solid rgba(42,40,32,0.08)' : '1px solid rgba(212,207,195,0.10)',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowX: 'hidden', background: 'var(--admin-bg, #0C0B08)' }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '24px' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
