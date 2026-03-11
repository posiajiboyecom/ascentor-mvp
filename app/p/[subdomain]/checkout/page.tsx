// ============================================================
// app/p/[subdomain]/checkout/page.tsx
// Partner-branded checkout. Uses partner's plan_overrides for
// pricing and their Paystack public key if configured.
// Falls back to Ascentor defaults if not overridden.
// ============================================================

import { headers } from 'next/headers';
import { getPartnerContext } from '@/lib/getPartnerContext';
import PartnerCheckoutClient from './PartnerCheckoutClient';

export default async function PartnerCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: { plan?: string; billing?: string; required?: string };
}) {
  await params; // Next.js 15+ requires params to be awaited
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const ctx = await getPartnerContext(hostname);
  const { partner } = ctx;

  const overrides = partner.plan_overrides;
  // Use partner's own Paystack PUBLIC key if configured, else fall back to Ascentor's
  // The partner's public key is stored as paystack_public_key on the partners table.
  // The secret key is stored separately and never sent to client.
  const paystackPublicKey =
    (partner as any).paystack_public_key ||
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!;

  // NGN_RATE for USD fallback (partners setting NGN directly won't need this)
  const NGN_RATE = 1600;

  // Build plan pricing — prefer NGN overrides, fall back to USD * rate, then defaults
  const plans = {
    explorer: {
      name:           overrides?.explorer_name        || 'Explorer',
      monthly_ngn:    overrides?.explorer_monthly_ngn || ((overrides?.explorer_price_usd || 9)  * NGN_RATE),
      yearly_ngn:     overrides?.explorer_yearly_ngn  || (Math.round((overrides?.explorer_price_usd || 9)  * 10) * NGN_RATE),
      features:       overrides?.explorer_features    || null,
    },
    builder: {
      name:           overrides?.builder_name         || 'Builder',
      monthly_ngn:    overrides?.builder_monthly_ngn  || ((overrides?.builder_price_usd  || 19) * NGN_RATE),
      yearly_ngn:     overrides?.builder_yearly_ngn   || (Math.round((overrides?.builder_price_usd  || 19) * 10) * NGN_RATE),
      features:       overrides?.builder_features     || null,
    },
    climber: {
      name:           overrides?.climber_name         || 'Climber',
      monthly_ngn:    overrides?.climber_monthly_ngn  || ((overrides?.climber_price_usd  || 39) * NGN_RATE),
      yearly_ngn:     overrides?.climber_yearly_ngn   || (Math.round((overrides?.climber_price_usd  || 39) * 10) * NGN_RATE),
      features:       overrides?.climber_features     || null,
    },
  };

  return (
    <PartnerCheckoutClient
      partner={partner}
      plans={plans}
      paystackKey={paystackPublicKey}
      defaultPlan={(searchParams.plan as string) || 'explorer'}
      defaultBilling={(searchParams.billing as string) || 'monthly'}
      requiredPlan={searchParams.required}
      trialDays={overrides?.trial_days ?? 7}
    />
  );
}
