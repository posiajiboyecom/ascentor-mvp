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
  const params = useParams();
  const cohortId = Array.isArray(params.cohortId) ? params.cohortId[0] : (params.cohortId as string);
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

  useEffect(() => {
    if (!cohortId) return; // wait for params to hydrate
    loadAll();
  }, [cohortId]);

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Check membership — retry up to 3x to handle post-join race condition
    let membership = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('cohort_members')
        .select('id')
        .eq('cohort_id', String(cohortId))
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) console.warn('[CohortFeed] membership check error:', error.message);
      membership = data;
      if (membership) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 800)); // wait then retry
    }

    if (!membership) {
      console.warn('[CohortFeed] Not a member of cohort:', cohortId, '— redirecting');
      setLoading(false);
      router.push('/community');
      return;
    }

    // Load cohort info
    const { data: cohortData } = await supabase
      .from('cohorts')
      .select('*')
      .eq('id', String(cohortId))
      .single();
    setCohort(cohortData);
    setMemberCount(cohortData?.member_count || 0);

    // Load posts
    const { data: postsData } = await supabase
      .from('cohort_posts')
      .select('*')
      .eq('cohort_id', String(cohortId))
      .order('created_at', { ascending: false })
      .limit(50);

    // Load user's votes
    const { data: votes } = await supabase
      .from('cohort_votes')
      .select('post_id, reply_id')
      .eq('user_id', user.id);

    const votedPostIds = new Set(votes?.filter((v: any) => v.post_id).map((v: any) => v.post_id) || []);

    // Fetch author names for all post authors
    const postAuthorIds = [...new Set((postsData || []).map((p: any) => p.user_id))];
    let authorMap: Record<string, string> = {};
    if (postAuthorIds.length > 0) {
      const { data: authorProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', postAuthorIds);
      (authorProfiles || []).forEach((p: any) => {
        authorMap[p.id] = p.full_name || 'Member';
      });
    }

    const postsWithVotes = (postsData || []).map((p: any) => ({
      ...p,
      upvotes: p.upvotes || 0,
      authorName: authorMap[p.user_id] || 'Member',
      voted: votedPostIds.has(p.id),
      showReplies: false,
      replies: [],
    }));

    setPosts(postsWithVotes);
    setLoading(false);
  }

  async function createPost() {
    if (!newPost.trim() || !userId || posting) return;
    setPosting(true);

    const { data, error } = await supabase
      .from('cohort_posts')
      .insert({
        cohort_id: String(cohortId),
        user_id: userId,
        content: newPost.trim(),
      })
      .select('*')
      .single();

    if (data && !error) {
      setPosts([{ ...data, upvotes: 0, authorName: 'You', voted: false, showReplies: false, replies: [] }, ...posts]);
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
          ? { ...p, reply_count: p.reply_count + 1, replies: [...(p.replies || []), { ...data, upvotes: 0, authorName: 'You', voted: false }] }
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

    const votedReplyIds = new Set(votes?.filter((v: any) => v.reply_id).map((v: any) => v.reply_id) || []);

    // Fetch reply author names
    const replyAuthorIds = [...new Set((replies || []).map((r: any) => r.user_id))];
    let replyAuthorMap: Record<string, string> = {};
    if (replyAuthorIds.length > 0) {
      const { data: replyProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', replyAuthorIds);
      (replyProfiles || []).forEach((p: any) => {
        replyAuthorMap[p.id] = p.full_name || 'Member';
      });
    }

    const repliesWithVotes = (replies || []).map((r: any) => ({
      ...r,
      upvotes: r.upvotes || 0,
      authorName: replyAuthorMap[r.user_id] || 'Member',
      voted: votedReplyIds.has(r.id),
    }));

    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, showReplies: true, replies: repliesWithVotes } : p
    ));
  }

  async function upvotePost(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post || !userId) return;
    const current = post.upvotes || 0;

    if (post.voted) {
      await supabase.from('cohort_votes').delete().eq('user_id', userId).eq('post_id', postId);
      const newVal = Math.max(0, current - 1);
      await supabase.from('cohort_posts').update({ upvotes: newVal }).eq('id', postId);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: newVal, voted: false } : p));
    } else {
      await supabase.from('cohort_votes').insert({ user_id: userId, post_id: postId });
      const newVal = current + 1;
      await supabase.from('cohort_posts').update({ upvotes: newVal }).eq('id', postId);
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: newVal, voted: true } : p));
    }
  }

  async function upvoteReply(postId: string, replyId: string) {
    if (!userId) return;
    const post = posts.find(p => p.id === postId);
    const reply = post?.replies?.find(r => r.id === replyId);
    if (!reply) return;
    const current = reply.upvotes || 0;

    if (reply.voted) {
      const newVal = Math.max(0, current - 1);
      await supabase.from('cohort_votes').delete().eq('user_id', userId).eq('reply_id', replyId);
      await supabase.from('cohort_replies').update({ upvotes: newVal }).eq('id', replyId);
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, replies: p.replies?.map((r) => r.id === replyId ? { ...r, upvotes: newVal, voted: false } : r) }
          : p
      ));
    } else {
      const newVal = current + 1;
      await supabase.from('cohort_votes').insert({ user_id: userId, reply_id: replyId });
      await supabase.from('cohort_replies').update({ upvotes: newVal }).eq('id', replyId);
      setPosts((prev) => prev.map((p) =>
        p.id === postId
          ? { ...p, replies: p.replies?.map((r) => r.id === replyId ? { ...r, upvotes: newVal, voted: true } : r) }
          : p
      ));
    }
  }

  async function leaveCohort() {
    if (!userId || !confirm('Leave this cohort permanently? You can always rejoin later.')) return;
    await supabase.from('cohort_members').delete()
      .eq('cohort_id', String(cohortId)).eq('user_id', userId);
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
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
              {cohort?.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {memberCount} members · {cohort?.category}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Step Out — go back without leaving */}
          <button onClick={() => router.push('/community')}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--accent)', border: '1px solid rgba(245,158,11,0.2)' }}>
            ← Step Out
          </button>
          {/* Leave — actually leave the cohort */}
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
                        👤
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
