'use server';

// Admin broadcasts. Every action here is admin-only. Sending writes only through lib/rx/broadcasts.ts.

import { revalidatePath } from 'next/cache';
import { fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseAudience, validateBroadcast, type BroadcastInput } from '@/lib/rx/audience';
import { countAudience, createBroadcast, processBroadcast, sendTestTo, startSending } from '@/lib/rx/broadcasts';
import { buildNoticeEmail } from '@/lib/rx/notifications';

export interface MemberHit { id: string; name: string; email: string }

/** Finds members by name or email so a message can go to named people. Admin only; demo accounts are left out. */
export async function searchMembers(q: string): Promise<ActionResult<{ hits: MemberHit[] }>> {
  try {
    await requireAdmin();
    const term = (q ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 60);
    if (term.length < 2) return { ok: true, hits: [] };
    const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name, email').or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).order('full_name').limit(12);
    if (error) throw error;
    const rows = (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    const { data: demo } = rows.length ? await supabaseAdmin.from('member_profile').select('user_id').in('user_id', rows.map((r) => r.id)).eq('is_demo', true) : { data: [] };
    const skip = new Set(((demo ?? []) as { user_id: string }[]).map((d) => d.user_id));
    return { ok: true, hits: rows.filter((r) => !skip.has(r.id)).map((r) => ({ id: r.id, name: r.full_name?.trim() || r.email || 'Member', email: r.email ?? '' })) };
  } catch (e) { return fail(e, 'We couldn’t search members.'); }
}

export async function audienceCount(audienceRaw: unknown, channel: 'in_app' | 'email' | 'both'): Promise<ActionResult<{ total: number; inApp: number; email: number }>> {
  try {
    await requireAdmin();
    const audience = parseAudience(audienceRaw);
    if (!audience) throw new Error('Choose who it goes to.');
    const c = await countAudience(audience, channel);
    return { ok: true, ...c };
  } catch (e) { return fail(e, 'We couldn’t count who this reaches.'); }
}

/** The email exactly as it would be laid out, for the preview panel. */
export async function previewEmailHtml(input: BroadcastInput): Promise<ActionResult<{ html: string }>> {
  try {
    const me = await requireAdmin();
    const v = validateBroadcast({ ...input, channel: 'email', pinCard: false });
    if (!v.ok) throw new Error(v.error);
    const c = v.value;
    return { ok: true, html: buildNoticeEmail({ eyebrow: 'From Ascentor', title: c.title, body: c.body, url: c.linkUrl ?? '/dashboard', label: c.linkLabel ?? (c.linkUrl ? 'Open' : 'Open Ascentor'), recipient: me.email ?? 'you@example.com' }) };
  } catch (e) { return fail(e, 'We couldn’t build the preview.'); }
}

/** Sends the message to the admin only, as members would receive it. */
export async function sendTestBroadcast(input: BroadcastInput): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const r = await sendTestTo({ ...input, pinCard: false }, me.userId);
    if (!r.ok) throw new Error(r.error);
    return { ok: true };
  } catch (e) { return fail(e, 'We couldn’t send the test.'); }
}

export async function sendBroadcast(input: BroadcastInput): Promise<ActionResult<{ id: string; done: boolean; remaining: number }>> {
  try {
    const me = await requireAdmin();
    const made = await createBroadcast(input, me.userId);
    if (!made.ok) throw new Error(made.error);
    const started = await startSending(made.id);
    if (!started.ok) throw new Error(started.error);
    revalidatePath('/admin/broadcasts'); revalidatePath('/dashboard');
    return { ok: true, id: made.id, done: started.done, remaining: started.remaining };
  } catch (e) { return fail(e, 'We couldn’t send that message.'); }
}

/** Carries on with a send that ran out of time. */
export async function resumeBroadcast(id: string): Promise<ActionResult<{ done: boolean; remaining: number }>> {
  try {
    await requireAdmin();
    const r = await processBroadcast(id);
    revalidatePath('/admin/broadcasts');
    return { ok: true, done: r.done, remaining: r.remaining };
  } catch (e) { return fail(e); }
}

/** Takes the card out of everyone's sidebar now. The messages already sent stay where they are. */
export async function removeCardNow(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('broadcasts').update({ pin_card: false }).eq('id', id);
    if (error) throw error;
    revalidatePath('/admin/broadcasts'); revalidatePath('/dashboard');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function cancelBroadcast(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { error } = await supabaseAdmin.from('broadcasts').update({ status: 'cancelled' }).eq('id', id).in('status', ['draft', 'sending']);
    if (error) throw error;
    revalidatePath('/admin/broadcasts');
    return { ok: true };
  } catch (e) { return fail(e); }
}
