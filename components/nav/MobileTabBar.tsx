'use client';

// components/nav/MobileTabBar.tsx
// Bottom tab bar for < lg viewports. Matches the prototype's .bn/.bi
// structure: dark chrome, 5 icons, gold active state.
//
// FIX: Icons now sourced from shared NAV_ITEMS constant defined in
// @/lib/nav-items — same array consumed by DesktopRail, guaranteeing
// identical icons at every breakpoint. Previously used MessageCircle +
// CalendarDays while DesktopRail used MessageSquare + User for the
// same routes.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav-items';

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="
        lg:hidden fixed bottom-0 inset-x-0 z-40
        flex justify-around
        bg-[#0F0F0E] border-t border-white/[0.06]
        pt-[7px] pb-[14px]
      "
      style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-[3px] px-[5px]"
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              className={`w-5 h-5 ${active ? 'text-[#C8A96E]' : 'text-[#4B5563]'}`}
              aria-hidden="true"
            />
            <span
              className={`text-[9px] tracking-[.03em] ${
                active ? 'text-[#C8A96E]' : 'text-[#4B5563]'
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
