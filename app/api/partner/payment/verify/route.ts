// ============================================================
// PARTNER PAYMENT VERIFY — /api/partner/payment/verify
//
// Called by PartnerCheckoutClient after Paystack popup success.
// Unlike the main /api/payment/verify, this route:
//   1. Looks up the PARTNER's Paystack secret (decrypted) to verify
//   2. Activates the member's subscription on their profile
//   3. Records a partner_transactions row with revenue split
//   4. Notifies both the member and the partner owner
//
// SECURITY: userId is taken from the authenticated session cookie.
// partner_id from the request body is used for context only —
// the caller cannot activate a different user's subscription.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { decryptSecret } from '@/lib/crypto';

const supabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helpers ───────────────────────────────────────────────

async function verifyWithPaystack(
  reference: string,
  secretKey: string
): Promise<{ verified: boolean; data: any }> {
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const json = await res.json();
    if (json.status && json.data?.status === 'success') {
      return { verified: true, data: json.data };
    }
    console.warn('[PartnerVerify] Paystack returned non-success:', json.message);
    return { verified: false, data: null };
  } catch (err) {
    console.error('[PartnerVerify] Paystack fetch failed:', err);
    return { verified: false, data: null };
  }
}

function calcSubscriptionEnd(billing: string, trialDays: number): Date {
  const end = new Date();
  if (billing === 'yearly') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setDate(end.getDate() + 30);
  }
  // Add trial days on top
  if (trialDays > 0) {
    end.setDate(end.getDate() + trialDays);
  }
  return end;
}

// ── Main handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate session — never trust body for userId ──
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    // ── 2. Parse body ─────────────────────────────────────────
    const body = await req.json();
    const { reference, plan, billing, partner_id } = body as {
      reference:  string;
      plan:       string;
      billing:    string;
      partner_id: string;
    };

    if (!reference)  return NextResponse.json({ error: 'Missing reference'  }, { status: 400 });
    if (!partner_id) return NextResponse.json({ error: 'Missing partner_id' }, { status: 400 });
    if (!plan)       return NextResponse.json({ error: 'Missing plan'       }, { status: 400 });

    // ── 3. Load partner ───────────────────────────────────────
    const { data: partner, error: partnerErr } = await supabase
      .from('partners')
      .select(
        'id, name, owner_id, status, revenue_share_percent, ' +
        'paystack_subaccount_code, paystack_secret_key_enc, subdomain, plan_overrides'
      )
      .eq('id', partner_id)
      .single();

    if (partnerErr || !partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }
    if (partner.status !== 'active') {
      return NextResponse.json({ error: 'Partner account not active' }, { status: 403 });
    }

    // ── 4. Verify membership in this partner ──────────────────
    // The caller must be an active (or invited) member of this partner
    const { data: membership } = await supabase
      .from('partner_members')
      .select('id, status')
      .eq('partner_id', partner_id)
      .eq('user_id', userId)
      .maybeSingle();

    // Also check by email in case user_id not yet linked
    const { data: authUserData } = await supabase.auth.admin.getUserById(userId);
    const userEmail = authUserData?.user?.email || '';

    const { data: membershipByEmail } = !membership
      ? await supabase
          .from('partner_members')
          .select('id, status')
          .eq('partner_id', partner_id)
          .eq('email', userEmail)
          .maybeSingle()
      : { data: null };

    const resolvedMembership = membership || membershipByEmail;

    if (!resolvedMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this partner platform' },
        { status: 403 }
      );
    }
    if (resolvedMembership.status === 'suspended' || resolvedMembership.status === 'removed') {
      return NextResponse.json(
        { error: 'Your membership has been suspended' },
        { status: 403 }
      );
    }

    // ── 5. Verify payment with Paystack ───────────────────────
    // Use partner's own key if set, fall back to Ascentor's key
    let paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';

    if (partner.paystack_secret_key_enc) {
      try {
        paystackSecret = decryptSecret(partner.paystack_secret_key_enc);
      } catch (decryptErr) {
        console.error('[PartnerVerify] Failed to decrypt partner secret key:', decryptErr);
        // Fall back to Ascentor's key
      }
    }

    let verified = false;
    let paystackData: any = null;

    if (paystackSecret) {
      const result = await verifyWithPaystack(reference, paystackSecret);
      verified    = result.verified;
      paystackData = result.data;

      if (!verified) {
        return NextResponse.json(
          { error: 'Payment verification failed. Please contact support if you were charged.' },
          { status: 400 }
        );
      }
    } else {
      // Dev / test mode — no Paystack keys configured
      console.warn('[PartnerVerify] No Paystack secret available — running in dev mode');
      verified     = true;
      paystackData = { reference, status: 'success', amount: 0, currency: 'NGN' };
    }

    // ── 6. Prevent double-activation (idempotency check) ─────
    const { data: existingTx } = await supabase
      .from('partner_transactions')
      .select('id')
      .eq('paystack_reference', reference)
      .maybeSingle();

    if (existingTx) {
      // Already processed — return success (idempotent)
      return NextResponse.json({ success: true, plan, already_processed: true });
    }

    // ── 7. Calculate subscription period ─────────────────────
    const trialDays = Number(partner.plan_overrides?.trial_days ?? 7);
    const subscriptionEnd = calcSubscriptionEnd(billing || 'monthly', trialDays);
    const now = new Date().toISOString();

    // ── 8. Activate subscription on profile ──────────────────
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        subscription_plan:   plan,
        subscription_status: trialDays > 0 ? 'trialing' : 'active',
        subscription_start:  now,
        subscription_end:    subscriptionEnd.toISOString(),
        payment_method:      paystackData?.channel || 'card',
        updated_at:          now,
      })
      .eq('id', userId);

    if (profileErr) {
      console.error('[PartnerVerify] Profile update failed:', profileErr);
      return NextResponse.json(
        { error: 'Payment verified but profile activation failed. Contact support.' },
        { status: 500 }
      );
    }

    // ── 9. Record revenue transaction with split ──────────────
    const amountNGN    = paystackData?.amount ? paystackData.amount / 100 : 0;
    const partnerShare = Math.round(amountNGN * (partner.revenue_share_percent / 100));
    const ascentorFee  = amountNGN - partnerShare;

    const { error: txErr } = await supabase.from('partner_transactions').insert({
      partner_id:         partner.id,
      user_id:            userId,
      amount_ngn:         amountNGN,
      partner_share_ngn:  partnerShare,
      ascentor_fee_ngn:   ascentorFee,
      revenue_share_pct:  partner.revenue_share_percent,
      plan,
      billing_cycle:      billing || 'monthly',
      paystack_reference: reference,
      status:             'completed',
      paid_at:            paystackData?.paid_at || now,
    });

    if (txErr) {
      // Non-fatal — subscription is already activated; log and continue
      console.error('[PartnerVerify] Transaction insert failed (non-fatal):', txErr);
    }

    // ── 10. Update partner_members with user_id if missing ────
    await supabase
      .from('partner_members')
      .update({ user_id: userId, status: 'active', joined_at: now })
      .eq('id', resolvedMembership.id);

    // ── 11. Notifications ─────────────────────────────────────
    await Promise.allSettled([
      supabase.from('notifications').insert({
        user_id: userId,
        type:    'success',
        title:   `Welcome to ${partner.name}! 🎉`,
        message: `Your ${plan} subscription is now active${trialDays > 0 ? ` with a ${trialDays}-day trial` : ''}.`,
        link:    `/p/${partner.subdomain}/dashboard`,
      }),
      supabase.from('notifications').insert({
        user_id: partner.owner_id,
        type:    'success',
        title:   'New subscription payment',
        message: `${userEmail} subscribed to the ${plan} plan. Your share: ₦${partnerShare.toLocaleString()}.`,
        link:    '/partner/revenue',
      }),
    ]);

    // ── 12. Audit log ─────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      user_id:     userId,
      action:      'partner_payment_verified',
      entity_type: 'partner',
      entity_id:   partner.id,
      details: {
        plan,
        billing,
        amount_ngn:        amountNGN,
        partner_share_ngn: partnerShare,
        reference,
        partner_name:      partner.name,
      },
    }).then(() => {}).catch(() => {}); // non-critical

    return NextResponse.json({
      success:          true,
      plan,
      subscription_end: subscriptionEnd.toISOString(),
    });

  } catch (err: any) {
    console.error('[PartnerVerify] Fatal:', err);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
