// app/(app)/dashboard/page.tsx
// The Home / Dashboard screen. Server Component — fetches everything
// in one pass via lib/supabase/queries/dashboard.ts, then renders.

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
    summitRegistered,
    unreadCircleCount,
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
      <header className="hidden lg:flex items-start justify-between px-10 pt-10 pb-8">
        <div>
          <h1 className="text-[34px] font-serif font-medium text-[var(--text)]">
            {greeting}, {firstName}.
          </h1>
          <p className="text-base text-[var(--text-muted)] mt-1">
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
          <p className="text-xs text-[#6B7280] mt-0.5">
            What are you building today?
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
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
        <SummitBanner daysAway={summitDaysAway} registered={summitRegistered} />
      </div>

      {/* ── Main content ── */}
      <div className="lg:flex lg:gap-8 lg:px-10 lg:pb-10">
        {/* Center column */}
        <main className="flex-1 min-w-0 px-4 pb-6 lg:p-0 lg:max-w-[610px]">
          <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <StatBox value={sessionsThisWeek} label="Sessions this week" color="#C8A96E" />
            <StatBox
              value={`${commitmentsDone}/${commitmentsTotal}`}
              label="Commitments done"
              color="#16A34A"
            />
            <StatBox value={`${goalProgressPct}%`} label="90-day progress" color="#534AB7" />
          </div>

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
