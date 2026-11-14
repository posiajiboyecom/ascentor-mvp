'use client';

// components/nav/MobileTabBar.tsx
// Bottom tab bar for < lg viewports, as the Ascentor App Prototype draws it: the page colour with a 1px top border, four
// tabs with a 22px outline icon over an 11px uppercase label. Inactive tabs are muted grey, the active tab is rust.
// Icons come from the shared NAV_ITEMS constant (same array as DesktopRail), so they match at every breakpoint.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav-items';
import { setLastNavTab } from '@/lib/cookies';

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex bg-[var(--mtab-bg,#F6F5F2)] border-t border-[var(--mtab-border,#E6E3DD)] px-1 pt-1"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
        const active = pathname === href || pathname?.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={() => setLastNavTab(href)}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] min-h-[52px] rounded-[10px] transition-colors"
          >
            <Icon className={`w-[22px] h-[22px] ${active ? 'text-[var(--mtab-on,#B6502A)]' : 'text-[var(--mtab-off,#5F6672)]'}`} strokeWidth={1.6} aria-hidden="true" />
            <span className={`text-[11px] font-semibold uppercase tracking-[.1em] ${active ? 'text-[var(--mtab-on,#B6502A)]' : 'text-[var(--mtab-off,#5F6672)]'}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
