// components/dashboard/StatBox.tsx
// Single stat tile used in the 3-column grid at the top of Home.
// Desktop: bigger numerals, white card. Mobile: compact, secondary-bg tile.
// Color is passed per-stat (gold / green / indigo).
//
// FIX: Added optional `trend` prop for micro-trend indicators.
// Shows an up/down arrow + delta vs previous period so the number
// carries meaning (e.g. "↑2 vs last week") rather than being context-free.
// `trend` is optional — existing callers that don't pass it get no change.

interface StatBoxProps {
  value: string | number;
  label: string;
  color?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string; // e.g. "vs last week" or "of 5 target"
  };
}

const TREND_ARROW = { up: '↑', down: '↓', neutral: '–' } as const;
const TREND_COLOR = {
  up:      '#16A34A',
  down:    '#DC2626',
  neutral: '#6B7280',
} as const;

export function StatBox({ value, label, color = '#C8A96E', trend }: StatBoxProps) {
  return (
    <div
      className="
        rounded-xl text-center
        bg-[var(--bg)]
        px-2 py-3
        lg:bg-[var(--bg-card)]
        lg:border lg:border-[var(--border)]
        lg:rounded-2xl lg:px-4 lg:py-6
      "
    >
      <div
        className="text-[20px] lg:text-[32px] font-medium leading-none"
        style={{ color }}
      >
        {value}
      </div>

      <div className="mt-[3px] lg:mt-2 text-[9px] lg:text-xs tracking-wide text-[var(--text-muted)] uppercase">
        {label}
      </div>

      {trend && (
        <div
          className="mt-1 lg:mt-2 flex items-center justify-center gap-0.5 text-[9px] lg:text-[11px] font-medium"
          style={{ color: TREND_COLOR[trend.direction] }}
        >
          <span aria-hidden="true">{TREND_ARROW[trend.direction]}</span>
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
