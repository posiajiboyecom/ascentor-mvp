import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import SignupClient from './SignupClient';

export const dynamic = 'force-dynamic';

/** Resolve the inviter for ?ref=<code>. Only a first name ever leaves the server. */
async function lookupInviter(raw: string | undefined): Promise<{ firstName: string; code: string } | null> {
  const code = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return null;
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('referral_code', code)
      .maybeSingle();
    const first = (data?.full_name ?? '').trim().split(/\s+/)[0];
    return first ? { firstName: first, code } : null;
  } catch {
    return null;
  }
}

export default async function SignUpPage({ searchParams }: { searchParams?: Promise<{ ref?: string }> }) {
  const { ref } = (await searchParams) ?? {};
  const inviter = await lookupInviter(ref);
  return (
    <Suspense>
      <SignupClient inviter={inviter} />
    </Suspense>
  );
}
