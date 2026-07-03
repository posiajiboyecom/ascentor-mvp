// app/api/coach/session/route.ts
// ============================================================
// POST /api/coach/session
// Handles one turn of a Sage coaching conversation:
//   1. Auth + rate limit + tier gate the session type
//   2. Load or create the coaching_sessions row
//   3. Enforce per-plan session length (messages per session)
//   4. Call Claude with the session type's system prompt
//   5. Parse the strict { reflection, question, action } JSON
//   6. Persist both turns, return the assistant turn
//
// NOTE: auth is already enforced by proxy.ts for all /api/coach/*
// routes (S3 fix) — this route still re-checks because proxy.ts
// returning 401 doesn't replace defense-in-depth at the route level.
// ============================================================

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { coachSessionLimiter, getClientIp } from '@/lib/rate-limit';
import { SESSION_TYPE_MAP, getAvailableSessionTypes } from '@/lib/session-types';
import { effectivePlan } from '@/lib/planTier';
import { PLAN_LIMITS, checkUsage } from '@/lib/session-limits';
import type {
  CoachMessage,
  CoachAssistantMessage,
  SendCoachMessageRequest,
} from '@/types/coach';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const COACH_MODEL = 'claude-sonnet-4-6';

export async function POST(req: Request) {
  // ── Rate limit ────────────────────────────────────────────
  const ip = getClientIp(req);
  const rateLimit = coachSessionLimiter.check(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
    );
  }

  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse + validate body ────────────────────────────────
  let body: SendCoachMessageRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId, sessionTypeId, message } = body;

  if (!sessionTypeId || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json(
      { error: 'sessionTypeId and message are required' },
      { status: 400 }
    );
  }

  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message is too long (max 4000 characters)' },
      { status: 400 }
    );
  }

  const sessionType = SESSION_TYPE_MAP[sessionTypeId];
  if (!sessionType) {
    return NextResponse.json({ error: 'Unknown session type' }, { status: 400 });
  }

  // ── Tier gate ─────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, subscription_status, subscription_end')
    .eq('id', user.id)
    .single();

  const plan = effectivePlan(profile);
  const allowedTypes = getAvailableSessionTypes(plan);
  if (!allowedTypes.some((t) => t.id === sessionTypeId)) {
    return NextResponse.json(
      { error: 'This session type requires a higher plan.' },
      { status: 403 }
    );
  }

  // ── Load existing session, or start a new one ────────────
  let existingMessages: CoachMessage[] = [];
  let resolvedSessionId = sessionId;

  if (sessionId) {
    const { data: existing, error: loadError } = await supabase
      .from('coaching_sessions')
      .select('id, user_id, messages')
      .eq('id', sessionId)
      .single();

    if (loadError || !existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    existingMessages = (existing.messages as CoachMessage[]) ?? [];
  }

  // ── Enforce per-plan session length (messages per session) ─
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  if (
    limits.sessionLength !== -1 &&
    existingMessages.length >= limits.sessionLength
  ) {
    return NextResponse.json(
      {
        error: `This session has reached its message limit (${limits.sessionLength}). Start a new session to continue, or upgrade your plan for longer sessions.`,
      },
      { status: 403 }
    );
  }

  // ── Enforce monthly coachingSessions limit (new sessions only) ──
  if (!sessionId) {
    const usage = await checkUsage(
      user.id,
      'coachingSessions',
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.message ?? 'You have reached your coaching session limit.' },
        { status: 403 }
      );
    }
  }

  // ── Build the conversation for Claude ────────────────────
  const userTurn: CoachMessage = {
    role: 'user',
    content: message.trim(),
    createdAt: new Date().toISOString(),
  };

  const conversationForClaude = [...existingMessages, userTurn].map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let assistantTurn: CoachAssistantMessage;

  try {
    const response = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 800,
      system: sessionType.prompt,
      messages: conversationForClaude,
    });

    const block = response.content[0];
    const rawText = block.type === 'text' ? block.text : '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed: { reflection?: string; question?: string; action?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Claude didn't return valid JSON — fall back to showing the
      // raw text as the question so the turn isn't silently lost.
      parsed = { reflection: '', question: cleaned, action: undefined };
    }

    assistantTurn = {
      role: 'assistant',
      content: parsed.question || cleaned,
      reflection: parsed.reflection ?? '',
      question: parsed.question ?? '',
      action: parsed.action ?? null,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[coach/session] Anthropic call failed:', err);
    return NextResponse.json(
      { error: 'Sage is having trouble responding right now. Please try again.' },
      { status: 502 }
    );
  }

  const updatedMessages = [...existingMessages, userTurn, assistantTurn];

  // ── Persist ───────────────────────────────────────────────
  const isNewSession = !resolvedSessionId;

  if (resolvedSessionId) {
    const { error: updateError } = await supabase
      .from('coaching_sessions')
      .update({ messages: updatedMessages })
      .eq('id', resolvedSessionId);

    if (updateError) {
      console.error('[coach/session] Failed to update session:', updateError);
      return NextResponse.json(
        { error: 'Failed to save your message. Please try again.' },
        { status: 500 }
      );
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from('coaching_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionTypeId,
        user_input: userTurn.content,
        ai_response: assistantTurn.content,
        messages: updatedMessages,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      console.error('[coach/session] Failed to create session:', insertError);
      return NextResponse.json(
        { error: 'Failed to start your session. Please try again.' },
        { status: 500 }
      );
    }

    resolvedSessionId = created.id;
  }

  // ── Record usage (feature name matches lib/session-limits.ts) ──
  // coachingSessions is a per-SESSION limit (PLAN_LIMITS), not
  // per-message — only record on the turn that creates a new session,
  // or every follow-up reply would also consume the monthly quota.
  if (isNewSession) {
    await supabase.from('usage_tracking').insert({
      user_id: user.id,
      feature: 'coachingSessions',
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    sessionId: resolvedSessionId,
    message: assistantTurn,
  });
}
