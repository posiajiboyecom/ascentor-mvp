// components/dashboard/UpcomingSessionCard.tsx
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import type { ExpertSession } from '@/database/database';
import { Card } from '@/components/ui';

interface UpcomingSessionCardProps {
  session: (ExpertSession & { isRegistered: boolean }) | null;
}

export function formatSessionTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Compare calendar dates in WAT, not the server's local timezone.
  const watFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateKey = watFormatter.format(date);
  const todayKey = watFormatter.format(now);
  const tomorrowKey = watFormatter.format(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (dateKey === todayKey) return `Today · ${time} WAT`;
  if (dateKey === tomorrowKey) return `Tomorrow · ${time} WAT`;

  const day = date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Lagos',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${day} · ${time} WAT`;
}

export function UpcomingSessionCard({ session }: UpcomingSessionCardProps) {
  if (!session) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--app-accent-ink)]">
          <CalendarDays className="w-4 h-4" aria-hidden="true" /> Upcoming session
        </p>
        <p className="mt-2 text-base text-[var(--text-muted)]">
          No expert session is scheduled yet. New ones are announced here first.
        </p>
        <Link href="/experts" className="mt-3 inline-block text-sm font-medium text-[var(--app-accent-ink)] hover:underline">
          Browse experts →
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--app-accent-ink)]">
        <CalendarDays className="w-4 h-4" aria-hidden="true" /> Upcoming session
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--text)] leading-snug">{session.title}</p>
      <p className="mt-1 text-base text-[var(--text-muted)]">
        with {session.expert_name} · {formatSessionTime(session.session_date)}
      </p>
      <Link
        href={`/experts#${session.id}`}
        className={`mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold ${
          session.isRegistered
            ? 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--app-bg-hover)]'
            : 'bg-[var(--app-accent)] text-[#0F0F0E] hover:opacity-90'
        }`}
      >
        {session.isRegistered ? 'View session →' : 'Register →'}
      </Link>
    </Card>
  );
}
