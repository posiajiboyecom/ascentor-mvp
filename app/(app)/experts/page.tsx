'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const FALLBACK_EXPERTS = [
  {
    id: '1',
    title: 'Breaking Through the Glass Ceiling in African Tech',
    expert_name: 'Amara Obi',
    expert_bio: '15+ years scaling engineering teams across West Africa',
    scheduled_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    max_participants: 50,
    status: 'scheduled',
    zoom_join_url: '',
    zoom_registration_url: '',
    recording_url: '',
  },
  {
    id: '2',
    title: 'From IC to C-Suite: The Untold Playbook',
    expert_name: 'Kwame Asante',
    expert_bio: 'Built 3 companies from zero. Forbes Africa 30 Under 30.',
    scheduled_at: new Date(Date.now() + 13 * 86400000).toISOString(),
    max_participants: 50,
    status: 'scheduled',
    zoom_join_url: '',
    zoom_registration_url: '',
    recording_url: '',
  },
  {
    id: '3',
    title: 'Navigating Office Politics Without Losing Yourself',
    expert_name: 'Fatima Hassan',
    expert_bio: 'Led M-Pesa expansion across 7 countries',
    scheduled_at: new Date(Date.now() + 20 * 86400000).toISOString(),
    max_participants: 50,
    status: 'scheduled',
    zoom_join_url: '',
    zoom_registration_url: '',
    recording_url: '',
  },
];

export default function ExpertsPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeWebinar, setActiveWebinar] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'recordings'>('upcoming');
  const [recordings, setRecordings] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load upcoming sessions
    const { data: sessions } = await supabase
      .from('expert_sessions')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at');

    // Load user registrations
    const { data: regs } = await supabase
      .from('session_registrations')
      .select('session_id')
      .eq('user_id', user.id);

    // Load past recordings
    const { data: pastSessions } = await supabase
      .from('expert_sessions')
      .select('*')
      .eq('status', 'completed')
      .not('recording_url', 'is', null)
      .order('scheduled_at', { ascending: false });

    setExperts(sessions?.length ? sessions : FALLBACK_EXPERTS);
    setRegistered(new Set(regs?.map((r: any) => r.session_id) || []));
    setRecordings(pastSessions || []);
    setLoading(false);
  }

  async function handleRegister(sessionId: string, zoomRegUrl: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (registered.has(sessionId)) {
      // Unregister
      await supabase.from('session_registrations')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', user.id);
      setRegistered((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    } else {
      // Register
      await supabase.from('session_registrations').insert({
        session_id: sessionId,
        user_id: user.id,
      });
      setRegistered((prev) => new Set([...prev, sessionId]));

      // Open Zoom registration if URL exists
      if (zoomRegUrl) {
        window.open(zoomRegUrl, '_blank');
      }
    }
  }

  function isLive(scheduledAt: string) {
    const start = new Date(scheduledAt).getTime();
    const now = Date.now();
    // Session is "live" from 5 min before start to 2 hours after
    return now >= start - 5 * 60000 && now <= start + 2 * 3600000;
  }

  function isToday(scheduledAt: string) {
    const d = new Date(scheduledAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Expert Sessions
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Live workshops with Africa's top leaders
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--bg-input)' }}>
        <button onClick={() => setTab('upcoming')}
          className="flex-1 py-2 rounded-md text-xs font-semibold transition-all"
          style={{
            background: tab === 'upcoming' ? 'var(--bg-card)' : 'transparent',
            color: tab === 'upcoming' ? 'var(--accent)' : 'var(--text-dim)',
          }}>
          Upcoming ({experts.length})
        </button>
        <button onClick={() => setTab('recordings')}
          className="flex-1 py-2 rounded-md text-xs font-semibold transition-all"
          style={{
            background: tab === 'recordings' ? 'var(--bg-card)' : 'transparent',
            color: tab === 'recordings' ? 'var(--accent)' : 'var(--text-dim)',
          }}>
          Recordings ({recordings.length})
        </button>
      </div>

      {/* Active Webinar Viewer */}
      {activeWebinar && (
        <div className="rounded-xl overflow-hidden mb-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}>
          <div className="flex justify-between items-center px-4 py-2"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Live Session</span>
            </div>
            <button onClick={() => setActiveWebinar(null)}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--text-dim)' }}>
              ✕ Close
            </button>
          </div>
          <div className="relative" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={activeWebinar}
              className="absolute inset-0 w-full h-full"
              allow="microphone; camera; fullscreen"
              style={{ border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Upcoming Sessions */}
      {tab === 'upcoming' && (
        <div className="flex flex-col gap-4">
          {experts.map((expert, i) => {
            const date = new Date(expert.scheduled_at);
            const initials = expert.expert_name.split(' ').map((n: string) => n[0]).join('');
            const isReg = registered.has(expert.id);
            const live = isLive(expert.scheduled_at);
            const today = isToday(expert.scheduled_at);

            return (
              <div key={expert.id}
                className="rounded-xl p-5 animate-fade-up"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${live ? 'var(--error)' : 'var(--border)'}`,
                  animationDelay: `${i * 0.1}s`,
                }}>

                {/* Live badge */}
                {live && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold" style={{ color: 'var(--error)' }}>LIVE NOW</span>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))',
                      border: '1.5px solid rgba(139,92,246,0.33)',
                      color: 'var(--purple)',
                    }}>
                    {initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{expert.title}</h3>
                        <p className="text-[13px]" style={{ color: 'var(--accent)' }}>{expert.expert_name}</p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          background: live ? 'rgba(239,68,68,0.09)' : today ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)',
                          color: live ? 'var(--error)' : today ? 'var(--success)' : 'var(--blue)',
                          border: `1px solid ${live ? 'rgba(239,68,68,0.19)' : today ? 'rgba(16,185,129,0.19)' : 'rgba(59,130,246,0.19)'}`,
                        }}>
                        {live ? '🔴 Live' : today ? 'Today' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{expert.expert_bio}</p>

                    <div className="text-xs mt-3 mb-3" style={{ color: 'var(--text-dim)' }}>
                      📅 {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ⏰ {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {live && isReg && expert.zoom_join_url ? (
                        <button onClick={() => window.open(expert.zoom_join_url, '_blank')}
                          className="px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          style={{ background: 'var(--error)', color: '#fff' }}>
                          🎥 Join Live Session
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegister(expert.id, expert.zoom_registration_url)}
                          className="px-5 py-2 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: isReg ? 'transparent' : 'var(--accent)',
                            color: isReg ? 'var(--text)' : '#000',
                            border: isReg ? '1px solid var(--border)' : 'none',
                          }}>
                          {isReg ? '✓ Registered' : 'Register'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recordings Tab */}
      {tab === 'recordings' && (
        <div className="flex flex-col gap-3">
          {recordings.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-3">📹</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recordings yet. Check back after upcoming sessions.</p>
            </div>
          ) : (
            recordings.map((rec, i) => (
              <div key={rec.id} className="rounded-xl overflow-hidden"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {/* Video embed */}
                {rec.recording_url && (
                  <div className="relative" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={rec.recording_url}
                      className="absolute inset-0 w-full h-full"
                      allow="fullscreen"
                      style={{ border: 'none' }}
                    />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{rec.title}</h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    by {rec.expert_name} · {new Date(rec.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
