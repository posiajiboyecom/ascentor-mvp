// app/api/rx/sage/route.ts
// POST { topic, messages: [{ role: 'user' | 'sage', text }] } -> { reply, draft?, note?, crisis? }
// One turn of the Sage panel: a short, warm, practical coaching reply grounded in what the member has told us
// (goal, this week's plan, interests, notes they can see and edit). Conversations are not stored.
//
// Safety: messages that look like self-harm or crisis never reach the model. The member gets a fixed message
// that points to a real person and the emergency number.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { coachSessionLimiter, getClientIp } from '@/lib/rate-limit';
import { CRISIS_PATTERN } from '@/lib/rx/constants';
import { cleanText } from '@/lib/rx/safety';
import { localISODate, mondayOfISO } from '@/lib/rx/dates';
import { featureBlock } from '@/lib/access';

export const runtime = 'nodejs';

const MODEL = 'claude-sonnet-4-6';
const TOPICS = new Set(['plan', 'lesson', 'missed', 'reframe', 'report', 'silent', 'crisis']);

const CRISIS_REPLY = {
  reply: 'Thank you for telling me. I’m an AI, and you deserve a real person right now. You don’t have to explain everything. Please reach out below.',
  crisis: true,
};


/**
 * Saves one exchange. Conversations are kept so the Ascentor team can review them for safety and to improve Sage; the
 * member agreed to this at signup. Returns the conversation id. A storage failure never blocks the reply.
 */
async function saveExchange(userId: string, topic: string, conversationId: string | null | undefined, userText: string, sageText: string): Promise<string | null> {
  try {
    let id = conversationId && /^[0-9a-f-]{36}$/i.test(conversationId) ? conversationId : null;
    if (id) {
      const { data } = await supabaseAdmin.from('sage_conversations').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
      if (!data) id = null;
    }
    if (!id) {
      const { data } = await supabaseAdmin.from('sage_conversations').insert({ user_id: userId, topic }).select('id').single();
      id = (data?.id as string | undefined) ?? null;
    }
    if (!id) return null;
    await supabaseAdmin.from('sage_messages').insert([
      { conversation_id: id, user_id: userId, role: 'user', body: userText },
      { conversation_id: id, user_id: userId, role: 'sage', body: sageText },
    ]);
    await supabaseAdmin.from('sage_conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
    return id;
  } catch (e) {
    console.error('[rx/sage] could not store conversation', e instanceof Error ? e.message : e);
    return null;
  }
}

const TOPIC_GUIDE: Record<string, string> = {
  plan: 'The member wants to plan their week. Ask one short question at a time: what matters most this week, what usually gets in the way. After you know both, propose a draft if-then plan in the "draft" field. Keep the plan small enough to do on a bad day.',
  lesson: 'The member just finished a lesson and wants a practice from it. Suggest one small action they can repeat in under 30 minutes, tied to something they already do. Put it in the "draft" field.',
  missed: 'The member missed a day. Be kind and matter-of-fact: a missed day resets nothing. Ask what got in the way, then offer to make today’s practice smaller. If you propose a smaller practice, put it in "draft".',
  reframe: 'The member is having a hard day and may be discouraged. Do not argue with the feeling. Separate a hard day from a verdict, name the specific hard part, and offer one manageable next step.',
  report: 'Help the member write a short honest weekly report for their Circle: how the practice went (Kept, Partly kept or Not kept), what got in the way, and the next if-then. Use the facts you are given. Never invent progress.',
  silent: 'The member has been quiet for several days. Be warm, not guilty. Tell them you will let their facilitator know they have been quiet, never what they have said to you.',
};

interface Ctx { name: string; goal: string | null; interests: string[]; stage: string | null; plan: string | null; obstacle: string | null; notes: string[]; language: string; kept: number; days: number }

function systemPrompt(topic: string, c: Ctx): string {
  return [
    'You are Sage, the AI assistant inside Ascentor, a community for people building a purposeful life and career.',
    'Voice: warm, brief, concrete. Two to four short sentences. Plain words. Ask at most one question. No lists unless asked. No emojis.',
    'You are an AI and say so if asked. You are not a therapist, doctor, lawyer or financial adviser. For those topics, give general orientation only and suggest a qualified person.',
    `Reply in ${c.language}. If the member writes in another language, follow theirs.`,
    `About the member: first name ${c.name}.${c.goal ? ` Their 90-day goal: ${c.goal}.` : ''}${c.stage ? ` Starting point: ${c.stage}.` : ''}${c.interests.length ? ` Interests: ${c.interests.slice(0, 8).join(', ')}.` : ''}`,
    c.plan ? `This week’s plan: ${c.plan}.${c.obstacle ? ` Their usual obstacle: ${c.obstacle}.` : ''}` : 'They have no plan for this week yet.',
    c.days ? `Check-ins this week: ${c.kept} kept out of ${c.days} days.` : '',
    c.notes.length ? `Notes the member has seen and can edit: ${c.notes.map((n) => `“${n}”`).join('; ')}.` : '',
    TOPIC_GUIDE[topic] ?? 'Answer the member’s question helpfully and keep the conversation moving toward one small action.',
    'Respond with ONLY a JSON object: {"reply": string, "draft"?: {"cue": string, "action": string, "trigger": string, "fallback": string}, "note"?: string}.',
    '"draft" is an if-then plan: After I <cue>, I will <action>. If <trigger>, then I will <fallback>. Include it only when you are proposing one. Keep each part under 12 words, first person, no trailing period.',
    '"note" is one short durable fact about the member worth remembering (for example “You study best on weekday evenings.”). Include it only when they have clearly told you something new and lasting. Never include sensitive details such as health, faith, money amounts or family problems.',
  ].filter(Boolean).join('\n');
}

export async function POST(req: Request) {
  const rl = coachSessionLimiter.check(getClientIp(req));
  if (!rl.allowed) return NextResponse.json({ error: 'You’re going quickly. Give it a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  // Billing v2: Sage is one of the things a lapsed member (light access) loses. Members without a v2 row are never blocked here.
  const blocked = await featureBlock(user.id, 'sage');
  if (blocked) return NextResponse.json({ error: blocked, paused: true }, { status: 403 });

  let body: { topic?: string; conversationId?: string | null; messages?: { role?: string; text?: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const topic = TOPICS.has(body.topic ?? '') ? (body.topic as string) : 'plan';
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'sage') && typeof m.text === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: cleanText(m.text, 1200) }))
    .filter((m) => m.content);
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return NextResponse.json({ error: 'Say something first.' }, { status: 400 });

  // Anything that looks like a crisis in the recent messages is handled without the model.
  if (history.slice(-3).some((m) => m.role === 'user' && CRISIS_PATTERN.test(m.content))) {
    const cid = await saveExchange(user.id, topic, body.conversationId, last.content, CRISIS_REPLY.reply);
    return NextResponse.json({ ...CRISIS_REPLY, conversationId: cid });
  }

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Sage is resting. Try again soon.' }, { status: 503 });

  // ── what Sage may know about this member ──
  const [{ data: prof }, { data: mp }, { data: goal }, { data: notes }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    db.from('member_profile').select('interests, stage, language, timezone').eq('user_id', user.id).maybeSingle(),
    db.from('user_goals').select('goal_text').eq('user_id', user.id).order('position').limit(1).maybeSingle(),
    db.from('sage_memories').select('text').eq('user_id', user.id).order('created_at').limit(12),
  ]);
  const tz = (mp?.timezone as string | undefined) ?? 'Africa/Lagos';
  const today = localISODate(tz);
  const week = mondayOfISO(today);
  const { data: practice } = await db.from('practices').select('id, cue, action, trigger, fallback, obstacle').eq('user_id', user.id).eq('week_start', week).maybeSingle();
  const { data: checks } = await db.from('practice_checkins').select('status').eq('user_id', user.id).gte('day', week);
  const kept = ((checks ?? []) as { status: string }[]).filter((c) => c.status === 'kept').length;
  const p = practice as { cue: string; action: string; trigger: string | null; fallback: string | null; obstacle: string | null } | null;

  const ctx: Ctx = {
    name: ((prof?.full_name as string | undefined) ?? 'there').split(/\s+/)[0],
    goal: (goal?.goal_text as string | undefined) ?? null,
    interests: (mp?.interests as string[] | undefined) ?? [],
    stage: (mp?.stage as string | undefined) ?? null,
    language: (mp?.language as string | undefined) ?? 'English',
    plan: p ? `After I ${p.cue}, I will ${p.action}.${p.trigger && p.fallback ? ` If ${p.trigger}, then I will ${p.fallback}.` : ''}` : null,
    obstacle: p?.obstacle ?? null,
    notes: ((notes ?? []) as { text: string }[]).map((n) => n.text),
    kept, days: (checks ?? []).length,
  };

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await anthropic.messages.create({ model: MODEL, max_tokens: 500, system: systemPrompt(topic, ctx), messages: history });
    const block = r.content[0];
    const raw = block && block.type === 'text' ? block.text : '';
    let parsed: { reply?: string; draft?: { cue?: string; action?: string; trigger?: string; fallback?: string }; note?: string } = {};
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { parsed = { reply: raw.trim() }; }

    const reply = cleanText(parsed.reply, 900) || 'Tell me a little more, and we’ll find one small next step.';
    const d = parsed.draft;
    const draft = d && d.cue && d.action
      ? { cue: cleanText(d.cue, 200), action: cleanText(d.action, 240), trigger: cleanText(d.trigger, 200), fallback: cleanText(d.fallback, 240) }
      : undefined;

    // A durable note is saved only if it is new. The member can see, edit and delete every note.
    let note: string | undefined;
    const n = cleanText(parsed.note, 160);
    if (n && !ctx.notes.some((x) => x.toLowerCase() === n.toLowerCase()) && ctx.notes.length < 30) {
      const { error } = await db.from('sage_memories').insert({ user_id: user.id, text: n });
      if (!error) note = n;
    }
    const conversationId = await saveExchange(user.id, topic, body.conversationId, last.content, reply);
    return NextResponse.json({ reply, draft, note, conversationId });
  } catch (e) {
    console.error('[rx/sage] model call failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Sage is having trouble right now. Please try again.' }, { status: 502 });
  }
}
