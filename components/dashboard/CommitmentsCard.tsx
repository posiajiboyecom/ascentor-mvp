'use client';

// components/dashboard/CommitmentsCard.tsx
import { useState, useEffect, useTransition } from 'react';
import { Check } from 'lucide-react';
import type { UserCommitment } from '@/database/database';
import { toggleCommitmentAction } from '@/app/(app)/dashboard/actions';

interface CommitmentsCardProps {
  commitments: UserCommitment[];
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function CommitmentsCard({ commitments }: CommitmentsCardProps) {
  const [items, setItems] = useState(commitments);
  const [, startTransition] = useTransition();

  // Re-sync when the server gives us fresh data (e.g. after
  // revalidatePath following a toggle elsewhere, or a hard refresh).
  useEffect(() => {
    setItems(commitments);
  }, [commitments]);

  const doneCount = items.filter((c) => c.completed).length;

  function handleToggle(id: string, next: boolean) {
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, completed: next } : c))
    );
    startTransition(async () => {
      try {
        await toggleCommitmentAction(id, next);
      } catch {
        // Revert on failure
        setItems((prev) =>
          prev.map((c) => (c.id === id ? { ...c, completed: !next } : c))
        );
      }
    });
  }

  return (
    <div
      className="
        rounded-xl lg:rounded-2xl
        border border-[var(--color-border-secondary)]
        bg-[var(--color-background-primary)]
        p-[13px] lg:p-7
      "
    >
      <div className="flex items-center justify-between mb-2.5 lg:mb-5">
        <span className="text-xs lg:text-lg font-medium text-[var(--color-text-primary)]">
          This week&apos;s commitments
        </span>
        <span className="rounded-full border border-green-600/20 bg-green-600/[0.08] px-2.5 py-0.5 text-[9px] lg:text-sm text-green-600">
          {doneCount} / {items.length} done
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs lg:text-base text-[var(--color-text-secondary)] py-2">
          No commitments logged this week yet.
        </p>
      ) : (
        <ul>
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2.5 lg:gap-4 py-[7px] lg:py-3 border-b border-[var(--color-border-tertiary)] last:border-b-0"
            >
              <button
                type="button"
                aria-pressed={c.completed}
                aria-label={
                  c.completed
                    ? `Mark "${c.commitment_text}" as not done`
                    : `Mark "${c.commitment_text}" as done`
                }
                onClick={() => handleToggle(c.id, !c.completed)}
                className={`
                  flex h-4 w-4 lg:h-5 lg:w-5 shrink-0 items-center justify-center
                  rounded lg:rounded-md border-[1.5px] transition-colors
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96E] focus-visible:outline-offset-2
                  ${
                    c.completed
                      ? 'bg-[#C8A96E] border-[#C8A96E]'
                      : 'border-[var(--color-border-secondary)] bg-transparent'
                  }
                `}
              >
                {c.completed && (
                  <Check
                    className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-[#0F0F0E]"
                    strokeWidth={3}
                  />
                )}
              </button>

              <span
                className={`flex-1 text-xs lg:text-base leading-relaxed ${
                  c.completed
                    ? 'text-[var(--color-text-secondary)] line-through'
                    : 'text-[var(--color-text-primary)]'
                }`}
              >
                {c.commitment_text}
              </span>

              {formatDueDate(c.due_date) && (
                <span className="hidden lg:inline text-sm text-[var(--color-text-secondary)] shrink-0">
                  {formatDueDate(c.due_date)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
