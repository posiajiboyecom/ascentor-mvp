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
import { closedPlanIds } from '@/lib/admin/plans-open';
import { billingV2Enabled } from '@/lib/billing/flags';
import { getSubscription } from '@/lib/billing/subscriptions';
import { listCards, VERIFY_AMOUNT_KOBO } from '@/lib/billing/cards';
import { getGroupStatus } from '@/lib/billing/groups';
import { formatNaira, type Tier } from '@/lib/billing/catalog';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe } from '@/lib/rx/server';
import CheckoutV2 from '@/components/billing/CheckoutV2';
import '@/styles/rx.css';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ from?: string; group?: string }> }) {
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
  const { from, group } = await searchParams;
  const shell = from === 'onboarding' ? null : await getShellData();

  // Billing v2 (BILLING_V2=on): the new checkout. With the switch off, everything below is today's checkout, untouched.
  if (billingV2Enabled()) {
    const me = await getMe();
    if (!me) redirect('/login?redirect=/checkout');
    const { data: prof } = await supabaseAdmin.from('profiles').select('leader_free').eq('id', me.userId).maybeSingle();
    // Invited facilitators lead for free and skip checkout entirely. Members who already have a v2 plan manage it in Billing.
    if ((prof as { leader_free?: boolean } | null)?.leader_free) redirect('/dashboard');
    if (await getSubscription(me.userId)) redirect('/settings/billing');
    const [cards, groupStatus] = await Promise.all([listCards(me.userId), getGroupStatus(me.userId)]);
    // Default tier from the onboarding stage: Seeking is Seeker, Building and Leading are Builder. Leaders never pick a Leader plan here.
    const defaultTier: Tier = me.profile?.stage === 'Building' || me.profile?.stage === 'Leading' ? 'builder' : 'explorer';
    const v2 = (
      <div className="rx">
        <CheckoutV2 defaultTier={defaultTier} initialCards={cards} verifyAmountLabel={formatNaira(VERIFY_AMOUNT_KOBO)}
          existingGroupCode={groupStatus.group?.code ?? null} presetCode={typeof group === 'string' ? group.slice(0, 24) : null} tz={me.tz} />
      </div>
    );
    if (shell) {
      return (
        <UserShell userId={shell.userId} userName={shell.userName} email={shell.email} avatarUrl={shell.avatarUrl} role={shell.role} summitRegistered={shell.summitRegistered}>
          {v2}
        </UserShell>
      );
    }
    return v2;
  }

  const closed = await closedPlanIds();
  // Leader is never bought here: Leaders lead for free (invite, Make Leader, or Leading stage).
  const pricing = getPlanPricing().filter((p) => !closed.includes(p.id) && p.id !== 'leader');
  if (shell) {
    return (
      <UserShell userId={shell.userId} userName={shell.userName} email={shell.email} avatarUrl={shell.avatarUrl} role={shell.role} summitRegistered={shell.summitRegistered}>
        <CheckoutClient embedded pricing={pricing} />
      </UserShell>
    );
  }
  return <CheckoutClient pricing={pricing} />;
}
