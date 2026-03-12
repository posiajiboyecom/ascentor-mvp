// ============================================================
// app/api/partner/domain/route.ts
// POST: Add a custom domain to the Vercel project via API.
//       Also validates ownership and updates partner record.
// GET:  Check domain verification status on Vercel.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { clearPartnerCache } from '@/lib/getPartnerContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERCEL_TOKEN      = process.env.VERCEL_API_TOKEN!;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
const VERCEL_TEAM_ID    = process.env.VERCEL_TEAM_ID || ''; // optional

function vercelHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function vercelUrl(path: string) {
  const base = `https://api.vercel.com${path}`;
  return VERCEL_TEAM_ID ? `${base}?teamId=${VERCEL_TEAM_ID}` : base;
}

// ── POST: provision domain ────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { partnerId, domain } = await req.json();
    if (!partnerId || !domain) {
      return NextResponse.json({ error: 'partnerId and domain required' }, { status: 400 });
    }

    // 2. Validate domain format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // 3. Ownership check
    const { data: partner } = await supabase
      .from('partners')
      .select('id, owner_id, subdomain, custom_domain')
      .eq('id', partnerId)
      .single();

    if (!partner || partner.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Check domain not taken by another partner
    if (domain !== partner.custom_domain) {
      const { data: existing } = await supabase
        .from('partners')
        .select('id')
        .eq('custom_domain', domain)
        .neq('id', partnerId)
        .single();
      if (existing) return NextResponse.json({ error: 'Domain already in use' }, { status: 409 });
    }

    // 5. Remove old domain from Vercel if there was one
    if (partner.custom_domain && partner.custom_domain !== domain) {
      try {
        await fetch(vercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${partner.custom_domain}`), {
          method: 'DELETE',
          headers: vercelHeaders(),
        });
      } catch (e) {
        console.warn('[Domain] Could not remove old domain:', e);
      }
    }

    // 6. Add domain to Vercel project
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      // Env vars not configured — save to DB only, return instructions
      await saveDomainToDb(partnerId, domain, partner.subdomain, null);
      return NextResponse.json({
        success: true,
        status: 'pending_env',
        message: 'Domain saved. Configure VERCEL_API_TOKEN and VERCEL_PROJECT_ID to enable auto-provisioning.',
        cname_target: 'cname.vercel-dns.com',
      });
    }

    const vercelRes = await fetch(
      vercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains`),
      {
        method: 'POST',
        headers: vercelHeaders(),
        body: JSON.stringify({ name: domain }),
      }
    );

    const vercelData = await vercelRes.json();

    if (!vercelRes.ok) {
      // Domain already exists on project — that's fine, continue
      if (vercelData.error?.code !== 'domain_already_in_use') {
        console.error('[Domain] Vercel error:', vercelData);
        return NextResponse.json({
          error: vercelData.error?.message || 'Failed to add domain to Vercel',
        }, { status: 500 });
      }
    }

    // 7. Get domain configuration (CNAME target)
    const configRes = await fetch(
      vercelUrl(`/v6/domains/${domain}/config`),
      { headers: vercelHeaders() }
    );
    const configData = await configRes.json();
    const cnameTarget = configData?.cnames?.[0] || 'cname.vercel-dns.com';

    // 8. Save to DB
    await saveDomainToDb(partnerId, domain, partner.subdomain, vercelData);

    // 9. Bust partner context cache
    if (partner.subdomain) await clearPartnerCache(`${partner.subdomain}.ascentorbi.com`);
    if (partner.custom_domain) await clearPartnerCache(partner.custom_domain);
    await clearPartnerCache(domain);

    return NextResponse.json({
      success: true,
      status: vercelData.verified ? 'active' : 'pending_verification',
      domain,
      cname_target: cnameTarget,
      verified: vercelData.verified || false,
      message: vercelData.verified
        ? 'Domain is live!'
        : `Add a CNAME record pointing ${domain} → ${cnameTarget}, then wait up to 30 minutes for SSL.`,
    });

  } catch (err: any) {
    console.error('[Domain POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── GET: check verification status ───────────────────────
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, custom_domain')
      .eq('owner_id', user.id)
      .single();

    if (!partner?.custom_domain) {
      return NextResponse.json({ domain: null, verified: false });
    }

    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      return NextResponse.json({ domain: partner.custom_domain, verified: false, status: 'pending_env' });
    }

    const res = await fetch(
      vercelUrl(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${partner.custom_domain}`),
      { headers: vercelHeaders() }
    );
    const data = await res.json();

    return NextResponse.json({
      domain:   partner.custom_domain,
      verified: data.verified || false,
      status:   data.verified ? 'active' : 'pending_verification',
    });

  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── Helper ────────────────────────────────────────────────
async function saveDomainToDb(
  partnerId: string,
  domain: string,
  subdomain: string,
  vercelData: any,
) {
  await supabase.from('partners').update({
    custom_domain: domain,
    updated_at: new Date().toISOString(),
  }).eq('id', partnerId);

  try {
    await supabase.from('audit_logs').insert({
      user_id:     null,
      action:      'partner_domain_added',
      entity_type: 'partner',
      entity_id:   partnerId,
      details:     { domain, verified: vercelData?.verified || false },
    });
  } catch {}
}
