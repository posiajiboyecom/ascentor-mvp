// ============================================================
// app/api/partner/brand/route.ts
//
// FILE LOCATION: app/api/partner/brand/route.ts
//
// FIX (W-08):
//   The GET handler now returns `has_paystack_key: boolean` alongside
//   the partner record. The actual key is never returned to the client
//   (stays encrypted server-side), but the settings page can now show
//   a "✓ Paystack connected" badge when has_paystack_key is true.
//
//   Implementation: select `paystack_secret_key` in the query (not
//   returned to client), then set has_paystack_key = Boolean(key exists
//   and is non-empty), strip the key from the response object.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearPartnerCache } from '@/lib/getPartnerContext';
import { PartnerBrand } from '@/types/partner';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function validateBrand(brand: Partial<PartnerBrand>): string | null {
  if (!brand.platform_name?.trim()) return 'Platform name is required';
  if (brand.platform_name.length > 60) return 'Platform name too long (max 60 chars)';

  const colorFields = ['primary_color', 'accent_color', 'text_color', 'bg_color', 'card_color'] as const;
  for (const field of colorFields) {
    const val = brand[field];
    if (val && !HEX_PATTERN.test(val)) return `Invalid colour format for ${field}`;
  }
  // W-04: also validate border_color if provided
  if (brand.border_color && !HEX_PATTERN.test(brand.border_color)) {
    return 'Invalid colour format for border_color';
  }

  const allowedFonts = ['Cormorant Garamond', 'Playfair Display', 'Merriweather', 'Syne', 'Inter', 'DM Sans'];
  if (brand.font_heading && !allowedFonts.includes(brand.font_heading)) return 'Invalid heading font';
  if (brand.font_body    && !allowedFonts.includes(brand.font_body))    return 'Invalid body font';

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { partnerId, brand } = await req.json();
    if (!partnerId) return NextResponse.json({ error: 'Missing partnerId' }, { status: 400 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, owner_id, subdomain, custom_domain, status, plan_tier')
      .eq('id', partnerId)
      .single();

    if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    if (partner.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (partner.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });

    if (brand.hide_ascentor_branding && partner.plan_tier !== 'pro') {
      return NextResponse.json({
        error: 'Removing "Powered by Ascentor" branding requires the Partner Pro plan.',
        code:  'plan_upgrade_required',
      }, { status: 403 });
    }

    const validationError = validateBrand(brand);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const safeBrand: PartnerBrand = {
      logo_url:               brand.logo_url      || null,
      logo_dark_url:          brand.logo_dark_url  || null,
      favicon_url:            brand.favicon_url    || null,
      primary_color:          brand.primary_color  || '#E8A020',
      accent_color:           brand.accent_color   || '#C8851A',
      text_color:             brand.text_color     || '#D4CFC3',
      bg_color:               brand.bg_color       || '#0C0B08',
      card_color:             brand.card_color     || '#141310',
      border_color:           brand.border_color   || undefined,  // W-04
      font_heading:           brand.font_heading   || 'Cormorant Garamond',
      font_body:              brand.font_body      || 'Syne',
      hide_ascentor_branding: Boolean(brand.hide_ascentor_branding),
      platform_name:          brand.platform_name.trim(),
      tagline:                brand.tagline?.trim() || null,
    };

    const { error: updateError } = await supabase
      .from('partners')
      .update({ brand: safeBrand, updated_at: new Date().toISOString() })
      .eq('id', partnerId);

    if (updateError) {
      console.error('[Partner Brand] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to save brand' }, { status: 500 });
    }

    if (partner.subdomain)    await clearPartnerCache(`${partner.subdomain}.ascentorbi.com`);
    if (partner.custom_domain) await clearPartnerCache(partner.custom_domain);

    try {
      await supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      'partner_brand_updated',
        entity_type: 'partner',
        entity_id:   partnerId,
        details:     { platform_name: safeBrand.platform_name },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, brand: safeBrand });

  } catch (err: any) {
    console.error('[Partner Brand API]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // FIX W-08: select paystack_secret_key so we can compute has_paystack_key
    const { data: partner } = await supabase
      .from('partners')
      .select('id, brand, subdomain, custom_domain, status, revenue_share_percent, features, plan_overrides, plan_tier, paystack_secret_key')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account found' }, { status: 404 });

    // FIX W-08: compute boolean — never send the actual key to the client
    const has_paystack_key = Boolean(
      partner.paystack_secret_key && (partner.paystack_secret_key as string).length > 0
    );

    // Strip the raw key before sending the response
    const { paystack_secret_key: _stripped, ...safePartner } = partner as any;

    return NextResponse.json({ partner: { ...safePartner, has_paystack_key } });

  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
