'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Milestone colors — progress through the brand palette as you complete them
const MILESTONE_COLORS = ['#A6A2FF', '#CFFF5E', '#FD81FD'];
const MILESTONE_GLOW   = ['rgba(166,162,255,0.12)', 'rgba(207,255,94,0.1)', 'rgba(253,129,253,0.1)'];

export default function GoalCard({ goal: initialGoal }: { goal: any }) {
  const [goal, setGoal] = useState(initialGoal);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    goal_text:   initialGoal?.goal_text   || '',
    milestone_1: initialGoal?.milestone_1 || '',
    milestone_2: initialGoal?.milestone_2 || '',
    milestone_3: initialGoal?.milestone_3 || '',
  });
  const supabase = createClient();

  if (!goal) return null;

  const progress = goal.progress || 0;
  const milestones = [
    { text: goal.milestone_1, complete: goal.milestone_1_complete, key: 'milestone_1_complete' },
    { text: goal.milestone_2, complete: goal.milestone_2_complete, key: 'milestone_2_complete' },
    { text: goal.milestone_3, complete: goal.milestone_3_complete, key: 'milestone_3_complete' },
  ];

  const toggleMilestone = async (key: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const updatedGoal = { ...goal, [key]: newValue };
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
      setGoal({ ...goal, ...editForm });
      setEditing(false);
    }
    setSaving(false);
  };

  // Progress bar gradient — blue → lime as you progress
  const progressGradient = progress >= 100
    ? 'linear-gradient(90deg, #6662FF, #CFFF5E)'
    : progress >= 66
    ? 'linear-gradient(90deg, #6662FF, #A6A2FF)'
    : 'linear-gradient(90deg, #6662FF, #8B87FF)';

  // ── Edit mode ──
  if (editing) {
    return (
      <div style={{
        borderRadius: 16, padding: '20px', marginBottom: 20,
        background: 'var(--bg-card)',
        border: '1px solid rgba(102,98,255,0.35)',
        boxShadow: '0 0 0 4px rgba(102,98,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ✏️ Edit Goal
          </span>
          <button onClick={() => setEditing(false)} style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            color: 'var(--text-muted)', border: '1px solid var(--border)',
            background: 'transparent', fontFamily: 'Inter, sans-serif',
          }}>
            Cancel
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', display: 'block', marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>
              90-Day Goal
            </label>
            <textarea
              value={editForm.goal_text}
              onChange={e => setEditForm({ ...editForm, goal_text: e.target.value })}
              rows={2}
              style={{
                width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 9,
                background: 'var(--bg-input)', color: 'var(--text)',
                border: '1px solid var(--border)', outline: 'none', resize: 'none',
                fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#6662FF'; e.target.style.boxShadow = '0 0 0 3px rgba(102,98,255,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {[1, 2, 3].map(n => (
            <div key={n}>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: MILESTONE_COLORS[n - 1], display: 'block', marginBottom: 6, fontFamily: 'Inter, sans-serif' }}>
                Milestone {n}
              </label>
              <input
                value={(editForm as any)[`milestone_${n}`]}
                onChange={e => setEditForm({ ...editForm, [`milestone_${n}`]: e.target.value })}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 9,
                  background: 'var(--bg-input)', color: 'var(--text)',
                  border: `1px solid ${MILESTONE_COLORS[n - 1]}35`, outline: 'none',
                  fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = MILESTONE_COLORS[n - 1]; e.target.style.boxShadow = `0 0 0 3px ${MILESTONE_GLOW[n - 1]}`; }}
                onBlur={e => { e.target.style.borderColor = `${MILESTONE_COLORS[n - 1]}35`; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          ))}

          <button
            onClick={saveEdit}
            disabled={saving || !editForm.goal_text.trim()}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: '#6662FF', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              opacity: (saving || !editForm.goal_text.trim()) ? 0.45 : 1,
              boxShadow: '0 4px 16px rgba(102,98,255,0.35)',
              transition: 'opacity 0.18s',
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // ── Display mode ──
  return (
    <div style={{
      borderRadius: 16, padding: '20px', marginBottom: 20,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(102,98,255,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(102,98,255,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(102,98,255,0.12)', border: '1px solid rgba(102,98,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            🎯
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            90-Day Goal
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress badge — color changes with progress */}
          <span style={{
            padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            background: progress >= 100 ? 'rgba(207,255,94,0.12)' : progress >= 66 ? 'rgba(166,162,255,0.12)' : 'rgba(102,98,255,0.1)',
            color:      progress >= 100 ? '#CFFF5E'               : progress >= 66 ? '#A6A2FF'               : '#6662FF',
            border: `1px solid ${progress >= 100 ? 'rgba(207,255,94,0.25)' : progress >= 66 ? 'rgba(166,162,255,0.25)' : 'rgba(102,98,255,0.2)'}`,
          }}>
            {progress >= 100 ? '✓ Complete!' : `${progress}%`}
          </span>
          <button onClick={() => setEditing(true)} style={{
            background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: 14, padding: '2px 4px',
            borderRadius: 6, transition: 'color 0.18s',
          }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-dim)'; }}
          >
            ✏️
          </button>
        </div>
      </div>

      {/* Goal text */}
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14, fontFamily: 'Inter, sans-serif' }}>
        {goal.goal_text}
      </p>

      {/* Progress bar — gradient */}
      <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'var(--bg-input)', marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: progressGradient,
          width: `${Math.min(100, progress)}%`,
          transition: 'width 0.6s ease',
          boxShadow: progress > 0 ? '0 0 8px rgba(102,98,255,0.4)' : 'none',
        }} />
      </div>

      {/* Milestones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {milestones.map((m, i) =>
          m.text ? (
            <button
              key={i}
              onClick={() => toggleMilestone(m.key, m.complete)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: m.complete ? MILESTONE_GLOW[i] : 'transparent',
                border: `1px solid ${m.complete ? MILESTONE_COLORS[i] + '30' : 'transparent'}`,
                borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
                textAlign: 'left', width: '100%', transition: 'all 0.2s',
              }}
            >
              {/* Checkbox */}
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                border: `2px solid ${m.complete ? MILESTONE_COLORS[i] : 'var(--border)'}`,
                background: m.complete ? MILESTONE_COLORS[i] : 'transparent',
                color: m.complete ? (i === 1 || i === 2 ? '#0F0F14' : '#fff') : 'transparent',
              }}>
                {m.complete ? '✓' : ''}
              </span>
              <span style={{
                fontSize: 13, fontFamily: 'Inter, sans-serif', lineHeight: 1.4,
                color: m.complete ? MILESTONE_COLORS[i] : 'var(--text-muted)',
                textDecoration: m.complete ? 'line-through' : 'none',
                opacity: m.complete ? 0.8 : 1,
                transition: 'all 0.2s',
              }}>
                {m.text}
              </span>
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}
