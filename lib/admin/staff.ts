// lib/admin/staff.ts
// Server-only. The team: who has an admin role, and changing roles. Every WRITE here assumes the caller already passed
// staff.require('team', 'edit') (the Team and access actions do), and re-checks the rules that must hold regardless:
//   - only an Admin can make someone an Admin, or change an Admin's role
//   - the locked Admin role cannot be edited or removed
//   - roles are stored as data (public.admin_roles); area and level names are validated against the known lists

import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AREA_KEYS, type Level } from '@/lib/admin/areas';
import { loadRoles } from '@/lib/admin/access';
import type { StaffCtx } from '@/lib/admin/types';
import { isOwnerEmail } from '@/lib/admin/owner';

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  /** "Now", "Today", "Mon" style label, or "Never". */
  lastActive: string;
  isSelf: boolean;
}

function lastLabel(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const mins = (Date.now() - d.getTime()) / 60000;
  if (mins < 10) return 'Now';
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  if (day(d) === day(new Date())) return 'Today';
  if (day(d) === day(new Date(Date.now() - 864e5))) return 'Yesterday';
  if (mins < 60 * 24 * 7) return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short' });
  return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' });
}

/** Everyone who can open the admin: profiles with role admin or moderator. */
export async function listStaff(selfId: string): Promise<StaffRow[]> {
  const roles = await loadRoles();
  const byId = new Map(roles.map((r) => [r.id, r]));
  let rows: { id: string; full_name: string | null; email: string | null; role: string; admin_role?: string | null }[] = [];
  const full = await supabaseAdmin.from('profiles').select('id, full_name, email, role, admin_role').in('role', ['admin', 'moderator']).order('full_name');
  if (full.error) {
    const core = await supabaseAdmin.from('profiles').select('id, full_name, email, role').in('role', ['admin', 'moderator']).order('full_name');
    rows = (core.data ?? []) as typeof rows;
  } else rows = (full.data ?? []) as typeof rows;

  const last = new Map<string, string | null>();
  try {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) last.set(u.id, u.last_sign_in_at ?? null);
  } catch { /* last-active is a nicety */ }

  return rows.map((r) => {
    const owner = isOwnerEmail(r.email);
    const roleId = owner ? 'owner' : r.role === 'admin' ? 'admin' : (r.admin_role && byId.has(r.admin_role) ? r.admin_role : 'moderator');
    return {
      id: r.id,
      name: r.full_name?.trim() || r.email || 'Teammate',
      email: r.email ?? '',
      roleId,
      roleName: owner ? 'Owner' : byId.get(roleId)?.name ?? roleId,
      lastActive: r.id === selfId ? 'Now' : lastLabel(last.get(r.id)),
      isSelf: r.id === selfId,
    };
  });
}

const OWNER_ONLY = 'Only the Owner account can change staff access.';

/** Change one teammate's role. Returns an error message, or null on success. Only the Owner (lib/admin/owner.ts) may do this. */
export async function setStaffRole(actor: StaffCtx, userId: string, roleId: string): Promise<string | null> {
  if (!actor.isOwner) return OWNER_ONLY;
  const roles = await loadRoles();
  if (!roles.some((r) => r.id === roleId)) return 'That role does not exist.';
  if (userId === actor.userId) return 'You cannot change your own role.';
  const target = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (!target.data) return 'We could not find that teammate.';

  // profiles.role gates the admin area itself; admin_role picks the role's levels within it.
  const patch = roleId === 'admin' ? { role: 'admin', admin_role: 'admin' } : { role: 'moderator', admin_role: roleId };
  const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', userId);
  return error ? 'We could not save that. Please try again.' : null;
}

/** Remove someone's admin access (back to a normal member). Only the Owner may do this. */
export async function removeStaff(actor: StaffCtx, userId: string): Promise<string | null> {
  if (!actor.isOwner) return OWNER_ONLY;
  if (userId === actor.userId) return 'You cannot remove your own access.';
  const target = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (!target.data) return 'We could not find that teammate.';
  const { error } = await supabaseAdmin.from('profiles').update({ role: 'member', admin_role: null }).eq('id', userId);
  return error ? 'We could not save that. Please try again.' : null;
}

/** Set one area's level on a role ('none' removes it). The Admin role is locked. Only the Owner may do this. */
export async function setRoleLevel(actor: StaffCtx, roleId: string, area: string, level: Level): Promise<string | null> {
  if (!actor.isOwner) return OWNER_ONLY;
  if (roleId === 'admin') return 'Admins have full access to everything. This cannot be changed.';
  if (!AREA_KEYS.includes(area)) return 'Unknown area.';
  const role = (await loadRoles()).find((r) => r.id === roleId);
  if (!role) return 'That role does not exist.';
  const levels = { ...role.levels };
  if (level === 'none') delete levels[area]; else levels[area] = level;
  const { error } = await supabaseAdmin.from('admin_roles').update({ levels, updated_at: new Date().toISOString() }).eq('id', roleId);
  return error ? 'We could not save that. Please try again.' : null;
}

/** Create a role with no access yet. Returns the new id or an error. Only the Owner may do this. */
export async function createRole(actor: StaffCtx, name: string): Promise<{ id?: string; error?: string }> {
  if (!actor.isOwner) return { error: OWNER_ONLY };
  const clean = name.trim().slice(0, 40);
  if (clean.length < 2) return { error: 'Give the role a name.' };
  const id = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'role';
  const roles = await loadRoles();
  if (roles.some((r) => r.id === id || r.name.toLowerCase() === clean.toLowerCase())) return { error: 'A role with that name already exists.' };
  const { error } = await supabaseAdmin.from('admin_roles').insert({ id, name: clean, locked: false, levels: {}, sort_order: roles.length });
  return error ? { error: 'We could not create that role.' } : { id };
}
