'use client';

// components/community/messages.tsx
// MessageBubble + Composer — the chat/circle message row and its input.
// Moved out of CommunityClient so ForumThread and ChannelView can share them.

import { useMemo, useState } from 'react';
import { Avatar } from './ui';
import { fmtTime, fmtTimeTooltip, parseVoiceContent, type Message } from './types';
import { EmojiPickerButton } from './EmojiPickerButton';
import { QUICK_REACTIONS } from './emojiSet';
import { useVoiceRecorder, formatRecordingTime } from '@/hooks/useVoiceRecorder';

export function MessageBubble({
  message,
  isOwn,
  isModerator,
  onReact,
  onTogglePin,
  onReply,
}: {
  message: Message;
  isOwn: boolean;
  isModerator: boolean;
  onReact: (emoji: string) => void;
  onTogglePin: () => void;
  onReply?: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  // parseVoiceContent handles the canonical [voice:url] format.
  // Legacy messages stored before the wrapper convention were inserted as
  // bare Supabase storage URLs — detect those too so they render as audio
  // rather than overflowing text.
  const voiceUrl = parseVoiceContent(message.content)
    ?? (message.content.startsWith('https://') && message.content.includes('/community-voice/')
        ? message.content
        : null);

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

      <div className={`relative min-w-0 max-w-[78%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && (
          <span className="text-xs font-medium text-[var(--color-text-primary)] mb-0.5">
            {message.profiles?.full_name ?? 'Member'}
            <span
              className="ml-1.5 text-[10px] font-normal text-[var(--text-muted)] cursor-default"
              title={fmtTimeTooltip(message.created_at)}
            >
              {fmtTime(message.created_at)}
            </span>
          </span>
        )}

        {voiceUrl ? (
          <div
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 w-full ${
              isOwn ? 'bg-[#0F0F0E] text-[#FAFAF8]' : 'bg-[var(--color-background-secondary)]'
            }`}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={voiceUrl} className="h-8 w-full max-w-[240px]" />
          </div>
        ) : (
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words overflow-hidden ${
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

export function Composer({
  channelName,
  draft,
  onDraftChange,
  onSend,
  replyTo,
  onCancelReply,
  voiceRecorder,
}: {
  channelName: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  voiceRecorder: ReturnType<typeof useVoiceRecorder>;
}) {
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
              <span key={i} className="w-[2px] rounded-full bg-[#C8A96E]" style={{ height: Math.max(3, lvl * 20) }} />
            ))}
          </div>
          <button type="button" onClick={() => voiceRecorder.stop(false)} aria-label="Cancel recording" className="text-[var(--color-text-secondary)] text-sm">
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

          <button type="button" aria-label="Record voice message" onClick={() => voiceRecorder.start()} className="text-[var(--color-text-secondary)] shrink-0">
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
      {voiceRecorder.error && <p className="px-4 pb-2 text-xs text-red-600">{voiceRecorder.error}</p>}
    </div>
  );
}
