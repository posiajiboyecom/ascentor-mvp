import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function shopAdmin(): Promise<{ id: string; role: string } | null> {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  return data && ['admin', 'moderator'].includes(data.role) ? { id: user.id, role: data.role } : null;
}

export const forbidden = () => NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

/** Missing table or column: the shop migration has not been run yet. */
export function migrationMissing(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(err.code || '') || /does not exist|schema cache/i.test(err.message || '');
}

export const MIGRATION_NOTICE = 'The shop tables are not set up yet. Run the shop migration (20261020_shop.sql) first.';
