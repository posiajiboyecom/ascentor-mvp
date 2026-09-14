// ============================================================
// FILE LOCATION: app/api/admin/partners/route.ts
//
// BUG FIXED:
//   BUG-09 — The 'approve' action did not set onboarded_at on
//             the partner record. The partner dashboard layout
//             and onboarding page both check onboarded_at to
//             decide whether to redirect to /partner/onboarding.
//             Because onboarded_at stayed null after approval,
//             every newly approved partner was permanently
//             redirected to the onboarding flow and could never
//             reach the dashboard even after completing it.
//
//             Fix: when action === 'approve', set onboarded_at
//             to the current timestamp in the same update call.
//             Partners who complete onboarding themselves will
//             have it set by the onboarding route — this only
//             applies to admin-side approvals.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { brandedEmailLayout, esc, p, goldButton } from '@/lib/emailTemplate';
import { sendEmail } from '@/lib/nodemailer';

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
  if ((data as any)?.role !== 'admin') return null;
  return user.id;
}

async function logAudit(
  adminId: string,
  action: string,
  partnerId: string,
  details: Record<string, any>
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id:     adminId,
      action,
      entity_type: 'partner',
      entity_id:   partnerId,
      details,
    });
  } catch { /* non-critical */ }
}

// ── GET: list all partners ────────────────────────────────
export async function GET(req: NextRequest) {
  const adminId = await isAdmin(req.headers.get('authorization'));
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const page   = parseInt(searchParams.get('page') || '0');
  const limit  = parseInt(searchParams.get('limit') || '20');

  let query = supabase
    .from('partners')
    .select(`
      id, name, slug, subdomain, custom_domain, status, plan_tier,
      revenue_share_percent, created_at, updated_at, onboarded_at,
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

  const partnerIds = (partners || []).map((p: any) => p.id);

  let memberCounts: Record<string, number> = {};
  if (partnerIds.length > 0) {
    const { data: memberData } = await supabase
      .from('partner_members')
      .select('partner_id')
      .in('partner_id', partnerIds)
      .neq('status', 'removed');

    (memberData || []).forEach((m: any) => {
      memberCounts[m.partner_id] = (memberCounts[m.partner_id] || 0) + 1;
    });
  }

  const enriched = (partners || []).map((p: any) => ({
    ...p,
    member_count: memberCounts[p.id] || 0,
  }));

  return NextResponse.json({
    partners: enriched,
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
  });
}

// ── PATCH ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const adminId = await isAdmin(req.headers.get('authorization'));
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { partnerId, action, revenue_share, plan_tier: requestedTier } = await req.json();
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
    approve:   'active',
    suspend:   'suspended',
    reject:    'rejected',
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
      old_share:    partner.revenue_share_percent,
      new_share:    revenue_share,
    });

    return NextResponse.json({ success: true });
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus) return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  const update: Record<string, any> = {
    status:     newStatus,
    updated_at: new Date().toISOString(),
  };

  if (action === 'approve' && typeof revenue_share === 'number') {
    update.revenue_share_percent = revenue_share;
  }

  // Set plan_tier on approval — default to 'starter' if not provided
  if (action === 'approve') {
    const tier = requestedTier && ['starter','growth','pro'].includes(requestedTier)
      ? requestedTier : 'starter';
    update.plan_tier = tier;
    if (typeof revenue_share !== 'number') {
      update.revenue_share_percent = tier === 'pro' ? 80 : tier === 'growth' ? 70 : 65;
    }
  }

  // FIX BUG-09: set onboarded_at when approving so partners don't get
  // stuck in the onboarding redirect loop after approval.
  if (action === 'approve' && !partner.status.includes('active')) {
    update.onboarded_at = new Date().toISOString();
  }

  await supabase.from('partners').update(update).eq('id', partnerId);

  // Create initial subscription row on approval
  if (action === 'approve') {
    const tier      = update.plan_tier || 'starter';
    const amountMap: Record<string, number> = { starter: 10000, growth: 30000, pro: 70000 };
    void Promise.resolve(
      supabase.from('partner_subscriptions').insert({
        partner_id:           partnerId,
        plan_tier:            tier,
        billing_cycle:        'monthly',
        amount_ngn:           amountMap[tier] ?? 10000,
        status:               'active',
        current_period_start: new Date().toISOString(),
        current_period_end:   new Date(Date.now() + 30 * 86400000).toISOString(),
      })
    ).catch(() => {});
  }

  // Notify partner owner
  try {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', partner.owner_id)
      .single();

    if (ownerProfile?.email) {
      const partnerName = esc(partner.name);
      const messages: Record<string, { subject: string; body: string }> = {
        approve: {
          subject: `Your partner application is approved — ${partner.name}`,
          body: brandedEmailLayout({
            preheader: `${partner.name} is now live.`,
            eyebrow: 'Partner Application',
            heading: 'You\'re approved.',
            recipient: ownerProfile.email,
            content:
              p(`Your partner platform <strong>${partnerName}</strong> is now live at <a href="https://${esc(partner.subdomain)}.ascentorbi.com" style="color:#C8A96E;text-decoration:none;">${esc(partner.subdomain)}.ascentorbi.com</a>.`) +
              p('Head to your partner dashboard to customise your brand and invite members.') +
              goldButton('Go to Partner Dashboard →', 'https://ascentorbi.com/partner/brand'),
          }),
        },
        suspend: {
          subject: `Your partner account has been suspended — ${partner.name}`,
          body: brandedEmailLayout({
            preheader: `Your partner account ${partner.name} has been suspended.`,
            eyebrow: 'Partner Account',
            heading: 'Account suspended.',
            recipient: ownerProfile.email,
            content:
              p(`Your partner account <strong>${partnerName}</strong> has been suspended. Contact support for more information.`),
          }),
        },
        reject: {
          subject: `Partner application update — ${partner.name}`,
          body: brandedEmailLayout({
            preheader: `An update on your partner application for ${partner.name}.`,
            eyebrow: 'Partner Application',
            heading: 'Application update.',
            recipient: ownerProfile.email,
            content:
              p(`Unfortunately your application for <strong>${partnerName}</strong> was not approved at this time. You can reapply after 30 days.`),
          }),
        },
      };

      const msg = messages[action];
      if (msg) {
        await sendEmail({
          from:    'Ascentor Partners <noreply@ascentorbi.com>',
          to:      ownerProfile.email,
          subject: msg.subject,
          html:    msg.body,
        });
      }
    }
  } catch (emailErr) {
    console.warn('[Admin Partners PATCH] Email error (non-fatal):', emailErr);
  }

  await logAudit(adminId, `partner_${action}`, partnerId, {
    partner_name: partner.name,
    old_status:   partner.status,
    new_status:   newStatus,
  });

  return NextResponse.json({ success: true });
}
