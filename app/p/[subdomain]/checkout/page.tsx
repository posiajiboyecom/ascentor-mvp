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
  params: { subdomain: string };
  searchParams: { plan?: string; billing?: string; required?: string };
}) {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const ctx = await getPartnerContext(hostname);
  const { partner } = ctx;

  const overrides = partner.plan_overrides;
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!;

  // Build plan pricing — use partner overrides if set, else Ascentor defaults
  const plans = {
    explorer: {
      name:      overrides?.explorer_name  || 'Explorer',
      monthly:   overrides?.explorer_price_usd || 9,
      yearly:    Math.round((overrides?.explorer_price_usd || 9) * 10),
    },
    builder: {
      name:      overrides?.builder_name   || 'Builder',
      monthly:   overrides?.builder_price_usd  || 19,
      yearly:    Math.round((overrides?.builder_price_usd  || 19) * 10),
    },
    climber: {
      name:      overrides?.climber_name   || 'Climber',
      monthly:   overrides?.climber_price_usd  || 39,
      yearly:    Math.round((overrides?.climber_price_usd  || 39) * 10),
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
