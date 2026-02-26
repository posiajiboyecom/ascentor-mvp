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

// Category → accent color mapping (same as blog list page)
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  leadership: { bg: 'rgba(102,98,255,0.12)',  color: '#A6A2FF' },
  career:     { bg: 'rgba(207,255,94,0.10)',  color: '#CFFF5E' },
  community:  { bg: 'rgba(253,129,253,0.10)', color: '#FD81FD' },
  strategy:   { bg: 'rgba(20,184,166,0.10)',  color: '#14B8A6' },
  growth:     { bg: 'rgba(166,162,255,0.12)', color: '#A6A2FF' },
  default:    { bg: 'rgba(102,98,255,0.10)',  color: '#6662FF' },
};
function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[(cat || '').toLowerCase()] || CATEGORY_COLORS.default;
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

  const catStyle = getCategoryStyle(post.category);

  function renderContent(md: string) {
    return md.split('\n\n').map((block, i) => {
      if (block.startsWith('## ')) {
        return (
          <h2 key={i} style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '20px', fontWeight: 700, color: '#F0EFF8',
            marginTop: '40px', marginBottom: '14px', lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}>
            {block.replace('## ', '')}
          </h2>
        );
      }
      if (block.startsWith('### ')) {
        return (
          <h3 key={i} style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '17px', fontWeight: 700, color: '#F0EFF8',
            marginTop: '28px', marginBottom: '10px', lineHeight: 1.4,
          }}>
            {block.replace('### ', '')}
          </h3>
        );
      }
      if (block.startsWith('- ')) {
        const items = block.split('\n').filter(l => l.startsWith('- '));
        return (
          <ul key={i} style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: 0, listStyle: 'none' }}>
            {items.map((item, j) => {
              const text = item.replace('- ', '');
              const parts = text.split(/\*\*(.*?)\*\*/g);
              return (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#9896B8', fontSize: '15px', lineHeight: 1.75, fontFamily: 'Inter, sans-serif' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: catStyle.color, flexShrink: 0, marginTop: '9px' }} />
                  <span>{parts.map((p, k) => k % 2 === 1 ? <strong key={k} style={{ color: '#F0EFF8', fontWeight: 600 }}>{p}</strong> : p)}</span>
                </li>
              );
            })}
          </ul>
        );
      }
      if (block.match(/^\d\./)) {
        const items = block.split('\n').filter(l => l.match(/^\d\./));
        return (
          <ol key={i} style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: 0, listStyle: 'none', counterReset: 'item' }}>
            {items.map((item, j) => {
              const text = item.replace(/^\d+\.\s*/, '');
              const parts = text.split(/\*\*(.*?)\*\*/g);
              return (
                <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', fontFamily: 'Inter, sans-serif' }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                    background: `${catStyle.color}18`, border: `1px solid ${catStyle.color}30`,
                    color: catStyle.color, fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: '1px',
                  }}>{j + 1}</span>
                  <span style={{ color: '#9896B8', fontSize: '15px', lineHeight: 1.75 }}>
                    {parts.map((p, k) => k % 2 === 1 ? <strong key={k} style={{ color: '#F0EFF8', fontWeight: 600 }}>{p}</strong> : p)}
                  </span>
                </li>
              );
            })}
          </ol>
        );
      }
      // Blockquote
      if (block.startsWith('> ')) {
        const text = block.replace(/^> /gm, '');
        return (
          <blockquote key={i} style={{
            margin: '24px 0', padding: '16px 20px',
            borderLeft: `3px solid ${catStyle.color}`,
            background: `${catStyle.color}0A`,
            borderRadius: '0 10px 10px 0',
            color: '#9896B8', fontSize: '15px', lineHeight: 1.75,
            fontStyle: 'italic', fontFamily: 'Inter, sans-serif',
          }}>
            {text}
          </blockquote>
        );
      }
      // Paragraph
      const linkified = block.replace(
        /\[(.*?)\]\((.*?)\)/g,
        `<a href="$2" style="color:${catStyle.color};text-decoration:underline;text-underline-offset:3px">$1</a>`
      );
      const parts = block.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} style={{ color: '#9896B8', fontSize: '15.5px', lineHeight: 1.85, margin: '16px 0', fontFamily: 'Inter, sans-serif' }}>
          {linkified.includes('<a') ? (
            <span dangerouslySetInnerHTML={{ __html: linkified.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#F0EFF8;font-weight:600">$1</strong>') }} />
          ) : (
            parts.map((p, k) => k % 2 === 1 ? <strong key={k} style={{ color: '#F0EFF8', fontWeight: 600 }}>{p}</strong> : p)
          )}
        </p>
      );
    });
  }

  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .post-root {
          min-height: 100vh;
          background: #0F0F14;
          color: #F0EFF8;
          font-family: 'Inter', sans-serif;
        }

        /* Nav */
        .post-nav {
          position: sticky; top: 0; z-index: 50;
          padding: 13px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(15,15,20,0.92);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          display: flex; align-items: center; justify-content: space-between;
        }
        .post-nav-inner {
          max-width: 1100px; margin: 0 auto; width: 100%;
          display: flex; align-items: center; justify-content: space-between;
        }
        .post-nav-logo {
          display: flex; align-items: center; gap: 10px; text-decoration: none;
        }
        .post-nav-logo-text {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 17px; color: #F0EFF8; letter-spacing: -0.01em;
        }
        .post-nav-back {
          font-size: 13px; color: #5E5C7A; text-decoration: none;
          display: flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px; border: 1px solid #1E1E2E;
          transition: all 0.18s; font-family: 'Inter', sans-serif;
        }
        .post-nav-back:hover { color: #F0EFF8; border-color: #2A2A3E; background: #16161F; }

        /* Hero */
        .post-hero {
          max-width: 720px; margin: 0 auto;
          padding: 56px 24px 48px;
          border-bottom: 1px solid #1E1E2E;
        }
        .post-cat-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.1em; padding: 4px 12px; border-radius: 100px;
          display: inline-block; margin-bottom: 20px;
          font-family: 'Inter', sans-serif;
        }
        .post-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(26px, 5vw, 42px);
          font-weight: 800; line-height: 1.15; letter-spacing: -0.02em;
          color: #F0EFF8; margin-bottom: 16px;
        }
        .post-excerpt {
          font-size: 17px; color: #9896B8; line-height: 1.7;
          margin-bottom: 28px; font-family: 'Inter', sans-serif;
        }
        .post-byline {
          display: flex; align-items: center; gap: 14px;
        }
        .post-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .post-byline-text { }
        .post-author-name {
          font-size: 14px; font-weight: 600; color: #F0EFF8;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .post-meta-text {
          font-size: 12px; color: #5E5C7A; margin-top: 2px;
          font-family: 'Inter', sans-serif;
        }
        .post-meta-sep { margin: 0 6px; color: #2A2A3E; }

        /* Reading progress bar */
        .post-progress {
          position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 100;
          background: #1E1E2E;
        }
        .post-progress-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, #6662FF, #A6A2FF);
          transition: width 0.1s linear;
        }

        /* Body */
        .post-body {
          max-width: 720px; margin: 0 auto;
          padding: 48px 24px 64px;
        }

        /* CTA */
        .post-cta {
          max-width: 720px; margin: 0 auto;
          padding: 0 24px 80px;
        }
        .post-cta-inner {
          border-radius: 20px; padding: 40px 36px; text-align: center;
          background: #16161F; border: 1px solid rgba(102,98,255,0.2);
          position: relative; overflow: hidden;
        }
        .post-cta-glow {
          position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
          width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(circle, rgba(102,98,255,0.15), transparent 70%);
          pointer-events: none;
        }
        .post-cta-label {
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.12em; color: #A6A2FF;
          margin-bottom: 10px; font-family: 'Inter', sans-serif;
        }
        .post-cta-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 22px; font-weight: 800; color: #F0EFF8;
          margin-bottom: 10px; letter-spacing: -0.01em;
        }
        .post-cta-desc {
          font-size: 14px; color: #9896B8; line-height: 1.65;
          margin-bottom: 24px; font-family: 'Inter', sans-serif;
          max-width: 400px; margin-left: auto; margin-right: auto;
        }
        .post-cta-btn {
          display: inline-block; padding: 13px 32px;
          border-radius: 12px; text-decoration: none;
          background: #6662FF; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800; font-size: 15px;
          box-shadow: 0 6px 24px rgba(102,98,255,0.4);
          transition: all 0.2s;
        }
        .post-cta-btn:hover {
          background: #4D4ACC;
          box-shadow: 0 8px 32px rgba(102,98,255,0.55);
          transform: translateY(-1px);
        }

        /* Footer */
        .post-footer {
          padding: 24px; text-align: center;
          border-top: 1px solid #1E1E2E;
          font-size: 12px; color: #5E5C7A;
          font-family: 'Inter', sans-serif;
        }
        .post-footer a { color: #9896B8; text-decoration: none; }
        .post-footer a:hover { color: #A6A2FF; }
      `}</style>

      <div className="post-root">
        {/* Nav */}
        <nav className="post-nav">
          <div className="post-nav-inner">
            <Link href="/" className="post-nav-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L22 20H2L12 3Z" fill="#6662FF" fillOpacity="0.12" stroke="#6662FF" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 8L18 20H6L12 8Z" fill="#6662FF" fillOpacity="0.35"/>
                <path d="M9 20H15" stroke="#A6A2FF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="post-nav-logo-text">Ascentor</span>
            </Link>
            <Link href="/blog" className="post-nav-back">
              ← Blog
            </Link>
          </div>
        </nav>

        {/* Post hero */}
        <header className="post-hero">
          {post.category && (
            <span className="post-cat-badge" style={{ background: catStyle.bg, color: catStyle.color }}>
              {post.category}
            </span>
          )}
          <h1 className="post-title">{post.title}</h1>
          {post.excerpt && <p className="post-excerpt">{post.excerpt}</p>}

          <div className="post-byline">
            <div className="post-avatar" style={{ background: `${catStyle.color}18`, border: `1.5px solid ${catStyle.color}30`, color: catStyle.color }}>
              {(post.author_name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="post-byline-text">
              <div className="post-author-name">{post.author_name || 'Ascentor Team'}</div>
              <div className="post-meta-text">
                {publishedDate}
                {post.read_time_minutes && (
                  <>
                    <span className="post-meta-sep">·</span>
                    {post.read_time_minutes} min read
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Article body */}
        <main className="post-body">
          {renderContent(post.content || '')}
        </main>

        {/* CTA */}
        <section className="post-cta">
          <div className="post-cta-inner">
            <div className="post-cta-glow" />
            <p className="post-cta-label">Join Ascentor</p>
            <h2 className="post-cta-title">Ready to accelerate your leadership?</h2>
            <p className="post-cta-desc" style={{ marginBottom: 24 }}>
              Get access to AI coaching, expert sessions, and a community of African professionals growing their leadership edge.
            </p>
            <Link href="/signup" className="post-cta-btn">
              Start Free Trial →
            </Link>
            <p style={{ marginTop: 12, fontSize: 12, color: '#5E5C7A', fontFamily: 'Inter, sans-serif' }}>
              7-day free trial · No card required
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="post-footer">
          <Link href="/">Home</Link>
          <span style={{ margin: '0 8px', color: '#2A2A3E' }}>·</span>
          <Link href="/blog">Blog</Link>
          <span style={{ margin: '0 8px', color: '#2A2A3E' }}>·</span>
          <Link href="/pricing">Pricing</Link>
          <p style={{ marginTop: 8 }}>© {new Date().getFullYear()} Ascentor. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}
