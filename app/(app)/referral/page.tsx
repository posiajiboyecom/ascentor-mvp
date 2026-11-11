// app/(app)/referral/page.tsx
// Invite and earn: link, code, share buttons, who joined, and the Billing v2 credit they earned you.
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ReferralClient, { type Invite } from './ReferralClient';
import { getCreditLedger } from '@/lib/billing/subscriptions';
import { computeCreditLots, CREDIT_RATE_PERCENT } from '@/lib/billing/rules';
import { visitorCurrency } from '@/lib/geo';
import { billingCurrencyFor } from '@/lib/billing/currency';

export const dynamic = 'force-dynamic';

export default async function ReferralPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, referral_code')
    .eq('id', user.id)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, created_at, credit_earned_at, referred_id')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  let invites: Invite[] = [];
  if (referrals?.length) {
    // Other members' names are a server-side lookup: members cannot read each other's profiles.
    const { data: people } = await supabaseAdmin
      .from('profiles').select('id, full_name').in('id', referrals.map((r) => r.referred_id));
    invites = referrals.map((r) => ({
      id: r.id,
      name: people?.find((p) => p.id === r.referred_id)?.full_name || 'A new member',
      joined: r.created_at,
      rewarded: !!r.credit_earned_at,
    }));
  }

  // Credit from friends (Billing v2): earned 14 days after a friend's first real payment, valid 12 months. Credit is earned and
  // spent in the member's billing currency (naira in Nigeria, US dollars elsewhere).
  const currency = await billingCurrencyFor(user.id, await visitorCurrency());
  const ledger = await getCreditLedger(user.id, currency).catch(() => []);
  const now = new Date();
  const earnedKobo = ledger.filter((l) => l.reason === 'referral_earned').reduce((sum, l) => sum + Math.max(0, l.amountKobo), 0);
  const balanceKobo = computeCreditLots(ledger, now).reduce((sum, l) => sum + l.remainingKobo, 0);

  return (
    <ReferralClient
      code={profile?.referral_code || ''}
      earnedKobo={earnedKobo}
      balanceKobo={balanceKobo}
      ratePercent={CREDIT_RATE_PERCENT}
      currency={currency}
      invites={invites}
    />
  );
}
