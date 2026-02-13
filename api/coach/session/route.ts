import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const COACHING_PROMPT = `<role>
You are a warm, experienced leadership coach who works with ambitious African professionals aged 20-40. You've coached hundreds of people through career transitions, promotions, difficult conversations, and leadership challenges.

Your style:
- You talk like a trusted mentor over coffee, not a textbook
- You're direct but caring — you don't sugarcoat, but you're never cold
- You use short, punchy sentences mixed with longer ones
- You share relevant personal observations ("I've seen this pattern before...")
- You name what you see ("That sounds like it's really weighing on you")
- You challenge gently ("I wonder if there's something deeper going on here")
- You never start with "I hear that" or "It sounds like" — find fresh ways to connect
- You understand African workplace dynamics: hierarchical cultures, the weight of family expectations, ethnic dynamics in office politics, and that career setbacks have bigger consequences
- You occasionally use relatable metaphors or brief stories

Every response must include:
1. A genuine human reaction to what they said (NOT a formulaic acknowledgment)
2. ONE thought-provoking question that moves them forward

If they're ready for action, suggest ONE specific thing to do this week. Keep it concrete — "Send a 3-line email to your manager asking for 15 minutes" not "Consider having a conversation about your goals."

IMPORTANT RULES:
- Maximum 120 words per response
- Never use phrases like "I hear that", "It sounds like", "That's completely normal/valid", "I appreciate you sharing"
- Never give generic LinkedIn-style advice
- Ask ONE question at a time, never two
- Don't repeat back what they just said — they already know what they said
- If they're being vague, push them to be specific
- If they seem stuck, change the angle entirely
</role>
<output_format>
<reflection>Your genuine reaction — be real, be specific to what they said</reflection>
<question>ONE powerful question</question>
<action>ONE concrete action for this week (only include if they're ready — omit this tag entirely if not)</action>
</output_format>`;

const PROGRESS_PROMPT = `You are a goal progress evaluator. Based on the user's coaching conversation, evaluate their progress toward their 90-day goal and milestones.

You must respond ONLY with a JSON object, no other text. No markdown backticks. Just raw JSON.

{
  "overall_progress": <number 0-100>,
  "milestone_1_complete": <true/false>,
  "milestone_2_complete": <true/false>,
  "milestone_3_complete": <true/false>,
  "reasoning": "<1 sentence explaining your assessment>"
}

Rules:
- Be generous but honest. If the user MENTIONS completing something, believe them.
- If the user says they did something related to a milestone, mark it complete.
- Each completed milestone = roughly 33% progress.
- If user is making progress but hasn't completed milestones, give partial credit (10-30%).
- If no progress signals at all, return the current progress unchanged.
- Only increase progress, never decrease it.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const { userInput, sessionType = 'challenge_navigation' } = await request.json();

  // 1. Load user context
  const [profileRes, goalRes, commitmentsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_goals').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('user_commitments').select('commitment_text, due_date')
      .eq('user_id', user.id).eq('completed', false),
  ]);

  const profile = profileRes.data;
  const goal = goalRes.data;

  // 2. Build context for coaching
  const context = `
<user_profile>
Name: ${profile?.full_name || 'Unknown'}
Role: ${profile?.current_role || 'Unknown'}
Industry: ${profile?.industry || 'Unknown'}
Goal Role: ${profile?.goal_role || 'Unknown'}
Challenge: ${profile?.biggest_challenge || 'Not specified'}
</user_profile>
<goal>
90-Day Goal: ${goal?.goal_text || 'Not set'}
Milestone 1: ${goal?.milestone_1 || 'Not set'}
Milestone 2: ${goal?.milestone_2 || 'Not set'}
Milestone 3: ${goal?.milestone_3 || 'Not set'}
Current Progress: ${goal?.progress || 0}%
</goal>
<pending_commitments>
${commitmentsRes.data?.map(c => `- ${c.commitment_text}`).join('\n') || 'None'}
</pending_commitments>
<session_type>${sessionType}</session_type>
<user_message>${userInput}</user_message>`;

  // 3. Call Claude for coaching response
  let parsed = { reflection: null as string | null, question: null as string | null, action: null as string | null };
  let tokenUsage = { input_tokens: 0, output_tokens: 0, cost: 0 };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: COACHING_PROMPT,
      messages: [{ role: 'user', content: context }],
    });

    const aiText = response.content[0].type === 'text' ? response.content[0].text : '';

    parsed = {
      reflection: aiText.match(/<reflection>([\s\S]*?)<\/reflection>/)?.[1]?.trim() || null,
      question: aiText.match(/<question>([\s\S]*?)<\/question>/)?.[1]?.trim() || null,
      action: aiText.match(/<action>([\s\S]*?)<\/action>/)?.[1]?.trim() || null,
    };

    tokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost: (response.usage.input_tokens / 1_000_000) * 3 +
            (response.usage.output_tokens / 1_000_000) * 15,
    };
  } catch (e) {
    console.error('Coaching API error:', e);
    parsed = {
      reflection: "I'm here and ready to help you navigate your leadership journey.",
      question: "What's the most pressing challenge you're facing at work right now?",
      action: null,
    };
  }

  // 4. Save the coaching session
  const { data: session } = await supabase
    .from('coaching_sessions')
    .insert({
      user_id: user.id,
      session_type: sessionType,
      user_input: userInput,
      ai_response: parsed,
      token_usage: tokenUsage,
    })
    .select()
    .single();

  // 5. Auto-create commitment from action
  if (parsed.action && session) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    await supabase.from('user_commitments').insert({
      user_id: user.id,
      session_id: session.id,
      commitment_text: parsed.action,
      due_date: dueDate.toISOString().split('T')[0],
    });
  }

  // 6. Evaluate goal progress using AI
  let progressUpdate = null;
  if (goal) {
    try {
      const progressContext = `
User's 90-day goal: ${goal.goal_text}
Milestone 1: ${goal.milestone_1 || 'Not set'} (currently ${goal.milestone_1_complete ? 'COMPLETE' : 'incomplete'})
Milestone 2: ${goal.milestone_2 || 'Not set'} (currently ${goal.milestone_2_complete ? 'COMPLETE' : 'incomplete'})
Milestone 3: ${goal.milestone_3 || 'Not set'} (currently ${goal.milestone_3_complete ? 'COMPLETE' : 'incomplete'})
Current overall progress: ${goal.progress || 0}%

The user just said this in their coaching session:
"${userInput}"

The coach reflected:
"${parsed.reflection || ''}"

Evaluate: has the user made any progress on their goal or milestones based on what they said?`;

      const progressResponse = await anthropic.messages.create({
        model