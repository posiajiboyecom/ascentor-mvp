'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ================================================================
   CONFIG — swap keys before going live
   ================================================================ */
const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxx';
const SELAR_PRODUCT_SLUG = 'your-ascentor-product-slug';
const BASE_PRICE = 15; // USD

/* ================================================================
   LOCAL PROMO LOOKUP (instant UI feedback, server validates later)
   ================================================================ */
type PromoType = 'founders' | 'tester';
interface Promo { off: number; label: string; type: PromoType }

const LOCAL_PROMOS: Record<string, Promo> = {
  FOUNDER50:  { off: 50,  label: 'Founders Promo — 50% off!',  type: 'founders' },
  ASCENTOR50: { off: 50,  label: 'Founders Promo — 50% off!',  type: 'founders' },
  EARLYBIRD:  { off: 50,  label: 'Founders Promo — 50% off!',  type: 'founders' },
  TESTER100:  { off: 100, label: 'Tester Access — 100% free!', type: 'tester' },
  BETATESTER: { off: 100, label: 'Tester Access — 100% free!', type: 'tester' },
  FREEACCESS: { off: 100, label: 'Tester Access — 100% free!', type: 'tester' },
};

/* ================================================================
   FEATURES LIST
   ================================================================ */
const FEATURES = [
  'Unlimited AI coaching sessions, 24/7',
  'Live expert sessions with African leaders',
  'Peer accountability cohort matching',
  'Leadership micro-lessons library',
  'Weekly progress tracking & reflections',
];

/* ================================================================
   COMPONENT
   ================================================================ */
export default function CheckoutPage() {
  const router = useRouter();

  // Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Promo
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<Promo | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Payment
  const [paying, setPaying] = useState<string | null>(null); // 'paystack' | 'selar' | 'free'
  const [done, setDone] = useState<{ method: string; name: string } | null>(null);

  // Derived
  const discount = promoApplied?.off ?? 0;
  const isFree = discount >= 100;
  const finalPrice = Math.round(BASE_PRICE * (1 - discount / 100) * 100) / 100;

  /* ── Validation ─────────────────────────────── */
  const validate = useCallback(() => {
    const e: Record<string, boolean> = {};
    if (!firstName.trim()) e.firstName = true;
    if (!lastName.trim()) e.lastName = true;
    if (!email.trim() || !email.includes('@') || !email.includes('.')) e.email = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, email]);

  /* ── Apply Promo ────────────────────────────── */
  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoMsg({ text: 'Enter a promo code.', ok: false }); return; }

    setPromoLoading(true);
    // Quick local check first for instant UI
    const local = LOCAL_PROMOS[code];
    if (!local) {
      setPromoMsg({ text: 'Invalid promo code. Try again.', ok: false });
      setPromoLoading(false);
      return;
    }

    // Server-side validation
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-promo', code }),
      });
      const data = await res.json();

      if (data.valid) {
        setPromoApplied(local);
        setPromoCode(code);
        setPromoMsg({ text: local.label, ok: true });
      } else {
        setPromoMsg({ text: data.error || 'Invalid code.', ok: false });
      }
    } catch {
      // Fallback to local validation if API is unreachable
      setPromoApplied(local);
      setPromoCode(code);
      setPromoMsg({ text: local.label, ok: true });
    }
    setPromoLoading(false);
  };

  const removePromo = () => {
    setPromoApplied(null);
    setPromoCode('');
    setPromoInput('');
    setPromoMsg(null);
  };

  /* ── Paystack ───────────────────────────────── */
  const payWithPaystack = () => {
    if (!validate()) return;
    setPaying('paystack');

    // Load Paystack inline
    const handler = (window as any).PaystackPop?.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(finalPrice * 100), // cents
      currency: 'USD',
      firstName,
      lastName,
      ref: 'ASC_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      metadata: {
        custom_fields: [
          { display_name: 'Full Name', variable_name: 'full_name', value: `${firstName} ${lastName}` },
          { display_name: 'Plan', variable_name: 'plan', value: promoApplied?.type || 'standard' },
          { display_name: 'Promo Code', variable_name: 'promo_code', value: promoCode || 'none' },
        ],
      },
      callback: (response: any) => {
        // TODO: POST to /api/checkout { action: 'create-subscription', ... }
        setDone({ method: 'paystack', name: firstName });
        setPaying(null);
      },
      onClose: () => {
        setPaying(null);
      },
    });

    if (handler) {
      handler.openIframe();
    } else {
      // Paystack script not loaded — demo fallback
      setTimeout(() => {
        setDone({ method: 'paystack', name: firstName });
        setPaying(null);
      }, 1500);
    }
  };

  /* ── Selar ──────────────────────────────────── */
  const payWithSelar = () => {
    if (!validate()) return;
    setPaying('selar');
    const fullName = `${firstName} ${lastName}`;
    let url = `https://selar.co/${SELAR_PRODUCT_SLUG}?add_to_cart=1`;
    url += `&email=${encodeURIComponent(email)}`;
    url += `&fullname=${encodeURIComponent(fullName)}`;
    window.open(url, '_blank');
    setTimeout(() => setPaying(null), 2000);
  };

  /* ── Free / Tester ──────────────────────────── */
  const activateFree = async () => {
    if (!validate()) return;
    setPaying('free');
    // TODO: POST to /api/checkout { action: 'create-subscription', provider: 'free', ... }
    setTimeout(() => {
      setDone({ method: 'free', name: firstName });
      setPaying(null);
    }, 1200);
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <>
      {/* Paystack Script */}
      <script src="https://js.paystack.co/v2/inline.js" async />

      <div style={styles.page}>
        <div style={styles.wrapper}>

          {/* ── Demo Banner ── */}
          <div style={styles.demoBanner}>
            🧪 DEMO — Try codes: <code style={styles.code}>FOUNDER50</code> (50% off)
            &nbsp;or&nbsp; <code style={styles.code}>TESTER100</code> (free)
          </div>

          {/* ── Card ── */}
          <div style={styles.card}>

            {!done ? (
              <>
                {/* HEADER */}
                <div style={styles.sec}>
                  <div style={styles.badge}>★ Standard Plan</div>
                  <h1 style={styles.title}>Leadership Coaching Membership</h1>
                  <p style={styles.desc}>
                    AI coaching, live expert sessions, and peer accountability
                    — all in one membership.
                  </p>

                  {/* Price */}
                  <div style={styles.priceRow}>
                    <span style={styles.priceSym}>$</span>
                    <span style={styles.priceNum}>{isFree ? '0' : finalPrice}</span>
                    <span style={styles.pricePer}>/month</span>
                    {discount > 0 && !isFree && (
                      <span style={styles.priceOld}>${BASE_PRICE}</span>
                    )}
                  </div>

                  {/* Trial + Refund */}
                  <div style={styles.trialRow}>
                    <span style={styles.trialBadge}>🎁 7-day free trial</span>
                    <span style={styles.trialBadge}>🛡️ 30-day money-back</span>
                  </div>

                  {discount > 0 && (
                    <div style={styles.savingsBadge}>
                      {isFree
                        ? '🎉 Full free access activated'
                        : `🎉 You save $${(BASE_PRICE * discount / 100).toFixed(2)}/mo (${discount}% off)`}
                    </div>
                  )}
                </div>

                {/* FEATURES */}
                <div style={{ ...styles.sec, ...styles.secBorder }}>
                  {FEATURES.map((f, i) => (
                    <div key={i} style={styles.feat}>
                      <div style={styles.featDot}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1D8348" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* FORM + CTA */}
                <div style={{ ...styles.sec, ...styles.secBorder }}>
                  {/* Name row */}
                  <div style={styles.row2}>
                    <div style={styles.field}>
                      <label style={styles.label}>First Name</label>
                      <input
                        style={{ ...styles.input, ...(errors.firstName ? styles.inputErr : {}) }}
                        value={firstName}
                        onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: false })); }}
                        placeholder="Ade"
                      />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Last Name</label>
                      <input
                        style={{ ...styles.input, ...(errors.lastName ? styles.inputErr : {}) }}
                        value={lastName}
                        onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: false })); }}
                        placeholder="Johnson"
                      />
                    </div>
                  </div>
                  {/* Email */}
                  <div style={{ ...styles.field, marginTop: 12 }}>
                    <label style={styles.label}>Email Address</label>
                    <input
                      type="email"
                      style={{ ...styles.input, ...(errors.email ? styles.inputErr : {}) }}
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: false })); }}
                      placeholder="ade@company.com"
                    />
                  </div>

                  {/* Promo */}
                  <div style={{ marginTop: 16 }}>
                    <button style={styles.promoTog} onClick={() => setPromoOpen(!promoOpen)}>
                      <span style={{
                        display: 'inline-block',
                        transform: promoOpen ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform .2s',
                        marginRight: 5,
                        fontSize: 12,
                      }}>▼</span>
                      Have a promo code?
                    </button>

                    {promoOpen && (
                      <div style={styles.promoRow}>
                        <input
                          style={styles.promoIn}
                          value={promoInput}
                          onChange={e => setPromoInput(e.target.value.toUpperCase())}
                          placeholder="ENTER CODE"
                          disabled={!!promoApplied}
                          maxLength={20}
                          onKeyDown={e => e.key === 'Enter' && applyPromo()}
                        />
                        {!promoApplied ? (
                          <button style={styles.promoBtn} onClick={applyPromo} disabled={promoLoading}>
                            {promoLoading ? '...' : 'Apply'}
                          </button>
                        ) : (
                          <button style={styles.promoRmBtn} onClick={removePromo}>Remove</button>
                        )}
                      </div>
                    )}

                    {promoMsg && (
                      <div style={{
                        ...styles.promoMsg,
                        color: promoMsg.ok ? '#1D8348' : '#E74C3C',
                        background: promoMsg.ok ? 'rgba(29,131,72,.12)' : 'rgba(231,76,60,.1)',
                      }}>
                        {promoMsg.text}
                      </div>
                    )}
                  </div>

                  {/* BUTTONS */}
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {isFree ? (
                      <button style={styles.btnFree} onClick={activateFree} disabled={!!paying}>
                        {paying === 'free' ? <SpinnerSvg /> : '✓'}&nbsp;
                        {paying === 'free' ? 'Activating...' : 'Activate Free Tester Access'}
                      </button>
                    ) : (
                      <>
                        <button style={styles.btnPaystack} onClick={payWithPaystack} disabled={!!paying}>
                          {paying === 'paystack' ? <SpinnerSvg /> : <CardSvg />}&nbsp;
                          {paying === 'paystack' ? 'Processing...' : `Pay with Paystack — $${finalPrice}/mo`}
                        </button>
                        <div style={styles.divider}><span>or</span></div>
                        <button style={styles.btnSelar} onClick={payWithSelar} disabled={!!paying}>
                          {paying === 'selar' ? <SpinnerSvg /> : <CoinSvg />}&nbsp;
                          {paying === 'selar' ? 'Redirecting...' : `Pay with Selar — $${finalPrice}/mo`}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* TRUST */}
                <div style={styles.trust}>
                  <span style={styles.trustItem}>🔒 Secure payment</span>
                  <span style={styles.trustItem}>✓ Cancel anytime</span>
                  <span style={styles.trustItem}>🕐 30-day refund</span>
                </div>
              </>
            ) : (
              /* ── SUCCESS STATE ── */
              <div style={styles.successWrap}>
                <div style={styles.successIcon}>✓</div>
                <h2 style={styles.successTitle}>
                  {done.method === 'free' ? "You're In!" : 'Payment Confirmed!'}
                </h2>
                <p style={styles.successDesc}>
                  {done.method === 'free'
                    ? `Free tester access activated for ${done.name}. Your feedback will shape Ascentor's future.`
                    : `Welcome, ${done.name}! Your 7-day free trial starts now. You won't be charged until it ends.`}
                </p>
                <p style={styles.successSubDesc}>
                  {done.method !== 'free' && '🛡️ 30-day money-back guarantee after trial ends.'}
                </p>
                <button style={styles.btnDash} onClick={() => router.push('/dashboard')}>
                  Go to Dashboard →
                </button>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <p style={styles.footer}>
            By subscribing you agree to our{' '}
            <a href="/terms" style={styles.footerLink}>Terms</a> &{' '}
            <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>.<br />
            Questions?{' '}
            <a href="mailto:support@ascentor.co" style={styles.footerLink}>support@ascentor.co</a>
          </p>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   TINY SVG COMPONENTS
   ================================================================ */
function SpinnerSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin .6s linear infinite' }}>
      <circle cx="12" cy="12" r="10" opacity=".2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
function CardSvg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
}
function CoinSvg() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>;
}

/* ================================================================
   STYLES — matches your dark Ascentor theme
   ================================================================ */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    // Match your app's dark background
    background: 'linear-gradient(180deg, #0c1220 0%, #111827 100%)',
  },
  wrapper: {
    width: '100%',
    maxWidth: 460,
  },

  // Demo banner
  demoBanner: {
    textAlign: 'center' as const,
    fontSize: 11,
    fontWeight: 700,
    color: '#e8952e',
    background: 'rgba(232,149,46,.1)',
    border: '1px solid rgba(232,149,46,.2)',
    padding: '8px 14px',
    borderRadius: 10,
    marginBottom: 16,
    letterSpacing: .3,
  },
  code: {
    background: 'rgba(255,255,255,.08)',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10.5,
    fontFamily: 'monospace',
  },

  // Card
  card: {
    background: '#1a2236',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,.06)',
    boxShadow: '0 8px 40px rgba(0,0,0,.3)',
    overflow: 'hidden',
  },
  sec: {
    padding: '24px 26px',
  },
  secBorder: {
    borderTop: '1px solid rgba(255,255,255,.06)',
  },

  // Header
  badge: {
    display: 'inline-block',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: '#e8952e',
    background: 'rgba(232,149,46,.12)',
    padding: '5px 12px',
    borderRadius: 99,
    border: '1px solid rgba(232,149,46,.15)',
  },
  title: {
    fontSize: 21,
    fontWeight: 700,
    color: '#f0f0f0',
    marginTop: 14,
    lineHeight: 1.3,
  },
  desc: {
    fontSize: 13,
    color: '#8a94a6',
    lineHeight: 1.55,
    marginTop: 5,
  },

  // Price
  priceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 18,
  },
  priceSym: {
    fontSize: 17,
    fontWeight: 700,
    color: '#f0f0f0',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  priceNum: {
    fontSize: 46,
    fontWeight: 700,
    color: '#f0f0f0',
    lineHeight: 1,
    transition: 'all .25s',
  },
  pricePer: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 2,
  },
  priceOld: {
    fontSize: 15,
    color: '#6b7280',
    textDecoration: 'line-through',
    marginLeft: 8,
  },

  // Trial & refund badges
  trialRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap' as const,
  },
  trialBadge: {
    fontSize: 11.5,
    fontWeight: 600,
    color: '#93c5fd',
    background: 'rgba(147,197,253,.08)',
    border: '1px solid rgba(147,197,253,.12)',
    padding: '4px 10px',
    borderRadius: 8,
  },
  savingsBadge: {
    marginTop: 10,
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 700,
    color: '#34d399',
    background: 'rgba(52,211,153,.1)',
    padding: '5px 12px',
    borderRadius: 8,
  },

  // Features
  feat: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#c9d1d9',
    marginBottom: 9,
  },
  featDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(29,131,72,.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Form
  row2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  field: {},
  label: {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#c9d1d9',
    marginBottom: 5,
    letterSpacing: .15,
  },
  input: {
    width: '100%',
    padding: '11px 13px',
    border: '1.5px solid rgba(255,255,255,.1)',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 13.5,
    color: '#f0f0f0',
    background: 'rgba(255,255,255,.04)',
    outline: 'none',
    transition: 'border .2s, box-shadow .2s',
  },
  inputErr: {
    borderColor: '#E74C3C',
    boxShadow: '0 0 0 3px rgba(231,76,60,.15)',
  },

  // Promo
  promoTog: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#e8952e',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  },
  promoRow: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  promoIn: {
    flex: 1,
    padding: '10px 12px',
    border: '1.5px solid rgba(255,255,255,.1)',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 12,
    color: '#f0f0f0',
    background: 'rgba(255,255,255,.04)',
    outline: 'none',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
  promoBtn: {
    padding: '10px 16px',
    border: '1.5px solid #e8952e',
    borderRadius: 10,
    background: 'transparent',
    color: '#e8952e',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  promoRmBtn: {
    padding: '10px 16px',
    border: '1.5px solid #E74C3C',
    borderRadius: 10,
    background: 'transparent',
    color: '#E74C3C',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  promoMsg: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: 8,
    lineHeight: 1.5,
  },

  // Buttons
  btnPaystack: {
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 12,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #0BA4DB, #0991C5)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(11,164,219,.3)',
    transition: 'all .2s',
  },
  btnSelar: {
    width: '100%',
    padding: 14,
    border: '1.5px solid rgba(255,255,255,.1)',
    borderRadius: 12,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'rgba(255,255,255,.04)',
    color: '#c9d1d9',
    transition: 'all .2s',
  },
  btnFree: {
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 12,
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, #1D8348, #1A7A40)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(29,131,72,.3)',
    transition: 'all .2s',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    fontWeight: 700,
  },

  // Trust
  trust: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap' as const,
    padding: '16px 26px',
    background: 'rgba(255,255,255,.02)',
    borderTop: '1px solid rgba(255,255,255,.06)',
  },
  trustItem: {
    fontSize: 10.5,
    color: '#6b7280',
    fontWeight: 500,
  },

  // Success
  successWrap: {
    textAlign: 'center' as const,
    padding: '52px 28px 44px',
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    background: 'rgba(29,131,72,.15)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    fontSize: 26,
    color: '#34d399',
    fontWeight: 700,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f0f0f0',
  },
  successDesc: {
    fontSize: 13.5,
    color: '#8a94a6',
    lineHeight: 1.6,
    maxWidth: 300,
    margin: '8px auto 10px',
  },
  successSubDesc: {
    fontSize: 12,
    color: '#93c5fd',
    marginBottom: 22,
  },
  btnDash: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '11px 26px',
    background: '#e8952e',
    color: '#0c1220',
    border: 'none',
    borderRadius: 10,
    fontFamily: 'inherit',
    fontSize: 13.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background .15s',
  },

  // Footer
  footer: {
    textAlign: 'center' as const,
    marginTop: 18,
    fontSize: 11.5,
    color: '#6b7280',
    lineHeight: 1.7,
  },
  footerLink: {
    color: '#e8952e',
    textDecoration: 'none',
  },
};
