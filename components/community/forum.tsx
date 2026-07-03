'use client';

// components/community/forum.tsx
// The forum experience (topic cards, "what's on your mind" composer, thread
// view). Moved out of CommunityClient so BOTH an open forum channel AND the
// "This Week" home's Commons feed render the same UI.

import { useMemo, useState } from 'react';
import { MessageCircle, Heart } from 'lucide-react';
import { Avatar } from './ui';
import { MessageBubble } from './messages';
import {
  fmtTime,
  fmtTimeTooltip,
  parseVoiceContent,
  DIMENSION_META,
  FORUM_DIMENSIONS,
  POSTABLE_DIMENSIONS,
  type Message,
} from './types';

const FORUM_TRUNCATE_LENGTH = 180;

export function ForumPostCard({
  message,
  onOpenThread,
  onReact,
}: {
  message: Message;
  onOpenThread: () => void;
  onReact: (emoji: string) => void;
}) {
  // Detect voice messages (canonical [voice:url] and legacy bare storage URLs)
  const voiceUrl = parseVoiceContent(message.content)
    ?? (message.content.startsWith('https://') && message.content.includes('/community-voice/')
        ? message.content
        : null);
  const isLong = !voiceUrl && message.content.length > FORUM_TRUNCATE_LENGTH;
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
          <span className="text-xs text-[var(--text-muted)] cursor-default" title={fmtTimeTooltip(message.created_at)}>
            {fmtTime(message.created_at)}
          </span>
          {message.dimension_tag && (() => {
            const dimMeta = DIMENSION_META[message.dimension_tag];
            return (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium ml-auto border-[0.5px]"
                style={{
                  color:           dimMeta?.color ?? '#C8A96E',
                  backgroundColor: dimMeta?.bg    ?? 'rgba(200,169,110,0.08)',
                  borderColor:     dimMeta?.border ?? 'rgba(200,169,110,0.22)',
                }}
              >
                {dimMeta?.emoji ?? ''} {message.dimension_tag}
              </span>
            );
          })()}
        </div>

        {voiceUrl ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <audio controls src={voiceUrl} className="w-full max-w-[260px] h-9 mb-2.5" />
        ) : (
          <button type="button" onClick={onOpenThread} className="text-left w-full min-w-0">
            <p className="text-[15px] leading-relaxed text-[var(--color-text-primary)] mb-2.5 whitespace-pre-wrap break-words overflow-hidden">
              {preview}
              {isLong && <span className="text-[#C8A96E] font-medium"> Show more</span>}
            </p>
          </button>
        )}

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
              hasLiked ? 'text-red-500' : 'text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-500'
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

export function ForumComposer({
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
            className="w-full resize-none border-none bg-transparent outline-none text-[17px] leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
          />

          {draft && (
            <div className="flex flex-wrap gap-1.5 mt-1 mb-3">
              {POSTABLE_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setSelectedTag((t) => (t === dim ? null : dim))}
                  className={`rounded-full border-[0.5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selectedTag === dim
                      ? 'bg-[#C8A96E]/15 border-[#C8A96E]/40 text-[#A8894E]'
                      : 'border-[var(--color-border-tertiary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)]'
                  }`}
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

export function ForumBody({
  messages,
  loading,
  onReact,
  onOpenThread,
  userName,
  userId,
  onPost,
}: {
  messages: Message[];
  loading: boolean;
  onReact: (message: Message, emoji: string) => void;
  onOpenThread: (message: Message) => void;
  userName: string;
  userId: string;
  onPost: (text: string, dimensionTag: string | null) => Promise<void>;
}) {
  const [activeDimension, setActiveDimension] = useState('All');

  const topLevelPosts = useMemo(
    () =>
      messages
        .filter((m) => !m.reply_to_id)
        .filter((m) => activeDimension === 'All' || m.dimension_tag === activeDimension)
        .slice()
        .reverse(),
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

export function ForumThread({
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
}: {
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
}) {
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
