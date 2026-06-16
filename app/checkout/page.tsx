// FILE: app/checkout/page.tsx
// ── Checkout gate ──────────────────────────────────────────────
// Reads `checkout_enabled` from Supabase platform_settings on the
// server. If checkout is disabled (Free Mode), redirects straight
// to /dashboard — no pricing page shown, no client JS runs.
//
// The env var FREE_MODE=true acts as a hard override for local dev.
// ──────────────────────────────────────────────────────────────
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutClient from './CheckoutClient';

export default async function CheckoutPage() {
  // Hard env override
  if (process.env.FREE_MODE === 'true') {
    redirect('/dashboard');
  }

  // DB-backed toggle
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'checkout_enabled')
      .single();

    // If row exists and is explicitly 'false' → free mode
    if (data && data.value === 'false') {
      redirect('/dashboard');
    }
  } catch {
    // Table not seeded yet — allow through (safe default: paid mode)
  }

  return <CheckoutClient />;
}
