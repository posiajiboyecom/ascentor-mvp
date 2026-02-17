import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog — Ascentor',
  description: 'Leadership insights, career strategies, and African professional development from the Ascentor team.',
};

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, author_name, published_at, read_time_minutes, cover_image_url')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FFFBF5', color: '#1A1A2E', minHeight: '100vh' }}>

      <nav className="px-4 lg:px-8 py-4" style={{ borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">⬆</span>
            <span className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>Ascentor</span>
          </Link>
          <div className="flex items-center gap-4 text-sm" style={{ color: '#4B5563' }}>
            <Link href="/pricing" className="hidden sm:inline hover:text-amber-600">Pricing</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg font-semibold" style={{ background: '#F59E0B', color: '#000' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <section className="py-16 lg:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Blog</span>
          <h1 className="text-3xl lg:text-4xl font-bold mt-2 mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Leadership Insights
          </h1>
          <p cl