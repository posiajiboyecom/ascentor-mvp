'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ── Config ─────────────────────────────── */
const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxx';
const SELAR_PRODUCT_SLUG = 'your-ascentor-product-slug';
const BASE_PRICE = 15;

/* ── Promo types ────────────────────────── */
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

const FEATURES = [
  { icon: '🤖', text: 'Unlimited AI coaching sessions, 24/7' },
  { icon: '🎯', text: 'Live expert sessions with African leaders' },
  { icon: '👥', text: 'Peer accountability cohort matching' },
  { icon: '📚', text: 'Leadership micro-lessons library' },
  { icon: '📊', text: 'Weekly progress tracking & reflections' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const supabase = createClient();

  /* ── Form state ── */
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  /* ── Promo state ── */
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<Promo | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  /* ── Payment state ── */
  const [paying, setPaying] = useState<string | null>(null);
  const [done, setDone] = useState<{ method: string; name: string } | null>(null);

  /* ── Derived ── */
  const discount = promoApplied?.off ?? 0;
  const isFree = discount >= 100;
  const finalPrice = Math.round(BASE_PRICE * (1 - discount / 100) * 100) / 100;

  /* ── Validate ── */
  const validate = useCallback(() => {
    const e: Record<string, boolean> = {};
    if (!firstName.trim()) e.firstName = true;
    if (!lastName.trim()) e.lastName = true;
    if (!email.trim() || !email.includes('@') || !email.includes('.')) e.email = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, email]);

  /* ── Apply promo ── */
  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoMsg({ text: 'Enter a promo code.', ok: false }); return; }
    setPromoLoading(true);

    const local = LOCAL_PROMOS[code];
    if (!local) {
      setPromoMsg({ text: 'Invalid promo code. Try again.', ok: false });
      setPromoLoading(false);
      return;
    }

    // Server-side validation against DB
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
      // Fallback to local if API not yet deployed
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

  /* ── Create subscription in Supabase ── */
  const createSubscription = async (provider: string, providerRef: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 37 * 24 * 60 * 60 * 1000);
    const refundUntil = new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

    let plan = 'standard';
    let status = 'trialing';
    if (promoApplied?.type === 'tester') { plan = 'tester'; status = 'active'; }
    else if (promoApplied?.type === 'founders') { plan = 'founder'; }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-subscription',
          userId: user.id,
          promoCode,
          provider,
          providerReference: providerRef,
          amountCents: Math.round(finalPrice * 100),
        }),
      });
      await res.json();
    } catch {
      // Fallback: write directly if API not deployed
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        plan,
        status,
        price_cents: Math.round(finalPrice * 100),
        currency: 'USD',
        payment_provider: provider,
        provider_reference: providerRef,
        trial_starts_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        refund_eligible_until: refundUntil.toISOString(),
      }, { onConflict: 'user_id' });
    }
  };

  /* ── Paystack ── */
  const payWithPaystack = () => {
    if (!validate()) return;
    setPaying('paystack');

    const handler = (window as any).PaystackPop?.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: Math.round(finalPrice * 100),
      currency: 'USD',
      firstName,
      lastName,
      ref: 'ASC_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      metadata: {
        custom_fields: [
          { display_name: 'Full Name', variable_name: 'full_name', value: `${firstName} ${lastName}` },
          { display_name: 'Promo Code', variable_name: 'promo_code', value: promoCode || 'none' },
        ],
      },
      callback: async (response: any) => {
        await createSubscription('paystack', response.reference);
        setDone({ method: 'paystack', name: firstName });
        setPaying(null);
      },
      onClose: () => setPaying(null),
    });

    if (handler) {
      handler.openIframe();
    } else {
      // Demo fallback when Paystack not loaded
      setTimeout(async () => {
        await createSubscription('paystack', 'demo_' + Date.now());
        setDone({ method: 'paystack', name: firstName });
        setPaying(null);
      }, 1500);
    }
  };

  /* ── Selar ── */
  const payWithSelar = () => {
    if (!validate()) return;
    setPaying('selar');
    const fullName = `${firstName} ${lastName}`;
    let url = `https://selar.co/${SELAR_PRODUCT_SLUG}?add_to_cart=1`;
    url += `&email=${encodeURIComponent(email)}&fullname=${encodeURIComponent(fullName)}`;
    window.open(url, '_blank');
    setTimeout(() => setPaying(null), 2000);
  };

  /* ── Free / Tester ── */
  const activateFree = async () => {
    if (!validate()) return;
    setPaying('free');
    await createSubscription('free', 'free_' + Date.now());
    setDone({ method: 'free', name: firstName });
    setPaying(null);
  };

  /* ════════════════════════════════════
     SUCCESS STATE
     ════════════════════════════════════ */
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
        style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-2xl p-8 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl"
              style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.19)' }}>
              ✓
            </div>

            <h2 className="text-xl font-semibold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
              {done.method === 'free' ? "You're In!" : 'Payment Confirmed!'}
            </h2>

            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              {done.method === 'free'
                ? `Free tester access activated for ${done.name}. Your feedback will shape Ascentor's future.`
                : `Welcome, ${done.name}! Your 7-day free trial starts now. You won't be charged until it ends.`}
            </p>

            {done.method !== 'free' && (
              <p className="text-xs mb-6" style={{ color: 'var(--teal)' }}>
                🛡️ 30-day money-back guarantee after trial ends.
              </p>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--accent)', color: '#000' }}>
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════
     CHECKOUT FORM
     ════════════════════════════════════ */
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8"
      style={{ background: 'var(--bg)' }}>
      {/* Paystack Script */}
      <script src="https://js.paystack.co/v2/inline.js" async />

      <div className="w-full max-w-md animate-fade-up">

        {/* Demo banner — remove in production */}
        <div className="rounded-lg px-4 py-3 mb-4 text-center text-xs font-semibold"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
            color: 'var(--accent)',
          }}>
          🧪 DEMO — Try codes: <code className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--bg-input)' }}>FOUNDER50</code> or{' '}
          <code className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--bg-input)' }}>TESTER100</code>
        </div>

        {/* Main card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

          {/* ── Header ── */}
          <div className="p-6">
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
              style={{
                background: 'rgba(245,158,11,0.09)',
                border: '1px solid rgba(245,158,11,0.19)',
                color: 'var(--accent)',
              }}>
              ★ Standard Plan
            </span>

            <h1 className="text-xl font-semibold mt-3 mb-1"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
              Leadership Coaching Membership
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              AI coaching, live expert sessions, and peer accountability — all in one membership.
            </p>

            {/* Price */}
            <div className="flex items-baseline gap-1 mt-4">
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>$</span>
              <span className="text-[44px] font-extrabold leading-none" style={{ color: 'var(--text)' }}>
                {isFree ? '0' : finalPrice}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-dim)' }}>/month</span>
              {discount > 0 && !isFree && (
                <span className="text-sm line-through ml-2" style={{ color: 'var(--text-dim)' }}>
                  ${BASE_PRICE}
                </span>
              )}
            </div>

            {/* Trial + refund badges */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                🎁 7-day free trial
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.12)', color: '#93c5fd' }}>
                🛡️ 30-day money-back
              </span>
            </div>

            {/* Savings badge */}
            {discount > 0 && (
              <div className="mt-3 inline-block text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>
                {isFree
                  ? '🎉 Full free access activated'
                  : `🎉 You save $${(BASE_PRICE * discount / 100).toFixed(2)}/mo (${discount}% off)`}
              </div>
            )}
          </div>

          {/* ── Features ── */}
          <div className="px-6 pb-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3 mb-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs"
                  style={{ background: 'rgba(16,185,129,0.08)' }}>
                  {f.icon}
                </div>
                <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* ── Form ── */}
          <div className="px-6 pb-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  First Name
                </label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: errors.firstName
                      ? '1.5px solid rgba(239,68,68,0.7)'
                      : '1px solid var(--border)',
                    outline: 'none',
                  }}
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: false })); }}
                  placeholder="Ade"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  Last Name
                </label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: errors.lastName
                      ? '1.5px solid rgba(239,68,68,0.7)'
                      : '1px solid var(--border)',
                    outline: 'none',
                  }}
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: false })); }}
                  placeholder="Johnson"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mt-3">
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>
                Email Address
              </label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: errors.email
                    ? '1.5px solid rgba(239,68,68,0.7)'
                    : '1px solid var(--border)',
                  outline: 'none',
                }}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: false })); }}
                placeholder="ade@company.com"
              />
            </div>

            {/* Promo toggle */}
            <button
              onClick={() => setPromoOpen(!promoOpen)}
              className="text-xs font-bold mt-4 flex items-center gap-1"
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{
                display: 'inline-block',
                transform: promoOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                fontSize: 10,
              }}>▼</span>
              Have a promo code?
            </button>

            {/* Promo input */}
            {promoOpen && (
              <div className="flex gap-2 mt-2.5">
                <input
                  className="flex-1 px-3 py-2.5 text-xs rounded-xl uppercase tracking-wider"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    outline: 'none',
                    opacity: promoApplied ? 0.5 : 1,
                  }}
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  disabled={!!promoApplied}
                  maxLength={20}
                  onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                />
                {!promoApplied ? (
                  <button
                    onClick={applyPromo}
                    disabled={promoLoading}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      border: '1.5px solid var(--accent)',
                      background: 'transparent',
                      color: 'var(--accent)',
                    }}>
                    {promoLoading ? '...' : 'Apply'}
                  </button>
                ) : (
                  <button
                    onClick={removePromo}
                    className="px-4 py-2 rounded-xl text-xs font-bold"
                    style={{ border: '1.5px solid rgba(239,68,68,0.6)', background: 'transparent', color: '#ef4444' }}>
                    Remove
                  </button>
                )}
              </div>
            )}

            {/* Promo message */}
            {promoMsg && (
              <div className="rounded-lg px-3 py-2 mt-2 text-xs font-semibold flex items-center gap-2"
                style={{
                  background: promoMsg.ok ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.08)',
                  border: promoMsg.ok ? '1px solid rgba(16,185,129,0.19)' : '1px solid rgba(239,68,68,0.15)',
                  color: promoMsg.ok ? 'var(--success)' : '#ef4444',
                }}>
                <span>{promoMsg.ok ? '✓' : '✕'}</span>
                <span>{promoMsg.text}</span>
              </div>
            )}

            {/* ── CTA Buttons ── */}
            <div className="flex flex-col gap-2.5 mt-5">
              {isFree ? (
                <button
                  onClick={activateFree}
                  disabled={!!paying}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'var(--success)', color: '#000' }}>
                  {paying === 'free' ? (
                    <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                      style={{ animation: 'spin 0.6s linear infinite' }} />
                  ) : '✓'}
                  {paying === 'free' ? 'Activating...' : 'Activate Free Tester Access'}
                </button>
              ) : (
                <>
                  {/* Paystack */}
                  <button
                    onClick={payWithPaystack}
                    disabled={!!paying}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: '#000' }}>
                    {paying === 'paystack' ? (
                      <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"
                        style={{ animation: 'spin 0.6s linear infinite' }} />
                    ) : '💳'}
                    {paying === 'paystack' ? 'Processing...' : `Pay with Paystack — $${finalPrice}/mo`}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-0.5">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>

                  {/* Selar */}
                  <button
                    onClick={payWithSelar}
                    disabled={!!paying}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {paying === 'selar' ? (
                      <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"
                        style={{ animation: 'spin 0.6s linear infinite' }} />
                    ) : '💰'}
                    {paying === 'selar' ? 'Redirecting...' : `Pay with Selar — $${finalPrice}/mo`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Trust bar ── */}
          <div className="flex items-center justify-center gap-4 flex-wrap py-4 px-6"
            style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>🔒 Secure payment</span>
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>✓ Cancel anytime</span>
            <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>🕐 30-day refund</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-5 text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          By subscribing you agree to our{' '}
          <a href="/terms" style={{ color: 'var(--accent)' }}>Terms</a> &{' '}
          <a href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</a>.<br />
          Questions?{' '}
          <a href="mailto:support@ascentor.co" style={{ color: 'var(--accent)' }}>support@ascentor.co</a>
        </p>
      </div>
    </div>
  );
}
