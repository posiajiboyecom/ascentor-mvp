'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV = [
  { href: '/admin',             label: 'Overview',      icon: '📊' },
  { href: '/admin/users',       label: 'Users',         icon: '👥' },
  { href: '/admin/cohorts',     label: 'Cohorts',       icon: '🏘️' },
  { href: '/admin/experts',     label: 'Expert Events', icon: '🎓' },
  { href: '/admin/courses',     label: 'Courses',       icon: '📚' },
  { href: '/admin/coaching',    label: 'Chat Data',     icon: '💬' },
  { href: '/admin/blog',        label: 'Blog',          icon: '📝' },
  { href: '/admin/newsletter',  label: 'Newsletter',    icon: '📨' },
  { href: '/admin/mentors',     label: 'Mentors',       icon: '🤝' },
  { href: '/admin/promo-codes', label: 'Promo Codes',   icon: '🎟️' },
  { href: '/admin/logs',        label: 'Audit Logs',    icon: '🔍' },
  { href: '/admin/reports',     label: 'Reports',       icon: '📈' },
];

const STYLES = `
  @media (max-width: 768px) {
    .admin-content .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 -16px; padding: 0 16px; }
    .admin-content .table-scroll > div { min-width: 640px; }
  }
  .admin-nav-link {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 8px; margin-bottom: 2px;
    font-size: 13.5px; font-family: 'Inter', sans-serif; font-weight: 400;
    color: var(--text-muted); text-decoration: none; transition: all 0.18s ease;
  }
  .admin-nav-link:hover { background: rgba(102,98,255,0.07); color: var(--text); }
  .admin-nav-link.active { background: rgba(102,98,255,0.12); color: var(--accent); font-weight: 600; }
  .admin-nav-link .nav-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); margin-left: auto; flex-shrink: 0; }
`;

const AscentorLogo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L22 20H2L12 3Z" fill="#6662FF" fillOpacity="0.12" stroke="#6662FF" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 8L18 20H6L12 8Z" fill="#6662FF" fillOpacity="0.35"/>
      <path d="M9 20H15" stroke="#A6A2FF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '16px', color: 'var(--text)', letterSpacing: '-0.01em' }}>
      Ascentor
    </span>
  </div>
);

const RoleBadge = ({ role }: { role: string }) => (
  <span style={{
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    padding: '3px 9px', borderRadius: '100px', display: 'inline-block',
    background: 'rgba(102,98,255,0.1)', color: '#A6A2FF',
    border: '1px solid rgba(102,98,255,0.22)',
  }}>{role}</span>
);

export default function AdminShell({ children, name, role }: { children: React.ReactNode; name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };
  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  const NavItems = ({ onNav }: { onNav?: () => void }) => (
    <>
      {NAV.map(item => (
        <Link key={item.href} href={item.href} onClick={onNav}
          className={`admin-nav-link ${isActive(item.href) ? 'active' : ''}`}>
          <span style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{item.icon}</span>
          {item.label}
          {isActive(item.href) && <span className="nav-dot" />}
        </Link>
      ))}
    </>
  );

  const SidebarFooter = ({ onNav }: { onNav?: () => void }) => (
    <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: 'rgba(102,98,255,0.15)', color: 'var(--accent)', border: '1px solid rgba(102,98,255,0.25)' }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{name}</p>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Link href="/dashboard" onClick={onNav} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, color: 'var(--text-dim)', border: '1px solid var(--border)', textDecoration: 'none', fontFamily: 'Inter, sans-serif' }}>← App</Link>
        <button onClick={handleSignOut} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Sign Out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <style>{STYLES}</style>

      {/* Mobile header */}
      <div className="lg:hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <AscentorLogo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RoleBadge role={role} />
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.65)' }} onClick={() => setMenuOpen(false)}>
          <div style={{ width: 240, height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}><AscentorLogo /></div>
            <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}><NavItems onNav={() => setMenuOpen(false)} /></nav>
            <SidebarFooter onNav={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex' }}>
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex" style={{ width: 220, flexShrink: 0, flexDirection: 'column', height: '100vh', position: 'sticky', top: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <Link href="/admin" style={{ textDecoration: 'none' }}><AscentorLogo /></Link>
            <div style={{ marginTop: 10 }}><RoleBadge role={role} /></div>
          </div>
          <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', padding: '0 12px', marginBottom: 8 }}>Menu</p>
            <NavItems />
          </nav>
          <SidebarFooter />
        </aside>

        {/* Content */}
        <main style={{ flex: 1, overflowX: 'hidden' }}>
          <div className="admin-content" style={{ maxWidth: 1024, margin: '0 auto', padding: '24px 24px' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
