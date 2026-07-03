// components/dashboard/GoalCard.tsx
//
// FIX: Milestone checkboxes are now interactive.
// Previously they were visual-only <span> elements — tapping them did nothing,
// breaking the affordance they implied. Now they are real <button> elements
// that track completion in local state (optimistic) and persist to Supabase
// via the /api/goals/milestone route. The component is converted to 'use client'
// to support the interactive state; it was already receiving data from the
// Server Component parent so this has no data-fetching impact.
//
// Also fixed: stale --color-* token references replaced with canonical tokens.

'use client';

import { useState } from 'react';
import { Clock, Check } from 'lucide-react';
import type { UserGoal } from '@/database/database';

interface GoalCardProps {
  goal: UserGoal | null;
  progressPct: number;
}

export function GoalCard({ goal, progressPct }: GoalCardProps) {
  const rawMilestones = goal
    ? [
        { key: 'milestone_1', text: goal.milestone_1 },
        { key: 'milestone_2', text: goal.milestone_2 },
        { key: 'milestone_3', text: goal.milestone_3 },
      ].filter((m): m is { key: string; text: string } => Boolean(m.text))
    : [];

  // Local optimistic state — seed from any existing completion fields if present
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    rawMilestones.forEach(({ key }) => {
      // @ts-expect-error — completion fields may not be in the DB type yet
      init[key] = Boolean(goal?.[`${key}_completed`]);
    });
    return init;
  });

  async function toggleMilestone(key: string) {
    const next = !checked[key];
    // Optimistic update
    setChecked((prev) => ({ ...prev, [key]: next }));

    // Persist — fire and forget; if it fails the next full-page load corrects it
    try {
      await fetch('/api/goals/milestone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: goal?.id, field: key, completed: next }),
      });
    } catch {
      // Revert optimistic update on network failure
      setChecked((prev) => ({ ...prev, [key]: !next }));
    }
  }

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
        <span className="rounded-full bg-[var(--bg)] px-2.5 py-0.5 text-[11px] lg:text-sm text-[var(--text-muted)]">
          {progressPct}%
        </span>
      </div>

      {goal ? (
        <>
          <p className="text-xs lg:text-lg text-[var(--text)] leading-relaxed mb-2 lg:mb-4">
            {goal.goal_text}
          </p>

          <div className="h-1 lg:h-1.5 rounded-full bg-[var(--bg)] overflow-hidden mb-1 lg:mb-2">
            <div
              className="h-full rounded-full bg-[#C8A96E] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
          <p className="text-[10px] lg:text-sm text-[var(--text-muted)] lg:hidden">
            {progressPct}% complete
          </p>

          {rawMilestones.length > 0 && (
            <ul className="mt-3 lg:mt-5 space-y-2 lg:space-y-3">
              {rawMilestones.map(({ key, text }) => {
                const done = checked[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => toggleMilestone(key)}
                      className="flex items-center gap-2 lg:gap-3 w-full text-left group"
                      aria-pressed={done}
                      aria-label={`${done ? 'Uncheck' : 'Check'} milestone: ${text}`}
                    >
                      <span
                        className="
                          h-4 w-4 shrink-0 rounded flex items-center justify-center
                          border-[1.5px] transition-colors
                        "
                        style={{
                          borderColor:     done ? '#C8A96E' : 'var(--border)',
                          backgroundColor: done ? '#C8A96E' : 'transparent',
                        }}
                        aria-hidden="true"
                      >
                        {done && <Check className="w-2.5 h-2.5 text-[#0F0F0E]" strokeWidth={3} />}
                      </span>
                      <span
                        className="text-xs lg:text-base transition-colors"
                        style={{
                          color:          done ? 'var(--text-muted)' : 'var(--text)',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs lg:text-base text-[var(--text-muted)]">
          Set a 90-day goal to start tracking progress.
        </p>
      )}
    </div>
  );
}
