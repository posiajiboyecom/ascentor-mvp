'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const SESSION_TYPES = [
  { id: 'challenge_navigation', label: 'Navigate a Challenge', icon: '🧭' },
  { id: 'difficult_conversation', label: 'Prep a Conversation', icon: '🗣️' },
  { id: 'weekly_reflection', label: 'Weekly Reflection', icon: '📝' },
  { id: 'accountability_check', label: 'Accountability Check', icon: '✅' },
];

type Message = {
  role: 'user' | 'assistant';
  content?: string;
  reflection?: string;
  question?: string;
  action?: string;
};

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionType, setSessionType] = useState('challenge_navigation');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load previous chat history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingHistory(false); return; }

    const { data: sessions } = await supabase
      .from('coaching_sessions')
      .select('user_input, ai_response, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (sessions && sessions.length > 0) {
      const history: Message[] = [];
      for (const s of sessions) {
        // User message
        history.push({ role: 'user', content: s.user_input });
        // AI response
        const ai = s.ai_response || {};
        history.push({
          role: 'assistant',
          reflection: ai.reflection || null,
          question: ai.question || null,
          action: ai.action || null,
        });
      }
      setMessages(history);
    }
    setLoadingHistory(false);
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: userMsg, sessionType }),
      });
      const data = await res.json();

      if (data.full_response) {
        setMessages((m) => [...m, {
          role: 'assistant',
          reflection: data.full_response.reflection,
          question: data.full_response.question,
          action: data.full_response.action,
        }]);
      } else if (data.response) {
        // Handle both response formats
        const resp = typeof data.response === 'string'
          ? { reflection: null, question: data.response, action: null }
          : data.response;
        setMessages((m) => [...m, {
          role: 'assistant',
          reflection: resp.reflection,
          question: resp.question,
          action: resp.action,
        }]);
      }
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        reflection: "I'm here and ready to help you navigate your leadership journey.",
        question: "What's the most pressing challenge you're facing at work right now?",
      }]);
    }

    setLoading(false);
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="text-center">
          <div className="text-3xl mb-3">⬆</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading your sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 120px)', paddingTop: 16 }}>
      {/* Session Type Selector — only show when no messages */}
      {messages.length === 0 && (
        <div className="mb-5">
          <h2 className="text-2xl font-semibold mb-1"
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
            AI Leadership Coach
          </h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
            Choose a session type to begin
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {SESSION_TYPES.map((t) => (
              <button key={t.id} onClick={() => setSessionType(t.id)}
                className="rounded-xl p-3.5 text-left transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: sessionType === t.id
                    ? '1.5px solid var(--accent)'
                    : '1px solid var(--border)',
                }}>
                <span className="text-xl">{t.icon}</span>
                <div className="text-[13px] font-medium mt-1"
                  style={{ color: sessionType === t.id ? 'var(--accent)' : 'var(--text)' }}>
                  {t.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-3">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">⬆</div>
            <p className="text-[15px] max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
              Share what's on your mind — a challenge, a question, or a reflection on your week.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="mb-4 animate-slide-in" style={{ animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                  style={{
                    background: 'rgba(245, 158, 11, 0.09)',
                    border: '1px solid rgba(245, 158, 11, 0.19)',
                    color: 'var(--text)',
                  }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 items-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.27))',
                    border: '1.5px solid rgba(245,158,11,0.33)',
                    color: 'var(--accent)',
                  }}>
                  ⬆
                </div>
                <div className="max-w-[85%] flex flex-col gap-2">
                  {msg.reflection && (
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {msg.reflection}
                    </div>
                  )}
                  {msg.question && (
                    <div className="px-4 py-3 rounded-xl text-[15px] font-medium leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text)' }}>
                      {msg.question}
                    </div>
                  )}
                  {msg.action && (
                    <div className="px-3.5 py-2.5 rounded-lg text-[13px] flex items-start gap-2"
                      style={{
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                        color: 'var(--accent)',
                      }}>
                      <span>📌</span>
                      <span>{msg.action}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.27))',
                border: '1.5px solid rgba(245,158,11,0.33)',
                color: 'var(--accent)',
              }}>
              ⬆
            </div>
            <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'var(--text-dim)',
                      animation: `pulse-dot 1.2s infinite ${d * 0.2}s`,
                    }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Share what's on your mind..."
          rows={2}
          className="flex-1 px-4 py-3 text-sm rounded-xl resize-none leading-relaxed"
          style={{
            background: 'var(--bg-input)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold text-lg transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)' }}>
          ↑
        </button>
      </div>
    </div>
  );
}
