'use client';

import SageLoader from '@/components/SageLoader';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';

// Heart SVG — filled when liked, outline when not
function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

type Reply = {
  id: string;
  content: string;
  upvotes: number;
  created_at: string;
  user_id: string;
  authorName?: string;
  voted?: boolean;
};

type Post = {
  id: string;
  content: string;
  upvotes: number;
  reply_count: number;
  created_at: string;
  user_id: string;
  authorName?: string;
  voted?: boolean;
  replies?: Reply[];
  showReplies?: boolean;
};

export default function CohortFeedPage() {
  const params    = useParams();
  const cohortId  = Array.isArray(params.cohortId) ? params.cohortId[0] : (params.cohortId as string);
  const subdomain = Array.isArray(params?.subdomain) ? params.subdomain[0] : (params?.subdomain as string);
  const router    = useRouter();
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [cohort,       setCohort]       = useState<any>(null);
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [newPost,      setNewPost]      = useState('');
  const [replyingTo,   setReplyingTo]   = useState<string | null>(null);
  const [replyText,    setReplyText]    = useState('');
  const [userId,       setUserId]       = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [posting,      setPosting]      = useState(false);
  // ── Feature 1: Real member count (live from DB, not hardcoded) ──
  const [memberCount,  setMemberCount]  = useState(0);
  // ── Feature 2: Real online count via Supabase Presence ──────────
  const [onlineCount,  setOnlineCount]  = useState(0);

  const userIdRef    = useRef<string | null>(null);
  const authorCache  = useRef<Record<string, string>>({});
  const channelRefs  = useRef<ReturnType<typeof supabase.channel>[]>([]);

  function cleanupChannels() {
    channelRefs.current.forEach(ch => {
      try { ch.unsubscribe(); } catch {}
    });
    channelRefs.current = [];
  }

  useEffect(() => {
    if (!cohortId) return;
    loadAll();

    function handleFocus() {
      cleanupChannels();
      subscribeRealtime();
    }
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      cleanupChannels();
    };
  }, [cohortId]);

  async function resolveName(uid: string): Promise<string> {
    if (authorCache.current[uid]) return authorCache.current[uid];
    const { data } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
    const name = data?.full_name || 'Member';
    authorCache.current[uid] = name;
    return name;
  }

  // ── Feature 1 helper: fetch live member count from cohort_members table ──
  async function fetchMemberCount() {
    const { count } = await supabase
      .from('cohort_members')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', String(cohortId));
    if (typeof count === 'number') setMemberCount(count);
  }

  function subscribeRealtime() {
    // ── Posts channel ──────────────────────────────────────────────────────
    const postsChannel = supabase
      .channel(`cohort-${cohortId}-posts-${Date.now()}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'cohort_posts',
        filter: `cohort_id=eq.${cohortId}`,
      }, async (payload) => {
        const newRow = payload.new as any;
        if (newRow.user_id === userIdRef.current) return;
        const name = await resolveName(newRow.user_id);
        setPosts(prev => [{
          ...newRow,
          upvotes:     newRow.upvotes || 0,
          authorName:  name,
          voted:       false,
          showReplies: false,
          replies:     [],
        }, ...prev]);
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'cohort_posts',
        filter: `cohort_id=eq.${cohortId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setPosts(prev => prev.map(p =>
          p.id === updated.id
            ? { ...p, upvotes: updated.upvotes || 0, reply_count: updated.reply_count || p.reply_count }
            : p
        ));
      })
      .on('postgres_changes', {
        event:  'DELETE',
        schema: 'public',
        table:  'cohort_posts',
        filter: `cohort_id=eq.${cohortId}`,
      }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== (payload.old as any).id));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[realtime] posts channel error, will retry on focus');
        }
      });
    channelRefs.current.push(postsChannel);

    // ── Replies channel ────────────────────────────────────────────────────
    const repliesChannel = supabase
      .channel(`cohort-${cohortId}-replies-${Date.now()}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'cohort_replies',
      }, async (payload) => {
        const newReply = payload.new as any;
        if (newReply.user_id === userIdRef.current) return;
        const name = await resolveName(newReply.user_id);
        setPosts(prev => prev.map(p => {
          if (p.id !== newReply.post_id) return p;
          const updatedReplies = p.showReplies
            ? [...(p.replies || []), { ...newReply, upvotes: 0, authorName: name, voted: false }]
            : p.replies;
          return {
            ...p,
            reply_count: (p.reply_count || 0) + 1,
            replies: updatedReplies,
          };
        }));
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'cohort_replies',
      }, (payload) => {
        const updated = payload.new as any;
        setPosts(prev => prev.map(p => ({
          ...p,
          replies: p.replies?.map(r =>
            r.id === updated.id
              ? { ...r, upvotes: updated.upvotes || 0 }
              : r
          ),
        })));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[realtime] replies channel error');
        }
      });
    channelRefs.current.push(repliesChannel);

    // ── Feature 1: Real-time member count via cohort_members changes ───────
    const membersChannel = supabase
      .channel(`cohort-${cohortId}-members-${Date.now()}`)
      .on('postgres_changes', {
        event:  '*',           // INSERT (join) and DELETE (leave)
        schema: 'public',
        table:  'cohort_members',
        filter: `cohort_id=eq.${cohortId}`,
      }, () => {
        // Refetch exact count from DB on any membership change
        fetchMemberCount();
      })
      .subscribe();
    channelRefs.current.push(membersChannel);

    // ── Feature 2: Real online presence via Supabase Presence ─────────────
    // Presence tracks who is actively on this page right now.
    // When user closes tab or navigates away, they are auto-removed.
    const presenceChannel = supabase.channel(`cohort-${cohortId}-presence-${Date.now()}`, {
      config: { presence: { key: userIdRef.current || 'anon' } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // presenceState() returns { [key]: [{ online_at, ... }] }
        // Each unique key = one user, so Object.keys gives real online count
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        // Eagerly increment so UI reacts without waiting for sync
        setOnlineCount(prev => prev + newPresences.length);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineCount(prev => Math.max(0, prev - leftPresences.length));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track self — heartbeat keeps this alive; unsubscribe removes it
          await presenceChannel.track({
            user_id:   userIdRef.current,
            online_at: new Date().toISOString(),
          });
        }
      });
    channelRefs.current.push(presenceChannel);
  }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    userIdRef.current = user.id;

    let membership = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('cohort_members')
        .select('id')
        .eq('cohort_id', String(cohortId))
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) console.warn('[CohortFeed] membership error:', error.message);
      membership = data;
      if (membership) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 800));
    }
    if (!membership) {
      setLoading(false);
      router.push('/community');
      return;
    }

    const { data: cohortData } = await supabase
      .from('cohorts').select('*').eq('id', String(cohortId)).single();
    setCohort(cohortData);

    // ── Feature 1: Get accurate member count from cohort_members, not cached column ──
    const { count: liveCount } = await supabase
      .from('cohort_members')
      .select('*', { count: 'exact', head: true })
      .eq('cohort_id', String(cohortId));
    setMemberCount(liveCount ?? cohortData?.member_count ?? 0);

    const { data: postsData } = await supabase
      .from('cohort_posts').select('*')
      .eq('cohort_id', String(cohortId))
      .order('created_at', { ascending: false }).limit(50);

    const { data: votes } = await supabase
      .from('cohort_votes').select('post_id, reply_id').eq('user_id', user.id);
    const votedPostIds = new Set(votes?.filter((v: any) => v.post_id).map((v: any) => v.post_id) || []);

    const authorIds = [...new Set((postsData || []).map((p: any) => p.user_id))];
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      (profiles || []).forEach((p: any) => { authorCache.current[p.id] = p.full_name || 'Member'; });
    }

    const mapped = (postsData || []).map((p: any) => ({
      ...p,
      upvotes:    p.upvotes || 0,
      authorName: authorCache.current[p.user_id] || 'Member',
      voted:      votedPostIds.has(p.id),
      showReplies: false,
      replies:    [],
    }));

    setPosts(mapped);
    setLoading(false);

    subscribeRealtime();
  }

  async function createPost() {
    if (!newPost.trim() || !userId || posting) return;
    setPosting(true);
    const content = newPost.trim();
    setNewPost('');

    const { data, error } = await supabase
      .from('cohort_posts')
      .insert({ cohort_id: String(cohortId), user_id: userId, content })
      .select('*').single();

    if (data && !error) {
      setPosts(prev => [{
        ...data,
        upvotes: 0,
        authorName: 'You',
        voted: false,
        showReplies: false,
        replies: [],
      }, ...prev]);
    }
    setPosting(false);
  }

  async function createReply(postId: string) {
    if (!replyText.trim() || !userId) return;
    const content = replyText.trim();
    setReplyText('');
    setReplyingTo(null);

    const { data, error } = await supabase
      .from('cohort_replies')
      .insert({ post_id: postId, user_id: userId, content })
      .select('*').single();

    if (data && !error) {
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              reply_count: p.reply_count + 1,
              replies: [...(p.replies || []), { ...data, upvotes: 0, authorName: 'You', voted: false }],
              showReplies: true,
            }
          : p
      ));

      const targetPost = posts.find(p => p.id === postId);
      if (targetPost && targetPost.user_id && targetPost.user_id !== userId) {
        const myName = authorCache.current[userId!] || 'A member';
        const replyTitle   = '💬 New reply on your post';
        const replyMessage = `${myName} replied: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}"`;
        void Promise.resolve(supabase.from('notifications').insert({
          user_id: targetPost.user_id,
          type:    'community',
          title:   replyTitle,
          message: replyMessage,
          link:    `/community/${cohortId}`,
        })).catch(() => {});
        triggerPush(targetPost.user_id, replyTitle, replyMessage, `/community/${cohortId}`);
      }
    }
  }

  async function toggleReplies(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (post.showReplies) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, showReplies: false } : p));
      return;
    }

    const { data: replies } = await supabase
      .from('cohort_replies').select('*').eq('post_id', postId).order('created_at');

    const { data: votes } = await supabase
      .from('cohort_votes').select('reply_id').eq('user_id', userId!);
    const votedReplyIds = new Set(votes?.filter((v: any) => v.reply_id).map((v: any) => v.reply_id) || []);

    const replyAuthorIds = [...new Set((replies || []).map((r: any) => r.user_id))];
    if (replyAuthorIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', replyAuthorIds);
      (profiles || []).forEach((p: any) => { authorCache.current[p.id] = p.full_name || 'Member'; });
    }

    const mapped = (replies || []).map((r: any) => ({
      ...r,
      upvotes:    r.upvotes || 0,
      authorName: authorCache.current[r.user_id] || 'Member',
      voted:      votedReplyIds.has(r.id),
    }));

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, showReplies: true, replies: mapped } : p));
  }

  // ── Feature 3: Like (was upvote) — same DB logic, new UX ────────────────
  async function likePost(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post || !userId) return;

    const toggled = !post.voted;
    // Optimistic update — instant UI feedback
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      upvotes: Math.max(0, (p.upvotes || 0) + (toggled ? 1 : -1)),
      voted: toggled,
    } : p));

    try {
      if (toggled) {
        await Promise.all([
          supabase.from('cohort_votes').insert({ user_id: userId, post_id: postId }),
          supabase.rpc('increment_post_upvotes', { post_id: postId, delta: 1 }),
        ]);
        if (post.user_id && post.user_id !== userId) {
          const myName = authorCache.current[userId!] || 'A member';
          const newTotal = (post.upvotes || 0) + 1;
          const title   = '❤️ Someone liked your post';
          const message = `${myName} liked your post${newTotal > 1 ? ` (${newTotal} likes total)` : ''}`;
          void Promise.resolve(supabase.from('notifications').insert({
            user_id: post.user_id, type: 'community', title, message,
            link: `/community/${cohortId}`,
          })).catch(() => {});
          triggerPush(post.user_id, title, message, `/community/${cohortId}`);
        }
      } else {
        await Promise.all([
          supabase.from('cohort_votes').delete().eq('user_id', userId).eq('post_id', postId),
          supabase.rpc('increment_post_upvotes', { post_id: postId, delta: -1 }),
        ]);
      }
    } catch (err) {
      console.error('[like] post error:', err);
      // Roll back optimistic update on error
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        upvotes: Math.max(0, (p.upvotes || 0) + (toggled ? -1 : 1)),
        voted: !toggled,
      } : p));
    }
  }

  async function likeReply(postId: string, replyId: string) {
    if (!userId) return;
    const post  = posts.find(p => p.id === postId);
    const reply = post?.replies?.find(r => r.id === replyId);
    if (!reply) return;

    const toggled = !reply.voted;
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      replies: p.replies?.map(r => r.id === replyId ? {
        ...r,
        upvotes: Math.max(0, (r.upvotes || 0) + (toggled ? 1 : -1)),
        voted: toggled,
      } : r),
    } : p));

    try {
      if (toggled) {
        await Promise.all([
          supabase.from('cohort_votes').insert({ user_id: userId, reply_id: replyId }),
          supabase.rpc('increment_reply_upvotes', { reply_id: replyId, delta: 1 }),
        ]);
        if (reply.user_id && reply.user_id !== userId) {
          const myName = authorCache.current[userId!] || 'A member';
          const newTotal = (reply.upvotes || 0) + 1;
          const title   = '❤️ Someone liked your reply';
          const message = `${myName} liked your reply${newTotal > 1 ? ` (${newTotal} likes total)` : ''}`;
          void Promise.resolve(supabase.from('notifications').insert({
            user_id: reply.user_id, type: 'community', title, message,
            link: `/community/${cohortId}`,
          })).catch(() => {});
          triggerPush(reply.user_id, title, message, `/community/${cohortId}`);
        }
      } else {
        await Promise.all([
          supabase.from('cohort_votes').delete().eq('user_id', userId).eq('reply_id', replyId),
          supabase.rpc('increment_reply_upvotes', { reply_id: replyId, delta: -1 }),
        ]);
      }
    } catch (err) {
      console.error('[like] reply error:', err);
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        replies: p.replies?.map(r => r.id === replyId ? {
          ...r,
          upvotes: Math.max(0, (r.upvotes || 0) + (toggled ? -1 : 1)),
          voted: !toggled,
        } : r),
      } : p));
    }
  }

  async function leaveCohort() {
    if (!userId || !confirm('Leave this circle? You can always rejoin later.')) return;
    await supabase.from('cohort_members').delete()
      .eq('cohort_id', String(cohortId)).eq('user_id', userId);
    router.push('/community');
  }

  async function triggerPush(targetUserId: string, title: string, body: string, url: string) {
    try {
      await fetch('/api/push/community', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ targetUserId, title, body, url }),
        credentials: 'include',
      });
    } catch { /* non-critical */ }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24)    return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7)     return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return <SageLoader message="Loading feed…" />;
  }

  return (
    <div className="animate-fade-up py-6">
      <style>{`
        @keyframes rt-ping {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes slide-in-post {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rt-new-post { animation: slide-in-post 0.3s ease both; }
        @keyframes like-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .like-pop { animation: like-pop 0.25s ease both; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-3 items-center">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl"
            style={{ background: 'rgba(245,158,11,0.06)' }}>
            <span dangerouslySetInnerHTML={{ __html: cohort?.icon || "" }} />
          </div>
          <div>
            <h2 className="text-xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
              {cohort?.name}
            </h2>
            <div className="flex items-center gap-2">
              {/* Feature 1: live member count from DB */}
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                {memberCount} member{memberCount !== 1 ? 's' : ''} · {cohort?.category}
              </p>
              {/* Feature 2: real online count from Supabase Presence */}
              <div className="flex items-center gap-1">
                <div style={{ position: 'relative', width: 7, height: 7 }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: '#10B981',
                    animation: 'rt-ping 1.8s ease-out infinite',
                  }} />
                  <div style={{
                    position: 'absolute', inset: 1, borderRadius: '50%',
                    background: '#10B981',
                  }} />
                </div>
                <span className="text-[10px]" style={{ color: '#10B981' }}>
                  {onlineCount} online
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/community')}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>
            ← Step Out
          </button>
          <button onClick={leaveCohort}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--error, #EF4444)', border: '1px solid rgba(239,68,68,0.2)' }}>
            Leave
          </button>
        </div>
      </div>

      {/* ── New Post ────────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 mb-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) createPost(); }}
          placeholder="Share a win, ask a question, or spark a discussion..."
          rows={3}
          className="w-full px-3.5 py-2.5 text-sm rounded-lg resize-none mb-2.5"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
        />
        <div className="flex justify-between items-center">
          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>⌘ + Enter to post</span>
          <button onClick={createPost}
            disabled={!newPost.trim() || posting}
            className="px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* ── Feed ────────────────────────────────────────────────────────── */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">
            <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Be the first to post in this circle!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl rt-new-post"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

              {/* Post body */}
              <div className="p-4">
                <div className="flex gap-2.5 items-start">

                  {/* ── Feature 3: Like button (replaces upvote triangle) ── */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button
                      onClick={() => likePost(post.id)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${post.voted ? 'like-pop' : ''}`}
                      style={{
                        background: post.voted ? 'rgba(239,68,68,0.12)' : 'transparent',
                        color:      post.voted ? '#EF4444' : 'var(--text-dim)',
                        border:     `1px solid ${post.voted ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                      }}
                      title={post.voted ? 'Unlike' : 'Like'}
                    >
                      <HeartIcon filled={!!post.voted} />
                    </button>
                    <span className="text-xs font-semibold"
                      style={{ color: post.voted ? '#EF4444' : 'var(--text-dim)' }}>
                      {post.upvotes || 0}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: 'linear-gradient(135deg,rgba(245,158,11,0.13),rgba(245,158,11,0.27))',
                          border:     '1px solid rgba(245,158,11,0.33)',
                          color:      'var(--accent)',
                        }}>
                        {((post as any).authorName || 'M').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {(post as any).authorName || 'Member'}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                        {timeAgo(post.created_at)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-line mb-2.5"
                      style={{ color: 'var(--text-muted)' }}>
                      {post.content}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => toggleReplies(post.id)}
                        className="text-xs flex items-center gap-1"
                        style={{ color: 'var(--text-dim)' }}>
                        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {' '}{post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                      </button>
                      <button
                        onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyText(''); }}
                        className="text-xs"
                        style={{ color: 'var(--text-dim)' }}>
                        ↩ Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reply input */}
              {replyingTo === post.id && (
                <div className="px-4 pb-3 pl-14">
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 12px', marginTop: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '8px', border: '1px solid rgba(232,160,32,0.2)',
                  }}>
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createReply(post.id); }}
                      placeholder="Write a reply..."
                      style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#F0EDE8' }}
                      autoFocus
                    />
                    <button onClick={() => createReply(post.id)}
                      disabled={!replyText.trim()}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: '6px',
                        background: '#E8A020', color: '#0C0B08', fontWeight: 700,
                        border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                        opacity: !replyText.trim() ? 0.4 : 1,
                      }}>
                      Reply
                    </button>
                  </div>
                </div>
              )}

              {/* Replies */}
              {post.showReplies && post.replies && post.replies.length > 0 && (
                <div className="px-4 pb-3 pl-14" style={{ borderTop: '1px solid var(--border)' }}>
                  {post.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2 py-2.5"
                      style={{ borderBottom: '1px solid var(--border)' }}>

                      {/* ── Feature 3: Like on replies too ── */}
                      <button
                        onClick={() => likeReply(post.id, reply.id)}
                        className="flex flex-col items-center gap-0 shrink-0 pt-0.5"
                        style={{ color: reply.voted ? '#EF4444' : 'var(--text-dim)' }}
                        title={reply.voted ? 'Unlike' : 'Like'}
                      >
                        <HeartIcon filled={!!reply.voted} />
                        <span className="text-[10px] font-semibold mt-0.5">{reply.upvotes || 0}</span>
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{
                              background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.2))',
                              border:     '1px solid rgba(245,158,11,0.25)',
                              color:      'var(--accent)',
                            }}>
                            {((reply as any).authorName || 'M').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                            {(reply as any).authorName || 'Member'}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            {timeAgo(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                          {reply.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
