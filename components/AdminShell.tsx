'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell · Role-gated navigation
//
// admin     → sees everything including Master Dashboard + Permissions
// moderator → sees content + community sections only
//
// userPermissions: jsonb array from profiles.permissions
//   If set, overrides per-moderator. If null, role defaults apply.
// ─────────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  permission?: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  adminOnly?: boolean;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Root',
    adminOnly: true,
    items: [
      {
        href: '/admin/master',
        label: 'Master Dashboard',
        adminOnly: true,
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
        ),
      },
      {
        href: '/admin/permissions',
        label: 'Permissions',
        adminOnly: true,
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Overview',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Content',
    items: [
      {
        href: '/admin/content',
        label: 'Content Pipeline',
        permission: 'content.blog.create',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        ),
      },
      {
        href: '/admin/blog',
        label: 'Blog',
        permission: 'content.blog.create',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        ),
      },
      {
        href: '/admin/products',
        label: 'Products',
        permission: 'content.products',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        ),
      },
      {
        href: '/admin/courses',
        label: 'Courses',
        permission: 'content.courses',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        ),
      },
      {
        href: '/admin/newsletter',
        label: 'Newsletter',
        permission: 'content.newsletter',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        permission: 'users.view',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
          </svg>
        ),
      },
      {
        href: '/admin/mentors',
        label: 'Mentors',
        permission: 'mentors.view',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        ),
      },
      {
        href: '/admin/cohorts',
        label: 'Cohorts',
        permission: 'community.cohorts.create',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      },
      {
        href: '/admin/experts',
        label: 'Expert Events',
        permission: 'experts.create',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <path d="M9 11l2 2 4-4" strokeWidth="2"/>
          </svg>
        ),
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        href: '/admin/coaching',
        label: 'Chat Data',
        permission: 'reports.view',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        ),
      },
      {
        href: '/admin/reports',
        label: 'Reports',
        permission: 'reports.view',
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
          </svg>
        ),
      },
      {
        href: '/admin/promo-codes',
        label: 'Promo Codes',
        adminOnly: true,
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        ),
      },
      {
        href: '/admin/logs',
        label: 'Audit Logs',
        adminOnly: true,
        icon: (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        ),
      },
    ],
  },
];

// Default permissions for moderators when no overrides are set
const MODERATOR_DEFAULTS = new Set([
  'content.blog.create',
  'content.products',
  'experts.create',
  'community.cohorts.create',
]);

function canSeeItem(item: NavItem, role: string, userPermissions: string[] | null): boolean {
  if (item.adminOnly) return role === 'admin';
  if (role === 'admin') return true;
  if (item.permission) {
    if (userPermissions !== null) return userPermissions.includes(item.permission);
    return MODERATOR_DEFAULTS.has(item.permission);
  }
  return true;
}

const STYLES = `
  /* ── Admin page vars — dark (default) ─────────────────── */
  [data-admin-theme="dark"] {
    --admin-bg:              #0C0B08;
    --admin-bg-deep:         #141210;
    --admin-bg-card:         #1E1C17;
    --admin-bg-card-hover:   #23201A;
    --admin-bg-input:        #2E2A22;
    --admin-text-heading:    #FEF9EC;
    --admin-text:            #D4CFC3;
    --admin-text-dim:        #9A9280;
    --admin-text-muted:      #7A7260;
    --admin-text-faint:      #4A4438;
    --admin-border:          rgba(212,207,195,0.10);
    --admin-border-strong:   rgba(212,207,195,0.18);
  }

  /* ── Admin page vars — light ───────────────────────────── */
  [data-admin-theme="light"] {
    --admin-bg:              #F5F3EE;
    --admin-bg-deep:         #EEE9E0;
    --admin-bg-card:         #FFFFFF;
    --admin-bg-card-hover:   #F7F4EE;
    --admin-bg-input:        #F0EDE6;
    --admin-text-heading:    #0F0D0A;
    --admin-text:            #1A1714;
    --admin-text-dim:        #3D3529;
    --admin-text-muted:      #5C5244;
    --admin-text-faint:      #7A6E60;
    --admin-border:          rgba(0,0,0,0.08);
    --admin-border-strong:   rgba(0,0,0,0.13);
  }

  /* ── Shell theme tokens ────────────────────────────────── */
  [data-admin-theme="dark"] {
    --bg-root:        #0C0B08;
    --bg-sidebar:     #1E1C17;
    --bg-hover:       rgba(232,160,32,0.07);
    --bg-active:      rgba(232,160,32,0.12);
    --bg-root-active: rgba(232,160,32,0.18);
    --bg-drawer:      #1E1C17;
    --bg-mobile-hdr:  #1E1C17;
    --bg-menu-btn:    #2E2A22;
    --border:         rgba(212,207,195,0.10);
    --border-menu:    rgba(212,207,195,0.10);
    --text-primary:   #D4CFC3;
    --text-nav:       #7A7260;
    --text-muted:     #4A4438;
    --text-active:    #E8A020;
    --text-root-nav:  #E8A020;
    --accent:         #E8A020;
    --accent-bg:      rgba(232,160,32,0.10);
    --accent-border:  rgba(232,160,32,0.20);
    --teal:           #14B8A6;
    --teal-bg:        rgba(20,184,166,0.10);
    --teal-border:    rgba(20,184,166,0.20);
    --avatar-bg:      rgba(232,160,32,0.12);
    --avatar-border:  rgba(232,160,32,0.25);
    --signout-color:  #EF4444;
    --signout-border: rgba(239,68,68,0.2);
    --app-link-color: #7A7260;
    --app-link-border:rgba(212,207,195,0.12);
    --toggle-bg:      #2E2A22;
    --toggle-border:  rgba(212,207,195,0.15);
    --toggle-icon:    #7A7260;
    --toggle-hover-bg:#3A342A;
    --logo-filter:    none;
  }

  [data-admin-theme="light"] {
    --bg-root:        #F5F3EE;
    --bg-sidebar:     #FFFFFF;
    --bg-hover:       rgba(180,120,0,0.06);
    --bg-active:      rgba(180,120,0,0.10);
    --bg-root-active: rgba(180,120,0,0.14);
    --bg-drawer:      #FFFFFF;
    --bg-mobile-hdr:  #FFFFFF;
    --bg-menu-btn:    #F0EDE6;
    --border:         rgba(0,0,0,0.09);
    --border-menu:    rgba(0,0,0,0.09);
    --text-primary:   #1A1714;
    --text-nav:       #6B6355;
    --text-muted:     #9C9080;
    --text-active:    #A0720A;
    --text-root-nav:  #A0720A;
    --accent:         #A0720A;
    --accent-bg:      rgba(160,114,10,0.08);
    --accent-border:  rgba(160,114,10,0.18);
    --teal:           #0F766E;
    --teal-bg:        rgba(15,118,110,0.08);
    --teal-border:    rgba(15,118,110,0.18);
    --avatar-bg:      rgba(160,114,10,0.10);
    --avatar-border:  rgba(160,114,10,0.22);
    --signout-color:  #DC2626;
    --signout-border: rgba(220,38,38,0.2);
    --app-link-color: #6B6355;
    --app-link-border:rgba(0,0,0,0.12);
    --toggle-bg:      #F0EDE6;
    --toggle-border:  rgba(0,0,0,0.10);
    --toggle-icon:    #9C9080;
    --toggle-hover-bg:#E8E3D8;
    --logo-filter:    brightness(0.1) sepia(1) hue-rotate(10deg) saturate(3);
  }

  /* ── Nav styles (use CSS vars) ─────────────────────────── */
  .admin-sidebar-nav { padding: 8px; }
  .admin-nav-group-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text-muted); padding: 0 10px; margin: 12px 0 4px;
  }
  .admin-nav-link {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 8px; margin-bottom: 1px;
    font-family: 'Syne', system-ui, sans-serif;
    font-size: 13px; font-weight: 400;
    color: var(--text-nav); text-decoration: none;
    transition: background 0.15s, color 0.15s; position: relative;
  }
  .admin-nav-link:hover { background: var(--bg-hover); color: var(--text-primary); }
  .admin-nav-link.active { background: var(--bg-active); color: var(--text-active); font-weight: 600; }
  .admin-nav-link .nav-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); margin-left: auto; flex-shrink: 0; }
  .admin-nav-link.root-item { color: var(--text-root-nav); }
  .admin-nav-link.root-item:hover { background: var(--bg-hover); }
  .admin-nav-link.root-item.active { background: var(--bg-root-active); }

  /* ── Theme toggle button ───────────────────────────────── */
  .theme-toggle {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
    background: var(--toggle-bg); border: 1px solid var(--toggle-border);
    color: var(--toggle-icon); cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .theme-toggle:hover { background: var(--toggle-hover-bg); color: var(--text-primary); }

  /* ── Responsive ────────────────────────────────────────── */
  @media (max-width: 1023px) { .admin-desktop-sidebar { display: none !important; } }
  @media (min-width: 1024px) { .admin-mobile-header { display: none !important; } }
  @media (max-width: 1023px) {
    .admin-main-content { padding: 16px 12px 32px !important; }
    .admin-main-content h1 { font-size: 1.25rem !important; }
    .admin-main-content table { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; }
    .admin-main-content .admin-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
    .admin-main-content button, .admin-main-content select, .admin-main-content input { font-size: 13px !important; min-height: 36px; }
    .admin-main-content [class*="grid-cols-3"], .admin-main-content [class*="grid-cols-4"] { grid-template-columns: 1fr 1fr !important; }
    .admin-main-content .admin-action-row { flex-wrap: wrap; gap: 8px; }
    .admin-main-content .admin-card { width: 100% !important; }
    .admin-main-content .admin-table-cell { padding: 10px 8px !important; font-size: 12px !important; }
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
  userPermissions?: string[] | null;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  // Read theme synchronously from localStorage to avoid flash.
  // We default to 'dark' for SSR, then instantly correct on mount
  // via the inline <script> injected into the wrapper div.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ascentor-admin-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ascentor-admin-theme', next);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  const perms = userPermissions ?? null;

  // Logo: use dark-page logo for dark theme, swap for light theme
  const logoSrc = theme === 'dark'
    ? '/ascentor-color-for-dark-pages.svg'
    : '/ascentor-color-for-light-pages.svg';

  const ThemeToggle = () => (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        // Sun icon
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo + badge */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <Link href="/admin" style={{ display: 'block', textDecoration: 'none', marginBottom: '10px' }}>
          <img
            src={logoSrc}
            alt="Ascentor"
            style={{ height: '26px', width: 'auto', filter: 'var(--logo-filter)' }}
          />
        </Link>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: '9px', fontWeight: 500,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          color: role === 'admin' ? 'var(--accent)' : 'var(--teal)',
          background: role === 'admin' ? 'var(--accent-bg)' : 'var(--teal-bg)',
          border: `1px solid ${role === 'admin' ? 'var(--accent-border)' : 'var(--teal-border)'}`,
          padding: '3px 8px', borderRadius: '100px', display: 'inline-block',
        }}>
          {role === 'admin' ? '⬡ Root Admin' : '◈ Moderator'}
        </span>
      </div>

      {/* Grouped nav */}
      <nav className="admin-sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {NAV_GROUPS.map(group => {
          if (group.adminOnly && role !== 'admin') return null;
          const visibleItems = group.items.filter(item => canSeeItem(item, role, perms));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="admin-nav-group-label">{group.label}</p>
              {visibleItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNav}
                  className={`admin-nav-link${item.adminOnly ? ' root-item' : ''} ${isActive(item.href) ? 'active' : ''}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, opacity: isActive(item.href) ? 1 : 0.7 }}>
                    {item.icon}
                  </span>
                  {item.label}
                  {isActive(item.href) && <span className="nav-dot" />}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--avatar-bg)', border: '1.5px solid var(--avatar-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne', sans-serif", fontSize: '11px', fontWeight: 700,
            color: 'var(--accent)', flexShrink: 0,
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <p style={{
            fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 600,
            color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {name}
          </p>
          <ThemeToggle />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href="/dashboard" onClick={onNav} style={{
            fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
            color: 'var(--app-link-color)', border: '1px solid var(--app-link-border)',
            textDecoration: 'none', fontFamily: "'Syne', sans-serif",
          }}>← App</Link>
          <button onClick={handleSignOut} style={{
            fontSize: '11px', padding: '5px 10px', borderRadius: '7px',
            color: 'var(--signout-color)', border: '1px solid var(--signout-border)',
            background: 'transparent', cursor: 'pointer', fontFamily: "'Syne', sans-serif",
          }}>Sign Out</button>
        </div>
      </div>
    </>
  );

  return (
    <div data-admin-theme={theme} style={{ minHeight: '100vh', background: 'var(--bg-root)', display: 'flex', flexDirection: 'column' }}>
      <style>{STYLES}</style>
      {/* Inline script: runs synchronously before browser paints, kills any theme flash */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function(){
          try {
            var t = localStorage.getItem('ascentor-admin-theme');
            if (t === 'light' || t === 'dark') {
              document.currentScript.parentElement.setAttribute('data-admin-theme', t);
            }
          } catch(e){}
        })();
      `}} />

      {/* Mobile header */}
      <div className="admin-mobile-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--bg-mobile-hdr)',
        borderBottom: '1px solid var(--border)',
      }}>
        <img src={logoSrc} alt="Ascentor" style={{ height: '24px', width: 'auto', filter: 'var(--logo-filter)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeToggle />
          <span style={{
            fontFamily: "'DM Mono', monospace", fontSize: '9px', fontWeight: 500,
            letterSpacing: '0.12em', textTransform: 'uppercase' as const,
            color: role === 'admin' ? 'var(--accent)' : 'var(--teal)',
            background: role === 'admin' ? 'var(--accent-bg)' : 'var(--teal-bg)',
            border: `1px solid ${role === 'admin' ? 'var(--accent-border)' : 'var(--teal-border)'}`,
            padding: '3px 8px', borderRadius: '100px',
          }}>
            {role === 'admin' ? '⬡ Root' : '◈ Mod'}
          </span>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            width: '34px', height: '34px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: '8px',
            background: 'var(--bg-menu-btn)', border: '1px solid var(--border-menu)',
            color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px',
          }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setMenuOpen(false)}>
          <div style={{ width: '240px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-drawer)' }}
            onClick={e => e.stopPropagation()}>
            <SidebarContent onNav={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside className="admin-desktop-sidebar" style={{
          width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
          height: '100vh', position: 'sticky', top: 0,
          background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
        }}>
          <SidebarContent />
        </aside>

        {/* Main */}
        <main className="admin-main-content" style={{
          flex: 1, minWidth: 0, padding: '28px 32px',
          color: 'var(--text-primary)', overflowY: 'auto',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
