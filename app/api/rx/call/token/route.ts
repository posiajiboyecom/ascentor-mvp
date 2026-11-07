// app/api/rx/call/token/route.ts
// POST { circleId, kind: 'circle' | 'mentor', sessionId?, takeover? } -> { state, ... }
// state 'elsewhere': this account is already in the call on another device (send takeover: true to move it here).
// Checks that the caller belongs to this Circle (or is its mentor), that the call window is open, then returns a Daily
// meeting token that ends exactly when the call is scheduled to end. Members cannot get a token for another Circle.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { featureBlock } from '@/lib/access';
import { callsConfigured, circleWindow, createToken, ejectUser, ensureRoom, inRoomElsewhere, mentorWindow, type CallWindow } from '@/lib/rx/calls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ state: 'error', error: 'Please sign in again.' }, { status: 401 });

  let body: { circleId?: string; kind?: string; sessionId?: string; takeover?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ state: 'error', error: 'Bad request.' }, { status: 400 }); }
  const circleId = body.circleId ?? '';
  const kind = body.kind === 'mentor' ? 'mentor' : 'circle';
  if (!UUID.test(circleId)) return NextResponse.json({ state: 'error', error: 'Unknown Circle.' }, { status: 400 });
  if (!callsConfigured()) return NextResponse.json({ state: 'unavailable' });

  const { data: circle } = await supabaseAdmin.from('circles').select('id, name, number, status, cycle_start, meeting_dow, meeting_time, timezone, facilitator_id, demo_call_until').eq('id', circleId).maybeSingle();
  if (!circle) return NextResponse.json({ state: 'error', error: 'Unknown Circle.' }, { status: 404 });

  // Membership: a seat in the Circle, or (for mentor sessions) being its mentor.
  const { data: seat } = await supabaseAdmin.from('circle_seats').select('role').eq('circle_id', circleId).eq('user_id', user.id).maybeSingle();
  let isMentor = false;
  if (kind === 'mentor') {
    const { data: cm } = await supabaseAdmin.from('circle_mentors').select('id, human_mentors!inner(user_id)').eq('circle_id', circleId).in('status', ['active', 'scheduling', 'paused']).eq('human_mentors.user_id', user.id).maybeSingle();
    isMentor = !!cm;
  }
  if (!seat && !isMentor) return NextResponse.json({ state: 'error', error: 'This call is for the members of this Circle.' }, { status: 403 });
  // Billing v2: a lapsed member (light access) drops out of Circle and mentor calls until they reactivate. Mentors are never blocked here.
  if (!isMentor) {
    const paused = await featureBlock(user.id, kind === 'mentor' ? 'mentorSessions' : 'circleChat');
    if (paused) return NextResponse.json({ state: 'error', error: paused }, { status: 403 });
  }

  let win: CallWindow;
  let roomName: string;
  let isOwner = false;

  if (kind === 'circle') {
    if (!seat) return NextResponse.json({ state: 'error', error: 'This call is for the members of this Circle.' }, { status: 403 });
    // A demo Circle can have its call opened by staff for a while, so the call can be tried any time.
    const demoUntil = circle.demo_call_until ? new Date(circle.demo_call_until as string) : null;
    if (demoUntil && demoUntil.getTime() > Date.now()) {
      const now = Date.now();
      win = { kind: 'circle', title: `${circle.name} · Circle ${circle.number} call (demo)`, startsAt: new Date(now - 60000), opensAt: new Date(now - 300000), endsAt: demoUntil, state: 'open' };
    } else {
      if (circle.status !== 'active' || !circle.cycle_start) return NextResponse.json({ state: 'notstarted' });
      win = circleWindow(circle as { name: string; number: number; meeting_dow: number; meeting_time: string; timezone: string | null });
    }
    roomName = `circle-${circleId}`;
    isOwner = seat.role === 'facilitator';
  } else {
    const sid = body.sessionId ?? '';
    if (!UUID.test(sid)) return NextResponse.json({ state: 'error', error: 'Choose a session.' }, { status: 400 });
    const { data: s } = await supabaseAdmin.from('circle_mentor_sessions').select('id, starts_at, duration_min, status, circle_id').eq('id', sid).eq('circle_id', circleId).maybeSingle();
    if (!s || s.status === 'cancelled') return NextResponse.json({ state: 'error', error: 'That session is not available.' }, { status: 404 });
    win = mentorWindow(`${circle.name} · Circle ${circle.number} mentor session`, s.starts_at as string, s.duration_min as number);
    roomName = `circle-${circleId}-mentor`;
    isOwner = isMentor;
  }

  const common = { title: win.title, circleName: circle.name as string, circleNumber: circle.number as number, startsAt: win.startsAt.toISOString(), opensAt: win.opensAt.toISOString(), endsAt: win.endsAt.toISOString() };
  if (win.state === 'waiting') return NextResponse.json({ state: 'waiting', ...common });
  if (win.state === 'ended') return NextResponse.json({ state: 'ended', ...common });

  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const room = await ensureRoom(roomName);
    // One device per account in a call. If this account is already in the room, ask first; when the member chooses
    // to move the call here, the other device is removed before this one joins.
    if (await inRoomElsewhere(room.name, user.id)) {
      if (!body.takeover) return NextResponse.json({ state: 'elsewhere', ...common });
      await ejectUser(room.name, user.id);
    }
    const token = await createToken({ room: room.name, userId: user.id, userName: ((prof?.full_name as string | undefined) ?? 'Member').split(/\s+/)[0], isOwner, notBefore: win.opensAt, expires: new Date(win.endsAt.getTime() + 60000) });
    return NextResponse.json({ state: 'open', url: room.url, token, isOwner, roomName, ...common });
  } catch (e) {
    console.error('[rx/call/token] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ state: 'unavailable' });
  }
}
