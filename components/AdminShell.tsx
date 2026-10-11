'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import {
  BarChart3, Briefcase, CalendarDays, ClipboardList, CreditCard, Database,
  GraduationCap, HeartHandshake, Inbox, LayoutDashboard, LayoutTemplate,
  Mail, Megaphone, MessageCircle, MessagesSquare, Package, PenLine, Radar, Radio,
  ScrollText, ShieldCheck, Tag, Ticket, Users, Workflow, ArrowLeftRight, UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import ShellLayout from '@/components/shell/ShellLayout';
import type { ShellNavGroup } from '@/components/shell/types';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell · THE LEDGER · v3
//
// Admin navigation, now rendered by the shared ShellLayout:
// collapsible sidebar with tooltips, mobile drawer, sticky header with
// global search (Ctrl/Cmd+K) and avatar menu.
//
// Information architecture is organised around running the business
// (people, Elevation Summit, money, content, community, engagement, events,
// intelligence) rather than around the member app. Every Elevation Summit
// admin page (registrations, donations, livestream) lives in its own group
// instead of being scattered across Revenue/Events.
//
// Permission filtering: items with `permission` are hidden unless
// userHasPermission() allows it. Role gating (admin/moderator) is enforced
// server-side in app/admin/layout.tsx before this component mounts.
// ─────────────────────────────────────────────────────────────────

type Item = { href: string; label: string; icon: React.ReactNode; permission?: Permission };
type Group = { label: string; items: Item[] };

const NAV_GROUPS: Group[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Overview', icon: <LayoutDashboard /> }],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users',       label: 'Users',       icon: <Users />,          permission: 'users.view' },
      { href: '/admin/permissions', label: 'Access Control', icon: <ShieldCheck />, permission: 'users.edit_role' },
      { href: '/admin/mentors',     label: 'Mentors',     icon: <HeartHandshake /> },
    ],
  },
  {
    // Every admin page for The Elevation Summit, together, so it is never
    // scattered across Revenue/Events/wherever again. Registration is free;
    // Donations is the one paid flow left.
    label: 'Elevation Summit',
    items: [
      { href: '/admin/elevation-summit/registrations', label: 'Registrations', icon: <Ticket />, permission: 'payments.view' },
      { href: '/admin/summit-donations', label: 'Donations',        icon: <HeartHandshake />, permission: 'payments.view' },
      { href: '/admin/summit-stream',    label: 'Livestream',       icon: <Radio /> },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/admin/payments',    label: 'Subscription Payments', icon: <CreditCard />, permission: 'payments.view' },
      { href: '/admin/promo-codes', label: 'Promo Codes',   icon: <Tag /> },
      { href: '/admin/products',    label: 'Products',      icon: <Package /> },
      { href: '/admin/billboards',  label: 'Rail Billboards', icon: <Megaphone /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/blog',            label: 'Blog',               icon: <PenLine /> },
      { href: '/admin/courses',         label: 'Courses',            icon: <GraduationCap /> },
      { href: '/admin/knowledge',       label: 'Knowledge Base',     icon: <Database /> },
      { href: '/admin/careers',         label: 'Careers',            icon: <Briefcase /> },
      { href: '/admin/marketing-pages', label: 'Marketing Pages',    icon: <LayoutTemplate /> },
      { href: '/admin/master',          label: 'Marketing Pipeline', icon: <Workflow /> },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/community-intel', label: 'Community',     icon: <MessagesSquare /> },
      { href: '/admin/groups',          label: 'Groups',        icon: <Users /> },
      { href: '/admin/categories',      label: 'Post categories', icon: <Tag /> },
      { href: '/admin/circles',         label: 'Circles',       icon: <Workflow /> },
      { href: '/admin/human-mentors',   label: 'Mentors (people)', icon: <HeartHandshake /> },
      { href: '/admin/announcements',   label: 'Announcements', icon: <Megaphone /> },
      { href: '/admin/chats',           label: 'Chats',         icon: <MessageCircle /> },
      { href: '/admin/moderation',      label: 'Moderation',    icon: <ShieldCheck /> },
      { href: '/admin/demo',            label: 'Demo lab',      icon: <Radar /> },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { href: '/admin/inbox',      label: 'Inbox',      icon: <Inbox /> },
      { href: '/admin/coaching',   label: 'Chat Data',  icon: <MessageCircle /> },
      { href: '/admin/surveys',    label: 'Surveys',    icon: <ClipboardList /> },
      { href: '/admin/newsletter', label: 'Newsletter', icon: <Mail /> },
    ],
  },
  {
    label: 'Events',
    items: [
      { href: '/admin/events',           label: 'Public Events',    icon: <CalendarDays /> },
      { href: '/admin/community-events', label: 'Community Events', icon: <MessagesSquare /> },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/admin/intel',   label: 'Platform Intel', icon: <Radar /> },
      { href: '/admin/reports', label: 'Reports',        icon: <BarChart3 /> },
      { href: '/admin/logs',    label: 'Audit Logs',     icon: <ScrollText /> },
    ],
  },
];

export default function AdminShell({
  children,
  name,
  role,
  userPermissions,
  email,
  avatarUrl,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  userPermissions?: any[] | null;
  email?: string | null;
  avatarUrl?: string | null;
}) {
  const router   = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const groups: ShellNavGroup[] = useMemo(
    () =>
      NAV_GROUPS.map(g => ({
        label: g.label,
        items: g.items
          .filter(i => !i.permission || userHasPermission(role as UserRole, userPermissions as Permission[] | null, i.permission))
          .map(({ href, label, icon }) => ({ href, label, icon })),
      })).filter(g => g.items.length > 0),
    [role, userPermissions],
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/admin-login');
    router.refresh();
  };

  return (
    <ShellLayout
      variant="admin"
      groups={groups}
      user={{ name, email, avatarUrl, role }}
      homeHref="/admin"
      settingsHref="/account"
      searchEndpoint="/api/admin/search"
      searchPlaceholder="Search users, payments, content…"
      onSignOut={handleSignOut}
      menuLinks={[
        { href: '/dashboard', label: 'Open member app', icon: <ArrowLeftRight /> },
        { href: '/account',   label: 'My account',      icon: <UserRound /> },
      ]}
      padded
    >
      {children}
    </ShellLayout>
  );
}
