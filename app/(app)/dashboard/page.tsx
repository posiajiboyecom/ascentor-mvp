// app/(app)/dashboard/page.tsx
// The Home / Dashboard screen. Server Component — fetches everything
// in one pass via lib/supabase/queries/dashboard.ts, then renders.
//
// Layout strategy: a single DOM tree styled with Tailwind responsive
// classes (mobile-first, `lg:` overrides for >= 1024px desktop), rather
// than two parallel trees — keeps data-fetching and markup in one
// place and avoids hydration mismatches between a "mobile" and
// "desktop" version of the same page.

import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getDashboardData } from '@/lib/supabase/queries/dashboard';
import { StatBox } from '@/components/dashboard/StatBox';
import { SummitBanner } from '@/components/dashboard/SummitBanner';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { CommitmentsCard } from '@/components/dashboard/CommitmentsCard';
import { UpcomingSessionCard } from '@/components/dashboard/UpcomingSessionCard';
import { ExploreList } from '@/components/dashboard/ExploreList';
import { QuickActionGrid } from '@/components/dashboard/QuickActionGrid';

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
  } = data;

  const greeting = getGreeting();

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
      {/* ── Desktop header (hidden on mobile) ── */}
      <header className="hidden lg:flex items-start justify-between px-10 pt-10 pb-6">
        <div>
          <h1 className="text-[34px] font-serif font-medium text-[var(--color-text-primary)]">
            {greeting}, {firstName}.
          </h1>
          <p className="text-base text-[var(--color-text-secondary)] mt-1">
            What are you building today?
          </p>
          <span
            className="inline-block mt-3 rounded-full px-3 py-1 text-xs font-medium border"
            style={{ color: planColor, backgroundColor: planBg, borderColor: planBorder }}
          >
            {planLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#0F0F0E] px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[#FAFAF8]">
            Desktop · Home
          </span>
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-secondary)] text-[var(--color-text-secondary)]"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile header (hidden on desktop) ── */}
      <header className="lg:hidden flex items-center justify-between px-[13px] py-2 bg-[#0F0F0E]">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#FAFAF8] truncate">
            {greeting}, {firstName}.
          </p>
          <p className="text-[10px] text-[#6B7280] mt-0.5">
            What are you building today?
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="rounded-[10px] border px-2 py-0.5 text-[9px]"
            style={{ color: planColor, backgroundColor: planBg, borderColor: planBorder }}
          >
            {planLabel}
          </span>
          <Bell className="w-[17px] h-[17px] text-[#9CA3AF]" aria-label="Notifications" />
        </div>
      </header>

      {/* ── Summit banner — full width, sits directly under the header on
          both breakpoints (matches screenshot 1: black bar spans the
          center + right zones beneath the greeting) ── */}
      <div className="px-[13px] lg:px-10 mb-3 lg:mb-6">
        <SummitBanner daysAway={summitDaysAway} />
      </div>

      {/* ── Main content ── */}
      <div className="lg:flex lg:gap-8 lg:px-10 lg:pb-10">
        {/* Center column */}
        <main className="flex-1 min-w-0 px-[13px] pb-[14px] lg:p-0 lg:max-w-[610px]">
          {/* Stat grid */}
          <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-3 lg:mb-6">
            <StatBox value={sessionsThisWeek} label="Sessions this week" color="#C8A96E" />
            <StatBox
              value={`${commitmentsDone}/${commitmentsTotal}`}
              label="Commitments done"
              color="#16A34A"
            />
            <StatBox value={`${goalProgressPct}%`} label="90-day progress" color="#534AB7" />
          </div>

          <div className="mb-3 lg:mb-6">
            <GoalCard goal={goal} progressPct={goalProgressPct} />
          </div>

          {/* unreadCircleCount is 0 until an unread-tracking column/table
              exists in the schema — database.ts has no last_read_at or
              equivalent on cohorts/posts today, so this can't be wired
              for real yet. See note in the summary above. */}
          <QuickActionGrid
            nextSessionLabel={nextSessionLabel}
            unreadCircleCount={0}
          />

          <div className="mb-3 lg:mb-6">
            <CommitmentsCard commitments={commitments} />
          </div>

          <div className="mb-3 lg:mb-0 lg:hidden">
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
