import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ============================================================
// GET  /api/intel-analyse  — fetch latest cached snapshot
// POST /api/intel-analyse  — run fresh analysis, save snapshot
// ============================================================

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: snapshot, error } = await supabase
      .from('platform_snapshots')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !snapshot) {
      return NextResponse.json({ snapshot: null, message: 'No snapshot yet — run a manual refresh.' });
    }

    return NextResponse.json({ snapshot });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'moderator'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { prompt, raw_data } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json({ error: `Anthropic API error: ${response.status} — ${errBody}` }, { status: 502 });
    }

    const data = await response.json();
    const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let aiReport: any;
    try { aiReport = JSON.parse(clean); }
    catch { return NextResponse.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 }); }

    const inputTokens  = data.usage?.input_tokens  || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const costUsd = (inputTokens / 1_000_000 * 0.80) + (outputTokens / 1_000_000 * 4.00);
    const tokenCost = { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Math.round(costUsd * 100000) / 100000 };

    const { data: saved, error: saveError } = await supabase
      .from('platform_snapshots')
      .insert({ generated_at: new Date().toISOString(), generated_by: `manual:${user.id}`, raw_data: raw_data || {}, ai_report: aiReport, token_cost: tokenCost, duration_ms: Date.now() - startTime })
      .select().single();

    return NextResponse.json({ report: aiReport, token_cost: tokenCost, snapshot_id: saved?.id, saved: !saveError });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
