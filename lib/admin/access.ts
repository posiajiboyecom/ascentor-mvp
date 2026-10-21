// lib/admin/access.ts
// Server-only. Who is this teammate, and what may they do in each admin area?
//
//   - The role is DATA (public.admin_roles) and is chosen per teammate (profiles.admin_role).
//   - profiles.role = 'admin' is always the locked Admin role (full access, cannot be reduced).
//   - profiles.role = 'moderator' without an admin_role falls back to the Moderator role.
//   - Every console action calls ctx.require(area, level) BEFORE it does anything, and every console page checks the
//     view level. Hiding a menu item is not security; this is.
//   - "View as" (admins only) is a PREVIEW of the menu and screens through a teammate's role. It never changes what the
//     server allows: the real role is always what is enforced.

import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AREA_KEYS, DEFAULT_ROLES, RANK, can, levelOf, type Level, type RoleDef } from '@/lib/admin/areas';
import type { StaffCtx } from '@/lib/admin/types';

export const VIEW_AS_COOKIE = 'adm_view_as';

/** Roles from the database, falling back to the built-in defaults when the table is not there yet. */
export const loadRoles = cache(async (): Promise<RoleDef[]> => {
  try {
    const { data, error } = await supabaseAdmin.from('admin_roles').select('id, name, locked, levels, sort_order').order('sort_order', { ascending: true });
    if (error || !data?.length) return DEFAULT_ROLES;
    return data.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      locked: !!r.locked,
      levels: sanitiseLevels(r.levels),
    }));
  } catch {
    return DEFAULT_ROLES;
  }
});

/** Keep only known areas with known levels (never trust stored JSON blindly). */
export function sanitiseLevels(raw: unknown): Record<string, Level> {
  const out: Record<string, Level> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (AREA_KEYS.includes(k) && (v === 'view' || v === 'edit' || v === 'full')) out[k] = v;
    }
  }
  return out;
}

export interface Staff extends StaffCtx {
  /** The role used to DRAW the menu and screens: the real role, or a teammate's role while an admin previews. */
  uiRole: RoleDef;
  uiLevel: (area: string) => Level;
  /** Set while an admin is previewing another teammate. */
  viewingAs: { id: string; name: string } | null;
  isAdmin: boolean;
  avatarUrl: string | null;
}

/** The signed-in teammate, or null if not signed in / not staff. Cached per request. */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let row: { full_name: string | null; role: string | null; admin_role?: string | null; avatar_url?: string | null } | null = null;
  const full = await supabase.from('profiles').select('full_name, role, admin_role, avatar_url').eq('id', user.id).maybeSingle();
  if (full.error) {
    // admin_role / avatar_url columns may not exist yet: retry with the core columns so nobody is locked out.
    const core = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
    row = core.data ?? null;
  } else row = full.data;
  if (!row || (row.role !== 'admin' && row.role !== 'moderator')) return null;

  const roles = await loadRoles();
  const byId = new Map(roles.map((r) => [r.id, r]));
  const roleId = row.role === 'admin' ? 'admin' : (row.admin_role && byId.has(row.admin_role) ? row.admin_role : 'moderator');
  const role = byId.get(roleId) ?? DEFAULT_ROLES.find((r) => r.id === roleId) ?? DEFAULT_ROLES[1];
  const isAdmin = roleId === 'admin';

  const level = (area: string): Level => levelOf(role, area);
  const need = (area: string, lv: Level) => {
    if (!can(level(area), lv)) throw new Error(lv === 'full' ? 'Only a role with Full access to this area can do that.' : 'Your role cannot change this area.');
  };

  // Admin preview ("View as"): UI only.
  let uiRole = role;
  let viewingAs: Staff['viewingAs'] = null;
  if (isAdmin) {
    const target = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (target && target !== user.id) {
      const t = await supabaseAdmin.from('profiles').select('id, full_name, role, admin_role').eq('id', target).maybeSingle();
      if (t.data && (t.data.role === 'admin' || t.data.role === 'moderator')) {
        const tid = t.data.role === 'admin' ? 'admin' : (t.data.admin_role && byId.has(t.data.admin_role as string) ? (t.data.admin_role as string) : 'moderator');
        uiRole = byId.get(tid) ?? role;
        viewingAs = { id: t.data.id as string, name: (t.data.full_name as string | null) || 'Teammate' };
      }
    }
  }

  return {
    userId: user.id,
    name: row.full_name?.trim() || user.email?.split('@')[0] || 'Admin',
    email: user.email ?? null,
    roleId,
    roleName: role.name,
    level,
    require: need,
    uiRole,
    uiLevel: (area: string) => levelOf(uiRole, area),
    viewingAs,
    isAdmin,
    avatarUrl: (row.avatar_url as string | null | undefined) ?? null,
  };
});

/**
 * For console pages: the signed-in teammate, redirecting to sign-in if there is none and to the first area the role can open
 * if it has no access to `area`. Uses the PREVIEW level so an admin viewing as someone sees what they would see.
 */
export async function requireArea(area: string, need: Level = 'view'): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/admin-login');
  // Real access first: a hidden area can never be opened by URL, whatever the preview says.
  if (!can(staff.level(area), need)) redirect(firstAreaHref(staff));
  if (!can(staff.uiLevel(area), need)) redirect(firstAreaHref(staff, true));
  return staff;
}

function firstAreaHref(staff: Staff, preview = false): string {
  const lv = preview ? staff.uiLevel : staff.level;
  const first = AREA_KEYS.find((k) => can(lv(k), 'view'));
  if (!first) return '/dashboard';
  return first === 'overview' ? '/admin' : `/admin/c/${first}`;
}

/** For server actions: the staff context, or a thrown error if the caller is not staff. */
export async function staffForAction(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new Error('Please sign in again.');
  return staff;
}

export { RANK };
