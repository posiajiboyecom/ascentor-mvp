// app/api/partner/config/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/partner/config  → returns current partner's tenant config
// PATCH /api/partner/config → updates tenant config fields
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  return NextResponse.json(tenant);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Only allow updating specific safe fields (never allow updating owner_id, id etc.)
  const body = await req.json();
  const ALLOWED_FIELDS = [
    'name',
    'logo_url',
    'favicon_url',
    'accent_color',
    'accent_hover',
    'accent_text',
    'bg_color',
    'surface_color',
    'text_color',
    'text_muted',
    'ai_persona_prompt',
    'subdomain',           // FIX WL-10: was missing, silently rejected subdomain saves
    'paystack_plan_codes', // FIX WL-10: pricing page needs this
  ];

  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate subdomain format if being changed
  if (updates.subdomain !== undefined) {
    const sub = String(updates.subdomain);
    if (!/^[a-z0-9-]{3,30}$/.test(sub)) {
      return NextResponse.json(
        { error: 'Subdomain must be 3–30 lowercase alphanumeric characters or hyphens.' },
        { status: 400 }
      );
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('owner_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Tenant update error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json(data);
}
