'use client';

import { clearUserCache } from '@/lib/sw-cache';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import {
  ArrowLeftRight, BarChart3, Briefcase, CalendarClock, CalendarDays, ClipboardList, CreditCard, Database, Flag, Gift, GraduationCap,
  Handshake, HeartHandshake, Hourglass, Inbox, Layers, LayoutDashboard, LayoutTemplate, LineChart, Mail, MapPin, Megaphone, MessagesSquare, Newspaper,
  Package, PenLine, Percent, Presentation, Radar, Radio, ScrollText, Settings, ShieldCheck, ShoppingBag, Sparkles, Tag, Ticket, UserRound, Users, UsersRound, Workflow, Wrench,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ShellLayout from '@/components/shell/ShellLayout';
import type { ShellNavGroup } from '@/components/shell/types';
import { NAV, areaHref, legacyAreaFor } from '@/lib/admin/areas';
import { setViewAs } from '@/app/admin/c/actions';

// ─────────────────────────────────────────────────────────────────────────
// ASCENTOR · AdminShell, built to the admin prototype.
//
// The menu is the prototype's ten groups. An item is shown only if the teammate's role can open that area (the server
// computes `visibleAreas`; hiding is a convenience, every page and action checks again). Admins get a "View as" preview that
// redraws the menu and screens through a teammate's role without changing what the server allows.
//
// "More tools" (admin only, not in the prototype) keeps the older pages that the prototype has no screen for, so no existing
// feature disappears from the menu: courses, the shop leads list, the inbox, the demo lab and similar.
// ─────────────────────────────────────────────────────────────────────────

const ICON: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard />, recs: <Sparkles />, members: <Users />, team: <ShieldCheck />, mentors: <HeartHandshake />,
  circles: <Workflow />, matching: <Hourglass />, mentorship: <CalendarClock />, groups: <UsersRound />, cities: <MapPin />,
  meetups: <CalendarDays />, categories: <Tag />, announcements: <Megaphone />, broadcasts: <Mail />, moderation: <Flag />, chats: <MessagesSquare />,
  pathways: <GraduationCap />, knowledge: <Database />, payments: <CreditCard />, plans: <Layers />, promos: <Percent />, referrals: <Gift />,
  products: <Package />, orders: <ShoppingBag />, registrations: <Ticket />, donations: <HeartHandshake />, livestream: <Radio />,
  blog: <PenLine />, pages: <LayoutTemplate />, newsletter: <Newspaper />, billboards: <Presentation />, partners: <Handshake />, careers: <Briefcase />,
  events: <CalendarDays />, analysis: <LineChart />, intel: <Radar />, reports: <BarChart3 />, surveys: <ClipboardList />, audit: <ScrollText />, platform: <Settings />,
};

const MORE_TOOLS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/admin/shop/leads', label: 'Shop leads', icon: <Inbox /> },
  { href: '/admin/courses', label: 'Courses', icon: <GraduationCap /> },
  { href: '/admin/inbox', label: 'Inbox', icon: <Inbox /> },
  { href: '/admin/coaching', label: 'Chat data', icon: <MessagesSquare /> },
  { href: '/admin/community-intel', label: 'Community intel', icon: <MessagesSquare /> },
  { href: '/admin/community-events', label: 'Community events', icon: <CalendarDays /> },
  { href: '/admin/human-mentors', label: 'Mentors (people)', icon: <HeartHandshake /> },
  { href: '/admin/master', label: 'Marketing pipeline', icon: <Workflow /> },
  { href: '/admin/demo', label: 'Demo lab', icon: <Radar /> },
  { href: '/admin/permissions', label: 'Old access control', icon: <Wrench /> },
];

export interface ViewAsOption { id: string; label: string }

export default function AdminShell({
  children, name, role, email, avatarUrl, roleName, visibleAreas, badges, isAdmin, viewAsOptions, viewingAsId,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  email?: string | null;
  avatarUrl?: string | null;
  /** Display name of the teammate's real role. */
  roleName: string;
  /** Area keys the (preview) role can open. */
  visibleAreas: string[];
  badges: Record<string, number>;
  isAdmin: boolean;
  viewAsOptions: ViewAsOption[];
  viewingAsId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  // An older admin page whose area this role cannot open: show a plain notice instead of the page.
  const legacyArea = legacyAreaFor(pathname);
  const blocked = !!legacyArea && !visibleAreas.includes(legacyArea);
  const [, startTransition] = useTransition();

  const groups: ShellNavGroup[] = useMemo(() => {
    const g: ShellNavGroup[] = NAV.map(([label, items]) => ({
      label,
      items: items
        .filter(([key]) => visibleAreas.includes(key))
        .map(([key, text]) => ({ href: areaHref(key), label: text, icon: ICON[key], ...(badges[key] ? { badge: badges[key] } : {}) })),
    })).filter((x) => x.items.length > 0);
    if (isAdmin) g.push({ label: 'More tools', items: MORE_TOOLS.map((t) => ({ href: t.href, label: t.label, icon: t.icon })) });
    return g;
  }, [visibleAreas, badges, isAdmin]);

  const handleSignOut = async () => {
    void clearUserCache(); // saved pages belong to this account
    await supabase.auth.signOut();
    router.push('/admin-login');
    router.refresh();
  };

  const onViewAs = (id: string) => {
    startTransition(async () => { await setViewAs(id || null); router.refresh(); });
  };

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span title="Your role" style={{ height: 28, padding: '0 10px', borderRadius: 999, border: '1px solid #cfcac2', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{roleName}</span>
      {isAdmin && viewAsOptions.length > 0 && (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ whiteSpace: 'nowrap' }}>View as</span>
          <select aria-label="View as a teammate" value={viewingAsId ?? ''} onChange={(e) => onViewAs(e.target.value)} style={{ height: 32, maxWidth: 190, borderRadius: 8, border: '1px solid #cfcac2', background: 'transparent', color: 'inherit', fontSize: 12 }}>
            <option value="">Myself (Admin)</option>
            {viewAsOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );

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
      headerActions={headerActions}
      menuLinks={[
        { href: '/dashboard', label: 'Open member app', icon: <ArrowLeftRight /> },
        { href: '/account', label: 'My account', icon: <UserRound /> },
      ]}
      padded
    >
      {blocked ? (
        <div style={{ maxWidth: 520, margin: '64px auto', textAlign: 'center' }} role="alert">
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>No access</h1>
          <p style={{ marginTop: 12, opacity: 0.8 }}>Your role ({roleName}) cannot open this area. Ask an admin if you need it.</p>
        </div>
      ) : children}
    </ShellLayout>
  );
}
