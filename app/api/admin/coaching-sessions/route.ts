// app/api/admin/coaching-sessions/route.ts
// Admin-only: hard-delete coaching_sessions (single or bulk).
// Uses service role to bypass RLS — same auth convention as
// app/api/admin/community-messages/route.ts.
//
// HARD DELETE: coaching_sessions has no `deleted` column (unlike
// community_messages, which soft-deletes), so this permanently
// removes rows via .delete(), not .update({ deleted: true }).
// No undo. Confirmed with Anifie before building — see chat log:
// "Hard delete — permanently removed from the database, no undo."

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminUser(authHeader: string | null) {
  if (!authHeader) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role === 'member') return null;
  return user;
}

// DELETE /api/admin/coaching-sessions
// Body: { ids: string[] }  — one or many session IDs, hard-deleted.
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAdminUser(req.headers.get('authorization'));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const ids: unknown = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: 'Cannot delete more than 500 sessions in one request' }, { status: 400 });
    }

    const { error, count } = await supabaseAdmin
      .from('coaching_sessions')
      .delete({ count: 'exact' })
      .in('id', ids);

    if (error) throw error;

    return NextResponse.json({ ok: true, deleted: count ?? ids.length });
  } catch (err: any) {
    console.error('[admin coaching-sessions DELETE]', err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}
