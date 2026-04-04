// FILE: app/api/admin/users/route.ts
// 'delete' action already implemented — no changes needed.
// Cleans up: coaching_sessions, cohort_members, cohort_posts, cohort_replies,
// cohort_votes, notifications, push_subscriptions, referrals,
// session_registrations, goal_entries, then profiles, then auth.users.
// Self-delete is blocked. Action is audit-logged.

// ============================================================
// ADMIN USERS API — /api/admin/users
// GET: list all users with search/filter
// PATCH: update role, ban/unban
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify admin
async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return data?.role === 'admin';
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('profiles')
      .select('id, full_name, email, role, subscription_plan, subscription_status, subscription_end, created_at, referral_code, referral_count, avatar_url, current_role, industry', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,referral_code.ilike.%${search}%`);
    }
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('subscription_status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    // Get banned users from auth metadata
    const enhancedData = await Promise.all(
      (data || []).map(async (profile: any) => {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
          return {
            ...profile,
            banned: authUser?.user?.banned_until ? new Date(authUser.user.banned_until) > new Date() : false,
            last_sign_in: authUser?.user?.last_sign_in_at,
            email: authUser?.user?.email || profile.email,
          };
        } catch {
          return { ...profile, banned: false };
        }
      })
    );

    return NextResponse.json({ users: enhancedData, total: count, page, limit });
  } catch (err: any) {
    console.error('Admin users list error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user || !(await isAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { targetUserId, action, value } = await req.json();
    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing targetUserId or action' }, { status: 400 });
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
          // Silently ignore audit log failures
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
          // Silently ignore audit log failures
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
          // Silently ignore audit log failures
        }

        return NextResponse.json({ success: true, message: 'User unbanned' });
      }

      case 'change_plan': {
        const subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
        await supabase.from('profiles').update({
          subscription_plan: value,
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', targetUserId);

        return NextResponse.json({ success: true, message: `Plan updated to ${value}` });
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
            // Table may not exist or column may differ — continue
          }
        }

        // 2. Delete the profile row
        await supabase.from('profiles').delete().eq('id', targetUserId);

        // 3. Delete from Supabase Auth — this is the critical step
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
        } catch { /* ignore */ }

        return NextResponse.json({ success: true, message: 'User permanently deleted' });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Admin user action error:', err);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
// POST /api/admin/users — find a single user by email (for permissions page)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const { createClient: createAuthClient } = await import('@/lib/supabase/server');
    const authClient = await createAuthClient();
    const { data: { user: caller } } = await authClient.auth.getUser();
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(caller.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const target = email.trim().toLowerCase();

    // Search auth.users — covers users whose profiles.email is null
    const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const authUser = authList?.users?.find(u => u.email?.toLowerCase() === target);
    if (!authUser) return NextResponse.json({ user: null });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, permissions')
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
