'use server';

import { headers } from 'next/headers';
import { rateLimit } from '@/lib/auth/rate-limit-shared';
import { walkIn, walkInOpen, type WalkInResult } from '@/lib/summitWalkIn';

/** Walk-in self check-in. Generous per-IP limit: at the venue, hundreds of people may share one Wi-Fi address. */
export async function walkInAction(fullName: string, email: string, whatsapp: string): Promise<WalkInResult> {
  try {
    if (!(await walkInOpen())) return { ok: false, error: 'Walk-in check-in is closed right now. Please go to the help desk.' };
    const h = await headers();
    const ip = (h.get('x-vercel-forwarded-for') ?? h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const limit = await rateLimit(ip, { scope: 'summit-walkin', max: 300, windowSeconds: 600 });
    if (!limit.allowed) return { ok: false, error: 'Lots of people are checking in on this network. Wait a minute and try again.' };
    return await walkIn({ fullName: String(fullName ?? ''), email: String(email ?? ''), whatsapp: String(whatsapp ?? '') });
  } catch (e) {
    console.error('[walk-in] action failed:', e);
    return { ok: false, error: 'We could not check you in. Please try again, or go to the help desk.' };
  }
}
