'use client';

import { useState, useRef, useEffect } from 'react';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';

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
  const [limitReached, setLimitReached] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
    checkUsageLimit();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function checkUsageLimit() {
    try {
      const res = await fetch('/api/usage/check?feature=coachingSessions');
      if (res.ok) {
        const data = await res.json();
        setUsageInfo({ used: data.used, limit: data.limit });
        if (!data.allowed) {
          setLimitReached(true);
          analytics.coachingLimitReached();
        }
      }
    } catch {}
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/coach/history');
      const { sessions } = await res.json();

      if (sessions && sessions.length > 0) {
        const history: Message[] = [];
        for (const s of sessions) {
          history.push({ role: 'user', content: s.user_input });
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
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    setLoadingHistory(false);
  }

  const handleSend = async () => {
    if (!input.trim() || loading || limitReached) return;
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

      if (res.status === 429 || data.upgradeRequired) {
        setLimitReached(true);
        analytics.coachingLimitReached();
        setMessages((m) => [...m, {
          role: 'assistant',
          reflection: data.error || "You've reached your daily coaching session limit.",
          question: "Upgrade your plan to continue your coaching journey today.",
        }]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to contact coach');
      }

      analytics.coachingSessionStarted(sessionType);

      if (data.full_response) {
        setMessages((m) => [...m, {
          role: 'assistant',
          reflection: data.full_response.reflection,
          question: data.full_response.question,
          action: data.full_response.action,
        }]);
      } else if (data.response) {
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

      if (usageInfo) {
        const newUsed = usageInfo.used + 1;
        setUsageInfo({ ...usageInfo, used: newUsed });
        if (newUsed >= usageInfo.limit && usageInfo.limit !== -1) {
          setLimitReached(true);
        }
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
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(102,98,255,0.15)',
            borderTop: '3px solid #6662FF',
            animation: 'spin 0.9s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
            Loading your sessions...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Font injection for this page */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
      `}</style>

      <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 120px)', paddingTop: 16 }}>

        {/* Session Type Selector — only show when no messages */}
        {messages.length === 0 && (
          <div className="mb-5">
            <h2 className="text-2xl font-semibold mb-1"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: 'var(--text)',
                letterSpacing: '-0.03em',
                fontWeight: 800,
              }}>
              AI Leadership Coach
            </h2>
            <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
              Choose a session type to begin
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {SESSION_TYPES.map((t) => (
                <button key={t.id} onClick={() => setSessionType(t.id)}
                  className="rounded-xl p-3.5 text-left transition-all"
                  style={{
                    background: sessionType === t.id ? 'rgba(102,98,255,0.07)' : 'var(--bg-card)',
                    border: sessionType === t.id ? '1.5px solid #6662FF' : '1px solid var(--border)',
                    boxShadow: sessionType === t.id ? '0 0 0 3px rgba(102,98,255,0.1)' : 'none',
                  }}>
                  <span className="text-xl">{t.icon}</span>
                  <div className="text-[13px] font-semibold mt-1"
                    style={{
                      color: sessionType === t.id ? '#6662FF' : 'var(--text)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Usage counter */}
        {usageInfo && usageInfo.limit !== -1 && (
          <div className="mb-3 flex justify-end">
            <span className="text-[11px] px-2.5 py-1 rounded-full"
              style={{
                background: limitReached ? 'rgba(239,68,68,0.08)' : 'rgba(102,98,255,0.07)',
                color: limitReached ? 'var(--error, #EF4444)' : 'var(--text-dim)',
                border: `1px solid ${limitReached ? 'rgba(239,68,68,0.15)' : 'rgba(102,98,255,0.18)'}`,
                fontFamily: "'DM Sans', sans-serif",
              }}>
              {usageInfo.used}/{usageInfo.limit} sessions today
            </span>
          </div>
        )}

        {/* Limit reached banner */}
        {limitReached && (
          <div className="mb-4">
            <UpgradePrompt feature="coaching" compact />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-3">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div style={{
                width: 56, height: 56,
                background: 'rgba(102,98,255,0.1)',
                border: '1.5px solid rgba(102,98,255,0.25)',
                borderRadius: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 24,
              }}>
                ⬆
              </div>
              <p className="text-[15px] max-w-sm mx-auto"
                style={{ color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
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
                      background: 'rgba(102,98,255,0.1)',
                      border: '1px solid rgba(102,98,255,0.22)',
                      color: 'var(--text)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5 items-start">
                  {/* AI avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: 'linear-gradient(135deg, rgba(102,98,255,0.2), rgba(166,162,255,0.35))',
                      border: '1.5px solid rgba(102,98,255,0.35)',
                      color: '#6662FF',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 800,
                    }}>
                    A
                  </div>
                  <div className="max-w-[85%] flex flex-col gap-2">
                    {msg.reflection && (
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                        {msg.reflection}
                      </div>
                    )}
                    {msg.question && (
                      <div className="px-4 py-3 rounded-xl text-[15px] font-medium leading-relaxed"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid rgba(102,98,255,0.22)',
                          color: 'var(--text)',
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                        {msg.question}
                      </div>
                    )}
                    {msg.action && (
                      <div className="px-3.5 py-2.5 rounded-lg text-[13px] flex items-start gap-2"
                        style={{
                          background: 'rgba(102,98,255,0.07)',
                          border: '1px solid rgba(102,98,255,0.18)',
                          color: '#6662FF',
                          fontFamily: "'DM Sans', sans-serif",
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

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2.5 items-start mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(102,98,255,0.2), rgba(166,162,255,0.35))',
                  border: '1.5px solid rgba(102,98,255,0.35)',
                  color: '#6662FF',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                }}>
                A
              </div>
              <div className="px-4 py-3.5 rounded-2xl rounded-tl-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: '#A6A2FF',
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
            placeholder={limitReached ? "Daily session limit reached — upgrade for more" : "Share what's on your mind..."}
            rows={2}
            disabled={limitReached}
            className="flex-1 px-4 py-3 text-sm rounded-xl resize-none leading-relaxed disabled:opacity-50"
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              outline: 'none',
              transition: 'border-color 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(102,98,255,0.5)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || limitReached}
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-all disabled:opacity-40"
            style={{
              background: '#6662FF',
              color: '#fff',
              boxShadow: '0 2px 12px rgba(102,98,255,0.4)',
            }}>
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
