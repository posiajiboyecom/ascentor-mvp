'use client';

// components/coach/SessionTypeTabs.tsx
import { Lock } from 'lucide-react';
import type { SessionType } from '@/lib/session-types';

interface SessionTypeTabsProps {
  allTypes: SessionType[];
  availableTypeIds: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
}

export function SessionTypeTabs({
  allTypes,
  availableTypeIds,
  activeId,
  onSelect,
}: SessionTypeTabsProps) {
  return (
    <div className="flex gap-1 lg:gap-2 overflow-x-auto px-3 lg:px-0 py-2 lg:py-0 lg:flex-wrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {allTypes.map((type) => {
        const locked = !availableTypeIds.has(type.id);
        const active = type.id === activeId;
        return (
          <button
            key={type.id}
            type="button"
            disabled={locked}
            onClick={() => !locked && onSelect(type.id)}
            className={`
              shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-lg lg:rounded-full
              px-2.5 py-[5px] lg:px-5 lg:py-2.5
              text-[10px] lg:text-sm font-medium
              border-[0.5px] transition-colors
              ${
                active
                  ? 'bg-[#C8A96E]/[0.12] text-[#C8A96E] border-[#C8A96E]/30'
                  : locked
                    ? 'text-[var(--color-text-secondary)]/60 border-transparent cursor-not-allowed'
                    : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
              }
            `}
          >
            {type.label}
            {locked && <Lock className="w-3 h-3" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
