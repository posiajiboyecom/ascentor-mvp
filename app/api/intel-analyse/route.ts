import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// POST /api/intel-analyse
// Server-side proxy for Anthropic API calls from the Intel page.
// Runs Claude analysis on platform data and returns structured JSON.
// Admin-only — validates session server-side.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // Auth check — must be admin/moderator
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile || !['admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[intel-analyse] Anthropic error:', errBody);
      return NextResponse.json({ error: `Anthropic API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    // Strip markdown fences if present
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('[intel-analyse] JSON parse failed. Raw:', clean.slice(0, 300));
      return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 });
    }

    return NextResponse.json({ report: parsed });
  } catch (err: any) {
    console.error('[intel-analyse] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
