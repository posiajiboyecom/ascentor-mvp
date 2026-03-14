// app/api/partner/config/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET   /api/partner/config → returns current partner's config
// PATCH /api/partner/config → updates safe partner config fields
//
// BUGS FIXED:
//   - Was querying the dead `tenants` table (always 404). Migrated to `partners`.
//   - PATCH had no ownership check — any authenticated user could patch any partner
//     if they guessed the fields. Fixed: query by owner_id before updating.
//   - Updated ALLOWED_FIELDS to match the `partners` table schema (brand JSONB,
//     not flat columns like accent_color / surface_color that don't exist).
//
// NOTE: Brand styling (logo, colours, fonts) should go through /api/partner/brand.
//       This route handles top-level partner metadata: name, subdomain, plan_overrides.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { clearPartnerCache } from '@/lib/getPartnerContext';

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── FIX: query partners table, not the dead tenants table ──
  const { data: partner, error } = await supabaseService
    .from('partners')
    .select('id, name, slug, subdomain, custom_domain, status, revenue_share_percent, brand, features, plan_overrides, created_at, updated_at, onboarded_at')
    .eq('owner_id', user.id)
    .single();

  if (error || !partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }

  return NextResponse.json(partner);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // ── FIX: ownership check — fetch partner first, verify owner ──
  // Previously this was missing: any authenticated user could attempt updates.
  const { data: partner } = await supabaseService
    .from('partners')
    .select('id, owner_id, subdomain, status')
    .eq('owner_id', user.id)
    .single();

  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
  }
  if (partner.status === 'suspended') {
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
  }

  const body = await req.json();

  // Only top-level scalar fields are allowed here.
  // Brand styling → /api/partner/brand
  // AI persona    → /api/partner/settings (ai_persona_prompt)
  // Domain        → /api/partner/domain
  const ALLOWED_FIELDS = ['name', 'plan_overrides'] as const;

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // Subdomain changes need uniqueness check + cache bust — delegate to /api/partner/settings
  if ('subdomain' in body) {
    return NextResponse.json(
      { error: 'Subdomain changes must go through /api/partner/settings' },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseService
    .from('partners')
    .update(updates)
    .eq('id', partner.id)       // ── FIX: update by id (already ownership-verified above) ──
    .select()
    .single();

  if (error) {
    console.error('[partner/config PATCH]', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  // Bust cache so getPartnerContext reflects the change immediately
  await clearPartnerCache(partner.subdomain);

  return NextResponse.json(data);
}
