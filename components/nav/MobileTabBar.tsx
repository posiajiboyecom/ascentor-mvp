'use client';

// components/nav/MobileTabBar.tsx
// Bottom tab bar for < lg viewports. Matches the prototype's .bn/.bi
// structure: dark chrome, 5 icons, gold active state.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageCircle,
  Users,
  CalendarDays,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

interface TabItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const TABS: TabItem[] = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: MessageCircle, label: 'Coach', href: '/coach' },
  { icon: Users, label: 'Circle', href: '/community' },
  { icon: CalendarDays, label: 'Sessions', href: '/experts' },
  { icon: BookOpen, label: 'Resources', href: '/learn' },
];

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
      {TABS.map(({ icon: Icon, label, href }) => {
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
