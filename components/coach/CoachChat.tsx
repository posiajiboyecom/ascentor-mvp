'use client';

// components/coach/CoachChat.tsx
import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, Send } from 'lucide-react';
import { SESSION_TYPES, type SessionType } from '@/lib/session-types';
import { ChatMessage } from './ChatMessage';
import { SessionTypeTabs } from './SessionTypeTabs';
import { UsageBar } from './UsageBar';
import { CoachEmptyState } from './CoachEmptyState';
import { RecentSessionsPanel } from './RecentSessionsPanel';
import type { CoachMessage } from '@/types/coach';
import type { RecentSessionSummary } from '@/lib/supabase/queries/coach';

interface CoachChatProps {
  firstName: string;
  greeting: string;
  availableSessionTypes: SessionType[];
  recentSessions: RecentSessionSummary[];
  usedToday: number;
  dailyLimit: number;
}

export function CoachChat({
  firstName,
  greeting,
  availableSessionTypes,
  recentSessions,
  usedToday,
  dailyLimit,
}: CoachChatProps) {
  const availableTypeIds = new Set(availableSessionTypes.map((t) => t.id));

  const [activeTypeId, setActiveTypeId] = useState<string>(
    availableSessionTypes[0]?.id ?? SESSION_TYPES[0].id
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(usedToday);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const hasStarted = messages.length > 0;

  function startWithType(typeId: string) {
    setActiveTypeId(typeId);
    setSessionId(null);
    setMessages([]);
    setError(null);
  }

  async function resumeSession(id: string) {
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/history?sessionId=${id}`);
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json();
      setSessionId(data.sessionId);
      setActiveTypeId(data.sessionTypeId ?? activeTypeId);
      setMessages(data.messages ?? []);
    } catch {
      setError("Couldn't load that session. Please try again.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError(null);
    setDraft('');

    const optimisticUser: CoachMessage = {
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);

    try {
      const res = await fetch('/api/coach/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sessionTypeId: activeTypeId,
          message: trimmed,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      const isNewSession = !sessionId;
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, data.message]);
      if (isNewSession) setUsedCount((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      // Remove the optimistic user message since it never got a reply.
      setMessages((prev) => prev.filter((m) => m !== optimisticUser));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(draft);
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2.5 lg:gap-4 px-3 py-2 lg:px-10 lg:py-6 bg-[#0F0F0E] lg:bg-transparent">
          <span className="flex h-9 w-9 lg:h-12 lg:w-12 shrink-0 items-center justify-center rounded-full bg-[#C8A96E]/[0.12] border-[0.5px] border-[#C8A96E]/30 font-serif text-base lg:text-xl text-[#C8A96E]">
            S
          </span>
          <div className="min-w-0">
            <p className="text-[13px] lg:text-2xl font-medium text-[#FAFAF8] lg:text-[var(--color-text-primary)] lg:font-serif">
              Sage
            </p>
            <p className="text-[10px] lg:text-base text-[#6B7280] lg:text-[var(--color-text-secondary)]">
              Your AI leadership coach
            </p>
          </div>
        </div>

        {/* Session type tabs + usage — desktop: same row; mobile: stacked */}
        <div className="lg:px-10 lg:flex lg:items-center lg:justify-between lg:mb-6">
          <SessionTypeTabs
            allTypes={SESSION_TYPES}
            availableTypeIds={availableTypeIds}
            activeId={activeTypeId}
            onSelect={startWithType}
          />
          <UsageBar used={usedCount} limit={dailyLimit} />
        </div>

        {error && (
          <div className="mx-3 lg:mx-10 mb-2 rounded-lg border-[0.5px] border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-xs lg:text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-[var(--color-background-primary)] lg:px-10"
        >
          {loadingHistory ? (
            <p className="text-center text-sm text-[var(--color-text-secondary)] py-10">
              Loading session…
            </p>
          ) : !hasStarted ? (
            <CoachEmptyState
              allTypes={SESSION_TYPES}
              availableTypeIds={availableTypeIds}
              onSelectType={startWithType}
              greeting={greeting}
              firstName={firstName}
            />
          ) : (
            <div className="flex flex-col gap-2.5 lg:gap-6 px-3 py-3 lg:px-0 lg:py-6 lg:max-w-[720px]">
              {messages.map((m, i) => (
                <ChatMessage key={i} message={m} />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs lg:text-sm text-[var(--color-text-secondary)] pl-9 lg:pl-[52px]">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-bounce" />
                  </span>
                  Sage is thinking…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="
            flex items-end gap-1.5 lg:gap-3
            border-t-[0.5px] border-[var(--color-border-tertiary)]
            bg-[var(--color-background-primary)]
            px-2.5 py-2 lg:px-10 lg:py-6
          "
        >
          <button
            type="button"
            aria-label="Attach"
            className="text-[var(--color-text-secondary)] shrink-0"
          >
            <Plus className="w-[17px] h-[17px] lg:w-5 lg:h-5" />
          </button>

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={hasStarted ? 'Type your response...' : "Share what's on your mind..."}
            disabled={sending}
            className="
              flex-1 min-w-0 rounded-[18px] lg:rounded-full
              border-[0.5px] border-[var(--color-border-secondary)]
              bg-[var(--color-background-secondary)]
              px-[11px] py-[7px] lg:px-6 lg:py-3.5
              text-xs lg:text-base
              text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-secondary)]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]
            "
          />

          <button
            type="button"
            aria-label="Voice"
            className="hidden lg:block text-[var(--color-text-secondary)] shrink-0"
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            type="submit"
            aria-label="Send"
            disabled={sending || !draft.trim()}
            className="
              flex h-[30px] w-[30px] lg:h-12 lg:w-12 shrink-0 items-center justify-center
              rounded-full bg-[#0F0F0E] disabled:opacity-40
            "
          >
            <Send className="w-[13px] h-[13px] lg:w-5 lg:h-5 text-[#FAFAF8]" />
          </button>
        </form>
      </div>

      <RecentSessionsPanel sessions={recentSessions} onSelect={resumeSession} />
    </div>
  );
}
