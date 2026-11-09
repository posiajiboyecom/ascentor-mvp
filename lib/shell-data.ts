// lib/shell-data.ts
// Server-side data every page needs to render inside the member shell (sidebar, header, Sage):
// who is signed in, how to address them, their role and avatar, and whether they already hold an
// Elevation Summit registration. Used by the (app) layout and by /checkout, so a signed-in member
// sees the same shell wherever they are.
//
// Cache strategy:
//   • Profile + role: cached 60 s, tagged `shell-{userId}` — revalidated on profile update
//   • Summit registration: cached 120 s, tagged `summit-reg-{userId}` — revalidated on registration

import { createClient } from '@/lib/supabase/server'; // used for auth.getUser() only — never inside unstable_cache
import { supabaseAdmin } from '@/lib/supabase/admin';
import { unstable_cache } from 'next/cache';

export interface ShellData {
  userId: string;
  userName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  summitRegistered: boolean;
}

/** Cached profile fetch — 60 s, per user.
 *  Uses supabaseAdmin (service role) so it never calls cookies() inside the cache,
 *  which would throw in Next.js 15/16 (dynamic APIs are forbidden inside unstable_cache). */
const getCachedProfile = (userId: string) =>
  unstable_cache(
    async () => {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('full_name, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      return data ?? null;
    },
    [`shell-profile-${userId}`],
    { revalidate: 60, tags: [`shell-${userId}`] }
  )();

/** Cached summit registration check — 120 s, per user */
const getCachedSummitReg = (userId: string, email: string) =>
  unstable_cache(
    async () => {
      const { count } = await supabaseAdmin
        .from('summit_registrations')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`);
      return (count ?? 0) > 0;
    },
    [`shell-summit-${userId}`],
    { revalidate: 120, tags: [`summit-reg-${userId}`] }
  )();

export async function getShellData(): Promise<ShellData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, summitRegistered] = await Promise.all([
    getCachedProfile(user.id),
    user.email ? getCachedSummitReg(user.id, user.email) : Promise.resolve(false),
  ]);

  return {
    userId: user.id,
    userName: profile?.full_name?.trim() || user.email?.split('@')[0] || 'there',
    email: user.email ?? null,
    avatarUrl: (profile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    role: (profile as { role?: string | null } | null)?.role ?? null,
    summitRegistered,
  };
}

/** Call this after a profile update to bust the shell cache for that user */
export async function revalidateShell(userId: string) {
  const { revalidateTag } = await import('next/cache');
  revalidateTag(`shell-${userId}`, 'default');
}

/** Call this after a summit registration to bust the registration cache */
export async function revalidateSummitReg(userId: string) {
  const { revalidateTag } = await import('next/cache');
  revalidateTag(`summit-reg-${userId}`, 'default');
}
