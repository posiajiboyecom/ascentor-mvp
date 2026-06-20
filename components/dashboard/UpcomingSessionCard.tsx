// components/dashboard/UpcomingSessionCard.tsx
import Link from 'next/link';
import type { ExpertSession } from '@/database/database';

interface UpcomingSessionCardProps {
  session: (ExpertSession & { isRegistered: boolean }) | null;
}

function formatSessionTime(dateStr: string): string {
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
  const tomorrowKey = watFormatter.format(
    new Date(now.getTime() + 24 * 60 * 60 * 1000)
  );

  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (dateKey === todayKey) return `Today · ${time} WAT`;
  if (dateKey === tomorrowKey) return `Tomorrow · ${time} WAT`;

  const day = date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Lagos',
    month: 'short',
    day: 'numeric',
  });
  return `${day} · ${time} WAT`;
}

export function UpcomingSessionCard({ session }: UpcomingSessionCardProps) {
  if (!session) return null;

  return (
    <div
      className="
        rounded-xl lg:rounded-2xl border border-white/[0.07]
        bg-[#0F0F0E]
        p-[13px] lg:p-7
      "
    >
      <p className="text-[9px] lg:text-xs font-medium uppercase tracking-[0.08em] text-[#4B5563] mb-1.5 lg:mb-3">
        Upcoming session
      </p>
      <p className="text-sm lg:text-xl font-medium text-[#FAFAF8] mb-0.5 lg:mb-2">
        {session.title}
      </p>
      <p className="text-[11px] lg:text-base text-[#6B7280] mb-2.5 lg:mb-5">
        with {session.expert_name} · {formatSessionTime(session.session_date)}
      </p>
      <Link
        href={`/sessions#${session.id}`}
        className="
          inline-block rounded-full bg-[#C8A96E] text-[#0F0F0E]
          px-3 py-[5px] lg:px-6 lg:py-2.5
          text-[10px] lg:text-sm font-medium
        "
      >
        {session.isRegistered ? 'View session →' : 'Register →'}
      </Link>
    </div>
  );
}
