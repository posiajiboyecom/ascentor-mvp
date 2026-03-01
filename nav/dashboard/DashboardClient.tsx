'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · Dashboard · SVG icons — no emojis
// ─────────────────────────────────────────────────────────────────

function Card({ children, className = '', style = {}, onClick }: any) {
  return (
    <div onClick={onClick}
      className={`rounded-xl p-5 transition-all ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', ...style }}>
      {children}
    </div>
  );
}

function ProgressBar({ value, color = 'var(--teal)' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, value)}%`, background: value >= 100 ? 'var(--success)' : color }} />
    </div>
  );
}

// ── SVG icon components ──────────────────────────────────────────
const IconFlame = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
);
const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconTarget = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);
const IconMentor = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8A020" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconExpert = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
  </svg>
);
const IconClipboard = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IconGoal = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);

export default function DashboardClient({ profile, goal, sessionsThisWeek, commitments, nextExpert }: any) {
  const supabase = createClient();
  const [localCommitments, setLocalCommitments] = useState(commitments);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const goalProgress = goal?.progress || 0;

  const toggleCommitment = async (id: string, done: boolean) => {
    setLocalCommitments((prev: any[]) =>
      prev.map((c: any) => c.id === id ? { ...c, completed: done } : c)
    );
    await supabase.from('user_commitments').update({
      completed: done,
      completed_at: done ? new Date().toISOString() : null,
    }).eq('id', id);
  };

  const doneCount = localCommitments.filter((c: any) => c.completed).length;

  const stats = [
    { icon: <IconFlame />,  value: '7',                  label: 'DAY STREAK',      color: 'var(--accent)' },
    { icon: <IconChat />,   value: String(sessionsThisWeek), label: 'MENTOR SESSIONS', color: 'var(--blue)' },
    { icon: <IconTarget />, value: `${goalProgress}%`,   label: '90-DAY GOAL',     color: 'var(--teal)' },
  ];

  return (
    <div className="animate-fade-up py-6">

      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold mb-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
          Welcome back, {firstName}.
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {profile?.current_role || 'Your role'} → <span style={{ color: 'var(--accent)' }}>{profile?.goal_role || 'Your goal'}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="text-center !p-4">
            <div className="flex justify-center mb-2">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
              {s.label}
            </div>
          </Card>
        ))}
      </div>

      {/* 90-Day Goal */}
      {goal && (
        <Card className="mb-5">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
              <IconGoal /> 90-Day Goal
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(20,184,166,0.09)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.19)' }}>
              {goalProgress}% complete
            </span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{goal.goal_text}</p>
          <ProgressBar value={goalProgress} />
          <div className="flex gap-4 mt-3.5 flex-wrap">
            {[goal.milestone_1, goal.milestone_2, goal.milestone_3].map((m: string, i: number) => (
              m && (
                <div key={i} className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: i === 0 ? 'var(--success)' : 'var(--text-dim)' }}>
                  <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]"
                    style={{ border: `1.5px solid ${i === 0 ? 'var(--success)' : 'var(--border)'}` }}>
                    {i === 0 ? '✓' : ''}
                  </span>
                  {m}
                </div>
              )
            ))}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link href="/coach">
          <Card className="cursor-pointer hover:border-[rgba(232,160,32,0.3)] transition-colors">
            <div className="flex justify-center mb-2"><IconMentor /></div>
            <div className="text-sm font-semibold text-center" style={{ color: 'var(--text)' }}>AI Mentor</div>
            <div className="text-xs mt-0.5 text-center" style={{ color: 'var(--text-muted)' }}>Start a session</div>
          </Card>
        </Link>
        <Link href="/experts">
          <Card className="cursor-pointer hover:border-[rgba(139,92,246,0.3)] transition-colors">
            <div className="flex justify-center mb-2"><IconExpert /></div>
            <div className="text-sm font-semibold text-center" style={{ color: 'var(--text)' }}>Next Session</div>
            <div className="text-xs mt-0.5 text-center" style={{ color: 'var(--text-muted)' }}>
              {nextExpert
                ? new Date(nextExpert.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Coming soon'}
            </div>
          </Card>
        </Link>
      </div>

      {/* Commitments */}
      <Card className="mb-5">
        <div className="flex justify-between items-center mb-3.5">
          <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <IconClipboard /> Weekly Commitments
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
            {doneCount}/{localCommitments.length}
          </span>
        </div>
        {localCommitments.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No commitments yet. Start a mentor session to get your first action item.
          </p>
        ) : (
          localCommitments.map((c: any) => (
            <div key={c.id} className="flex items-center gap-2.5 py-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <button
                onClick={() => toggleCommitment(c.id, !c.completed)}
                className="w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] shrink-0 transition-all"
                style={{
                  border: `1.5px solid ${c.completed ? 'var(--success)' : 'var(--border)'}`,
                  background: c.completed ? 'var(--success)' : 'transparent',
                  color: '#fff',
                }}>
                {c.completed && '✓'}
              </button>
              <span className="flex-1 text-[13px]"
                style={{
                  color: c.completed ? 'var(--text-dim)' : 'var(--text)',
                  textDecoration: c.completed ? 'line-through' : 'none',
                }}>
                {c.commitment_text}
              </span>
              {c.due_date && (
                <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {new Date(c.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Upcoming Mentor Session */}
      {nextExpert && (
        <Link href="/experts">
          <Card style={{ borderLeft: '3px solid var(--purple)' }}>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: 'rgba(139,92,246,0.09)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.19)' }}>
              UPCOMING
            </span>
            <h3 className="text-[15px] font-semibold mt-2" style={{ color: 'var(--text)' }}>
              {nextExpert.title}
            </h3>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
              with {nextExpert.expert_name} · {new Date(nextExpert.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </Card>
        </Link>
      )}
    </div>
  );
}
