'use server';

// Redeem a reward code for the signed-in member (lib/rewards/access-codes.ts).
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redeemCode, tierName } from '@/lib/rewards/access-codes';
import { REWARD_COOKIE } from '@/lib/rewards/cookie';

export type RedeemState = { ok: true; message: string } | { ok: false; error: string };

export async function redeemRewardCode(code: string): Promise<RedeemState> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in first.' };
  const r = await redeemCode(user.id, code);
  if (!r.ok) return r;
  try { (await cookies()).delete(REWARD_COOKIE); } catch { /* nothing to clear */ }
  revalidatePath('/settings/billing');
  const until = new Date(r.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
  return {
    ok: true,
    message: r.extendedPaidPlan
      ? `Done. We added ${r.months} free months to your plan. Your next charge is pushed back, and your plan runs to ${until}.`
      : `Done. You have ${tierName(r.tier)} free until ${until}.`,
  };
}
