// components/dashboard/SummitBanner.tsx
import Link from 'next/link';

interface SummitBannerProps {
  daysAway: number;
}

export function SummitBanner({ daysAway }: SummitBannerProps) {
  return (
    <Link
      href="/elevation-summit"
      className="
        flex items-center justify-between gap-2
        rounded-xl lg:rounded-2xl
        border border-[#C8A96E]/20
        bg-[#0F0F0E]
        px-[13px] py-[11px] lg:px-7 lg:py-6
      "
    >
      <div className="min-w-0">
        <p className="text-[8px] lg:text-[11px] font-medium uppercase tracking-[0.1em] text-[#C8A96E] mb-0.5 lg:mb-1.5">
          The Elevation Summit
        </p>
        <p className="text-xs lg:text-2xl font-medium text-[#FAFAF8] lg:font-serif">
          February 2027 · Lagos, Nigeria
        </p>
        <p className="hidden lg:block text-sm text-[#6B7280] mt-1">
          {daysAway} days away
        </p>
      </div>
      <span
        className="
          shrink-0 whitespace-nowrap rounded-lg lg:rounded-full
          bg-[#C8A96E] text-[#0F0F0E]
          px-2.5 py-[5px] lg:px-6 lg:py-3
          text-[10px] lg:text-sm font-medium
        "
      >
        Register →
      </span>
    </Link>
  );
}
