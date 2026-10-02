// components/dashboard/WeekHistory.tsx
// Six weeks of kept commitments as a bar strip: consistency at a glance.

import type { WeekBar } from '@/lib/supabase/queries/dashboard';
import { Card } from '@/components/ui';

export function WeekHistory({
  weeks,
  sessionsThisWeek,
}: {
  weeks: WeekBar[];
  sessionsThisWeek: number;
}) {
  const keptWeeks = weeks.filter((w) => w.total > 0 && w.done === w.total).length;
  const hasData = weeks.some((w) => w.total > 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-[var(--text)]">Consistency</h2>
        <span className="text-sm text-[var(--text-dim)]">Last 6 weeks</span>
      </div>

      {hasData ? (
        <>
          <ul className="mt-4 flex h-20 items-end gap-2" aria-label="Commitments kept per week">
            {weeks.map((w, i) => {
              const pct = w.total ? Math.round((w.done / w.total) * 100) : 0;
              const isCurrent = i === weeks.length - 1;
              return (
                <li key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="flex w-full flex-1 items-end rounded-md bg-[var(--app-accent-soft)]"
                    title={`Week of ${w.label}: ${w.done} of ${w.total} kept`}
                  >
                    <div
                      className={`w-full rounded-md ${isCurrent ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-accent-ink)]/70'}`}
                      style={{ height: `${Math.max(pct, w.total ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-dim)]">{isCurrent ? 'Now' : `W${i + 1}`}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {keptWeeks === 0
              ? 'Keep every commitment in a week to light your first bar.'
              : `${keptWeeks} of the last 6 weeks fully kept`}
            {sessionsThisWeek > 0 &&
              ` · ${sessionsThisWeek} session${sessionsThisWeek === 1 ? '' : 's'} this week`}
            .
          </p>
        </>
      ) : (
        <p className="mt-3 text-base text-[var(--text-muted)]">
          Your weekly record will build here once you start logging commitments.
        </p>
      )}
    </Card>
  );
}
