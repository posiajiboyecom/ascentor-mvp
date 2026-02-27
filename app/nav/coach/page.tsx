'use client';

import { useState, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · AI Coach Page
// All emojis replaced with SVG icons.
// Coach avatar uses the real Ascentor logomark (LM-gold).
// ─────────────────────────────────────────────────────────────────

// ── Session type icons ───────────────────────────────────────────
const IconCompass = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88 16.24,7.76"/>
  </svg>
);
const IconChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="12" y2="14"/>
  </svg>
);
const IconReflect = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9,11 12,14 22,4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IconPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconSend = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9 22,2"/>
  </svg>
);

// ── The real Ascentor logomark (LM-gold) inlined as SVG ──────────
// Used as the AI coach avatar throughout the chat
const AscentorMark = ({ size = 20 }: { size?: number }) => (
  <svg
    viewBox="0 0 134.34 101.16"
    width={size} height={size * (101.16 / 134.34)}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="#E8A020"
      d="M105.19,71.38H57l-2.73,6.11h53.63ZM83.83,23.62H78.37L58.82,67.39h44.59Zm-2.7,16.32,7.93,18.63H73.19Z"
    />
    <polygon fill="#E8A020" points="74.64 23.64 55.14 67.39 53.36 71.38 50.62 77.54 44.92 77.54 47.66 71.38 49.44 67.39 68.95 23.64 74.64 23.64"/>
    <polygon fill="#E8A020" points="65.42 23.64 41.39 77.54 35.69 77.54 59.72 23.64 65.42 23.64"/>
    <polygon fill="#E8A020" points="56.12 23.64 36.61 67.39 34.83 71.38 32.09 77.54 26.39 77.54 29.14 71.38 30.92 67.39 50.42 23.64 56.12 23.64"/>
  </svg>
);

const SESSION_TYPES = [
  { id: 'challenge_navigation',   label: 'Navigate a Challenge', icon: <IconCompass /> },
  { id: 'difficult_conversation', label: 'Prep a Conversation',  icon: <IconChat />    },
  { id: 'weekly_reflection',      label: 'Weekly Reflection',    icon: <IconReflect /> },
  { id: 'accountability_check',   label: 'Accountability Check', icon: <IconCheck />   },
];

type Message = {
  role: 'user' | 'assistant';
  content?: string;
  reflection?: string;
  question?: string;
  action?: string;
};

export default function CoachPage() {
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [sessionType,  setSessionType]  = useState('challenge_navigation');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res  = await fetch('/api/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: userMsg, sessionType }),
      });
      const data = await res.json();
      if (data.response) {
        setMessages((m) => [...m, {
          role:       'assistant',
          reflection: data.response.reflection,
          question:   data.response.question,
          action:     data.response.action,
        }]);
      }
    } catch {
      setMessages((m) => [...m, {
        role:       'assistant',
        reflection: "I'm here and ready to help you navigate your leadership journey.",
        question:   "What's the most pressing challenge you're facing at work right now?",
      }]);
    }
    setLoading(false);
  };

  // The circular coach avatar
  const CoachAvatar = () => (
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%',
      flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(232,160,32,0.15), rgba(232,160,32,0.28))',
      border: '1.5px solid rgba(232,160,32,0.40)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <AscentorMark size={18} />
    </div>
  );

  return (
    <div className="animate-fade-up flex flex-col" style={{ height: 'calc(100vh - 120px)', paddingTop: 16 }}>

      {/* ── Session Type Selector (only shown before conversation starts) ── */}
      {messages.length === 0 && (
        <div className="mb-5">
          <h2 className="text-2xl font-semibold mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            AI Leadership Coach
          </h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--text-muted)' }}>
            Choose a session type to begin
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {SESSION_TYPES.map((t) => {
              const active = sessionType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSessionType(t.id)}
                  className="rounded-xl p-3.5 text-left transition-all"
                  style={{
                    background: active ? 'rgba(232,160,32,0.07)' : 'var(--bg-card)',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  }}
                >
                  <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'var(--text-dim)' }}>
                    {t.icon}
                  </span>
                  <div className="text-[13px] font-medium mt-2"
                    style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>
                    {t.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Message Feed ── */}
      <div className="flex-1 overflow-y-auto mb-3 pr-0.5">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(232,160,32,0.10), rgba(232,160,32,0.22))',
              border: '1.5px solid rgba(232,160,32,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AscentorMark size={32} />
            </div>
            <p className="text-[15px] max-w-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Share what's on your mind — a challenge, a question, or a reflection on your week.
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className="mb-4" style={{ animationDelay: `${i * 0.05}s` }}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                  style={{
                    background: 'rgba(232,160,32,0.09)',
                    border: '1px solid rgba(232,160,32,0.20)',
                    color: 'var(--text)',
                  }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div className="flex gap-2.5 items-start">
                <CoachAvatar />
                <div className="max-w-[85%] flex flex-col gap-2">
                  {msg.reflection && (
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {msg.reflection}
                    </div>
                  )}
                  {msg.question && (
                    <div className="px-4 py-3 rounded-xl text-[15px] font-medium leading-relaxed"
                      style={{ background: 'var(--bg-card)', border: '1px solid rgba(232,160,32,0.25)', color: 'var(--text)' }}>
                      {msg.question}
                    </div>
                  )}
                  {msg.action && (
                    <div className="px-3.5 py-2.5 rounded-lg text-[13px] flex items-start gap-2"
                      style={{
                        background: 'rgba(232,160,32,0.06)',
                        border: '1px solid rgba(232,160,32,0.15)',
                        color: 'var(--accent)',
                      }}>
                      <span style={{ flexShrink: 0, marginTop: '1px' }}><IconPin /></span>
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
            <CoachAvatar />
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

      {/* ── Input Bar ── */}
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
          placeholder="Share what's on your mind..."
          rows={2}
          className="flex-1 px-4 py-3 text-sm rounded-xl resize-none leading-relaxed"
          style={{
            background: 'var(--bg-input)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            outline: 'none',
            fontFamily: "'Syne', system-ui, sans-serif",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0C0B08' }}
          aria-label="Send message"
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
}
