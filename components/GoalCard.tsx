'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function GoalCard({ goal: initialGoal }: { goal: any }) {
  const [goal, setGoal] = useState(initialGoal ?? null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    goal_text:   initialGoal?.goal_text   || '',
    milestone_1: initialGoal?.milestone_1 || '',
    milestone_2: initialGoal?.milestone_2 || '',
    milestone_3: initialGoal?.milestone_3 || '',
  });
  const supabase = createClient();

  // ── FIX 2: null state — show CTA instead of blank gap ──
  if (!goal) {
    return (
      <div className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: '24px' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Set your 90-day goal
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
              Your mentor works best when it knows where you're headed.
            </p>
          </div>
          <Link
            href="/coach"
            className="px-4 py-1.5 rounded-lg text-xs font-semibold shrink-0"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            Set Goal →
          </Link>
        </div>
      </div>
    );
  }

  const progress   = goal.progress || 0;
  const milestones = [
    { text: goal.milestone_1, complete: goal.milestone_1_complete, key: 'milestone_1_complete' },
    { text: goal.milestone_2, complete: goal.milestone_2_complete, key: 'milestone_2_complete' },
    { text: goal.milestone_3, complete: goal.milestone_3_complete, key: 'milestone_3_complete' },
  ];

  const toggleMilestone = async (key: string, currentValue: boolean) => {
    const newValue      = !currentValue;
    const updatedGoal   = { ...goal, [key]: newValue };
    const completedCount = [
      key === 'milestone_1_complete' ? newValue : updatedGoal.milestone_1_complete,
      key === 'milestone_2_complete' ? newValue : updatedGoal.milestone_2_complete,
      key === 'milestone_3_complete' ? newValue : updatedGoal.milestone_3_complete,
    ].filter(Boolean).length;

    updatedGoal.progress = Math.round((completedCount / 3) * 100);
    setGoal(updatedGoal);

    await supabase
      .from('user_goals')
      .update({ [key]: newValue, progress: updatedGoal.progress })
      .eq('id', goal.id);
  };

  const saveEdit = async () => {
    if (!editForm.goal_text.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('user_goals')
      .update({
        goal_text:   editForm.goal_text,
        milestone_1: editForm.milestone_1,
        milestone_2: editForm.milestone_2,
        milestone_3: editForm.milestone_3,
      })
      .eq('id', goal.id);

    if (!error) {
      setGoal({
        ...goal,
        goal_text:   editForm.goal_text,
        milestone_1: editForm.milestone_1,
        milestone_2: editForm.milestone_2,
        milestone_3: editForm.milestone_3,
      });
      setEditing(false);
    }
    setSaving(false);
  };

  // ── Edit mode ──
  if (editing) {
    return (
      <div className="rounded-xl p-5 mb-5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>✏️ Edit Goal</span>
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-3 py-1 rounded-lg"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold block mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-dim)' }}>
              90-Day Goal
            </label>
            <textarea
              value={editForm.goal_text}
              onChange={(e) => setEditForm({ ...editForm, goal_text: e.target.value })}
              rows={2}
              className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
              style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
            />
          </div>

          {[1, 2, 3].map((n) => (
            <div key={n}>
              <label className="text-xs font-semibold block mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--text-dim)' }}>
                Milestone {n}
              </label>
              <input
                value={(editForm as any)[`milestone_${n}`]}
                onChange={(e) => setEditForm({ ...editForm, [`milestone_${n}`]: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg"
                style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
              />
            </div>
          ))}

          <button
            onClick={saveEdit}
            disabled={saving || !editForm.goal_text.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // ── Display mode ──
  return (
    <div className="rounded-xl p-5 mb-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> 90-Day Goal</span>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: progress >= 100 ? 'rgba(16,185,129,0.09)' : 'rgba(20,184,166,0.09)',
              color:      progress >= 100 ? 'var(--success)' : 'var(--teal)',
              border:     `1px solid ${progress >= 100 ? 'rgba(16,185,129,0.19)' : 'rgba(20,184,166,0.19)'}`,
            }}>
            {progress >= 100 ? '✓ Complete!' : `${progress}% complete`}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-dim)' }}
          >
            ✏️
          </button>
        </div>
      </div>

      <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{goal.goal_text}</p>

      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden mb-3.5" style={{ background: 'var(--bg-input)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width:      `${Math.min(100, progress)}%`,
            background: progress >= 100 ? 'var(--success)' : 'var(--teal)',
          }} />
      </div>

      {/* Milestones — clickable */}
      <div className="flex flex-col gap-2">
        {milestones.map((m, i) => (
          m.text && (
            <button key={i}
              onClick={() => toggleMilestone(m.key, m.complete)}
              className="flex items-center gap-2.5 text-left group"
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all"
                style={{
                  border:     `2px solid ${m.complete ? 'var(--success)' : 'var(--border)'}`,
                  background: m.complete ? 'var(--success)' : 'transparent',
                  color:      '#fff',
                }}>
                {m.complete ? '✓' : ''}
              </span>
              <span className="text-[13px] transition-all"
                style={{
                  color:           m.complete ? 'var(--success)' : 'var(--text-muted)',
                  textDecoration:  m.complete ? 'line-through' : 'none',
                }}>
                {m.text}
              </span>
            </button>
          )
        ))}
      </div>
    </div>
  );
}
