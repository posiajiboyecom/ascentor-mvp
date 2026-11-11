// FILE: app/checkout/page.tsx
// ── Checkout gate ──────────────────────────────────────────────
// Reads `checkout_enabled` from Supabase platform_settings on the
// server. If checkout is disabled (Free Mode), shows a short notice
// instead of plans - no pricing shown, no card form.
//
// The env var FREE_MODE=true acts as a hard override for local dev.
// ──────────────────────────────────────────────────────────────
import { redirect } from 'next/navigation';
import { isCheckoutOn } from '@/lib/checkout-switch';
import { getShellData } from '@/lib/shell-data';
import UserShell from '@/components/shell/UserShell';
import { getSubscription } from '@/lib/billing/subscriptions';
import { listCards, VERIFY_AMOUNT } from '@/lib/billing/cards';
import { getGroupStatus } from '@/lib/billing/groups';
import { PAID_TIERS, formatMoney, type Tier } from '@/lib/billing/catalog';
import { visitorCurrency } from '@/lib/geo';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getMe } from '@/lib/rx/server';
import { closedPlanIds } from '@/lib/admin/plans-open';
import CheckoutV2 from '@/components/billing/CheckoutV2';
import '@/styles/rx.css';
import '@/styles/rx-settings.css';
import '@/styles/rx-billing.css';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ from?: string; group?: string }> }) {
  // Checkout switch (admin overview: "Checkout"). Read OUTSIDE any try/catch: redirect() works by throwing, and an
  // earlier version caught that throw, so turning checkout off never took effect.
  const checkoutOn = await isCheckoutOn();
  if (!checkoutOn) {
    return (
      <div className="rx">
        <div className="rx-card rx-stack-sm" style={{ maxWidth: 560, margin: '32px auto' }}>
          <p className="rx-h3">Paid plans aren’t open yet</p>
          <p className="rx-p">Everything you have today keeps working. We’ll let you know when Seeker, Builder and Pinnacle open.</p>
          <div><a className="rx-btn secondary" href="/dashboard">Back to Today</a></div>
        </div>
      </div>
    );
  }

  // A signed-in member checks out inside their own shell (sidebar and header). Guests, and members who
  // are mid-onboarding, get the standalone page.
  const { from, group } = await searchParams;
  const shell = from === 'onboarding' ? null : await getShellData();

  // Billing v2 checkout: Seeker or Builder, solo or group, monthly or yearly. The only way to buy a plan.
  {
    const me = await getMe();
    if (!me) redirect('/login?redirect=/checkout');
    const { data: prof } = await supabaseAdmin.from('profiles').select('leader_free').eq('id', me.userId).maybeSingle();
    // Invited facilitators lead for free and skip checkout entirely. Members who already have a v2 plan manage it in Billing.
    if ((prof as { leader_free?: boolean } | null)?.leader_free) redirect('/dashboard');
    if (await getSubscription(me.userId)) redirect('/settings/billing');
    // Currency is decided here from where the member is: naira in Nigeria, US dollars everywhere else. No switch.
    const [cards, groupStatus, closed, currency] = await Promise.all([listCards(me.userId), getGroupStatus(me.userId), closedPlanIds(), visitorCurrency()]);
    // Default tier from the onboarding stage: Seeking is Seeker, Building and Leading are Builder. Leaders never pick a Leader plan here.
    const suggested: Tier = me.profile?.stage === 'Building' || me.profile?.stage === 'Leading' ? 'builder' : 'explorer';
    const defaultTier: Tier = closed.includes(suggested) ? (PAID_TIERS.find((t) => !closed.includes(t)) ?? suggested) : suggested;
    const v2 = PAID_TIERS.every((t) => closed.includes(t)) ? (
      <div className="rx">
        <div className="rx-card rx-stack-sm" style={{ maxWidth: 560, margin: '32px auto' }}>
          <p className="rx-h3">Plans aren’t open for sign-ups right now</p>
          <p className="rx-p">Seeker, Builder and Pinnacle will open again soon. Nothing has been charged.</p>
          <div><a className="rx-btn secondary" href="/dashboard">Back to Today</a></div>
        </div>
      </div>
    ) : (
      <div className="rx">
        <CheckoutV2 defaultTier={defaultTier} initialCards={cards} verifyAmountLabel={formatMoney(VERIFY_AMOUNT[currency], currency)} currency={currency}
          existingGroupCode={groupStatus.group?.code ?? null} presetCode={typeof group === 'string' ? group.slice(0, 24) : null} tz={me.tz}
          closedTiers={closed} />
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
}
