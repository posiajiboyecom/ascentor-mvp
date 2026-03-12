// ============================================================
// app/p/[subdomain]/checkout/PartnerCheckoutClient.tsx
// Brand-aware checkout — uses partner colours and plan names
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Partner } from '@/types/partner';

interface Props {
  partner: Partner;
  plans: {
    explorer: { name: string; monthly_ngn: number; yearly_ngn: number; features?: string | null };
    builder:  { name: string; monthly_ngn: number; yearly_ngn: number; features?: string | null };
    climber:  { name: string; monthly_ngn: number; yearly_ngn: number; features?: string | null };
  };
  paystackKey:    string;
  defaultPlan:    string;
  defaultBilling: string;
  requiredPlan?:  string;
  trialDays:      number;
}

type PlanKey = 'explorer' | 'builder' | 'climber';

export default function PartnerCheckoutClient({
  partner, plans, paystackKey, defaultPlan, defaultBilling, requiredPlan, trialDays,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const brand = partner.brand;

  const [selectedPlan, setSelectedPlan]     = useState<PlanKey>((defaultPlan as PlanKey) || 'explorer');
  const [billing, setBilling]               = useState<'monthly' | 'yearly'>(defaultBilling as any || 'monthly');
  const [loading, setLoading]               = useState(false);
  const [checkoutError, setCheckoutError]   = useState('');
  const [userEmail, setUserEmail]           = useState('');
  const [userId, setUserId]                 = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserEmail(user.email || ''); setUserId(user.id); }
    });
  }, []);

  const currentPlan = plans[selectedPlan];
  const priceNGN    = billing === 'yearly' ? currentPlan.yearly_ngn : currentPlan.monthly_ngn;
  const savings     = billing === 'yearly'
    ? Math.max(0, (currentPlan.monthly_ngn * 12) - currentPlan.yearly_ngn)
    : 0;

  const handleCheckout = async () => {
    if (!userId) { router.push(`/p/${partner.subdomain}/login?redirect=/p/${partner.subdomain}/checkout`); return; }
    setLoading(true);

    try {
      const PaystackPop = (window as any).PaystackPop;
      if (!PaystackPop) { setCheckoutError('Payment system is loading, please wait a moment and try again.'); setLoading(false); return; }

      const handler = PaystackPop.setup({
        key:       paystackKey,
        email:     userEmail,
        amount:    priceNGN * 100, // kobo
        currency:  'NGN',
        ref:       `partner_${partner.id}_${Date.now()}`,
        metadata: {
          user_id:       userId,
          partner_id:    partner.id,
          plan:          selectedPlan,
          billing_cycle: billing,
          is_trial:      true,
        },
        onSuccess: async (response: { reference: string }) => {
          // Use the partner-specific verify route which handles revenue split
          const res = await fetch('/api/partner/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference:  response.reference,
              plan:       selectedPlan,
              billing,
              partner_id: partner.id,
            }),
          });
          if (res.ok) {
            router.push(`/p/${partner.subdomain}/dashboard?welcome=1`);
          } else {
            const errData = await res.json().catch(() => ({}));
            setCheckoutError(
              errData.error ||
              'Payment received but activation failed. Please contact support with your reference: ' +
              response.reference
            );
          }
          setLoading(false);
        },
        onCancel: () => setLoading(false),
      });
      handler.openIframe();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const planEntries = Object.entries(plans) as [PlanKey, typeof plans['explorer']][];

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', color: 'var(--text)',
    border: '1px solid var(--border)', outline: 'none',
  };

  return (
    <>
      {/* Paystack script */}
      <script src="https://js.paystack.co/v1/inline.js" async />

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          {brand.logo_url
            ? <img src={brand.logo_url} alt={brand.platform_name} style={{ height: 28 }} />
            : <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                {brand.platform_name}
              </span>
          }
        </nav>

        <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '40px 20px' }}>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700,
            color: 'var(--text)', marginBottom: 6,
          }}>
            Choose your plan
          </h1>
          {requiredPlan && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              You need a <strong style={{ color: 'var(--accent)' }}>{requiredPlan}</strong> plan or higher to access that feature.
            </p>
          )}

          {/* Billing toggle */}
          <div style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            marginBottom: 20, width: 'fit-content',
          }}>
            {(['monthly', 'yearly'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, textTransform: 'capitalize',
                  background: billing === b ? 'var(--accent)' : 'transparent',
                  color: billing === b ? '#000' : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}>
                {b}
                {b === 'yearly' && (
                  <span style={{
                    marginLeft: 6, fontSize: 9, background: 'rgba(0,0,0,0.2)',
                    padding: '1px 5px', borderRadius: 4,
                  }}>
                    SAVE 17%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {planEntries.map(([key, plan]) => {
              const isSelected = selectedPlan === key;
              const ngn  = billing === 'yearly' ? plan.yearly_ngn : plan.monthly_ngn;
              return (
                <button key={key} onClick={() => setSelectedPlan(key)}
                  style={{
                    width: '100%', padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
                    textAlign: 'left', border: isSelected ? `2px solid var(--accent)` : '2px solid var(--border)',
                    background: isSelected ? 'rgba(255,255,255,0.03)' : 'var(--bg-card)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{
                        fontSize: 14, fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text)',
                        marginBottom: 2,
                      }}>
                        {plan.name}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                        ₦{ngn.toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>/mo</span>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trial callout */}
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              ✦ Start with a <strong style={{ color: 'var(--accent)' }}>{trialDays}-day free trial</strong>.
              You won't be charged until day {trialDays + 1}.
              {savings > 0 && ` Save ₦${savings.toLocaleString()} with annual billing.`}
            </p>
          </div>

          {/* CTA */}
          <button onClick={() => { setCheckoutError(''); handleCheckout(); }} disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: 'var(--accent)', color: '#000', border: 'none',
              fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
            }}>
            {loading ? 'Opening payment...' : `Start ${trialDays}-day free trial →`}
          </button>

          {/* Inline error — replaces alert() */}
          {checkoutError && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ color: '#EF4444', fontSize: 13, lineHeight: 1.5, flex: 1 }}>
                {checkoutError}
              </span>
              <button
                onClick={() => setCheckoutError('')}
                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 12 }}>
            Cancel anytime · Secure payment via Paystack
          </p>
        </div>

        {!brand.hide_ascentor_branding && (
          <div style={{
            textAlign: 'center', padding: '16px', fontSize: 11,
            color: 'var(--text-dim)', borderTop: '1px solid var(--border)',
          }}>
            Powered by{' '}
            <a href="https://ascentorbi.com" target="_blank" rel="noopener noreferrer"
              style={{ color: '#E8A020', textDecoration: 'none' }}>
              Ascentor
            </a>
          </div>
        )}
      </div>
    </>
  );
}
