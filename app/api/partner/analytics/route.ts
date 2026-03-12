// ============================================================
// FILE LOCATION: app/api/partner/analytics/route.ts
//
// BUG FIXED:
//   BUG-12 — The memberGrowth weekly chart calculated bucket
//             membership using m.created_at, but created_at on
//             partner_members is set at invitation time (when the
//             partner owner invites someone). For pre-existing
//             Ascentor users who were bulk-invited, created_at
//             equals the invitation date — correct.
//             But for users who accepted an invite after signup,
//             the auth callback sets joined_at to the acceptance
//             date while created_at stays at the invite date.
//             The chart should show when members JOINED (accepted
//             + activated), not when they were invited.
//
//             Fix: use joined_at when set, fall back to created_at
//             for invited-but-not-yet-joined rows (joined_at is null
//             until activation, so the fallback preserves the invite
//             date for pending rows which is acceptable).
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

    const { data: memberUserData } = await supabase
      .from('partner_members')
      .select('user_id, status, joined_at, created_at')
      .eq('partner_id', partnerId)
      .not('user_id', 'is', null);

    const memberUserIds = (memberUserData || [])
      .map((m: any) => m.user_id)
      .filter(Boolean) as string[];

    const [
      membersRes,
      enrollmentsRes,
      completionsRes,
      sessionsRes,
      revenueRes,
      recentMembersRes,
      courseStatsRes,
    ] = await Promise.all([
      supabase.from('partner_members')
        .select('status, joined_at, created_at')
        .eq('partner_id', partnerId),

      supabase.from('partner_course_enrollments')
        .select('course_id, enrolled_at, completed_at')
        .eq('partner_id', partnerId),

      supabase.from('partner_course_enrollments')
        .select('course_id, completed_at')
        .eq('partner_id', partnerId)
        .not('completed_at', 'is', null),

      memberUserIds.length > 0
        ? supabase.from('coaching_sessions')
            .select('user_id, created_at')
            .in('user_id', memberUserIds)
            .gte('created_at', ninetyDaysAgo)
        : Promise.resolve({ data: [], error: null }),

      supabase.from('partner_transactions')
        .select('partner_share_ngn, paid_at')
        .eq('partner_id', partnerId)
        .gte('paid_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString())
        .order('paid_at', { ascending: true }),

      supabase.from('partner_members')
        .select('joined_at, created_at')
        .eq('partner_id', partnerId)
        .gte('created_at', thirtyDaysAgo),

      supabase.from('partner_courses')
        .select('id, title, is_published')
        .eq('partner_id', partnerId)
        .eq('is_published', true),
    ]);

    const members      = membersRes.data || [];
    const enrollments  = enrollmentsRes.data || [];
    const completions  = completionsRes.data || [];
    const sessions     = sessionsRes.data || [];
    const transactions = revenueRes.data || [];
    const recentMembers = recentMembersRes.data || [];
    const courses      = courseStatsRes.data || [];

    // ── Member stats ───────────────────────────────────────
    const totalMembers  = members.length;
    const activeMembers = members.filter(m => m.status === 'active').length;
    const newThisMonth  = recentMembers.length;

    // ── Engagement ─────────────────────────────────────────
    const totalEnrollments = enrollments.length;
    const totalCompletions = completions.length;
    const completionRate   = totalEnrollments > 0
      ? Math.round((totalCompletions / totalEnrollments) * 100)
      : 0;
    const totalSessions = sessions.length;

    // ── Revenue trend (last 6 months) ─────────────────────
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

    // ── Per-course stats ───────────────────────────────────
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

    // ── Member growth trend (last 30 days, weekly buckets) ─
    // FIX BUG-12: use joined_at when available, fall back to created_at
    // joined_at is set when a member accepts their invite and activates.
    // created_at is set at invite time — wrong for the "joined" metric.
    const memberGrowth: { week: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 86400000);
      const weekEnd   = new Date(now.getTime() - i * 7 * 86400000);
      const label     = weekStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      const count     = members.filter(m => {
        // Use joined_at if set (member accepted invite), otherwise created_at (invite sent)
        const effectiveDate = new Date(m.joined_at || m.created_at);
        return effectiveDate >= weekStart && effectiveDate < weekEnd;
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
