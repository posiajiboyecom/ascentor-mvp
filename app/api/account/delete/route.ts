// POST /api/account/delete
// Permanently deletes the signed-in member's account and personal data.
//
// Guards, in order:
//   * must be signed in; rate limited per user
//   * the member types DELETE; email accounts also re-enter their password (verified on a throwaway client)
//   * refuses while a paid subscription is active (it would keep billing: cancel in Plan first)
//   * refuses for staff accounts and partner owners (another administrator must close those)
// Then: removes the avatar, deletes Summit registrations tied to the account, writes an audit entry, deletes
// the auth user (every table that references it cascades: profile, goals, commitments, coaching sessions,
// messages, notifications, push subscriptions, progress, referrals, payments), emails a confirmation,
// and clears the session cookie.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { sendAccountDeletedEmail } from '@/lib/email';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'You are not signed in.', code: 'unauthorized' }, { status: 401 });

  const limit = await rateLimit(user.id, LIMITS.accountDeleteUser);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const parsed = await parseJson(req, authSchemas.deleteAccount);
  if (!parsed.ok) return parsed.response;
  const { password } = parsed.data;

  // Email accounts must prove they know the password (a stolen session alone cannot delete the account).
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string];
  if (providers.includes('email')) {
    if (!password) return NextResponse.json({ error: 'Enter your password to delete your account.', code: 'password_required' }, { status: 400 });
    const verifier = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password });
    if (verifyError) return NextResponse.json({ error: 'That password is not correct.', code: 'wrong_password' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, full_name, subscription_status, subscription_end')
    .eq('id', user.id)
    .maybeSingle();

  if (profile && ['admin', 'moderator'].includes(profile.role)) {
    return NextResponse.json({ error: 'Staff accounts have to be removed by another administrator.', code: 'staff_account' }, { status: 403 });
  }

  const subscriptionLive =
    ['active', 'trialing'].includes(profile?.subscription_status ?? '') &&
    (!profile?.subscription_end || new Date(profile.subscription_end) > new Date());
  if (subscriptionLive) {
    return NextResponse.json(
      { error: 'You have an active subscription. Cancel it under Settings, Billing first, then delete your account, so you are not charged again.', code: 'subscription_active' },
      { status: 409 },
    );
  }

  const { count: ownedPartners } = await supabaseAdmin.from('partners').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
  if ((ownedPartners ?? 0) > 0) {
    return NextResponse.json({ error: 'This account owns a partner platform. Contact support to transfer or close it first.', code: 'owns_partner' }, { status: 409 });
  }

  // Best-effort clean-up of things that do not cascade.
  try {
    const { data: files } = await supabaseAdmin.storage.from('avatars').list('avatars', { search: user.id });
    const mine = (files ?? []).filter((f) => f.name.startsWith(user.id)).map((f) => `avatars/${f.name}`);
    if (mine.length) await supabaseAdmin.storage.from('avatars').remove(mine);
  } catch (err) {
    console.warn('[account/delete] avatar clean-up skipped:', err);
  }
  await supabaseAdmin.from('summit_registrations').delete().eq('user_id', user.id);

  await supabaseAdmin.from('audit_logs').insert({
    user_id: null,
    action: 'account_deleted',
    entity_type: 'user',
    entity_id: user.id,
    details: { by: 'self_service', deleted_at: new Date().toISOString() },
  });

  const email = user.email;
  const firstName = (profile?.full_name ?? '').trim().split(/\s+/)[0] || 'there';

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('[account/delete] deleteUser failed:', deleteError.message);
    return NextResponse.json(
      { error: 'We could not delete your account automatically. Nothing was removed. Please contact support and we will do it for you.', code: 'delete_failed' },
      { status: 500 },
    );
  }

  try {
    await sendAccountDeletedEmail({ to: email, firstName });
  } catch (err) {
    console.error('[account/delete] confirmation email failed:', err);
  }

  try { await supabase.auth.signOut(); } catch { /* the user no longer exists; cookies are cleared client-side too */ }

  return NextResponse.json({ ok: true });
}
