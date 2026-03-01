'use client';

import SageLoader from '@/components/SageLoader';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ExpertsPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [sessionsRes, regsRes] = await Promise.all([
        supabase
          .from('expert_sessions')
          .select('*')
          .in('status', ['scheduled', 'live'])
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('session_registrations')
          .select('session_id')
          .eq('user_id', user.id),
      ]);

      setExperts(sessionsRes.data || []);
      setRegistered(new Set(regsRes.data?.map((r: any) => r.session_id) || []));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRegister(sessionId: string, regUrl: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isCurrentlyReg = registered.has(sessionId);

    if (isCurrentlyReg) {
      // Unregister
      const { error } = await supabase
        .from('session_registrations')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (!error) {
        setRegistered((prev) => {
          const n = new Set(prev);
          n.delete(sessionId);
          return n;
        });
      }
    } else {
      // Register
      const { error } = await supabase
        .from('session_registrations')
        .insert({ session_id: sessionId, user_id: user.id });

      if (!error) {
        setRegistered((prev) => new Set([...prev, sessionId]));
        if (regUrl) window.open(regUrl, '_blank');
      }
    }
  }

  function isLive(s: string) {
    const t = new Date(s).getTime();
    const now = Date.now();
    // Live from 5 mins before start until 2 hours after
    return now >= t - 300000 && now <= t + 7200000;
  }

  function isToday(s: string) {
    return new Date(s).toDateString() === new Date().toDateString();
  }

  if (loading) {
    return (
      <SageLoader message="Loading sessions…" />
      <div style={{display:'none'}}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Expert Sessions
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Live workshops with Africa's top leaders
      </p>

      {experts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">🎓</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming sessions. Check back soon!</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {experts.map((expert, i) => {
          const date = new Date(expert.scheduled_at);
          const initials = expert.expert_name?.split(' ').map((n: string) => n[0]).join('') || '?';
          const isReg = registered.has(expert.id);
          const live = isLive(expert.scheduled_at);
          const today = isToday(expert.scheduled_at);

          return (
            <div 
              key={expert.id} 
              className="rounded-xl p-5 transition-all" 
              style={{ 
                background: 'var(--bg-card)', 
                border: `1px solid ${live ? 'var(--error)' : 'var(--border)'}`,
                animationDelay: `${i * 0.1}s` 
              }}
            >
              {live && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold" style={{ color: 'var(--error)' }}>LIVE NOW</span>
                </div>
              )}
              
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))', border: '1.5px solid rgba(139,92,246,0.33)', color: 'var(--purple)' }}>
                  {initials}
                </div>

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
                    }}>
                      {live ? '🔴 Live' : today ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {expert.expert_bio && <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{expert.expert_bio}</p>}
                  
                  <div className="text-xs mt-3 mb-4" style={{ color: 'var(--text-dim)' }}>
                    📅 {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ⏰ {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {live && isReg ? (
                      <button 
                        onClick={() => window.open(expert.join_url, '_blank')}
                        className="px-5 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Join Live Session
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRegister(expert.id, expert.registration_url)} 
                        className="px-5 py-2 rounded-lg text-xs font-semibold transition-all" 
                        style={{ 
                          background: isReg ? 'transparent' : 'var(--accent)', 
                          color: isReg ? 'var(--text)' : '#000',
                          border: isReg ? '1px solid var(--border)' : 'none'
                        }}
                      >
                        {isReg ? 'Registered ✓' : 'Register Now'}
                      </button>
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