'use client';

// Member-app shell: collapsible sidebar (drawer on mobile), sticky header with
// avatar, global search (Ctrl/Cmd+K) and page-scoped search, notifications.
// Replaces the old fixed dark rail + bottom tab bar in app/(app)/layout.tsx.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Gift, Settings, ShieldCheck, LayoutDashboard, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AppThemeProvider, useAppTheme } from '@/components/AppThemeProvider';
import { NotificationBell } from '@/components/Notifications';
import RailBillboard from '@/components/nav/RailBillboard';
import { NAV_ITEMS } from '@/lib/nav-items';
import ShellLayout from './ShellLayout';
import type { ShellNavGroup } from './types';

interface UserShellProps {
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  summitDaysAway: number;
  children: React.ReactNode;
}

export default function UserShell(props: UserShellProps) {
  return (
    <AppThemeProvider>
      <UserShellInner {...props} />
    </AppThemeProvider>
  );
}

function UserShellInner({ userName, email, avatarUrl, role, summitDaysAway, children }: UserShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { isDark, toggle } = useAppTheme();
  const isStaff = role === 'admin' || role === 'moderator';

  const groups: ShellNavGroup[] = useMemo(() => {
    const g: ShellNavGroup[] = [
      { items: NAV_ITEMS.map(({ icon: Icon, label, href }) => ({ href, label, icon: <Icon /> })) },
      {
        label: 'You',
        items: [
          { href: '/referral', label: 'Refer & earn', icon: <Gift /> },
          { href: '/account',  label: 'Account',      icon: <Settings /> },
        ],
      },
    ];
    if (isStaff) {
      g.push({ label: 'Staff', items: [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] });
    }
    return g;
  }, [isStaff]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <ShellLayout
      variant="app"
      groups={groups}
      user={{ name: userName, email, avatarUrl, role }}
      logoSrc={isDark ? '/ascentor-color-for-dark-pages.svg' : '/ascentor-color-for-light-pages.svg'}
      homeHref="/dashboard"
      searchEndpoint="/api/search"
      searchPlaceholder="Search courses, sessions…"
      isDark={isDark}
      onToggleTheme={toggle}
      onSignOut={handleSignOut}
      menuLinks={[
        { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
        { href: '/account',   label: 'My account', icon: <UserRound /> },
        ...(isStaff ? [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] : []),
      ]}
      headerActions={<NotificationBell />}
      sidebarExtra={
        <>
          {/* Managed from Admin -> Rail Billboards */}
          <RailBillboard />
          <Link
            href="/elevation-summit"
            style={{
              display: 'block', marginTop: 8, padding: '12px 14px', borderRadius: 12, textDecoration: 'none',
              border: '1px solid var(--app-border-gold)', background: 'var(--app-accent-glow)',
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--app-accent)' }}>
              The Elevation Summit
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, fontWeight: 600, color: 'var(--app-text)' }}>19 Nov 2026 · Lagos</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--app-accent)' }}>
              {summitDaysAway} days away, learn more →
            </p>
          </Link>
        </>
      }
    >
      {children}
    </ShellLayout>
  );
}
