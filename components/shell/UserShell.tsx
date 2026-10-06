'use client';

// Member-app shell: black collapsible sidebar (drawer on mobile), sticky header
// with avatar, global search (Ctrl/Cmd+K) and page-scoped search,
// notifications, and Sage, the floating AI coach.
// Light theme only.

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Gift, Settings, ShieldCheck, LayoutDashboard, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/Notifications';
import SummitModal from './SummitModal';
import { NAV_ITEMS } from '@/lib/nav-items';
import ShellLayout from './ShellLayout';
import SageFloat, { clearSageGreeting } from './SageFloat';
import type { ShellNavGroup } from './types';

interface UserShellProps {
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  userId: string;
  summitRegistered: boolean;
  children: React.ReactNode;
}

export default function UserShell({ userId, userName, email, avatarUrl, role, summitRegistered, children }: UserShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isStaff = role === 'admin' || role === 'moderator';

  const groups: ShellNavGroup[] = useMemo(() => {
    const g: ShellNavGroup[] = [
      { items: NAV_ITEMS.map(({ icon: Icon, label, href }) => ({ href, label, icon: <Icon /> })) },
      {
        label: 'You',
        items: [
          { href: '/referral', label: 'Refer & earn', icon: <Gift /> },
          { href: '/account',  label: 'Settings',     icon: <Settings /> },
        ],
      },
    ];
    if (isStaff) {
      g.push({ label: 'Staff', items: [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] });
    }
    return g;
  }, [isStaff]);

  // The shell has already asked "Sign out?" by the time this runs.
  const handleSignOut = async () => {
    clearSageGreeting(); // so the next login is greeted again
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <ShellLayout
        variant="app"
        groups={groups}
        user={{ name: userName, email, avatarUrl, role }}
        homeHref="/dashboard"
        settingsHref="/account"
        searchEndpoint="/api/search"
        searchPlaceholder="Search courses, sessions…"
        onSignOut={handleSignOut}
        menuLinks={[
          { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
          { href: '/account',   label: 'Settings',  icon: <UserRound /> },
          ...(isStaff ? [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] : []),
        ]}
        headerActions={<NotificationBell />}
      >
        {children}
      </ShellLayout>

      <SageFloat userName={userName} />
      <SummitModal registered={summitRegistered} userId={userId} />
    </>
  );
}
