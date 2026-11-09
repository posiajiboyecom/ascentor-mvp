'use server';

// Review a flagged Summit referral. Needs Edit on Registrations, checked here and not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function reviewReferral(id: string, decision: 'approve' | 'reverse'): Promise<{ ok: boolean; error?: string }> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    if (!/^[0-9a-f-]{36}$/i.test(String(id)) || (decision !== 'approve' && decision !== 'reverse')) return { ok: false, error: 'Bad request.' };
    const now = new Date().toISOString();
    // Approving counts it straight away (friends no longer need to confirm their email).
    const { data: row } = await supabaseAdmin.from('summit_referrals').select('id, referred_id').eq('id', id).eq('status', 'flagged').maybeSingle();
    if (!row) return { ok: false, error: 'That referral is not waiting for review any more.' };
    const status = decision === 'approve' ? 'verified' : 'reversed';
    await supabaseAdmin.from('summit_referrals').update({ status, reviewed_by: staff.userId, reviewed_at: now, ...(status === 'verified' ? { verified_at: now } : {}) }).eq('id', id);
    await auditAdmin(staff, decision === 'approve' ? 'Approved a Summit referral' : 'Reversed a Summit referral', id, 'Registrations');
    revalidatePath('/admin/c/registrations/referrals');
    if (status === 'verified') { const { notifyReferrer } = await import('@/lib/summitReferral'); const { data: r } = await supabaseAdmin.from('summit_referrals').select('referrer_id').eq('id', id).maybeSingle(); if (r) await notifyReferrer(r.referrer_id as string, row.referred_id as string); }
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work.' }; }
}
