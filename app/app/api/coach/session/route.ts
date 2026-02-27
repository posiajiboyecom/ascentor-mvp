import { createClient } from '@/lib/supabase/server';
import { retrieveContext } from '@/lib/rag';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { checkUsage, recordUsage } from '@/lib/session-limits';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `<role>
You are an expert leadership coach for African professionals aged 20-40.
Use the Socratic method. Max 150 words. Ask ONE question at a time.
Be culturally aware of hierarchical cultures, ethnic/family networks,
and that career decisions carry higher economic stakes.

You have access to a curated knowledge base covering leadership frameworks,
career strategy, African business context, and professional development.
When relevant knowledge is provided, weave it naturally into your coaching —
reference frameworks by name, suggest specific techniques, and give actionable
advice grounded in the knowledge. Don't just quote it — apply it to the user's
specific situation.

If no relevant knowledge is provided, coach from your general expertise.
</role>
<output_format>
<reflection>1-2 sentences acknowledging what you hear</reflection>
<question>ONE powerful question</question>
<action>ONE specific action for this week (only if ready, otherwise omit)</action>
</output_format>`;

export async function POST(request: Request) {
  try {
    // 1. Check Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth Error:", authError);
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // 2. Check Usage Limits
    const usage = await checkUsage(
      user.id,
      'coachingSessions',
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!usage.allowed) {
      return NextResponse.json({
        error: usage.message,
        upgradeRequired: true,
        usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining },
      }, { status: 429 });
    }

    // 3. Parse Input
    const body = await request.json();
    const userInput = body.userInput || body.message;
    const sessionType = body.sessionType || 'challenge_navigation';

    if (!userInput) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    // 4. Load User Context
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

    // 5. RAG Retrieval — search knowledge base
    let knowledgeBlock = '';
    try {
      const { contextBlock } = await retrieveContext(userInput, {
        topK: 10,
        topN: 3,
      });
      knowledgeBlock = contextBlock;
    } catch (ragError) {
      console.error('RAG retrieval failed (continuing without):', ragError);
      // Coach still works without RAG — just less informed
    }

    // 6. Build Prompt with RAG context
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
${knowledgeBlock ? `<relevant_knowledge>\n${knowledgeBlock}\n</relevant_knowledge>` : ''}
<user_message>${userInput}</user_message>`;

    // 7. Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    // @ts-ignore
    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

    // 8. Parse Response
    const parsed = {
      reflection: aiText.match(/<reflection>([\s\S]*?)<\/reflection>/)?.[1]?.trim() || "I hear you.",
      question: aiText.match(/<question>([\s\S]*?)<\/question>/)?.[1]?.trim() || aiText,
      action: aiText.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim() || null,
    };

    const cost = (response.usage.input_tokens / 1_000_000) * 3 + (response.usage.output_tokens / 1_000_000) * 15;

    // 9. Save to Database
    const { data: session, error: dbError } = await supabase
      .from('coaching_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        user_input: userInput,
        ai_response: parsed,
        token_usage: {
          cost,
          rag_used: !!knowledgeBlock,
          rag_chunks: knowledgeBlock ? 3 : 0,
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB Save Error:", dbError);
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

    // 11. Record Usage (after successful response)
    await recordUsage(
      user.id,
      'coachingSessions',
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    return NextResponse.json({
      sessionId: session?.id,
      response: parsed.question,
      full_response: parsed,
      usage: { used: usage.used + 1, limit: usage.limit, remaining: usage.remaining - 1 },
    });

  } catch (error: any) {
    console.error("API Crash Log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}