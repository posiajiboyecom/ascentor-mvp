'use server';

import { revalidatePath } from 'next/cache';
import { requireMember, getMe, getMyCircle, fail } from '@/lib/rx/server';
import type { ActionResult } from '@/lib/rx/types';
import { cleanText } from '@/lib/rx/safety';
import { openThread } from '@/app/(app)/messages/actions';
import { addDays } from '@/lib/rx/dates';

// ── what Sage knows ─────────────────────────────────────────────────────────

export async function addMemory(text: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const t = cleanText(text, 160);
    if (!t) throw new Error('Write the note first.');
    const { count } = await db.from('sage_memories').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if ((count ?? 0) >= 30) throw new Error('That’s plenty of notes. Delete one to add another.');
    const { error } = await db.from('sage_memories').insert({ user_id: userId, text: t });
    if (error) throw error;
    revalidatePath('/sage/memory');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function updateMemory(id: string, text: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const t = cleanText(text, 160);
    if (!t) throw new Error('A note can’t be empty. Delete it instead.');
    const { error } = await db.from('sage_memories').update({ text: t }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/sage/memory');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function deleteMemory(id: string): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const { error } = await db.from('sage_memories').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    revalidatePath('/sage/memory');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── reminders ───────────────────────────────────────────────────────────────

export async function saveReminderPrefs(p: { maxPerDay?: number; quietHours?: boolean; paused?: boolean }): Promise<ActionResult> {
  try {
    const { db, userId } = await requireMember();
    const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (p.maxPerDay !== undefined) row.max_per_day = p.maxPerDay === 2 ? 2 : 1;
    if (p.quietHours !== undefined) row.quiet_hours = !!p.quietHours;
    if (p.paused !== undefined) row.reminders_paused_until = p.paused ? new Date(Date.now() + 7 * 86400000).toISOString() : null;
    const { error } = await db.from('member_profile').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    revalidatePath('/sage/reminders');
    return { ok: true };
  } catch (e) { return fail(e); }
}

// ── the panel's helpers ─────────────────────────────────────────────────────

/** A report draft built only from this week's own check-ins and plan. Nothing is invented. */
export async function buildReportDraft(): Promise<ActionResult<{ draft: { kept: string; obstacle: string; next: string; summary: string } }>> {
  try {
    const { db, userId } = await requireMember();
    const me = await getMe();
    if (!me) throw new Error('Please sign in again.');
    const [{ data: p }, { data: cs }] = await Promise.all([
      db.from('practices').select('cue, action, trigger, fallback, obstacle').eq('user_id', userId).eq('week_start', me.weekStart).maybeSingle(),
      db.from('practice_checkins').select('day, status').eq('user_id', userId).gte('day', me.weekStart).lte('day', addDays(me.weekStart, 6)),
    ]);
    const rows = (cs ?? []) as { status: string }[];
    const kept = rows.filter((r) => r.status === 'kept').length;
    const total = rows.length;
    const verdict = total === 0 ? 'Not kept' : kept === total ? 'Kept' : kept === 0 ? 'Not kept' : 'Partly kept';
    const plan = p as { cue: string; action: string; trigger: string | null; fallback: string | null; obstacle: string | null } | null;
    return {
      ok: true,
      draft: {
        kept: verdict,
        summary: total ? `${kept} of ${total} check-ins.` : 'No check-ins logged yet this week.',
        obstacle: plan?.obstacle ?? '',
        next: plan ? `After I ${plan.cue}, I will ${plan.action}.${plan.trigger && plan.fallback ? ` If ${plan.trigger}, then I will ${plan.fallback}.` : ''}` : '',
      },
    };
  } catch (e) { return fail(e); }
}

/** The member's Circle facilitator, and (when asked) the conversation with them. */
export async function openFacilitatorThread(open: boolean): Promise<ActionResult<{ name: string; threadId: string | null }>> {
  try {
    await requireMember();
    const circle = await getMyCircle();
    const fac = circle?.seats.find((s) => s.role === 'facilitator' || s.userId === circle.circle.facilitator_id);
    if (!circle || !fac) throw new Error('No facilitator yet.');
    if (!open) return { ok: true, name: fac.name, threadId: null };
    const t = await openThread(fac.userId);
    if (!t.ok) return t;
    return { ok: true, name: fac.name, threadId: t.threadId };
  } catch (e) { return fail(e); }
}
