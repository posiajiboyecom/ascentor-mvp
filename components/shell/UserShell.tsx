'use client';

// Member-app shell: black collapsible sidebar (drawer on mobile), sticky header
// with avatar, global search (Ctrl/Cmd+K) and page-scoped search,
// announcements, messages, notifications, and Sage, the floating AI coach.
// Light theme only.

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useCart } from '@/lib/shop-cart';
import {
  Bell, Brain, CalendarClock, CircleHelp, Compass, Gift, LayoutDashboard, Mail, Megaphone, MapPin, Package, Settings, ShieldCheck, ShoppingBag, TrendingUp, UserRound,
} from 'lucide-react';
import { AnnouncementsBell, MessagesLink, NotificationsBell, type BellItem } from '@/components/rx/HeaderActions';
import { ToastProvider } from '@/components/rx/Toast';
import SummitModal from './SummitModal';
import { PresenceProvider } from '@/components/rx/messages/Presence';
import MessagingDock from '@/components/rx/messages/MessagingDock';
import { NAV_ITEMS } from '@/lib/nav-items';
import ShellLayout from './ShellLayout';
import SageFloat, { clearSageGreeting } from './SageFloat';
import PushBootstrap from '@/components/rx/PushBootstrap';
import NetworkPill from '@/components/rx/NetworkPill';
import NoticeCard from '@/components/rx/NoticeCard';
import { NoticeProvider } from '@/components/rx/AsideNotice';
import type { NoticeData } from '@/lib/rx/notice-types';
import SagePanel from '@/components/rx/sage/SagePanel';
import { MobileTabBar } from '@/components/nav/MobileTabBar';
import type { ShellNavGroup } from './types';
import { signOutAndLeave } from '@/lib/auth/sign-out';
import SplashGate from '@/components/SplashGate';

export interface ShellCountsProp {
  unreadAnnouncements: number;
  messageRequests: number;
  unreadMessages?: number;
  cityGroupSlug: string | null;
  cityName: string | null;
  latest: BellItem[];
  notice?: NoticeData | null;
}

interface UserShellProps {
  userName: string;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  userId: string;
  summitRegistered: boolean;
  counts?: ShellCountsProp;
  /** Platform feature switches (Admin > Platform settings). Anything missing is on. */
  features?: Partial<Record<'shop' | 'cities' | 'refer' | 'dock' | 'offline', boolean>>;
  children: React.ReactNode;
}

export default function UserShell({ userId, userName, email, avatarUrl, role, summitRegistered, counts, features, children }: UserShellProps) {
  const showShop = features?.shop !== false;
  const showCities = features?.cities !== false;
  const showRefer = features?.refer !== false;
  const pathname = usePathname();
  // On Today the announcement already sits at the top of the page, so the sidebar does not repeat it.
  const sidebarNotice = counts?.notice && !(pathname === '/dashboard' && counts.notice.source === 'announcement') ? counts.notice : null;
  const isStaff = role === 'admin' || role === 'moderator';
  const unread = counts?.unreadAnnouncements ?? 0;
  const unreadMessages = counts?.unreadMessages ?? 0;
  const requests = counts?.messageRequests ?? 0;
  const { count: cartCount } = useCart();

  const groups: ShellNavGroup[] = useMemo(() => {
    const g: ShellNavGroup[] = [
      { items: NAV_ITEMS.map(({ icon: Icon, label, href }) => ({ href, label, icon: <Icon /> })) },
      {
        label: 'Explore',
        items: [
          { href: '/community',         label: 'Community',  icon: <Compass /> },
          ...(showCities ? [{ href: '/community/cities', label: 'City groups', icon: <MapPin />, badge: counts?.cityName ?? undefined }] : []),
          ...(showShop ? [{ href: '/store',             label: 'Store',      icon: <ShoppingBag />, badge: cartCount > 0 ? cartCount : undefined }] : []),
        ],
      },
      {
        label: 'This week',
        items: [
          { href: '/community',                  label: 'Monday prompt',     icon: <CalendarClock />, badge: 'Mon 8:00 AM' },
          { href: '/community/groups/open-house', label: 'Live conversation', icon: <CalendarClock />, badge: 'Wed 7:00 PM' },
          { href: '/community?category=Wins',      label: 'Friday wins',       icon: <CalendarClock />, badge: 'Fri 5:00 PM' },
        ],
      },
      {
        label: 'You',
        items: [
          { href: '/announcements', label: 'Announcements', icon: <Megaphone />, dot: unread > 0 },
          { href: '/messages',      label: 'Messages',      icon: <Mail />, dot: unreadMessages > 0 || requests > 0 },
          { href: '/notifications', label: 'Notifications', icon: <Bell /> },
          { href: '/growth',        label: 'My Growth',     icon: <TrendingUp /> },
          ...(showRefer ? [{ href: '/referral',      label: 'Refer & earn',  icon: <Gift /> }] : []),
          { href: '/settings',      label: 'Settings',      icon: <Settings /> },
          ...(showShop ? [{ href: '/store/orders',  label: 'My orders',     icon: <Package /> }] : []),
          { href: '/help',          label: 'Help',          icon: <CircleHelp /> },
        ],
      },
    ];
    return g;
  }, [unread, unreadMessages, requests, counts?.cityName, cartCount, showShop, showCities, showRefer]);

  // The shell has already asked "Sign out?" by the time this runs.
  const handleSignOut = async () => {
    clearSageGreeting(); // so the next login is greeted again
    await signOutAndLeave('/');
  };

  return (
    <ToastProvider>
      <SplashGate />
      <PresenceProvider userId={userId}>
      {features?.offline !== false && <NetworkPill />}
      <NoticeProvider value={sidebarNotice}>
      <ShellLayout
        variant="app"
        groups={groups}
        user={{ name: userName, email, avatarUrl, role }}
        homeHref="/dashboard"
        settingsHref="/profile"
        searchEndpoint="/api/search"
        searchPlaceholder="Search lessons, rooms and people"
        searchPageHref="/search"
        onSignOut={handleSignOut}
        sidebarExtra={sidebarNotice ? <NoticeCard notice={sidebarNotice} compact /> : undefined}
        menuLinks={[
          { href: '/dashboard', label: 'Today',    icon: <LayoutDashboard /> },
          { href: '/profile',   label: 'Profile',  icon: <UserRound /> },
          { href: '/settings',  label: 'Settings', icon: <Settings /> },
          { href: '/sage/memory',    label: 'What Sage knows', icon: <Brain /> },
          { href: '/sage/reminders', label: 'Reminders',       icon: <Bell /> },
          { href: '/help',      label: 'Help',     icon: <CircleHelp /> },
          { href: '/account',   label: 'Account and billing', icon: <Gift /> },
          ...(isStaff ? [{ href: '/admin', label: 'Admin dashboard', icon: <ShieldCheck /> }] : []),
        ]}
        headerActions={
          <>
            <AnnouncementsBell items={counts?.latest ?? []} unread={unread} />
            <MessagesLink requests={requests} unread={unreadMessages} />
            <NotificationsBell />
          </>
        }
      >
        {children}
      </ShellLayout>
      </NoticeProvider>

      <PushBootstrap />
      <SageFloat userName={userName} />
      <SagePanel />
      <MobileTabBar />
      <SummitModal registered={summitRegistered} userId={userId} />
      {features?.dock !== false && <MessagingDock meId={userId} meName={userName} meAvatarUrl={avatarUrl ?? null} initialUnread={unreadMessages} />}
      </PresenceProvider>
    </ToastProvider>
  );
}
