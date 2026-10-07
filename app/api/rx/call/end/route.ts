// app/api/rx/call/end/route.ts
// POST { circleId, kind } -> { ok }   The facilitator (Circle call) or the mentor (mentor session) ends the call for everyone.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deleteRoom } from '@/lib/rx/calls';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  let b: { circleId?: string; kind?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  if (!b.circleId || !UUID.test(b.circleId)) return NextResponse.json({ error: 'Unknown Circle.' }, { status: 400 });

  if (b.kind === 'mentor') {
    const { data: cm } = await supabaseAdmin.from('circle_mentors').select('id, human_mentors!inner(user_id)').eq('circle_id', b.circleId).eq('human_mentors.user_id', user.id).in('status', ['active', 'scheduling', 'paused']).maybeSingle();
    if (!cm) return NextResponse.json({ error: 'Only the mentor can end this call.' }, { status: 403 });
    await deleteRoom(`circle-${b.circleId}-mentor`);
  } else {
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('role').eq('circle_id', b.circleId).eq('user_id', user.id).maybeSingle();
    if (seat?.role !== 'facilitator') return NextResponse.json({ error: 'Only the facilitator can end this call.' }, { status: 403 });
    await deleteRoom(`circle-${b.circleId}`);
  }
  return NextResponse.json({ ok: true });
}
