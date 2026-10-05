// app/api/admin/permissions/route.ts
// POST: grant/revoke team access or update a user's custom permissions.
// All writes use the service role client and are audited.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ALL_PERMISSIONS, userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';

async function getCaller(userId: string): Promise<{ role: UserRole; permissions: Permission[] | null } | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('role, permissions')
    .eq('id', userId)
    .single();
  if (!data) return null;
  return { role: data.role as UserRole, permissions: data.permissions as Permission[] | null };
}

function canEditPermissions(caller: { role: UserRole; permissions: Permission[] | null } | null) {
  return !!caller && userHasPermission(caller.role, caller.permissions, 'users.edit_role');
}

function validatePermissions(perms: unknown): Permission[] {
  if (!Array.isArray(perms)) throw new Error('permissions must be an array');
  const invalid = perms.filter((p) => !ALL_PERMISSIONS.includes(p as Permission));
  if (invalid.length > 0) throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  return perms as Permission[];
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const caller = await getCaller(user.id);
    if (!canEditPermissions(caller)) {
      return NextResponse.json({ error: 'Forbidden: users.edit_role required' }, { status: 403 });
    }

    const parsed = await parseJson(req, adminSchemas.permissionsAction);
    if (!parsed.ok) return parsed.response;
    const { targetUserId, action, value } = parsed.data;

    const { data: before } = await supabaseAdmin
      .from('profiles')
      .select('role, permissions, full_name, email')
      .eq('id', targetUserId)
      .single();

    let updates: { role?: string; permissions?: Permission[] | null } = {};

    switch (action) {
      case 'grant': {
        const base: Permission[] = ['admin.access', 'admin.view_stats'];
        updates = { role: 'moderator', permissions: base };
        break;
      }
      case 'revoke': {
        updates = { role: 'member', permissions: null };
        break;
      }
      case 'set_permissions': {
        const perms = validatePermissions(value);
        updates = { permissions: perms };
        break;
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', targetUserId);

    if (error) throw error;

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'permissions_changed',
      entity_type: 'user',
      entity_id: targetUserId,
      details: {
        before: { role: before?.role, permissions: before?.permissions },
        after: updates,
        target_email: before?.email,
        target_name: before?.full_name,
      },
    });

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    console.error('[admin/permissions] error:', err);
    return NextResponse.json({ error: err.message || 'Action failed' }, { status: 500 });
  }
}
