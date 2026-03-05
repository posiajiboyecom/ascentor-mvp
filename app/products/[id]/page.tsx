'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────
// /products/[id] — Product detail + Paystack purchase
// Free products: instant access via CTA URL
// Paid products: Paystack popup → /api/payment/product/verify
// ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'Playbook':    '#E8A020',
  'Course':      '#14B8A6',
  'Template':    '#8B5CF6',
  'Masterclass': '#3B82F6',
  'Bundle':      '#EF4444',
  'default':     '#6B7280',
};

function formatPrice(price: number, currency: string) {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0,
  }).format(price);
}

// Convert to NGN kobo for Paystack
const NGN_PER_USD = 1600;
const NGN_PER_GBP = 2050;
const NGN_PER_EUR = 1720;

function toNgnKobo(amount: number, currency: string): number {
  const rates: Record<string, number> = {
    NGN: 1, USD: NGN_PER_USD, GBP: NGN_PER_GBP, EUR: NGN_PER_EUR,
    GHS: 110, KES: 12, ZAR: 88,
  };
  return Math.round(amount * (rates[currency] || NGN_PER_USD) * 100);
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const router   = useRouter();

  const [product,   setProduct]   = useState<any>(null);
  const [user,      setUser]      = useState<any>(null);
  const [purchased, setPurchased] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [paying,    setPaying]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  useEffect(() => {
    loadAll();
    // Inject Paystack script
    if (typeof window !== 'undefined' && !document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script'; s.src = 'https://js.paystack.co/v2/inline.js'; s.async = true;
      document.head.appendChild(s);
    }
  }, [params.id]);

  async function loadAll() {
    setLoading(true);
    // Load product
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .eq('published', true)
      .single();

    if (!prod) { router.push('/products'); return; }
    setProduct(prod);

    // Load user + check if already purchased
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data: purchase } = await supabase
        .from('product_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', params.id)
        .single();
      setPurchased(!!purchase);
    }
    setLoading(false);
  }

  async function handleBuy() {
    if (!product) return;

    // Free product — go straight to CTA URL
    if (product.price === 0) {
      window.open(product.cta_url, product.cta_url.startsWith('http') ? '_blank' : '_self');
      return;
    }

    // Require login for paid products
    if (!user) {
      router.push(`/login?redirect=/products/${product.id}`);
      return;
    }

    setPaying(true);
    setError('');

    const amountKobo = toNgnKobo(product.price, product.currency);
    const reference  = `prod_${product.id.slice(0, 8)}_${Date.now()}`;

    try {
      // @ts-ignore
      const paystack = new window.PaystackPop();
      paystack.newTransaction({
        key:      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        email:    user.email,
        amount:   amountKobo,
        currency: 'NGN',
        ref:      reference,
        metadata: {
          user_id:    user.id,
          product_id: product.id,
          product_name: product.name,
          original_currency: product.currency,
          original_price: product.price,
        },
        onSuccess: async (transaction: any) => {
          try {
            const res = await fetch('/api/payment/product/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: transaction.reference, productId: product.id }),
            });
            const data = await res.json();
            if (data.success) {
              setPurchased(true);
              setSuccess(`Payment confirmed! ${data.redirectUrl ? 'Redirecting…' : 'Enjoy your purchase.'}`);
              if (data.redirectUrl) {
                setTimeout(() => window.open(data.redirectUrl, '_blank'), 1500);
              }
            } else {
              setError('Payment received but verification failed. Contact support.');
            }
          } catch {
            setError('Payment may have succeeded — contact support if you have issues.');
          }
          setPaying(false);
        },
        onCancel: () => { setPaying(false); },
      });
    } catch {
      setError('Payment system unavailable. Please try again.');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#9CA3AF', letterSpacing: '0.08em' }}>Loading…</p>
      </div>
    );
  }

  if (!product) return null;

  const catColor = CATEGORY_COLORS[product.category] || CATEGORY_COLORS['default'];
  const isFree   = product.price === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FAFAF9; }

        .pd-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250,250,249,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid #E8E5E0;
          padding: 0 24px;
        }
        .pd-nav-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between;
          height: 60px;
        }
        .pd-back {
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: 0.08em; color: #9CA3AF; text-decoration: none;
          padding: 6px 14px; border-radius: 8px; border: 1px solid #E8E5E0;
          transition: color 0.15s;
        }
        .pd-back:hover { color: #1A1A1A; }

        .pd-layout {
          max-width: 1100px; margin: 0 auto;
          padding: 56px 24px 80px;
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 60px; align-items: start;
        }
        @media (max-width: 860px) {
          .pd-layout { grid-template-columns: 1fr; gap: 32px; }
        }

        /* Left: image */
        .pd-image-wrap {
          border-radius: 20px; overflow: hidden;
          aspect-ratio: 4/3; background: #F3F1EE;
          position: sticky; top: 80px;
        }
        .pd-image-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .pd-image-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #F7F6F3 0%, #EDE9E3 100%);
        }

        /* Right: info + purchase */
        .pd-eyebrow {
          display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
        }
        .pd-cat {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 4px 12px; border-radius: 999px;
        }
        .pd-badge {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 4px 12px; border-radius: 999px;
          background: rgba(12,11,8,0.06); color: #4B5563;
        }
        .pd-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(30px, 4vw, 44px); font-weight: 700;
          line-height: 1.1; color: #0C0B08; margin-bottom: 14px;
        }
        .pd-tagline {
          font-size: 16px; color: #6B7280; line-height: 1.65;
          margin-bottom: 28px;
        }
        .pd-description {
          font-size: 14px; color: #374151; line-height: 1.75;
          margin-bottom: 36px; border-top: 1px solid #F3F1EE; padding-top: 24px;
        }

        /* Purchase card */
        .pd-purchase {
          background: #fff; border: 1px solid #E8E5E0;
          border-radius: 20px; padding: 28px 28px 24px;
          position: sticky; top: 80px;
        }
        .pd-price-row {
          display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;
        }
        .pd-price {
          font-family: 'Cormorant Garamond', serif;
          font-size: 44px; font-weight: 700; color: #0C0B08; line-height: 1;
        }
        .pd-price.free-price { color: #14B8A6; }
        .pd-currency {
          font-family: 'DM Mono', monospace;
          font-size: 12px; letter-spacing: 0.08em; color: #9CA3AF;
        }
        .pd-price-note {
          font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.06em; color: #9CA3AF;
          margin-bottom: 24px;
        }

        .pd-buy-btn {
          width: 100%; padding: 15px 24px; border-radius: 12px; border: none;
          font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.01em;
          transition: opacity 0.15s, transform 0.1s;
        }
        .pd-buy-btn:active { transform: scale(0.98); }
        .pd-buy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pd-buy-btn.paid   { background: #0C0B08; color: #E8A020; }
        .pd-buy-btn.free-b { background: rgba(20,184,166,0.1); color: #0E8A7C; border: 1px solid rgba(20,184,166,0.3); }
        .pd-buy-btn.done   { background: rgba(20,184,166,0.1); color: #0E8A7C; border: 1px solid rgba(20,184,166,0.3); }

        .pd-trust {
          margin-top: 16px; padding-top: 16px; border-top: 1px solid #F3F1EE;
          display: flex; flex-direction: column; gap: 8px;
        }
        .pd-trust-item {
          display: flex; align-items: center; gap: 8px;
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.06em; color: #9CA3AF;
        }

        .pd-error   { padding: 12px 16px; border-radius: 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); color: #DC2626; font-size: 13px; margin-top: 12px; }
        .pd-success { padding: 12px 16px; border-radius: 10px; background: rgba(20,184,166,0.06); border: 1px solid rgba(20,184,166,0.2); color: #0E8A7C; font-size: 13px; margin-top: 12px; }
      `}</style>

      {/* Nav */}
      <nav className="pd-nav">
        <div className="pd-nav-inner">
          <Link href="/">
            <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 26, width: 'auto' }} />
          </Link>
          <Link href="/products" className="pd-back">← All Products</Link>
        </div>
      </nav>

      <div className="pd-layout">

        {/* LEFT — Image */}
        <div className="pd-image-wrap">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="pd-image-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#D1CEC9" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
            </div>
          )}
        </div>

        {/* RIGHT — Info + Purchase */}
        <div>
          {/* Eyebrow */}
          <div className="pd-eyebrow">
            <span className="pd-cat" style={{
              background: `${catColor}12`, color: catColor,
              border: `1px solid ${catColor}25`,
            }}>
              {product.category}
            </span>
            {product.badge && <span className="pd-badge">{product.badge}</span>}
            {product.is_featured && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#E8A020' }}>★ Featured</span>
            )}
          </div>

          <h1 className="pd-title">{product.name}</h1>
          <p className="pd-tagline">{product.tagline}</p>

          {/* Purchase card */}
          <div className="pd-purchase">
            <div className="pd-price-row">
              <span className={`pd-price${isFree ? ' free-price' : ''}`}>
                {isFree ? 'Free' : formatPrice(product.price, product.currency)}
              </span>
              {!isFree && (
                <span className="pd-currency">{product.currency}</span>
              )}
            </div>
            {!isFree && (
              <p className="pd-price-note">CHARGED IN NGN AT CURRENT RATE</p>
            )}

            {purchased ? (
              <a
                href={product.cta_url}
                target={product.cta_url.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="pd-buy-btn done"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                ✓ Purchased — Access Now
              </a>
            ) : (
              <button
                onClick={handleBuy}
                disabled={paying}
                className={`pd-buy-btn ${isFree ? 'free-b' : 'paid'}`}
              >
                {paying ? 'Processing…' : product.cta_label || (isFree ? 'Download Free' : `Buy for ${formatPrice(product.price, product.currency)}`)}
              </button>
            )}

            {!isFree && !purchased && (
              <div className="pd-trust">
                <div className="pd-trust-item">🔒 Secured by Paystack</div>
                <div className="pd-trust-item">💳 Card · Bank Transfer · USSD</div>
                <div className="pd-trust-item">📧 Receipt sent to your email</div>
              </div>
            )}
            {isFree && (
              <div className="pd-trust">
                <div className="pd-trust-item">✓ No payment required</div>
                <div className="pd-trust-item">✓ Instant access</div>
              </div>
            )}

            {error   && <div className="pd-error">{error}</div>}
            {success && <div className="pd-success">✓ {success}</div>}
          </div>

          {/* Description */}
          {product.description && (
            <div className="pd-description" style={{ whiteSpace: 'pre-wrap' }}>
              {product.description}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
