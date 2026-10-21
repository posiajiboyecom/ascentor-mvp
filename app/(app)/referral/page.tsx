// app/(app)/referral/page.tsx
// Invite and earn: link, code, share buttons, who joined, and the extra days earned.
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ReferralClient, { type Invite } from './ReferralClient';

export const dynamic = 'force-dynamic';

export default async function ReferralPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, referral_code, referral_bonus_days')
    .eq('id', user.id)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, created_at, rewarded_at, referred_id')
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
      rewarded: !!r.rewarded_at,
    }));
  }

  return (
    <ReferralClient
      code={profile?.referral_code || ''}
      daysEarned={profile?.referral_bonus_days ?? 0}
      invites={invites}
    />
  );
}
