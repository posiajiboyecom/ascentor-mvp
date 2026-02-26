import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata = {
  title: 'Blog — Ascentor',
  description: 'Leadership insights and career strategies for African professionals.',
};

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, author_name, published_at, read_time_minutes')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  const hasPosts = posts && posts.length > 0;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#FFFBF5', color: '#1A1A2E', minHeight: '100vh' }}>
      <nav className="px-4 lg:px-8 py-4" style={{ borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-on-dark.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
          <Link href="/signup" className="px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: '#F59E0B', color: '#000' }}>Sign Up</Link>
        </div>
      </nav>

      <section className="py-16 lg:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F59E0B' }}>Blog</span>
          <h1 className="text-3xl lg:text-4xl font-bold mt-2 mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Leadership Insights</h1>
          <p className="text-base mb-10" style={{ color: '#6B7280' }}>Actionable strategies for African professionals building their leadership edge.</p>

          {!hasPosts && (
            <div className="text-center py-16 rounded-2xl" style={{ background: '#FFF', border: '1px solid #E5E7EB' }}>
              <p className="text-3xl mb-3">📝</p>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Blog posts coming soon. Stay tuned!</p>
            </div>
          )}

          {hasPosts && (
            <div className="flex flex-col gap-5">
              {posts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="py-8 px-6 text-center text-xs" style={{ background: '#FFF7ED', color: '#9CA3AF' }}>
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">·</span>
        <Link href="/pricing" className="hover:text-amber-600">Pricing</Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-amber-600">Terms</Link>
        <p className="mt-3">© {new Date().getFullYear()} Ascentor. All rights reserved.</p>
      </footer>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Link href={'/blog/' + post.slug}>
      <article className="rounded-2xl p-5 bg-white transition-all hover:shadow-lg cursor-pointer" style={{ border: '1px solid #E5E7EB' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#D97706' }}>{post.category}</span>
          <span className="text-[11px]" style={{ color: '#9CA3AF' }}>{post.read_time_minutes} min read</span>
        </div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#1A1A2E', fontFamily: "'Playfair Display', serif" }}>{post.title}</h2>
        {post.excerpt && <p className="text-sm mb-2" style={{ color: '#6B7280' }}>{post.excerpt}</p>}
        <div className="text-xs" style={{ color: '#9CA3AF' }}>{post.author_name || 'Ascentor Team'} · {date}</div>
      </article>
    </Link>
  );
}
