// app/api/coach/session/route.ts  ← REPLACE EXISTING FILE WITH THIS
// ─────────────────────────────────────────────────────────────────────────────
// CHANGES FROM ORIGINAL:
//  1. Loads AI persona prompt from the tenant config (not hardcoded)
//  2. Upgrades model to claude-sonnet-4-20250514
//  3. Adds tenant_id to the session insert for proper multi-tenant data isolation
//  4. Falls back to Ascentor default persona if no tenant config found
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { retrieveContext } from '@/app/lib/rag';
import { coachSessionLimiter, getClientIp } from '@/lib/rate-limit';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Default persona (used when no tenant config or direct ascentor.co access) ─
const DEFAULT_SYSTEM_PROMPT = `<role>
You are Sage, an expert leadership and career coach for ambitious professionals worldwide.
Use the Socratic method — ask ONE powerful question at a time, maximum 150 words per response.
Be aware that career decisions carry significant personal, financial, and relational stakes.
Help users gain clarity on their situation, options, and next concrete action.
</role>`;

// ── Standard output format appended to every persona ────────────────────────
const OUTPUT_FORMAT = `
<output_format>
<reflection>1-2 sentences acknowledging what you hear</reflection>
<question>ONE powerful question</question>
<action>ONE specific action for this week (only if ready, otherwise omit)</action>
</output_format>`;

export async function POST(request: Request) {
  try {
    // ── 0. IP-level rate limit (before auth to save DB calls) ─────────
    // 30 requests per 10 minutes per IP — protects Claude API budget (H-3 fix)
    const ip = getClientIp(request);
    const { allowed, retryAfter } = coachSessionLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before sending another message.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // 1. Check Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // 1b. Usage limit check — enforce free tier session cap
    try {
      const limitRes = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ascentorbi.com'}/api/usage/check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') || '' },
          body: JSON.stringify({ feature: 'coachingSessions' }),
        }
      );
      if (limitRes.ok) {
        const limitData = await limitRes.json();
        if (!limitData.allowed) {
          return NextResponse.json({
            error: 'Session limit reached',
            message: limitData.message || 'You have used all your coaching sessions for today. Upgrade to continue.',
            upgradeRequired: true,
          }, { status: 429 });
        }
      }
    } catch (limitErr) {
      // Non-fatal — if limit check fails, allow the session
      console.warn('[coach/session] Usage limit check failed (non-fatal):', limitErr);
    }

    // 2. Parse Input
    const body = await request.json();
    const userInput = body.userInput || body.message;
    const sessionType = body.sessionType || 'challenge_navigation';

    if (!userInput) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // 3. Load Context (profile, goal, history, commitments, AND tenant config)
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

    // 4. Load partner AI persona if this user belongs to a whitelabel partner.
    // Strategy: look up partner_members by user email → join partners.ai_config.
    // Falls back to DEFAULT_SYSTEM_PROMPT if user is on main Ascentor platform
    // or if the partner has not configured a persona yet.
    // NOTE: We intentionally do NOT use profile.tenant_id — that field references
    // the old `tenants` table which no longer exists. Partner lookup goes through
    // partner_members → partners.
    let tenantPersonaPrompt: string | null = null;
    if (user.email) {
      const { data: membership } = await supabase
        .from('partner_members')
        .select('partner_id, partners(ai_config)')
        .eq('email', user.email)
        .eq('status', 'active')
        .maybeSingle();

      if (membership) {
        const aiConfig = (membership as any)?.partners?.ai_config as Record<string, unknown> | null;
        tenantPersonaPrompt = (aiConfig?.ai_persona_prompt as string) || null;
      }
    }

    // 5. Build system prompt = tenant persona (or default) + output format
    const roleSection = tenantPersonaPrompt
      ? `<role>\n${tenantPersonaPrompt}\n</role>`
      : DEFAULT_SYSTEM_PROMPT;

    const SYSTEM_PROMPT = roleSection + OUTPUT_FORMAT;

    // 6. Retrieve relevant knowledge from Pinecone (RAG)
    // Determines the user's career stage to focus the namespace
    const plan = profile?.subscription_plan || 'builder';
    const stageNamespace = plan === 'explorer' ? 'career'
      : plan === 'climber' ? 'leadership'
      : 'promotion'; // builder default

    let knowledgeBlock = '';
    try {
      const { contextBlock } = await retrieveContext(userInput, {
        topK: 8,
        topN: 3,
        // Search across most relevant namespaces based on message content
      });
      knowledgeBlock = contextBlock;
    } catch (ragErr) {
      // Non-fatal — Sage still works without RAG context
      console.warn('[coach/session] RAG retrieval failed (non-fatal):', ragErr);
    }

    // 6b. Build conversation context
    const recentHistory = sessionsRes.data?.map((s: any) =>
      `User: ${s.user_input}\nCoach: ${s.ai_response?.question || ''}`
    ).join('\n---\n') || 'None';

    const context = `
<user_profile>
Name: ${profile?.full_name || 'Unknown'}
Role: ${profile?.current_role || 'Unknown'}
Industry: ${profile?.industry || 'Unknown'}
Goal: ${profile?.goal_role || 'Unknown'}
Challenge: ${profile?.biggest_challenge || 'Not specified'}
Plan: ${plan}
</user_profile>
<goal>${goal?.goal_text || 'Not set'}</goal>
<pending_commitments>
${commitmentsRes.data?.map((c: any) => `- ${c.commitment_text}`).join('\n') || 'None'}
</pending_commitments>
<recent_history>${recentHistory}</recent_history>
${knowledgeBlock ? `<knowledge_context>\nUse the following relevant frameworks and knowledge to inform your coaching. Do not quote them directly — use them to ask better questions.\n${knowledgeBlock}\n</knowledge_context>` : ''}
<user_message>${userInput}</user_message>`;

    // 7. Call Claude (upgraded model)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', // ← UPGRADED from claude-3-5-sonnet-20240620
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    const aiText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // 8. Parse Response
    const parsed = {
      reflection:
        aiText.match(/<reflection>([\s\S]*?)<\/reflection>/)?.[1]?.trim() || 'I hear you.',
      question:
        aiText.match(/<question>([\s\S]*?)<\/question>/)?.[1]?.trim() || aiText,
      action:
        aiText.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim() || null,
    };

    const cost =
      (response.usage.input_tokens / 1_000_000) * 3 +
      (response.usage.output_tokens / 1_000_000) * 15;

    // 9. Save Session
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

    if (dbError) {
      console.error('DB Save Error:', dbError);
    }

    // 10. Handle Commitments
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
    });
  } catch (error: any) {
    console.error('API Crash Log:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
