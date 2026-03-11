// ============================================================
// COACH API — /api/coach/session  [SUBSCRIPTION-GATED]
//
// Adds subscription enforcement to your existing coach route.
// Matches your existing code pattern exactly.
// Plan names: free (3/mo) | explorer (10/mo) | builder+ (unlimited)
// ============================================================

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { requireSubscription, checkCoachSessionLimit } from '@/lib/subscriptionGuard';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `<role>
You are an expert leadership coach for African professionals aged 20-40.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Be culturally aware of hierarchical cultures, ethnic/family networks,
and that career decisions carry higher economic stakes.
</role>
<output_format>
<reflection>1-2 sentences acknowledging what you hear</reflection>
<question>ONE powerful question</question>
<action>ONE specific action for this week (only if ready, otherwise omit)</action>
</output_format>`;

export async function POST(request: Request) {
  try {
    // ── 1. Auth check (all plans can access coach) ─────────
    const guard = await requireSubscription('free');
    if (guard.error) return guard.error;

    const { user, effectivePlan } = guard;

    // ── 2. Monthly session limit ───────────────────────────
    const limitCheck = await checkCoachSessionLimit(user.id, effectivePlan);
    if (!limitCheck.allowed && limitCheck.error) {
      return limitCheck.error;
    }

    // ── 3. Parse input (your existing fix: supports both field names) ──
    const body = await request.json();
    const userInput = body.userInput || body.message;
    const sessionType = body.sessionType || 'challenge_navigation';

    if (!userInput) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // ── 4. Load context (unchanged from your existing route) ──
    const supabase = await createClient();
    const [profileRes, goalRes, sessionsRes, commitmentsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_goals').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('coaching_sessions').select('user_input, ai_response')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('user_commitments').select('commitment_text, due_date')
        .eq('user_id', user.id).eq('completed', false),
    ]);

    const profile = profileRes.data;
    const goal = goalRes.data;
    const recentHistory = sessionsRes.data?.map((s: any) =>
      `User: ${s.user_input}\nCoach: ${s.ai_response?.question || ''}`
    ).join('\n---\n') || 'None';

    // ── 5. Build prompt (unchanged) ────────────────────────
    const context = `
<user_profile>
Name: ${profile?.full_name || 'Unknown'}
Role: ${profile?.current_role || 'Unknown'}
Industry: ${profile?.industry || 'Unknown'}
Goal: ${profile?.goal_role || 'Unknown'}
Challenge: ${profile?.biggest_challenge || 'Not specified'}
</user_profile>
<goal>${goal?.goal_text || 'Not set'}</goal>
<pending_commitments>
${commitmentsRes.data?.map((c: any) => `- ${c.commitment_text}`).join('\n') || 'None'}
</pending_commitments>
<recent_history>${recentHistory}</recent_history>
<user_message>${userInput}</user_message>`;

    // ── 6. Call Claude (unchanged) ─────────────────────────
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    // @ts-ignore
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = {
      reflection: aiText.match(/<reflection>([\s\S]*?)<\/reflection>/)?.[1]?.trim() || 'I hear you.',
      question:   aiText.match(/<question>([\s\S]*?)<\/question>/)?.[1]?.trim() || aiText,
      action:     aiText.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim() || null,
    };

    const cost = (response.usage.input_tokens / 1_000_000) * 3 + (response.usage.output_tokens / 1_000_000) * 15;

    // ── 7. Save (unchanged) ────────────────────────────────
    const { data: session, error: dbError } = await supabase
      .from('coaching_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        user_input: userInput,
        ai_response: parsed,
        token_usage: { cost },
      })
      .select()
      .single();

    if (dbError) console.error('DB Save Error:', dbError);

    if (parsed.action && session) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      await supabase.from('user_commitments').insert({
        user_id: user.id,
        session_id: session.id,
        commitment_text: parsed.action,
        due_date: dueDate.toISOString(),
      });
    }

    return NextResponse.json({
      sessionId: session?.id,
      response: parsed.question,
      full_response: parsed,
      // Usage info — frontend can show "X sessions left this month"
      usage: {
        sessionsUsed: limitCheck.used + 1,
        sessionsLimit: limitCheck.limit,
        remaining: limitCheck.limit === -1
          ? null
          : Math.max(0, limitCheck.limit - limitCheck.used - 1),
      },
    });

  } catch (error: any) {
    console.error('Coach API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
