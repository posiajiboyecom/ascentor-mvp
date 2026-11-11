// app/api/rx/call/attendance/route.ts
// POST { event: 'join', circleId, kind } -> { id }      POST { event: 'leave', id } -> { ok }
// Records minutes in a call (never content) so the monthly Daily allowance can be watched.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  let b: { event?: string; circleId?: string; kind?: string; id?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }

  if (b.event === 'join' && b.kind === 'private') {
    // circleId carries the private session id. Only its member or mentor can record minutes.
    if (!b.circleId || !UUID.test(b.circleId)) return NextResponse.json({ error: 'Unknown session.' }, { status: 400 });
    const { data: s } = await supabaseAdmin.from('private_mentor_sessions').select('member_id, human_mentors(user_id)').eq('id', b.circleId).maybeSingle();
    const mentorUser = (s?.human_mentors as unknown as { user_id: string | null } | null)?.user_id ?? null;
    if (!s || (s.member_id !== user.id && mentorUser !== user.id)) return NextResponse.json({ error: 'Not in this session.' }, { status: 403 });
    const { data, error } = await supabaseAdmin.from('call_attendance').insert({ private_session_id: b.circleId, kind: 'private', user_id: user.id }).select('id').single();
    if (error) return NextResponse.json({ error: 'Could not record.' }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }
  if (b.event === 'join') {
    if (!b.circleId || !UUID.test(b.circleId)) return NextResponse.json({ error: 'Unknown Circle.' }, { status: 400 });
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', b.circleId).eq('user_id', user.id).maybeSingle();
    if (!seat && b.kind !== 'mentor') return NextResponse.json({ error: 'Not a member.' }, { status: 403 });
    const { data, error } = await supabaseAdmin.from('call_attendance').insert({ circle_id: b.circleId, kind: b.kind === 'mentor' ? 'mentor' : 'circle', user_id: user.id }).select('id').single();
    if (error) return NextResponse.json({ error: 'Could not record.' }, { status: 500 });
    return NextResponse.json({ id: data.id });
  }
  if (b.event === 'leave' && b.id && UUID.test(b.id)) {
    const { data: row } = await supabaseAdmin.from('call_attendance').select('joined_at, left_at, user_id').eq('id', b.id).maybeSingle();
    if (!row || row.user_id !== user.id || row.left_at) return NextResponse.json({ ok: true });
    const minutes = Math.max(0, (Date.now() - new Date(row.joined_at as string).getTime()) / 60000);
    await supabaseAdmin.from('call_attendance').update({ left_at: new Date().toISOString(), minutes: Math.round(minutes * 100) / 100 }).eq('id', b.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
}
