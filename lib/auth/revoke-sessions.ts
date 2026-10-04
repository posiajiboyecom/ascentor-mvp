// lib/auth/revoke-sessions.ts
// Signs a user out of EVERY device. supabase-js's admin.signOut() takes a
// user's access token (not their id), so we mint a short-lived session with
// the credentials we were just given and revoke it with scope "global".
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function revokeAllSessions(email: string, password: string): Promise<boolean> {
  try {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    const { error: outErr } = await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'global');
    return !outErr;
  } catch (err) {
    console.error('[revoke-sessions] failed:', err);
    return false;
  }
}
