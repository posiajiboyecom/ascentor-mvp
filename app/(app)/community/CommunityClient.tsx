'use client';

// app/(app)/community/CommunityClient.tsx
// ─────────────────────────────────────────────────────────────────────────
// The Circle. Lands on the "This Week" home (ritual + your circle + Commons)
// instead of dumping you inside a channel. Selecting a channel drills into the
// existing ChannelView engine.
//
//   Desktop (>=1024):  [ SectionNav 248 ] [ home | ChannelView ] [ TodayPanel 300 ]
//   Mobile  (<1024):   This Week home ⇄ drill into a channel full-screen;
//                      a "Channels" button opens the SectionNav list.
//
// Messaging (history load, realtime, send, react, pin) lives in the shared
// useChannelMessages hook so the home's Commons feed and an open channel run
// the same code. Only ONE consumer per channel slug is ever mounted at a time
// (home shows the forum; a channel view shows the selected slug — never both),
// which is what keeps us from opening duplicate Realtime subscriptions.
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useChannelMessages } from '@/hooks/useChannelMessages';
import { TodayPanel, type PinnedItem, type OnlineMember, type PulseStat } from '@/components/community/TodayPanel';
import { SectionNav } from '@/components/community/SectionNav';
import { SummitHome } from '@/components/community/SummitHome';
import { MessageBubble, Composer } from '@/components/community/messages';
import { ForumBody, ForumThread } from '@/components/community/forum';
import { getInitials, avatarColor, dayLabel } from '@/components/community/types';
import type { Channel, Category, Message, WeekData } from '@/components/community/types';
import type { PlanTier } from '@/lib/planTier';

export type { ChannelType, Category, Channel, Message } from '@/components/community/types';

export interface CommunityClientProps {
  categories: Category[];
  channels: Channel[];
  userPlan: PlanTier;
  userId: string;
  userName: string;
  weekData: WeekData;
  isModerator: boolean;
  initialUnreadCounts: Record<string, number>;
}

// ── Chat background pattern ──────────────────────────────────────────
// Dense scattered doodle pattern — Ascentor brand motifs (triangles,
// diamonds, circles, stars, lines, dots) at varying sizes, rotations,
// and opacities on a warm parchment base. Matches the telegram/whatsapp
// doodle-wall aesthetic while staying on-brand. 400×400 tile so the
// repeat never looks mechanical.
const CHAT_BG_PATTERN_SVG = `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#F0EBE1"/>

  <!-- ── Scattered brand motifs in warm amber/brown at low opacity ── -->
  <!-- Color palette: #8B6208 (deep amber), #A07820 (mid amber), #C8A050 (light amber) -->

  <!-- Ascending triangles (Ascentor mark) — various sizes & rotations -->
  <polygon points="32,28 40,44 24,44" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.18"/>
  <polygon points="120,15 126,27 114,27" fill="none" stroke="#A07820" stroke-width="1" opacity="0.14"/>
  <polygon points="310,52 320,72 300,72" fill="none" stroke="#8B6208" stroke-width="1.3" opacity="0.16"/>
  <polygon points="370,20 376,32 364,32" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.13"/>
  <polygon points="200,38 209,54 191,54" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15"/>
  <polygon points="65,90 71,102 59,102" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13"/>
  <polygon points="155,80 163,96 147,96" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.17"/>
  <polygon points="260,75 268,91 252,91" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12"/>
  <polygon points="340,88 348,104 332,104" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15"/>
  <polygon points="18,148 26,164 10,164" fill="none" stroke="#A07820" stroke-width="1.2" opacity="0.16"/>
  <polygon points="100,135 110,155 90,155" fill="none" stroke="#8B6208" stroke-width="1.3" opacity="0.18"/>
  <polygon points="220,128 228,144 212,144" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.13"/>
  <polygon points="385,130 393,146 377,146" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15"/>
  <polygon points="50,200 58,216 42,216" fill="none" stroke="#A07820" stroke-width="1" opacity="0.14"/>
  <polygon points="170,195 178,211 162,211" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.17"/>
  <polygon points="300,185 310,205 290,205" fill="none" stroke="#C8A050" stroke-width="1.2" opacity="0.15"/>
  <polygon points="360,210 368,226 352,226" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.13"/>
  <polygon points="130,260 138,276 122,276" fill="none" stroke="#A07820" stroke-width="1.1" opacity="0.16"/>
  <polygon points="240,255 250,275 230,275" fill="none" stroke="#8B6208" stroke-width="1.3" opacity="0.18"/>
  <polygon points="30,295 38,311 22,311" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12"/>
  <polygon points="380,280 388,296 372,296" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15"/>
  <polygon points="80,340 88,356 72,356" fill="none" stroke="#A07820" stroke-width="1.2" opacity="0.16"/>
  <polygon points="200,330 208,346 192,346" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <polygon points="320,345 328,361 312,361" fill="none" stroke="#C8A050" stroke-width="1.1" opacity="0.13"/>
  <polygon points="10,370 18,386 2,386" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.15"/>
  <polygon points="370,370 378,386 362,386" fill="none" stroke="#A07820" stroke-width="1" opacity="0.14"/>

  <!-- Diamonds (rotated squares) -->
  <rect x="76" y="30" width="10" height="10" rx="1" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.15" transform="rotate(45 81 35)"/>
  <rect x="176" y="58" width="7" height="7" rx="0.5" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13" transform="rotate(45 179.5 61.5)"/>
  <rect x="276" y="22" width="12" height="12" rx="1" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.16" transform="rotate(45 282 28)"/>
  <rect x="340" y="60" width="8" height="8" rx="0.5" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12" transform="rotate(45 344 64)"/>
  <rect x="136" y="108" width="10" height="10" rx="1" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.15" transform="rotate(45 141 113)"/>
  <rect x="296" y="118" width="8" height="8" rx="0.5" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13" transform="rotate(45 300 122)"/>
  <rect x="36" y="168" width="11" height="11" rx="1" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.16" transform="rotate(45 41.5 173.5)"/>
  <rect x="196" y="158" width="9" height="9" rx="0.5" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.13" transform="rotate(45 200.5 162.5)"/>
  <rect x="356" y="155" width="12" height="12" rx="1" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.15" transform="rotate(45 362 161)"/>
  <rect x="96" y="228" width="8" height="8" rx="0.5" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13" transform="rotate(45 100 232)"/>
  <rect x="276" y="238" width="10" height="10" rx="1" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.16" transform="rotate(45 281 243)"/>
  <rect x="56" y="308" width="9" height="9" rx="0.5" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12" transform="rotate(45 60.5 312.5)"/>
  <rect x="166" y="298" width="11" height="11" rx="1" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.15" transform="rotate(45 171.5 303.5)"/>
  <rect x="356" y="318" width="8" height="8" rx="0.5" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13" transform="rotate(45 360 322)"/>
  <rect x="246" y="368" width="10" height="10" rx="1" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15" transform="rotate(45 251 373)"/>

  <!-- Circles — various sizes -->
  <circle cx="55" cy="52" r="7" fill="none" stroke="#A07820" stroke-width="1" opacity="0.14"/>
  <circle cx="185" cy="30" r="5" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.13"/>
  <circle cx="350" cy="38" r="9" fill="none" stroke="#C8A050" stroke-width="1.1" opacity="0.15"/>
  <circle cx="240" cy="100" r="6" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <circle cx="395" cy="85" r="5" fill="none" stroke="#A07820" stroke-width="1" opacity="0.12"/>
  <circle cx="15" cy="110" r="8" fill="none" stroke="#8B6208" stroke-width="1.1" opacity="0.15"/>
  <circle cx="78" cy="168" r="5" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.13"/>
  <circle cx="328" cy="148" r="7" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <circle cx="148" cy="175" r="6" fill="none" stroke="#A07820" stroke-width="1" opacity="0.13"/>
  <circle cx="258" cy="168" r="9" fill="none" stroke="#8B6208" stroke-width="1.2" opacity="0.16"/>
  <circle cx="18" cy="228" r="6" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12"/>
  <circle cx="108" cy="248" r="5" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <circle cx="228" cy="218" r="8" fill="none" stroke="#A07820" stroke-width="1.1" opacity="0.15"/>
  <circle cx="388" cy="238" r="6" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.13"/>
  <circle cx="48" cy="268" r="7" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.14"/>
  <circle cx="308" cy="278" r="5" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.13"/>
  <circle cx="168" cy="348" r="8" fill="none" stroke="#A07820" stroke-width="1.1" opacity="0.15"/>
  <circle cx="288" cy="318" r="6" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <circle cx="398" cy="348" r="5" fill="none" stroke="#C8A050" stroke-width="1" opacity="0.12"/>
  <circle cx="28" cy="388" r="7" fill="none" stroke="#8B6208" stroke-width="1" opacity="0.14"/>
  <circle cx="348" cy="388" r="9" fill="none" stroke="#A07820" stroke-width="1.2" opacity="0.15"/>

  <!-- 4-pointed stars / cross sparkles -->
  <g opacity="0.16" stroke="#8B6208" stroke-width="1" stroke-linecap="round">
    <line x1="90" y1="60" x2="90" y2="72"/><line x1="84" y1="66" x2="96" y2="66"/>
    <line x1="87" y1="63" x2="93" y2="69"/><line x1="93" y1="63" x2="87" y2="69"/>
  </g>
  <g opacity="0.14" stroke="#A07820" stroke-width="1" stroke-linecap="round">
    <line x1="280" y1="48" x2="280" y2="58"/><line x1="275" y1="53" x2="285" y2="53"/>
    <line x1="277" y1="50" x2="283" y2="56"/><line x1="283" y1="50" x2="277" y2="56"/>
  </g>
  <g opacity="0.15" stroke="#8B6208" stroke-width="1.1" stroke-linecap="round">
    <line x1="148" y1="128" x2="148" y2="142"/><line x1="141" y1="135" x2="155" y2="135"/>
    <line x1="143" y1="130" x2="153" y2="140"/><line x1="153" y1="130" x2="143" y2="140"/>
  </g>
  <g opacity="0.13" stroke="#C8A050" stroke-width="1" stroke-linecap="round">
    <line x1="370" y1="108" x2="370" y2="118"/><line x1="365" y1="113" x2="375" y2="113"/>
    <line x1="367" y1="110" x2="373" y2="116"/><line x1="373" y1="110" x2="367" y2="116"/>
  </g>
  <g opacity="0.16" stroke="#8B6208" stroke-width="1.1" stroke-linecap="round">
    <line x1="38" y1="248" x2="38" y2="260"/><line x1="32" y1="254" x2="44" y2="254"/>
    <line x1="34" y1="250" x2="42" y2="258"/><line x1="42" y1="250" x2="34" y2="258"/>
  </g>
  <g opacity="0.14" stroke="#A07820" stroke-width="1" stroke-linecap="round">
    <line x1="198" y1="288" x2="198" y2="298"/><line x1="193" y1="293" x2="203" y2="293"/>
    <line x1="195" y1="290" x2="201" y2="296"/><line x1="201" y1="290" x2="195" y2="296"/>
  </g>
  <g opacity="0.15" stroke="#8B6208" stroke-width="1.2" stroke-linecap="round">
    <line x1="348" y1="248" x2="348" y2="262"/><line x1="341" y1="255" x2="355" y2="255"/>
    <line x1="343" y1="250" x2="353" y2="260"/><line x1="353" y1="250" x2="343" y2="260"/>
  </g>
  <g opacity="0.14" stroke="#C8A050" stroke-width="1" stroke-linecap="round">
    <line x1="118" y1="368" x2="118" y2="378"/><line x1="113" y1="373" x2="123" y2="373"/>
    <line x1="115" y1="370" x2="121" y2="376"/><line x1="121" y1="370" x2="115" y2="376"/>
  </g>
  <g opacity="0.16" stroke="#8B6208" stroke-width="1.1" stroke-linecap="round">
    <line x1="268" y1="388" x2="268" y2="400"/><line x1="262" y1="394" x2="274" y2="394"/>
  </g>

  <!-- Small filled dots scattered -->
  <g fill="#8B6208">
    <circle cx="44" cy="75" r="1.5" opacity="0.2"/>
    <circle cx="164" cy="48" r="1.5" opacity="0.18"/>
    <circle cx="224" cy="68" r="2" opacity="0.16"/>
    <circle cx="394" cy="55" r="1.5" opacity="0.18"/>
    <circle cx="14" cy="188" r="2" opacity="0.2"/>
    <circle cx="118" cy="198" r="1.5" opacity="0.17"/>
    <circle cx="208" cy="148" r="1.5" opacity="0.16"/>
    <circle cx="314" cy="168" r="2" opacity="0.18"/>
    <circle cx="68" cy="228" r="1.5" opacity="0.17"/>
    <circle cx="338" cy="208" r="1.5" opacity="0.16"/>
    <circle cx="148" cy="308" r="2" opacity="0.19"/>
    <circle cx="258" cy="298" r="1.5" opacity="0.17"/>
    <circle cx="368" cy="358" r="2" opacity="0.18"/>
    <circle cx="88" cy="388" r="1.5" opacity="0.16"/>
    <circle cx="208" cy="378" r="2" opacity="0.18"/>
  </g>

  <!-- Short diagonal accent lines -->
  <g stroke="#A07820" stroke-width="1" stroke-linecap="round">
    <line x1="106" y1="44" x2="114" y2="52" opacity="0.15"/>
    <line x1="248" y1="28" x2="256" y2="36" opacity="0.13"/>
    <line x1="28" y1="128" x2="36" y2="120" opacity="0.14"/>
    <line x1="188" y1="108" x2="196" y2="116" opacity="0.13"/>
    <line x1="358" y1="178" x2="366" y2="186" opacity="0.15"/>
    <line x1="88" y1="278" x2="96" y2="286" opacity="0.14"/>
    <line x1="218" y1="238" x2="226" y2="246" opacity="0.13"/>
    <line x1="328" y1="308" x2="336" y2="316" opacity="0.14"/>
    <line x1="158" y1="388" x2="166" y2="396" opacity="0.13"/>
    <line x1="388" y1="398" x2="396" y2="406" opacity="0.12"/>
  </g>

  <!-- Tiny squares (not rotated) -->
  <g fill="none" stroke="#8B6208" stroke-width="1">
    <rect x="134" y="58" width="8" height="8" rx="1" opacity="0.13"/>
    <rect x="394" y="148" width="6" height="6" rx="0.5" opacity="0.12"/>
    <rect x="14" y="318" width="8" height="8" rx="1" opacity="0.14"/>
    <rect x="324" y="368" width="7" height="7" rx="0.5" opacity="0.13"/>
    <rect x="234" y="328" width="6" height="6" rx="0.5" opacity="0.12"/>
  </g>
</svg>`;

// ── Channel view (chat / forum / circle / announce) ──────────────────────────

interface ChannelViewProps {
  channel: Channel;
  userId: string;
  userName: string;
  onBack?: () => void;
  isModerator: boolean;
  onMessagesChange?: (messages: Message[]) => void;
}

function ChannelView({ channel, userId, userName, onBack, isModerator, onMessagesChange }: ChannelViewProps) {
  const {
    messages,
    loading,
    errorToast,
    showError,
    sendMessageText,
    toggleReaction,
    togglePin,
  } = useChannelMessages(channel.slug, { userId, userName });

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const isForum = channel.channel_type === 'forum';
  const canReply = channel.channel_type !== 'announce';
  const isLocked = channel.is_locked && !isModerator;

  // Reset per-channel UI state on switch.
  useEffect(() => {
    setActiveThread(null);
    setThreadDraft('');
    setReplyTo(null);
    setDraft('');
  }, [channel.slug]);

  // Autoscroll chat/circle to the newest message.
  useEffect(() => {
    if (!isForum) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
  }, [messages.length, isForum]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // ── Voice ──
  const handleVoiceComplete = useCallback(
    async (blob: Blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'voice-message');
      formData.append('channel', channel.slug);
      try {
        const res = await fetch('/api/community/voice-upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error('[CommunityClient] voice upload failed:', data.error);
          showError("Voice message didn't send — try again.");
        }
      } catch (err) {
        console.error('[CommunityClient] voice upload error:', err);
        showError("Voice message didn't send — check your connection.");
      }
    },
    [channel.slug, showError]
  );
  const voiceRecorder = useVoiceRecorder(handleVoiceComplete);

  function sendMessage() {
    const text = draft;
    setDraft('');
    const replyToId = replyTo?.id ?? null;
    setReplyTo(null);
    void sendMessageText(text, replyToId);
  }
  function sendThreadReply() {
    if (!activeThread) return;
    const text = threadDraft;
    setThreadDraft('');
    void sendMessageText(text, activeThread.id);
  }
  const guardedPin = (m: Message) => {
    if (isModerator) void togglePin(m);
  };

  const pinnedMessage = messages.find((m) => m.pinned);

  return (
    <div
      className="flex flex-col h-full community-chat-bg"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(CHAT_BG_PATTERN_SVG)}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '400px 400px',
        backgroundColor: '#F0EBE1',
      }}
    >
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
          style={{
            background: 'var(--app-bg-card, #1A1A19)',
            color: 'var(--app-text, #FAFAF8)',
            border: '1px solid rgba(220,38,38,0.35)',
            maxWidth: '90vw',
          }}
        >
          {errorToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4 border-b-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back" className="text-[#C8A96E] lg:hidden">
            ‹
          </button>
        )}
        <span className="text-[var(--color-text-secondary)]">
          {channel.channel_type === 'announce' ? '📢' : '#'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm lg:text-base font-medium text-[var(--color-text-primary)] truncate">{channel.name}</p>
          {channel.description && (
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{channel.description}</p>
          )}
        </div>
      </div>

      {pinnedMessage && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 bg-[#C8A96E]/[0.08] border-b-[0.5px] border-[#C8A96E]/20 text-xs lg:text-sm shrink-0">
          <span className="text-[#C8A96E] shrink-0">★</span>
          <p className="flex-1 min-w-0 truncate text-[#A8894E]">Pinned: &ldquo;{pinnedMessage.content}&rdquo;</p>
        </div>
      )}

      {channel.channel_type === 'announce' && (
        <div className="flex items-center gap-1.5 px-4 lg:px-6 py-2 bg-[#0F0F0E] text-[10px] lg:text-xs text-[#6B7280] shrink-0">
          <span className="text-[#C8A96E]">🔒</span>
          Admin-only. React freely — replies not available here.
        </div>
      )}

      {channel.channel_type === 'circle' && (
        <div className="flex items-center gap-1.5 px-4 lg:px-6 py-2 bg-[#0F6E56]/[0.08] text-[10px] lg:text-xs text-[#0F6E56] shrink-0">
          <span>👥</span>
          Accountability circle — weekly check-ins, kept between members.
        </div>
      )}

      {/* Body */}
      {isForum ? (
        activeThread ? (
          <ForumThread
            post={activeThread}
            replies={messages.filter((m) => m.reply_to_id === activeThread.id)}
            onBack={() => setActiveThread(null)}
            onReact={(message, emoji) => toggleReaction(message, emoji)}
            isOwn={(message) => message.user_id === userId}
            isModerator={isModerator}
            onTogglePin={guardedPin}
            draft={threadDraft}
            onDraftChange={setThreadDraft}
            onSendReply={sendThreadReply}
          />
        ) : (
          <ForumBody
            messages={messages}
            loading={loading}
            onReact={(message, emoji) => toggleReaction(message, emoji)}
            onOpenThread={setActiveThread}
            userName={userName}
            userId={userId}
            onPost={(text, dimensionTag) => sendMessageText(text, null, dimensionTag)}
          />
        )
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-3 lg:px-6 py-3 flex flex-col gap-3">
            {loading ? (
              <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
                No messages yet — be the first to post.
              </p>
            ) : (
              messages.map((msg, i) => {
                const prevMsg = messages[i - 1];
                const showDayDivider = !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at);
                return (
                  <React.Fragment key={msg.id}>
                    {showDayDivider && (
                      <div className="text-center text-[10px] text-[var(--color-text-secondary)] py-1">
                        {dayLabel(msg.created_at)}
                      </div>
                    )}
                    <MessageBubble
                      message={msg}
                      isOwn={msg.user_id === userId}
                      isModerator={isModerator}
                      onReact={(emoji) => toggleReaction(msg, emoji)}
                      onTogglePin={() => guardedPin(msg)}
                      onReply={canReply ? () => setReplyTo(msg) : undefined}
                    />
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {canReply && !isLocked && (
            <Composer
              channelName={channel.name}
              draft={draft}
              onDraftChange={setDraft}
              onSend={sendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              voiceRecorder={voiceRecorder}
            />
          )}
          {isLocked && (
            <div className="px-4 py-3 text-center text-xs text-[var(--color-text-secondary)] border-t-[0.5px] border-[var(--color-border-tertiary)]">
              This channel is locked. Upgrade your plan to participate.
            </div>
          )}
          {!canReply && (
            <div className="px-4 py-3 text-center text-xs text-[var(--color-text-secondary)] border-t-[0.5px] border-[var(--color-border-tertiary)]">
              React only · replies not available here
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function CommunityClient({
  categories,
  channels,
  userPlan,
  userId,
  userName,
  weekData,
  isModerator,
  initialUnreadCounts,
}: CommunityClientProps) {
  const [view, setView] = useState<'home' | 'channel'>('home');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeChannelMessages, setActiveChannelMessages] = useState<Message[]>([]);
  const [presentMembers, setPresentMembers] = useState<{ userId: string; name: string }[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const presenceSupabase = useRef(createClient()).current;

  // The Commons = the forum channel (prefer a purpose-named slug, else first forum).
  const commonsChannel = useMemo(
    () =>
      channels.find((c) => c.channel_type === 'forum' && (c.slug === 'the-commons' || c.slug === 'general')) ??
      channels.find((c) => c.channel_type === 'forum') ??
      null,
    [channels]
  );
  const myCircleSlug = weekData.circles[0]?.slug ?? null;

  // ── Presence (desktop Today panel) ──
  useEffect(() => {
    if (!isDesktop) return;
    const presenceChannel = presenceSupabase.channel('community-presence', {
      config: { presence: { key: userId } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ name: string }>();
        setPresentMembers(
          Object.entries(state).map(([uid, entries]) => ({ userId: uid, name: entries[0]?.name ?? 'Member' }))
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ name: userName, online_at: new Date().toISOString() });
        }
      });
    return () => {
      presenceSupabase.removeChannel(presenceChannel);
    };
  }, [isDesktop, presenceSupabase, userId, userName]);

  const unreadCounts: Record<string, number> = initialUnreadCounts;

  function goHome() {
    setView('home');
    setActiveChannel(null);
    setMobileNavOpen(false);
  }
  function selectChannel(ch: Channel) {
    setActiveChannel(ch);
    setActiveChannelMessages([]);
    setView('channel');
    setMobileNavOpen(false);
  }

  // ── Today panel data (desktop) ──
  const weeklyActiveCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const posters = new Set(
      activeChannelMessages
        .filter((m) => new Date(m.created_at).getTime() >= sevenDaysAgo)
        .map((m) => m.user_id)
    );
    return posters.size;
  }, [activeChannelMessages]);

  const pulseStats: PulseStat[] =
    view === 'channel' && activeChannel
      ? [
          { label: 'Active this week', value: String(weeklyActiveCount), subtext: `posted in #${activeChannel.name}`, accent: 'gold' },
          { label: 'Right now', value: String(presentMembers.length), subtext: 'members online', accent: 'purple' },
        ]
      : [
          { label: 'Checked in', value: String(weekData.communityCheckins), subtext: 'this week', accent: 'gold' },
          { label: 'Right now', value: String(presentMembers.length), subtext: 'members online', accent: 'purple' },
        ];

  const pinnedItems: PinnedItem[] = activeChannelMessages
    .filter((m) => m.pinned)
    .map((m) => ({ id: m.id, author: m.profiles?.full_name ?? 'Member', text: m.content }));

  const onlineMembers: OnlineMember[] = presentMembers
    .filter((m) => m.userId !== userId)
    .slice(0, 12)
    .map((m) => ({
      id: m.userId,
      name: m.name,
      initials: getInitials(m.name),
      location: '',
      role: '',
      avatarColor: avatarColor(m.userId),
    }));

  const center =
    view === 'home' ? (
      <div className="h-full overflow-y-auto">
        <SummitHome
          weekData={weekData}
          userId={userId}
          userName={userName}
          isModerator={isModerator}
          commonsChannel={commonsChannel}
        />
      </div>
    ) : activeChannel ? (
      <ChannelView
        channel={activeChannel}
        userId={userId}
        userName={userName}
        isModerator={isModerator}
        onBack={goHome}
        onMessagesChange={setActiveChannelMessages}
      />
    ) : null;

  // ── Desktop: three-pane ──
  if (isDesktop) {
    return (
      <div className="circle-surface flex h-full bg-[var(--app-bg)]">
        <div className="w-[248px] shrink-0 h-full">
          <SectionNav
            categories={categories}
            channels={channels}
            view={view}
            activeSlug={activeChannel?.slug ?? null}
            onGoHome={goHome}
            onSelectChannel={selectChannel}
            unreadCounts={unreadCounts}
            commonsSlug={commonsChannel?.slug ?? null}
            myCircleSlug={myCircleSlug}
          />
        </div>
        <div className="flex-1 min-w-0 h-full">{center}</div>
        <TodayPanel
          channelName={activeChannel?.name ?? 'The Circle'}
          pulseStats={pulseStats}
          pinnedItems={pinnedItems}
          onlineMembers={onlineMembers}
          onlineCount={presentMembers.length}
        />
      </div>
    );
  }

  // ── Mobile: home ⇄ channel, with a channel-browser overlay ──
  return (
    <div className="circle-surface flex flex-col flex-1 h-full bg-[var(--app-bg)]">
      {mobileNavOpen ? (
        <div className="overflow-y-auto flex-1">
          <SectionNav
            categories={categories}
            channels={channels}
            view={view}
            activeSlug={activeChannel?.slug ?? null}
            onGoHome={goHome}
            onSelectChannel={selectChannel}
            unreadCounts={unreadCounts}
            commonsSlug={commonsChannel?.slug ?? null}
            myCircleSlug={myCircleSlug}
            mobile
          />
        </div>
      ) : view === 'channel' && activeChannel ? (
        <ChannelView
          channel={activeChannel}
          userId={userId}
          userName={userName}
          isModerator={isModerator}
          onBack={goHome}
        />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">The Circle</h1>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              ☰ Channels
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SummitHome
              weekData={weekData}
              userId={userId}
              userName={userName}
              isModerator={isModerator}
              commonsChannel={commonsChannel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
