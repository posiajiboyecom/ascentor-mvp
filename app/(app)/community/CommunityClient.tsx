'use client';

// app/(app)/community/CommunityClient.tsx
// ─────────────────────────────────────────────────────────────────────────
// The Circle — Ascentor's community. Desktop: three-pane "Prototype A / The
// Server" layout (channel rail + chat + Today panel). Mobile: master-detail,
// channel list <-> open channel, full screen, no third pane.
//
// channel_type drives rendering per channel:
//   'chat'    — realtime messaging (Dimensions: Mind, Vocation, etc.)
//   'forum'   — long-form posts with dimension tags (General)
//   'circle'  — WhatsApp-style accountability groups
//   'announce'— admin-only broadcast, members can react but not reply
//
// Only ONE ChannelView ever mounts at a time (gated by useIsDesktop) to
// avoid opening duplicate Supabase Realtime subscriptions to the same
// channel — see hooks/useIsDesktop.ts for why this matters here
// specifically and not elsewhere in the app.
// ============================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useVoiceRecorder, formatRecordingTime } from '@/hooks/useVoiceRecorder';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { TodayPanel, type PinnedItem, type OnlineMember, type PulseStat } from '@/components/community/TodayPanel';
import { EmojiPickerButton } from '@/components/community/EmojiPickerButton';
import { QUICK_REACTIONS } from '@/components/community/emojiSet';
import type { PlanTier } from '@/lib/planTier';

// ── Chat background pattern ──────────────────────────────────────────
// Researched before building: literal scattered-icon patterns (the
// WhatsApp doodle-wallpaper style) are a specific brand choice tied to
// that product's casual identity, not a general chat-UX best practice
// — most premium/professional chat UIs (Slack, Discord, iMessage) use
// flat or near-flat backgrounds. The current 2026 convention for
// adding texture to premium/editorial-feeling products is subtle
// grain/geometric texture at very low opacity, not visible iconography
// — confirmed across multiple current design-tool sources during
// research for this change.
//
// Rather than use a generic noise/grain texture (which would be safe
// but arbitrary — not tied to this product specifically), this pattern
// is built from Ascentor's own mark: the three diagonal ascending
// strokes in the logo (public/ascentor-color-for-dark-pages.svg) are
// echoed here as a faint, large-scale tiled motif. It reads as "this
// is Ascentor's chat" rather than "this is generic chat texture."
//
// Gold (#C8A96E, the brand accent) at 4% opacity — visible enough to
// add depth, low enough to never compete with message text or bubble
// backgrounds for either light or dark theme (--color-background-
// primary resolves to #FFFFFF light / #1A1A19 dark; 4% gold reads
// correctly against both without a separate dark-mode variant).
// Tiled at 120x120px so the motif repeats at a scale large enough to
// not look like static/noise up close, small enough to be present
// across small mobile viewports too.
//
// TILING NOTE: every stroke's endpoints are kept strictly inside the
// 0-120 viewBox (never touching x=0, x=120, y=0, or y=120). An
// earlier version of this pattern had strokes extending past the
// tile boundary (e.g. x2=134 in a 120-wide tile), which SVG clips at
// the viewBox edge — that clipping created a visible seam every
// 120px where lines abruptly cut off instead of continuing smoothly
// into the next tile. Caught and fixed before shipping by checking
// every coordinate against the viewBox bounds. Keeping geometry
// fully inside the tile (rather than relying on wrap-around math at
// the edges) is the simplest way to guarantee no seam, since there's
// nothing AT the boundary to seam in the first place.
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

// ── Types — match the real schema exactly ──────────────────────────────

export type ChannelType = 'chat' | 'forum' | 'circle' | 'announce';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  default_type: ChannelType | null;
  sort_order: number;
}

export interface Channel {
  slug: string;
  name: string;
  description: string | null;
  channel_type: ChannelType;
  category_id: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  sort_order: number;
  emoji?: string;
}

export interface Message {
  id: string;
  channel: string;
  user_id: string;
  content: string;
  reply_to_id?: string | null;
  created_at: string;
  profiles?: { full_name: string };
  likes: string[];
  pinned: boolean;
  dimension_tag?: string | null;
  reply_count?: number;
}

export interface CommunityClientProps {
  categories: Category[];
  channels: Channel[];
  userPlan: PlanTier;
  userId: string;
  userName: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

const AVATAR_COLORS = ['#534AB7', '#0891B2', '#059669', '#D97706', '#DC2626', '#A8894E'];
const userColorCache: Record<string, string> = {};
export function avatarColor(userId: string) {
  if (!userColorCache[userId]) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
    userColorCache[userId] = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
  return userColorCache[userId];
}

/** Parses `[voice:<url>]` content produced by the voice-upload route. */
export function parseVoiceContent(content: string): string | null {
  const match = content.match(/^\[voice:(.+)\]$/);
  return match ? match[1] : null;
}

export const DIMENSION_META: Record<string, { emoji: string; color: string }> = {
  Mind: { emoji: '🧠', color: '#C8A96E' },
  Vocation: { emoji: '⚡', color: '#C8A96E' },
  Character: { emoji: '🏛', color: '#C8A96E' },
  Relationships: { emoji: '🤝', color: '#C8A96E' },
  Community: { emoji: '🌍', color: '#C8A96E' },
  Legacy: { emoji: '🏆', color: '#C8A96E' },
};

// ── Avatar ────────────────────────────────────────────────────────────────

function Avatar({
  name,
  userId,
  size = 32,
}: {
  name: string;
  userId: string;
  size?: number;
}) {
  const color = avatarColor(userId);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}26`,
        color,
        fontSize: size * 0.36,
        border: `0.5px solid ${color}4D`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}

// ── Channel sidebar ──────────────────────────────────────────────────────

interface ChannelSidebarProps {
  categories: Category[];
  channels: Channel[];
  activeSlug: string | null;
  onSelect: (channel: Channel) => void;
  unreadCounts: Record<string, number>;
}

function ChannelSidebar({
  categories,
  channels,
  activeSlug,
  onSelect,
  unreadCounts,
}: ChannelSidebarProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of channels) {
      if (ch.is_pinned) continue; // pinned channels render in their own section above
      if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) continue;
      const list = map.get(ch.category_id) ?? [];
      list.push(ch);
      map.set(ch.category_id, list);
    }
    return map;
  }, [channels, search]);

  const pinnedChannels = channels.filter(
    (c) => c.is_pinned && (!search || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-[#0C0B08] text-[#FAFAF8]">
      <div className="px-4 py-4 border-b-[0.5px] border-white/[0.06]">
        <h1 className="text-lg font-semibold">The Circle</h1>
        <p className="text-xs text-[#6B7280] mt-0.5">
          {channels.length} channels
        </p>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border-[0.5px] border-white/[0.08] px-3 py-1.5">
          <span className="text-[#4B5563] text-sm">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="flex-1 bg-transparent text-sm text-[#FAFAF8] placeholder:text-[#4B5563] outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pinnedChannels.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-4 py-1.5">
              <span className="text-[#C8A96E] text-xs">📌</span>
              <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#C8A96E]">
                Pinned
              </span>
            </div>
            {pinnedChannels.map((ch) => (
              <ChannelRow
                key={ch.slug}
                channel={ch}
                active={ch.slug === activeSlug}
                unread={unreadCounts[ch.slug] ?? 0}
                onClick={() => onSelect(ch)}
              />
            ))}
          </div>
        )}

        {categories.map((cat) => {
          const list = channelsByCategory.get(cat.id) ?? [];
          if (list.length === 0) return null;
          const isCollapsed = collapsed[cat.id];

          return (
            <div key={cat.id}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                className="flex items-center justify-between w-full px-4 py-1.5 text-left"
              >
                <span className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#4B5563]">
                  {cat.name}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#4B5563]">{list.length}</span>
                  <span
                    className={`text-[#4B5563] text-[10px] transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                  >
                    ▾
                  </span>
                </span>
              </button>
              {!isCollapsed &&
                list.map((ch) => (
                  <ChannelRow
                    key={ch.slug}
                    channel={ch}
                    active={ch.slug === activeSlug}
                    unread={unreadCounts[ch.slug] ?? 0}
                    onClick={() => onSelect(ch)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  unread,
  onClick,
}: {
  channel: Channel;
  active: boolean;
  unread: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-4 py-2 text-left transition-colors ${
        active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#C8A96E]/[0.08] text-sm">
        {channel.emoji ?? (channel.channel_type === 'announce' ? '📢' : '#')}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm truncate ${active ? 'text-[#FAFAF8] font-medium' : 'text-[#9CA3AF]'}`}
        >
          {channel.name}
        </span>
        {channel.description && (
          <span className="block text-xs text-[#4B5563] truncate">{channel.description}</span>
        )}
      </span>
      {unread > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C8A96E] px-1 text-[10px] font-medium text-[#0F0F0E]">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isModerator: boolean;
  onReact: (emoji: string) => void;
  onTogglePin: () => void;
  onReply?: () => void;
}

function MessageBubble({ message, isOwn, isModerator, onReact, onTogglePin, onReply }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const voiceUrl = parseVoiceContent(message.content);

  // Aggregate likes ("userId:emoji" entries) into emoji -> count
  const reactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of message.likes) {
      const emoji = entry.split(':')[1];
      if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1;
    }
    return counts;
  }, [message.likes]);

  return (
    <div
      className={`flex gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && <Avatar name={message.profiles?.full_name ?? 'Member'} userId={message.user_id} size={28} />}

      <div className={`relative max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-xs font-medium text-[var(--color-text-primary)] mb-0.5">
            {message.profiles?.full_name ?? 'Member'}
            <span className="ml-1.5 text-[10px] font-normal text-[var(--color-text-secondary)]">
              {fmtTime(message.created_at)}
            </span>
          </span>
        )}

        {voiceUrl ? (
          <div
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
              isOwn ? 'bg-[#0F0F0E] text-[#FAFAF8]' : 'bg-[var(--color-background-secondary)]'
            }`}
          >
            <audio controls src={voiceUrl} className="h-8 max-w-[200px]" />
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              isOwn
                ? 'bg-[#0F0F0E] text-[#FAFAF8] rounded-tr-sm'
                : 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] rounded-tl-sm'
            }`}
          >
            {message.content}
          </div>
        )}

        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex gap-1 mt-1">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className="rounded-full border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)]"
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Desktop hover-react row */}
        {showActions && (
          <div
            className={`hidden lg:flex absolute -top-9 z-20 items-center gap-0.5 rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-primary)] shadow-md px-1 py-1 ${
              isOwn ? 'right-0' : 'left-0'
            }`}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => onReact(emoji)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs hover:bg-[var(--color-background-secondary)] hover:scale-110 transition-transform"
              >
                {emoji}
              </button>
            ))}
            {onReply && (
              <button
                type="button"
                aria-label="Reply"
                onClick={onReply}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)] text-xs"
              >
                ↩
              </button>
            )}
            {isModerator && (
              <button
                type="button"
                aria-label={message.pinned ? 'Unpin' : 'Pin'}
                onClick={onTogglePin}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs hover:bg-[var(--color-background-secondary)]"
              >
                {message.pinned ? '📌' : '📍'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────

interface ComposerProps {
  channelName: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  voiceRecorder: ReturnType<typeof useVoiceRecorder>;
}

function Composer({
  channelName,
  draft,
  onDraftChange,
  onSend,
  replyTo,
  onCancelReply,
  voiceRecorder,
}: ComposerProps) {
  return (
    <div className="border-t-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
      {replyTo && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--color-background-secondary)] border-b-[0.5px] border-[var(--color-border-tertiary)]">
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            Replying to <span className="font-medium">{replyTo.profiles?.full_name}</span>: {replyTo.content}
          </p>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-[var(--color-text-secondary)] shrink-0 ml-2">
            ✕
          </button>
        </div>
      )}

      {voiceRecorder.isRecording ? (
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-sm text-[var(--color-text-primary)] tabular-nums">
            {formatRecordingTime(voiceRecorder.seconds)}
          </span>
          <div className="flex items-center gap-0.5 flex-1">
            {voiceRecorder.levels.map((lvl, i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-[#C8A96E]"
                style={{ height: Math.max(3, lvl * 20) }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => voiceRecorder.stop(false)}
            aria-label="Cancel recording"
            className="text-[var(--color-text-secondary)] text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => voiceRecorder.stop(true)}
            aria-label="Send voice message"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C8A96E] text-[#0F0F0E]"
          >
            ➤
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">
          <EmojiPickerButton onSelect={(emoji) => onDraftChange(draft + emoji)} />

          <input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={`Message #${channelName}`}
            className="flex-1 min-w-0 rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]"
          />

          <button
            type="button"
            aria-label="Record voice message"
            onClick={() => voiceRecorder.start()}
            className="text-[var(--color-text-secondary)] shrink-0"
          >
            🎤
          </button>

          <button
            type="button"
            aria-label="Send"
            disabled={!draft.trim()}
            onClick={onSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C8A96E] text-[#0F0F0E] disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      )}
      {voiceRecorder.error && (
        <p className="px-4 pb-2 text-xs text-red-600">{voiceRecorder.error}</p>
      )}
    </div>
  );
}

// ── Forum (General channel) ──────────────────────────────────────────────
// Topic-card list with dimension filter chips, truncated body + "Read
// more", and a footer of like/reply counts. Tapping a post opens its
// replies in a thread view. Distinct from chat: no day dividers, no
// composer-at-bottom-of-feed (new post is a separate compose action).

const FORUM_DIMENSIONS = ['All', 'Mind', 'Vocation', 'Character', 'Relationships', 'Community', 'Legacy'];
const POSTABLE_DIMENSIONS = FORUM_DIMENSIONS.slice(1); // excludes 'All' — not a real tag to post under
const FORUM_TRUNCATE_LENGTH = 180;

function ForumPostCard({
  message,
  onOpenThread,
  onReact,
}: {
  message: Message;
  onOpenThread: () => void;
  onReact: (emoji: string) => void;
}) {
  const isLong = message.content.length > FORUM_TRUNCATE_LENGTH;
  const preview = isLong ? message.content.slice(0, FORUM_TRUNCATE_LENGTH).trimEnd() + '…' : message.content;
  const heartCount = message.likes.filter((entry) => entry.endsWith(':❤️')).length;
  const hasLiked = message.likes.some((entry) => entry.endsWith(':❤️'));

  return (
    <article className="flex gap-3 px-4 lg:px-6 py-4 border-b-[0.5px] border-[var(--color-border-tertiary)] hover:bg-[var(--color-background-secondary)]/40 transition-colors">
      <Avatar name={message.profiles?.full_name ?? 'Member'} userId={message.user_id} size={40} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {message.profiles?.full_name ?? 'Member'}
          </span>
          <span className="text-[var(--color-text-secondary)] text-xs">·</span>
          <span className="text-xs text-[var(--color-text-secondary)]">{fmtTime(message.created_at)}</span>
          {message.dimension_tag && (
            <span className="rounded-full bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/25 px-2 py-0.5 text-[10px] font-medium text-[#A8894E] ml-auto">
              {message.dimension_tag}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenThread}
          className="text-left w-full"
        >
          <p className="text-[15px] leading-relaxed text-[var(--color-text-primary)] mb-2.5 whitespace-pre-wrap">
            {preview}
            {isLong && <span className="text-[#C8A96E] font-medium"> Show more</span>}
          </p>
        </button>

        <div className="flex items-center gap-6 -ml-2">
          <button
            type="button"
            onClick={onOpenThread}
            className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:bg-[#534AB7]/10 hover:text-[#534AB7] transition-colors"
          >
            <MessageCircle className="w-[17px] h-[17px]" />
            {message.reply_count ?? 0}
          </button>
          <button
            type="button"
            onClick={() => onReact('❤️')}
            className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] transition-colors ${
              hasLiked
                ? 'text-red-500'
                : 'text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-500'
            }`}
          >
            <Heart className="w-[17px] h-[17px]" fill={hasLiked ? 'currentColor' : 'none'} />
            {heartCount}
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Forum composer (X/Twitter-style "what's on your mind") ──────────────

function ForumComposer({
  userName,
  userId,
  onPost,
}: {
  userName: string;
  userId: string;
  onPost: (text: string, dimensionTag: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const MAX_LENGTH = 2000;

  async function handlePost() {
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await onPost(draft.trim(), selectedTag);
      setDraft('');
      setSelectedTag(null);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="border-b-[0.5px] border-[var(--color-border-tertiary)] px-4 lg:px-6 py-4">
      <div className="flex gap-3">
        <Avatar name={userName} userId={userId} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="What's on your mind?"
            rows={draft ? 3 : 1}
            className="
              w-full resize-none border-none bg-transparent outline-none
              text-[17px] leading-relaxed text-[var(--color-text-primary)]
              placeholder:text-[var(--color-text-secondary)]
            "
          />

          {draft && (
            <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
              {POSTABLE_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setSelectedTag((t) => (t === dim ? null : dim))}
                  className={`
                    rounded-full border-[0.5px] px-2.5 py-1 text-[11px] font-medium transition-colors
                    ${
                      selectedTag === dim
                        ? 'bg-[#C8A96E]/15 border-[#C8A96E]/40 text-[#A8894E]'
                        : 'border-[var(--color-border-tertiary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)]'
                    }
                  `}
                >
                  {dim}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2.5 border-t-[0.5px] border-[var(--color-border-tertiary)]">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {draft.length > 0 && `${draft.length}/${MAX_LENGTH}`}
            </span>
            <button
              type="button"
              onClick={handlePost}
              disabled={!draft.trim() || posting}
              className="rounded-full bg-[#C8A96E] px-5 py-1.5 text-sm font-semibold text-[#0F0F0E] disabled:opacity-40"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ForumBodyProps {
  messages: Message[];
  loading: boolean;
  onReact: (message: Message, emoji: string) => void;
  onOpenThread: (message: Message) => void;
  userName: string;
  userId: string;
  onPost: (text: string, dimensionTag: string | null) => Promise<void>;
}

function ForumBody({ messages, loading, onReact, onOpenThread, userName, userId, onPost }: ForumBodyProps) {
  const [activeDimension, setActiveDimension] = useState('All');

  // Top-level posts only — replies (reply_to_id set) live inside the thread view.
  const topLevelPosts = useMemo(
    () =>
      messages
        .filter((m) => !m.reply_to_id)
        .filter((m) => activeDimension === 'All' || m.dimension_tag === activeDimension)
        .slice()
        .reverse(), // newest first, forum convention
    [messages, activeDimension]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-4 lg:px-6 py-2 overflow-x-auto border-b-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
        {FORUM_DIMENSIONS.map((dim) => (
          <button
            key={dim}
            type="button"
            onClick={() => setActiveDimension(dim)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs transition-colors ${
              activeDimension === dim
                ? 'bg-[#C8A96E]/[0.12] text-[#C8A96E] font-medium'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {dim}
          </button>
        ))}
      </div>

      <ForumComposer userName={userName} userId={userId} onPost={onPost} />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">Loading…</p>
        ) : topLevelPosts.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
            No posts yet in this dimension — be the first to share.
          </p>
        ) : (
          topLevelPosts.map((post) => (
            <ForumPostCard
              key={post.id}
              message={post}
              onOpenThread={() => onOpenThread(post)}
              onReact={(emoji) => onReact(post, emoji)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ForumThreadProps {
  post: Message;
  replies: Message[];
  onBack: () => void;
  onReact: (message: Message, emoji: string) => void;
  isOwn: (message: Message) => boolean;
  isModerator: boolean;
  onTogglePin: (message: Message) => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSendReply: () => void;
}

function ForumThread({
  post,
  replies,
  onBack,
  onReact,
  isOwn,
  isModerator,
  onTogglePin,
  draft,
  onDraftChange,
  onSendReply,
}: ForumThreadProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
        <button type="button" onClick={onBack} aria-label="Back to posts" className="text-[#C8A96E]">
          ‹
        </button>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Thread</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-3">
        <div className="pb-4 mb-3 border-b-[0.5px] border-[var(--color-border-tertiary)]">
          <ForumPostCard message={post} onOpenThread={() => {}} onReact={(emoji) => onReact(post, emoji)} />
        </div>

        {replies.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-secondary)] py-6">
            No replies yet — start the conversation.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((reply) => (
              <MessageBubble
                key={reply.id}
                message={reply}
                isOwn={isOwn(reply)}
                isModerator={isModerator}
                onReact={(emoji) => onReact(reply, emoji)}
                onTogglePin={() => onTogglePin(reply)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t-[0.5px] border-[var(--color-border-tertiary)] shrink-0">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendReply();
            }
          }}
          placeholder="Write a reply..."
          className="flex-1 min-w-0 rounded-full border-[0.5px] border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]"
        />
        <button
          type="button"
          aria-label="Send reply"
          disabled={!draft.trim()}
          onClick={onSendReply}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C8A96E] text-[#0F0F0E] disabled:opacity-40"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

interface ChannelViewProps {
  channel: Channel;
  userId: string;
  userName: string;
  onBack?: () => void;
  isModerator: boolean;
  /** Lets the parent (desktop layout) derive the Today panel's pinned
   * items and weekly-activity stat without duplicating this component's
   * own message fetch + realtime subscription. */
  onMessagesChange?: (messages: Message[]) => void;
}

function ChannelView({ channel, userId, userName, onBack, isModerator, onMessagesChange }: ChannelViewProps) {
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const profileCache = useRef<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // User-facing error feedback. Previously every failure path here
  // (load, send, voice upload, reaction, pin, reply count) only
  // logged to console — confirmed during UI/UX audit that this
  // screen had zero user-facing error feedback anywhere, meaning a
  // failed message send, for example, would silently revert with no
  // explanation to the person who just sent it. This is the fix:
  // one shared toast state, set at every catch/error branch below.
  // Auto-dismisses after 4s; does not block interaction.
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorToast(msg);
    if (errorToastTimer.current) clearTimeout(errorToastTimer.current);
    errorToastTimer.current = setTimeout(() => setErrorToast(null), 4000);
  }, []);
  useEffect(() => () => { if (errorToastTimer.current) clearTimeout(errorToastTimer.current); }, []);

  const isForum = channel.channel_type === 'forum';
  const canReply = channel.channel_type !== 'announce';
  const isLocked = channel.is_locked && !isModerator;

  // ── Enrich raw rows with author names ──
  const enrichMessages = useCallback(
    async (raw: any[]): Promise<Message[]> => {
      const unknownIds = [...new Set(raw.map((m) => m.user_id))].filter(
        (id) => !profileCache.current[id]
      );
      if (unknownIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', unknownIds);
        (profiles || []).forEach((p: any) => {
          profileCache.current[p.id] = p.full_name || 'Member';
        });
      }
      return raw.map((m) => ({
        ...m,
        profiles: { full_name: profileCache.current[m.user_id] || 'Member' },
      }));
    },
    [supabase]
  );

  // ── Load message history on channel change ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveThread(null);
    setThreadDraft('');
    (async () => {
      const { data, error } = await supabase
        .from('community_messages')
        .select('id, user_id, channel, content, reply_to_id, created_at, likes, pinned, dimension_tag, reply_count')
        .eq('channel', channel.slug)
        .eq('deleted', false)
        .order('created_at', { ascending: true })
        .limit(150);

      if (error) {
        console.error('[CommunityClient] failed to load messages:', error.message);
        if (!cancelled) showError("Couldn't load messages — check your connection and try again.");
      }
      if (!cancelled) {
        setMessages(await enrichMessages(data ?? []));
        setLoading(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.slug, supabase, enrichMessages]);

  // ── Realtime subscription — the one place this MUST never double-fire ──
  useEffect(() => {
    const sub = supabase
      .channel(`community:${channel.slug}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel.slug}` },
        async (payload: any) => {
          if (payload.new.deleted) return;
          const [enriched] = await enrichMessages([payload.new]);
          setMessages((prev) =>
            prev.some((m) => m.id === enriched.id) ? prev : [...prev, enriched]
          );
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: `channel=eq.${channel.slug}` },
        (payload: any) => {
          setMessages((prev) =>
            payload.new.deleted
              ? prev.filter((m) => m.id !== payload.new.id)
              : prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channel.slug, supabase, enrichMessages]);

  // ── Voice recording ──
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
        // The INSERT realtime event will add the message — no optimistic
        // insert needed here since the round-trip is already a network call.
      } catch (err) {
        console.error('[CommunityClient] voice upload error:', err);
        showError("Voice message didn't send — check your connection.");
      }
    },
    [channel.slug, showError]
  );

  const voiceRecorder = useVoiceRecorder(handleVoiceComplete);

  // ── Send a text message (optimistic) ──
  async function sendMessageText(
    text: string,
    replyToId: string | null,
    dimensionTag: string | null = null
  ) {
    if (!text.trim() || isLocked) return;

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      channel: channel.slug,
      user_id: userId,
      content: text.trim(),
      reply_to_id: replyToId,
      created_at: new Date().toISOString(),
      profiles: { full_name: userName },
      likes: [],
      pinned: false,
      dimension_tag: dimensionTag,
      reply_count: 0,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const { data, error } = await supabase
      .from('community_messages')
      .insert({
        user_id: userId,
        channel: channel.slug,
        content: optimistic.content,
        reply_to_id: replyToId,
        dimension_tag: dimensionTag,
        likes: [],
      })
      .select('id, user_id, channel, content, reply_to_id, created_at, likes, pinned, dimension_tag, reply_count')
      .single();

    if (error || !data) {
      console.error('[CommunityClient] send failed:', error?.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      showError("Message didn't send — try again.");
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === optimistic.id ? { ...m, id: data.id, created_at: data.created_at } : m))
    );

    // Forum reply: bump the parent post's reply_count so the card footer
    // updates without needing a full refetch.
    if (replyToId) {
      const parent = messages.find((m) => m.id === replyToId);
      const nextCount = (parent?.reply_count ?? 0) + 1;
      setMessages((prev) =>
        prev.map((m) => (m.id === replyToId ? { ...m, reply_count: nextCount } : m))
      );
      const { error: countError } = await supabase
        .from('community_messages')
        .update({ reply_count: nextCount })
        .eq('id', replyToId);
      if (countError) {
        console.error('[CommunityClient] reply_count update failed:', countError.message);
        showError('Reply sent, but the reply count may be out of date.');
      }
    }
  }

  async function sendMessage() {
    const text = draft;
    setDraft('');
    const replyToId = replyTo?.id ?? null;
    setReplyTo(null);
    await sendMessageText(text, replyToId);
  }

  async function sendForumPost(text: string, dimensionTag: string | null) {
    await sendMessageText(text, null, dimensionTag);
  }

  async function sendThreadReply() {
    if (!activeThread) return;
    const text = threadDraft;
    setThreadDraft('');
    await sendMessageText(text, activeThread.id);
  }

  // ── Toggle a reaction (likes: text[], "userId:emoji" entries) ──
  async function toggleReaction(message: Message, emoji: string) {
    const key = `${userId}:${emoji}`;
    const has = message.likes.includes(key);
    const nextLikes = has ? message.likes.filter((k) => k !== key) : [...message.likes, key];

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, likes: nextLikes } : m))
    );

    const { error } = await supabase
      .from('community_messages')
      .update({ likes: nextLikes })
      .eq('id', message.id);

    if (error) {
      console.error('[CommunityClient] reaction failed:', error.message);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      showError("Reaction didn't save — try again.");
    }
  }

  async function togglePin(message: Message) {
    if (!isModerator) return;
    const { error } = await supabase
      .from('community_messages')
      .update({ pinned: !message.pinned })
      .eq('id', message.id);
    if (error) {
      console.error('[CommunityClient] pin toggle failed:', error.message);
      showError("Couldn't pin message — try again.");
    }
  }

  const pinnedMessage = messages.find((m) => m.pinned);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  return (
    <div
      className="flex flex-col h-full bg-[var(--color-background-primary)] community-chat-bg"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(CHAT_BG_PATTERN_SVG)}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '120px 120px',
      }}
    >
      {/* Error toast — see errorToast state declaration above for why
          this exists: every failure path in this component used to
          fail completely silently (console.error only). */}
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
          <p className="text-sm lg:text-base font-medium text-[var(--color-text-primary)] truncate">
            {channel.name}
          </p>
          {channel.description && (
            <p className="text-xs text-[var(--color-text-secondary)] truncate">{channel.description}</p>
          )}
        </div>
      </div>

      {pinnedMessage && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 bg-[#C8A96E]/[0.08] border-b-[0.5px] border-[#C8A96E]/20 text-xs lg:text-sm shrink-0">
          <span className="text-[#C8A96E] shrink-0">★</span>
          <p className="flex-1 min-w-0 truncate text-[#A8894E]">
            Pinned: &ldquo;{pinnedMessage.content}&rdquo;
          </p>
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

      {/* Body — forum gets its own topic-list/thread UI; chat & circle share the message-list UI */}
      {isForum ? (
        activeThread ? (
          <ForumThread
            post={activeThread}
            replies={messages.filter((m) => m.reply_to_id === activeThread.id)}
            onBack={() => setActiveThread(null)}
            onReact={(message, emoji) => toggleReaction(message, emoji)}
            isOwn={(message) => message.user_id === userId}
            isModerator={isModerator}
            onTogglePin={togglePin}
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
            onPost={sendForumPost}
          />
        )
      ) : (
        <>
          {/* Messages */}
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
                const showDayDivider =
                  !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at);
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
                      onTogglePin={() => togglePin(msg)}
                      onReply={canReply ? () => setReplyTo(msg) : undefined}
                    />
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
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
}: CommunityClientProps) {
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  // Distinguishes "no channel selected yet" (auto-select should run) from
  // "user tapped back to return to the list" (auto-select must NOT
  // re-fire, or the back button would appear to do nothing on mobile).
  const [userClearedChannel, setUserClearedChannel] = useState(false);
  const [activeChannelMessages, setActiveChannelMessages] = useState<Message[]>([]);
  const [presentMembers, setPresentMembers] = useState<
    { userId: string; name: string }[]
  >([]);
  const isDesktop = useIsDesktop();
  const presenceSupabase = useRef(createClient()).current;

  // Land directly in a channel on arrival — both mobile and desktop.
  // Prefers the Welcome channel specifically; falls back to any pinned
  // channel (e.g. General) if Welcome doesn't exist yet, then the first
  // channel in the list as a last resort. Does NOT re-fire after the
  // user explicitly navigates back to the channel list (see
  // userClearedChannel above) — only on true initial load.
  useEffect(() => {
    if (!activeChannel && !userClearedChannel && channels.length > 0) {
      const defaultChannel =
        channels.find((c) => c.slug === 'welcome') ??
        channels.find((c) => c.is_pinned) ??
        channels[0];
      setActiveChannel(defaultChannel);
    }
  }, [activeChannel, userClearedChannel, channels]);

  // ── Presence — real Supabase Realtime Presence, not a fabricated list.
  // Tracks who's currently viewing The Circle (any channel), independent
  // of which specific channel is open. Only runs on desktop since the
  // Today panel is desktop-only; mobile doesn't need this overhead.
  useEffect(() => {
    if (!isDesktop) return;

    const presenceChannel = presenceSupabase.channel('community-presence', {
      config: { presence: { key: userId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ name: string }>();
        const members = Object.entries(state).map(([uid, entries]) => ({
          userId: uid,
          name: entries[0]?.name ?? 'Member',
        }));
        setPresentMembers(members);
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

  // TODO: replace with a real role check once profiles.role is confirmed
  // available to this component. Using plan tier as a stand-in for
  // moderator status is almost certainly wrong long-term, but it's an
  // honest placeholder rather than silently granting/denying pin rights
  // to the wrong people.
  const isModerator = userPlan === 'climber';

  // TODO: unread counts need a real "last read" tracking mechanism
  // (per-user, per-channel). No such column/table exists yet — see the
  // dashboard delivery notes for the same gap on Home's Circle quick-action
  // card. Passing an empty object keeps badges honestly at zero instead of
  // fabricating numbers.
  const unreadCounts: Record<string, number> = {};

  // ── Today panel data — derived from real values only ──
  // "This week's pulse": distinct posters in the active channel over the
  // last 7 days. NOT a "logged a win" counter — no such feature/table
  // exists, and fabricating one would just be a fake number with a
  // progress bar. See TodayPanel.tsx's own note on this same point.
  const weeklyActiveCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const posters = new Set(
      activeChannelMessages
        .filter((m) => new Date(m.created_at).getTime() >= sevenDaysAgo)
        .map((m) => m.user_id)
    );
    return posters.size;
  }, [activeChannelMessages]);

  const pulseStats: PulseStat[] = activeChannel
    ? [
        {
          label: 'Active this week',
          value: String(weeklyActiveCount),
          subtext: `posted in #${activeChannel.name}`,
          accent: 'gold',
        },
        {
          label: 'Right now',
          value: String(presentMembers.length),
          subtext: 'members online',
          accent: 'purple',
        },
      ]
    : [];

  const pinnedItems: PinnedItem[] = activeChannelMessages
    .filter((m) => m.pinned)
    .map((m) => ({
      id: m.id,
      author: m.profiles?.full_name ?? 'Member',
      text: m.content,
    }));

  const onlineMembers: OnlineMember[] = presentMembers
    .filter((m) => m.userId !== userId)
    .slice(0, 12)
    .map((m) => ({
      id: m.userId,
      name: m.name,
      initials: getInitials(m.name),
      location: '', // not available without a richer profile join
      role: '',
      avatarColor: avatarColor(m.userId),
    }));

  return (
    <div className="flex h-full">
      {/* ══════ DESKTOP (>= 1024px) — three-pane, permanent ══════ */}
      {isDesktop && (
        <>
          <div className="w-[260px] shrink-0 h-full">
            <ChannelSidebar
              categories={categories}
              channels={channels}
              activeSlug={activeChannel?.slug ?? null}
              onSelect={(ch) => {
                setActiveChannel(ch);
                setActiveChannelMessages([]); // clear stale Today panel data immediately on switch
              }}
              unreadCounts={unreadCounts}
            />
          </div>
          <div className="flex-1 min-w-0 h-full">
            {activeChannel ? (
              <ChannelView
                channel={activeChannel}
                userId={userId}
                userName={userName}
                isModerator={isModerator}
                onMessagesChange={setActiveChannelMessages}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-secondary)]">
                Select a channel to get started.
              </div>
            )}
          </div>
          {activeChannel && (
            <TodayPanel
              channelName={activeChannel.name}
              pulseStats={pulseStats}
              pinnedItems={pinnedItems}
              onlineMembers={onlineMembers}
              onlineCount={presentMembers.length}
            />
          )}
        </>
      )}

      {/* ══════ MOBILE (< 1024px) — master-detail, hard swap ══════ */}
      {!isDesktop && (
        <div className="flex flex-col flex-1 h-full">
          {activeChannel ? (
            <ChannelView
              channel={activeChannel}
              userId={userId}
              userName={userName}
              isModerator={isModerator}
              onBack={() => {
                setActiveChannel(null);
                setUserClearedChannel(true);
              }}
            />
          ) : (
            <ChannelSidebar
              categories={categories}
              channels={channels}
              activeSlug={null}
              onSelect={setActiveChannel}
              unreadCounts={unreadCounts}
            />
          )}
        </div>
      )}
    </div>
  );
}
