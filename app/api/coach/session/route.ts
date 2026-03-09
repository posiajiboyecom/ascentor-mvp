import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

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

// ✅ Rate limiting: max 20 requests per user per hour using Supabase
// No external dependency needed — uses your existing DB
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function checkRateLimit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const { count } = await supabase
    .from('coaching_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  return (count ?? 0) < RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    // 1. Check Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth Error:', authError);
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // 2. ✅ Rate limit check
    const allowed = await checkRateLimit(supabase, user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You have reached the coaching limit for this hour. Please try again later.' },
        { status: 429 }
      );
    }

    // 3. Parse Input
    const body = await request.json();
    const userInput = body.userInput || body.message;
    const sessionType = body.sessionType || 'challenge_navigation';

    if (!userInput) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // 4. Load Context
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

    // 5. Build Prompt
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

    // 6. ✅ Call Claude — updated model
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    // ✅ Removed @ts-ignore — use proper type guard
    const block = response.content[0];
    const aiText = block.type === 'text' ? block.text : '';

    // 7. Parse Response
    const parsed = {
      reflection: aiText.match(/<reflection>([\s\S]*?)<\/reflection>/)?.[1]?.trim() || 'I hear you.',
      question: aiText.match(/<question>([\s\S]*?)<\/question>/)?.[1]?.trim() || aiText,
      action: aiText.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim() || null,
    };

    const cost = (response.usage.input_tokens / 1_000_000) * 3 + (response.usage.output_tokens / 1_000_000) * 15;

    // 8. Save to Database
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

    // 9. Handle Commitments
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
