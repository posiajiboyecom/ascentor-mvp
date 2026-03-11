// ============================================================
// app/p/[subdomain]/community/page.tsx
// Partner community — peer discussions scoped to this platform.
// Does NOT re-export the main app's circles page (which shows
// global cohorts that partner members are never enrolled in).
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Post {
  id: string;
  author_name: string;
  author_email: string;
  body: string;
  created_at: string;
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#14B8A6', '#8B5CF6', '#E8A020', '#10B981', '#3B82F6', '#EC4899'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: `${color}22`, border: `1px solid ${color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color, flexShrink: 0,
    }}>
      {initials || '?'}
    </div>
  );
}

export default function PartnerCommunityPage() {
  const supabase = createClient();
  const [posts, setPosts]         = useState<Post[]>([]);
  const [loading, setLoading]     = useState(true);
  const [body, setBody]           = useState('');
  const [posting, setPosting]     = useState(false);
  const [user, setUser]           = useState<{ id: string; email: string; name: string } | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [error, setError]         = useState('');

  useEffect(() => {
    const subdomain = window.location.pathname.split('/')[2];

    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return;

      const [profileRes, partnerRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', u.id).single(),
        supabase.from('partners').select('id').eq('subdomain', subdomain).single(),
      ]);

      setUser({
        id:    u.id,
        email: u.email || '',
        name:  profileRes.data?.full_name || u.email?.split('@')[0] || 'Member',
      });

      if (partnerRes.data) {
        setPartnerId(partnerRes.data.id);
        await loadPosts(partnerRes.data.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadPosts = async (pid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('partner_community_posts')
      .select('*')
      .eq('partner_id', pid)
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts(data || []);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!body.trim() || !user || !partnerId) return;
    setPosting(true); setError('');

    const { error: err } = await supabase.from('partner_community_posts').insert({
      partner_id:   partnerId,
      user_id:      user.id,
      author_name:  user.name,
      author_email: user.email,
      body:         body.trim(),
      created_at:   new Date().toISOString(),
    });

    if (err) {
      if (err.code === '42P01') {
        setError('Community table not set up yet — run the partner migration SQL.');
      } else {
        setError(err.message);
      }
    } else {
      setBody('');
      await loadPosts(partnerId);
    }
    setPosting(false);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
          Community
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Connect with fellow members on this platform.
        </p>
      </div>

      {user && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '16px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar name={user.name} />
            <div style={{ flex: 1 }}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Share something with the community..."
                rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, marginBottom: 10 }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
              />
              {error && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{error}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handlePost} disabled={posting || !body.trim()}
                  style={{
                    padding: '8px 20px', borderRadius: 10, border: 'none',
                    background: 'var(--accent)', color: '#000',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    opacity: (posting || !body.trim()) ? 0.5 : 1,
                  }}>
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          Loading...
        </div>
      ) : posts.length === 0 ? (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            No posts yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Be the first to start a conversation.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => (
            <div key={post.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Avatar name={post.author_name} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {post.author_name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {post.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
