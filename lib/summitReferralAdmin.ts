import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface Leader { id: string; name: string; email: string; code: string; verified: number; pending: number; flagged: number; attended: number }
export interface FlaggedRow { id: string; referrer: string; friend: string; friendEmail: string; reason: string; createdAt: string; status: string }

export async function loadReferrals(): Promise<{ leaders: Leader[]; flagged: FlaggedRow[]; total: number }> {
  const { data: refs, error } = await supabaseAdmin.from('summit_referrals').select('id, referrer_id, referred_id, status, reason, created_at').order('created_at', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  const rows = refs ?? [];
  const ids = [...new Set(rows.flatMap((r) => [r.referrer_id as string, r.referred_id as string]))];
  const regs = new Map<string, { full_name: string; email: string; referral_code: string | null; attended_at: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from('summit_registrations').select('id, full_name, email, referral_code, attended_at').in('id', ids.slice(i, i + 200));
    for (const r of data ?? []) regs.set(r.id as string, r as never);
  }
  const by = new Map<string, Leader>();
  for (const r of rows) {
    const who = regs.get(r.referrer_id as string); if (!who) continue;
    const l = by.get(r.referrer_id as string) ?? { id: r.referrer_id as string, name: who.full_name, email: who.email, code: who.referral_code ?? '', verified: 0, pending: 0, flagged: 0, attended: 0 };
    if (r.status === 'verified') { l.verified++; if (regs.get(r.referred_id as string)?.attended_at) l.attended++; }
    else if (r.status === 'pending') l.pending++;
    else if (r.status === 'flagged') l.flagged++;
    by.set(l.id, l);
  }
  const leaders = [...by.values()].sort((a, b) => b.attended - a.attended || b.verified - a.verified || b.pending - a.pending).slice(0, 200);
  const flagged = rows.filter((r) => r.status === 'flagged').map((r) => ({
    id: r.id as string, referrer: regs.get(r.referrer_id as string)?.full_name ?? '-', friend: regs.get(r.referred_id as string)?.full_name ?? '-',
    friendEmail: regs.get(r.referred_id as string)?.email ?? '', reason: (r.reason as string) ?? '', createdAt: r.created_at as string, status: r.status as string,
  }));
  return { leaders, flagged, total: rows.length };
}
