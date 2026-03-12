// ============================================================
// app/api/partner/settings/route.ts
// POST: Save partner platform settings
// (custom domain, paystack key, features, plan overrides)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearPartnerCache } from '@/lib/getPartnerContext';
import { encryptSecret, isEncrypted } from '@/lib/crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Basic domain validation
function isValidDomain(domain: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(domain);
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { partnerId, custom_domain, paystack_secret_key, features, plan_overrides } = body;

    if (!partnerId) return NextResponse.json({ error: 'Missing partnerId' }, { status: 400 });

    // Ownership check
    const { data: partner } = await supabase
      .from('partners')
      .select('id, owner_id, subdomain, custom_domain, status')
      .eq('id', partnerId)
      .single();

    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    if (partner.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Validate custom domain format
    if (custom_domain && !isValidDomain(custom_domain)) {
      return NextResponse.json({ error: 'Invalid domain format. Use: coaching.yourdomain.com' }, { status: 400 });
    }

    // Check domain not taken by another partner
    if (custom_domain && custom_domain !== partner.custom_domain) {
      const { data: existing } = await supabase
        .from('partners')
        .select('id')
        .eq('custom_domain', custom_domain)
        .neq('id', partnerId)
        .single();
      if (existing) return NextResponse.json({ error: 'That domain is already in use' }, { status: 400 });
    }

    // Load existing plan_overrides so we can MERGE (not replace)
    // This prevents the Pricing page saving monthly_ngn from being wiped
    // when Settings saves trial_days and plan names (and vice versa).
    const { data: existingData } = await supabase
      .from('partners')
      .select('plan_overrides')
      .eq('id', partnerId)
      .single();

    const existingOverrides: Record<string, any> = (existingData?.plan_overrides as Record<string, any>) || {};
    const incomingOverrides: Record<string, any> = (plan_overrides as Record<string, any>) || {};

    // Deep merge: incoming values win; existing values not in incoming are preserved
    const mergedOverrides = { ...existingOverrides, ...incomingOverrides };

    // Build update object
    const update: Record<string, any> = {
      custom_domain:  custom_domain || null,
      features:       features || {},
      plan_overrides: mergedOverrides,
      updated_at:     new Date().toISOString(),
    };

    // Only update paystack key if provided (don't wipe existing on empty)
    if (paystack_secret_key?.trim()) {
      const raw = paystack_secret_key.trim();
      // Encrypt before storage — never store plaintext Paystack keys
      // isEncrypted guard prevents double-encrypting if somehow re-submitted
      update.paystack_secret_key_enc = isEncrypted(raw) ? raw : encryptSecret(raw);
      // Wipe any legacy plaintext column value for safety
      update.paystack_secret_key = null;
    }

    const { error: updateError } = await supabase
      .from('partners')
      .update(update)
      .eq('id', partnerId);

    if (updateError) {
      console.error('[Partner Settings]', updateError);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    // Bust cache for both old and new custom domain
    if (partner.subdomain) await clearPartnerCache(`${partner.subdomain}.ascentorbi.com`);
    if (partner.custom_domain) await clearPartnerCache(partner.custom_domain);
    if (custom_domain) await clearPartnerCache(custom_domain);

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id:     user.id,
      action:      'partner_settings_updated',
      entity_type: 'partner',
      entity_id:   partnerId,
      details:     { custom_domain, features_updated: !!features },
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[Partner Settings API]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


// ── GET: Return current settings (never expose secret key) ──
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select(
        'id, subdomain, custom_domain, status, features, plan_overrides, revenue_share_percent, ' +
        'paystack_secret_key_enc' // only used for has_paystack_key check — never returned
      )
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account found' }, { status: 404 });

    // Return a boolean for key presence — never the key itself
    const { paystack_secret_key_enc, ...safePartner } = partner as any;

    return NextResponse.json({
      partner: {
        ...safePartner,
        has_paystack_key: Boolean(paystack_secret_key_enc),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
