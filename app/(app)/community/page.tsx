// app/(app)/community/page.tsx
// The Circle — server component. Fetches categories, channels, and the
// user's profile, then hands off to CommunityClient for the interactive
// chat experience.
//
// Schema notes (confirmed via information_schema against the live DB —
// do not "fix" these back to guessed names):
//   community_categories: id, name, icon, color, default_type, sort_order
//   community_channels:   slug (PK, no `id` column), name, description,
//                          channel_type, category_id, is_pinned?,
//                          is_locked?, sort_order, emoji?
//   community_messages:   id, user_id, channel (text = slug), content,
//                          flagged, deleted, created_at, likes (text[]),
//                          reply_to_id, pinned, dimension_tag, reply_count
//
// NOTE: community_channels has NO is_active column — a previous bug
// filtered on .eq('is_active', true) and silently returned zero
// channels. Do not reintroduce that filter.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { effectivePlan } from '@/lib/planTier';
import CommunityClient from './CommunityClient';

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [categoriesRes, channelsRes, profileRes] = await Promise.all([
    supabase.from('community_categories').select('*').order('sort_order'),
    supabase.from('community_channels').select('*').order('sort_order'),
    supabase
      .from('profiles')
      .select('full_name, subscription_plan, subscription_status, subscription_end, id')
      .eq('id', user.id)
      .single(),
  ]);

  if (categoriesRes.error) {
    console.error('[community/page] categories query failed:', categoriesRes.error.message);
  }
  if (channelsRes.error) {
    console.error('[community/page] channels query failed:', channelsRes.error.message);
  }

  const plan = effectivePlan(profileRes.data);
  const userName = profileRes.data?.full_name?.trim() || 'Member';

  return (
    <CommunityClient
      categories={categoriesRes.data ?? []}
      channels={channelsRes.data ?? []}
      userPlan={plan}
      userId={user.id}
      userName={userName}
    />
  );
}
