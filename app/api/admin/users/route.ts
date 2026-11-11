// FILE: app/api/admin/users/route.ts
// FIX: change_plan action now:
//   - Validates against free / explorer (Seeker) / builder / leader
//   - Sets subscription_end 1 year from today (was 30 days - expired too fast)
//   - Sets billing_cycle = 'manual' to mark admin-granted access
//   - Handles downgrade to 'free' correctly (nulls subscription_end)
//   - Writes audit log entry with expiry date

// ============================================================
// ADMIN USERS API - /api/admin/users
// GET: list all users with search/filter
// PATCH: update role, ban/unban
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userHasPermission, type Permission, type UserRole } from '@/lib/permissions';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as adminSchemas from '@/lib/validation/schemas/admin';
import { guardApi, isOwnerUserId } from '@/lib/admin/api-guard';
import { can } from '@/lib/admin/areas';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCaller(userId: string): Promise<{ role: UserRole; permissions: Permission[] | null } | null> {
  const { data } = await supabase.from('profiles').select('role, permissions').eq('id', userId).single();
  if (!data) return null;
  return { role: data.role as UserRole, permissions: data.permissions as Permission[] | null };
}

function sanitizeSearch(s: string): string {
  // Remove characters that have special meaning in Supabase/PostgREST ilike filter strings.
  return s.replace(/[%*,]/g, '');
}

export async function GET(req: NextRequest) {
  const _g = await guardApi('members', 'view', req);
  if ('error' in _g) return _g.res;
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
    if (!caller || !userHasPermission(caller.role, caller.permissions, 'users.view')) {
      return NextResponse.json({ error: 'Forbidden: users.view required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, subscription_plan, subscription_status, subscription_end, created_at, referral_code, referral_count, avatar_url, current_role, industry, permissions', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) {
      const safe = sanitizeSearch(search);
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,referral_code.ilike.%${safe}%`);
    }
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('subscription_status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    // M-04: Use a single listUsers call instead of one getUserById per profile (was N+1).
    // We fetch up to 1000 auth users and join in memory - auth users are lightweight objects.
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map(
      (authList?.users || []).map(u => [u.id, u])
    );

    const enhancedData = (data || []).map((profile: any) => {
      const authUser = authMap.get(profile.id);
      return {
        ...profile,
        banned: authUser?.banned_until ? new Date(authUser.banned_until) > new Date() : false,
        last_sign_in: authUser?.last_sign_in_at ?? null,
        email: authUser?.email || profile.email,
      };
    });

    return NextResponse.json({ users: enhancedData, total: count, page, limit });
  } catch (err: any) {
    console.error('Admin users list error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const _g = await guardApi('members', 'edit', req);
  if ('error' in _g) return _g.res;
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
    if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const parsed = await parseJson(req, adminSchemas.userAdminAction);
    if (!parsed.ok) return parsed.response;
    const { targetUserId, action } = parsed.data;
    const value: string = 'value' in parsed.data ? (parsed.data.value ?? '') : '';

    // Only the Owner (lib/admin/owner.ts) can change roles, and nobody else can touch the Owner's own account.
    if (action === 'change_role' && !_g.staff.isOwner) return NextResponse.json({ error: 'Only the Owner account can change staff access.' }, { status: 403 });
    if (!_g.staff.isOwner && (await isOwnerUserId(targetUserId))) return NextResponse.json({ error: 'This account cannot be changed.' }, { status: 403 });

    // Area levels: deleting an account needs Full on Members; changing a role is a Team and access change.
    if (action === 'delete' && !can(_g.staff.level('members'), 'full')) return NextResponse.json({ error: 'Your role needs Full access to Members to delete an account.' }, { status: 403 });
    if (action === 'change_role' && !can(_g.staff.level('team'), 'full')) return NextResponse.json({ error: 'Changing roles needs Full access to Team and access.' }, { status: 403 });

    const required: Permission = action === 'delete' ? 'users.delete' : 'users.edit_role';
    if (!userHasPermission(caller.role, caller.permissions, required)) {
      return NextResponse.json({ error: `Forbidden: ${required} required` }, { status: 403 });
    }

    // Prevent self-modification
    if (targetUserId === user.id && action === 'change_role') {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    switch (action) {
      case 'change_role': {
        if (!['member', 'moderator', 'admin'].includes(value)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        await supabase.from('profiles').update({ role: value, updated_at: new Date().toISOString() }).eq('id', targetUserId);

        try {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'user_role_changed',
            entity_type: 'user',
            entity_id: targetUserId,
            details: { new_role: value },
          });
        } catch (e) {
          console.error('[audit_log] Failed to write audit entry:', e);
        }

        return NextResponse.json({ success: true, message: `Role updated to ${value}` });
      }

      case 'ban': {
        // Ban for 100 years (effectively permanent)
        const banUntil = new Date();
        banUntil.setFullYear(banUntil.getFullYear() + 100);
        await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: '876000h' });
        
        // Sign them out
        try {
          await supabase.auth.admin.signOut(targetUserId, 'global');
        } catch (e) {
           // Silently ignore sign out failures
        }

        try {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'user_banned',
            entity_type: 'user',
            entity_id: targetUserId,
            details: { reason: value || 'Admin action' },
          });
        } catch (e) {
          console.error('[audit_log] Failed to write audit entry:', e);
        }

        return NextResponse.json({ success: true, message: 'User banned' });
      }

      case 'unban': {
        await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' });

        try {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'user_unbanned',
            entity_type: 'user',
            entity_id: targetUserId,
          });
        } catch (e) {
          console.error('[audit_log] Failed to write audit entry:', e);
        }

        return NextResponse.json({ success: true, message: 'User unbanned' });
      }

      case 'change_plan': {
        const validPlans = ['free', 'explorer', 'builder', 'pinnacle', 'leader'];
        if (!validPlans.includes(value)) {
          return NextResponse.json({ error: 'Invalid plan. Must be: free, explorer (Seeker), builder, or leader' }, { status: 400 });
        }

        if (value === 'free') {
          // Downgrade to free - cancel subscription immediately
          await supabase.from('profiles').update({
            subscription_plan:   'free',
            subscription_status: 'free',
            subscription_end:    null,
            updated_at:          new Date().toISOString(),
          }).eq('id', targetUserId);
          return NextResponse.json({ success: true, message: 'User moved to free plan' });
        }

        // Grant paid plan - set 1 year from today so access doesn't expire soon
        const subscriptionEnd = new Date();
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);

        await supabase.from('profiles').update({
          subscription_plan:    value,
          subscription_status:  'active',
          subscription_end:     subscriptionEnd.toISOString(),
          billing_cycle:        'manual',   // marks it as admin-granted, not a payment
          updated_at:           new Date().toISOString(),
        }).eq('id', targetUserId);

        try {
          await supabase.from('audit_logs').insert({
            user_id:     user.id,
            action:      'user_plan_changed',
            entity_type: 'user',
            entity_id:   targetUserId,
            details:     { new_plan: value, granted_by: user.email, expires: subscriptionEnd.toISOString() },
          });
        } catch (e) {
          console.error('[audit_log] Failed to write audit entry:', e);
        }

        return NextResponse.json({ success: true, message: `Plan set to ${value} (active until ${subscriptionEnd.toLocaleDateString()})` });
      }

      case 'delete': {
        // Prevent deleting yourself
        if (targetUserId === user.id) {
          return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        // 1. Delete all user data from Supabase tables first
        // (profiles has cascade but explicit cleanup is safer)
        const cleanupTables = [
          'coaching_sessions',
          'cohort_members',
          'cohort_posts',
          'cohort_replies',
          'cohort_votes',
          'notifications',
          'push_subscriptions',
          'referrals',
          'session_registrations',
          'goal_entries',
        ];

        for (const table of cleanupTables) {
          try {
            await supabase.from(table).delete().eq('user_id', targetUserId);
          } catch {
            // Table may not exist or column may differ - continue
          }
        }

        // 2. Delete the profile row
        await supabase.from('profiles').delete().eq('id', targetUserId);

        // 3. Delete from Supabase Auth - this is the critical step
        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);
        if (deleteError) {
          return NextResponse.json({ error: 'Failed to delete auth user: ' + deleteError.message }, { status: 500 });
        }

        // 4. Audit log
        try {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'user_deleted',
            entity_type: 'user',
            entity_id: targetUserId,
            details: { deleted_by: user.email },
          });
        } catch (e) {
          console.error('[audit_log] Failed to write audit entry:', e);
        }

        return NextResponse.json({ success: true, message: 'User permanently deleted' });
      }

    }
  } catch (err: any) {
    console.error('Admin user action error:', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
// POST /api/admin/users - find a single user by email (for permissions page)
export async function POST(req: NextRequest) {
  const _g = await guardApi('members', 'view', req);
  if ('error' in _g) return _g.res;
  try {
    const authHeader = req.headers.get('authorization') || '';
    const { createClient: createAuthClient } = await import('@/lib/supabase/server');
    const authClient = await createAuthClient();
    const { data: { user: caller } } = await authClient.auth.getUser();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const callerData = await getCaller(caller.id);
    if (!callerData || !userHasPermission(callerData.role, callerData.permissions, 'users.view')) {
      return NextResponse.json({ error: 'Forbidden: users.view required' }, { status: 403 });
    }

    const parsedFind = await parseJson(req, adminSchemas.findUser);
    if (!parsedFind.ok) return parsedFind.response;
    const target = parsedFind.data.email;

    // Search auth.users: covers users whose profiles.email is null
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUser = authList?.users?.find(u => u.email?.toLowerCase() === target);
    if (!authUser) return NextResponse.json({ user: null });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, permissions, banned')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!profile) return NextResponse.json({ user: null });

    return NextResponse.json({
      user: { ...profile, email: profile.email || authUser.email }
    });
  } catch (err: any) {
    console.error('[find-user]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
