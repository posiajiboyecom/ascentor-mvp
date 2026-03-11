// ============================================================
// ADMIN PARTNERS API — /api/admin/partners
//
// GET   — list all partner applications with stats
// PATCH — approve | suspend | reject | update revenue_share
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return data?.role === 'admin' ? user.id : null;
}

// ── GET ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const adminId = await isAdmin(req.headers.get('authorization'));
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';   // pending | active | suspended | rejected
  const search = searchParams.get('search') || '';
  const page   = parseInt(searchParams.get('page') || '0');
  const limit  = 50;

  let query = supabase
    .from('partners')
    .select(`
      id, name, slug, subdomain, custom_domain, status,
      revenue_share_percent, created_at, updated_at,
      owner_id,
      features, plan_overrides,
      profiles!partners_owner_id_fkey (
        full_name, email, avatar_url, subscription_plan
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,subdomain.ilike.%${search}%`);

  const { data: partners, count, error } = await query;
  if (error) {
    console.error('[Admin Partners GET]', error);
    return NextResponse.json({ error: 'Failed to load partners' }, { status: 500 });
  }

  // Fetch member counts for each partner in one query
  const partnerIds = (partners || []).map((p: any) => p.id);
  const { data: memberCounts } = await supabase
    .from('partner_members')
    .select('partner_id, status')
    .in('partner_id', partnerIds);

  const countMap = (memberCounts || []).reduce((acc: Record<string, Record<string, number>>, m: any) => {
    if (!acc[m.partner_id]) acc[m.partner_id] = {};
    acc[m.partner_id][m.status] = (acc[m.partner_id][m.status] || 0) + 1;
    return acc;
  }, {});

  // Fetch revenue totals per partner
  const { data: revenueTotals } = await supabase
    .from('partner_transactions')
    .select('partner_id, partner_share_ngn')
    .in('partner_id', partnerIds)
    .eq('status', 'completed');

  const revenueMap = (revenueTotals || []).reduce((acc: Record<string, number>, t: any) => {
    acc[t.partner_id] = (acc[t.partner_id] || 0) + (t.partner_share_ngn || 0);
    return acc;
  }, {});

  const enriched = (partners || []).map((p: any) => ({
    ...p,
    member_counts: countMap[p.id] || {},
    total_revenue_ngn: revenueMap[p.id] || 0,
  }));

  // Status breakdown for tabs
  const { data: allStatuses } = await supabase
    .from('partners')
    .select('status');

  const breakdown = (allStatuses || []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    partners: enriched,
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
    breakdown,
  });
}

// ── PATCH ─────────────────────────────────────────────────
// Body: { partnerId, action: 'approve'|'suspend'|'reject', revenue_share?: number }
export async function PATCH(req: NextRequest) {
  const adminId = await isAdmin(req.headers.get('authorization'));
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { partnerId, action, revenue_share } = await req.json();
  if (!partnerId || !action) {
    return NextResponse.json({ error: 'partnerId and action required' }, { status: 400 });
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('id, name, status, subdomain, owner_id, revenue_share_percent')
    .eq('id', partnerId)
    .single();

  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 });

  const STATUS_MAP: Record<string, string> = {
    approve:  'active',
    suspend:  'suspended',
    reject:   'rejected',
    reinstate: 'active',
  };

  if (action === 'update_revenue_share') {
    if (typeof revenue_share !== 'number' || revenue_share < 0 || revenue_share > 100) {
      return NextResponse.json({ error: 'revenue_share must be 0–100' }, { status: 400 });
    }
    await supabase
      .from('partners')
      .update({ revenue_share_percent: revenue_share, updated_at: new Date().toISOString() })
      .eq('id', partnerId);

    await logAudit(adminId, 'partner_revenue_share_updated', partnerId, {
      partner_name: partner.name,
      old_share: partner.revenue_share_percent,
      new_share: revenue_share,
    });

    return NextResponse.json({ success: true });
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  const update: Record<string, any> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };

  // Set revenue share on approval if provided
  if (action === 'approve' && typeof revenue_share === 'number') {
    update.revenue_share_percent = revenue_share;
  }

  await supabase.from('partners').update(update).eq('id', partnerId);

  // Notify partner owner
  try {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', partner.owner_id)
      .single();

    if (ownerProfile?.email) {
      const messages: Record<string, { subject: string; body: string }> = {
        approve: {
          subject: `Your partner application is approved — ${partner.name}`,
          body: `
            <div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #0C0B08; color: #D4CFC3; border-radius: 16px;">
              <h2 style="color: #E8A020; margin-bottom: 16px;">🎉 You're approved!</h2>
              <p style="color: #9C9890; line-height: 1.7; margin-bottom: 20px;">
                Your partner platform <strong style="color: #D4CFC3;">${partner.name}</strong> is now live at
                <a href="https://${partner.subdomain}.ascentorbi.com" style="color: #E8A020;">${partner.subdomain}.ascentorbi.com</a>.
              </p>
              <p style="color: #9C9890; font-size: 13px;">Head to your partner dashboard to customise your brand and invite members.</p>
              <a href="https://ascentorbi.com/partner/brand" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #E8A020; color: #000; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 13px;">
                Go to Partner Dashboard →
              </a>
            </div>
          `,
        },
        suspend: {
          subject: `Your partner account has been suspended — ${partner.name}`,
          body: `<div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;"><p>Your partner account <strong>${partner.name}</strong> has been suspended. Contact support for more information.</p></div>`,
        },
        reject: {
          subject: `Partner application update — ${partner.name}`,
          body: `<div style="font-family: sans-serif; max-width: 480px; margin: auto; padding: 32px;"><p>Unfortunately your application for <strong>${partner.name}</strong> was not approved at this time. You can reapply after 30 days.</p></div>`,
        },
      };

      const msg = messages[action];
      if (msg) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Ascentor Partners <noreply@ascentorbi.com>',
            to:   ownerProfile.email,
            subject: msg.subject,
            html: msg.body,
          }),
        });
      }
    }
  } catch (emailErr) {
    console.warn('[Admin Partners] Notification email failed (non-fatal):', emailErr);
  }

  await logAudit(adminId, `partner_${action}`, partnerId, {
    partner_name: partner.name,
    subdomain:    partner.subdomain,
    from_status:  partner.status,
    to_status:    newStatus,
  });

  return NextResponse.json({ success: true, newStatus });
}

async function logAudit(adminId: string, action: string, entityId: string, details: object) {
  await supabase.from('audit_logs').insert({
    user_id:     adminId,
    action,
    entity_type: 'partner',
    entity_id:   entityId,
    details,
  }).catch(() => {});
}
