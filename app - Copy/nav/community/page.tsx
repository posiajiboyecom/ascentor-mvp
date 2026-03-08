'use client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · Community Page — Supabase-connected
//
// WHAT CHANGED (was fully hardcoded):
//   - Loads user's cohort from cohort_members
//   - Loads cohort_posts with author profiles
//   - New posts INSERT to cohort_posts (persisted across refreshes)
//   - Upvotes upsert to cohort_votes + update cohort_posts.upvotes
//   - Real member list from profiles
//   - Empty states: no cohort, no posts
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Post {
  id:              string;
  cohort_id:       string;
  user_id:         string;
  content:         string;
  upvotes:         number;
  created_at:      string;
  author_name:     string;
  author_initials: string;
  liked_by_me:     boolean;
  reply_count:     number;
}

interface Member {
  user_id:  string;
  initials: string;
  name:     string;
}

const COLORS = ['var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--teal)', 'var(--success)'];

function SkeletonPost() {
  return (
    <div className="rounded-xl p-5 mb-3 animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex gap-2.5">
        <div className="w-9 h-9 rounded-full shrink-0" style={{ background: 'var(--bg-input)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-full" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-2/3" style={{ background: 'var(--bg-input)' }} />
        </div>
      </div>
    </div>
  );
}

function relTime(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CommunityPage() {
  const supabase = createClient();
  const [cohort,   setCohort]   = useState<any>(null);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [posts,    setPosts]    = useState<Post[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [posting,  setPosting]  = useState(false);
  const [newPost,  setNewPost]  = useState('');
  const [userId,   setUserId]   = useState<string | null>(null);
  const [postErr,  setPostErr]  = useState('');

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Find user's first cohort
    const { data: memberships } = await supabase
      .from('cohort_members').select('cohort_id').eq('user_id', user.id).limit(1);
    if (!memberships?.length) { setLoading(false); return; }

    const cohortId = memberships[0].cohort_id;

    const [cohortRes, membersRes, postsRes, votesRes] = await Promise.all([
      supabase.from('cohorts').select('*').eq('id', cohortId).single(),
      supabase.from('cohort_members').select('user_id, profiles(full_name)').eq('cohort_id', cohortId).limit(20),
      supabase.from('cohort_posts').select('*').eq('cohort_id', cohortId).order('created_at', { ascending: false }).limit(40),
      supabase.from('cohort_votes').select('post_id').eq('user_id', user.id).is('reply_id', null),
    ]);

    if (cohortRes.data) setCohort(cohortRes.data);

    const memberList: Member[] = (membersRes.data ?? []).map((m: any) => {
      const name = m.profiles?.full_name ?? 'Member';
      return {
        user_id:  m.user_id,
        name,
        initials: name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
      };
    });
    setMembers(memberList);

    const authorMap = new Map(memberList.map((m) => [m.user_id, m]));
    const voted     = new Set((votesRes.data ?? []).map((v: any) => v.post_id));

    const enriched: Post[] = (postsRes.data ?? []).map((p: any) => {
      const a = authorMap.get(p.user_id);
      const name = a?.name ?? 'Member';
      return {
        ...p,
        author_name:     name,
        author_initials: a?.initials ?? name[0]?.toUpperCase() ?? '?',
        liked_by_me:     voted.has(p.id),
        reply_count:     0,
      };
    });
    setPosts(enriched);
    setLoading(false);
  }

  async function handlePost() {
    const text = newPost.trim();
    if (!text || posting || !cohort || !userId) return;
    setPosting(true);
    setPostErr('');

    const { data, error } = await supabase
      .from('cohort_posts')
      .insert({ cohort_id: cohort.id, user_id: userId, content: text, upvotes: 0, created_at: new Date().toISOString() })
      .select().single();

    if (error) {
      setPostErr('Failed to post. Please try again.');
      setPosting(false);
      return;
    }

    const me = members.find((m) => m.user_id === userId);
    const name = me?.name ?? 'You';
    setPosts((prev) => [{
      ...(data as any),
      author_name:     name,
      author_initials: me?.initials ?? name[0]?.toUpperCase() ?? 'Y',
      liked_by_me:     false,
      reply_count:     0,
    }, ...prev]);
    setNewPost('');
    setPosting(false);
  }

  async function handleUpvote(postId: string, liked: boolean) {
    if (!userId) return;
    // Optimistic
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, upvotes: p.upvotes + (liked ? -1 : 1), liked_by_me: !liked } : p
    ));
    if (liked) {
      await supabase.from('cohort_votes').delete().eq('user_id', userId).eq('post_id', postId).is('reply_id', null);
    } else {
      await supabase.from('cohort_votes').insert({ user_id: userId, post_id: postId, created_at: new Date().toISOString() });
    }
    const current = posts.find((p) => p.id === postId);
    if (current) {
      await supabase.from('cohort_posts').update({ upvotes: current.upvotes + (liked ? -1 : 1) }).eq('id', postId);
    }
  }

  if (!loading && !cohort) {
    return (
      <div className="animate-fade-up py-6">
        <h2 className="text-2xl font-semibold mb-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
          Your Circle
        </h2>
        <div className="rounded-xl p-8 text-center mt-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
            You&apos;re not in a circle yet
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Mentorship circles are small groups matched by career stage. Contact support to get placed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-2xl font-semibold mb-0.5"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            {loading ? 'Your Circle' : cohort?.name ?? 'Your Circle'}
          </h2>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {loading ? '…' : `${cohort?.category ?? 'Mentorship Circle'} · ${members.length} members`}
          </p>
        </div>
        {cohort && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
            Active
          </span>
        )}
      </div>

      {/* Members strip */}
      {!loading && members.length > 0 && (
        <div className="rounded-xl p-3.5 mb-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Members</p>
          <div className="flex gap-2 flex-wrap">
            {members.map((m, i) => (
              <div key={m.user_id} title={m.name}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={{
                  background: `linear-gradient(135deg, ${COLORS[i % 5]}22, ${COLORS[i % 5]}44)`,
                  border:     `1.5px solid ${COLORS[i % 5]}55`,
                  color:       COLORS[i % 5],
                }}>
                {m.initials}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      {cohort && (
        <div className="rounded-xl p-3.5 mb-5"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handlePost(); }}
            placeholder="Share a win, ask a question, or check in with your circle…"
            rows={3}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg resize-none mb-2.5"
            style={{ background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none' }}
          />
          {postErr && <p className="text-xs mb-2" style={{ color: 'var(--error)' }}>{postErr}</p>}
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: 'var(--text-dim)' }}>⌘↵ to post</span>
            <button onClick={handlePost} disabled={!newPost.trim() || posting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#000' }}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading
        ? Array.from({ length: 3 }).map((_, i) => <SkeletonPost key={i} />)
        : posts.length === 0
          ? (
            <div className="rounded-xl p-8 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No posts yet. Be the first to share something with your circle.
              </p>
            </div>
          )
          : posts.map((post) => (
            <div key={post.id} className="rounded-xl p-5 mb-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex gap-2.5 items-start">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: post.user_id === userId
                      ? 'linear-gradient(135deg, rgba(232,160,32,0.13), rgba(232,160,32,0.27))'
                      : 'linear-gradient(135deg, rgba(59,130,246,0.13), rgba(59,130,246,0.27))',
                    border: post.user_id === userId
                      ? '1.5px solid rgba(232,160,32,0.33)' : '1.5px solid rgba(59,130,246,0.33)',
                    color: post.user_id === userId ? 'var(--accent)' : 'var(--blue)',
                  }}>
                  {post.author_initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {post.user_id === userId ? 'You' : post.author_name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{relTime(post.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                    {post.content}
                  </p>
                  <div className="flex gap-4 mt-2.5">
                    <button onClick={() => handleUpvote(post.id, post.liked_by_me)}
                      className="text-xs flex items-center gap-1.5 transition-all"
                      style={{ color: post.liked_by_me ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {post.liked_by_me ? '♥' : '♡'} {post.upvotes}
                    </button>
                    <button className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      💬 {post.reply_count}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
      }
    </div>
  );
}
