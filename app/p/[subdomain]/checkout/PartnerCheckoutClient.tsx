// ============================================================
// FILE LOCATION: app/p/[subdomain]/checkout/PartnerCheckoutClient.tsx
//
// BUG FIXED:
//   BUG-11 — The Paystack onSuccess handler called:
//               fetch('/api/partner/payment/verify', ...)
//             This is a relative URL. On the ascentorbi.com
//             subdomain (john.ascentorbi.com) this works because
//             the request stays on ascentorbi.com's Vercel deployment.
//             But on custom domains (coaching.johnadeyemi.com),
//             the relative URL resolves to:
//               coaching.johnadeyemi.com/api/partner/payment/verify
//             which does not exist — only ascentorbi.com hosts
//             the API routes.
//
//             Fix: the proxy middleware now injects an
//             x-ascentor-api-base response header on all
//             custom domain requests (FILE_09). The checkout
//             server component reads this via the `headers()`
//             function and passes it as an `apiBase` prop.
//             The client then prefixes all API calls with it.
//
//             When apiBase is empty (subdomain, non-custom domain),
//             behaviour is unchanged — the relative URL is used.
//
// PREVIOUS FIXES PRESERVED:
//   W-10 — Dynamic yearly saving percentage badge.
// ============================================================

'use client';

import type { Partner, PartnerBrand } from '@/types/partner';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

type PlanKey = 'explorer' | 'builder' | 'climber';

interface PlanConfig {
  name:        string;
  monthly_ngn: number;
  yearly_ngn:  number;
}

export default function PartnerCheckoutClient({
  partner,
  plans,
  paystackKey,
  trialDays,
  apiBase = '',   // FIX BUG-11: injected by server component; empty on subdomain, full URL on custom domain
  defaultPlan,
  defaultBilling,
  requiredPlan: requiredPlanProp,
}: {
  partner:       Partner;
  plans:         Record<PlanKey, PlanConfig>;
  paystackKey:   string;
  trialDays:     number;
  apiBase?:      string;
  defaultPlan?:  string;
  defaultBilling?: string;
  requiredPlan?: string;
}) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(((defaultPlan || searchParams.get('plan')) as PlanKey) || 'builder');
  const [billing, setBilling]           = useState<'monthly' | 'yearly'>((defaultBilling as 'monthly' | 'yearly') || 'monthly');
  const [loading, setLoading]           = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [userEmail, setUserEmail]         = useState('');
  const [userId, setUserId]               = useState('');
  const [requiredPlan]                    = useState(requiredPlanProp || searchParams.get('required_plan'));

  const brand = partner.brand as PartnerBrand;

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

  // W-10: dynamic saving percentage
  const yearlySavingPct = currentPlan.monthly_ngn > 0
    ? Math.round(
        ((currentPlan.monthly_ngn * 12) - currentPlan.yearly_ngn)
        / (currentPlan.monthly_ngn * 12)
        * 100
      )
    : 0;

  const handleCheckout = async () => {
    if (!userId) {
      router.push(`/p/${partner.subdomain}/login?redirect=/p/${partner.subdomain}/checkout`);
      return;
    }
    setLoading(true);

    try {
      const PaystackPop = (window as any).PaystackPop;
      if (!PaystackPop) {
        setCheckoutError('Payment system is loading, please wait a moment and try again.');
        setLoading(false);
        return;
      }

      const handler = PaystackPop.setup({
        key:      paystackKey,
        email:    userEmail,
        amount:   priceNGN * 100,
        currency: 'NGN',
        ref:      `partner_${partner.id}_${Date.now()}`,
        metadata: {
          user_id:       userId,
          partner_id:    partner.id,
          plan:          selectedPlan,
          billing_cycle: billing,
          is_trial:      true,
        },
        onSuccess: async (response: { reference: string }) => {
          // FIX BUG-11: prefix with apiBase so custom domain requests hit
          // ascentorbi.com/api/... instead of customdomain.com/api/...
          const verifyUrl = `${apiBase}/api/partner/payment/verify`;

          const res = await fetch(verifyUrl, {
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

  const planEntries = Object.entries(plans) as [PlanKey, PlanConfig][];

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-input)', color: 'var(--text)',
    border: '1px solid var(--border)', outline: 'none',
  };

  return (
    <>
      <script src="https://js.paystack.co/v1/inline.js" async />

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            {brand.platform_name}
          </span>
        </nav>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>

            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, color: 'var(--text)', marginBottom: 8 }}>
              Join {brand.platform_name}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 15 }}>
              {brand.tagline || `Get access to ${brand.platform_name}'s full coaching platform.`}
            </p>

            {/* Billing toggle */}
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
              {(['monthly', 'yearly'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: billing === b ? 'var(--accent)' : 'transparent',
                    color: billing === b ? '#000' : 'var(--text-dim)',
                    fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                  }}
                >
                  {b === 'monthly' ? 'Monthly' : (
                    <>
                      Yearly
                      {yearlySavingPct > 0 && billing !== 'yearly' && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, background: '#10B981',
                          color: '#fff', borderRadius: 4, padding: '2px 5px', fontWeight: 700,
                        }}>
                          SAVE {yearlySavingPct}%
                        </span>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Plan cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {planEntries.map(([key, plan]) => {
                const ngn = billing === 'yearly' ? plan.yearly_ngn : plan.monthly_ngn;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    style={{
                      padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${selectedPlan === key ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedPlan === key ? 'rgba(232,160,32,0.06)' : 'var(--bg-card)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 16 }}>{plan.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>
                          ₦{ngn.toLocaleString()}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                          /{billing === 'yearly' ? 'yr' : 'mo'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trial note */}
            {trialDays > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                ✦ Start with a <strong style={{ color: 'var(--accent)' }}>{trialDays}-day free trial</strong>.
                You won't be charged until day {trialDays + 1}.
                {savings > 0 && ` Save ₦${savings.toLocaleString()} with annual billing.`}
              </p>
            )}

            {checkoutError && (
              <div style={{ marginBottom: 16, padding: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 10, color: '#EF4444', fontSize: 14 }}>
                {checkoutError}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{
                width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                background: 'var(--accent)', color: '#000', fontWeight: 700,
                fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Opening payment...' : `Start ${trialDays}-day free trial →`}
            </button>

          </div>
        </div>
      </div>
    </>
  );
}
