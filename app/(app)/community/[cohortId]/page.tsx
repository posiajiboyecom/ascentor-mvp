'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';

type Reply = {
  id: string;
  content: string;
  upvotes: number;
  created_at: string;
  user_id: string;
  voted?: boolean;
};

type Post = {
  id: string;
  content: string;
  upvotes: number;
  reply_count: number;
  created_at: string;
  user_id: string;
  voted?: boolean;
  replies?: Reply[];
  showReplies?: boolean;
};

export default function CohortFeedPage() {
  const { cohortId } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [cohort, setCohort] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAll();
  }, [cohortId]);

  function getInitials(name: string) {
    if (!name || name === 'Anonymous') return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Check membership
    const { data: membership } = await supabase
      .from('cohort_members')
      .select('id')
      .eq('cohort_id', cohortId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      router.push('/community');
      return;
    }

    // Load cohort info
    const { data: cohortData } = await supabase
      .from('cohorts')
      .select('*')
      .eq('id', cohortId)
      .single();
    setCohort(cohortData);
    setMemberCount(cohortData?.member_count || 0);

    // Load posts
    const { data: postsData } = await supabase
      .from('cohort_posts')
      .select('*')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Load user's votes
    const { data: votes } = await supabase
      .from('cohort_votes')
      .select('post_id, reply_id')
      .eq('user_id', user.id);

    const votedPostIds = new Set(votes?.filter(v => v.post_id).map(v => v.post_id) || []);

    const postsWithVotes = (postsData || []).map((p: any) => ({
      ...p,
      voted: votedPostIds.has(p.id),
      showReplies: false,
      replies: [],
    }));

    setPosts(postsWithVotes);

    // Load member names
    const { data: members } = await supabase
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', cohortId);

    if (members) {
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profiles) {
        const nameMap: Record<string, string> = {};
        for (const p of profiles) {
          nameMap[p.id] = p.full_name || 'Anonymous';
        }
        setNames(nameMap);
      }
    }

    setLoading(false);
  }

  async function createPost() {
    if (!newPost.trim() || !userId || posting) return;
    setPosting(true);

    const { data, error } = await supabase
      .from('cohort_posts')
      .insert({
        cohort_id: cohortId,
        user_id: userId,
        content: newPost.trim(),
      })
      .select('*')
      .single();

    if (data && !error) {
      setPosts([{ ...data, voted: false, showReplies: false, replies: [] }, ...posts]);
      setNewPost('');
    }
    setPosting(false);
  }

  async function createReply(postId: string) {
    if (!replyText.trim() || !userId) return;

    const { data, error } = await supabase
      .from('cohort_replies')
      .insert({
        post_id: postId,
        user_id: userId,
        content: replyText.trim(),
      })
      .select('*')
      .single();

    if (data && !error) {
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, reply_count: p.reply_count + 1, replies: [...(p.replies || []), { ...data, voted: false }] }
          : p
      ));
      setReplyText('');
      setReplyingTo(null);
    }
  }

  async function toggleReplies(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.showReplies) {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, showReplies: false } : p));
      return;
    }

    const { data: replies } = await supabase
      .from('cohort_replies')
      .select('*')
      .eq('post_id', postId)
      .order('created_at');

    const { data: votes } = await supabase
      .from('cohort_votes')
      .select('reply_id')
      .eq('user_id', userId!);

    const votedReplyIds = new Set(votes?.filter(v => v.reply_id).map(v => v.reply_id) || []);

    const repliesWithVotes = (replies || []).map((r: any) => ({
      ...r,
      voted: votedReplyIds.has(r.id),
    }));

    // Load names for reply authors that we don't have yet
    const unknownIds = repliesWithVotes
      .map((r: any) => r.user_id)
      .filter((id: string) => !names[id]);

    if (unknownIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', unknownIds);

      if (profiles) {
        const newNames = { ...names };
        for (const p of profiles) {
          newNames[p.id] = p.full_name || 'Anonymous';
        }
        setNames(newNames);
      }
    }

    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, showReplies: true, replies: repliesWithVotes } : p
    ));
  }

  async function upvotePost(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post || !userId) return;

    if (post.voted) {
      await supabase.from('cohort_votes').delete().eq('user_id', userId).eq('post_id', postId);
      await supabase.from('cohort_posts').update({ upvotes: Math.max(0, post.upvotes - 1) }).eq('id', postId);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: p.upvotes - 1, voted: false } : p));
    } else {
      await supabase.from('cohort_votes').insert({ user_id: userId, post_id: postId });
      await supabase.from('cohort_posts').update({ upvotes: post.upvotes + 1 }).eq('id', postId);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: p.upvotes + 1, voted: true } : p));
    }
  }

  async function upvoteReply(postId: string, replyId: string) {
    if (!userId) return;
    const post = posts.find(p => p.id === postId);
    const reply = post?.replies?.find(r => r.id === replyId);
    if (!reply) return;

    if (reply.voted) {
      await supabase.from('cohort_votes').delete().eq('user_id', userId).eq('reply_id', replyId);
      await supabase.from('cohort_replies').update({ upvotes: Math.max(0, reply.upvotes - 1) }).eq('id', replyId);
    } else {
      await supabase.from('cohort_votes').insert({ user_id: userId, reply_id: replyId });
      await supabase.from('cohort_replies').update({ upvotes: reply.upvotes + 1 }).eq('id', replyId);
    }

    setPosts((prev) => prev.map((p) =>
      p.id === postId
        ? {
            ...p,
            replies: p.replies?.map((r) =>
              r.id === replyId
                ? { ...r, upvotes: reply.voted ? r.upvotes - 1 : r.upvotes + 1, voted: !r.voted }
                : r
            ),
          }
        : p
    ));
  }

  async function leaveCohort() {
    if (!userId || !confirm('Leave this cohort permanently? You can always rejoin later.')) return;
    await supabase.from('cohort_members').delete()
      .eq('cohort_id', cohortId).eq('user_id', userId);
    router.push('/community');
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading feed...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      {/* Cohort Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-3 items-center">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-2xl"
            style={{ background: 'rgba(245,158,11,0.06)' }}>
            {cohort?.icon || '👥'}
          </div>
          <div>
            <h2 className="text-xl font-semibold"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
              {cohort?.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {memberCount} members · {cohort?.category || 'General'}
            </p>
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
            style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)' }}>
            Leave
          </button>
        </div>
      </div>

      {/* New Post */}
      <div className="rounded-xl p-4 mb-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <textarea
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
          placeholder="Share a win, ask a question, or spark a discussion..."
          rows={3}
          className="w-full px-3.5 py-2.5 text-sm rounded-lg resize-none mb-2.5"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
        />
        <div className="flex justify-end">
          <button onClick={createPost}
            disabled={!newPost.trim() || posting}
            className="px-5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}>
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Be the first to post in this cohort!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div key={post.id} className="rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Post */}
              <div className="p-4">
                <div className="flex gap-2.5 items-start">
                  {/* Upvote */}
                  <div className="flex flex-col items-center gap-0.5 pt-1">
                    <button onClick={() => upvotePost(post.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all"
                      style={{
                        background: post.voted ? 'rgba(245,158,11,0.15)' : 'transparent',
                        color: post.voted ? 'var(--accent)' : 'var(--text-dim)',
                        border: `1px solid ${post.voted ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                      }}>
                      ▲
                    </button>
                    <span className="text-xs font-semibold" style={{ color: post.voted ? 'var(--accent)' : 'var(--text-dim)' }}>
                      {post.upvotes}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold"
                        style={{
                          background: 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.27))',
                          border: '1px solid rgba(245,158,11,0.33)',
                          color: 'var(--accent)',
                        }}>
                        {getInitials(names[post.user_id] || 'Anonymous')}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                        {names[post.user_id] || 'Anonymous'}
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
                        💬 {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                      </button>
                      <button onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyText(''); }}
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
                  <div className="flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createReply(post.id); }}
                      placeholder="Write a reply..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg"
                      style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
                      autoFocus
                    />
                    <button onClick={() => createReply(post.id)}
                      disabled={!replyText.trim()}
                      className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      Reply
                    </button>
                  </div>
                </div>
              )}

              {/* Replies */}
              {post.showReplies && post.replies && post.replies.length > 0 && (
                <div className="px-4 pb-3 pl-14"
                  style={{ borderTop: '1px solid var(--border)' }}>
                  {post.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2 py-2.5"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <button onClick={() => upvoteReply(post.id, reply.id)}
                        className="flex flex-col items-center gap-0 shrink-0"
                        style={{ color: reply.voted ? 'var(--accent)' : 'var(--text-dim)' }}>
                        <span className="text-[10px]">▲</span>
                        <span className="text-[10px] font-semibold">{reply.upvotes}</span>
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold"
                            style={{
                              background: 'linear-gradient(135deg, rgba(139,92,246,0.13), rgba(139,92,246,0.27))',
                              border: '1px solid rgba(139,92,246,0.33)',
                              color: 'var(--purple)',
                            }}>
                            {getInitials(names[reply.user_id] || 'Anonymous')}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                            {names[reply.user_id] || 'Anonymous'}
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
