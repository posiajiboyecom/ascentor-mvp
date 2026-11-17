import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as publicSchemas from '@/lib/validation/schemas/public';
import { limitPublic } from '@/lib/security';

// ─────────────────────────────────────────────────────────────
// POST /api/checkout-pending
//
// Called when a user completes onboarding steps 1+2 and lands
// on checkout - but before they pay.
//
// Purpose: record unpaid users who stopped at checkout, for admin.
//
// This is intentionally lightweight - it never blocks the user.
// ─────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const limited = await limitPublic(req, 'checkout-pending', 30, 600);
  if (limited) return limited;
  try {
    const parsed = await parseJson(req, publicSchemas.checkoutPending);
    if (!parsed.ok) return NextResponse.json({ ok: true }); // silent, non-blocking
    const { email, name, userId } = parsed.data;
    if (!email) return NextResponse.json({ ok: true });

    void name;

    // Record in Supabase for admin visibility
    //    Uses profiles table - set a checkout_pending flag
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
          title: 'Reached checkout, payment pending',
          message: 'User completed onboarding and reached checkout but has not paid yet.',
          link: '/checkout',
        });
      } catch (dbErr: any) {
        console.error('[checkout-pending] DB error (non-fatal):', dbErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Always return 200 - this must never block the user flow
    console.error('[checkout-pending] error:', err.message);
    return NextResponse.json({ ok: true });
  }
}
