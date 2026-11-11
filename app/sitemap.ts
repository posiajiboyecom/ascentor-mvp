// app/sitemap.ts
// Dynamic XML sitemap - served at /sitemap.xml automatically by Next.js.
// Includes all public marketing routes + published blog posts from Supabase.
//
// Uses a bare supabase-js client (not the cookie-bound server client)
// because sitemaps are generated outside a user request context.
// Only publicly-readable data (published posts) is queried.

import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600; // regenerate at most hourly

// Only canonical, indexable, 200-status pages belong here. Left out on purpose:
//   /how-it-works, /who-its-for, /mentor-apply, /products, /summit (they redirect, see next.config.ts),
//   /signup and /login (gated / noindex), /partner (partner portal, signed-in), /events (no index page).
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                               priority: 1.0, changeFrequency: 'weekly' },
  { path: '/elevation-summit',              priority: 1.0, changeFrequency: 'weekly' },
  { path: '/about',                         priority: 0.8, changeFrequency: 'monthly' },
  { path: '/movement',                      priority: 0.8, changeFrequency: 'monthly' },
  { path: '/manifesto',                     priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blog',                          priority: 0.9, changeFrequency: 'daily' },
  { path: '/shop',                          priority: 0.8, changeFrequency: 'weekly' },
  { path: '/donate',                        priority: 0.6, changeFrequency: 'monthly' },
  { path: '/newsletter',                    priority: 0.6, changeFrequency: 'monthly' },
  { path: '/free/leadership-playbook',      priority: 0.6, changeFrequency: 'monthly' },
  { path: '/free/promotion-blueprint',      priority: 0.6, changeFrequency: 'monthly' },
  { path: '/free/salary-scripts',           priority: 0.6, changeFrequency: 'monthly' },
  { path: '/careers',                       priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contact',                       priority: 0.5, changeFrequency: 'yearly' },
  { path: '/privacy',                       priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms',                         priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Published blog posts - fail soft: a Supabase hiccup must never 500 the sitemap.
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1000);

    for (const post of posts ?? []) {
      entries.push({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at || post.published_at || now),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch {
    // Sitemap still serves static routes if the DB query fails.
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: products } = await supabase.from('products').select('id, slug').eq('published', true).limit(1000);
    for (const p of products ?? []) {
      entries.push({ url: `${SITE_URL}/shop/${p.slug || p.id}`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch {
    // Shop tables may not exist yet.
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: events } = await supabase.from('public_events').select('slug, updated_at').eq('is_published', true).limit(500);
    for (const e of events ?? []) {
      if (!e.slug) continue;
      entries.push({ url: `${SITE_URL}/events/${e.slug}`, lastModified: new Date(e.updated_at || now), changeFrequency: 'weekly', priority: 0.6 });
    }
  } catch {
    // Events are optional in the sitemap.
  }

  return entries;
}
