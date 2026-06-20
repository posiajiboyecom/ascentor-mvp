// components/coach/UsageBar.tsx
interface UsageBarProps {
  used: number;
  limit: number;
}

export function UsageBar({ used, limit }: UsageBarProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="px-3 lg:px-0 py-[7px] lg:py-0 lg:flex lg:items-center lg:justify-end">
      <div className="lg:hidden">
        <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#C8A96E]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-[3px] text-[9px] text-[#4B5563]">
          {used} of {limit} sessions used today
        </p>
      </div>
      <p className="hidden lg:block text-sm text-[var(--color-text-secondary)]">
        {used}/{limit} today
      </p>
    </div>
  );
}
