// app/api/partner/settings/route.ts
//
// PATCH /api/partner/settings — handles subdomain, custom_domain,
//   plan_overrides, and ai_persona_prompt changes on the partners table.
//   Calls clearPartnerCache when subdomain changes.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearPartnerCache } from '@/lib/getPartnerContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { partnerId, subdomain, custom_domain, plan_overrides, ai_persona_prompt } = body;

    // Look up partner by owner
    const { data: partner } = await supabase
      .from('partners')
      .select('id, owner_id, subdomain, status')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account found' }, { status: 404 });
    if (partner.status === 'suspended') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // Subdomain change
    if (subdomain !== undefined && subdomain !== partner.subdomain) {
      const sub = String(subdomain).toLowerCase().trim();
      if (!/^[a-z0-9-]{3,30}$/.test(sub)) {
        return NextResponse.json(
          { error: 'Subdomain must be 3–30 lowercase letters, numbers, or hyphens.' },
          { status: 400 }
        );
      }
      // Check uniqueness
      const { data: existing } = await supabase
        .from('partners')
        .select('id')
        .eq('subdomain', sub)
        .neq('id', partner.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'That subdomain is already taken.' }, { status: 409 });
      }
      updates.subdomain = sub;
      // Invalidate old subdomain cache
      await clearPartnerCache(partner.subdomain);
    }

    if (custom_domain !== undefined) {
      updates.custom_domain = custom_domain || null;
    }

    if (plan_overrides !== undefined) {
      // Merge with existing plan_overrides rather than replacing
      const { data: current } = await supabase
        .from('partners')
        .select('plan_overrides')
        .eq('id', partner.id)
        .single();
      updates.plan_overrides = { ...(current?.plan_overrides || {}), ...plan_overrides };
    }

    if (ai_persona_prompt !== undefined) {
      // ai_persona_prompt lives in ai_config — /api/partner/config reads from here, not brand
      const { data: current } = await supabase
        .from('partners')
        .select('ai_config')
        .eq('id', partner.id)
        .single();
      updates.ai_config = { ...(current?.ai_config || {}), ai_persona_prompt };
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('partners')
      .update(updates)
      .eq('id', partner.id)
      .select()
      .single();

    if (error) {
      console.error('Partner settings update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    // Invalidate cache for new subdomain too
    if (updates.subdomain) {
      await clearPartnerCache(updates.subdomain as string);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Partner settings PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
