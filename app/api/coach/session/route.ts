import { createClient }   from '@/lib/supabase/server';
import { NextRequest }      from 'next/server';
import Anthropic            from '@anthropic-ai/sdk';
import { checkUsage }       from '@/lib/session-limits';
import { retrieveContext }  from '@/lib/rag';

// ─────────────────────────────────────────────────────────────────────────────
// SAGE COACH SESSION — /api/coach/session
//
// UPGRADE 1 — CONVERSATION HISTORY
//   The frontend passes `conversationHistory`: an array of
//   { role, content } pairs for the current session. Claude now
//   receives the full thread — every response is contextually aware.
//   Max 20 turns (40 messages) kept to avoid context overflow.
//
// UPGRADE 2 — RAG INTEGRATION
//   Before calling Claude, we run the user's message through the
//   Pinecone + Cohere pipeline (lib/rag.ts). Retrieved chunks are
//   injected into the system prompt as <knowledge_N> blocks.
//   If PINECONE_API_KEY / COHERE_API_KEY are absent, RAG is skipped
//   silently — Sage degrades gracefully to prompt-only mode.
//
// SSE protocol unchanged:
//   data: {"type":"delta","text":"..."}
//   data: {"type":"done","reflection":"...","question":"...","action":"..."}
//   data: {"type":"error","message":"..."}
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SESSION_PROMPTS: Record<string, string> = {
  challenge_navigation: `You are Sage, Ascentor's AI mentor for African professionals.
Help the user navigate a specific career or workplace challenge.
Be warm, direct, and practical. Draw on African professional context where relevant.
You have full memory of this conversation — reference earlier messages naturally.
Respond with a JSON object with exactly these three keys:
- "reflection": A 1-2 sentence empathetic acknowledgement of what they shared
- "question": One powerful coaching question to help them think deeper (end with ?)
- "action": One concrete, specific action they can take this week (start with a verb)
Respond ONLY with valid JSON. No markdown, no preamble.`,

  difficult_conversation: `You are Sage, Ascentor's AI mentor for African professionals.
Help the user prepare for a difficult conversation at work.
Be practical and specific. Help them think through what to say and how.
You have full memory of this conversation — use it.
Respond with a JSON object with exactly these three keys:
- "reflection": Acknowledge the challenge of the conversation they need to have
- "question": A question to help them clarify their goal or approach
- "action": A specific preparation step or opening line they could use
Respond ONLY with valid JSON. No markdown, no preamble.`,

  weekly_reflection: `You are Sage, Ascentor's AI mentor for African professionals.
Guide the user through a meaningful weekly reflection.
Help them extract learning and set intentions for the week ahead.
Reference themes or commitments from earlier in this conversation if relevant.
Respond with a JSON object with exactly these three keys:
- "reflection": Acknowledge what they shared and affirm one thing worth celebrating
- "question": A reflection question about patterns, growth, or lessons learned
- "action": One clear intention or commitment for the coming week
Respond ONLY with valid JSON. No markdown, no preamble.`,

  accountability_check: `You are Sage, Ascentor's AI mentor for African professionals.
Hold the user accountable to their commitments in a warm but direct way.
Celebrate wins, explore blockers, and help them re-commit to what matters.
You remember everything discussed earlier — reference those commitments directly.
Respond with a JSON object with exactly these three keys:
- "reflection": Acknowledge their update — celebrate wins or explore what got in the way
- "question": A question that helps them understand what enabled or blocked progress
- "action": A specific recommitment or adjusted action for the coming days
Respond ONLY with valid JSON. No markdown, no preamble.`,
};

interface ConvMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Monthly session limit ─────────────────────────────────────────────────
  const usage = await checkUsage(
    user.id, 'coachingSessions',
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  if (!usage.allowed) {
    return new Response(JSON.stringify({
      error: usage.message || 'Monthly session limit reached',
      upgradeRequired: true, used: usage.used, limit: usage.limit,
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  const {
    userInput,
    sessionType         = 'challenge_navigation',
    messageCount        = 0,
    conversationHistory = [] as ConvMessage[],
  } = await req.json();

  if (!userInput?.trim()) {
    return new Response(JSON.stringify({ error: 'No input provided' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Per-session message limit ─────────────────────────────────────────────
  const lengthCheck = await checkUsage(
    user.id, 'sessionLength',
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  if (lengthCheck.limit !== -1 && messageCount >= lengthCheck.limit) {
    return new Response(JSON.stringify({
      error: `You've reached the ${lengthCheck.limit}-message limit for this conversation on your plan. Start a new session or upgrade for longer conversations.`,
      sessionLimitReached: true,
      upgradeRequired: lengthCheck.limit <= 10,
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  // ── RAG: retrieve relevant knowledge (silent fail if keys absent) ─────────
  let ragBlock = '';
  if (process.env.PINECONE_API_KEY && process.env.COHERE_API_KEY) {
    try {
      const { contextBlock } = await retrieveContext(userInput, { topK: 8, topN: 3 });
      ragBlock = contextBlock;
    } catch (e) {
      console.warn('[sage/rag] skipped:', e);
    }
  }

  // ── System prompt: base + optional RAG context ────────────────────────────
  const base = SESSION_PROMPTS[sessionType] ?? SESSION_PROMPTS.challenge_navigation;
  const systemPrompt = ragBlock
    ? `${base}\n\nRelevant knowledge from Ascentor's knowledge base — weave naturally into your response, do not quote verbatim:\n\n${ragBlock}`
    : base;

  // ── Build messages array: capped history + new user message ──────────────
  const MAX_TURNS = 20; // 20 pairs = 40 messages max
  const history   = (conversationHistory as ConvMessage[]).slice(-MAX_TURNS * 2);
  const messages  = [...history, { role: 'user' as const, content: userInput }];

  // ── Stream ────────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const enc  = new TextEncoder();
      const send = (d: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));

      let full = '';

      try {
        const s = await anthropic.messages.stream({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 600,
          system:     systemPrompt,
          messages,
        });

        for await (const chunk of s) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            full += chunk.delta.text;
            send({ type: 'delta', text: chunk.delta.text });
          }
        }

        // Parse JSON
        let parsed: { reflection?: string|null; question?: string|null; action?: string|null } = {};
        try {
          parsed = JSON.parse(full.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim());
        } catch {
          parsed = { reflection: null, question: full.trim() || 'What feels most important right now?', action: null };
        }

        // Persist (non-blocking)
        supabase.from('coaching_sessions').insert({
          user_id: user.id, session_type: sessionType,
          user_input: userInput, ai_response: parsed,
          messages, // store full thread for coaching summary agent
          created_at: new Date().toISOString(),
        }).then(() => supabase.from('usage_tracking').insert({
          user_id: user.id, feature: 'coachingSessions',
          created_at: new Date().toISOString(),
        }));

        send({ type: 'done', reflection: parsed.reflection ?? null, question: parsed.question ?? null, action: parsed.action ?? null });

      } catch (err) {
        console.error('[sage/session]', err);
        send({ type: 'error', message: 'Coaching session failed. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
