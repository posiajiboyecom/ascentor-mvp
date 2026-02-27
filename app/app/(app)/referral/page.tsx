import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ReferralClient from './ReferralClient';

export default async function ReferralPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, referral_code, referral_count, referred_by')
    .eq('id', user.id)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('id, status, created_at, rewarded_at, referred_id')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  // Get names of referred users
  let referralDetails: any[] = [];
  if (referrals && referrals.length > 0) {
    const ids = referrals.map((r) => r.referred_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ids);

    referralDetails = referrals.map((r) => ({
      id: r.id,
      name: profiles?.find((p) => p.id === r.referred_id)?.full_name || 'Unknown',
      status: r.status,
      date: r.created_at,
      rewarded: r.rewarded_at,
    }));
  }

  return (
    <ReferralClient
      firstName={profile?.full_name?.split(' ')[0] || 'there'}
      referralCode={profile?.referral_code || ''}
      referralCount={profile?.referral_count || 0}
      referredBy={profile?.referred_by || null}
      referrals={referralDetails}
    />
  );
}
