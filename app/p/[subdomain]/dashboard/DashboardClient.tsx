'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '18px 20px',
};

export default function DashboardClient({ profile, goal, sessionsThisWeek, commitments, nextExpert }: any) {
  const supabase = useRef(createClient()).current;
  const [localCommitments, setLocalCommitments] = useState(commitments);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [saving, setSaving] = useState(false);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const goalProgress = goal?.progress || 0;
  const doneCount = localCommitments.filter((c: any) => c.completed).length;

  const toggleCommitment = async (id: string, done: boolean) => {
    setLocalCommitments((prev: any[]) => prev.map((c: any) => c.id === id ? { ...c, completed: done } : c));
    await supabase.from('user_commitments').update({ completed: done, completed_at: done ? new Date().toISOString() : null }).eq('id', id);
  };

  const saveGoal = async () => {
    if (!goalText.trim() || !profile?.id) return;
    setSaving(true);
    await supabase.from('user_goals').insert({ user_id: profile.id, goal_text: goalText.trim(), progress: 0 });
    setSaving(false);
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 40px' }}>

      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.1 }}>
          Welcome, {firstName}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {profile?.current_role && <span>{profile.current_role}</span>}
          {profile?.current_role && profile?.goal_role && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          )}
          {profile?.goal_role && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{profile.goal_role}</span>}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A4.5 4.5 0 0 0 17 12c0-4-3.5-6.5-4-9-.5 2.5-3.5 5-3.5 5-1.5-2-2-4-2-4-1 2.5-2 5-2 7a6 6 0 0 0 6 6 4.5 4.5 0 0 0 4.5-4.5c0-1.5-.5-3-1.5-4z"/></svg>, value: String(sessionsThisWeek || 0), label: 'THIS WEEK', color: 'var(--accent)' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, value: String(sessionsThisWeek || 0), label: 'SESSIONS / WEEK', color: '#3B82F6' },
          { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, value: `${goalProgress}%`, label: '90-DAY GOAL', color: '#14B8A6' },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 12px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 6, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goal card */}
      {!goal ? (
        <div style={{ ...card, border: '1px dashed rgba(232,160,32,0.35)', marginBottom: 18 }}>
          {!showGoalInput ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'rgba(232,160,32,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>Set your 90-day goal</p>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Your mentor works best when it knows where you are headed.</p>
                </div>
              </div>
              <button onClick={() => setShowGoalInput(true)} style={{ padding: '9px 18px', borderRadius: 9, background: 'var(--accent)', color: '#000', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                Set Goal →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your 90-day goal</p>
              <input autoFocus value={goalText} onChange={e => setGoalText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveGoal()} placeholder="e.g. Get promoted to Senior Manager by Q3" style={{ background: 'var(--bg-input)', border: '1px solid rgba(232,160,32,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveGoal} disabled={!goalText.trim() || saving} style={{ padding: '9px 20px', borderRadius: 9, background: 'var(--accent)', color: '#000', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (!goalText.trim() || saving) ? 0.5 : 1 }}>{saving ? 'Saving...' : 'Save Goal'}</button>
                <button onClick={() => { setShowGoalInput(false); setGoalText(''); }} style={{ padding: '9px 16px', borderRadius: 9, background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, borderLeft: '3px solid var(--accent)', marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 6 }}>90-Day Goal</p>
          <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 12 }}>{goal.goal_text}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: goalProgress >= 100 ? '#10B981' : 'var(--accent)', width: `${Math.min(100, goalProgress)}%`, transition: 'width 0.7s ease' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'right', color: goalProgress >= 100 ? '#10B981' : 'var(--accent)' }}>{goalProgress}%</span>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        {[
          { href: '/coach', accent: true, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, title: 'AI Mentor', sub: 'Start a coaching session' },
          { href: '/experts', accent: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, title: 'Next Expert', sub: nextExpert ? new Date(nextExpert.scheduled_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) : 'Coming soon' },
        ].map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{ ...card, background: item.accent ? 'rgba(232,160,32,0.05)' : 'var(--bg-card)', border: `1px solid ${item.accent ? 'rgba(232,160,32,0.25)' : 'var(--border)'}`, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: item.accent ? 'rgba(232,160,32,0.10)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.accent ? 'var(--accent)' : 'var(--text-dim)' }}>{item.icon}</div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: item.accent ? 'var(--accent)' : 'var(--text)', marginBottom: 3 }}>{item.title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.sub}</p>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: item.accent ? 'var(--accent)' : 'var(--text-dim)', marginTop: 'auto', opacity: 0.6 }}>Open →</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Commitments */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
            Weekly Commitments
          </span>
          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.08)', color: '#10B981', border: '1px solid rgba(16,185,129,0.18)' }}>
            {doneCount}/{localCommitments.length}
          </span>
        </div>
        {localCommitments.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            No commitments yet.{' '}
            <Link href="/coach" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Start a coaching session</Link>
            {' '}to get your first action item.
          </p>
        ) : localCommitments.map((c: any, i: number) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < localCommitments.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <button onClick={() => toggleCommitment(c.id, !c.completed)} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `1.5px solid ${c.completed ? '#10B981' : 'var(--border)'}`, background: c.completed ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              {c.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <span style={{ flex: 1, fontSize: 13, color: c.completed ? 'var(--text-dim)' : 'var(--text)', textDecoration: c.completed ? 'line-through' : 'none' }}>{c.commitment_text}</span>
            {c.due_date && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(c.due_date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</span>}
          </div>
        ))}
      </div>

      {/* Upcoming Expert */}
      {nextExpert && (
        <Link href="/experts" style={{ textDecoration: 'none' }}>
          <div style={{ ...card, borderLeft: '3px solid #8B5CF6', cursor: 'pointer' }}>
            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(139,92,246,0.08)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.18)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Upcoming</span>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{nextExpert.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>with {nextExpert.expert_name} · {new Date(nextExpert.scheduled_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}</p>
          </div>
        </Link>
      )}

    </div>
  );
}
