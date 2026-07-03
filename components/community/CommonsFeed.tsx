'use client';

// components/community/CommonsFeed.tsx
// The "This Week" home's Commons: the forum channel rendered inline via the
// shared useChannelMessages hook + ForumBody/ForumThread. Only mounted on the
// home view, so it never double-subscribes with an open ChannelView.

import { useState } from 'react';
import { useChannelMessages } from '@/hooks/useChannelMessages';
import { ForumBody, ForumThread } from './forum';
import type { Channel, Message } from './types';

export function CommonsFeed({
  channel,
  userId,
  userName,
  isModerator,
}: {
  channel: Channel;
  userId: string;
  userName: string;
  isModerator: boolean;
}) {
  const { messages, loading, errorToast, sendMessageText, toggleReaction, togglePin } =
    useChannelMessages(channel.slug, { userId, userName });

  const [activeThread, setActiveThread] = useState<Message | null>(null);
  const [threadDraft, setThreadDraft] = useState('');

  async function sendThreadReply() {
    if (!activeThread || !threadDraft.trim()) return;
    const text = threadDraft;
    setThreadDraft('');
    await sendMessageText(text, activeThread.id);
  }

  return (
    <div className="relative flex flex-col h-full min-h-[420px]">
      {errorToast && (
        <div
          role="alert"
          className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: 'var(--app-bg-card, #1A1A19)', color: 'var(--app-text, #FAFAF8)', border: '1px solid rgba(220,38,38,0.35)' }}
        >
          {errorToast}
        </div>
      )}

      {activeThread ? (
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
          onPost={(text, dimensionTag) => sendMessageText(text, null, dimensionTag)}
        />
      )}
    </div>
  );
}
