'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminCoachingPage() {
  const supabase = createClient();

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  useEffect(() => { loadSessions(); }, [page]);

  async function loadSessions() {
    setLoading(true);

    const { data } = await supabase
      .from('coaching_sessions')
      .select(`
        id, user_input, ai_response, session_type, created_at, token_usage,
        profiles!coaching_sessions_user_id_fkey(full_name, current_role, industry)
      `)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    setSessions(data || []);
    setLoading(false);
  }

  if (loading && page === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading coaching data...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Coaching Data
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        All AI coaching conversations across users
      </p>

      {/* Sessions */}
      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const profile = s.profiles as any;
          const ai = s.ai_response || {};
          const isOpen = expanded === s.id;

          return (
            <div key={s.id} className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* Summary row — click to expand */}
              <button
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}>
                <div className="flex-1">
                  <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                    {s.user_input}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {profile?.full_name || 'Unknown'} · {profile?.current_role || ''} · {s.session_type}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {s.token_usage?.rag_used && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: 'rgba(20,184,166,0.09)', color: 'var(--teal)' }}>
                      RAG
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div className="px-4 py-3">
                  <div className="mb-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>User Message</label>
                    <p className="text-sm mt-1 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(245,158,11,0.06)', color: 'var(--text)', border: '1px solid rgba(245,158,11,0.15)' }}>
                      {s.user_input}
                    </p>
                  </div>

                  {ai.reflection && (
                    <div className="mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Reflection</label>
                      <p className="text-sm mt-1 px-3 py-2 rounded-lg"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                        {ai.reflection}
                      </p>
                    </div>
                  )}

                  {ai.question && (
                    <div className="mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Question</label>
                      <p className="text-sm mt-1 px-3 py-2 rounded-lg font-medium"
                        style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        {ai.question}
                      </p>
                    </div>
                  )}

                  {ai.action && (
                    <div className="mb-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Action Item</label>
                      <p className="text-sm mt-1 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(20,184,166,0.06)', color: 'var(--teal)', border: '1px solid rgba(20,184,166,0.15)' }}>
                        📌 {ai.action}
                      </p>
                    </div>
                  )}

                  {s.token_usage && (
                    <div className="flex gap-3 text-[10px] mt-2" style={{ color: 'var(--text-dim)' }}>
                      <span>Cost: ${s.token_usage.cost?.toFixed(4) || '—'}</span>
                      <span>RAG: {s.token_usage.rag_used ? `Yes (${s.token_usage.rag_chunks} chunks)` : 'No'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-3 mt-6">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
          className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-30"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          ← Previous
        </button>
        <span className="flex items-center text-xs" style={{ color: 'var(--text-dim)' }}>
          Page {page + 1}
        </span>
        <button onClick={() => setPage(page + 1)} disabled={sessions.length < PAGE_SIZE}
          className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-30"
          style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Next →
        </button>
      </div>
    </div>
  );
}
