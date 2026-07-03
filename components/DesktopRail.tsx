'use client';

// components/DesktopRail.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Icon-only left rail navigation shown on screens ≥1024px (Tailwind `lg`).
// Replaces the mobile top header + BottomNav above that breakpoint.
//
// Rebuilt to match the prototype's 72px icon-rail pattern (see
// prototype-home.html → .rail-categories). This is now the SAME rail
// component used as the first column of the Community page's 4-pane shell,
// so nav chrome is visually identical across every desktop screen.
//
// This rail is intentionally NOT theme-reactive — per the prototypes it's
// always the dark "Summit Black" rail regardless of the light/dark content
// toggle, the same way the prototype's .app-rail / .rail-categories never
// reference --app-* theme vars. Only the content area to the right of the
// rail responds to the theme toggle.
//
// Carries the same sign-out / admin / settings / theme-toggle menu that
// previously lived in the wider labeled rail, so no functionality is lost
// moving to the compact icon rail — it's all in the avatar dropdown now.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppTheme } from '@/components/AppThemeProvider';
import { NotificationBell } from '@/components/Notifications';

const GOLD     = '#C8A96E';
const GOLD_BG  = 'rgba(200,169,110,0.10)';
const GOLD_B   = 'rgba(200,169,110,0.25)';
const GREEN    = '#16A34A';

const NAV_ITEMS = [
  {
    href: '/dashboard', label: 'Home',
    icon: <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></>,
  },
  {
    href: '/coach', label: 'AI Coach',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    href: '/community', label: 'The Circle',
    icon: <><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /><path d="M18 14a3 3 0 0 1 3 3v1" /></>,
  },
  {
    href: '/experts', label: 'Sessions',
    icon: <><circle cx="12" cy="8" r="4" /><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>,
  },
  {
    href: '/learn', label: 'Resources',
    icon: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  },
];

function summitCountdown() {
  const diff = new Date('2027-02-01T00:00:00Z').getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

// Shared tooltip — appears on hover, anchored to the right of the rail item.
// Mirrors prototype `.tooltip` exactly (left: 58px from a 72px-wide rail).
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      className="rail-tooltip"
      style={{
        position: 'absolute', left: 58, top: '50%', transform: 'translateY(-50%)',
        background: '#0F0F0E', color: '#fff',
        fontSize: 12, fontWeight: 600,
        padding: '6px 10px', borderRadius: 6,
        whiteSpace: 'nowrap', pointerEvents: 'none',
        opacity: 0, transition: 'opacity 0.15s',
        zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        fontFamily: 'var(--font-body, "Inter", sans-serif)',
      }}
    >
      {label}
    </span>
  );
}

interface DesktopRailProps {
  initials: string;
  fullName?: string;
  isAdmin?: boolean;
}

export default function DesktopRail({ initials, fullName, isAdmin }: DesktopRailProps) {
  const pathname = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const { isDark, toggle } = useAppTheme();

  const [showMenu, setShowMenu] = useState(false);
  const [days, setDays]         = useState<number | null>(null);

  useEffect(() => { setDays(summitCountdown()); }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div
      className="hidden lg:flex"
      style={{
        width: 72, flexShrink: 0, background: '#0F0F0E',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', gap: 10,
        height: '100%', overflowY: 'auto', position: 'relative',
      }}
    >
      <style>{`
        .rail-icon-item:hover .rail-tooltip { opacity: 1; }
      `}</style>

      {/* Logo mark */}
      <Link
        href="/dashboard"
        style={{
          width: 44, height: 44, borderRadius: 14,
          background: GOLD_BG, border: `1.5px solid ${GOLD_B}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-accent, "Playfair Display", Georgia, serif)',
          fontStyle: 'italic', fontWeight: 600, color: GOLD, fontSize: 19,
          marginBottom: 8, textDecoration: 'none', flexShrink: 0,
        }}
      >
        A
      </Link>

      <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0', flexShrink: 0 }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className="rail-icon-item"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? GOLD_BG : 'rgba(255,255,255,0.04)',
              color: active ? GOLD : 'rgba(255,255,255,0.4)',
              position: 'relative', textDecoration: 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)',
                width: 4, height: 24, background: GOLD, borderRadius: '0 4px 4px 0',
              }} />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            <RailTooltip label={item.label} />
          </Link>
        );
      })}

      <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0', flexShrink: 0 }} />

      {/* Summit countdown — compact icon, tooltip carries the detail */}
      <Link
        href="/elevation-summit"
        className="rail-icon-item"
        aria-label="The Elevation Summit"
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(200,169,110,0.16), rgba(200,169,110,0.05))',
          border: `1px solid ${GOLD_B}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', textDecoration: 'none', color: GOLD,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <RailTooltip label={days !== null ? `Summit · ${days}d away` : 'The Elevation Summit'} />
      </Link>

      <div style={{ flex: 1 }} />

      {/* Notification bell */}
      <div style={{ flexShrink: 0, color: 'rgba(255,255,255,0.42)' }}>
        <NotificationBell />
      </div>

      {/* Profile avatar + dropdown menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setShowMenu((s) => !s)}
          aria-label="Account menu"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: GOLD_BG, border: `1.5px solid ${GOLD_B}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: GOLD,
            fontFamily: 'var(--font-body, "Inter", sans-serif)',
            cursor: 'pointer',
          }}
        >
          {initials}
        </button>

        {showMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setShowMenu(false)}
            />
            <div style={{
              position: 'absolute', bottom: 0, left: '110%',
              width: 200, borderRadius: 10, padding: '6px 0',
              background: '#1E1E1C', border: '1px solid rgba(255,255,255,0.08)',
              zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '10px 16px 8px' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}>
                  {fullName || 'My Account'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontFamily: 'var(--font-body, "Inter", sans-serif)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
                  Online
                </div>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

              {isAdmin && (
                <>
                  <Link href="/admin" onClick={() => setShowMenu(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: GREEN, textDecoration: 'none', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}>
                    Admin Dashboard
                  </Link>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                </>
              )}
              <Link href="/referral" onClick={() => setShowMenu(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, fontWeight: 500, color: GOLD, textDecoration: 'none', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}>
                Invite &amp; Earn
              </Link>
              <Link href="/account" onClick={() => setShowMenu(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}>
                Settings
              </Link>
              <button
                onClick={toggle}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}
              >
                {isDark ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
                {isDark ? 'Light mode' : 'Dark mode'}
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button
                onClick={handleSignOut}
                style={{ width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: 13, fontWeight: 400, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body, "Inter", sans-serif)' }}
              >
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
