// ============================================================
// components/partner/PartnerAdminShell.tsx
// Sidebar shell for the partner admin portal.
// Visual style matches AccountClient.tsx exactly:
// same CSS vars, same fonts, same tab-button pattern.
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/partner/brand',     label: 'Brand',     icon: '✦', desc: 'Logo, colours, fonts'    },
  { href: '/partner/courses',   label: 'Courses',   icon: '▶', desc: 'Create & publish content' },
  { href: '/partner/pricing',   label: 'Pricing',   icon: '₦', desc: 'Plan prices in Naira'    },
  { href: '/partner/members',   label: 'Members',   icon: '⬡', desc: 'Invite & manage'         },
  { href: '/partner/analytics', label: 'Analytics', icon: '◉', desc: 'Enrollments & growth'    },
  { href: '/partner/revenue',   label: 'Revenue',   icon: '◈', desc: 'Earnings & splits'       },
  { href: '/partner/settings',  label: 'Settings',  icon: '⚙', desc: 'Domain & Paystack'       },
];

export default function PartnerAdminShell({
  children,
  partner,
  userId,
}: {
  children: React.ReactNode;
  partner: any;
  userId: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brand = partner.brand || {};

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
          <Link href="/dashboard"
            style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}>
            ← Back to platform
          </Link>
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

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            display: 'none', // shown via CSS on mobile
            padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text)', cursor: 'pointer',
          }}
          className="partner-mobile-toggle"
        >
          ☰
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside style={{
          width: 220, borderRight: '1px solid var(--border)',
          padding: '20px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'var(--bg)',
          minHeight: 'calc(100vh - 53px)',
        }}>
          {navItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
                  background:  isActive ? 'var(--bg-card)' : 'transparent',
                  border:      isActive ? '1px solid var(--border)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}>
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
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>
              Your revenue share
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-heading)' }}>
              {partner.revenue_share_percent}%
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              of every member payment
            </p>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────── */}
        <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
