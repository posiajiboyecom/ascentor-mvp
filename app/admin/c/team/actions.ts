'use server';

// Team and access. Only a role with Edit on `team` can change anything; the check runs here, not in the page.
import { revalidatePath } from 'next/cache';
import { staffForAction, loadRoles } from '@/lib/admin/access';
import { auditAdmin } from '@/lib/admin/audit';
import { createRole, setRoleLevel, setStaffRole } from '@/lib/admin/staff';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { LEVELS, type Level } from '@/lib/admin/areas';
import { areaOf } from '@/lib/admin/areas';

export interface TeamResult { ok: boolean; message?: string; error?: string; id?: string }

const AREA = 'Team and access';
const fail = (e: unknown): TeamResult => ({ ok: false, error: e instanceof Error && e.message ? e.message : 'That did not work. Please try again.' });

async function roleName(id: string): Promise<string> {
  return (await loadRoles()).find((r) => r.id === id)?.name ?? id;
}

export async function changeTeammateRole(userId: string, roleId: string): Promise<TeamResult> {
  try {
    const staff = await staffForAction();
    staff.require('team', 'edit');
    const target = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
    const err = await setStaffRole(staff, userId, roleId);
    if (err) return { ok: false, error: err };
    const who = target.data?.full_name?.trim() || target.data?.email || 'Teammate';
    const rn = await roleName(roleId);
    await auditAdmin(staff, `Changed role to ${rn}`, who, AREA);
    revalidatePath('/admin/c/team');
    return { ok: true, message: `${who} is now ${rn}. It applies on their next page load.` };
  } catch (e) { return fail(e); }
}

export async function setLevelForRole(roleId: string, area: string, level: string): Promise<TeamResult> {
  try {
    const staff = await staffForAction();
    staff.require('team', 'edit');
    const lv = LEVELS.find(([k]) => k === level);
    if (!lv) return { ok: false, error: 'Unknown level.' };
    const info = areaOf(area);
    if (!info) return { ok: false, error: 'Unknown area.' };
    const err = await setRoleLevel(roleId, area, level as Level);
    if (err) return { ok: false, error: err };
    const rn = await roleName(roleId);
    await auditAdmin(staff, `${rn}: ${info.label} set to ${lv[1]}`, rn, AREA);
    revalidatePath('/admin/c/team');
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function createTeamRole(name: string): Promise<TeamResult> {
  try {
    const staff = await staffForAction();
    staff.require('team', 'edit');
    const res = await createRole(String(name ?? ''));
    if (res.error || !res.id) return { ok: false, error: res.error ?? 'We could not create that role.' };
    const rn = await roleName(res.id);
    await auditAdmin(staff, 'Created role', rn, AREA);
    revalidatePath('/admin/c/team');
    return { ok: true, id: res.id, message: `${rn} created. It has no access yet: set what it can open below.` };
  } catch (e) { return fail(e); }
}

/** Gives an existing Ascentor account a role. It never creates accounts or sends email. */
export async function inviteTeammate(email: string, roleId: string): Promise<TeamResult> {
  try {
    const staff = await staffForAction();
    staff.require('team', 'edit');
    const clean = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: 'Enter a valid email address.' };
    const { data: p } = await supabaseAdmin.from('profiles').select('id, full_name, email').ilike('email', clean).maybeSingle();
    if (!p) return { ok: false, error: 'No Ascentor account has that email. They need to sign up as a member first, then you can give them a role. We do not create accounts or send invitations from here.' };
    const err = await setStaffRole(staff, p.id as string, roleId);
    if (err) return { ok: false, error: err };
    const who = (p.full_name as string | null)?.trim() || clean;
    const rn = await roleName(roleId);
    await auditAdmin(staff, `Invited as ${rn}`, who, AREA);
    revalidatePath('/admin/c/team');
    return { ok: true, message: `${who} is now ${rn}. It applies on their next page load.` };
  } catch (e) { return fail(e); }
}
