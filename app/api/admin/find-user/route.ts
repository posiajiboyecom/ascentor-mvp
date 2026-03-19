import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await authClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  // Search auth.users via service role — works even if profiles.email is null
  const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 });
  const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);

  if (!authUser) return NextResponse.json({ user: null });

  const { data: profile } = await service
    .from('profiles')
    .select('id, full_name, email, role, permissions')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: { ...profile, email: profile.email || authUser.email }
  });
}
