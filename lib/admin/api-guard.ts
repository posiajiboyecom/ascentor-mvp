// lib/admin/api-guard.ts
// Server-only. Area-level enforcement for the older /api/admin/** routes, using the same roles as the console.
//
//   const g = await guardApi('knowledge', 'edit', req);
//   if ('error' in g) return g.res;   // 401 / 403 JSON { error }
//
// Rules: not signed in -> 401. Not staff, or the role has less than `need` on `area` -> 403. profiles.role = 'admin' always passes.
// This reads the REAL role (never the "view as" preview). The route's own role check stays in place as a second layer.
// MFA: proxy.ts already requires AAL2 for /api/admin when ADMIN_MFA_REQUIRED is on.

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createSupabase } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadRoles } from '@/lib/admin/access';
import { DEFAULT_ROLES, can, levelOf, type Level } from '@/lib/admin/areas';

export interface ApiStaff { userId: string; roleId: string; isAdmin: boolean; level: (area: string) => Level }
export type GuardResult = { staff: ApiStaff } | { error: string; res: NextResponse };

const deny = (status: number, error: string): GuardResult => ({ error, res: NextResponse.json({ error }, { status }) });

async function callerId(req?: Request): Promise<string | null> {
  const header = req?.headers.get('authorization');
  if (header && /^bearer\s+\S+/i.test(header)) {
    const anon = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: header } } });
    const { data: { user } } = await anon.auth.getUser();
    if (user) return user.id;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function guardApi(area: string, need: Level, req?: Request): Promise<GuardResult> {
  let uid: string | null = null;
  try { uid = await callerId(req); } catch { uid = null; }
  if (!uid) return deny(401, 'Unauthorized');

  let row: { role: string | null; admin_role?: string | null } | null = null;
  const full = await supabaseAdmin.from('profiles').select('role, admin_role').eq('id', uid).maybeSingle();
  if (full.error) {
    const core = await supabaseAdmin.from('profiles').select('role').eq('id', uid).maybeSingle();
    row = core.data ?? null;
  } else row = full.data;
  if (!row || (row.role !== 'admin' && row.role !== 'moderator')) return deny(403, 'Forbidden');

  const roles = await loadRoles();
  const byId = new Map(roles.map((r) => [r.id, r]));
  const roleId = row.role === 'admin' ? 'admin' : (row.admin_role && byId.has(row.admin_role) ? row.admin_role : 'moderator');
  const role = byId.get(roleId) ?? DEFAULT_ROLES.find((r) => r.id === roleId) ?? DEFAULT_ROLES[1];
  const level = (a: string): Level => levelOf(role, a);
  if (!can(level(area), need)) return deny(403, need === 'full' ? 'Your role needs Full access to this area.' : 'Your role does not have access to this area.');
  return { staff: { userId: uid, roleId, isAdmin: roleId === 'admin', level } };
}
