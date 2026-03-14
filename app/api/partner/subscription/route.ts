// app/api/partner/subscription/route.ts
//
// GET  — current subscription details (plan, billing, period, usage summary)
// POST — request a plan change (admin-applied for now; Paystack automation later)

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getTierConfig, resolveTier, TIER_CONFIG, type PartnerTier } from '@/lib/partnerTier';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET: current subscription + usage ────────────────────
export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, plan_tier, active_member_count, status')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    // Active subscription row
    const { data: sub } = await supabase
      .from('partner_subscriptions')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Course count
    const { count: courseCount } = await supabase
      .from('partner_courses')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id);

    // Events this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: eventsThisMonth } = await supabase
      .from('partner_events')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', partner.id)
      .gte('created_at', monthStart.toISOString());

    const tier   = resolveTier(partner.plan_tier);
    const cfg    = getTierConfig(tier);
    const allCfg = TIER_CONFIG;

    return NextResponse.json({
      subscription: sub || null,
      plan: {
        tier,
        name:           cfg.name,
        monthlyNgn:     cfg.monthlyNgn,
        annualNgn:      cfg.annualNgn,
        revenueShare:   cfg.revenueSharePct,
        features:       cfg.features,
      },
      usage: {
        members: {
          current: partner.active_member_count,
          max:     cfg.maxMembers,
          pct:     cfg.maxMembers === -1
            ? 0
            : Math.round((partner.active_member_count / cfg.maxMembers) * 100),
        },
        courses: {
          current: courseCount ?? 0,
          max:     cfg.maxCourses,
          pct:     cfg.maxCourses <= 0 ? 0 : cfg.maxCourses === -1
            ? 0
            : Math.round(((courseCount ?? 0) / cfg.maxCourses) * 100),
        },
        eventsThisMonth: {
          current: eventsThisMonth ?? 0,
          max:     cfg.maxEventsPerMonth,
        },
      },
      // All tier configs so UI can render comparison table
      allTiers: {
        starter: {
          name: allCfg.starter.name, monthlyNgn: allCfg.starter.monthlyNgn,
          annualNgn: allCfg.starter.annualNgn, features: allCfg.starter.features,
          maxMembers: allCfg.starter.maxMembers, maxCourses: allCfg.starter.maxCourses,
          revenueShare: allCfg.starter.revenueSharePct,
        },
        growth: {
          name: allCfg.growth.name, monthlyNgn: allCfg.growth.monthlyNgn,
          annualNgn: allCfg.growth.annualNgn, features: allCfg.growth.features,
          maxMembers: allCfg.growth.maxMembers, maxCourses: allCfg.growth.maxCourses,
          revenueShare: allCfg.growth.revenueSharePct,
        },
        pro: {
          name: allCfg.pro.name, monthlyNgn: allCfg.pro.monthlyNgn,
          annualNgn: allCfg.pro.annualNgn, features: allCfg.pro.features,
          maxMembers: allCfg.pro.maxMembers, maxCourses: allCfg.pro.maxCourses,
          revenueShare: allCfg.pro.revenueSharePct,
        },
      },
    });
  } catch (err) {
    console.error('[Partner Subscription GET]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── POST: request plan change ─────────────────────────────
// Records upgrade/downgrade intent. Ascentor admin applies it.
// Paystack recurring billing can be automated later.
export async function POST(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id, plan_tier, name, status')
      .eq('owner_id', user.id)
      .single();

    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const body = await req.json();
    const { requested_tier, billing_cycle } = body;

    const validTiers: PartnerTier[] = ['starter', 'growth', 'pro'];
    if (!validTiers.includes(requested_tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const currentTier = resolveTier(partner.plan_tier);
    if (requested_tier === currentTier) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
    }

    const cfg = getTierConfig(requested_tier);
    const amount = billing_cycle === 'annual' ? cfg.annualNgn : cfg.monthlyNgn;

    // Log upgrade request as audit entry
    await Promise.resolve(
      supabase.from('audit_logs').insert({
        user_id:     user.id,
        action:      'partner_plan_change_requested',
        entity_type: 'partner',
        entity_id:   partner.id,
        details: {
          from_tier:      currentTier,
          to_tier:        requested_tier,
          billing_cycle:  billing_cycle || 'monthly',
          amount_ngn:     amount,
          partner_name:   partner.name,
        },
      })
    ).catch(() => {}); // non-critical

    return NextResponse.json({
      success: true,
      message: `Plan change to ${cfg.name} recorded. Our team will process this within 24 hours and contact you to complete payment.`,
      requested: {
        tier:          requested_tier,
        billing_cycle: billing_cycle || 'monthly',
        amount_ngn:    amount,
      },
    });
  } catch (err) {
    console.error('[Partner Subscription POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
