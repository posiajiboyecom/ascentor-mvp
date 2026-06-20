// components/dashboard/StatBox.tsx
// Single stat tile used in the 3-column grid at the top of Home.
// Desktop: bigger numerals, white card. Mobile: compact, secondary-bg tile.
// Color is passed per-stat to match the screenshots (gold / green / indigo).

interface StatBoxProps {
  value: string | number;
  label: string;
  color?: string;
}

export function StatBox({ value, label, color = '#C8A96E' }: StatBoxProps) {
  return (
    <div
      className="
        rounded-xl text-center
        bg-[var(--color-background-secondary)]
        px-2 py-3
        lg:bg-[var(--color-background-primary)]
        lg:border lg:border-[var(--color-border-secondary)]
        lg:rounded-2xl lg:px-4 lg:py-6
      "
    >
      <div
        className="text-[20px] lg:text-[32px] font-medium leading-none"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-[3px] lg:mt-2 text-[9px] lg:text-xs tracking-wide text-[var(--color-text-secondary)] uppercase">
        {label}
      </div>
    </div>
  );
}
