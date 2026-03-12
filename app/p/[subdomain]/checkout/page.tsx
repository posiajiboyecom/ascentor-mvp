// ============================================================
// FILE LOCATION: app/p/[subdomain]/checkout/page.tsx
//
// BUG FIXED:
//   BUG-11 — Added extraction of the x-ascentor-api-base header
//             that proxy.ts (FILE_09) injects on custom domain
//             requests. The value is passed as the `apiBase` prop
//             to PartnerCheckoutClient so the Paystack onSuccess
//             verify fetch hits ascentorbi.com/api/... instead of
//             customdomain.com/api/... (which would 404).
//
//             On *.ascentorbi.com subdomains the header is absent,
//             apiBase is '' and relative URLs work unchanged.
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

  // BUG-11: on custom domains (coaching.johnadeyemi.com) the middleware
  // injects x-ascentor-api-base = 'https://ascentorbi.com' so the client
  // can prefix /api/... calls with the correct origin.
  // On *.ascentorbi.com subdomains this header is absent and apiBase is '',
  // which means relative URLs continue to work unchanged.
  const apiBase = headersList.get('x-ascentor-api-base') || '';

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
  // All numeric fields explicitly cast with Number() to satisfy TypeScript
  // (plan_overrides is JSONB so Supabase types fields as string | number)
  const plans = {
    explorer: {
      name:        String(overrides?.explorer_name     || 'Explorer'),
      monthly_ngn: Number(overrides?.explorer_monthly_ngn || ((Number(overrides?.explorer_price_usd) || 9)  * NGN_RATE)),
      yearly_ngn:  Number(overrides?.explorer_yearly_ngn  || (Math.round((Number(overrides?.explorer_price_usd) || 9)  * 10) * NGN_RATE)),
      features:    overrides?.explorer_features ? String(overrides.explorer_features) : null,
    },
    builder: {
      name:        String(overrides?.builder_name      || 'Builder'),
      monthly_ngn: Number(overrides?.builder_monthly_ngn  || ((Number(overrides?.builder_price_usd)  || 19) * NGN_RATE)),
      yearly_ngn:  Number(overrides?.builder_yearly_ngn   || (Math.round((Number(overrides?.builder_price_usd)  || 19) * 10) * NGN_RATE)),
      features:    overrides?.builder_features  ? String(overrides.builder_features)  : null,
    },
    climber: {
      name:        String(overrides?.climber_name      || 'Climber'),
      monthly_ngn: Number(overrides?.climber_monthly_ngn  || ((Number(overrides?.climber_price_usd)  || 39) * NGN_RATE)),
      yearly_ngn:  Number(overrides?.climber_yearly_ngn   || (Math.round((Number(overrides?.climber_price_usd)  || 39) * 10) * NGN_RATE)),
      features:    overrides?.climber_features  ? String(overrides.climber_features)  : null,
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
      apiBase={apiBase}
    />
  );
}
