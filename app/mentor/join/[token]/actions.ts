'use server';

// Joining from a personal mentor link (app/mentor/join/[token]). A new person sets a password and their mentor profile in one
// step and is signed in; someone who already has an account with the invited email accepts while signed in.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/rate-limit';
import { LIMITS, rateLimit } from '@/lib/auth/rate-limit-shared';
import { validatePassword } from '@/lib/auth/password-policy';
import { acceptAsExistingUser, joinAsNewMentor, type MentorProfileInput } from '@/lib/mentor-invites';
import { splitList } from '@/lib/mentor-invite-core';

export interface JoinState { error?: string; exists?: boolean }

const REASON: Record<string, string> = {
  invalid: 'This link is not valid. Ask the Ascentor team for a new one.',
  unavailable: 'This link has already been used, has expired or was cancelled. Ask the Ascentor team for a new one.',
  mismatch: 'This link was made for a different email address than the account you are signed in with.',
  exists: 'You already have an Ascentor account with this email. Log in to finish joining as a mentor.',
  error: 'We could not finish that just now. Please try again.',
};

function readProfile(f: FormData): MentorProfileInput | string {
  const fullName = String(f.get('fullName') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const headline = String(f.get('headline') ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const expertise = splitList(String(f.get('expertise') ?? ''));
  const langs = splitList(String(f.get('langs') ?? ''), 6, 30);
  const bio = String(f.get('bio') ?? '').trim().slice(0, 1200);
  if (fullName.length < 2) return 'Enter your full name.';
  if (headline.length < 3) return 'Add a one-line headline, for example “Product lead in fintech”.';
  if (!expertise.length) return 'Add at least one area you can help with.';
  return { fullName, headline, expertise, langs, bio };
}

export async function joinNew(_prev: JoinState, f: FormData): Promise<JoinState> {
  const token = String(f.get('token') ?? '');
  const h = await headers();
  const limit = await rateLimit(getClientIp({ headers: h } as unknown as Request), LIMITS.signupIp);
  if (!limit.allowed) return { error: 'Too many attempts. Please try again later.' };

  const profile = readProfile(f);
  if (typeof profile === 'string') return { error: profile };
  const password = String(f.get('password') ?? '');
  if (password !== String(f.get('confirm') ?? '')) return { error: 'The two passwords do not match.' };
  const policy = await validatePassword(password);
  if (!policy.ok) return { error: policy.error };

  const r = await joinAsNewMentor(token, password, profile);
  if (!r.ok) return { error: REASON[r.reason], exists: r.reason === 'exists' };

  let signedIn = false;
  try {
    const { error } = await (await createClient()).auth.signInWithPassword({ email: r.email, password });
    signedIn = !error;
  } catch { /* they can sign in themselves */ }
  redirect(signedIn ? '/sessions/mentoring?welcome=1' : '/login?redirect=%2Fsessions%2Fmentoring');
}

export async function joinExisting(_prev: JoinState, f: FormData): Promise<JoinState> {
  const token = String(f.get('token') ?? '');
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/mentor/join/${token}`)}`);
  const profile = readProfile(f);
  if (typeof profile === 'string') return { error: profile };
  const r = await acceptAsExistingUser(token, { id: user.id, email: user.email }, profile);
  if (!r.ok) return { error: REASON[r.reason] };
  redirect('/sessions/mentoring?welcome=1');
}
