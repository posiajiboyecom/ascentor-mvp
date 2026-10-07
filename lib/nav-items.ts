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
  Sun,
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
  { icon: Sun,           label: 'Today',     href: '/dashboard' },
  { icon: Users,         label: 'Circle',    href: '/circle'    },
  { icon: BookOpen,      label: 'Learn',     href: '/learn'     },
  { icon: CalendarDays,  label: 'Sessions',  href: '/sessions'  },
];
