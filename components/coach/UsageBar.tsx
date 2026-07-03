// components/coach/UsageBar.tsx
// Shows the user's monthly coaching session usage against their plan limit.
// When limit is -1 (unlimited plan), the bar is hidden entirely —
// no false cap is displayed.

interface UsageBarProps {
  used: number;
  /** Monthly session limit. Pass -1 for unlimited — bar will not render. */
  limit: number;
}

export function UsageBar({ used, limit }: UsageBarProps) {
  // Unlimited plans: don't show a usage bar at all.
  if (limit === -1) return null;

  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isNearLimit = pct >= 80;

  return (
    <div className="px-3 lg:px-0 py-[7px] lg:py-0 lg:flex lg:items-center lg:justify-end">
      <div className="lg:hidden">
        <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              backgroundColor: isNearLimit ? '#EF4444' : '#C8A96E',
            }}
          />
        </div>
        <p className="mt-[3px] text-[9px] text-[#4B5563]">
          {used} of {limit} sessions used this month
        </p>
      </div>
      <p
        className="hidden lg:block text-sm"
        style={{ color: isNearLimit ? '#EF4444' : 'var(--color-text-secondary)' }}
      >
        {used}/{limit} this month
      </p>
    </div>
  );
}
