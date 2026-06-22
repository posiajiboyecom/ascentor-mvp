// app/api/admin/community-messages/route.ts
// Admin-only: list, delete, and flag community messages
// Uses service role to bypass RLS

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

// GET /api/admin/community-messages?channel=general&flagged=true&limit=100
export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser(req.headers.get('authorization'));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel');
    const flaggedOnly = searchParams.get('flagged') === 'true';
    const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);

    let query = supabaseAdmin
      .from('community_messages')
      .select('id, user_id, channel, content, flagged, deleted, created_at')
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (channel) query = query.eq('channel', channel);
    if (flaggedOnly) query = query.eq('flagged', true);

    const { data: messages, error } = await query;
    if (error) throw error;

    // Enrich with author names
    const userIds = [...new Set((messages || []).map((m: any) => m.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id, full_name').in('id', userIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p.full_name || 'Unknown'; });

    const enriched = (messages || []).map((m: any) => ({
      ...m,
      author_name: profileMap[m.user_id] || 'Unknown',
    }));

    // Stats
    const { count: totalCount } = await supabaseAdmin
      .from('community_messages')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false);

    const { count: flaggedCount } = await supabaseAdmin
      .from('community_messages')
      .select('id', { count: 'exact', head: true })
      .eq('flagged', true).eq('deleted', false);

    return NextResponse.json({ messages: enriched, totalCount, flaggedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/admin/community-messages — delete or flag message(s)
// Body: { id, action } for a single message, OR
//       { ids: string[], action } for bulk (action must be 'delete' for bulk)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAdminUser(req.headers.get('authorization'));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, ids, action } = body as { id?: string; ids?: string[]; action?: string };

    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    // Bulk path — only used for delete from the admin UI's multi-select.
    // Flag/unflag stay single-id (no bulk UI need identified for those).
    if (Array.isArray(ids)) {
      if (ids.length === 0 || !ids.every(x => typeof x === 'string')) {
        return NextResponse.json({ error: 'ids must be a non-empty array of strings' }, { status: 400 });
      }
      if (ids.length > 500) {
        return NextResponse.json({ error: 'Cannot act on more than 500 messages in one request' }, { status: 400 });
      }
      if (action !== 'delete') {
        return NextResponse.json({ error: 'Bulk action only supports delete' }, { status: 400 });
      }
      const { error, count } = await supabaseAdmin
        .from('community_messages')
        .update({ deleted: true }, { count: 'exact' })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ ok: true, deleted: count ?? ids.length });
    }

    // Single-id path — original behavior, unchanged.
    if (!id) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });

    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('community_messages').update({ deleted: true }).eq('id', id);
      if (error) throw error;
    } else if (action === 'flag') {
      const { error } = await supabaseAdmin
        .from('community_messages').update({ flagged: true }).eq('id', id);
      if (error) throw error;
    } else if (action === 'unflag') {
      const { error } = await supabaseAdmin
        .from('community_messages').update({ flagged: false }).eq('id', id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
