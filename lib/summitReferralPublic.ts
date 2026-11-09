import 'server-only';
// The public Summit referral leaderboard. Only confirmed ('verified') referrals count, the same rule as the admin board.
// Privacy: the public page shows a first name and last initial only. No email, phone, code or full surname ever leaves here.
import { supabaseAdmin } from '@/lib/supabase/admin';

export const REFERRAL_GOAL = 10;
const TOP = 20;

export interface PublicLeader { rank: number; name: string; confirmed: number; reached: boolean }
export interface PublicBoard { leaders: PublicLeader[]; reachedCount: number; totalConfirmed: number; referrers: number }

const cap = (w: string) => w.charAt(0).toLocaleUpperCase('en-GB') + w.slice(1).toLocaleLowerCase('en-GB');

/** "ADA obi-nwosu" → "Ada O." · "Tunde" → "Tunde" · anything unusable → "Summit guest". */
export function publicName(full: string | null | undefined): string {
  const words = (full ?? '').replace(/[^\p{L}\p{M}' -]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'Summit guest';
  const first = cap(words[0]).slice(0, 24);
  const last = words.length > 1 ? words[words.length - 1] : '';
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase('en-GB')}.` : first;
}

export async function loadPublicBoard(): Promise<PublicBoard> {
  const { data: refs, error } = await supabaseAdmin.from('summit_referrals').select('referrer_id').eq('status', 'verified').limit(20000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of refs ?? []) counts.set(r.referrer_id as string, (counts.get(r.referrer_id as string) ?? 0) + 1);

  const ids = [...counts.keys()];
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from('summit_registrations').select('id, full_name').in('id', ids.slice(i, i + 200)).eq('payment_status', 'paid');
    for (const r of data ?? []) names.set(r.id as string, r.full_name as string);
  }

  const sorted = ids.filter((id) => names.has(id)).map((id) => ({ id, n: counts.get(id)! })).sort((a, b) => b.n - a.n);
  // Equal counts share a place (1, 2, 2, 4).
  const leaders: PublicLeader[] = [];
  sorted.slice(0, TOP).forEach((x, i) => {
    const rank = i > 0 && sorted[i - 1].n === x.n ? leaders[i - 1].rank : i + 1;
    leaders.push({ rank, name: publicName(names.get(x.id)), confirmed: x.n, reached: x.n >= REFERRAL_GOAL });
  });
  return {
    leaders,
    reachedCount: sorted.filter((x) => x.n >= REFERRAL_GOAL).length,
    totalConfirmed: sorted.reduce((s, x) => s + x.n, 0),
    referrers: sorted.length,
  };
}
