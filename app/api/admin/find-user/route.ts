import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // Auth + admin check
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await authClient
    .from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  // Paginate through all auth users to find by email
  let authUser = null;
  let page = 1;
  while (!authUser) {
    const { data: batch } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (!batch?.users?.length) break;
    authUser = batch.users.find(u => u.email?.toLowerCase() === email) || null;
    if (batch.users.length < 1000) break; // last page
    page++;
  }

  if (!authUser) return NextResponse.json({ user: null });

  // Get their profile
  const { data: profile } = await service
    .from('profiles')
    .select('id, full_name, email, role, permissions')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id:          profile.id,
      full_name:   profile.full_name,
      email:       profile.email || authUser.email,  // auth email as fallback
      role:        profile.role,
      permissions: profile.permissions,
    }
  });
}
