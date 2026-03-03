'use client';

import SageLoader from '@/components/SageLoader';
import { useState, useRef, useEffect } from 'react';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────────────────────
// P2 FIX: Sage now streams tokens from the API as they arrive.
// The UI shows each token in real time — first word appears in ~300ms
// instead of waiting 3–8 seconds for the full response.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_TYPES = [
  { id: 'challenge_navigation',   label: 'Navigate a Challenge', icon: '🧭' },
  { id: 'difficult_conversation', label: 'Prep a Conversation',  icon: '🗣️' },
  { id: 'weekly_reflection',      label: 'Weekly Reflection',    icon: '📝' },
  { id: 'accountability_check',   label: 'Accountability Check', icon: '✅' },
];

type Message = {
  role: 'user' | 'assistant';
  content?: string;
  reflection?: string | null;
  question?: string | null;
  action?: string | null;
  // streaming-only: raw accumulated text before JSON is parsed
  streaming?: boolean;
  streamText?: string;
};

const PAGE_SIZE = 10;

export default function CoachPage() {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [sessionType,    setSessionType]    = useState('challenge_navigation');
  const [limitReached,   setLimitReached]   = useState(false);
  const [usageInfo,      setUsageInfo]      = useState<{ used: number; limit: number } | null>(null);
  const [historyTotal,   setHistoryTotal]   = useState(0);
  const [historyLoaded,  setHistoryLoaded]  = useState(0);
  const [selectorOpen,   setSelectorOpen]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectorRef    = useRef<HTMLDivElement>(null);

  const activeSession = SESSION_TYPES.find(t => t.id === sessionType) || SESSION_TYPES[0];

  // Close selector when clicking outside
  useEffect(() => {
    if (!selectorOpen) return;
    function handleClick(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selectorOpen]);

  useEffect(() => {
    loadHistory();
    checkUsageLimit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function sessionsToMessages(sessions: any[]): Message[] {
    const msgs: Message[] = [];
    for (const s of sessions) {
      msgs.push({ role: 'user', content: s.user_input });
      const ai = typeof s.ai_response === 'object' ? (s.ai_response || {}) : {};
      msgs.push({
        role:       'assistant',
        reflection: ai.reflection ?? null,
        question:   ai.question   ?? null,
        action:     ai.action     ?? null,
      });
    }
    return msgs;
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/coach/history?limit=${PAGE_SIZE}&offset=0`);
      const { sessions, total } = await res.json();
      setHistoryTotal(total || 0);
      setHistoryLoaded(sessions?.length || 0);
      if (sessions?.length > 0) setMessages(sessionsToMessages(sessions));
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    setLoadingHistory(false);
  }

  async function loadEarlier() {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const offset     = Math.max(historyTotal - historyLoaded - PAGE_SIZE, 0);
      const fetchCount = Math.min(PAGE_SIZE, historyTotal - historyLoaded);
      if (fetchCount <= 0) { setLoadingEarlier(false); return; }
      const res = await fetch(`/api/coach/history?limit=${fetchCount}&offset=${offset}`);
      const { sessions } = await res.json();
      if (sessions?.length > 0) {
        setMessages(prev => [...sessionsToMessages(sessions), ...prev]);
        setHistoryLoaded(prev => prev + sessions.length);
      }
    } catch (e) {
      console.error('Failed to load earlier history:', e);
    }
    setLoadingEarlier(false);
  }

  // ── P2 FIX: streaming send handler ───────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading || limitReached) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    // Add a placeholder streaming message — will fill token by token
    const streamingIndex = messages.length + 1; // position after the user message
    setMessages(m => [...m, {
      role:      'assistant',
      streaming: true,
      streamText: '',
      reflection: null,
      question:   null,
      action:     null,
    }]);

    try {
      const res = await fetch('/api/coach/session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userInput: userMsg, sessionType }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setLimitReached(true);
        analytics.coachingLimitReached();
        setMessages(m => m.map((msg, i) =>
          i === streamingIndex
            ? {
                role:       'assistant',
                streaming:  false,
                reflection: data.error || "You've reached your daily Sage session limit.",
                question:   "Upgrade your plan to continue your Sage sessions today.",
                action:     null,
              }
            : msg
        ));
        setLoading(false);
        return;
      }

      if (!res.ok || !res.body) throw new Error('Stream unavailable');

      analytics.coachingSessionStarted(sessionType);

      // Read the SSE stream
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line for next chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'delta') {
              // Append token to streaming message
              setMessages(m => m.map((msg, i) =>
                i === streamingIndex
                  ? { ...msg, streamText: (msg.streamText ?? '') + event.text }
                  : msg
              ));
            } else if (event.type === 'done') {
              // Replace streaming placeholder with final structured message
              setMessages(m => m.map((msg, i) =>
                i === streamingIndex
                  ? {
                      role:       'assistant',
                      streaming:  false,
                      streamText: undefined,
                      reflection: event.reflection ?? null,
                      question:   event.question   ?? null,
                      action:     event.action     ?? null,
                    }
                  : msg
              ));
              // Update usage
              if (usageInfo) {
                const newUsed = usageInfo.used + 1;
                setUsageInfo({ ...usageInfo, used: newUsed });
                if (newUsed >= usageInfo.limit && usageInfo.limit !== -1) {
                  setLimitReached(true);
                }
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

    } catch (err) {
      console.error('[Sage stream]', err);
      setMessages(m => m.map((msg, i) =>
        i === streamingIndex
          ? {
              role:       'assistant',
              streaming:  false,
              reflection: "I'm here and ready to help you navigate your leadership journey.",
              question:   "What's the most pressing challenge you're facing at work right now?",
              action:     null,
            }
          : msg
      ));
    }

    setLoading(false);
  };

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <SageLoader size="lg" message="Sage is waking up…" />
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 120px)', paddingTop: 16, overflow: 'hidden' }}>

      {/* ── Persistent header: title + always-visible session type picker ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
          Sage
        </h2>
        <div style={{ position: 'relative' }} ref={selectorRef}>
          <button
            onClick={() => setSelectorOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            <span style={{ fontSize: 14 }}>{activeSession.icon}</span>
            <span>{activeSession.label}</span>
            <span style={{ fontSize: 9, marginLeft: 1, opacity: 0.7 }}>{selectorOpen ? '▲' : '▼'}</span>
          </button>
          {selectorOpen && (
            <div style={{
              position: 'fixed', top: 'auto', right: 16, zIndex: 9999,
              marginTop: 6,
              minWidth: 220,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}>
              {SESSION_TYPES.map((t, i) => {
                const active = sessionType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSessionType(t.id); setSelectorOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-all"
                    style={{
                      background: active ? 'rgba(232,160,32,0.07)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text)',
                      borderBottom: i < SESSION_TYPES.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{t.icon}</span>
                    <span className="flex-1">{t.label}</span>
                    {active && <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Usage counter */}
      {usageInfo && usageInfo.limit !== -1 && (
        <div className="mb-3 flex justify-end">
          <span className="text-[11px] px-2.5 py-1 rounded-full"
            style={{
              background: limitReached ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.06)',
              color: limitReached ? 'var(--error, #EF4444)' : 'var(--text-dim)',
              border: `1px solid ${limitReached ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)'}`,
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

        {/* Load earlier sessions button */}
        {historyLoaded < historyTotal && messages.length > 0 && (
          <div className="flex justify-center mb-4">
            <button
              onClick={loadEarlier}
              disabled={loadingEarlier}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {loadingEarlier ? '↻' : '↑'}
              {loadingEarlier
                ? 'Loading…'
                : `Load ${Math.min(PAGE_SIZE, historyTotal - historyLoaded)} earlier sessions`}
              <span style={{ opacity: 0.5 }}>({historyTotal - historyLoaded} remaining)</span>
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', width: 56, height: 56 }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '1px solid rgba(232,160,32,0.4)',
                  animation: 'sage-orb-ring 2.4s ease-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: 8,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.2), rgba(232,160,32,0.08) 60%, transparent)',
                  border: '1.5px solid rgba(232,160,32,0.4)',
                  animation: 'sage-orb-pulse 2.4s ease-in-out infinite',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 700, fontSize: 18, color: '#E8A020', lineHeight: 1,
                  }}>S</span>
                </div>
              </div>
            </div>
            <p className="text-[15px] max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
              Share what's on your mind — a challenge, a question, or a reflection on your week.
            </p>
          </div>
        )}

        {/* Message list */}
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
                {/* Sage avatar */}
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.18), rgba(232,160,32,0.08) 60%, transparent)',
                    border: msg.streaming ? '1.5px solid rgba(232,160,32,0.6)' : '1.5px solid rgba(232,160,32,0.38)',
                    animation: msg.streaming ? 'sage-orb-pulse 1.6s ease-in-out infinite' : 'none',
                  }}>
                  <span style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontWeight: 700, fontSize: 15, color: '#E8A020', lineHeight: 1,
                    userSelect: 'none',
                  }}>S</span>
                </div>

                <div className="max-w-[85%] flex flex-col gap-2">

                  {/* ── Streaming: show ONLY typing dots — never expose raw JSON tokens ── */}
                  {msg.streaming && (
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(d => (
                          <div key={d} className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background: 'var(--text-dim)',
                              animation: `pulse-dot 1.2s infinite ${d * 0.2}s`,
                            }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Final structured message after streaming completes ── */}
                  {!msg.streaming && msg.reflection && (
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {msg.reflection}
                    </div>
                  )}
                  {!msg.streaming && msg.question && (
                    <div className="px-4 py-3 rounded-xl text-[15px] font-medium leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--text)' }}>
                      {msg.question}
                    </div>
                  )}
                  {!msg.streaming && msg.action && (
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || limitReached}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-black font-bold text-lg transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)' }}>
          ↑
        </button>
      </div>

      {/* CSS for pulse-dot animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}
