// app/api/rx/call/agenda/route.ts
// POST { circleId, agendaId, index } -> { index, startedAt }
// The facilitator marks the current agenda item during a Circle call. Stored on the agenda so anyone who joins late
// lands on the same item; the facilitator's call also broadcasts it to everyone already in the room (sendAppMessage).

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let b: { circleId?: string; agendaId?: string; index?: number };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const index = Number(b.index);
  if (!b.circleId || !UUID.test(b.circleId) || !b.agendaId || !UUID.test(b.agendaId) || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }

  const { data: seat } = await supabaseAdmin.from('circle_seats').select('role').eq('circle_id', b.circleId).eq('user_id', user.id).maybeSingle();
  if (seat?.role !== 'facilitator') return NextResponse.json({ error: 'Only the facilitator can move the agenda.' }, { status: 403 });

  const { count } = await supabaseAdmin.from('agenda_items').select('id', { count: 'exact', head: true }).eq('agenda_id', b.agendaId);
  if (count != null && index >= count) return NextResponse.json({ error: 'That item is not on the agenda.' }, { status: 400 });

  const startedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('circle_agendas')
    .update({ current_item_index: index, current_item_started_at: startedAt })
    .eq('id', b.agendaId)
    .eq('circle_id', b.circleId)
    .select('id')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not update the agenda.' }, { status: 404 });
  return NextResponse.json({ index, startedAt });
}
