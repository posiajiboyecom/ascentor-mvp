'use server';

// Mentor links. Only a role with Edit on Mentors can create, renew or cancel one; the check runs here, not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { createMentorInvite, resendMentorInvite, revokeMentorInvite, type MentorIssueResult } from '@/lib/mentor-invites';

const AREA = 'Mentors';
const PATH = '/admin/c/mentors/invite';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');

export async function inviteMentor(name: string, email: string): Promise<MentorIssueResult> {
  try {
    const staff = await staffForAction();
    staff.require('mentors', 'edit');
    const r = await createMentorInvite(staff, String(name ?? ''), String(email ?? ''));
    if (r.ok) await auditAdmin(staff, 'Created a mentor link', String(email).trim().toLowerCase(), AREA);
    revalidatePath(PATH);
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function renewMentorInvite(id: string): Promise<MentorIssueResult> {
  try {
    const staff = await staffForAction();
    staff.require('mentors', 'edit');
    const r = await resendMentorInvite(staff, String(id ?? ''));
    if (r.ok) await auditAdmin(staff, 'Renewed a mentor link', String(id), AREA);
    revalidatePath(PATH);
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function cancelMentorInvite(id: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const staff = await staffForAction();
    staff.require('mentors', 'edit');
    const r = await revokeMentorInvite(String(id ?? ''));
    if (!r.ok) return { ok: false, error: r.error };
    await auditAdmin(staff, 'Cancelled a mentor link', r.email ?? String(id), AREA);
    revalidatePath(PATH);
    return { ok: true, message: 'Link cancelled. It no longer works.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
