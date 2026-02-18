'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ExpertsPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [sessionsRes, regsRes] = await Promise.all([
      supabase.from('expert_sessions').select('*').in('status', ['scheduled', 'live']).order('scheduled_at'),
      supabase.from('session_registrations').select('session_id').eq('user_id', user.id),
    ]);

    setExperts(sessionsRes.data || []);
    setRegistered(new Set(regsRes.data?.map((r: any) => r.session_id) || []));
    setLoading(false);
  }

  async function handleRegister(sessionId: string, regUrl: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (registered.has(sessionId)) {
      await supabase.from('session_registrations').delete().eq('session_id', sessionId).eq('user_id', user.id);
      setRegistered((prev) => { const n = new Set(prev); n.delete(sessionId); return n; });
    } else {
      await supabase.from('session_registrations').insert({ session_id: sessionId, user_id: user.id });
      setRegistered((prev) => new Set([...prev, sessionId]));
      if (regUrl) window.open(regUrl, '_blank');
    }
  }

  function isLive(s: string) { const t = new Date(s).getTime(); return Date.now() >= t - 300000 && Date.now() <= t + 7200000; }
  function isToday(s: string) { return new Date(s).toDateString() === new Date().toDateString(); }

  if (loading) {
    return (<div className="py-20 text-center"><div className="text-2xl mb-2">⏳</div><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions...</p></div>);
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>Expert Sessions</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Live workshops with Africa's top leaders</p>

      {experts.length === 0 && (
        <div className="text-center py-12"><div className="text-3xl mb-3">🎓</div><p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming sessions. Check back soon!</p></div>
      )}

      <div className="flex flex-col gap-4">
        {experts.map((expert, i) => {
          const date = new Date(expert.scheduled_at);
          const initials = expert.expert_name?.split(' ').map((n: string) => n[0]).join('') || '?';
          const isReg = registered.has(expert.id);
          const live = isLive(expert.scheduled_at);
          const today = isToday(expert.scheduled_at);

          return (
            <div key={expert.id} className="rounded-xl p-5 animate-fade-up" style={{ background: 'var(--bg-card)', border: `1px solid ${live ? 'var(--error)' : 'var(--border)'}`, animationDelay: `${i * 0.1}s` }}>
              {live && (<div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-xs font-bold" style={{ color: 'var(--error)' }}>LIVE NOW</span></div>)}
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))', border: '1.5px solid rgba(139,92,246,0.33)', color: 'var(--purple)' }}>{initials}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{expert.title}</h3>
                      <p className="text-[13px]" style={{ color: 'var(--accent)' }}>{expert.expert_name}</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{
                      background: live ? 'rgba(239,68,68,0.09)' : today ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)',
                      color: live ? 'var(--error)' : today ? 'var(--success)' : 'var(--blue)',
                      border: `1px solid ${live ? 'rgba(239,68,68,0.19)' : today ? 'rgba(16,185,129,0.19)' : 'rgba(59,130,246,0.19)'}`,
                    }}>{live ? '🔴 Live' : today ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  {expert.expert_bio && <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{expert.expert_bio}</p>}
                  {expert.description && <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>{expert.description}</p>}
                  <div className="text-xs mt-3 mb-3" style={{ color: 'var(--text-dim)' }}>
                    📅 {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ⏰ {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {live && isReg && expert.join_url ? (
                      <button onClick={() => window.open(expert.join_url, '_blank')} className="px-5 py-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--error)', color: '#fff' }}>🎥 Join Live Session</button>
                    ) : isReg ? (
                      <>
                        <button onClick={() => handleRegister(expert.id, null)} className="px-5 py-2 rounded-lg text-xs font-semibold transition-all" style={{ background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>✓ Registered</button>
                        {expert.join_url && <button onClick={() => window.open(expert.join_url, '_blank')} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.19)' }}>🔗 Meeting Link</button>}
                      </>
                    ) : (
                      <button onClick={() => handleRegister(expert.id, expert.registration_url)} className="px-5 py-2 rounded-lg text-xs font-semibold transition-all" style={{ background: 'var(--accent)', color: '#000' }}>Register</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}