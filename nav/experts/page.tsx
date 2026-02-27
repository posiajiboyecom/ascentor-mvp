'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Fallback data if no expert sessions exist in DB yet
const FALLBACK_EXPERTS = [
  { id: '1', title: 'Breaking Through the Glass Ceiling in African Tech', expert_name: 'Amara Obi', expert_bio: '15+ years scaling engineering teams across West Africa', scheduled_at: new Date(Date.now() + 6 * 86400000).toISOString(), max_participants: 50, status: 'scheduled' },
  { id: '2', title: 'From IC to C-Suite: The Untold Playbook', expert_name: 'Kwame Asante', expert_bio: 'Built 3 companies from zero. Forbes Africa 30 Under 30.', scheduled_at: new Date(Date.now() + 13 * 86400000).toISOString(), max_participants: 50, status: 'scheduled' },
  { id: '3', title: 'Navigating Office Politics Without Losing Yourself', expert_name: 'Fatima Hassan', expert_bio: 'Led M-Pesa expansion across 7 countries', scheduled_at: new Date(Date.now() + 20 * 86400000).toISOString(), max_participants: 50, status: 'scheduled' },
];

const PAST_RECORDINGS = [
  { title: 'Building Executive Presence in Virtual Settings', speaker: 'Ngozi Adeola', views: 234 },
  { title: 'The Art of Managing Up Without Losing Authenticity', speaker: 'Samuel Mensah', views: 187 },
];

export default function ExpertsPage() {
  const [experts, setExperts] = useState<any[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    loadExperts();
  }, []);

  async function loadExperts() {
    const { data } = await supabase
      .from('expert_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at');

    setExperts(data?.length ? data : FALLBACK_EXPERTS);
  }

  const toggleRegister = async (sessionId: string) => {
    const newSet = new Set(registered);
    if (newSet.has(sessionId)) {
      newSet.delete(sessionId);
    } else {
      newSet.add(sessionId);
    }
    setRegistered(newSet);
  };

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Expert Sessions
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Live workshops with Africa's top leaders
      </p>

      <div className="flex flex-col gap-4">
        {experts.map((expert, i) => {
          const date = new Date(expert.scheduled_at);
          const initials = expert.expert_name.split(' ').map((n: string) => n[0]).join('');
          const isRegistered = registered.has(expert.id);
          const spotsUsed = Math.floor(Math.random() * 30) + 10;

          return (
            <div key={expert.id}
              className="rounded-xl p-5 animate-fade-up"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.1}s` }}>
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
                        background: i === 0 ? 'rgba(16,185,129,0.09)' : 'rgba(59,130,246,0.09)',
                        color: i === 0 ? 'var(--success)' : 'var(--blue)',
                        border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.19)' : 'rgba(59,130,246,0.19)'}`,
                      }}>
                      {i === 0 ? 'This Week' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>{expert.expert_bio}</p>
                  <div className="flex justify-between items-center mt-3.5">
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      📅 {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 👥 {expert.max_participants - spotsUsed} spots left
                    </div>
                    <button
                      onClick={() => toggleRegister(expert.id)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: isRegistered ? 'transparent' : 'var(--accent)',
                        color: isRegistered ? 'var(--text)' : '#000',
                        border: isRegistered ? '1px solid var(--border)' : 'none',
                      }}>
                      {isRegistered ? '✓ Registered' : 'Register'}
                    </button>
                  </div>
                  {/* Capacity bar */}
                  <div className="w-full h-0.5 rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(spotsUsed / expert.max_participants) * 100}%`, background: 'var(--purple)' }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Past Recordings */}
      <h3 className="text-base font-semibold mt-8 mb-3.5" style={{ color: 'var(--text)' }}>📹 Past Recordings</h3>
      {PAST_RECORDINGS.map((r, i) => (
        <div key={i} className="rounded-xl p-3.5 mb-2.5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{r.title}</p>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>by {r.speaker} · {r.views} views</p>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              ▶ Watch
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
