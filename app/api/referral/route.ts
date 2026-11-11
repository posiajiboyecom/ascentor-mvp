import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const parsed = await parseJson(request, memberSchemas.referralRedeem);
    if (!parsed.ok) return parsed.response;
    const code = parsed.data.referralCode;

    // 1. Find referrer by code
    const { data: referrer, error: lookupError } = // Reading ANOTHER member's profile (the referrer) is a server-side lookup: members cannot read
    // each other's profiles directly.
    await supabaseAdmin
      .from('profiles')
      .select('id, full_name, referral_code')
      .eq('referral_code', code)
      .single();

    if (lookupError || !referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // 2. Can't refer yourself
    if (referrer.id === user.id) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    // 3. Check if user was already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Referral already applied to your account' }, { status: 400 });
    }

    // 4. Create referral record
    const { error: insertError } = await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      referral_code: code,
      status: 'signed_up',
    });

    if (insertError) {
      console.error('Referral insert error:', insertError);
      return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });
    }

    // 5. Mark referred_by on the new user's profile
    await supabase
      .from('profiles')
      .update({ referred_by: code })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      referrerName: referrer.full_name?.split(' ')[0] || 'Someone',
      message: 'Referral applied. When you join a plan, your friend earns credit.',
    });

  } catch (error: any) {
    console.error('Referral API error:', error);
    console.error('[referral]', error);
    return NextResponse.json({ error: 'Referral operation failed' }, { status: 500 });
  }
}

// GET - fetch user's referral stats
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user's referral code + stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, referral_count, referred_by')
      .eq('id', user.id)
      .single();

    // Get list of people they referred
    const { data: referrals } = await supabase
      .from('referrals')
      .select(`
        id,
        status,
        created_at,
        rewarded_at,
        referred_id
      `)
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    // Get names of referred users
    const referralDetails = [];
    if (referrals && referrals.length > 0) {
      const referredIds = referrals.map((r: any) => r.referred_id);
      const { data: referredProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, created_at')
        .in('id', referredIds);

      for (const ref of referrals) {
        const profile = referredProfiles?.find((p: any) => p.id === ref.referred_id);
        referralDetails.push({
          id: ref.id,
          name: profile?.full_name || 'Unknown',
          status: ref.status,
          date: ref.created_at,
          rewarded: ref.rewarded_at,
        });
      }
    }

    return NextResponse.json({
      referralCode: profile?.referral_code || null,
      referralCount: profile?.referral_count || 0,
      referredBy: profile?.referred_by || null,
      referrals: referralDetails,
    });

  } catch (error: any) {
    console.error('Referral GET error:', error);
    console.error('[referral]', error);
    return NextResponse.json({ error: 'Referral operation failed' }, { status: 500 });
  }
}
