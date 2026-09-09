'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import SageLoader from '@/components/SageLoader';
import ScrollToTop from '@/components/ScrollToTop';

type EventItem = {
  slug: string;
  title: string;
  tagline: string | null;
  event_date: string | null;
};

// Routes that already have their own authenticated/app shell.
const HIDE_SHELL = [
  '/admin',
  '/api',
  '/auth',
  '/coach',
  '/community',
  '/dashboard',
  '/experts',
  '/forgot-password',
  '/learn',
  '/login',
  '/referral',
  '/reset-password',
  '/signup',
  '/account',
  '/onboarding',
  '/partner/',
  '/p/',
];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const supabase = createClient();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [hasBlogPosts, setHasBlogPosts] = useState(false);
  const [preloading, setPreloading] = useState(true);

  useEffect(() => {
    fetch('/api/events/list')
      .then((r) => r.json())
      .then((d) => {
        if (d.events) setEvents(d.events);
      })
      .catch(() => {});

    Promise.resolve(
      supabase
        .from('blog_posts')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true)
    )
      .then(({ count }) => setHasBlogPosts((count || 0) > 0))
      .catch(() => {});
  }, [supabase]);

  useEffect(() => {
    const id = setTimeout(() => setPreloading(false), 2200);
    return () => clearTimeout(id);
  }, []);

  const hidden = HIDE_SHELL.some((p) => pathname.startsWith(p));
  if (hidden) return <>{children}</>;

  return (
    <>
      <PublicHeader events={events} hasBlogPosts={hasBlogPosts} />
      <div style={{ display: preloading ? 'none' : 'block' }}>{children}</div>
      <PublicFooter hasBlogPosts={hasBlogPosts} />
      <ScrollToTop />
      {preloading && <SageLoader fullScreen />}
    </>
  );
}
