'use client';

// The Community feed: composer, category filter, posts, and "Load more".

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { loadMorePosts } from '@/app/(app)/community/actions';
import type { CategoryView, PostView } from '@/lib/rx/feed-types';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import '@/styles/rx-community.css';

export default function FeedClient({ initialPosts, initialNext, categories, category, me, canModerate }: {
  initialPosts: PostView[]; initialNext: string | null; categories: CategoryView[]; category: string | null;
  me: { name: string; avatarUrl: string | null; userId: string }; canModerate: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [next, setNext] = useState(initialNext);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  // A refresh from the server (after posting) replaces the list. Done while rendering, as React recommends.
  const [seen, setSeen] = useState(initialPosts);
  if (seen !== initialPosts) { setSeen(initialPosts); setPosts(initialPosts); setNext(initialNext); }

  const href = (name: string | null) => (name ? `/community?category=${encodeURIComponent(name)}` : '/community');

  return (
    <div className="rx-stack">
      <PostComposer categories={categories} name={me.name} avatarUrl={me.avatarUrl} userId={me.userId} defaultCategory={category} onPosted={() => router.refresh()} />

      <nav className="rx-feed-chips" aria-label="Filter by category">
        <Link href={href(null)} className="rx-chip" aria-pressed={!category} scroll={false}>{!category && <Check aria-hidden />}All</Link>
        {categories.map((c) => (
          <Link key={c.slug} href={href(c.name)} className="rx-chip" aria-pressed={category === c.name} scroll={false}>{category === c.name && <Check aria-hidden />}{c.name}</Link>
        ))}
      </nav>

      {posts.map((p) => <PostCard key={p.id} post={p} canModerate={canModerate} onRemoved={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))} />)}

      {posts.length === 0 && (
        <div className="rx-card rx-empty rx-stack-sm">
          <p className="rx-p">{category ? `No posts in ${category} yet. Be the first.` : 'Nothing here yet. Be the first to share something.'}</p>
          {category && <Link href="/community" className="rx-btn secondary">Show all</Link>}
        </div>
      )}

      {!category && posts.length < 3 && (
        <div className="rx-soft rx-stack-sm">
          <p className="rx-label">Not sure what to post?</p>
          <ul className="rx-sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>Introduce yourself: your city, and what you’re building or learning.</li>
            <li>Share the practice you set this week and how day one went.</li>
            <li>Ask a question you’re stuck on. Someone here has been there.</li>
          </ul>
        </div>
      )}

      {next && (
        <div style={{ textAlign: 'center' }}>
          <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => {
            setError('');
            try { const r = await loadMorePosts(category, next); setPosts((cur) => [...cur, ...r.posts.filter((p) => !cur.some((x) => x.id === p.id))]); setNext(r.next); }
            catch { setError('We couldn’t load more. Try again.'); }
          })}>{pending ? 'Loading…' : 'Load more'}</button>
          {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
