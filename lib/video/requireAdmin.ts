// lib/video/requireAdmin.ts
// Shared admin gate for the /api/admin/videos routes. Same rule as the
// rest of /api/admin: signed in, and profiles.role = 'admin'.

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const auth = await createAuthClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return { userId: user.id };
}
