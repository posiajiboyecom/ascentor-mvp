'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function Card({ children, className = '', style = {}, onClick }: any) {
  return (
    <div onClick={onClick}
      className={`rounded-xl p-5 transition-all ${onClick ? 'cursor-pointer hover:border-gray-600' : ''} ${className}`}
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

  return (
    <div className="animate-fade-up py-6">
      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          Welcome, {firstName} 👋
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {profile?.current_role || 'Your role'} → <span style={{ color: 'var(--accent)' }}>{profile?.goal_role || 'Your goal'}</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { icon: '🔥', value: '7', label: 'DAY STREAK', color: 'var(--accent)' },
          { icon: '💬', value: String(sessionsThisWeek), label: 'SESSIONS / WEEK', color: 'var(--blue)' },
          { icon: '🎯', value: `${goalProgress}%`, label: '90-DAY GOAL', color: 'var(--teal)' },
        ].map((s) => (
          <Card key={s.label} className="text-center !p-4">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: s.color }}>
              {s.value}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* 90-Day Goal */}
      {goal && (
        <Card className="mb-5">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>🎯 90-Day Goal</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(20,184,166,0.09)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.19)' }}>
              {goalProgress}% complete
            </span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>{goal.goal_text}</p>
          <ProgressBar value={goalProgress} />
          <div className="flex gap-4 mt-3.5">
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
          <Card className="hover:border-gray-600 cursor-pointer">
            <div className="text-2xl mb-2">💬</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Coach</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Start a session</div>
          </Card>
        </Link>
        <Link href="/experts">
          <Card className="hover:border-gray-600 cursor-pointer">
            <div className="text-2xl mb-2">🎓</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Next Expert</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {nextExpert ? new Date(nextExpert.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Coming soon'}
            </div>
          </Card>
        </Link>
      </div>

      {/* Commitments */}
      <Card className="mb-5">
        <div className="flex justify-between items-center mb-3.5">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>📋 Weekly Commitments</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
            {doneCount}/{localCommitments.length}
          </span>
        </div>
        {localCommitments.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No commitments yet. Start a coaching session to get your first action item.
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

      {/* Upcoming Expert */}
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
