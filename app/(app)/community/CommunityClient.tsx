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
// Ascentor's own mark (three diagonal ascending strokes) echoed as a faint
// tiled motif — "this is Ascentor's chat", not generic chat texture. Gold at
// 4% reads correctly on both light/dark. Every stroke stays strictly inside
// the 0-120 viewBox so tiles never seam.
const CHAT_BG_PATTERN_SVG = `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#C8A96E" stroke-width="1.5" stroke-linecap="round" opacity="0.04">
    <line x1="15" y1="105" x2="40" y2="40" />
    <line x1="28" y1="105" x2="50" y2="46" />
    <line x1="41" y1="105" x2="60" y2="52" />
  </g>
  <g stroke="#C8A96E" stroke-width="1.5" stroke-linecap="round" opacity="0.04">
    <line x1="75" y1="105" x2="100" y2="40" />
    <line x1="88" y1="105" x2="110" y2="46" />
    <line x1="101" y1="105" x2="119" y2="52" />
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
      className="flex flex-col h-full bg-[var(--color-background-primary)] community-chat-bg"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(CHAT_BG_PATTERN_SVG)}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '120px 120px',
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
