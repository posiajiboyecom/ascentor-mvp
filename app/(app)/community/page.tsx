// app/(app)/community/page.tsx
// The Circle — server component. Fetches channels + this week's ritual data
// (prompt, your circle rosters + who's checked in, your streak), then hands
// off to CommunityClient which lands on the "This Week" home.
//
// Schema notes (confirmed via information_schema against the live DB —
// do not "fix" these back to guessed names):
//   community_categories: id, name, icon, color, default_type, sort_order
//   community_channels:   slug (PK, no `id` column), name, description,
//                          channel_type, category_id, is_pinned?,
//                          is_locked?, sort_order, emoji?
//   community_messages:   id, user_id, channel (text = slug), content,
//                          flagged, deleted, created_at, likes (text[]),
//                          reply_to_id, pinned, dimension_tag, reply_count,
//                          is_checkin, checkin_week   ← added by
//                          database/migrations/20260702_community_ritual.sql
//   circle_members:       channel_slug, user_id, joined_at   ← new
//   community_prompts:    id, week_start, question            ← new
//   channel_read_positions: user_id, channel_slug, last_read_at ← new
//                            (database/migrations/20260702_community_read_positions.sql)
//
// NOTE: community_channels has NO is_active column — a previous bug filtered
// on .eq('is_active', true) and silently returned zero channels. Do not
// reintroduce that filter. The ritual queries below degrade to empty (not a
// crash) if the migration hasn't been run yet.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { effectivePlan } from '@/lib/planTier';
import { mondayOf, streakFromWeeks } from '@/lib/week';
import CommunityClient from './CommunityClient';
import type { WeekData, CircleSummary, Message } from '@/components/community/types';

const CHECKIN_COLUMNS =
  'id, user_id, channel, content, reply_to_id, created_at, likes, pinned, dimension_tag, reply_count, is_checkin, checkin_week';

const FALLBACK_PROMPT = 'Where did you show up when it was hard?';

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const monday = mondayOf();

  // ── First round: everything that doesn't depend on my circle list ──
  const [
    categoriesRes,
    channelsRes,
    profileRes,
    promptRes,
    myMembershipRes,
    myCheckinWeeksRes,
    myCheckinRes,
    communityCountRes,
    readPositionsRes,
  ] = await Promise.all([
    supabase.from('community_categories').select('*').order('sort_order'),
    supabase.from('community_channels').select('*').order('sort_order'),
    supabase
      .from('profiles')
      .select('full_name, subscription_plan, subscription_status, subscription_end, id, role')
      .eq('id', user.id)
      .single(),
    supabase.from('community_prompts').select('question').eq('week_start', monday).maybeSingle(),
    supabase.from('circle_members').select('channel_slug').eq('user_id', user.id).order('joined_at', { ascending: true }),
    supabase.from('community_messages').select('checkin_week').eq('user_id', user.id).eq('is_checkin', true),
    supabase
      .from('community_messages')
      .select(CHECKIN_COLUMNS)
      .eq('user_id', user.id)
      .eq('is_checkin', true)
      .eq('checkin_week', monday)
      .maybeSingle(),
    supabase
      .from('community_messages')
      .select('user_id', { count: 'exact', head: true })
      .eq('is_checkin', true)
      .eq('checkin_week', monday),
    // Fetch the user's last-read timestamps for all channels they've visited.
    // channel_read_positions may not exist yet if the migration hasn't been run;
    // the error is caught below and degrades to zero unread counts (safe).
    supabase
      .from('channel_read_positions')
      .select('channel_slug, last_read_at')
      .eq('user_id', user.id),
  ]);

  if (categoriesRes.error) console.error('[community/page] categories:', categoriesRes.error.message);
  if (channelsRes.error) console.error('[community/page] channels:', channelsRes.error.message);
  if (readPositionsRes.error) {
    // Non-fatal: table may not exist yet. Unread counts will be empty.
    console.warn('[community/page] read_positions (migration pending?):', readPositionsRes.error.message);
  }

  const channels = channelsRes.data ?? [];
  const plan = effectivePlan(profileRes.data);
  const userName = profileRes.data?.full_name?.trim() || 'Member';

  // ── Real moderator check from profiles.role ─────────────────────────────
  // 'admin' and 'moderator' can pin, lock, and delete any message.
  // Falls back to false if the column doesn't exist yet on a dev DB.
  const profileRole = (profileRes.data as { role?: string | null } | null)?.role ?? null;
  const isModerator = profileRole === 'admin' || profileRole === 'moderator';

  const mySlugs = (myMembershipRes.data ?? []).map((r: { channel_slug: string }) => r.channel_slug);

  // ── Second round: my circles' rosters + who checked in this week ──
  let circles: CircleSummary[] = [];
  if (mySlugs.length > 0) {
    const [membersRes, weekCheckinsRes] = await Promise.all([
      supabase.from('circle_members').select('channel_slug, user_id').in('channel_slug', mySlugs),
      supabase
        .from('community_messages')
        .select('id, user_id, channel')
        .eq('is_checkin', true)
        .eq('checkin_week', monday)
        .in('channel', mySlugs),
    ]);

    const memberRows = membersRes.data ?? [];
    const memberIds = [...new Set(memberRows.map((m: { user_id: string }) => m.user_id))];

    const namesRes = memberIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', memberIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameMap = new Map((namesRes.data ?? []).map((p) => [p.id, p.full_name?.trim() || 'Member']));

    // channel -> (user -> checkin message id)
    const checkinMap = new Map<string, Map<string, string>>();
    for (const c of weekCheckinsRes.data ?? []) {
      const row = c as { id: string; user_id: string; channel: string };
      if (!checkinMap.has(row.channel)) checkinMap.set(row.channel, new Map());
      checkinMap.get(row.channel)!.set(row.user_id, row.id);
    }

    circles = mySlugs.map((slug) => {
      const channel = channels.find((c: { slug: string }) => c.slug === slug);
      const checkins = checkinMap.get(slug) ?? new Map();
      const members = memberRows
        .filter((m: { channel_slug: string }) => m.channel_slug === slug)
        .map((m: { user_id: string }) => ({
          id: m.user_id,
          name: nameMap.get(m.user_id) ?? 'Member',
          checkedIn: checkins.has(m.user_id),
          checkinId: checkins.get(m.user_id) ?? null,
        }));
      return {
        slug,
        name: (channel as { name?: string } | undefined)?.name ?? slug,
        members,
        checkedInCount: members.filter((m) => m.checkedIn).length,
      };
    });
  }

  const streakWeeks = streakFromWeeks(
    (myCheckinWeeksRes.data ?? [])
      .map((r: { checkin_week: string | null }) => r.checkin_week)
      .filter((w): w is string => !!w)
  );

  const joinableCircles = channels
    .filter((c: { channel_type: string; slug: string }) => c.channel_type === 'circle' && !mySlugs.includes(c.slug))
    .map((c: { slug: string; name: string; description: string | null }) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
    }));

  // ── Unread counts ────────────────────────────────────────────────────────
  // For each channel the user has visited, fetch the number of messages posted
  // after their last_read_at. Channels never visited get 0 (no row in
  // channel_read_positions yet, so nothing to subtract).
  //
  // We batch this as one query per channel using Promise.all so it runs in
  // parallel. The total number of channels is typically small (<50), so the
  // N parallel count queries are cheaper than a single self-join on large
  // message tables. If perf becomes an issue, this is easily replaced with a
  // single SQL function or a Supabase Edge Function.
  let unreadCounts: Record<string, number> = {};

  const readPositions = readPositionsRes.data ?? [];
  if (readPositions.length > 0) {
    const countResults = await Promise.all(
      readPositions.map(async (pos: { channel_slug: string; last_read_at: string }) => {
        const { count } = await supabase
          .from('community_messages')
          .select('id', { count: 'exact', head: true })
          .eq('channel', pos.channel_slug)
          .eq('deleted', false)
          .gt('created_at', pos.last_read_at);
        return { slug: pos.channel_slug, count: count ?? 0 };
      })
    );
    for (const { slug, count } of countResults) {
      if (count > 0) unreadCounts[slug] = count;
    }
  }

  const weekData: WeekData = {
    mondayISO: monday,
    prompt: promptRes.data?.question ?? FALLBACK_PROMPT,
    myCheckin: (myCheckinRes.data as Message | null) ?? null,
    streakWeeks,
    circles,
    communityCheckins: communityCountRes.count ?? 0,
    joinableCircles,
  };

  return (
    <CommunityClient
      categories={categoriesRes.data ?? []}
      channels={channels}
      userPlan={plan}
      userId={user.id}
      userName={userName}
      weekData={weekData}
      isModerator={isModerator}
      initialUnreadCounts={unreadCounts}
    />
  );
}
