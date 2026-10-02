'use client';

// components/dashboard/CommitmentsCard.tsx
// This week's commitments: tick, add, remove. Optimistic, reverts on failure.

import { useState, useEffect, useTransition } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { UserCommitment } from '@/database/database';
import {
  toggleCommitmentAction,
  addCommitmentAction,
  deleteCommitmentAction,
} from '@/app/(app)/dashboard/actions';
import { Card } from '@/components/ui';

interface CommitmentsCardProps {
  commitments: UserCommitment[];
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CommitmentsCard({ commitments }: CommitmentsCardProps) {
  const [items, setItems] = useState(commitments);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [adding, startAdd] = useTransition();
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(commitments);
  }, [commitments]);

  const doneCount = items.filter((c) => c.completed).length;

  function handleToggle(id: string, next: boolean) {
    setError('');
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, completed: next } : c)));
    startTransition(async () => {
      try {
        await toggleCommitmentAction(id, next);
      } catch {
        setItems((prev) => prev.map((c) => (c.id === id ? { ...c, completed: !next } : c)));
        setError('Couldn’t save that. Please try again.');
      }
    });
  }

  function handleDelete(id: string) {
    const snapshot = items;
    setItems((prev) => prev.filter((c) => c.id !== id));
    startTransition(async () => {
      try {
        await deleteCommitmentAction(id);
      } catch {
        setItems(snapshot);
        setError('Couldn’t remove that. Please try again.');
      }
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError('');
    startAdd(async () => {
      try {
        const row = (await addCommitmentAction(text)) as UserCommitment;
        setItems((prev) => [...prev, row]);
        setDraft('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t add that commitment.');
      }
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--text)]">This week’s commitments</h2>
        <span className="rounded-full bg-[var(--app-accent-soft)] px-3 py-1 text-sm font-medium tabular-nums text-[var(--app-accent-ink)]">
          {doneCount} / {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-2 text-base text-[var(--text-muted)]">
          Nothing on the ledger yet. Write down one promise you’ll keep this week.
        </p>
      ) : (
        <ul>
          {items.map((c) => (
            <li
              key={c.id}
              className="group flex items-center gap-3 border-b border-[var(--border-light)] py-2.5 last:border-b-0"
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
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${
                  c.completed
                    ? 'border-[var(--app-accent)] bg-[var(--app-accent)]'
                    : 'border-[var(--text-dim)] bg-transparent hover:border-[var(--app-accent)]'
                }`}
              >
                {c.completed && <Check className="w-4 h-4 text-[#0F0F0E]" strokeWidth={3} />}
              </button>

              <span
                className={`flex-1 text-base leading-snug ${
                  c.completed ? 'ledger-strike' : 'text-[var(--text)]'
                }`}
              >
                {c.commitment_text}
              </span>

              {formatDueDate(c.due_date) && (
                <span className="hidden sm:inline shrink-0 text-sm text-[var(--text-dim)]">
                  {formatDueDate(c.due_date)}
                </span>
              )}

              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                aria-label={`Remove "${c.commitment_text}"`}
                className="shrink-0 rounded-md p-1 text-[var(--text-dim)] opacity-60 hover:bg-[var(--app-bg-hover)] hover:opacity-100 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Add a commitment…"
          aria-label="New commitment"
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--app-bg-input)] px-3 py-2.5 text-base text-[var(--text)]"
        />
        <button
          type="submit"
          disabled={adding || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[#0F0F0E] disabled:opacity-50"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </Card>
  );
}
