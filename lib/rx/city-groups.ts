import 'server-only';
// lib/rx/city-groups.ts
// Puts a member in their city's group, creating the group the first time someone from that city signs up.
// City groups are rx_groups rows with is_city = true and slug "city-<name>" (see lib/rx/cities.ts).
// Runs with the service role: members can't create groups themselves, and a new group isn't visible to
// them yet so the normal join policy would refuse the insert.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { slugify } from './shell-counts';
import { normalizeCity } from './city-names';

export async function joinCityGroup(userId: string, rawCity: string | null | undefined): Promise<{ slug: string; name: string; created: boolean } | null> {
  const name = normalizeCity(rawCity);
  if (!name) return null;
  const slug = `city-${slugify(name)}`;
  if (slug === 'city-') return null;

  let created = false;
  let { data: group } = await supabaseAdmin.from('rx_groups').select('id, name, status').eq('slug', slug).maybeSingle();
  if (!group) {
    const { data: made, error } = await supabaseAdmin.from('rx_groups')
      .insert({ slug, name, description: `Members in and around ${name}.`, dimension: 'Community', is_city: true, prompt: `Introduce yourself to members in ${name}: what are you working on?` })
      .select('id, name, status').maybeSingle();
    if (error && error.code !== '23505') throw error; // 23505: someone else created it a moment ago
    group = made ?? (await supabaseAdmin.from('rx_groups').select('id, name, status').eq('slug', slug).maybeSingle()).data;
    created = !!made;
  }
  if (!group) return null;
  // An archived city group comes back when a member from that city signs up.
  if (group.status !== 'active') await supabaseAdmin.from('rx_groups').update({ status: 'active' }).eq('id', group.id);

  const { error: jErr } = await supabaseAdmin.from('rx_group_members')
    .upsert({ group_id: group.id, user_id: userId }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
  if (jErr) throw jErr;
  return { slug, name: group.name as string, created };
}
