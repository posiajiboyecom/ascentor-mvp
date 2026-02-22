// ============================================================
// SUBSCRIPTION STATUS — /api/subscription/status
// Returns user's subscription details for the settings page
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end, payment_method, referral_count')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ plan: 'free', status: 'free' });
    }

    const now = new Date();
    const endDate = profile.subscription_end ? new Date(profile.subscription_end) : null;
    const isActive = ['active', 'trialing'].includes(profile.subscription_status) && (!endDate || endDate > now);
    const isCancelled = profile.subscription_status === 'cancelled' && endDate && endDate > now;
    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000)) : 0;

    // Count payments
    const { count: paymentCount } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'success');

    return NextResponse.json({
      plan: profile.subscription_plan || 'free',
      status: profile.subscription_status || 'free',
      isActive: isActive || isCancelled,
      isCancelled,
      isTrialing: profile.subscription_status === 'trialing',
      subscriptionEnd: profile.subscription_end,
      daysLeft,
      paymentMethod: profile.payment_method,
      paymentCount: paymentCount || 0,
      referralCount: profile.referral_count || 0,
      canCancel: isActive && !isCancelled,
    });
  } catch (err: any) {
    console.error('Subscription status error:', err);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
