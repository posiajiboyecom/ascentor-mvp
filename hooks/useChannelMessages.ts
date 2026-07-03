// hooks/useChannelMessages.ts
// ─────────────────────────────────────────────────────────────────────────
// The message engine for a single Circle channel: history load, realtime
// INSERT/UPDATE subscription, author-name enrichment, optimistic send,
// reaction toggle, and pin toggle — plus a shared error-toast.
//
// Extracted from CommunityClient's ChannelView so BOTH the channel view and
// the "This Week" home's Commons feed run the exact same logic instead of
// duplicating a second Supabase subscription by hand.
//
// IMPORTANT: like the original ChannelView, only ONE consumer of this hook
// should be mounted per channel slug at a time, or you open duplicate
// Realtime subscriptions to the same channel. CommunityClient enforces this
// via useIsDesktop (see its comment). The home screen only mounts the Commons
// feed (forum channel), which is never the same slug as an open chat channel.
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/components/community/types';

const MESSAGE_COLUMNS =
  'id, user_id, channel, content, reply_to_id, created_at, likes, pinned, dimension_tag, reply_count, is_checkin, checkin_week';

interface Options {
  userId: string;
  userName: string;
}

export function useChannelMessages(channelSlug: string, { userId, userName }: Options) {
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const profileCache = useRef<Record<string, string>>({});

  // Keep a ref to the latest messages so send/react callbacks never read a
  // stale closure (e.g. looking up a reply's parent to bump reply_count).
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // ── Shared error toast ──
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setErrorToast(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorToast(null), 4000);
  }, []);
  useEffect(() => () => { if (errorTimer.current) clearTimeout(errorTimer.current); }, []);

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

  // ── Load history on channel change ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('community_messages')
        .select(MESSAGE_COLUMNS)
        .eq('channel', channelSlug)
        .eq('deleted', false)
        .order('created_at', { ascending: true })
        .limit(150);

      if (error) {
        console.error('[useChannelMessages] load failed:', error.message);
        if (!cancelled) showError("Couldn't load messages — check your connection and try again.");
      }
      if (!cancelled) {
        setMessages(await enrichMessages(data ?? []));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [channelSlug, supabase, enrichMessages, showError]);

  // ── Realtime — the one place this MUST never double-fire ──
  useEffect(() => {
    const sub = supabase
      .channel(`community:${channelSlug}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'community_messages', filter: `channel=eq.${channelSlug}` },
        async (payload: any) => {
          if (payload.new.deleted) return;
          const [enriched] = await enrichMessages([payload.new]);
          setMessages((prev) => (prev.some((m) => m.id === enriched.id) ? prev : [...prev, enriched]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'community_messages', filter: `channel=eq.${channelSlug}` },
        (payload: any) => {
          setMessages((prev) =>
            payload.new.deleted
              ? prev.filter((m) => m.id !== payload.new.id)
              : prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channelSlug, supabase, enrichMessages]);

  // ── Send a text message (optimistic) ──
  const sendMessageText = useCallback(
    async (text: string, replyToId: string | null, dimensionTag: string | null = null) => {
      if (!text.trim()) return;

      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        channel: channelSlug,
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

      const { data, error } = await supabase
        .from('community_messages')
        .insert({
          user_id: userId,
          channel: channelSlug,
          content: optimistic.content,
          reply_to_id: replyToId,
          dimension_tag: dimensionTag,
          likes: [],
        })
        .select(MESSAGE_COLUMNS)
        .single();

      if (error || !data) {
        console.error('[useChannelMessages] send failed:', error?.message);
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        showError("Message didn't send — try again.");
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, id: data.id, created_at: data.created_at } : m))
      );

      // Forum reply: bump the parent post's cached reply_count.
      if (replyToId) {
        const parent = messagesRef.current.find((m) => m.id === replyToId);
        const nextCount = (parent?.reply_count ?? 0) + 1;
        setMessages((prev) =>
          prev.map((m) => (m.id === replyToId ? { ...m, reply_count: nextCount } : m))
        );
        const { error: countError } = await supabase
          .from('community_messages')
          .update({ reply_count: nextCount })
          .eq('id', replyToId);
        if (countError) {
          console.error('[useChannelMessages] reply_count update failed:', countError.message);
          showError('Reply sent, but the reply count may be out of date.');
        }
      }
    },
    [channelSlug, supabase, userId, userName, showError]
  );

  // ── Toggle a reaction (likes: text[], "userId:emoji" entries) ──
  const toggleReaction = useCallback(
    async (message: Message, emoji: string) => {
      const key = `${userId}:${emoji}`;
      const has = message.likes.includes(key);
      const nextLikes = has ? message.likes.filter((k) => k !== key) : [...message.likes, key];

      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, likes: nextLikes } : m)));

      const { error } = await supabase
        .from('community_messages')
        .update({ likes: nextLikes })
        .eq('id', message.id);

      if (error) {
        console.error('[useChannelMessages] reaction failed:', error.message);
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        showError("Reaction didn't save — try again.");
      }
    },
    [supabase, userId, showError]
  );

  const togglePin = useCallback(
    async (message: Message) => {
      const { error } = await supabase
        .from('community_messages')
        .update({ pinned: !message.pinned })
        .eq('id', message.id);
      if (error) {
        console.error('[useChannelMessages] pin toggle failed:', error.message);
        showError("Couldn't pin message — try again.");
      }
    },
    [supabase, showError]
  );

  return {
    messages,
    loading,
    errorToast,
    showError,
    sendMessageText,
    toggleReaction,
    togglePin,
  };
}
