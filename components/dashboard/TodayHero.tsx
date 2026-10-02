// components/dashboard/TodayHero.tsx
// One primary next action, chosen from the member's state. The dashboard
// answers "what should I do now?" before it reports anything.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DashboardData } from '@/lib/supabase/queries/dashboard';
import { formatSessionTime } from './UpcomingSessionCard';

interface Action {
  headline: string;
  sub: string;
  cta: string;
  href: string;
}

function pickAction(d: DashboardData): Action {
  if (!d.goal) {
    return {
      headline: 'Name what you’re building.',
      sub: 'Set a 90-day goal so every week has a direction.',
      cta: 'Set my goal',
      href: '#goal',
    };
  }
  if (d.commitmentsTotal === 0) {
    return {
      headline: 'Start the week with one promise.',
      sub: 'Write a single commitment you’ll keep before Sunday.',
      cta: 'Add a commitment',
      href: '#commitments',
    };
  }

  const s = d.upcomingSession;
  if (s?.isRegistered) {
    const hoursAway = (new Date(s.session_date).getTime() - Date.now()) / 3600000;
    if (hoursAway > 0 && hoursAway < 48) {
      return {
        headline: `Your session with ${s.expert_name} is coming up.`,
        sub: formatSessionTime(s.session_date),
        cta: 'View session',
        href: `/experts#${s.id}`,
      };
    }
  }

  const left = d.commitmentsTotal - d.commitmentsDone;
  if (left > 0) {
    return {
      headline: `${left} ${left === 1 ? 'commitment' : 'commitments'} left this week.`,
      sub: 'Keep your word. Small promises, kept, become a reputation.',
      cta: 'Review commitments',
      href: '#commitments',
    };
  }

  return {
    headline: 'You kept your word this week.',
    sub: 'Take the next step with Sage while the momentum is yours.',
    cta: 'Talk to Sage',
    href: '/coach',
  };
}

export function TodayHero({ data }: { data: DashboardData }) {
  const a = pickAction(data);
  return (
    <section
      aria-label="Your next step"
      className="rounded-2xl border border-[var(--app-border-gold)] bg-[var(--bg-card)] p-5 lg:p-7 shadow-[var(--app-card-shadow)]"
    >
      <p className="asc-eyebrow">Your next step</p>
      <h2 className="mt-2 font-[family-name:var(--font-editorial)] text-2xl lg:text-3xl leading-tight text-[var(--text)]">
        {a.headline}
      </h2>
      <p className="mt-2 text-base text-[var(--text-muted)]">{a.sub}</p>
      <Link
        href={a.href}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--app-accent)] px-6 py-3 text-sm font-semibold text-[#0F0F0E] hover:opacity-90"
      >
        {a.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
