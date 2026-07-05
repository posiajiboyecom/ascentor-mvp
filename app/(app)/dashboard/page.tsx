// app/(app)/dashboard/page.tsx
// The Home / Dashboard screen. Server Component — fetches everything
// in one pass via lib/supabase/queries/dashboard.ts, then renders.

import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getDashboardData } from '@/lib/supabase/queries/dashboard';
import { getDailyLine, getLagosDateParts } from '@/lib/daily-line';
import { LedgerLine } from '@/components/ui';
import { SummitBanner } from '@/components/dashboard/SummitBanner';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { CommitmentsCard } from '@/components/dashboard/CommitmentsCard';
import { UpcomingSessionCard } from '@/components/dashboard/UpcomingSessionCard';
import { ExploreList } from '@/components/dashboard/ExploreList';
import { QuickActionGrid } from '@/components/dashboard/QuickActionGrid';
import { DimensionStrip } from '@/components/dashboard/DimensionStrip';

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) redirect('/login');

  const {
    firstName,
    planLabel,
    planColor,
    planBg,
    planBorder,
    sessionsThisWeek,
    commitmentsDone,
    commitmentsTotal,
    goal,
    goalProgressPct,
    commitments,
    upcomingSession,
    summitDaysAway,
    summitRegistered,
    unreadCircleCount,
  } = data;

  const greeting = getGreeting();
  const daily = getDailyLine();
  const date = getLagosDateParts();

  const nextSessionLabel = upcomingSession
    ? new Date(upcomingSession.session_date).toLocaleString('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }) + ' WAT'
    : 'No upcoming session';

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Desktop header — Today's Page (hidden on mobile) ── */}
      <header className="hidden lg:flex items-start justify-between px-10 pt-10 pb-8">
        <div className="max-w-[610px] w-full">
          <p className="asc-eyebrow">
            {date.weekday} · {date.day} {date.month} {date.year}
          </p>
          <h1 className="text-[34px] font-serif font-medium text-[var(--text)] mt-2">
            {greeting}, {firstName}.
          </h1>
          <LedgerLine className="mt-3 max-w-[280px]" />
          <p className="text-base text-[var(--text-muted)] mt-3 font-serif italic leading-relaxed">
            {daily.text}
            {daily.attribution && (
              <span className="not-italic font-sans text-xs text-[var(--text-dim)] ml-2">
                — {daily.attribution}
              </span>
            )}
          </p>
          <span
            className="inline-block mt-3 rounded-full px-3 py-1 text-xs font-medium border"
            style={{ color: planColor, backgroundColor: planBg, borderColor: planBorder }}
          >
            {planLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <button
              type="button"
              aria-label="Notifications — coming soon"
              title="Notifications — coming soon"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] cursor-default opacity-60"
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="
              pointer-events-none absolute right-0 top-full mt-2 z-50
              whitespace-nowrap rounded-lg border border-[var(--border)]
              bg-[var(--bg-card)] px-3 py-1.5
              text-xs text-[var(--text-muted)] shadow-sm
              opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ">
              Notifications coming soon
            </span>
          </div>
        </div>
      </header>

      {/* ── Mobile header (hidden on desktop) ── */}
      <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-[#0F0F0E] border-b border-white/5">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[#FAFAF8] truncate">
            {greeting}, {firstName}.
          </p>
          <p className="text-xs text-[#9CA3AF] mt-0.5 font-serif italic truncate">
            {daily.text}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium max-w-[90px] truncate"
            style={{ color: planColor, backgroundColor: planBg, borderColor: planBorder }}
          >
            {planLabel}
          </span>
          <div className="relative group">
            <button
              type="button"
              aria-label="Notifications — coming soon"
              className="flex items-center justify-center opacity-60 cursor-default"
            >
              <Bell className="w-[17px] h-[17px] text-[#9CA3AF]" aria-hidden="true" />
            </button>
            <span className="
              pointer-events-none absolute right-0 top-full mt-2 z-50
              whitespace-nowrap rounded-lg border border-white/10
              bg-[#1A1A19] px-3 py-1.5
              text-[10px] text-[#9CA3AF]
              opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ">
              Notifications coming soon
            </span>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-10 mt-4 lg:mt-0 mb-4 lg:mb-6">
        <DimensionStrip today={daily.dimension} />
        <div className="mt-4">
          <SummitBanner daysAway={summitDaysAway} registered={summitRegistered} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="lg:flex lg:gap-8 lg:px-10 lg:pb-10">
        {/* Center column */}
        <main className="flex-1 min-w-0 px-4 pb-6 lg:p-0 lg:max-w-[610px]">
          {/* The week, as a sentence — not a stat grid. Numbers in the
              product's voice: "you kept your word", not "🔥 streak". */}
          <p className="text-sm lg:text-[15px] text-[var(--text-muted)] leading-relaxed mb-4 lg:mb-6">
            You kept your word{' '}
            <span className="text-[var(--app-accent)] font-medium">
              {commitmentsDone} of {commitmentsTotal}
            </span>{' '}
            times this week
            {sessionsThisWeek > 0 && (
              <>
                , with{' '}
                <span className="text-[var(--text)] font-medium">
                  {sessionsThisWeek} session{sessionsThisWeek === 1 ? '' : 's'}
                </span>{' '}
                alongside Sage
              </>
            )}
            . Your 90-day goal stands at{' '}
            <span className="text-[var(--text)] font-medium">{goalProgressPct}%</span>.
          </p>

          <div className="mb-4 lg:mb-6">
            <GoalCard goal={goal} progressPct={goalProgressPct} />
          </div>

          <QuickActionGrid
            nextSessionLabel={nextSessionLabel}
            unreadCircleCount={unreadCircleCount}
          />

          <div className="mb-4 lg:mb-6">
            <CommitmentsCard commitments={commitments} />
          </div>

          <div className="mb-4 lg:mb-0 lg:hidden">
            <UpcomingSessionCard session={upcomingSession} />
          </div>
        </main>

        {/* Right column — desktop only */}
        <aside className="hidden lg:block w-[340px] shrink-0">
          <ExploreList />
          <div className="mt-6">
            <UpcomingSessionCard session={upcomingSession} />
          </div>
        </aside>
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
