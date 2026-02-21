'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// ASCENTOR CHECKOUT — Pricing + Paystack Popup
// Route: /checkout
// ============================================================

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: string;
  name: string;
  description: string;
  icon: string;
  monthlyPrice: number;     // USD
  yearlyPrice: number;      // USD (total per year)
  paystackPlanCode?: string; // Paystack plan code (set after creating plans)
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Essential coaching for emerging leaders',
    icon: '🌱',
    monthlyPrice: 15,
    yearlyPrice: 120, // $10/mo billed yearly
    features: [
      '10 AI coaching sessions/month',
      'Access to community cohorts',
      'Course library access',
      'Goal tracking (3 active goals)',
      'Weekly reflection prompts',
      'Coaching session summaries',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Unlimited coaching for serious leaders',
    icon: '🚀',
    monthlyPrice: 25,
    yearlyPrice: 200, // ~$17/mo billed yearly
    features: [
      'Unlimited AI coaching sessions',
      'Full course library access',
      'Expert session recordings',
      'Unlimited goal tracking',
      'Advanced coaching summaries',
      'Priority community support',
      'Export coaching history',
      'Analytics dashboard',
    ],
    highlighted: true,
    cta: 'Start Free Trial',
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For teams building leaders at scale',
    icon: '🏛️',
    monthlyPrice: 49,
    yearlyPrice: 396, // $33/mo billed yearly
    features: [
      'Everything in Standard',
      'Team dashboard (up to 25 seats)',
      'Custom coaching frameworks',
      'Dedicated account manager',
      'SSO integration',
      'API access',
      'Custom branding',
      'Quarterly strategy reviews',
    ],
    cta: 'Start Free Trial',
  },
];

// Promo codes
const PROMO_CODES: Record<string, { discount: number; label: string; appliesTo: string[] }> = {
  'FOUNDER50':  { discount: 0.50, label: '50% off — Founders Discount', appliesTo: ['basic', 'standard', 'premium'] },
  'ASCENTOR50': { discount: 0.50, label: '50% off — Early Access', appliesTo: ['basic', 'standard', 'premium'] },
  'EARLYBIRD':  { discount: 0.50, label: '50% off — Early Bird', appliesTo: ['basic', 'standard', 'premium'] },
  'TESTER100':  { discount: 1.00, label: 'Free Access — Beta Tester', appliesTo: ['basic', 'standard'] },
  'BETATESTER': { discount: 1.00, label: 'Free Access — Beta Tester', appliesTo: ['basic', 'standard'] },
  'FREEACCESS': { discount: 1.00, label: 'Free Access', appliesTo: ['basic', 'standard'] },
};

// NGN exchange rate (update periodically or fetch from API)
const NGN_PER_USD = 1600;

export default function CheckoutPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<{ discount: number; label: string } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/checkout');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profile);
    };
    loadUser();
  }, [supabase, router]);

  // Load Paystack inline script
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('paystack-script')) {
      const script = document.createElement('script');
      script.id = 'paystack-script';
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const applyPromo = () => {
    setPromoError('');
    setPromoApplied(null);
    const code = promoCode.trim().toUpperCase();
    const promo = PROMO_CODES[code];
    if (!promo) {
      setPromoError('Invalid promo code');
      return;
    }
    setPromoApplied({ discount: promo.discount, label: promo.label });
  };

  const getPrice = (plan: Plan): number => {
    const base = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    if (promoApplied && PROMO_CODES[promoCode.trim().toUpperCase()]?.appliesTo.includes(plan.id)) {
      return Math.round(base * (1 - promoApplied.discount) * 100) / 100;
    }
    return base;
  };

  const getMonthlyEquivalent = (plan: Plan): string => {
    if (billing === 'monthly') return '';
    const total = getPrice(plan);
    return `$${(total / 12).toFixed(0)}/mo`;
  };

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      router.push('/login?redirect=/checkout');
      return;
    }

    setSelectedPlan(planId);
    setLoading(true);
    setError('');
    setSuccess('');

    const plan = PLANS.find(p => p.id === planId)!;
    const finalPrice = getPrice(plan);

    // 100% discount — activate immediately
    if (finalPrice === 0 && promoApplied?.discount === 1) {
      try {
        const res = await fetch('/api/payment/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            userId: user.id,
            promoCode: promoCode.trim().toUpperCase(),
          }),
        });
        const data = await res.json();
        if (data.free) {
          setSuccess('Your account has been activated with free access!');
          setTimeout(() => router.push('/dashboard'), 2000);
        } else {
          setError(data.error || 'Failed to activate promo');
        }
      } catch {
        setError('Failed to process. Please try again.');
      }
      setLoading(false);
      return;
    }

    // Paystack popup checkout
    const amountKobo = Math.round(finalPrice * NGN_PER_USD * 100);
    const reference = `asc_${user.id.slice(0, 8)}_${Date.now()}`;

    try {
      // @ts-ignore — Paystack loaded via script
      const paystack = new window.PaystackPop();
      paystack.newTransaction({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        email: user.email,
        amount: amountKobo,
        currency: 'NGN',
        ref: reference,
        metadata: {
          custom_fields: [
            { display_name: 'Plan', variable_name: 'plan', value: planId },
            { display_name: 'Billing', variable_name: 'billing', value: billing },
            ...(promoApplied ? [{ display_name: 'Promo', variable_name: 'promo', value: promoCode.trim().toUpperCase() }] : []),
          ],
          user_id: user.id,
          plan: planId,
          billing_cycle: billing,
          promo_code: promoCode.trim().toUpperCase() || null,
          is_trial: true,
        },
        onSuccess: async (transaction: any) => {
          // Verify payment on server
          try {
            const res = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reference: transaction.reference,
                userId: user.id,
                plan: planId,
                billing: billing,
              }),
            });
            const data = await res.json();
            if (data.success) {
              setSuccess('Your 7-day free trial has started! Welcome to Ascentor.');
              setTimeout(() => router.push('/dashboard'), 2000);
            } else {
              setError('Payment received but verification failed. Contact support.');
            }
          } catch {
            setError('Payment may have succeeded. If not reflected, contact support.');
          }
          setLoading(false);
        },
        onCancel: () => {
          setLoading(false);
          setSelectedPlan(null);
        },
      });
    } catch (err) {
      console.error('Paystack error:', err);
      setError('Payment system not available. Please try again later.');
      setLoading(false);
    }
  };

  const isCurrentPlan = (planId: string) => {
    if (!profile) return false;
    return profile.subscription_plan === planId;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #0A0D14)',
      color: 'var(--text, #F1F0EB)',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '48px 20px 0',
        textAlign: 'center',
      }}>
        <a
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-muted, #8B8A85)',
            fontSize: '14px',
            textDecoration: 'none',
            marginBottom: '24px',
          }}
        >
          ← Back to Dashboard
        </a>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 42px)',
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: '12px',
          background: 'linear-gradient(135deg, var(--text, #F1F0EB) 0%, var(--accent, #F59E0B) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Invest in Your Leadership
        </h1>
        <p style={{
          fontSize: '17px',
          color: 'var(--text-muted, #8B8A85)',
          maxWidth: '560px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
        }}>
          AI-powered coaching built for African professionals. Choose the plan that matches your ambition.
        </p>

        {/* Free Trial Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 20px',
          borderRadius: '24px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          marginBottom: '28px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#10B981',
        }}>
          <span style={{ fontSize: '16px' }}>🎉</span>
          All plans include a 7-day free trial — no charge until day 8
        </div>

        {/* Billing Toggle */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-card, #12151F)',
          border: '1px solid var(--border, #2A2D3A)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '40px',
        }}>
          {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s',
                background: billing === cycle ? 'var(--accent, #F59E0B)' : 'transparent',
                color: billing === cycle ? '#000' : 'var(--text-muted, #8B8A85)',
              }}
            >
              {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
              {cycle === 'yearly' && (
                <span style={{
                  marginLeft: '6px',
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: billing === 'yearly' ? 'rgba(0,0,0,0.2)' : 'rgba(245,158,11,0.15)',
                  color: billing === 'yearly' ? '#000' : 'var(--accent, #F59E0B)',
                }}>
                  Save 33%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        marginBottom: '40px',
      }}>
        {PLANS.map(plan => {
          const price = getPrice(plan);
          const current = isCurrentPlan(plan.id);
          const isHighlighted = plan.highlighted;

          return (
            <div
              key={plan.id}
              style={{
                background: 'var(--bg-card, #12151F)',
                border: `${isHighlighted ? '2px' : '1px'} solid ${isHighlighted ? 'var(--accent, #F59E0B)' : 'var(--border, #2A2D3A)'}`,
                borderRadius: '16px',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = isHighlighted
                  ? '0 16px 48px rgba(245, 158, 11, 0.15)'
                  : '0 16px 48px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Popular badge */}
              {isHighlighted && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent, #F59E0B)',
                  color: '#000',
                  padding: '4px 16px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  Most Popular
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '28px' }}>{plan.icon}</span>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: '8px 0 4px',
                  color: 'var(--text)',
                }}>
                  {plan.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}>
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div style={{ marginBottom: '24px' }}>
                {plan.monthlyPrice === 0 ? (
                  <div style={{ fontSize: '36px', fontWeight: 800 }}>Free</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 800 }}>
                        ${billing === 'monthly' ? price : Math.round(price / 12)}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '15px' }}>/month</span>
                    </div>
                    {billing === 'yearly' && (
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--text-dim, #6B6A65)',
                        margin: '4px 0 0',
                      }}>
                        ${price} billed annually
                        {promoApplied && PROMO_CODES[promoCode.trim().toUpperCase()]?.appliesTo.includes(plan.id) && (
                          <span style={{ color: 'var(--accent)', marginLeft: '4px' }}>
                            (was ${billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice})
                          </span>
                        )}
                      </p>
                    )}
                    {billing === 'monthly' && promoApplied && PROMO_CODES[promoCode.trim().toUpperCase()]?.appliesTo.includes(plan.id) && price < plan.monthlyPrice && (
                      <p style={{
                        fontSize: '13px',
                        color: 'var(--accent)',
                        margin: '4px 0 0',
                      }}>
                        <s style={{ color: 'var(--text-dim)' }}>${plan.monthlyPrice}</s> {promoApplied.label}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 28px',
                flex: 1,
              }}>
                {plan.features.map((feature, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    marginBottom: '10px',
                    fontSize: '14px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}>
                    <span style={{
                      color: isHighlighted ? 'var(--accent, #F59E0B)' : 'var(--success, #10B981)',
                      fontSize: '15px',
                      lineHeight: 1.4,
                      flexShrink: 0,
                    }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={current || (loading && selectedPlan === plan.id)}
                style={{
                  padding: '14px 24px',
                  borderRadius: '10px',
                  border: current ? '1px solid var(--border)' : 'none',
                  cursor: current ? 'default' : 'pointer',
                  fontSize: '15px',
                  fontWeight: 700,
                  transition: 'all 0.2s',
                  background: current
                    ? 'transparent'
                    : isHighlighted
                      ? 'var(--accent, #F59E0B)'
                      : 'var(--bg-input, #1A1D2E)',
                  color: current
                    ? 'var(--text-dim)'
                    : isHighlighted
                      ? '#000'
                      : 'var(--text)',
                  opacity: loading && selectedPlan === plan.id ? 0.7 : 1,
                  width: '100%',
                }}
              >
                {loading && selectedPlan === plan.id
                  ? 'Processing...'
                  : current
                    ? '✓ Current Plan'
                    : plan.cta}
              </button>
              {!current && (
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-dim, #6B6A65)',
                  textAlign: 'center',
                  marginTop: '8px',
                  marginBottom: 0,
                }}>
                  7-day free trial · Cancel anytime
                </p>
              )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Promo Code Section */}
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '0 20px 20px',
      }}>
        <div style={{
          background: 'var(--bg-card, #12151F)',
          border: '1px solid var(--border, #2A2D3A)',
          borderRadius: '12px',
          padding: '20px',
        }}>
          <p style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '12px',
          }}>
            Have a promo code?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value);
                setPromoError('');
                if (!e.target.value) setPromoApplied(null);
              }}
              placeholder="Enter code"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border, #2A2D3A)',
                background: 'var(--bg-input, #1A1D2E)',
                color: 'var(--text)',
                fontSize: '14px',
                outline: 'none',
                textTransform: 'uppercase',
              }}
              onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
            />
            <button
              onClick={applyPromo}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent, #F59E0B)',
                color: '#000',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
          {promoApplied && (
            <p style={{ fontSize: '13px', color: 'var(--success, #10B981)', marginTop: '8px' }}>
              ✓ {promoApplied.label}
            </p>
          )}
          {promoError && (
            <p style={{ fontSize: '13px', color: 'var(--error, #EF4444)', marginTop: '8px' }}>
              {promoError}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          maxWidth: '480px', margin: '0 auto 20px', padding: '0 20px',
        }}>
          <div style={{
            padding: '14px 16px', borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444', fontSize: '14px',
          }}>
            {error}
          </div>
        </div>
      )}
      {success && (
        <div style={{
          maxWidth: '480px', margin: '0 auto 20px', padding: '0 20px',
        }}>
          <div style={{
            padding: '14px 16px', borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10B981', fontSize: '14px',
          }}>
            {success}
          </div>
        </div>
      )}

      {/* Trust Section */}
      <div style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '40px 20px 60px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '32px',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}>
          {[
            { icon: '🎁', text: '7-day free trial on all plans' },
            { icon: '🔒', text: 'Secure payments via Paystack' },
            { icon: '↩️', text: 'Cancel anytime, no questions' },
            { icon: '💳', text: 'Cards, bank transfer, USSD' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', color: 'var(--text-dim, #6B6A65)',
            }}>
              <span>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-dim, #6B6A65)',
          lineHeight: 1.6,
        }}>
          Prices shown in USD. You&apos;ll be charged in NGN at the current exchange rate.
          <br />
          Questions? Email <a href="mailto:hello@ascentorbi.com" style={{ color: 'var(--accent, #F59E0B)' }}>hello@ascentorbi.com</a>
        </p>
      </div>
    </div>
  );
}
