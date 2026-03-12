// ============================================================
// FILE LOCATION: app/api/partner/settings/route.ts
//
// BUG FIXED:
//   BUG-01 — This file was MISSING from the codebase. The zip
//             had the revenue/route.ts content at this path.
//             The settings page (app/partner/settings/page.tsx)
//             and revenue page (app/partner/revenue/page.tsx)
//             both POST to /api/partner/settings to save:
//               - Paystack secret key (encrypted via lib/crypto)
//               - Paystack subaccount code
//               - Feature toggles (ai_coach, community, etc.)
//             Without this file, saving any of those settings
//             returned a 404 and the partner was left with no
//             way to connect their Paystack account.
//
// HANDLERS:
//   GET  — return current settings (features, subaccount, key status)
//   POST — save Paystack key (encrypt it), subaccount, features
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { encryptSecret, isEncrypted } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET: current settings ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, status, features, paystack_subaccount_code, paystack_secret_key_enc, revenue_share_percent, plan_tier')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    // Never send the encrypted key to the client — only a boolean flag
    const has_paystack_key = Boolean(
      (partner as any).paystack_secret_key_enc &&
      ((partner as any).paystack_secret_key_enc as string).length > 0
    );

    const { paystack_secret_key_enc: _stripped, ...safePartner } = partner as any;

    return NextResponse.json({ partner: { ...safePartner, has_paystack_key } });

  } catch (err: any) {
    console.error('[Partner Settings GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: save settings ───────────────────────────────────
// Body (all fields optional — only provided fields are updated):
//   paystack_secret_key:      string  — plaintext key; will be encrypted before storage
//   paystack_subaccount_code: string  — Paystack split subaccount code
//   features: {
//     ai_coach:  boolean
//     community: boolean
//     experts:   boolean
//     courses:   boolean
//     referrals: boolean
//   }
export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, owner_id, status, features')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });
    if (partner.status === 'suspended') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    const body = await req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    // ── Paystack secret key ───────────────────────────────
    if (typeof body.paystack_secret_key === 'string' && body.paystack_secret_key.trim()) {
      const rawKey = body.paystack_secret_key.trim();

      // Basic format check — Paystack live keys start sk_live_, test keys sk_test_
      if (!rawKey.startsWith('sk_live_') && !rawKey.startsWith('sk_test_')) {
        return NextResponse.json({
          error: 'Invalid Paystack secret key format. Keys must start with sk_live_ or sk_test_',
        }, { status: 400 });
      }

      // Encrypt before storing — idempotent if already encrypted (shouldn't happen here)
      update.paystack_secret_key_enc = isEncrypted(rawKey) ? rawKey : encryptSecret(rawKey);
    }

    // ── Paystack subaccount code ──────────────────────────
    if (typeof body.paystack_subaccount_code === 'string') {
      const code = body.paystack_subaccount_code.trim();
      if (code && !code.startsWith('ACCT_')) {
        return NextResponse.json({
          error: 'Invalid subaccount code. Paystack subaccount codes start with ACCT_',
        }, { status: 400 });
      }
      update.paystack_subaccount_code = code || null;
    }

    // ── Feature toggles ───────────────────────────────────
    if (body.features && typeof body.features === 'object') {
      const existing = (partner.features || {}) as Record<string, boolean>;
      const allowed = ['ai_coach', 'community', 'experts', 'courses', 'referrals'];
      const merged: Record<string, boolean> = { ...existing };

      for (const key of allowed) {
        if (key in body.features) {
          merged[key] = Boolean(body.features[key]);
        }
      }
      update.features = merged;
    }

    if (Object.keys(update).length === 1) {
      // Only updated_at — nothing useful was sent
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from('partners')
      .update(update)
      .eq('id', partner.id);

    if (updateErr) {
      console.error('[Partner Settings POST]', updateErr);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    // Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      'partner_settings_updated',
        entity_type: 'partner',
        entity_id:   partner.id,
        details: {
          updated_fields: Object.keys(update).filter(k => k !== 'updated_at'),
          // Never log the key value even though it's encrypted
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[Partner Settings POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
