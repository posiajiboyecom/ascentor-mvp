// app/api/experts/register/route.ts
// POST  — registers an authenticated user for an expert session and fires
//          an in-app notification (written to `notifications` table so the
//          existing real-time NotificationProvider picks it up instantly) plus
//          push / email fallback via lib/notify.
// DELETE — unregisters (no notification needed for unregister).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify, NotifyTemplates } from '@/lib/notify';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { sessionId } = body;
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  // ── Fetch session details ─────────────────────────────────────────────────
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('expert_sessions')
    .select('id, title, expert_name, scheduled_at')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // ── Insert registration ───────────────────────────────────────────────────
  const { error: regError } = await supabaseAdmin
    .from('session_registrations')
    .insert({ session_id: sessionId, user_id: user.id });

  if (regError) {
    if (regError.code === '23505') {
      // Already registered — not an error from the user's perspective
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }
    console.error('[experts/register] insert failed:', regError.message);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }

  // ── In-app notification (written with service role so RLS INSERT policy
  //    "Service role can insert notifications" passes) ──────────────────────
  const sessionDate = new Date(session.scheduled_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  await supabaseAdmin.from('notifications').insert({
    user_id: user.id,
    type: 'expert',
    title: "You're registered!",
    message: `${session.title} with ${session.expert_name} · ${sessionDate}`,
    link: '/experts',
    read: false,
  });

  // ── Push / email fallback (non-fatal) ────────────────────────────────────
  notify(user.id, {
    title: "You're registered!",
    body: `${session.title} with ${session.expert_name} · ${sessionDate}`,
    url: '/experts',
    tag: `session-reg-${sessionId}`,
    emailSubject: `Registered: ${session.title}`,
  }).catch((err) => console.warn('[experts/register] notify non-fatal:', err?.message));

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { sessionId } = body;
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('session_registrations')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[experts/register] delete failed:', error.message);
    return NextResponse.json({ error: 'Unregister failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
