// components/dashboard/ExploreList.tsx
import Link from 'next/link';
import { MessageSquare, Users, User, BookOpen, type LucideIcon } from 'lucide-react';

interface ExploreItem {
  icon: LucideIcon;
  title: string;
  sub: string;
  href: string;
}

const ITEMS: ExploreItem[] = [
  { icon: MessageSquare, title: 'AI Coach', sub: 'Start a session', href: '/coach' },
  { icon: Users, title: 'The Circle', sub: 'Join the community', href: '/community' },
  { icon: User, title: 'Sessions', sub: 'View sessions', href: '/sessions' },
  { icon: BookOpen, title: 'Resources', sub: 'Courses & learning', href: '/learn' },
];

export function ExploreList() {
  return (
    <div className="hidden lg:block">
      <h2 className="text-xl font-medium text-[var(--color-text-primary)] mb-4">
        Explore
      </h2>
      <div className="flex flex-col gap-3">
        {ITEMS.map(({ icon: Icon, title, sub, href }) => (
          <Link
            key={title}
            href={href}
            className="
              flex items-center gap-4 rounded-2xl
              border border-[var(--color-border-secondary)]
              bg-[var(--color-background-primary)]
              px-5 py-4
              transition-colors hover:bg-[var(--color-background-secondary)]
            "
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C8A96E]/10">
              <Icon className="w-5 h-5 text-[#C8A96E]" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-medium text-[var(--color-text-primary)]">
                {title}
              </span>
              <span className="block text-sm text-[var(--color-text-secondary)]">
                {sub}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
