'use client';

// components/coach/CoachEmptyState.tsx
import {
  Sparkles,
  AlertTriangle,
  RefreshCcw,
  MessageSquare,
  CheckSquare,
  Compass,
  DollarSign,
  Users,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import type { SessionType } from '@/lib/session-types';

const ICON_MAP: Record<string, LucideIcon> = {
  challenge_navigation: AlertTriangle,
  weekly_reflection: RefreshCcw,
  difficult_conversation: MessageSquare,
  accountability_check: CheckSquare,
  career_planning: Compass,
  salary_negotiation: DollarSign,
  leadership_development: Users,
};

interface CoachEmptyStateProps {
  allTypes: SessionType[];
  availableTypeIds: Set<string>;
  onSelectType: (id: string) => void;
  greeting: string;
  firstName: string;
}

export function CoachEmptyState({
  allTypes,
  availableTypeIds,
  onSelectType,
  greeting,
  firstName,
}: CoachEmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-5 py-7 lg:py-16 lg:max-w-[640px] lg:mx-auto">
      <span className="flex h-[52px] w-[52px] lg:h-16 lg:w-16 items-center justify-center rounded-full bg-[#C8A96E]/[0.12] border-[1.5px] border-[#C8A96E]/30 mb-3 lg:mb-5">
        <Sparkles className="w-[22px] h-[22px] lg:w-7 lg:h-7 text-[#C8A96E]" aria-hidden="true" />
      </span>

      <h1 className="text-sm lg:text-2xl font-medium text-[var(--color-text-primary)] mb-1 lg:mb-2 lg:font-serif">
        {greeting}, {firstName}.
      </h1>
      <p className="text-xs lg:text-base text-[var(--color-text-secondary)] leading-relaxed mb-4 lg:mb-10 max-w-[280px] lg:max-w-md">
        Work through a specific career or workplace challenge — pick a
        starting point, or just type below.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[7px] lg:gap-4 w-full">
        {allTypes.map((type) => {
          const Icon = ICON_MAP[type.id] ?? Sparkles;
          const locked = !availableTypeIds.has(type.id);
          return (
            <button
              key={type.id}
              type="button"
              disabled={locked}
              onClick={() => !locked && onSelectType(type.id)}
              className={`
                flex items-start gap-2.5 lg:gap-4 text-left
                rounded-[10px] lg:rounded-2xl
                border-[0.5px] border-[var(--color-border-secondary)]
                bg-[var(--color-background-secondary)] lg:bg-[var(--color-background-primary)]
                px-3 py-2.5 lg:px-6 lg:py-5
                ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-border-primary)] transition-colors'}
              `}
            >
              <Icon
                className="w-4 h-4 lg:w-6 lg:h-6 text-[var(--color-text-secondary)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="block text-xs lg:text-base font-medium text-[var(--color-text-primary)]">
                    {type.label}
                  </span>
                  {locked && (
                    <Lock className="w-3 h-3 text-[var(--color-text-secondary)]" aria-hidden="true" />
                  )}
                </span>
                <span className="block text-[11px] lg:text-sm text-[var(--color-text-secondary)] leading-snug mt-0.5">
                  {type.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
