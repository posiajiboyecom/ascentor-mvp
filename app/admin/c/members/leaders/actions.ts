'use server';

// Leader invites. Only a role with Edit on Members can create, resend or revoke; the check runs here, not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { createLeaderInvite, resendLeaderInvite, revokeLeaderInvite, type IssueResult } from '@/lib/leader-invites';

const AREA = 'Members';
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That did not work. Please try again.');

export async function inviteLeader(name: string, email: string): Promise<IssueResult> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'edit');
    const r = await createLeaderInvite(staff, String(name ?? ''), String(email ?? ''));
    if (r.ok) await auditAdmin(staff, 'Invited a Leader', String(email).trim().toLowerCase(), AREA);
    revalidatePath('/admin/c/members/leaders');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function resendInvite(id: string): Promise<IssueResult> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'edit');
    const r = await resendLeaderInvite(staff, String(id ?? ''));
    if (r.ok) await auditAdmin(staff, 'Resent a Leader invite', String(id), AREA);
    revalidatePath('/admin/c/members/leaders');
    return r;
  } catch (e) { return { ok: false, error: msg(e) }; }
}

export async function revokeInvite(id: string): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const staff = await staffForAction();
    staff.require('members', 'edit');
    const r = await revokeLeaderInvite(String(id ?? ''));
    if (!r.ok) return { ok: false, error: r.error };
    await auditAdmin(staff, 'Revoked a Leader invite', r.email ?? String(id), AREA);
    revalidatePath('/admin/c/members/leaders');
    return { ok: true, message: 'Invite revoked. The link no longer works.' };
  } catch (e) { return { ok: false, error: msg(e) }; }
}
