import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_URL, getArticleSchema, getBreadcrumbSchema, jsonLdString } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, published_at, author_name, cover_image')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!post) return { title: 'Post Not Found | Ascentor', robots: { index: false } };

  const url = `${SITE_URL}/blog/${slug}`;
  return {
    title: post.title, // root template appends "| Ascentor"
    description: post.excerpt || '',
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt || '',
      url,
      siteName: 'Ascentor',
      type: 'article',
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      ...(post.cover_image
        ? { images: [{ url: post.cover_image, width: 1200, height: 630 }] }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || '',
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
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
          return <h2 key={i} className="text-xl font-semibold mt-8 mb-3" style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>{block.replace('## ', '')}</h2>;
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
        // Paragraph with **bold** and [text](url) links, rendered as React elements (never raw HTML),
        // so post text can't inject markup and link targets are limited to http(s), mailto and site paths.
        return (
          <p key={i} className="text-sm my-3" style={{ color: '#374151', lineHeight: 1.8 }}>
            {inline(block)}
          </p>
        );
      });
  }

  function safeHref(raw: string): string | null {
    const href = raw.trim();
    // A site path: "/x" but never "//host" or "/\\host" (browsers treat both as another site).
    if (/^\/(?![\/\\])/.test(href)) return href;
    if (href.startsWith('#')) return href;
    try {
      const u = new URL(href);
      return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.toString() : null;
    } catch { return null; }
  }

  function sameSite(href: string): boolean {
    try { return new URL(href, SITE_URL).origin === new URL(SITE_URL).origin; } catch { return false; }
  }

  function inline(text: string) {
    const out: React.ReactNode[] = [];
    const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*/g;
    let last = 0; let m: RegExpExecArray | null; let k = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[3] !== undefined) {
        out.push(<strong key={k++}>{m[3]}</strong>);
      } else {
        const href = safeHref(m[2]);
        const internal = !!href && (href.startsWith('/') || href.startsWith('#') || sameSite(href));
        out.push(href
          ? <a key={k++} href={href} style={{ color: '#E8A020', textDecoration: 'underline' }}
               {...(internal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{m[1]}</a>
          : m[1]);
      }
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  const jsonLd = [
    getArticleSchema({ ...post, slug }),
    getBreadcrumbSchema([
      { name: 'Home', url: SITE_URL },
      { name: 'Blog', url: `${SITE_URL}/blog` },
      { name: post.title, url: `${SITE_URL}/blog/${slug}` },
    ]),
  ];

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', fontFamily: "'Metropolis', system-ui, sans-serif" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ background: 'rgba(250,250,249,0.88)', borderBottom: '1px solid #E5E5E4' }}>
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-for-light-pages.svg"
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
          style={{ fontFamily: "'Metropolis', sans-serif", color: '#0C0B08' }}>
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
              {post.published_at && new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {post.read_time_minutes} min read
            </p>
          </div>
        </div>

        {post.cover_image && (
          <div className="mb-8 rounded-2xl overflow-hidden" style={{ maxHeight: '460px' }}>
            <img
              src={post.cover_image}
              alt={post.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        <div>{renderContent(post.content)}</div>

        <div className="mt-12 pt-8 text-center" style={{ borderTop: '1px solid #E5E5E4' }}>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>Ready to invest in your leadership growth?</p>
          <Link href="/?gate=1" className="inline-block px-8 py-3.5 rounded-xl text-sm font-semibold"
            style={{ background: '#E8A020', color: '#000' }}>
            Join Ascentor →
          </Link>
        </div>
      </article>

      <footer className="py-8 text-center text-xs" style={{ borderTop: '1px solid #E5E5E4', color: '#9CA3AF' }}>
        <p>© {new Date().getFullYear()} Ascentor Inc.</p>
      </footer>
    </div>
  );
}
