// app/api/admin/community/route.ts
// Fetches cohorts + posts + replies using service role — bypasses RLS entirely

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses ALL RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify the requesting user is an admin (using their JWT)
async function getAdminUser(authHeader: string | null) {
  if (!authHeader) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;

  // Accept any non-member role as admin
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'member') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const user = await getAdminUser(authHeader);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cohortId = searchParams.get('cohortId');

    // ── Fetch cohorts list ─────────────────────────────────────────────────
    if (!cohortId) {
      const { data: cohorts, error } = await supabaseAdmin
        .from('cohorts')
        .select('id, name, member_count, icon')
        .order('member_count', { ascending: false });

      if (error) throw error;

      // Get live post counts per cohort
      const { data: postCounts } = await supabaseAdmin
        .from('cohort_posts')
        .select('cohort_id');

      const postCountMap: Record<string, number> = {};
      (postCounts || []).forEach((row: any) => {
        postCountMap[row.cohort_id] = (postCountMap[row.cohort_id] || 0) + 1;
      });

      // Total posts count for stats
      const totalPosts = postCounts?.length ?? 0;

      const enriched = (cohorts || []).map((c: any) => ({
        ...c,
        post_count: postCountMap[c.id] ?? 0,
      }));

      return NextResponse.json({ cohorts: enriched, totalPosts });
    }

    // ── Fetch posts for a specific cohort ──────────────────────────────────
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('cohort_posts')
      .select('id, user_id, content, upvotes, created_at')
      .eq('cohort_id', cohortId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (postsError) throw postsError;

    if (!posts?.length) {
      return NextResponse.json({ posts: [] });
    }

    // Fetch author profiles
    const userIds = [...new Set(posts.map((p: any) => p.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });

    // Fetch all replies for these posts
    const postIds = posts.map((p: any) => p.id);
    const { data: replies } = await supabaseAdmin
      .from('cohort_replies')
      .select('id, post_id, user_id, content, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    // Fetch reply author profiles
    const replyUserIds = [...new Set((replies || []).map((r: any) => r.user_id))];
    if (replyUserIds.length > 0) {
      const { data: replyProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .in('id', replyUserIds);
      (replyProfiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });
    }

    const enriched = posts.map((p: any) => {
      const postReplies = (replies || [])
        .filter((r: any) => r.post_id === p.id)
        .map((r: any) => ({ ...r, author: profileMap[r.user_id] || 'Unknown' }));
      return {
        ...p,
        author: profileMap[p.user_id] || 'Unknown',
        reply_count: postReplies.length,
        replies: postReplies,
      };
    });

    return NextResponse.json({ posts: enriched });

  } catch (err: any) {
    console.error('[admin/community]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
