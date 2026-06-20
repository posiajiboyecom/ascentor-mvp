// components/dashboard/QuickActionGrid.tsx
import Link from 'next/link';
import { MessageCircle, Users, LayoutPanelLeft, BookOpen, type LucideIcon } from 'lucide-react';

interface QuickAction {
  icon: LucideIcon;
  title: string;
  sub: string;
  href: string;
}

interface QuickActionGridProps {
  nextSessionLabel: string;
  unreadCircleCount: number;
}

export function QuickActionGrid({
  nextSessionLabel,
  unreadCircleCount,
}: QuickActionGridProps) {
  const items: QuickAction[] = [
    {
      icon: MessageCircle,
      title: 'AI Coach',
      sub: 'Start a coaching session',
      href: '/coach',
    },
    {
      icon: Users,
      title: 'Next Session',
      sub: nextSessionLabel,
      href: '/sessions',
    },
    {
      icon: LayoutPanelLeft,
      title: 'The Circle',
      sub:
        unreadCircleCount > 0
          ? `${unreadCircleCount} unread message${unreadCircleCount === 1 ? '' : 's'}`
          : 'Join the conversation',
      href: '/community',
    },
    {
      icon: BookOpen,
      title: 'Resources',
      sub: 'Continue learning',
      href: '/learn',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-3 lg:hidden">
      {items.map(({ icon: Icon, title, sub, href }) => (
        <Link
          key={title}
          href={href}
          className="
            rounded-xl border border-[var(--color-border-tertiary)]
            bg-[var(--color-background-secondary)]
            p-3
          "
        >
          <Icon className="w-[22px] h-[22px] text-[var(--color-text-secondary)] mb-1.5" aria-hidden="true" />
          <div className="text-xs font-medium text-[var(--color-text-primary)] mb-0.5">
            {title}
          </div>
          <div className="text-[11px] leading-snug text-[var(--color-text-secondary)]">
            {sub}
          </div>
        </Link>
      ))}
    </div>
  );
}
