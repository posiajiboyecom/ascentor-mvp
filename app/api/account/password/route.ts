// POST /api/account/password
// Change password from the settings page (signed in, email + password accounts only).
//   * the CURRENT password must be re-entered and is verified on a throwaway client, so a stolen
//     session alone cannot change it
//   * the new password goes through the same policy as sign-up (length, mix, breached-password check)
//   * the user's OWN session stays valid; every other device is signed out
//   * the owner gets a "your password was changed" email
// Rate limited per user.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { sendPasswordChangedEmail } from '@/lib/email';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'You are not signed in.', code: 'unauthorized' }, { status: 401 });

  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string];
  if (!providers.includes('email')) {
    return NextResponse.json(
      { error: 'Your account signs in with a provider such as Google, so it has no password to change here.', code: 'use_oauth' },
      { status: 400 },
    );
  }

  const limit = await rateLimit(user.id, LIMITS.passwordChangeUser);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const parsed = await parseJson(req, authSchemas.changePassword);
  if (!parsed.ok) return parsed.response;
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Your new password must be different from your current one.', code: 'same_password' }, { status: 400 });
  }

  // Verify the current password on a client that stores no session (our own session is untouched).
  const verifier = createAnonClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (verifyError) {
    return NextResponse.json({ error: 'Your current password is incorrect.', code: 'wrong_password' }, { status: 400 });
  }

  const policy = await validatePassword(newPassword);
  if (!policy.ok) return NextResponse.json({ error: policy.error, code: 'weak_password' }, { status: 400 });

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    console.error('[account/password] update failed:', updateError.message);
    return NextResponse.json({ error: 'We could not update your password. Please try again.', code: 'server_error' }, { status: 500 });
  }

  // Keep this device signed in; end every other session (a changed password should lock out old logins).
  const { error: othersError } = await supabase.auth.signOut({ scope: 'others' });
  if (othersError) console.warn('[account/password] could not end other sessions:', othersError.message);

  try {
    await sendPasswordChangedEmail({ to: user.email, firstName: (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] || 'there' });
  } catch (mailErr) {
    console.error('[account/password] notice email failed:', mailErr);
  }

  return NextResponse.json({ ok: true, message: 'Password updated. Other devices have been signed out.' });
}
