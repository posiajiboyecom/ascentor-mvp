'use client';

// components/nav/DesktopRail.tsx
// The "Server" three-pane desktop shell's left rail. Visible at >= lg.
// Matches: logo lockup, 5 nav items (active = gold text + left bar),
// Elevation Summit mini-card pinned above the footer, profile footer.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, type LucideIcon } from 'lucide-react';
import {
  Home,
  MessageSquare,
  Users,
  User,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: MessageSquare, label: 'AI Coach', href: '/coach' },
  { icon: Users, label: 'The Circle', href: '/community' },
  { icon: User, label: 'Sessions', href: '/experts' },
  { icon: BookOpen, label: 'Resources', href: '/learn' },
];

interface DesktopRailProps {
  userName: string;
  userInitials: string;
  summitDaysAway: number;
}

export function DesktopRail({
  userName,
  userInitials,
  summitDaysAway,
}: DesktopRailProps) {
  const pathname = usePathname();

  return (
    <aside
      className="
        hidden lg:flex lg:flex-col lg:shrink-0
        w-[288px] h-full
        bg-[#0C0B08] border-r border-white/[0.06]
      "
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C8A96E]/30 font-serif text-lg text-[#C8A96E]">
          A
        </span>
        <span className="text-lg font-semibold text-[#FAFAF8]">
          Ascentor
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col px-4 mt-2 gap-1">
        {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`
                relative flex items-center gap-3 rounded-lg pl-4 pr-3 py-2.5
                text-sm transition-colors
                ${active ? 'text-[#C8A96E] font-medium' : 'text-[#9CA3AF] hover:text-[#FAFAF8]'}
              `}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-[#C8A96E]" />
              )}
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Elevation Summit mini-card */}
      <div className="mx-4 mb-4 rounded-xl border border-[#C8A96E]/20 bg-[#C8A96E]/[0.06] px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C8A96E] mb-1">
          The Elevation Summit
        </p>
        <p className="text-sm font-medium text-[#FAFAF8]">
          Feb 2027 · Lagos
        </p>
        <p className="text-xs text-[#6B7280] mt-0.5">
          {summitDaysAway} days away — register
        </p>
      </div>

      {/* Profile footer */}
      <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C8A96E]/15 text-xs font-medium text-[#C8A96E]">
          {userInitials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#FAFAF8]">
            {userName}
          </p>
          <p className="flex items-center gap-1 text-xs text-[#6B7280]">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Online
          </p>
        </div>
        <Link
          href="/account"
          aria-label="Settings"
          className="text-[#6B7280] hover:text-[#FAFAF8]"
        >
          <Settings className="w-[18px] h-[18px]" />
        </Link>
      </div>
    </aside>
  );
}
