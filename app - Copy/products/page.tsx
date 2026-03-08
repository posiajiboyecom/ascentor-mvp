import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

export const metadata: Metadata = {
  title: 'Products — Ascentor',
  description: 'Tools, playbooks, and resources built for ambitious African professionals.',
};

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Product = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  currency: string;
  image_url: string | null;
  category: string;
  badge: string | null;
  cta_label: string;
  cta_url: string;
  is_featured: boolean;
  sort_order: number;
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Playbook':    { bg: 'rgba(232,160,32,0.08)',  text: '#B07D10', border: 'rgba(232,160,32,0.2)'  },
  'Course':      { bg: 'rgba(20,184,166,0.08)',  text: '#0E8A7C', border: 'rgba(20,184,166,0.2)'  },
  'Template':    { bg: 'rgba(139,92,246,0.08)',  text: '#6D28D9', border: 'rgba(139,92,246,0.2)'  },
  'Masterclass': { bg: 'rgba(59,130,246,0.08)',  text: '#1D4ED8', border: 'rgba(59,130,246,0.2)'  },
  'Bundle':      { bg: 'rgba(239,68,68,0.07)',   text: '#B91C1C', border: 'rgba(239,68,68,0.18)'  },
  'default':     { bg: 'rgba(107,114,128,0.08)', text: '#374151', border: 'rgba(107,114,128,0.2)' },
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default'];
}

function formatPrice(price: number, currency: string) {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
  }).format(price);
}

export default async function ProductsPage() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true });

  const items: Product[] = products || [];
  const featured = items.filter(p => p.is_featured);
  const rest     = items.filter(p => !p.is_featured);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .prod-page {
          min-height: 100vh;
          background: #FAFAF9;
          color: #1A1A1A;
          font-family: 'Syne', system-ui, sans-serif;
        }

        /* ── Nav ── */
        .prod-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250,250,249,0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #E8E5E0;
          padding: 0 20px;
        }
        .prod-nav-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          height: 60px;
        }
        .prod-nav-links { display: flex; gap: 28px; align-items: center; }
        .prod-nav-link {
          font-size: 13px; font-weight: 500; color: #6B7280;
          text-decoration: none; letter-spacing: 0.01em;
          transition: color 0.15s;
        }
        .prod-nav-link:hover { color: #1A1A1A; }
        .prod-cta-btn {
          font-family: 'Syne', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 8px 18px; border-radius: 8px;
          background: #0C0B08; color: #E8A020;
          text-decoration: none; letter-spacing: 0.02em;
          transition: opacity 0.15s;
        }
        .prod-cta-btn:hover { opacity: 0.85; }

        /* ── Hero ── */
        .prod-hero {
          max-width: 1100px; margin: 0 auto;
          padding: 72px 20px 48px;
          border-bottom: 1px solid #E8E5E0;
        }
        .prod-hero-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: #E8A020; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .prod-hero-eyebrow::before {
          content: ''; width: 24px; height: 1px; background: #E8A020; display: block;
        }
        .prod-hero h1 {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(36px, 5vw, 60px);
          font-weight: 700; line-height: 1.08;
          color: #0C0B08; max-width: 640px;
        }
        .prod-hero h1 em {
          font-style: italic; color: #E8A020;
        }
        .prod-hero-sub {
          font-size: 15px; color: #6B7280; line-height: 1.6;
          max-width: 480px; margin-top: 18px;
        }
        .prod-hero-meta {
          display: flex; align-items: center; gap: 20px;
          margin-top: 28px; flex-wrap: wrap;
        }
        .prod-hero-stat {
          display: flex; flex-direction: column; gap: 2px;
        }
        .prod-hero-stat-val {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px; font-weight: 700; color: #0C0B08; line-height: 1;
        }
        .prod-hero-stat-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.08em; color: #9CA3AF;
          text-transform: uppercase;
        }
        .prod-hero-divider {
          width: 1px; height: 32px; background: #E8E5E0;
        }

        /* ── Featured ── */
        .prod-section {
          max-width: 1100px; margin: 0 auto;
          padding: 56px 20px;
        }
        .prod-section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #9CA3AF; margin-bottom: 28px;
          display: flex; align-items: center; gap: 12px;
        }
        .prod-section-label::after {
          content: ''; flex: 1; height: 1px; background: #E8E5E0;
        }

        .prod-featured-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }
        .prod-card {
          background: #fff;
          border: 1px solid #E8E5E0;
          border-radius: 16px;
          overflow: hidden;
          display: flex; flex-direction: column;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .prod-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }
        .prod-card.featured {
          border-color: rgba(232,160,32,0.35);
          box-shadow: 0 4px 24px rgba(232,160,32,0.08);
        }

        /* Image area */
        .prod-card-img {
          width: 100%; aspect-ratio: 16/9;
          background: #F3F1EE;
          position: relative; overflow: hidden;
        }
        .prod-card-img img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.4s ease;
        }
        .prod-card:hover .prod-card-img img { transform: scale(1.04); }
        .prod-card-img-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #F7F6F3 0%, #EDE9E3 100%);
        }
        .prod-card-img-placeholder svg { opacity: 0.25; }

        /* Badge overlay */
        .prod-badge-overlay {
          position: absolute; top: 12px; left: 12px;
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 4px 10px;
          border-radius: 999px; backdrop-filter: blur(8px);
          background: rgba(12,11,8,0.75); color: #E8A020;
          border: 1px solid rgba(232,160,32,0.3);
        }

        /* Card body */
        .prod-card-body { padding: 22px 22px 20px; flex: 1; display: flex; flex-direction: column; }
        .prod-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .prod-card-cat {
          font-family: 'DM Mono', monospace;
          font-size: 9px; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 999px;
        }
        .prod-card-name {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 22px; font-weight: 700; line-height: 1.2;
          color: #0C0B08; margin-bottom: 6px;
        }
        .prod-card-tagline {
          font-size: 13px; color: #6B7280; line-height: 1.5;
          margin-bottom: 14px; flex: 1;
        }
        .prod-card-footer {
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          padding-top: 16px; border-top: 1px solid #F3F1EE;
          margin-top: auto;
        }
        .prod-price {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px; font-weight: 700; color: #0C0B08; line-height: 1;
        }
        .prod-price.free { color: #14B8A6; }
        .prod-buy-btn {
          font-family: 'Syne', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 9px 20px; border-radius: 9px;
          text-decoration: none; letter-spacing: 0.01em;
          white-space: nowrap;
          background: #0C0B08; color: #E8A020;
          transition: opacity 0.15s;
        }
        .prod-buy-btn:hover { opacity: 0.82; }
        .prod-buy-btn.free-btn {
          background: rgba(20,184,166,0.1); color: #0E8A7C;
          border: 1px solid rgba(20,184,166,0.3);
        }

        /* ── Empty state ── */
        .prod-empty {
          text-align: center; padding: 80px 20px;
        }
        .prod-empty h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 32px; color: #C4BFB8; margin-bottom: 10px;
        }
        .prod-empty p {
          font-family: 'DM Mono', monospace;
          font-size: 11px; color: #C4BFB8; letter-spacing: 0.06em;
        }

        /* ── Footer ── */
        .prod-footer {
          border-top: 1px solid #E8E5E0;
          padding: 36px 20px; margin-top: 20px;
        }
        .prod-footer-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 16px;
        }
        .prod-footer-copy {
          font-family: 'DM Mono', monospace;
          font-size: 10px; color: #9CA3AF; letter-spacing: 0.06em;
        }
        .prod-footer-links { display: flex; gap: 20px; }
        .prod-footer-link {
          font-family: 'DM Mono', monospace;
          font-size: 10px; color: #9CA3AF; letter-spacing: 0.06em;
          text-decoration: none; transition: color 0.15s;
        }
        .prod-footer-link:hover { color: #1A1A1A; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .prod-nav-links .prod-nav-link { display: none; }
          .prod-hero { padding: 48px 16px 36px; }
          .prod-section { padding: 40px 16px; }
          .prod-featured-grid { grid-template-columns: 1fr; }
          .prod-hero-meta { gap: 14px; }
        }
      `}</style>

      <div className="prod-page">

        {/* Nav */}
        <nav className="prod-nav">
          <div className="prod-nav-inner">
            <Link href="/">
              <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 28, width: 'auto' }} />
            </Link>
            <div className="prod-nav-links">
              <Link href="/pricing" className="prod-nav-link">Pricing</Link>
              <Link href="/blog" className="prod-nav-link">Blog</Link>
              <Link href="/login" className="prod-nav-link">Log In</Link>
              <Link href="/signup" className="prod-cta-btn">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <div className="prod-hero">
          <p className="prod-hero-eyebrow">Ascentor Products</p>
          <h1>
            Resources built for<br />
            <em>African ambition</em>
          </h1>
          <p className="prod-hero-sub">
            Playbooks, templates, and courses distilled from real leadership experience.
            Practical tools you can use today.
          </p>
          {items.length > 0 && (
            <div className="prod-hero-meta">
              <div className="prod-hero-stat">
                <span className="prod-hero-stat-val">{items.length}</span>
                <span className="prod-hero-stat-label">Products</span>
              </div>
              <div className="prod-hero-divider" />
              <div className="prod-hero-stat">
                <span className="prod-hero-stat-val">{items.filter(p => p.price === 0).length}</span>
                <span className="prod-hero-stat-label">Free</span>
              </div>
              {items.length > 0 && (
                <>
                  <div className="prod-hero-divider" />
                  <div className="prod-hero-stat">
                    <span className="prod-hero-stat-val">
                      {[...new Set(items.map(p => p.category))].length}
                    </span>
                    <span className="prod-hero-stat-label">Categories</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="prod-section">
            <div className="prod-empty">
              <h2>Coming soon</h2>
              <p>Products will appear here once published</p>
            </div>
          </div>
        ) : (
          <>
            {/* Featured */}
            {featured.length > 0 && (
              <section className="prod-section">
                <p className="prod-section-label">Featured</p>
                <div className="prod-featured-grid">
                  {featured.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}

            {/* All products */}
            {rest.length > 0 && (
              <section className="prod-section" style={{ paddingTop: featured.length ? 0 : 56 }}>
                <p className="prod-section-label">{featured.length > 0 ? 'All Products' : 'Products'}</p>
                <div className="prod-featured-grid">
                  {rest.map(p => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="prod-footer">
          <div className="prod-footer-inner">
            <span className="prod-footer-copy">© {new Date().getFullYear()} Ascentor. All rights reserved.</span>
            <div className="prod-footer-links">
              <Link href="/privacy" className="prod-footer-link">Privacy</Link>
              <Link href="/terms" className="prod-footer-link">Terms</Link>
              <Link href="/pricing" className="prod-footer-link">Pricing</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function ProductCard({ product: p }: { product: Product }) {
  const catStyle = categoryStyle(p.category);
  const isFree   = p.price === 0;

  return (
    <div className={`prod-card${p.is_featured ? ' featured' : ''}`}>
      <div className="prod-card-img">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} />
        ) : (
          <div className="prod-card-img-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </div>
        )}
        {p.badge && <span className="prod-badge-overlay">{p.badge}</span>}
      </div>

      <div className="prod-card-body">
        <div className="prod-card-top">
          <span className="prod-card-cat" style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}>
            {p.category}
          </span>
          {p.is_featured && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#E8A020', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ★ Featured
            </span>
          )}
        </div>

        <h3 className="prod-card-name">{p.name}</h3>
        <p className="prod-card-tagline">{p.tagline}</p>

        <div className="prod-card-footer">
          <span className={`prod-price${isFree ? ' free' : ''}`}>
            {formatPrice(p.price, p.currency)}
          </span>
          <Link
            href={`/products/${p.id}`}
            className={`prod-buy-btn${isFree ? ' free-btn' : ''}`}
          >
            {isFree ? 'Get Free' : 'View & Buy'}
          </Link>
        </div>
      </div>
    </div>
  );
}
