// components/dashboard/LegacyDashboard.tsx (the earlier Home screen, kept for partner tenants)
// The Home / Dashboard screen (light theme). Server Component: the main
// data arrives in one parallel pass; the "Continue" rail streams in behind
// <Suspense> so it never blocks first paint.

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDashboardData } from '@/lib/supabase/queries/dashboard';
import { getDailyLine, getLagosDateParts } from '@/lib/daily-line';
import { LedgerLine } from '@/components/ui';
import { TodayHero } from '@/components/dashboard/TodayHero';
import { SummitBanner } from '@/components/dashboard/SummitBanner';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { CommitmentsCard } from '@/components/dashboard/CommitmentsCard';
import { WeekHistory } from '@/components/dashboard/WeekHistory';
import { UpcomingSessionCard } from '@/components/dashboard/UpcomingSessionCard';
import { DimensionStrip } from '@/components/dashboard/DimensionStrip';
import { ContinueRail, ContinueRailSkeleton } from '@/components/dashboard/ContinueRail';

export default async function LegacyDashboard() {
  const data = await getDashboardData();
  if (!data) redirect('/login');

  const daily = getDailyLine();
  const date = getLagosDateParts();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 lg:px-10 lg:pt-10">
        {/* ── Header: one responsive block ── */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[640px]">
            <p className="asc-eyebrow">
              {date.weekday} · {date.day} {date.month} {date.year}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-editorial)] text-3xl lg:text-4xl font-medium text-[var(--text)]">
              {getGreeting()}, {data.firstName}.
            </h1>
            <LedgerLine className="mt-3 max-w-[280px]" />
            <p className="mt-3 font-[family-name:var(--font-editorial)] text-base italic leading-relaxed text-[var(--text-muted)]">
              {daily.text}
              {daily.attribution && (
                <span className="ml-2 font-sans text-sm not-italic text-[var(--text-dim)]">
                 {daily.attribution}
                </span>
              )}
            </p>
          </div>
          <span
            className="rounded-full border px-3 py-1 text-sm font-medium"
            style={{ color: data.planColor, backgroundColor: data.planBg, borderColor: data.planBorder }}
          >
            {data.planLabel}
          </span>
        </header>

        <div className="mt-5">
          <DimensionStrip today={daily.dimension} />
        </div>

        <div className="mt-6">
          <TodayHero data={data} />
        </div>

        {/* ── Content: main column + sticky aside on desktop ── */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div id="goal" className="scroll-mt-6">
              <GoalCard goal={data.goal} progressPct={data.goalProgressPct} goalDay={data.goalDay} />
            </div>
            <div id="commitments" className="scroll-mt-6">
              <CommitmentsCard commitments={data.commitments} />
            </div>
            <WeekHistory weeks={data.weekHistory} sessionsThisWeek={data.sessionsThisWeek} />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <SummitBanner daysAway={data.summitDaysAway} registered={data.summitRegistered} />
            <UpcomingSessionCard session={data.upcomingSession} />
            <Suspense fallback={<ContinueRailSkeleton />}>
              <ContinueRail />
            </Suspense>
          </aside>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
