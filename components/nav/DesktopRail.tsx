'use client';

// components/nav/DesktopRail.tsx
// The "Server" three-pane desktop shell's left rail. Visible at >= lg.
// Matches: logo lockup, 5 nav items (active = gold text + left bar),
// Elevation Summit mini-card pinned above the footer, profile footer.
//
// FIX: Icons now sourced from shared NAV_ITEMS constant defined in
// @/lib/nav-items — same array consumed by MobileTabBar, guaranteeing
// identical icons at every breakpoint. Previously DesktopRail used
// MessageSquare + User while MobileTabBar used MessageCircle + CalendarDays
// for the same routes, breaking cross-breakpoint wayfinding.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/nav-items';
import RailBillboard from '@/components/nav/RailBillboard';

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
      <div className="flex items-center px-6 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" style={{ height: 28, width: 'auto' }} />
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

      {/* ── Rail billboards — managed from Admin → Rail Billboards ── */}
      <RailBillboard />

      {/* Elevation Summit mini-card */}
      <Link
        href="/elevation-summit"
        className="
          mx-4 mb-4 rounded-xl border border-[#C8A96E]/20 bg-[#C8A96E]/[0.06]
          px-4 py-3 block no-underline
          hover:border-[#C8A96E]/40 hover:bg-[#C8A96E]/[0.10]
          transition-colors cursor-pointer
        "
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C8A96E] mb-1">
          The Elevation Summit
        </p>
        <p className="text-sm font-medium text-[#FAFAF8]">
          Feb 2027 · Lagos
        </p>
        <p className="text-xs text-[#C8A96E]/70 mt-1 font-medium">
          {summitDaysAway} days away — Register →
        </p>
      </Link>

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
