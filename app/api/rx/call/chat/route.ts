// app/api/rx/call/chat/route.ts
// POST { id, kind: 'circle' | 'mentor' | 'private', circleId, sessionId?, text, name } -> { ok }
// Saves one in-call chat message from its sender, so call chat is kept with every other chat and can be read in admin.
// The same membership rules as joining the call apply. The message id comes from the sender, so a retry never duplicates.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { circleCallId } from '@/lib/rx/call-chat-id';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 500;

async function isCircleMentor(userId: string, circleId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('circle_mentors').select('id, human_mentors!inner(user_id)')
    .eq('circle_id', circleId).eq('human_mentors.user_id', userId).limit(1);
  return !!data?.length;
}

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  let b: { id?: string; kind?: string; circleId?: string; sessionId?: string | null; text?: string; name?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, MAX) : '';
  if (!b.id || !UUID.test(b.id) || !text) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';

  let row: { call_id: string; kind: string; circle_id: string | null; mentor_session_id: string | null; private_session_id: string | null };

  if (b.kind === 'private') {
    const sid = b.sessionId ?? b.circleId ?? '';
    if (!UUID.test(sid)) return NextResponse.json({ error: 'Unknown session.' }, { status: 400 });
    const { data: s } = await supabaseAdmin.from('private_mentor_sessions').select('member_id, human_mentors(user_id)').eq('id', sid).maybeSingle();
    const mentorUser = (s?.human_mentors as unknown as { user_id: string | null } | null)?.user_id ?? null;
    if (!s || (s.member_id !== user.id && mentorUser !== user.id)) return NextResponse.json({ error: 'Not in this session.' }, { status: 403 });
    row = { call_id: sid, kind: 'private', circle_id: null, mentor_session_id: null, private_session_id: sid };
  } else if (b.kind === 'mentor') {
    if (!b.circleId || !UUID.test(b.circleId) || !b.sessionId || !UUID.test(b.sessionId)) return NextResponse.json({ error: 'Unknown session.' }, { status: 400 });
    const { data: s } = await supabaseAdmin.from('circle_mentor_sessions').select('id').eq('id', b.sessionId).eq('circle_id', b.circleId).maybeSingle();
    if (!s) return NextResponse.json({ error: 'Unknown session.' }, { status: 400 });
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', b.circleId).eq('user_id', user.id).maybeSingle();
    if (!seat && !(await isCircleMentor(user.id, b.circleId))) return NextResponse.json({ error: 'Not in this session.' }, { status: 403 });
    row = { call_id: b.sessionId, kind: 'mentor', circle_id: b.circleId, mentor_session_id: b.sessionId, private_session_id: null };
  } else {
    if (!b.circleId || !UUID.test(b.circleId)) return NextResponse.json({ error: 'Unknown Circle.' }, { status: 400 });
    const { data: seat } = await supabaseAdmin.from('circle_seats').select('user_id').eq('circle_id', b.circleId).eq('user_id', user.id).maybeSingle();
    if (!seat) return NextResponse.json({ error: 'Not a member.' }, { status: 403 });
    row = { call_id: circleCallId(b.circleId), kind: 'circle', circle_id: b.circleId, mentor_session_id: null, private_session_id: null };
  }

  const { error } = await supabaseAdmin.from('call_chat_messages')
    .upsert({ client_id: b.id, ...row, user_id: user.id, sender_name: name, body: text }, { onConflict: 'client_id', ignoreDuplicates: true });
  if (error) {
    console.error('[call/chat] save failed', error.message);
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
