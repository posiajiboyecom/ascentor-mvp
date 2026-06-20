// components/dashboard/GoalCard.tsx
import { Clock } from 'lucide-react';
import type { UserGoal } from '@/database/database';

interface GoalCardProps {
  goal: UserGoal | null;
  progressPct: number;
}

export function GoalCard({ goal, progressPct }: GoalCardProps) {
  const milestones = goal
    ? [goal.milestone_1, goal.milestone_2, goal.milestone_3].filter(
        (m): m is string => Boolean(m)
      )
    : [];

  return (
    <div
      className="
        rounded-xl lg:rounded-2xl border border-[#C8A96E]/20
        bg-[#C8A96E]/[0.04]
        p-[13px] lg:p-7
      "
    >
      <div className="flex items-center justify-between mb-[5px] lg:mb-3">
        <div className="flex items-center gap-1.5 lg:gap-2 text-[9px] lg:text-sm font-medium uppercase tracking-[0.08em] text-[#C8A96E]">
          <Clock className="hidden lg:block w-4 h-4" aria-hidden="true" />
          90-Day Goal
        </div>
        <span className="rounded-full bg-[var(--color-background-secondary)] px-2.5 py-0.5 text-[11px] lg:text-sm text-[var(--color-text-secondary)]">
          {progressPct}%
        </span>
      </div>

      {goal ? (
        <>
          <p className="text-xs lg:text-lg text-[var(--color-text-primary)] leading-relaxed mb-2 lg:mb-4">
            {goal.goal_text}
          </p>

          <div className="h-1 lg:h-1.5 rounded-full bg-[var(--color-background-secondary)] overflow-hidden mb-1 lg:mb-2">
            <div
              className="h-full rounded-full bg-[#C8A96E]"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
          <p className="text-[10px] lg:text-sm text-[var(--color-text-secondary)] lg:hidden">
            {progressPct}% complete
          </p>

          {milestones.length > 0 && (
            <ul className="mt-3 lg:mt-5 space-y-2 lg:space-y-3">
              {milestones.map((m, i) => (
                <li key={i} className="flex items-center gap-2 lg:gap-3">
                  <span className="h-4 w-4 shrink-0 rounded border-[1.5px] border-[var(--color-border-secondary)]" />
                  <span className="text-xs lg:text-base text-[var(--color-text-primary)]">
                    {m}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs lg:text-base text-[var(--color-text-secondary)]">
          Set a 90-day goal to start tracking progress.
        </p>
      )}
    </div>
  );
}
