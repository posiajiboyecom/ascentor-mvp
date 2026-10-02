'use client';

// components/dashboard/GoalCard.tsx
// The member's 90-day goal. Create / edit inline; milestones persist via a
// server action and drive the progress figure (so it can never go stale).

import { useState, useTransition } from 'react';
import { Check, Pencil, Target, Plus } from 'lucide-react';
import type { UserGoal } from '@/database/database';
import { saveGoalAction, toggleMilestoneAction } from '@/app/(app)/dashboard/actions';
import { Card } from '@/components/ui';

interface GoalCardProps {
  goal: UserGoal | null;
  progressPct: number;
  goalDay: number | null;
}

type MilestoneKey = 'milestone_1' | 'milestone_2' | 'milestone_3';

const KEYS: MilestoneKey[] = ['milestone_1', 'milestone_2', 'milestone_3'];

export function GoalCard({ goal, progressPct, goalDay }: GoalCardProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [checked, setChecked] = useState<Record<MilestoneKey, boolean>>(() => ({
    milestone_1: Boolean(goal?.milestone_1_completed),
    milestone_2: Boolean(goal?.milestone_2_completed),
    milestone_3: Boolean(goal?.milestone_3_completed),
  }));

  const [draftGoal, setDraftGoal] = useState(goal?.goal_text ?? '');
  const [draftMs, setDraftMs] = useState<string[]>(
    KEYS.map((k) => (goal?.[k] as string | null) ?? '')
  );

  const milestones = goal
    ? KEYS.map((k) => ({ key: k, text: goal[k] as string | null })).filter(
        (m): m is { key: MilestoneKey; text: string } => Boolean(m.text)
      )
    : [];

  // Local progress mirrors the server derivation so the bar moves instantly.
  const pct = milestones.length
    ? Math.round((milestones.filter((m) => checked[m.key]).length / milestones.length) * 100)
    : progressPct;

  function toggle(key: MilestoneKey) {
    if (!goal) return;
    const next = !checked[key];
    setChecked((p) => ({ ...p, [key]: next }));
    setError('');
    startTransition(async () => {
      try {
        await toggleMilestoneAction(goal.id, key, next);
      } catch {
        setChecked((p) => ({ ...p, [key]: !next }));
        setError('Couldn’t save that milestone. Please try again.');
      }
    });
  }

  function save() {
    setError('');
    startTransition(async () => {
      try {
        await saveGoalAction({
          goalId: goal?.id ?? null,
          goalText: draftGoal,
          milestones: draftMs,
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Couldn’t save your goal.');
      }
    });
  }

  return (
    <Card className="border-[var(--app-border-gold)] shadow-[var(--app-card-shadow)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--app-accent-ink)]">
          <Target className="w-4 h-4" aria-hidden="true" />
          90-day goal
          {goalDay !== null && (
            <span className="font-normal normal-case tracking-normal text-[var(--text-dim)]">
              · day {Math.min(goalDay, 90)} of 90
            </span>
          )}
        </p>
        {goal && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit goal"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--app-bg-hover)]"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      {editing || !goal ? (
        <div className="space-y-3">
          {!goal && !editing ? (
            <>
              <p className="text-base text-[var(--text-muted)]">
                A goal you can see is a goal you keep. Name what you’re building in the next 90 days.
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[#0F0F0E] hover:opacity-90"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Set my 90-day goal
              </button>
            </>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">My goal</span>
                <textarea
                  value={draftGoal}
                  onChange={(e) => setDraftGoal(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="By day 90, I will…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--app-bg-input)] px-3 py-2.5 text-base text-[var(--text)]"
                />
              </label>
              <div>
                <span className="mb-1 block text-sm font-medium text-[var(--text)]">
                  Up to 3 milestones <span className="font-normal text-[var(--text-dim)]">(optional)</span>
                </span>
                <div className="space-y-2">
                  {draftMs.map((m, i) => (
                    <input
                      key={i}
                      value={m}
                      maxLength={160}
                      onChange={(e) =>
                        setDraftMs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={`Milestone ${i + 1}`}
                      aria-label={`Milestone ${i + 1}`}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--app-bg-input)] px-3 py-2.5 text-base text-[var(--text)]"
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={pending || !draftGoal.trim()}
                  className="rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-semibold text-[#0F0F0E] disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save goal'}
                </button>
                {goal && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--app-bg-hover)]"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="font-[family-name:var(--font-editorial)] text-xl leading-snug text-[var(--text)]">
            {goal.goal_text}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--app-accent-soft)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Goal progress"
            >
              <div
                className="h-full rounded-full bg-[var(--app-accent)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{pct}%</span>
          </div>

          {milestones.length > 0 && (
            <ul className="mt-4 space-y-1">
              {milestones.map(({ key, text }) => {
                const done = checked[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-pressed={done}
                      className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left hover:bg-[var(--app-bg-hover)]"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${
                          done
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent)]'
                            : 'border-[var(--text-dim)] bg-transparent'
                        }`}
                      >
                        {done && <Check className="w-3.5 h-3.5 text-[#0F0F0E]" strokeWidth={3} />}
                      </span>
                      <span className={`text-base ${done ? 'text-[var(--text-dim)] line-through' : 'text-[var(--text)]'}`}>
                        {text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--error)]">
          {error}
        </p>
      )}
    </Card>
  );
}
