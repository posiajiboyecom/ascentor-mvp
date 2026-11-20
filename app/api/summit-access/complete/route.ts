// POST /api/summit-access/complete  { token, fullName, password } -> { ok, until, next }
// Step 3: the email was proven in step 2 (token). Creates the account with the chosen password (already confirmed),
// adds the free year, and signs the person in. They continue to onboarding.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { findAccountByEmail } from '@/lib/auth/account-lookup';
import { claimGrant, findGrant, readClaimToken } from '@/lib/summit-access';
import { parseJson } from '@/lib/validation/http';
import * as authSchemas from '@/lib/validation/schemas/auth';

const EXPIRED = NextResponse.json({ error: 'This step has expired. Please start again and we’ll send a new code.', code: 'expired' }, { status: 400 });

export async function POST(req: NextRequest) {
  const parsed = await parseJson(req, authSchemas.summitAccessComplete);
  if (!parsed.ok) return parsed.response;
  const limit = await rateLimit(getClientIp(req), LIMITS.signupIp);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Please try again later.', code: 'rate_limited' }, { status: 429 });

  const email = readClaimToken(parsed.data.token);
  if (!email) return EXPIRED;
  const { fullName, password } = parsed.data;
  const policy = await validatePassword(password);
  if (!policy.ok) return NextResponse.json({ error: policy.error, code: 'weak_password' }, { status: 400 });

  try {
    const grant = await findGrant(email);
    if (!grant) return NextResponse.json({ error: 'This email isn’t on the Summit list.', code: 'not_listed' }, { status: 404 });
    if (grant.claimed_user_id) return NextResponse.json({ error: 'This email has already claimed its free year. Sign in to use Ascentor.', code: 'claimed' }, { status: 409 });

    // Create the account, or finish one an earlier sign-up left unconfirmed. Either way the email is proven.
    let userId: string;
    const account = await findAccountByEmail(email);
    if (account?.emailConfirmed) {
      return NextResponse.json({ error: 'This email already has an Ascentor account. Start again and we’ll add the free year to it.', code: 'exists' }, { status: 409 });
    } else if (account) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(account.id, { password, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error) throw error;
      userId = account.id;
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error || !data.user) throw error ?? new Error('no user');
      userId = data.user.id;
    }

    const r = await claimGrant(email, userId);
    if (!r.ok) return NextResponse.json({ error: 'This email has already claimed its free year.', code: 'claimed' }, { status: 409 });

    // Sign them in on this device (sets the session cookies), so they go straight to setting up.
    let signedIn = false;
    try {
      const db = await createClient();
      const { error } = await db.auth.signInWithPassword({ email, password });
      signedIn = !error;
    } catch { /* they can sign in themselves */ }
    return NextResponse.json({ ok: true, until: r.until, next: signedIn ? '/onboarding' : '/login' });
  } catch (e) {
    console.error('[summit-access/complete]', (e as Error).message);
    return NextResponse.json({ error: 'We couldn’t create your account just now. Please try again.', code: 'server_error' }, { status: 500 });
  }
}
