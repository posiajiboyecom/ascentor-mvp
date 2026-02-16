'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const BASE_PRICE = 15;

type PromoType = 'founders' | 'tester';
interface Promo { off: number; label: string; type: PromoType }
const PROMOS: Record<string, Promo> = {
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

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoApplied, setPromoApplied] = useState<Promo | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [paying, setPaying] = useState<string | null>(null);
  const [done, setDone] = useState<{ method: string; name: string } | null>(null);

  const discount = promoApplied?.off ?? 0;
  const isFree = discount >= 100;
  const finalPrice = Math.round(BASE_PRICE * (1 - discount / 100) * 100) / 100;

  // ── On mount: check auth, prefill from session ──
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/signup');
        return;
      }

      // Prefill email from auth
      if (user.email) setEmail(user.email);

      // Prefill name from OAuth metadata (Google/LinkedIn)
      const meta = user.user_metadata;
      if (meta?.full_name) {
        const parts = meta.full_name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      } else if (meta?.name) {
        const parts = meta.name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }

      setLoading(false);
    }
    init();
  }, []);

  const validate = useCallback(() => {
    const e: Record<string, boolean> = {};
    if (!firstName.trim()) e.firstName = true;
    if (!lastName.trim()) e.lastName = true;
    if (!email.trim() || !email.includes('@') || !email.includes('.')) e.email = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [firstName, lastName, email]);

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoMsg({ text: 'Enter a promo code.', ok: false }); return; }
    const match = PROMOS[code];
    if (!match) {
      setPromoMsg({ text: 'Invalid promo code. Try again.', ok: false });
      return;
    }
    setPromoApplied(match);
    setPromoMsg({ text: match.label, ok: true });
  };

  const removePromo = () => {
    setPromoApplied(null);
    setPromoInput('');
    setPromoMsg(null);
  };

  // ── Mock payment — replace with real Paystack/Selar later ──
  const handlePay = (method: string) => {
    if (!validate()) return;
    setPaying(method);
    setTimeout(() => {
      setDone({ method, name: firstName });
      setPaying(null);
    }, 1500);
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="text-3xl mb-3">⬆</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Success → onboarding (profile not set up yet) ──
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
        style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-xl p-8 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl font-bold"
              style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.19)', color: 'var(--success)' }}>
              ✓
            </div>
            <h2 className="text-xl font-semibold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
              {done.method === 'free' ? "You're In!" : 'Payment Confirmed!'}
            </h2>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              {done.method === 'free'
                ? `Welcome, ${done.name}! Your tester access is active.`
                : `Welcome, ${done.name}! Your 7-day free trial starts now.`}
            </p>
            {done.method !== 'free' && (
              <p className="text-xs mb-5" style={{ color: 'var(--teal)' }}>
                🛡️ 30-day money-back guarantee after trial ends.
              </p>
            )}
            <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
              Let's set up your leadership profile next.
            </p>
            <button onClick={() => router.push('/onboarding')}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--accent)', color: '#000' }}>
              Set Up Profile →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout form ──
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-8"
      style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fade-up">

        {/* Demo banner — remove in production */}
        <div className="rounded-lg px-4 py-3 mb-4 text-center text-xs font-semibold"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
            color: 'var(--accent)',
          }}>
          🧪 MOCK — Try: <code className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--bg-input)' }}>FOUNDER50</code> or{' '}
          <code className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--bg-input)' }}>TESTER100</code>
        </div>

        {/* Card */}
        <div className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>

          {/* Header */}
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

            <div className="flex items-baseline gap-1 mt-4">
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>$</span>
              <span className="text-[44px] font-extrabold leading-none"
                style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
                {isFree ? '0' : finalPrice}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-dim)' }}>/month</span>
              {discount > 0 && !isFree && (
                <span className="text-sm line-through ml-2" style={{ color: 'var(--text-dim)' }}>${BASE_PRICE}</span>
              )}
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              {['🎁 7-day free trial', '🛡️ 30-day money-back'].map((badge) => (
                <span key={badge} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                  style={{
                    background: 'rgba(96,165,250,0.08)',
                    border: '1px solid rgba(96,165,250,0.12)',
                    color: '#93c5fd',
                  }}>
                  {badge}
                </span>
              ))}
            </div>

            {discount > 0 && (
              <div className="mt-3 inline-block text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.19)', color: 'var(--success)' }}>
                {isFree
                  ? '🎉 Full free access activated'
                  : `🎉 You save $${(BASE_PRICE * discount / 100).toFixed(2)}/mo (${discount}% off)`}
              </div>
            )}
          </div>

          {/* Features */}
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

          {/* Form */}
          <div className="px-6 pb-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>First Name</label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: errors.firstName ? '1.5px solid var(--error)' : '1px solid var(--border)',
                    outline: 'none',
                  }}
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: false })); }}
                  placeholder="Ade"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>Last Name</label>
                <input
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                  style={{
                    background: 'var(--bg-input)',
                    color: 'var(--text)',
                    border: errors.lastName ? '1.5px solid var(--error)' : '1px solid var(--border)',
                    outline: 'none',
                  }}
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: false })); }}
                  placeholder="Johnson"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-[11px] font-bold mb-1 block" style={{ color: 'var(--text-muted)' }}>Email Address</label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl"
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text)',
                  border: errors.email ? '1.5px solid var(--error)' : '1px solid var(--border)',
                  outline: 'none',
                  opacity: email ? 0.7 : 1,
                }}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: false })); }}
                placeholder="ade@company.com"
                readOnly={!!email}
              />
            </div>

            {/* Promo */}
            <button onClick={() => setPromoOpen(!promoOpen)}
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
                  <button onClick={applyPromo}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ border: '1.5px solid var(--accent)', background: 'transparent', color: 'var(--accent)' }}>
                    Apply
                  </button>
                ) : (
                  <button onClick={removePromo}
                    className="px-4 py-2 rounded-xl text-xs font-bold"
                    style={{ border: '1.5px solid var(--error)', background: 'transparent', color: 'var(--error)' }}>
                    Remove
                  </button>
                )}
              </div>
            )}

            {promoMsg && (
              <div className="rounded-lg px-3 py-2 mt-2 text-xs font-semibold flex items-center gap-2"
                style={{
                  background: promoMsg.ok ? 'rgba(16,185,129,0.09)' : 'rgba(239,68,68,0.08)',
                  border: promoMsg.ok ? '1px solid rgba(16,185,129,0.19)' : '1px solid rgba(239,68,68,0.15)',
                  color: promoMsg.ok ? 'var(--success)' : 'var(--error)',
                }}>
                <span>{promoMsg.ok ? '✓' : '✕'}</span>
                <span>{promoMsg.text}</span>
              </div>
            )}

            {/* CTA */}
            <div className="flex flex-col gap-2.5 mt-5">
              {isFree ? (
                <button onClick={() => handlePay('free')} disabled={!!paying}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'var(--success)', color: '#000' }}>
                  {paying === 'free' ? '⏳ Activating...' : '✓ Activate Free Tester Access'}
                </button>
              ) : (
                <>
                  <button onClick={() => handlePay('paystack')} disabled={!!paying}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--accent)', color: '#000' }}>
                    {paying === 'paystack' ? '⏳ Processing...' : `💳 Pay with Paystack — $${finalPrice}/mo`}
                  </button>
                  <div className="flex items-center gap-3 my-0.5">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>or</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  </div>
                  <button onClick={() => handlePay('selar')} disabled={!!paying}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {paying === 'selar' ? '⏳ Redirecting...' : `💰 Pay with Selar — $${finalPrice}/mo`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Trust */}
          <div className="flex items-center justify-center gap-4 flex-wrap py-4 px-6"
            style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
            {['🔒 Secure payment', '✓ Cancel anytime', '🕐 30-day refund'].map((t) => (
              <span key={t} className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{t}</span>
            ))}
          </div>
        </div>

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
