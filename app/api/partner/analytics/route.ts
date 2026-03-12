// ============================================================
// app/api/partner/analytics/route.ts
// GET: Partner analytics — enrollments, completions,
//      coaching sessions, revenue trend, member activity
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    if (!partner) return NextResponse.json({ error: 'No partner account' }, { status: 404 });

    const partnerId = partner.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

    // First fetch member user_ids so we can filter coaching_sessions without a subquery
    const { data: memberUserData } = await supabase
      .from('partner_members')
      .select('user_id, status, joined_at, created_at')
      .eq('partner_id', partnerId)
      .not('user_id', 'is', null);

    const memberUserIds = (memberUserData || [])
      .map((m: any) => m.user_id)
      .filter(Boolean) as string[];

    // Run all other queries in parallel (no await inside the array)
    const [
      membersRes,
      enrollmentsRes,
      completionsRes,
      sessionsRes,
      revenueRes,
      recentMembersRes,
      courseStatsRes,
    ] = await Promise.all([
      // Total members breakdown
      supabase.from('partner_members')
        .select('status, joined_at, created_at')
        .eq('partner_id', partnerId),

      // Course enrollments
      supabase.from('partner_course_enrollments')
        .select('course_id, enrolled_at, completed_at')
        .eq('partner_id', partnerId),

      // Completions
      supabase.from('partner_course_enrollments')
        .select('course_id, completed_at')
        .eq('partner_id', partnerId)
        .not('completed_at', 'is', null),

      // Coaching sessions by partner members (last 90 days)
      // Use pre-fetched memberUserIds — avoids await inside Promise.all
      memberUserIds.length > 0
        ? supabase.from('coaching_sessions')
            .select('user_id, created_at')
            .in('user_id', memberUserIds)
            .gte('created_at', ninetyDaysAgo)
        : Promise.resolve({ data: [], error: null }),

      // Revenue last 6 months
      supabase.from('partner_transactions')
        .select('partner_share_ngn, paid_at')
        .eq('partner_id', partnerId)
        .gte('paid_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString())
        .order('paid_at', { ascending: true }),

      // New members last 30 days (for trend)
      supabase.from('partner_members')
        .select('joined_at, created_at')
        .eq('partner_id', partnerId)
        .gte('created_at', thirtyDaysAgo),

      // Per-course stats
      supabase.from('partner_courses')
        .select('id, title, is_published')
        .eq('partner_id', partnerId)
        .eq('is_published', true),
    ]);

    const members    = membersRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const completions = completionsRes.data || [];
    const sessions   = sessionsRes.data || [];
    const transactions = revenueRes.data || [];
    const recentMembers = recentMembersRes.data || [];
    const courses    = courseStatsRes.data || [];

    // ── Member stats ──────────────────────────────────────
    const totalMembers  = members.length;
    const activeMembers = members.filter(m => m.status === 'active').length;
    const newThisMonth  = recentMembers.length;

    // ── Engagement ────────────────────────────────────────
    const totalEnrollments  = enrollments.length;
    const totalCompletions  = completions.length;
    const completionRate    = totalEnrollments > 0
      ? Math.round((totalCompletions / totalEnrollments) * 100)
      : 0;
    const totalSessions     = sessions.length;

    // ── Revenue trend (last 6 months) ────────────────────
    const revenueTrend: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit' });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const amount = transactions
        .filter(t => {
          const paid = new Date(t.paid_at);
          return paid >= monthStart && paid <= monthEnd;
        })
        .reduce((sum, t) => sum + Number(t.partner_share_ngn), 0);
      revenueTrend.push({ month: monthLabel, amount });
    }

    // ── Per-course enrollment counts ─────────────────────
    const courseEnrollmentMap: Record<string, number> = {};
    const courseCompletionMap: Record<string, number> = {};
    enrollments.forEach(e => {
      courseEnrollmentMap[e.course_id] = (courseEnrollmentMap[e.course_id] || 0) + 1;
    });
    completions.forEach(e => {
      courseCompletionMap[e.course_id] = (courseCompletionMap[e.course_id] || 0) + 1;
    });

    const courseStats = courses.map(c => ({
      id:          c.id,
      title:       c.title,
      enrollments: courseEnrollmentMap[c.id] || 0,
      completions: courseCompletionMap[c.id] || 0,
      rate: courseEnrollmentMap[c.id]
        ? Math.round((courseCompletionMap[c.id] || 0) / courseEnrollmentMap[c.id] * 100)
        : 0,
    })).sort((a, b) => b.enrollments - a.enrollments);

    // ── Member growth trend (last 30 days, weekly buckets) ──
    const memberGrowth: { week: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 86400000);
      const weekEnd   = new Date(now.getTime() - i * 7 * 86400000);
      const label     = weekStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      const count     = members.filter(m => {
        const joined = new Date(m.created_at);
        return joined >= weekStart && joined < weekEnd;
      }).length;
      memberGrowth.push({ week: label, count });
    }

    return NextResponse.json({
      overview: {
        totalMembers,
        activeMembers,
        newThisMonth,
        totalEnrollments,
        totalCompletions,
        completionRate,
        totalSessions,
        totalRevenue: transactions.reduce((s, t) => s + Number(t.partner_share_ngn), 0),
      },
      revenueTrend,
      courseStats,
      memberGrowth,
    });

  } catch (err) {
    console.error('[Partner Analytics]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
