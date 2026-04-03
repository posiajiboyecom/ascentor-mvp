// ================================================================
// /api/pay/promo  — NEW PAYMENT SYSTEM v2
// ================================================================
// GET  → returns active auto-apply promo code (public, no auth)
// POST → validates a manually entered promo code (auth required)
//
// GET is used on checkout page load to pre-fill auto-promos.
// POST validates but does NOT activate — activation happens in
// /api/pay/start when the promo code is passed along.
// ================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient as createAuthClient } from '@/lib/supabase/server'

// ── GET: Fetch active auto-apply promo ───────────────────────────────────────
export async function GET() {
  try {
    const now = new Date().toISOString()

    const { data } = await supabaseAdmin
      .from('promo_codes')
      .select('code, discount, label, expires_at')
      .eq('active', true)
      .eq('auto_apply', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ promo: data ?? null })
  } catch (err) {
    console.error('[pay/promo GET]', err)
    return NextResponse.json({ promo: null })
  }
}

// ── POST: Validate a manually entered promo code ─────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth required — promo validation is tied to the user
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
    }

    const { code } = await req.json()
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code is required.' }, { status: 400 })
    }

    const upperCode = code.trim().toUpperCase()
    const now       = new Date()

    // Look up in DB
    const { data: promo, error: promoErr } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code, discount, label, expires_at, max_uses, current_uses, active')
      .eq('code', upperCode)
      .maybeSingle()

    if (promoErr || !promo) {
      return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 })
    }
    if (!promo.active) {
      return NextResponse.json({ error: 'This promo code is no longer active.' }, { status: 400 })
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
      return NextResponse.json({ error: 'This promo code has expired.' }, { status: 400 })
    }
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      return NextResponse.json({ error: 'This promo code has reached its usage limit.' }, { status: 400 })
    }

    // Valid — return discount info (do NOT activate or increment yet)
    return NextResponse.json({
      valid:    true,
      code:     promo.code,
      discount: promo.discount,         // e.g. 0.2 = 20% off
      label:    promo.label,            // e.g. "20% off — Welcome offer"
      isFree:   promo.discount >= 1.0,  // 100% off = free activation
    })

  } catch (err: any) {
    console.error('[pay/promo POST]', err)
    return NextResponse.json({ error: 'Could not validate promo code. Please try again.' }, { status: 500 })
  }
}
