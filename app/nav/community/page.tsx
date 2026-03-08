'use client';

// ASCENTOR · Global Community — Supabase-persisted

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CommunityPost {
  id:          string;
  user_id:     string;
  content:     string;
  category:    string;
  upvotes:     number;
  reply_count: number;
  is_pinned:   boolean;
  created_at:  string;
  author_name:     string;
  author_initials: string;
  voted:           boolean;
  replies?:        CommunityReply[];
  showReplies?:    boolean;
}

interface CommunityReply {
  id:         string;
  post_id:    string;
  user_id:    string;
  content:    string;
  upvotes:    number;
  created_at: string;
  author_name:     string;
  author_initials: string;
  voted:           boolean;
}

const CATEGORIES = [
  { id: 'all',            label: 'All',           emoji: '💬', color: 'var(--accent)' },
  { id: 'win',            label: 'Wins',           emoji: '🏆', color: '#10B981' },
  { id: 'question',       label: 'Questions',      emoji: '❓', color: '#3B82F6' },
  { id: 'resource',       label: 'Resources',      emoji: '📚', color: '#8B5CF6' },
  { id: 'accountability', label: 'Accountability', emoji: '🎯', color: '#E8A020' },
  { id: 'general',        label: 'General',        emoji: '💭', color: 'var(--text-dim)' },
];

const CAT_META: Record<string, typeof CATEGORIES[0]> = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function mkInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
}

function PostSkeleton() {
  return (
    <div className="rounded-xl p-5 mb-3 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-full shrink-0" style={{ background: 'var(--bg-input)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded w-1/4" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-full" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-3/4" style={{ background: 'var(--bg-input)' }} />
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  const [posts,       setPosts]       = useState<CommunityPost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [posting,     setPosting]     = useState(false);
  const [newPost,     setNewPost]     = useState('');
  const [category,    setCategory]    = useState('general');
  const [filter,      setFilter]      = useState('all');
  const [userId,      setUserId]      = useState<string | null>(null);
  const [postErr,     setPostErr]     = useState('');
  const [replyingTo,  setReplyingTo]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [submittingR, setSubmittingR] = useState(false);

  const userNamesRef = useRef<Record<string, string>>({});
  const userIdRef    = useRef<string | null>(null);

  const resolveName = useCallback(async (uid: string): Promise<string> => {
    if (userNamesRef.current[uid]) return userNamesRef.current[uid];
    const { data } = await supabase.from('profiles').select('full_name').eq('id', uid).single();
    const name = data?.full_name || 'Member';
    userNamesRef.current[uid] = name;
    return name;
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    userIdRef.current = user.id;
    setUserId(user.id);

    const [postsRes, votesRes] = await Promise.all([
      supabase.from('community_posts').select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60),
      supabase.from('community_votes').select('post_id').eq('user_id', user.id).is('reply_id', null),
    ]);

    const raw   = postsRes.data ?? [];
    const voted = new Set((votesRes.data ?? []).map((v: any) => v.post_id));
    const uids  = Array.from(new Set(raw.map((p: any) => p.user_id)));
    await Promise.all(uids.map(resolveName));

    const enriched: CommunityPost[] = raw.map((p: any) => {
      const name = userNamesRef.current[p.user_id] || 'Member';
      return { ...p, author_name: name, author_initials: mkInitials(name), voted: voted.has(p.id), replies: [], showReplies: false };
    });

    setPosts(enriched);
    setLoading(false);
  }, [supabase, resolveName]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel('community_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, async (payload) => {
        const p = payload.new as any;
        if (!p || p.user_id === userIdRef.current) return;
        const name = await resolveName(p.user_id);
        setPosts(prev => {
          if (prev.some(x => x.id === p.id)) return prev;
          return [{ ...p, author_name: name, author_initials: mkInitials(name), voted: false, replies: [], showReplies: false }, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, resolveName]);

  async function handlePost() {
    const text = newPost.trim();
    if (!text || posting || !userId) return;
    if (text.length > 2000) { setPostErr('Posts must be under 2000 characters.'); return; }
    setPosting(true); setPostErr('');

    const { data, error } = await supabase.from('community_posts')
      .insert({ user_id: userId, content: text, category, upvotes: 0, reply_count: 0, is_pinned: false })
      .select().single();

    if (error) { setPostErr('Failed to post. Please try again.'); setPosting(false); return; }

    const name = userNamesRef.current[userId] || 'You';
    setPosts(prev => [{ ...(data as any), author_name: name, author_initials: mkInitials(name), voted: false, replies: [], showReplies: false }, ...prev]);
    setNewPost('');
    setPosting(false);
  }

  async function handleUpvote(postId: string, voted: boolean) {
    if (!userId) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + (voted ? -1 : 1), voted: !voted } : p));
    if (voted) {
      await supabase.from('community_votes').delete().eq('user_id', userId).eq('post_id', postId).is('reply_id', null);
      await supabase.rpc('increment_community_upvotes', { p_id: postId, delta: -1 });
    } else {
      await supabase.from('community_votes').insert({ user_id: userId, post_id: postId });
      await supabase.rpc('increment_community_upvotes', { p_id: postId, delta: 1 });
    }
  }

  async function loadReplies(postId: string) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const toggled = !post.showReplies;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, showReplies: toggled } : p));
    if (!toggled || (post.replies?.length ?? 0) > 0) return;

    const [repliesRes, votesRes] = await Promise.all([
      supabase.from('community_replies').select('*').eq('post_id', postId).order('created_at'),
      supabase.from('community_votes').select('reply_id').eq('user_id', userId ?? '').not('reply_id', 'is', null),
    ]);

    const rawR   = repliesRes.data ?? [];
    const votedR = new Set((votesRes.data ?? []).map((v: any) => v.reply_id));
    await Promise.all(Array.from(new Set(rawR.map((r: any) => r.user_id))).map(resolveName));

    const enriched: CommunityReply[] = rawR.map((r: any) => {
      const name = userNamesRef.current[r.user_id] || 'Member';
      return { ...r, author_name: name, author_initials: mkInitials(name), voted: votedR.has(r.id) };
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, replies: enriched } : p));
  }

  async function handleReply(postId: string) {
    const text = replyText.trim();
    if (!text || submittingR || !userId) return;
    setSubmittingR(true);
    const { data, error } = await supabase.from('community_replies')
      .insert({ post_id: postId, user_id: userId, content: text, upvotes: 0 })
      .select().single();
    if (!error && data) {
      const name = userNamesRef.current[userId] || 'You';
      const r: CommunityReply = { ...(data as any), author_name: name, author_initials: mkInitials(name), voted: false };
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, reply_count: p.reply_count + 1, replies: [...(p.replies ?? []), r], showReplies: true } : p
      ));
      await supabase.rpc('increment_community_reply_count', { p_id: postId, delta: 1 });
    }
    setReplyText(''); setReplyingTo(null); setSubmittingR(false);
  }

  async function handleReplyUpvote(postId: string, replyId: string, voted: boolean) {
    if (!userId) return;
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, replies: (p.replies ?? []).map(r => r.id === replyId ? { ...r, upvotes: r.upvotes + (voted ? -1 : 1), voted: !voted } : r) }
        : p
    ));
    if (voted) {
      await supabase.from('community_votes').delete().eq('user_id', userId).eq('reply_id', replyId);
      await supabase.rpc('increment_community_reply_upvotes', { r_id: replyId, delta: -1 });
    } else {
      await supabase.from('community_votes').insert({ user_id: userId, reply_id: replyId });
      await supabase.rpc('increment_community_reply_upvotes', { r_id: replyId, delta: 1 });
    }
  }

  const displayPosts = filter === 'all' ? posts : posts.filter(p => p.category === filter);

  return (
    <div className="animate-fade-up py-6" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="mb-5">
        <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>Community</h2>
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Wins, questions, and accountability — for African professionals</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setFilter(cat.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: filter === cat.id ? cat.color + '22' : 'var(--bg-card)', border: `1px solid ${filter === cat.id ? cat.color + '55' : 'var(--border)'}`, color: filter === cat.id ? cat.color : 'var(--text-muted)' }}>
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex gap-2 mb-3 flex-wrap">
          {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
              style={{ background: category === cat.id ? cat.color + '22' : 'transparent', border: `1px solid ${category === cat.id ? cat.color + '55' : 'var(--border)'}`, color: category === cat.id ? cat.color : 'var(--text-dim)' }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        <textarea value={newPost} onChange={e => { setNewPost(e.target.value); setPostErr(''); }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
          placeholder={category === 'win' ? 'Share a win — big or small…' : category === 'question' ? 'Ask the community…' : category === 'accountability' ? 'What are you committing to this week?' : 'Share something with the community…'}
          rows={3} className="w-full px-3.5 py-2.5 text-sm rounded-lg resize-none mb-3"
          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', fontFamily: "'Syne', sans-serif" }} />
        {postErr && <p className="text-xs mb-2" style={{ color: 'var(--error, #EF4444)' }}>{postErr}</p>}
        <div className="flex justify-between items-center">
          <span className="text-[11px]" style={{ color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>{newPost.length}/2000 · ⌘↵ to post</span>
          <button onClick={handlePost} disabled={!newPost.trim() || posting || !userId}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#000' }}>
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>

      {loading
        ? Array.from({ length: 4 }).map((_, i) => <PostSkeleton key={i} />)
        : displayPosts.length === 0
          ? (
            <div className="rounded-xl p-10 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>No posts yet</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Be the first to share something.</p>
            </div>
          )
          : displayPosts.map(post => {
              const cat  = CAT_META[post.category] ?? CAT_META['general'];
              const isMe = post.user_id === userId;
              return (
                <div key={post.id} className="rounded-xl mb-3 overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: `1px solid ${post.is_pinned ? 'rgba(232,160,32,0.3)' : 'var(--border)'}` }}>
                  {post.is_pinned && (
                    <div className="px-4 py-1.5 text-[10px] font-semibold"
                      style={{ background: 'rgba(232,160,32,0.06)', borderBottom: '1px solid rgba(232,160,32,0.15)', color: 'var(--accent)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em' }}>
                      📌 PINNED
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
                        style={{ background: isMe ? 'rgba(232,160,32,0.12)' : 'rgba(59,130,246,0.1)', border: isMe ? '1.5px solid rgba(232,160,32,0.35)' : '1.5px solid rgba(59,130,246,0.25)', color: isMe ? 'var(--accent)' : '#3B82F6' }}>
                        {post.author_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{isMe ? 'You' : post.author_name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: cat.color + '18', color: cat.color, border: `1px solid ${cat.color}30` }}>
                            {cat.emoji} {cat.label}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>{relTime(post.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>{post.content}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 pl-11">
                      <button onClick={() => handleUpvote(post.id, post.voted)} className="text-xs flex items-center gap-1.5 transition-all"
                        style={{ color: post.voted ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        <span style={{ fontSize: 14 }}>{post.voted ? '♥' : '♡'}</span> {post.upvotes}
                      </button>
                      <button onClick={() => loadReplies(post.id)} className="text-xs flex items-center gap-1.5 transition-all"
                        style={{ color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        💬 {post.reply_count} {post.reply_count === 1 ? 'reply' : 'replies'}
                        {post.reply_count > 0 && <span style={{ opacity: 0.5 }}>{post.showReplies ? '▲' : '▼'}</span>}
                      </button>
                      <button onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyText(''); }}
                        className="text-xs transition-all" style={{ color: replyingTo === post.id ? 'var(--accent)' : 'var(--text-muted)', fontFamily: "'DM Mono', monospace" }}>
                        Reply
                      </button>
                    </div>

                    {post.showReplies && (post.replies ?? []).length > 0 && (
                      <div className="mt-3 pl-11 flex flex-col gap-2.5">
                        {(post.replies ?? []).map(reply => {
                          const rIsMe = reply.user_id === userId;
                          return (
                            <div key={reply.id} className="flex items-start gap-2.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5"
                                style={{ background: rIsMe ? 'rgba(232,160,32,0.12)' : 'rgba(59,130,246,0.1)', border: rIsMe ? '1px solid rgba(232,160,32,0.3)' : '1px solid rgba(59,130,246,0.2)', color: rIsMe ? 'var(--accent)' : '#3B82F6' }}>
                                {reply.author_initials}
                              </div>
                              <div className="flex-1 rounded-lg px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{rIsMe ? 'You' : reply.author_name}</span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>{relTime(reply.created_at)}</span>
                                </div>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{reply.content}</p>
                                <button onClick={() => handleReplyUpvote(post.id, reply.id, reply.voted)}
                                  className="mt-1.5 text-[10px] flex items-center gap-1"
                                  style={{ color: reply.voted ? 'var(--accent)' : 'var(--text-dim)', fontFamily: "'DM Mono', monospace" }}>
                                  {reply.voted ? '♥' : '♡'} {reply.upvotes}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {replyingTo === post.id && (
                      <div className="mt-3 pl-11 flex gap-2 items-end">
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(post.id); }}
                          placeholder="Write a reply…" rows={2} autoFocus
                          className="flex-1 px-3 py-2 text-xs rounded-lg resize-none"
                          style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', fontFamily: "'Syne', sans-serif" }} />
                        <button onClick={() => handleReply(post.id)} disabled={!replyText.trim() || submittingR}
                          className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 flex-shrink-0"
                          style={{ background: 'var(--accent)', color: '#000' }}>
                          {submittingR ? '…' : '↑'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
      }
    </div>
  );
}
