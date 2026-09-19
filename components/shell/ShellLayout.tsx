'use client';

// Shared dashboard shell used by BOTH /admin and the member app.
//
//   ┌────────────┬──────────────────────────────────────────────┐
//   │  Sidebar   │  Sticky header: menu · title · search · me   │
//   │  (collapse │──────────────────────────────────────────────│
//   │   on ≥lg,  │  Page content (scrolls)                      │
//   │   drawer   │                                              │
//   │   below)   │                                              │
//   └────────────┴──────────────────────────────────────────────┘
//
// - Sidebar collapses to an icon rail on desktop (state persisted per variant);
//   collapsed items get react-tooltip labels.
// - Below 1024px the sidebar becomes an off-canvas drawer with a backdrop.
// - Header is sticky and carries: drawer toggle, page title, search, theme
//   toggle, extra actions (e.g. notifications) and the avatar menu.
// - Search is two-tier: the header input filters the current page when the
//   page registered via usePageSearch(); everything else goes through the
//   global command palette (Ctrl/Cmd+K).

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import {
  ChevronsLeft, LogOut, Menu, Moon, Search, Sun, X,
} from 'lucide-react';
import '@/styles/shell.css';
import CommandPalette from './CommandPalette';
import { PageSearchProvider, usePageSearchContext } from './PageSearch';
import {
  initialsOf, isActivePath,
  type ShellMenuLink, type ShellNavGroup, type ShellUser,
} from './types';

export interface ShellLayoutProps {
  variant: 'admin' | 'app';
  groups: ShellNavGroup[];
  user: ShellUser;
  logoSrc: string;
  homeHref: string;
  searchEndpoint: string;
  searchPlaceholder: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  /** Links shown in the avatar menu, above sign out. */
  menuLinks?: ShellMenuLink[];
  /** Extra header controls, e.g. <NotificationBell />. */
  headerActions?: React.ReactNode;
  /** Extra sidebar content shown above the footer while expanded (billboards, promo cards). */
  sidebarExtra?: React.ReactNode;
  /** Wrap children in a padded, max-width container (admin). Member pages manage their own layout. */
  padded?: boolean;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'shell:collapsed:';

function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => { setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);
  return mac;
}

export default function ShellLayout(props: ShellLayoutProps) {
  return (
    <PageSearchProvider>
      <ShellInner {...props} />
    </PageSearchProvider>
  );
}

function ShellInner({
  variant, groups, user, logoSrc, homeHref, searchEndpoint, searchPlaceholder,
  isDark, onToggleTheme, onSignOut, menuLinks = [], headerActions, sidebarExtra,
  padded = false, children,
}: ShellLayoutProps) {
  const pathname = usePathname();
  const pageSearch = usePageSearchContext();
  const isMac = useIsMac();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // ── persisted collapse state ──────────────────────────────────────────────
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_PREFIX + variant) === '1'); } catch { /* private mode */ }
  }, [variant]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_PREFIX + variant, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, [variant]);

  // ── route change: close transient UI, reset scroll ────────────────────────
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // ── body scroll lock while the drawer is open ─────────────────────────────
  useEffect(() => {
    if (drawerOpen) document.body.setAttribute('data-sh-lock', 'true');
    else document.body.removeAttribute('data-sh-lock');
    return () => document.body.removeAttribute('data-sh-lock');
  }, [drawerOpen]);

  // ── global shortcuts: Ctrl/Cmd+K, Escape ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── close avatar menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  // ── title = active nav label ──────────────────────────────────────────────
  const title = useMemo(() => {
    let best: { label: string; len: number } | null = null;
    for (const g of groups) {
      for (const item of g.items) {
        if (isActivePath(pathname, item.href) && (!best || item.href.length > best.len)) {
          best = { label: item.label, len: item.href.length };
        }
      }
    }
    return best?.label ?? (variant === 'admin' ? 'Admin' : 'Ascentor');
  }, [groups, pathname, variant]);

  const tip = (label: string) =>
    collapsed ? { 'data-tooltip-id': 'sh-tip', 'data-tooltip-content': label } : {};

  const shortcut = isMac ? '⌘K' : 'Ctrl K';
  const scoped = pageSearch?.scope != null;

  const openPalette = () => setPaletteOpen(true);

  const scopedInput = scoped && pageSearch ? (
    <label className="sh-search">
      <Search aria-hidden="true" />
      <input
        value={pageSearch.query}
        onChange={e => pageSearch.setQuery(e.target.value)}
        placeholder={pageSearch.scope ?? ''}
        aria-label={pageSearch.scope ?? 'Search this page'}
        autoComplete="off"
      />
      {pageSearch.query && (
        <button
          type="button" className="sh-kbd" onClick={() => pageSearch.setQuery('')}
          aria-label="Clear search" style={{ cursor: 'pointer' }}
        >
          Clear
        </button>
      )}
    </label>
  ) : null;

  return (
    <div className="sh-root" data-variant={variant}>
      {/* ── Drawer backdrop (mobile) ── */}
      {drawerOpen && <div className="sh-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      {/* ── Sidebar ── */}
      <aside
        className="sh-sidebar"
        data-collapsed={collapsed}
        data-open={drawerOpen}
        aria-label="Primary"
      >
        <div className="sh-brand">
          <Link href={homeHref} className="sh-brand-link" onClick={() => setDrawerOpen(false)} aria-label="Ascentor home">
            <span className="sh-brand-mark" aria-hidden="true">A</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="Ascentor" />
          </Link>
          {user.role && variant === 'admin' && <span className="sh-role">{user.role}</span>}
          <button
            type="button"
            className="sh-icon-btn sh-drawer-only"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        <nav className="sh-nav">
          {groups.map((group, gi) => (
            <div className="sh-group" key={group.label ?? `g${gi}`}>
              {group.label ? <p className="sh-group-label">{group.label}</p> : null}
              {gi > 0 && <div className="sh-divider" />}
              {group.items.map(item => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sh-item"
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.label}
                    {...tip(item.label)}
                  >
                    <span className="sh-item-icon" aria-hidden="true">{item.icon}</span>
                    <span className="sh-item-label">{item.label}</span>
                    {item.badge != null && <span className="sh-badge">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {sidebarExtra && <div className="sh-sidebar-extra">{sidebarExtra}</div>}

        <div className="sh-sidebar-foot sh-desktop-only">
          <button
            type="button"
            className="sh-foot-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            {...tip('Expand sidebar')}
          >
            <span className="sh-item-icon"><ChevronsLeft className="sh-collapse-chevron" /></span>
            <span className="sh-foot-label">Collapse</span>
          </button>
        </div>
      </aside>

      {/* ── Content column ── */}
      <div className="sh-col">
        <header className="sh-header">
          <div className="sh-header-row">
            {/* Mobile: open drawer */}
            <button
              type="button" className="sh-icon-btn sh-drawer-only"
              onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}
            >
              <Menu />
            </button>
            {/* Desktop: collapse toggle mirrors the sidebar control */}
            <button
              type="button" className="sh-icon-btn sh-desktop-only"
              onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Menu />
            </button>

            <h1 className="sh-title">{title}</h1>

            <div className="sh-search-wrap">
              {scopedInput ?? (
                <button type="button" className="sh-search" onClick={openPalette} aria-label="Open search">
                  <Search aria-hidden="true" />
                  <span className="sh-search-hint">{searchPlaceholder}</span>
                  <span className="sh-kbd">{shortcut}</span>
                </button>
              )}
            </div>
            {scoped && (
              <button type="button" className="sh-global-btn" onClick={openPalette} aria-label="Open global search">
                <Search aria-hidden="true" /> Global <span className="sh-kbd">{shortcut}</span>
              </button>
            )}

            <div className="sh-header-actions">
              <button
                type="button" className="sh-icon-btn sh-mobile-search" onClick={openPalette} aria-label="Open search"
              >
                <Search />
              </button>
              <button
                type="button" className="sh-icon-btn" onClick={onToggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun /> : <Moon />}
              </button>
              {headerActions}

              <div className="sh-menu-wrap" ref={menuRef}>
                <button
                  type="button" className="sh-avatar-btn"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Account menu"
                >
                  <Avatar user={user} />
                </button>
                {menuOpen && (
                  <div className="sh-menu" role="menu">
                    <div className="sh-menu-head">
                      <Avatar user={user} />
                      <div style={{ minWidth: 0 }}>
                        <div className="sh-menu-name">{user.name}</div>
                        <div className="sh-menu-sub">{user.email || user.role || ''}</div>
                      </div>
                    </div>
                    <div className="sh-menu-sep" />
                    {menuLinks.map(link => (
                      <Link
                        key={link.href} href={link.href} className="sh-menu-item" role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.icon}{link.label}
                      </Link>
                    ))}
                    {menuLinks.length > 0 && <div className="sh-menu-sep" />}
                    <button
                      type="button" className="sh-menu-item" data-danger="true" role="menuitem"
                      onClick={() => { setMenuOpen(false); onSignOut(); }}
                    >
                      <LogOut />Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: page-scoped search sits under the header row */}
          <div className="sh-scope-row" data-active={scoped}>{scopedInput}</div>
        </header>

        <main className="sh-main" ref={mainRef} data-pad={padded}>
          {padded ? <div className="sh-main-inner">{children}</div> : children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        groups={groups}
        endpoint={searchEndpoint}
        placeholder={searchPlaceholder}
      />

      <Tooltip
        id="sh-tip"
        place="right"
        offset={14}
        delayShow={120}
        positionStrategy="fixed"
        style={{
          zIndex: 200, padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'var(--sh-fg)', color: 'var(--sh-bg)',
        }}
      />
    </div>
  );
}

function Avatar({ user }: { user: ShellUser }) {
  return (
    <span className="sh-avatar" aria-hidden="true">
      {user.avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        : initialsOf(user.name)}
    </span>
  );
}
