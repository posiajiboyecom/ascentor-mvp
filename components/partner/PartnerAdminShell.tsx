// ============================================================
// components/partner/PartnerAdminShell.tsx
//
// FILE LOCATION: components/partner/PartnerAdminShell.tsx
//
// FIXES (W-01, W-02):
//   - Mobile toggle button no longer has display:none inline.
//     Visibility is now controlled by CSS classes so the
//     hamburger appears at ≤ 768 px.
//   - mobileOpen state now drives a full-screen mobile drawer
//     that renders the same nav items as the desktop sidebar.
//   - NavList extracted as a shared inner component so both
//     desktop sidebar and mobile drawer share one render path.
//   - Clicking any nav link on mobile automatically closes the
//     drawer (via setMobileOpen(false) on click).
//   - Outside-click / Escape-key dismissal on mobile drawer.
//   - Responsive CSS lives in globals.css (see that file fix).
//     The inline display values here are for SSR-safe defaults
//     only; the CSS classes override them at runtime.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function getNavItems(base: string) {
  return [
    { href: `${base}/onboarding`,   label: 'Setup',        icon: '◎', desc: 'Onboarding checklist'  },
    { href: `${base}/brand`,        label: 'Brand',        icon: '✦', desc: 'Logo, colours, fonts'  },
    { href: `${base}/ai/persona`,   label: 'AI Persona',   icon: '◬', desc: 'Coach voice & style'   },
    { href: `${base}/members`,      label: 'Members',      icon: '⬡', desc: 'Invite & manage'        },
    { href: `${base}/courses`,      label: 'Courses',      icon: '▣', desc: 'Your course library'    },
    { href: `${base}/events`,       label: 'Events',       icon: '◷', desc: 'Expert sessions'        },
    { href: `${base}/pricing`,      label: 'Pricing',      icon: '◇', desc: 'Member plan prices'     },
    { href: `${base}/revenue`,      label: 'Revenue',      icon: '◈', desc: 'Earnings & splits'      },
    { href: `${base}/analytics`,    label: 'Analytics',    icon: '◫', desc: 'Engagement data'        },
    { href: `${base}/subscription`, label: 'Subscription', icon: '◉', desc: 'Your Ascentor plan'     },
    { href: `${base}/settings`,     label: 'Settings',     icon: '⚙', desc: 'Domain & config'        },
  ];
}

// ── Shared nav list — used by both desktop sidebar and mobile drawer ──
function NavList({
  pathname,
  revenueSharePercent,
  onNavClick,
  basePath,
}: {
  pathname: string;
  revenueSharePercent: number;
  onNavClick?: () => void;
  basePath: string;
}) {
  const navItems = getNavItems(basePath);
  return (
    <>
      {navItems.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              background:  isActive ? 'var(--bg-card)' : 'transparent',
              border:      isActive ? '1px solid var(--border)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              fontSize: 14, width: 20, textAlign: 'center',
              color: isActive ? 'var(--accent)' : 'var(--text-dim)',
            }}>
              {item.icon}
            </span>
            <div>
              <p style={{
                fontSize: 12, fontWeight: 700,
                color: isActive ? 'var(--accent)' : 'var(--text)',
                marginBottom: 1,
              }}>
                {item.label}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.desc}</p>
            </div>
          </Link>
        );
      })}

      {/* Revenue share badge */}
      <div style={{
        marginTop: 'auto', padding: '12px 12px',
        borderRadius: 10, border: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <p style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4,
        }}>
          Your revenue share
        </p>
        <p style={{
          fontSize: 22, fontWeight: 700, color: 'var(--accent)',
          fontFamily: 'var(--font-heading)',
        }}>
          {revenueSharePercent}%
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          of every member payment
        </p>
      </div>
    </>
  );
}

export default function PartnerAdminShell({
  children,
  partner,
  userId,
  basePath = '/partner',
}: {
  children: React.ReactNode;
  partner: any;
  userId: string;
  basePath?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brand = partner.brand || {};

  // Close drawer on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setMobileOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Back to platform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Use <a> (full page nav) not Next.js <Link> (client nav).
              The partner layout computes isAdminPath server-side from the
              x-partner-pathname header. Client-side nav skips that re-evaluation,
              so isAdminPath stays true and PartnerMemberShell never wraps the
              dashboard — resulting in an unstyled, shell-less page until hard reload. */}
          <a
            href="/dashboard"
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ← Back to platform
          </a>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-dim)',
          }}>
            Partner Admin
          </span>
        </div>

        {/* Partner identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={partner.name} style={{ height: 24, width: 'auto' }} />
            : null
          }
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{partner.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: partner.status === 'active' ? 'rgba(16,185,129,0.09)' : 'rgba(245,158,11,0.09)',
            color: partner.status === 'active' ? 'var(--success)' : 'var(--accent)',
            border: `1px solid ${partner.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
            textTransform: 'uppercase',
          }}>
            {partner.status}
          </span>
        </div>

        {/* ── FIX W-01: Mobile toggle — visibility controlled by CSS class, not inline display:none ── */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="partner-admin-mobile-toggle"
          style={{
            padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', cursor: 'pointer',
            fontSize: 18, lineHeight: 1,
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── Desktop Sidebar — hidden on mobile via CSS class ── */}
        <aside
          className="partner-admin-desktop-sidebar"
          style={{
            width: 220, borderRight: '1px solid var(--border)',
            padding: '20px 12px',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: 'var(--bg)',
            minHeight: 'calc(100vh - 53px)',
          }}
        >
          <NavList
            pathname={pathname}
            revenueSharePercent={partner.revenue_share_percent}
            basePath={basePath}
          />
        </aside>

        {/* ── FIX W-02: Mobile drawer — rendered when mobileOpen === true ── */}
        {mobileOpen && (
          <>
            {/* Backdrop — clicking it closes the drawer */}
            <div
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 99,
                background: 'rgba(0,0,0,0.6)',
              }}
            />

            {/* Drawer panel */}
            <div
              className="partner-admin-mobile-drawer"
              style={{
                position: 'fixed', top: 53, left: 0, bottom: 0,
                width: 260, zIndex: 100,
                background: 'var(--bg)',
                borderRight: '1px solid var(--border)',
                padding: '20px 12px',
                display: 'flex', flexDirection: 'column', gap: 4,
                overflowY: 'auto',
                animation: 'slideInLeft 0.2s ease-out',
              }}
            >
              <NavList
                pathname={pathname}
                revenueSharePercent={partner.revenue_share_percent}
                onNavClick={() => setMobileOpen(false)}
                basePath={basePath}
              />
            </div>
          </>
        )}

        {/* ── Main content ─────────────────────────────────── */}
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        /* Mobile: hide desktop sidebar, show toggle */
        @media (max-width: 768px) {
          .partner-admin-desktop-sidebar { display: none !important; }
          .partner-admin-mobile-toggle   { display: flex !important; }
        }
        /* Desktop: show desktop sidebar, hide toggle */
        @media (min-width: 769px) {
          .partner-admin-desktop-sidebar { display: flex !important; }
          .partner-admin-mobile-toggle   { display: none !important; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
