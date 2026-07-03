// lib/nav-items.ts
// ─────────────────────────────────────────────────────────────────────────
// Single source of truth for main app navigation items.
// Consumed by BOTH DesktopRail and MobileTabBar so that icons, labels,
// and hrefs are guaranteed identical at every breakpoint.
//
// Previously each component defined its own local array with different
// icons for the same routes (MessageSquare vs MessageCircle for Coach;
// User vs CalendarDays for Sessions), breaking cross-breakpoint wayfinding.
// ─────────────────────────────────────────────────────────────────────────

import {
  Home,
  MessageCircle,
  Users,
  CalendarDays,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: Home,          label: 'Home',      href: '/dashboard' },
  { icon: MessageCircle, label: 'AI Coach',  href: '/coach'     },
  { icon: Users,         label: 'The Circle', href: '/community' },
  { icon: CalendarDays,  label: 'Sessions',  href: '/experts'   },
  { icon: BookOpen,      label: 'Resources', href: '/learn'     },
];
