// FILE: app/checkout/page.tsx
// ── Checkout gate ──────────────────────────────────────────────
// Reads `checkout_enabled` from Supabase platform_settings on the
// server. If checkout is disabled (Free Mode), redirects straight
// to /dashboard - no pricing page shown, no client JS runs.
//
// The env var FREE_MODE=true acts as a hard override for local dev.
// ──────────────────────────────────────────────────────────────
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getShellData } from '@/lib/shell-data';
import UserShell from '@/components/shell/UserShell';
import CheckoutClient from './CheckoutClient';
import { getPlanPricing } from '@/lib/plans-config';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
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
    // Table not seeded yet - allow through (safe default: paid mode)
  }

  // A signed-in member checks out inside their own shell (sidebar and header). Guests, and members who
  // are mid-onboarding, get the standalone page.
  const { from } = await searchParams;
  const shell = from === 'onboarding' ? null : await getShellData();
  if (shell) {
    return (
      <UserShell userId={shell.userId} userName={shell.userName} email={shell.email} avatarUrl={shell.avatarUrl} role={shell.role} summitRegistered={shell.summitRegistered}>
        <CheckoutClient embedded pricing={getPlanPricing()} />
      </UserShell>
    );
  }
  return <CheckoutClient pricing={getPlanPricing()} />;
}
