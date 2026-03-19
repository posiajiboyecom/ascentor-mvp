import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addOrUpdateSubscriber, ML_GROUPS } from '@/lib/mailerlite';

// ─────────────────────────────────────────────────────────────
// POST /api/checkout-pending
//
// Called when a user completes onboarding steps 1+2 and lands
// on checkout — but before they pay.
//
// Purpose (Fix #5): identify unpaid users who stopped at
// checkout and add them to a MailerLite nurture segment so
// they receive targeted conversion emails.
//
// This is intentionally lightweight — it never blocks the user.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, name, userId } = await req.json();
    if (!email) return NextResponse.json({ ok: true }); // silent, non-blocking

    const emailClean = email.trim().toLowerCase();
    const firstName = (name || emailClean.split('@')[0]).split(' ')[0];

    // 1. Add to MailerLite — App Users + Free Users groups
    //    Custom field checkout_pending = true so you can segment in ML
    try {
      await addOrUpdateSubscriber({
        email: emailClean,
        firstName,
        groups: [ML_GROUPS.APP_USERS, ML_GROUPS.FREE_USERS],
        fields: {
          checkout_pending: 'true',
          checkout_reached_at: new Date().toISOString().split('T')[0],
          source: 'onboarding_checkout',
        },
      });
    } catch (mlErr: any) {
      console.error('[checkout-pending] ML error (non-fatal):', mlErr.message);
    }

    // 2. Record in Supabase for admin visibility
    //    Uses profiles table — set a checkout_pending flag
    if (userId) {
      try {
        await supabase.from('profiles')
          .update({
            updated_at: new Date().toISOString(),
            // We use a notification so we don't need a new column
          })
          .eq('id', userId);

        // Insert a notification visible in admin
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'system',
          title: 'Reached checkout — payment pending',
          message: 'User completed onboarding and reached checkout but has not paid yet.',
          link: '/checkout',
        });
      } catch (dbErr: any) {
        console.error('[checkout-pending] DB error (non-fatal):', dbErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Always return 200 — this must never block the user flow
    console.error('[checkout-pending] error:', err.message);
    return NextResponse.json({ ok: true });
  }
}
