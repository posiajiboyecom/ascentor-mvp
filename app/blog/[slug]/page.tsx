import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!post) return { title: 'Post Not Found — Ascentor' };

  return {
    title: `${post.title} — Ascentor Blog`,
    description: post.excerpt || '',
    openGraph: { title: post.title, description: post.excerpt || '' },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!post) notFound();

  // Simple markdown-to-HTML (headings, bold, links, lists)
  function renderContent(md: string) {
    return md
      .split('\n\n')
      .map((block, i) => {
        if (block.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold mt-8 mb-3" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>{block.replace('## ', '')}</h2>;
        }
        if (block.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold mt-6 mb-2" style={{ color: '#0C0B08' }}>{block.replace('### ', '')}</h3>;
        }
        if (block.startsWith('- ')) {
          const items = block.split('\n').filter((l) => l.startsWith('- '));
          return (
            <ul key={i} className="my-3 flex flex-col gap-2">
              {items.map((item, j) => {
                const text = item.replace('- ', '');
                const parts = text.split(/\*\*(.*?)\*\*/g);
                return (
                  <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#374151', lineHeight: 1.7 }}>
                    <span style={{ color: '#E8A020' }}>•</span>
                    <span>{parts.map((p, k) => k % 2 === 1 ? <strong key={k}>{p}</strong> : p)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        if (block.match(/^\d\./)) {
          const items = block.split('\n').filter((l) => l.match(/^\d\./));
          return (
            <ol key={i} className="my-3 flex flex-col gap-2">
              {items.map((item, j) => {
                const text = item.replace(/^\d+\.\s*/, '');
                const parts = text.split(/\*\*(.*?)\*\*/g);
                return (
                  <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#374151', lineHeight: 1.7 }}>
                    <span className="font-bold shrink-0" style={{ color: '#E8A020' }}>{j + 1}.</span>
                    <span>{parts.map((p, k) => k % 2 === 1 ? <strong key={k}>{p}</strong> : p)}</span>
                  </li>
                );
              })}
            </ol>
          );
        }
        // Handle links [text](url)
        const linkified = block.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#E8A020;text-decoration:underline">$1</a>');
        const parts = block.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="text-sm my-3" style={{ color: '#374151', lineHeight: 1.8 }}>
            {linkified.includes('<a') ? (
              <span dangerouslySetInnerHTML={{ __html: linkified.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            ) : (
              parts.map((p, k) => k % 2 === 1 ? <strong key={k}>{p}</strong> : p)
            )}
          </p>
        );
      });
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', fontFamily: "'Syne', system-ui, sans-serif" }}>

      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-on-dark.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
          <Link href="/blog" className="text-sm" style={{ color: '#6B7280' }}>← Back to Blog</Link>
        </div>
      </nav>

      <article className="max-w-2xl mx-auto px-5 py-12">
        <div className="mb-6">
          {post.category && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}>
              {post.category}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold mb-4 leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#0C0B08' }}>
          {post.title}
        </h1>

        <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: '1px solid #E5E5E4' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(245,158,11,0.1)', color: '#E8A020' }}>
            {(post.author_name || 'A').charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#0C0B08' }}>{post.author_name}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {post.published_at && new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {post.read_time_min} min read
            </p>
          </div>
        </div>

        <div>{renderContent(post.content)}</div>

        <div className="mt-12 pt-8 text-center" style={{ borderTop: '1px solid #E5E5E4' }}>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>Ready to invest in your leadership growth?</p>
          <Link href="/signup" className="inline-block px-8 py-3.5 rounded-xl text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Start Free Trial →
          </Link>
        </div>
      </article>

      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>© {new Date().getFullYear()} Ascentor Inc.</p>
      </footer>
    </div>
  );
}
