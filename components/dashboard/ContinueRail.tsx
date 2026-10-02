// components/dashboard/ContinueRail.tsx
// "Pick up where you left off" + "Since you were last here".
// Async Server Component, rendered behind <Suspense> so the main dashboard
// is never blocked on these secondary queries.

import Link from 'next/link';
import { MessageCircle, Users, BookOpen, Bell, ArrowRight } from 'lucide-react';
import { getContinueData } from '@/lib/supabase/queries/dashboard';
import { Card, Skeleton } from '@/components/ui';

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export async function ContinueRail() {
  const { lastCoach, unreadCircleCount, notifications } = await getContinueData();

  const rows = [
    {
      icon: MessageCircle,
      title: lastCoach ? 'Continue with Sage' : 'Start with Sage',
      sub: lastCoach ? `${lastCoach.preview || 'Your last conversation'} · ${timeAgo(lastCoach.createdAt)}` : 'Your AI coach is ready when you are.',
      href: '/coach',
    },
    {
      icon: Users,
      title: 'The Circle',
      sub: unreadCircleCount > 0 ? `${unreadCircleCount} new message${unreadCircleCount === 1 ? '' : 's'} since you last looked` : 'You’re all caught up.',
      href: '/community',
      badge: unreadCircleCount,
    },
    {
      icon: BookOpen,
      title: 'Keep learning',
      sub: 'Courses and resources for your season.',
      href: '/learn',
    },
  ];

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--text)]">Continue</h2>
        <ul className="mt-2 divide-y divide-[var(--border-light)]">
          {rows.map(({ icon: Icon, title, sub, href, badge }) => (
            <li key={title}>
              <Link href={href} className="group flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-accent-soft)]">
                  <Icon className="w-5 h-5 text-[var(--app-accent-ink)]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-[var(--text)]">{title}</span>
                  <span className="block truncate text-sm text-[var(--text-muted)]">{sub}</span>
                </span>
                {badge ? (
                  <span className="rounded-full bg-[var(--app-accent)] px-2 py-0.5 text-xs font-semibold text-[#0F0F0E]">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : (
                  <ArrowRight className="w-4 h-4 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {notifications.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text)]">
            <Bell className="w-4 h-4 text-[var(--app-accent-ink)]" aria-hidden="true" />
            Since you were last here
          </h2>
          <ul className="mt-2 divide-y divide-[var(--border-light)]">
            {notifications.map((n) => {
              const body = (
                <>
                  <span className="block text-base font-medium text-[var(--text)]">{n.title}</span>
                  <span className="block text-sm text-[var(--text-muted)]">{n.message}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-dim)]">{timeAgo(n.created_at)}</span>
                </>
              );
              return (
                <li key={n.id} className="py-3">
                  {n.link ? (
                    <Link href={n.link} className="block hover:opacity-80">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

export function ContinueRailSkeleton() {
  return (
    <Card>
      <Skeleton className="h-5 w-24 rounded" />
      <div className="mt-4 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
