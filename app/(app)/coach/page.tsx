'use client';

// app/(app)/coach/page.tsx — Option A
// ─────────────────────────────────────────────────────────────────────────────
// Design: Starter cards + inline commitment tracking
// - Empty state: Sage avatar + 4 quick-start prompt cards
// - Session type: persistent scrollable tab strip above chat
// - Mid-session: action items appear as checkable commitments below chat
// - Commitment checklist persists across messages in the same session
// ─────────────────────────────────────────────────────────────────────────────

import SageLoader from '@/components/SageLoader';
import { useState, useRef, useEffect, useCallback } from 'react';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';
import { SESSION_TYPES, getAvailableSessionTypes } from '@/lib/session-types';

type Message = {
  role: 'user' | 'assistant';
  content?: string;
  reflection?: string | null;
  question?: string | null;
  action?: string | null;
  streaming?: boolean;
};

type Commitment = {
  id: string;
  text: string;
  done: boolean;
  sessionType: string;
};

const PAGE_SIZE = 10;

// ── Starter prompts — one per session type shown in empty state ──────────────
const STARTERS = [
  {
    sessionType: 'challenge_navigation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    title: 'Navigate a challenge',
    subtitle: 'Work through a specific obstacle at work',
    prompt: "I'm facing a challenge I'd like to work through with you.",
  },
  {
    sessionType: 'weekly_reflection',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
    title: 'Weekly reflection',
    subtitle: 'Extract learning and set intentions for the week',
    prompt: "I'd like to do a weekly reflection with you.",
  },
  {
    sessionType: 'difficult_conversation',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Prep a conversation',
    subtitle: 'Prepare for a hard conversation at work',
    prompt: "I need help preparing for a difficult conversation.",
  },
  {
    sessionType: 'accountability_check',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
    title: 'Accountability check',
    subtitle: 'Review commitments and celebrate progress',
    prompt: "I want to do an accountability check on my commitments.",
  },
];

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
  const [userPlan,       setUserPlan]       = useState<string>('free');
  const [commitments,    setCommitments]    = useState<Commitment[]>([]);

  const streamingIndexRef = useRef<number>(-1);
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const tabsRef           = useRef<HTMLDivElement>(null);

  // ── iOS Safari keyboard: shift entire layout up when keyboard opens ──────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onVVResize() {
      const offset = window.innerHeight - vv!.height - vv!.offsetTop;
      document.documentElement.style.setProperty('--coach-vv-offset', `${Math.max(0, offset)}px`);
    }
    vv.addEventListener('resize', onVVResize);
    vv.addEventListener('scroll', onVVResize);
    onVVResize();
    return () => { vv.removeEventListener('resize', onVVResize); vv.removeEventListener('scroll', onVVResize); };
  }, []);

  const availableTypes = getAvailableSessionTypes(userPlan);
  const activeSession  = availableTypes.find(t => t.id === sessionType) ?? availableTypes[0];
  const isEmpty        = messages.length === 0 && !loading;

  // Scroll active tab into view when sessionType changes
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('.tab-active');
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [sessionType]);

  useEffect(() => {
    loadHistory();
    checkUsageLimit();
  }, []); // eslint-disable-line

  useEffect(() => {
    (() => { const el = messagesEndRef.current?.parentElement; if (el) el.scrollTop = el.scrollHeight; })();
  }, [messages, loading]);

  async function checkUsageLimit() {
    try {
      const res = await fetch('/api/usage/check?feature=coachingSessions');
      if (res.ok) {
        const data = await res.json();
        setUsageInfo({ used: data.used, limit: data.limit });
        if (data.plan) setUserPlan(data.plan);
        if (!data.allowed) { setLimitReached(true); analytics.coachingLimitReached(); }
      }
    } catch {}
  }

  function sessionsToMessages(sessions: any[]): Message[] {
    const msgs: Message[] = [];
    for (const s of sessions) {
      msgs.push({ role: 'user', content: s.user_input });
      const ai = typeof s.ai_response === 'object' ? (s.ai_response || {}) : {};
      msgs.push({ role: 'assistant', reflection: ai.reflection ?? null, question: ai.question ?? null, action: ai.action ?? null });
    }
    return msgs;
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/coach/history?limit=${PAGE_SIZE}&offset=0`);
      const { sessions, total } = await res.json();
      setHistoryTotal(total || 0);
      setHistoryLoaded(sessions?.length || 0);
      if (sessions?.length > 0) {
        const msgs = sessionsToMessages(sessions);
        setMessages(msgs);
        // Restore commitments from history
        const actions = msgs
          .filter(m => m.role === 'assistant' && m.action)
          .map((m, i) => ({ id: `hist-${i}`, text: m.action!, done: false, sessionType: 'challenge_navigation' }));
        setCommitments(actions.slice(-5)); // keep last 5
      }
    } catch (e) { console.error('Failed to load history:', e); }
    setLoadingHistory(false);
  }

  async function loadEarlier() {
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const offset = Math.max(historyTotal - historyLoaded - PAGE_SIZE, 0);
      const fetchCount = Math.min(PAGE_SIZE, historyTotal - historyLoaded);
      if (fetchCount <= 0) { setLoadingEarlier(false); return; }
      const res = await fetch(`/api/coach/history?limit=${fetchCount}&offset=${offset}`);
      const { sessions } = await res.json();
      if (sessions?.length > 0) {
        setMessages(prev => [...sessionsToMessages(sessions), ...prev]);
        setHistoryLoaded(prev => prev + sessions.length);
      }
    } catch (e) { console.error('Failed to load earlier:', e); }
    setLoadingEarlier(false);
  }

  const handleSend = useCallback(async (overrideInput?: string) => {
    const userMsg = (overrideInput ?? input).trim();
    if (!userMsg || loading || limitReached) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    const userMessageCount = messages.filter(m => m.role === 'user').length;

    setMessages(prev => {
      const next = [
        ...prev,
        { role: 'user' as const, content: userMsg },
        { role: 'assistant' as const, streaming: true, reflection: null, question: null, action: null },
      ];
      streamingIndexRef.current = next.length - 1;
      return next;
    });

    try {
      const res = await fetch('/api/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: userMsg,
          sessionType,
          messageCount: userMessageCount,
          conversationHistory: messages
            .filter(m => !m.streaming)
            .map(m => ({
              role: m.role,
              content: m.role === 'user'
                ? m.content ?? ''
                : [m.reflection, m.question, m.action].filter(Boolean).join(' | '),
            }))
            .slice(-20),
        }),
      });

      if (res.status === 429) {
        const data = await res.json();
        analytics.coachingLimitReached();
        const isSessionCap = data.sessionLimitReached;
        setMessages(m => m.map((msg, i) =>
          i === streamingIndexRef.current
            ? { role: 'assistant', streaming: false, reflection: data.error || "You've reached your session limit.", question: isSessionCap ? "This conversation has reached its message limit. Start a new session to continue." : "Upgrade your plan to continue your Sage sessions this month.", action: null }
            : msg
        ));
        if (!isSessionCap) setLimitReached(true);
        setLoading(false);
        return;
      }

      if (!res.ok || !res.body) throw new Error('Stream unavailable');
      analytics.coachingSessionStarted(sessionType);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'done') {
              setMessages(m => m.map((msg, i) =>
                i === streamingIndexRef.current
                  ? { role: 'assistant', streaming: false, reflection: event.reflection ?? null, question: event.question ?? null, action: event.action ?? null }
                  : msg
              ));
              // Add action as a commitment if present
              if (event.action) {
                const newCommit: Commitment = {
                  id: `c-${Date.now()}`,
                  text: event.action,
                  done: false,
                  sessionType,
                };
                setCommitments(prev => [...prev.slice(-4), newCommit]);
              }
              if (usageInfo) {
                const newUsed = usageInfo.used + 1;
                setUsageInfo({ ...usageInfo, used: newUsed });
                if (newUsed >= usageInfo.limit && usageInfo.limit !== -1) setLimitReached(true);
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      console.error('[Sage stream]', err);
      setMessages(m => m.map((msg, i) =>
        i === streamingIndexRef.current
          ? { role: 'assistant', streaming: false, reflection: "I'm here and ready to help you navigate your leadership journey.", question: "What's the most pressing challenge you're facing right now?", action: null }
          : msg
      ));
    }
    setLoading(false);
  }, [input, loading, limitReached, messages, sessionType, usageInfo]);

  function toggleCommitment(id: string) {
    setCommitments(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));
  }
  function removeCommitment(id: string) {
    setCommitments(prev => prev.filter(c => c.id !== id));
  }

  if (loadingHistory) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <SageLoader size="lg" message="Sage is waking up..." />
      </div>
    );
  }

  const G = '#E8A020';
  const Gdim = 'rgba(232,160,32,0.12)';
  const Gborder = 'rgba(232,160,32,0.25)';

  return (
    <div style={{
      position: 'fixed',
      top: 64,
      bottom: 72,
      left: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transform: 'translateY(calc(-1 * var(--coach-vv-offset, 0px)))',
    }}>
    {/* Inner centering wrapper */}
    <div style={{
      display: 'flex', flexDirection: 'column',
      maxWidth: 680, width: '100%',
      margin: '0 auto',
      flex: 1, minHeight: 0, overflow: 'hidden',
      padding: '0 16px',
    }}>
      <style>{`
        @keyframes sage-pulse { 0%,100%{opacity:.6;transform:scale(.95)} 50%{opacity:1;transform:scale(1)} }
        @keyframes dot-bounce { 0%,80%,100%{transform:translateY(0);opacity:.35} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes slide-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }

        .sage-scroll::-webkit-scrollbar { display: none; }
        .sage-scroll { scrollbar-width: none; }

        /* Sage chat background — subtle geometric pattern, theme-aware */
        .sage-chat-bg {
          background-color: #EAE6DF;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23000' stroke-width='0.5' opacity='0.06'%3E%3Ccircle cx='40' cy='40' r='28'/%3E%3Ccircle cx='40' cy='40' r='16'/%3E%3Ccircle cx='40' cy='40' r='5'/%3E%3Cline x1='12' y1='40' x2='68' y2='40'/%3E%3Cline x1='40' y1='12' x2='40' y2='68'/%3E%3Cline x1='20' y1='20' x2='60' y2='60'/%3E%3Cline x1='60' y1='20' x2='20' y2='60'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 80px 80px;
        }
        [data-app-theme='dark'] .sage-chat-bg {
          background-color: #0b141a;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23fff' stroke-width='0.5' opacity='0.04'%3E%3Ccircle cx='40' cy='40' r='28'/%3E%3Ccircle cx='40' cy='40' r='16'/%3E%3Ccircle cx='40' cy='40' r='5'/%3E%3Cline x1='12' y1='40' x2='68' y2='40'/%3E%3Cline x1='40' y1='12' x2='40' y2='68'/%3E%3Cline x1='20' y1='20' x2='60' y2='60'/%3E%3Cline x1='60' y1='20' x2='20' y2='60'/%3E%3C/g%3E%3C/svg%3E");
        }
        [data-app-theme='light'] .sage-chat-bg {
          background-color: #EAE6DF;
        }

        .tab-btn {
          flex-shrink: 0; white-space: nowrap;
          padding: 6px 14px; border-radius: 100px;
          border: 1px solid transparent;
          font-size: 12px; font-family: 'DM Mono', monospace;
          cursor: pointer; transition: all 0.15s;
          background: transparent; color: var(--text-muted);
        }
        .tab-btn:hover { background: var(--bg-input); color: var(--text); }
        .tab-active {
          background: ${Gdim} !important;
          border-color: ${Gborder} !important;
          color: ${G} !important;
        }
        .tab-locked { opacity: 0.45; cursor: default; }

        .starter-card {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer; transition: all 0.15s;
          text-align: left; width: 100%;
        }
        .starter-card:hover {
          border-color: ${Gborder};
          background: ${Gdim};
        }
        .starter-card:hover .starter-icon { color: ${G}; }

        .commit-row {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 8px 0;
          border-bottom: 0.5px solid var(--border);
          animation: fade-in 0.2s ease;
        }
        .commit-row:last-child { border-bottom: none; }

        .check-box {
          width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; margin-top: 1px;
        }
        .check-box.checked {
          background: ${G};
          border-color: ${G};
        }

        .msg-animate { animation: slide-up 0.2s ease forwards; }

        .sage-input {
          flex: 1; resize: none; outline: none;
          background: transparent; border: none;
          font-family: 'Syne', sans-serif; font-size: 14px;
          color: var(--text); line-height: 1.55;
          min-height: 22px; max-height: 120px; padding: 0;
          overflow: hidden;
        }
        .sage-input::placeholder { color: var(--text-dim, #888); }
      `}</style>

      {/* ── SESSION TYPE TABS ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 14, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            Sage
          </h2>
          {usageInfo && usageInfo.limit !== -1 && (
            <span style={{
              fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em',
              padding: '3px 9px', borderRadius: 100,
              background: limitReached ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
              border: `1px solid ${limitReached ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
              color: limitReached ? '#EF4444' : 'var(--text-dim)',
            }}>
              {usageInfo.used}/{usageInfo.limit} sessions
            </span>
          )}
        </div>

        {/* Tab strip */}
        <div ref={tabsRef} className="sage-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {SESSION_TYPES.map(t => {
            const available = availableTypes.some(a => a.id === t.id);
            const active = sessionType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => available && setSessionType(t.id)}
                className={`tab-btn ${active ? 'tab-active' : ''} ${!available ? 'tab-locked' : ''}`}
              >
                {t.label}
                {!available && (
                  <span style={{ marginLeft: 5, fontSize: 9, color: G, fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>
                    {t.tier === 'builder' ? 'Builder' : 'Climber'}+
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {limitReached && (
        <div style={{ flexShrink: 0, marginBottom: 10 }}>
          <UpgradePrompt feature="coaching" compact />
        </div>
      )}

      {/* ── MESSAGE AREA ──────────────────────────────────────────────────── */}
      <div className="sage-scroll sage-chat-bg" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* Load earlier */}
        {historyLoaded < historyTotal && messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button
              onClick={loadEarlier}
              disabled={loadingEarlier}
              style={{
                padding: '6px 16px', borderRadius: 100, fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                opacity: loadingEarlier ? 0.5 : 1,
              }}
            >
              {loadingEarlier ? 'Loading...' : `↑ Load ${Math.min(PAGE_SIZE, historyTotal - historyLoaded)} earlier`}
            </button>
          </div>
        )}

        {/* ── EMPTY STATE ───────────────────────────────────────────────── */}
        {isEmpty && (
          <div style={{ animation: 'fade-in 0.3s ease' }}>
            {/* Sage orb */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, paddingBottom: 24 }}>
              <div style={{ position: 'relative', width: 60, height: 60, marginBottom: 14 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${Gborder}`, animation: 'sage-pulse 2.4s ease-in-out infinite' }} />
                <div style={{
                  position: 'absolute', inset: 8, borderRadius: '50%',
                  background: Gdim, border: `1.5px solid ${Gborder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 20, color: G, lineHeight: 1 }}>S</span>
                </div>
              </div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
                What are we working on?
              </p>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                Choose a session below, or just start typing what's on your mind.
              </p>
            </div>

            {/* Starter cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 20 }}>
              {STARTERS.map(s => {
                const available = availableTypes.some(a => a.id === s.sessionType);
                return (
                  <button
                    key={s.sessionType}
                    className="starter-card"
                    onClick={() => {
                      if (!available) return;
                      setSessionType(s.sessionType);
                      handleSend(s.prompt);
                    }}
                    style={{ opacity: available ? 1 : 0.5 }}
                  >
                    <div className="starter-icon" style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1, transition: 'color 0.15s' }}>
                      {s.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2, lineHeight: 1.3 }}>
                        {s.title}
                      </div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {s.subtitle}
                      </div>
                    </div>
                    {!available && (
                      <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: "'DM Mono', monospace", color: G, background: Gdim, border: `1px solid ${Gborder}`, borderRadius: 4, padding: '2px 6px', flexShrink: 0, alignSelf: 'flex-start' }}>
                        PAID
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MESSAGES ─────────────────────────────────────────────────── */}
        {messages.map((msg, i) => (
          <div key={i} className="msg-animate" style={{ marginBottom: 16, animationDelay: `${Math.min(i * 0.01, 0.15)}s` }}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 16px',
                  borderRadius: '18px 18px 4px 18px',
                  background: Gdim, border: `1px solid ${Gborder}`,
                  fontFamily: "'Syne', sans-serif", fontSize: 14,
                  color: 'var(--text)', lineHeight: 1.6,
                }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: Gdim, border: `1.5px solid ${msg.streaming ? G : Gborder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: msg.streaming ? 'sage-pulse 1.4s ease-in-out infinite' : 'none',
                }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, fontSize: 15, color: G, lineHeight: 1, userSelect: 'none' }}>S</span>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Streaming dots */}
                  {msg.streaming && (
                    <div style={{ padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      {[0, 1, 2].map(d => (
                        <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: G, opacity: 0.35, animation: `dot-bounce 1.2s infinite ${d * 0.18}s` }} />
                      ))}
                    </div>
                  )}

                  {/* Reflection */}
                  {!msg.streaming && msg.reflection && (
                    <div style={{ padding: '10px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', fontFamily: "'Syne', sans-serif", fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                      {msg.reflection}
                    </div>
                  )}

                  {/* Question */}
                  {!msg.streaming && msg.question && (
                    <div style={{ padding: '11px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-card)', border: `1px solid ${Gborder}`, fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.6 }}>
                      {msg.question}
                    </div>
                  )}

                  {/* Action */}
                  {!msg.streaming && msg.action && (
                    <div style={{ padding: '9px 14px', borderRadius: '10px', background: Gdim, border: `1px solid ${Gborder}`, fontFamily: "'Syne', sans-serif", fontSize: 13, color: G, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span style={{ color: 'var(--text)' }}>{msg.action}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator (extra safety) */}
        {loading && messages.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <SageLoader size="sm" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── COMMITMENT CHECKLIST ──────────────────────────────────────────── */}
      {commitments.length > 0 && (
        <div style={{
          flexShrink: 0,
          margin: '10px 0 0',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: `1px solid ${Gborder}`,
          borderRadius: 14,
          animation: 'fade-in 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: G, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Your actions
              </span>
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
              {commitments.filter(c => c.done).length}/{commitments.length} done
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: G,
              width: `${commitments.length > 0 ? (commitments.filter(c => c.done).length / commitments.length) * 100 : 0}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>

          {commitments.map(c => (
            <div key={c.id} className="commit-row">
              <button
                className={`check-box ${c.done ? 'checked' : ''}`}
                onClick={() => toggleCommitment(c.id)}
                aria-label={c.done ? 'Mark incomplete' : 'Mark complete'}
              >
                {c.done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
              <span style={{
                flex: 1, fontFamily: "'Syne', sans-serif", fontSize: 13,
                color: c.done ? 'var(--text-dim)' : 'var(--text)',
                lineHeight: 1.5, textDecoration: c.done ? 'line-through' : 'none',
                transition: 'all 0.2s',
              }}>
                {c.text}
              </span>
              <button
                onClick={() => removeCommitment(c.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px 4px', lineHeight: 1, fontSize: 16, flexShrink: 0 }}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── INPUT BAR ─────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 8 }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 16, padding: '10px 12px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={limitReached ? 'Monthly limit reached — upgrade for more' : "Share what's on your mind..."}
            rows={1}
            disabled={limitReached}
            className="sage-input"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || limitReached}
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: (!input.trim() || loading || limitReached) ? 'var(--border)' : G,
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (!input.trim() || loading || limitReached) ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={(!input.trim() || loading || limitReached) ? 'var(--text-dim)' : '#0C0B08'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
