import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Blog — Ascentor',
  description: 'Leadership insights, career strategies, and stories from Africa\'s next generation of leaders.',
};

export default async function BlogPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, author_name, published_at, read_time_min, cover_image_url')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', fontFamily: "'DM Sans', sans-serif" }}>

      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl" style={{ color: '#F59E0B' }}>⬆</span>
            <span className="text-lg font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>Ascentor</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm hidden md:block" style={{ color: '#6B7280' }}>Pricing</Link>
            <Link href="/signup" className="px-5 py-2 rounded-lg text-sm font-semibold" style={{ background: '#F59E0B', color: '#000' }}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-16 pb-8 text-center px-5">
        <h1 className="text-4xl md:text-5xl font-semibold mb-3"
          style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17' }}>
          Blog
        </h1>
        <p className="text-base max-w-lg mx-auto" style={{ color: '#6B7280' }}>
          Leadership insights and career strategies for Africa's ambitious professionals.
        </p>
      </section>

      <section className="pb-16 px-5">
        <div className="max-w-4xl mx-auto">
          {(!posts || posts.length === 0) ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>First articles coming soon. Subscribe to get notified!</p>
              <Link href="/newsletter" className="inline-block mt-4 px-6 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: '#F59E0B', color: '#000' }}>
                Subscribe →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {posts.map((post: any, i: number) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article className="rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: '#fff', border: '1px solid #E5E5E4' }}>
                    <div className="flex gap-5">
                      {post.cover_image_url && (
                        <div className="w-32 h-24 rounded-xl overflow-hidden shrink-0 hidden md:block"
                          style={{ background: '#F5F5F4' }}>
                          <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {post.category && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
                              {post.category}
                            </span>
                          )}
                          <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                            {post.read_time_min} min read
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold mb-1"
                          style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17' }}>
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-sm mb-2" style={{ color: '#6B7280', lineHeight: 1.6 }}>
                            {post.excerpt}
                          </p>
                        )}
                        <div className="text-xs" style={{ color: '#9CA3AF' }}>
                          {post.author_name} · {post.published_at && new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>© {new Date().getFullYear()} Ascentor Inc. · <Link href="/terms">Terms</Link> · <Link href="/pricing">Pricing</Link></p>
      </footer>
    </div>
  );
}
