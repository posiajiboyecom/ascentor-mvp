// components/dashboard/DimensionStrip.tsx
// The product's fingerprint, permanently visible on Today's Page:
// the dimensions of a total person as a slim horizontal strip.
// Today's dimension (set by the daily line) carries the full gold
// Ledger Line; the rest show a hairline that fills on hover.
// Each dimension links into Sage pre-scoped to that dimension via
// a ?prefill= param that CoachChat reads into the draft input.

import Link from 'next/link';

const DIMENSIONS = [
  'Mind',
  'Character',
  'Work',
  'Relationships',
  'Community',
  'Legacy',
] as const;

export function DimensionStrip({ today }: { today?: string }) {
  return (
    <nav aria-label="Dimensions" className="overflow-x-auto">
      <ul className="flex items-baseline gap-5 lg:gap-8 min-w-max py-1">
        {DIMENSIONS.map((dim) => {
          const isToday = dim === today;
          const prefill = encodeURIComponent(
            `I want to work on my ${dim.toLowerCase()} this season. Where should I start?`
          );
          return (
            <li key={dim}>
              <Link
                href={`/coach?prefill=${prefill}`}
                className="group block"
                aria-current={isToday ? 'true' : undefined}
              >
                <span
                  className={`
                    text-[11px] lg:text-xs font-medium tracking-[0.12em] uppercase
                    transition-colors duration-150 ease-out
                    ${isToday ? 'text-[var(--app-accent)]' : 'text-[var(--text-dim)] group-hover:text-[var(--text-muted)]'}
                  `}
                >
                  {dim}
                </span>
                <span
                  aria-hidden="true"
                  className={`
                    block h-px mt-1.5 origin-left
                    transition-transform duration-300 ease-out
                    ${
                      isToday
                        ? 'bg-[var(--app-accent)] scale-x-100'
                        : 'bg-[var(--app-border-gold)] scale-x-0 group-hover:scale-x-100'
                    }
                  `}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
