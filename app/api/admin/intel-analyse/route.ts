// app/api/admin/intel-analyse/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/intel-analyse
//
// C-01 FIX: Anthropic API must NEVER be called from the browser.
// Both admin/intel/page.tsx and admin/community-intel/page.tsx
// previously called https://api.anthropic.com/v1/messages directly
// from client-side code with no x-api-key header (calls always
// returned 401). This route is the server-side proxy that:
//   1. Validates the caller is an authenticated admin
//   2. Calls Anthropic with the server-side ANTHROPIC_API_KEY
//   3. Returns the response (streaming or JSON depending on `stream`)
//
// Body:
//   {
//     mode: 'stream' | 'json'   — stream for intel page, json for community-intel
//     system?: string            — system prompt (optional)
//     prompt: string             — user message / full prompt
//     max_tokens?: number        — default 1500
//   }
//
// Response:
//   mode=stream → text/event-stream (SSE, same format as Anthropic)
//   mode=json   → { content: string }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = 'claude-sonnet-4-6';

export async function POST(req: NextRequest) {
  try {
    // ── Auth: admin only ───────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Parse body ─────────────────────────────────────────────
    const body = await req.json();
    const { mode = 'json', system, prompt, max_tokens = 1500 } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (!['stream', 'json'].includes(mode)) {
      return NextResponse.json({ error: 'mode must be "stream" or "json"' }, { status: 400 });
    }

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

    // ── Stream mode (intel page) ───────────────────────────────
    if (mode === 'stream') {
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            const stream = await anthropic.messages.stream({
              model: MODEL,
              max_tokens,
              ...(system ? { system } : {}),
              messages,
            });

            for await (const event of stream) {
              // Forward SSE events in the same format the intel page already parses
              const line = `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(line));
            }
            controller.close();
          } catch (err: any) {
            const errLine = `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
            controller.enqueue(encoder.encode(errLine));
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── JSON mode (community-intel page) ──────────────────────
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens,
      ...(system ? { system } : {}),
      messages,
    });

    const content = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');

    return NextResponse.json({ content });
  } catch (err: any) {
    console.error('[intel-analyse]', err);
    return NextResponse.json({ error: err.message || 'Analysis failed' }, { status: 500 });
  }
}
