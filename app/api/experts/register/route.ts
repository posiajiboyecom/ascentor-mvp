// app/api/experts/register/route.ts
// POST  - registers an authenticated user for an expert session and fires
//          an in-app notification (written to `notifications` table so the
//          existing real-time NotificationProvider picks it up instantly) plus
//          push / email fallback via lib/notify.
// DELETE - unregisters (no notification needed for unregister).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify, NotifyTemplates } from '@/lib/notify';
import { parseJson, parseQuery } from '@/lib/validation/http';
import * as memberSchemas from '@/lib/validation/schemas/member';
import { effectivePlanForUser } from '@/lib/access';
import { canAccess, normalisePlan, TIER_META } from '@/lib/planTier';
import { PLAN_LIMITS } from '@/lib/session-limits';
import { seatProblem } from '@/lib/expert-seats';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Body (strict) ─────────────────────────────────────────────────────────
  const parsed = await parseJson(req, memberSchemas.expertSessionRef);
  if (!parsed.ok) return parsed.response;
  const { sessionId } = parsed.data;

  // ── Fetch session details ─────────────────────────────────────────────────
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('expert_sessions')
    .select('id, title, expert_name, scheduled_at, status, plan_tier, is_free, max_attendees, max_participants')
    .eq('id', sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // ── Rules (server-side): plan gate, monthly cap, held seats for Pinnacle (lib/expert-seats.ts) ──
  const { data: already } = await supabaseAdmin.from('session_registrations').select('id').eq('session_id', sessionId).eq('user_id', user.id).maybeSingle();
  if (already) return NextResponse.json({ ok: true, alreadyRegistered: true });
  if (session.status !== 'scheduled' && session.status !== 'live') return NextResponse.json({ error: 'This session is no longer open.' }, { status: 400 });

  const { data: prof } = await supabaseAdmin.from('profiles').select('subscription_plan, subscription_status, subscription_end').eq('id', user.id).maybeSingle();
  const plan = await effectivePlanForUser(user.id, prof);
  const isFreeSession = !!session.is_free || !session.plan_tier || session.plan_tier === 'free';
  if (!isFreeSession && !canAccess(plan, session.plan_tier as string)) {
    return NextResponse.json({ error: `This session is for the ${TIER_META[normalisePlan(session.plan_tier as string)].label} plan and above.` }, { status: 403 });
  }
  if (!isFreeSession) {
    const cap = PLAN_LIMITS[plan]?.expertSessions ?? 0;
    if (cap !== -1) {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const { data: regs } = await supabaseAdmin.from('session_registrations').select('session_id, expert_sessions!inner(is_free, plan_tier)').eq('user_id', user.id).gte('created_at', monthStart.toISOString());
      const used = ((regs ?? []) as unknown as { expert_sessions: { is_free: boolean | null; plan_tier: string | null } }[])
        .filter((r) => !r.expert_sessions.is_free && r.expert_sessions.plan_tier && r.expert_sessions.plan_tier !== 'free').length;
      if (used >= cap) {
        return NextResponse.json({ error: cap === 0 ? 'Live expert sessions are part of the paid plans.' : `You’ve used your ${cap} expert ${cap === 1 ? 'session' : 'sessions'} for this month. ${plan === 'pinnacle' ? '' : 'Pinnacle includes four a month.'}`.trim() }, { status: 403 });
      }
    }
  }
  const capacity = (session.max_attendees ?? session.max_participants) as number | null;
  if (capacity) {
    const { count: taken } = await supabaseAdmin.from('session_registrations').select('id', { count: 'exact', head: true }).eq('session_id', sessionId);
    const seat = seatProblem({ capacity, taken: taken ?? 0, isPinnacle: plan === 'pinnacle', startsAt: new Date(session.scheduled_at as string), now: new Date() });
    if (seat) return NextResponse.json({ error: seat }, { status: 409 });
  }

  // ── Insert registration ───────────────────────────────────────────────────
  const { error: regError } = await supabaseAdmin
    .from('session_registrations')
    .insert({ session_id: sessionId, user_id: user.id });

  if (regError) {
    if (regError.code === '23505') {
      // Already registered - not an error from the user's perspective
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

  // ── Body (strict) ─────────────────────────────────────────────────────────
  const parsed = await parseJson(req, memberSchemas.expertSessionRef);
  if (!parsed.ok) return parsed.response;
  const { sessionId } = parsed.data;

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
