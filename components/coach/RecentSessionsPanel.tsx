'use client';

// components/coach/RecentSessionsPanel.tsx
import type { RecentSessionSummary } from '@/lib/supabase/queries/coach';

interface RecentSessionsPanelProps {
  sessions: RecentSessionSummary[];
  onSelect: (sessionId: string) => void;
}

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function RecentSessionsPanel({
  sessions,
  onSelect,
}: RecentSessionsPanelProps) {
  return (
    <aside className="hidden lg:block w-[300px] shrink-0 border-l border-[var(--color-border-tertiary)] px-6 py-6 h-full overflow-y-auto">
      <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-4">
        Recent sessions
      </h2>

      {sessions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your past sessions will show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className="
                text-left rounded-xl border-[0.5px] border-[var(--color-border-tertiary)]
                bg-[var(--color-background-primary)]
                px-4 py-3
                hover:border-[var(--color-border-secondary)] transition-colors
              "
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#C8A96E] mb-1">
                {s.sessionTypeLabel}
              </p>
              <p className="text-sm text-[var(--color-text-primary)] leading-snug mb-1.5 line-clamp-3">
                {s.preview}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {formatRelativeDate(s.createdAt)}
              </p>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
