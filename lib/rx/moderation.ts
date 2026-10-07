import 'server-only';
// lib/rx/moderation.ts
// Automatic flags for risky messages anywhere (Circle, group, direct). Flags feed the moderation queue; nothing is
// blocked here. A failure to flag never stops a message from sending.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { assessMessage } from './safety';

export async function flagIfRisky(kind: 'dm' | 'circle' | 'group', messageId: string, userId: string, text: string): Promise<boolean> {
  try {
    const a = assessMessage(text);
    if (!a.flagged) return false;
    await supabaseAdmin.from('rx_flags').insert({ kind, ref_id: messageId, user_id: userId, reason: a.reasons.join('; ').slice(0, 300) });
    return true;
  } catch { return false; }
}

/** Whether this member may start conversations outside their Circle. New accounts and blocked accounts may not. */
export async function accountGate(userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [{ data: prof }, { data: mp }] = await Promise.all([
    supabaseAdmin.from('profiles').select('created_at, onboarding_completed').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('member_profile').select('messaging_blocked').eq('user_id', userId).maybeSingle(),
  ]);
  if (mp?.messaging_blocked) return { ok: false, reason: 'Messaging is turned off for your account. Contact the Ascentor team if you think that is a mistake.' };
  const ageDays = prof?.created_at ? (Date.now() - new Date(prof.created_at as string).getTime()) / 86400000 : 0;
  if (!prof?.onboarding_completed || ageDays < 7) return { ok: false, reason: 'You can message your Circle straight away. Messaging other members opens 7 days after you join, once setup is done.' };
  return { ok: true };
}

export async function accountAgeDays(userId: string): Promise<number> {
  const { data } = await supabaseAdmin.from('profiles').select('created_at').eq('id', userId).maybeSingle();
  return data?.created_at ? (Date.now() - new Date(data.created_at as string).getTime()) / 86400000 : 0;
}
