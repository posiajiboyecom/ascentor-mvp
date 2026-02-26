import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata = {
  title: 'Blog — Ascentor',
  description: 'Leadership insights and career strategies for African professionals.',
};

// Category color map using Ascentor secondary palette
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  leadership:  { bg: 'rgba(102,98,255,0.12)',  color: '#A6A2FF' },
  career:      { bg: 'rgba(207,255,94,0.10)',  color: '#CFFF5E' },
  community:   { bg: 'rgba(253,129,253,0.10)', color: '#FD81FD' },
  strategy:    { bg: 'rgba(20,184,166,0.10)',  color: '#14B8A6' },
  growth:      { bg: 'rgba(166,162,255,0.12)', color: '#A6A2FF' },
  default:     { bg: 'rgba(102,98,255,0.10)',  color: '#6662FF' },
};

function getCategoryStyle(category: string) {
  const key = (category || '').toLowerCase();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
}

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, title, slug, excerpt, category, author_name, published_at, read_time_minutes')
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  const hasPosts = posts && posts.length > 0;
  const featured = hasPosts ? posts[0] : null;
  const rest = hasPosts ? posts.slice(1) : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .blog-root {
          font-family: 'Inter', sans-serif;
          background: #0F0F14;
          color: #F0EFF8;
          min-height: 100vh;
        }

        /* Nav */
        .blog-nav {
          position: sticky; top: 0; z-index: 50;
          padding: 14px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(15,15,20,0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex; align-items: center; justify-content: space-between;
          max-width: 100%;
        }
        .blog-nav-inner {
          max-width: 1100px; margin: 0 auto; width: 100%;
          display: flex; align-items: center; justify-content: space-between;
        }
        .blog-nav-logo {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .blog-nav-logo-text {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 18px; color: #F0EFF8;
          letter-spacing: -0.01em;
        }
        .blog-nav-links {
          display: flex; align-items: center; gap: 8px;
        }
        .blog-nav-link {
          font-size: 13px; color: #9896B8; text-decoration: none;
          padding: 6px 12px; border-radius: 7px; transition: all 0.18s;
          font-family: 'Inter', sans-serif;
        }
        .blog-nav-link:hover { color: #F0EFF8; background: rgba(255,255,255,0.06); }
        .blog-nav-cta {
          font-size: 13px; font-weight: 700; text-decoration: none;
          padding: 8px 18px; border-radius: 9px;
          background: #6662FF; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(102,98,255,0.35);
        }
        .blog-nav-cta:hover {
          background: #4D4ACC;
          box-shadow: 0 4px 20px rgba(102,98,255,0.5);
          transform: translateY(-1px);
        }

        /* Hero */
        .blog-hero {
          padding: 72px 24px 56px;
          max-width: 1100px; margin: 0 auto;
          display: flex; flex-direction: column;
        }
        .blog-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
          color: #A6A2FF;
          margin-bottom: 20px;
        }
        .blog-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #6662FF;
        }
        .blog-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(32px, 5vw, 52px);
          font-weight: 800; line-height: 1.1;
          letter-spacing: -0.02em;
          color: #F0EFF8;
          margin-bottom: 16px;
        }
        .blog-title-accent {
          background: linear-gradient(135deg, #6662FF 0%, #A6A2FF 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .blog-subtitle {
          font-size: 16px; color: #9896B8; line-height: 1.7; max-width: 520px;
          margin-bottom: 0;
        }

        /* Divider line */
        .blog-divider {
          max-width: 1100px; margin: 0 auto 0;
          height: 1px; background: linear-gradient(90deg, #6662FF22, #A6A2FF22, transparent);
        }

        /* Featured post */
        .featured-section {
          max-width: 1100px; margin: 0 auto;
          padding: 48px 24px 32px;
        }
        .featured-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.14em; color: #5E5C7A; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .featured-label::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, #1E1E2E, transparent);
        }
        .featured-card {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 0;
          border-radius: 20px; overflow: hidden;
          border: 1px solid rgba(102,98,255,0.15);
          text-decoration: none; color: inherit;
          transition: all 0.25s;
          background: #16161F;
        }
        @media (max-width: 700px) { .featured-card { grid-template-columns: 1fr; } }
        .featured-card:hover {
          border-color: rgba(102,98,255,0.35);
          box-shadow: 0 16px 64px rgba(102,98,255,0.12);
          transform: translateY(-2px);
        }
        .featured-card-visual {
          background: linear-gradient(135deg, #16161F 0%, #1C1C2E 50%, #16162A 100%);
          padding: 48px 40px;
          display: flex; flex-direction: column; justify-content: flex-end;
          position: relative; overflow: hidden; min-height: 260px;
        }
        .featured-card-visual::before {
          content: '';
          position: absolute; top: -40px; right: -40px;
          width: 180px; height: 180px; border-radius: 50%;
          background: radial-gradient(circle, rgba(102,98,255,0.25), transparent 70%);
          pointer-events: none;
        }
        .featured-card-visual::after {
          content: '';
          position: absolute; bottom: -20px; left: -20px;
          width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, rgba(166,162,255,0.15), transparent 70%);
          pointer-events: none;
        }
        .featured-big-number {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 96px; font-weight: 800; line-height: 1;
          color: rgba(102,98,255,0.12);
          position: absolute; top: 20px; left: 32px;
          letter-spacing: -0.05em; pointer-events: none;
          user-select: none;
        }
        .featured-card-content {
          padding: 36px 36px;
          display: flex; flex-direction: column; justify-content: center;
        }
        .featured-card-meta {
          display: flex; align-items: center; gap: 8px; margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .cat-badge {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
          padding: 3px 10px; border-radius: 100px;
          font-family: 'Inter', sans-serif;
        }
        .read-time {
          font-size: 11px; color: #5E5C7A; font-family: 'Inter', sans-serif;
        }
        .featured-card-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(18px, 2.5vw, 24px); font-weight: 800;
          color: #F0EFF8; line-height: 1.3; letter-spacing: -0.01em;
          margin-bottom: 12px;
        }
        .featured-card-excerpt {
          font-size: 14px; color: #9896B8; line-height: 1.7;
          margin-bottom: 20px;
        }
        .featured-card-author {
          font-size: 12px; color: #5E5C7A; font-family: 'Inter', sans-serif;
          display: flex; align-items: center; gap: 6px;
        }
        .featured-card-author-dot { width: 3px; height: 3px; border-radius: 50%; background: #2A2A3E; }
        .read-arrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 600; color: #6662FF;
          font-family: 'Plus Jakarta Sans', sans-serif;
          transition: gap 0.2s;
        }
        .featured-card:hover .read-arrow { gap: 10px; }

        /* Post grid */
        .posts-section {
          max-width: 1100px; margin: 0 auto;
          padding: 0 24px 80px;
        }
        .posts-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 900px) { .posts-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 580px) { .posts-grid { grid-template-columns: 1fr; } }

        .post-card {
          background: #16161F;
          border: 1px solid #1E1E2E;
          border-radius: 16px; padding: 24px;
          text-decoration: none; color: inherit;
          display: flex; flex-direction: column;
          transition: all 0.22s;
          position: relative; overflow: hidden;
        }
        .post-card::before {
          content: ''; position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: var(--card-color, #6662FF);
          opacity: 0; transition: opacity 0.22s;
        }
        .post-card:hover {
          border-color: rgba(102,98,255,0.25);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          transform: translateY(-3px);
        }
        .post-card:hover::before { opacity: 1; }
        .post-card-meta {
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;
        }
        .post-card-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 16px; font-weight: 700; color: #F0EFF8;
          line-height: 1.4; letter-spacing: -0.01em; margin-bottom: 10px;
          flex: 1;
        }
        .post-card-excerpt {
          font-size: 13px; color: #9896B8; line-height: 1.65; margin-bottom: 16px; flex: 1;
        }
        .post-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: auto; padding-top: 14px;
          border-top: 1px solid #1E1E2E;
          font-size: 11px; color: #5E5C7A; font-family: 'Inter', sans-serif;
        }
        .post-card-footer-arrow {
          color: #6662FF; font-size: 14px; transition: transform 0.18s;
        }
        .post-card:hover .post-card-footer-arrow { transform: translateX(4px); }

        /* Empty state */
        .empty-state {
          padding: 80px 24px; text-align: center;
          max-width: 400px; margin: 0 auto;
        }
        .empty-icon {
          width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 20px;
          background: rgba(102,98,255,0.1); border: 1px solid rgba(102,98,255,0.2);
          display: flex; align-items: center; justify-content: center; font-size: 32px;
        }
        .empty-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 20px; font-weight: 700; color: #F0EFF8; margin-bottom: 8px;
        }
        .empty-desc { font-size: 14px; color: #5E5C7A; line-height: 1.6; }

        /* Footer */
        .blog-footer {
          padding: 32px 24px; text-align: center;
          border-top: 1px solid #1E1E2E;
          font-size: 12px; color: #5E5C7A;
          font-family: 'Inter', sans-serif;
        }
        .blog-footer a { color: #9896B8; text-decoration: none; transition: color 0.18s; }
        .blog-footer a:hover { color: #A6A2FF; }
        .blog-footer-sep { margin: 0 8px; color: #2A2A3E; }
      `}</style>

      <div className="blog-root">
        {/* Nav */}
        <nav className="blog-nav">
          <div className="blog-nav-inner">
            <Link href="/" className="blog-nav-logo">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L22 20H2L12 3Z" fill="#6662FF" fillOpacity="0.12" stroke="#6662FF" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 8L18 20H6L12 8Z" fill="#6662FF" fillOpacity="0.35"/>
                <path d="M9 20H15" stroke="#A6A2FF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="blog-nav-logo-text">Ascentor</span>
            </Link>
            <div className="blog-nav-links">
              <Link href="/blog" className="blog-nav-link">Blog</Link>
              <Link href="/pricing" className="blog-nav-link">Pricing</Link>
              <Link href="/signup" className="blog-nav-cta">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="blog-hero">
          <span className="blog-eyebrow">
            <span className="blog-eyebrow-dot" />
            Insights & Perspectives
          </span>
          <h1 className="blog-title">
            Leadership thinking for<br />
            <span className="blog-title-accent">African professionals</span>
          </h1>
          <p className="blog-subtitle">
            Actionable strategies, frameworks and stories to accelerate your leadership journey.
          </p>
        </section>

        <div className="blog-divider" />

        {!hasPosts && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h2 className="empty-title">Coming soon</h2>
            <p className="empty-desc">Our first leadership insights are on their way. Sign up to be notified when we publish.</p>
          </div>
        )}

        {hasPosts && (
          <>
            {/* Featured post */}
            {featured && (
              <section className="featured-section">
                <p className="featured-label">Featured</p>
                <FeaturedCard post={featured} />
              </section>
            )}

            {/* Post grid */}
            {rest.length > 0 && (
              <section className="posts-section">
                {featured && (
                  <p className="featured-label" style={{ marginBottom: 20 }}>More articles</p>
                )}
                <div className="posts-grid">
                  {rest.map((post: any) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="blog-footer">
          <div style={{ marginBottom: 8 }}>
            <Link href="/">Home</Link>
            <span className="blog-footer-sep">·</span>
            <Link href="/pricing">Pricing</Link>
            <span className="blog-footer-sep">·</span>
            <Link href="/blog">Blog</Link>
            <span className="blog-footer-sep">·</span>
            <Link href="/terms">Terms</Link>
          </div>
          <p>© {new Date().getFullYear()} Ascentor. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

function FeaturedCard({ post }: { post: any }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const catStyle = getCategoryStyle(post.category);

  return (
    <Link href={`/blog/${post.slug}`} className="featured-card">
      <div className="featured-card-visual">
        <span className="featured-big-number">01</span>
      </div>
      <div className="featured-card-content">
        <div className="featured-card-meta">
          {post.category && (
            <span className="cat-badge" style={{ background: catStyle.bg, color: catStyle.color }}>
              {post.category}
            </span>
          )}
          {post.read_time_minutes && (
            <span className="read-time">{post.read_time_minutes} min read</span>
          )}
        </div>
        <h2 className="featured-card-title">{post.title}</h2>
        {post.excerpt && (
          <p className="featured-card-excerpt">{post.excerpt}</p>
        )}
        <div className="featured-card-author">
          <span>{post.author_name || 'Ascentor Team'}</span>
          {date && (
            <>
              <span className="featured-card-author-dot" />
              <span>{date}</span>
            </>
          )}
        </div>
        <div style={{ marginTop: 20 }}>
          <span className="read-arrow">Read article →</span>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: any }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const catStyle = getCategoryStyle(post.category);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="post-card"
      style={{ ['--card-color' as any]: catStyle.color }}
    >
      <div className="post-card-meta">
        {post.category && (
          <span className="cat-badge" style={{ background: catStyle.bg, color: catStyle.color }}>
            {post.category}
          </span>
        )}
        {post.read_time_minutes && (
          <span className="read-time">{post.read_time_minutes} min read</span>
        )}
      </div>
      <h2 className="post-card-title">{post.title}</h2>
      {post.excerpt && (
        <p className="post-card-excerpt">{post.excerpt}</p>
      )}
      <div className="post-card-footer">
        <span>{post.author_name || 'Ascentor Team'}{date ? ` · ${date}` : ''}</span>
        <span className="post-card-footer-arrow">→</span>
      </div>
    </Link>
  );
}
