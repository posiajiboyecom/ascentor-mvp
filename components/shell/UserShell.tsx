'use client';

// Member-app shell: black collapsible sidebar (drawer on mobile), sticky header
// with avatar, global search (Ctrl/Cmd+K) and page-scoped search,
// announcements, messages, notifications, and Sage, the floating AI coach.
// Light theme only.

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  Compass, Gift, LayoutDashboard, Megaphone, MapPin, Settings, ShieldCheck, TrendingUp, UserRound, Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/Notifications';
import { AnnouncementsBell, MessagesLink, type BellItem } from '@/components/rx/HeaderActions';
import { ToastProvider } from '@/components/rx/Toast';
import SummitModal from './SummitModal';
import { NAV_ITEMS } from '@/lib/nav-items';
import ShellLayout from './ShellLayout';
import SageFloat, { clearSageGreeting } from './SageFloat';
import type { ShellNavGroup } from './types';

export interface ShellCountsProp {
  unreadAnnouncements: number;
  messageRequests: number;
  cityGroupSlug: string | null;
  cityName: string | null;
  latest: BellItem[];
}

interface UserShellProps {
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  userId: string;
  summitRegistered: boolean;
  counts?: ShellCountsProp;
  children: React.ReactNode;
}

export default function UserShell({ userId, userName, email, avatarUrl, role, summitRegistered, counts, children }: UserShellProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isStaff = role === 'admin' || role === 'moderator';
  const unread = counts?.unreadAnnouncements ?? 0;
  const citySlug = counts?.cityGroupSlug ?? null;

  const groups: ShellNavGroup[] = useMemo(() => {
    const g: ShellNavGroup[] = [
      { items: NAV_ITEMS.map(({ icon: Icon, label, href }) => ({ href, label, icon: <Icon /> })) },
      {
        label: 'Explore',
        items: [
          { href: '/community',         label: 'Community',  icon: <Compass /> },
          { href: '/community/groups',  label: 'Groups',     icon: <Users /> },
          ...(citySlug ? [{ href: `/community/groups/${citySlug}`, label: 'City groups', icon: <MapPin />, badge: counts?.cityName ?? undefined }] : []),
        ],
      },
      {
        label: 'You',
        items: [
          { href: '/announcements', label: 'Announcements', icon: <Megaphone />, badge: unread > 0 ? unread : undefined },
          { href: '/growth',        label: 'My Growth',     icon: <TrendingUp /> },
          { href: '/referral',      label: 'Refer & earn',  icon: <Gift /> },
          { href: '/settings',      label: 'Settings',      icon: <Settings /> },
        ],
      },
    ];
    if (isStaff) {
      g.push({ label: 'Staff', items: [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] });
    }
    return g;
  }, [isStaff, unread, citySlug, counts?.cityName]);

  // The shell has already asked "Sign out?" by the time this runs.
  const handleSignOut = async () => {
    clearSageGreeting(); // so the next login is greeted again
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <ToastProvider>
      <ShellLayout
        variant="app"
        groups={groups}
        user={{ name: userName, email, avatarUrl, role }}
        homeHref="/dashboard"
        settingsHref="/profile"
        searchEndpoint="/api/search"
        searchPlaceholder="Search lessons, rooms and people"
        onSignOut={handleSignOut}
        menuLinks={[
          { href: '/dashboard', label: 'Today',    icon: <LayoutDashboard /> },
          { href: '/profile',   label: 'Profile',  icon: <UserRound /> },
          { href: '/settings',  label: 'Settings', icon: <Settings /> },
          { href: '/account',   label: 'Account and billing', icon: <Gift /> },
          ...(isStaff ? [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] : []),
        ]}
        headerActions={
          <>
            <AnnouncementsBell items={counts?.latest ?? []} unread={unread} />
            <MessagesLink requests={counts?.messageRequests ?? 0} />
            <NotificationBell />
          </>
        }
      >
        {children}
      </ShellLayout>

      <SageFloat userName={userName} />
      <SummitModal registered={summitRegistered} userId={userId} />
    </ToastProvider>
  );
}
