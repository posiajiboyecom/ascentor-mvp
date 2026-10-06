// lib/shell-data.ts
// Server-side data every page needs to render inside the member shell (sidebar, header, Sage):
// who is signed in, how to address them, their role and avatar, and whether they already hold an
// Elevation Summit registration. Used by the (app) layout and by /checkout, so a signed-in member
// sees the same shell wherever they are.

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ShellData {
  userId: string;
  userName: string;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
  summitRegistered: boolean;
}

export async function getShellData(): Promise<ShellData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Full query first; fall back to the original single column so a missing optional column can never
  // blank the whole app.
  let profile: { full_name: string | null; role?: string | null; avatar_url?: string | null } | null = null;
  const full = await supabase.from('profiles').select('full_name, role, avatar_url').eq('id', user.id).single();
  if (full.data) {
    profile = full.data;
  } else {
    const basic = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    profile = basic.data;
  }

  let summitRegistered = false;
  if (user.email) {
    const { count } = await supabaseAdmin
      .from('summit_registrations')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},email.eq.${user.email.toLowerCase()}`);
    summitRegistered = (count ?? 0) > 0;
  }

  return {
    userId: user.id,
    userName: profile?.full_name?.trim() || user.email?.split('@')[0] || 'there',
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role ?? null,
    summitRegistered,
  };
}
