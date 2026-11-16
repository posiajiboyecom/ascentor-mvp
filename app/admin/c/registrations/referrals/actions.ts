'use server';

// Review a flagged Summit referral. Needs Edit on Registrations, checked here and not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { listSummitWinners, setAboveAndBeyond, ensureWinnerCode, REDEEM_BY } from '@/lib/rewards/access-codes';
import { sendRewardCodeEmail } from '@/lib/summitEmails';

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

// ── Referral winners' rewards (lib/rewards/access-codes.ts) ───────────────────────────────────────────

type Res = { ok: boolean; error?: string; message?: string };
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work.');

/** Marks a winner "above and beyond": 3 months of Builder instead of 2. */
export async function markAboveAndBeyond(registrationId: string, on: boolean): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const w = (await listSummitWinners()).find((x) => x.registrationId === registrationId);
    if (!w) return { ok: false, error: 'That person hasn’t reached 10 confirmed referrals.' };
    const code = await setAboveAndBeyond(w, !!on);
    await auditAdmin(staff, on ? 'Marked a referral winner above and beyond' : 'Unmarked a referral winner as above and beyond', w.name, 'Registrations');
    revalidatePath('/admin/c/registrations/referrals');
    const resend = code.emailed_at && code.emailed_months !== code.months ? ' Their email said a different length: press Email codes to send the update.' : '';
    return { ok: true, message: `${w.name}: ${code.months} months.${resend}` };
  } catch (e) { return { ok: false, error: errText(e) }; }
}

/** Emails each winner their code. Skips codes already used, and anyone already sent the current length. 10 a press. */
export async function emailRewardCodes(): Promise<Res> {
  try {
    const staff = await staffForAction();
    staff.require('registrations', 'edit');
    const winners = await listSummitWinners();
    if (!winners.length) return { ok: true, message: 'Nobody has reached 10 confirmed referrals yet.' };
    let sent = 0, failed = 0, waiting = 0;
    for (const w of winners) {
      if (!w.email) { failed++; continue; }
      const code = w.code ?? await ensureWinnerCode(w);
      if (code.redeemed_at || (code.emailed_at && code.emailed_months === code.months)) continue;
      if (sent >= 10) { waiting++; continue; }
      try {
        await sendRewardCodeEmail({ to: w.email, fullName: w.name, code: code.code, months: code.months, confirmed: w.confirmed, aboveAndBeyond: code.above_and_beyond, redeemBy: code.redeem_by ?? REDEEM_BY });
        await supabaseAdmin.from('access_codes').update({ emailed_at: new Date().toISOString(), emailed_months: code.months, updated_at: new Date().toISOString() }).eq('id', code.id);
        sent++;
      } catch (e) { failed++; console.error('[admin/rewards] email failed:', errText(e)); }
    }
    if (sent) await auditAdmin(staff, `Emailed ${sent} referral reward code${sent === 1 ? '' : 's'}`, `${sent} winner${sent === 1 ? '' : 's'}`, 'Registrations');
    revalidatePath('/admin/c/registrations/referrals');
    if (!sent && !failed && !waiting) return { ok: true, message: 'Every winner already has their code.' };
    return { ok: failed === 0, message: `Sent ${sent}.${waiting ? ` ${waiting} more waiting: press again.` : ''}${failed ? ` ${failed} could not be sent (no email, or the mailbox refused).` : ''}` };
  } catch (e) { return { ok: false, error: errText(e) }; }
}
