// app/api/admin/surveys/[id]/analyse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SurveyQuestion, SurveyAnswers } from '@/types/survey';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'moderator'].includes(profile.role)) return null;
  return user;
}

// POST /api/admin/surveys/[id]/analyse — run AI analysis
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch survey + all responses
  const [{ data: survey }, { data: responses }] = await Promise.all([
    supabase.from('surveys').select('*').eq('id', id).single(),
    supabase.from('survey_responses').select('answers, metadata, submitted_at').eq('survey_id', id),
  ]);

  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  if (!responses || responses.length === 0) {
    return NextResponse.json({ error: 'No responses yet' }, { status: 400 });
  }

  const questions = survey.questions as SurveyQuestion[];
  const totalResponses = responses.length;

  // Build per-question raw tallies
  const perQuestion = questions.map((q) => {
    const allAnswers = responses
      .map((r) => (r.answers as SurveyAnswers)[q.id])
      .filter((a) => a !== undefined && a !== null && a !== '');

    if (q.type === 'radio' || q.type === 'checkbox') {
      const counts: Record<string, number> = {};
      allAnswers.forEach((a) => {
        const vals = Array.isArray(a) ? a : [a];
        vals.forEach((v) => {
          if (typeof v === 'string') counts[v] = (counts[v] || 0) + 1;
        });
      });
      const dist = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({
          label,
          count,
          pct: Math.round((count / totalResponses) * 100),
        }));
      return { question_id: q.id, question_text: q.text, type: q.type, distribution: dist };
    }

    if (q.type === 'scale') {
      const nums = allAnswers.filter((a) => typeof a === 'number') as number[];
      const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
      const dist10 = Array.from({ length: 10 }, (_, i) =>
        nums.filter((n) => n === i + 1).length
      );
      return { question_id: q.id, question_text: q.text, type: q.type, average: Math.round(avg * 10) / 10, distribution_1_10: dist10 };
    }

    // text / textarea
    const texts = allAnswers.filter((a) => typeof a === 'string' && a.trim()) as string[];
    return { question_id: q.id, question_text: q.text, type: q.type, sample_responses: texts.slice(0, 8) };
  });

  // Willingness to pay — look for q8
  const wtpQ = perQuestion.find((q) => q.question_id === 'q8');
  let wtpPct = 0;
  if (wtpQ?.distribution) {
    const payingCount = wtpQ.distribution
      .filter((d) => !d.label.toLowerCase().includes('nothing'))
      .reduce((s, d) => s + d.count, 0);
    wtpPct = Math.round((payingCount / totalResponses) * 100);
  }

  // Avg duration
  const durationsMs = responses
    .map((r) => (r.metadata as { duration_seconds?: number } | null)?.duration_seconds)
    .filter((d): d is number => typeof d === 'number');
  const avgDuration = durationsMs.length
    ? Math.round(durationsMs.reduce((s, n) => s + n, 0) / durationsMs.length)
    : 0;

  // Claude analysis
  const prompt = `You are a product and growth analyst for Ascentor, an AI-powered purposeful development platform. 

You have ${totalResponses} survey responses from active members. Here is the aggregated data:

${JSON.stringify(perQuestion, null, 2)}

Willingness to pay: ${wtpPct}% are willing to pay something.

Produce exactly 5 concise, business-critical insights for the founding team. Each insight must:
- Have a short bold headline (max 7 words)
- Have a 1–2 sentence detail that gives a specific, actionable signal
- Focus on: who these users are, what they need, what blocks them from paying, and what to build or change first

Return ONLY a JSON array with this shape, no other text:
[
  { "headline": "...", "detail": "..." },
  ...
]`;

  let keyInsights: { headline: string; detail: string }[] = [];
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    keyInsights = JSON.parse(cleaned);
  } catch {
    keyInsights = [{ headline: 'Analysis generation failed', detail: 'Re-run analysis to try again.' }];
  }

  const analysisPayload = {
    total_responses: totalResponses,
    completion_rate: 74, // placeholder — needs tracking in metadata
    avg_duration_seconds: avgDuration,
    willingness_to_pay_pct: wtpPct,
    key_insights: keyInsights,
    per_question: perQuestion,
  };

  // Upsert analysis
  await supabase
    .from('survey_analyses')
    .upsert({ survey_id: id, insights: analysisPayload, generated_at: new Date().toISOString() });

  return NextResponse.json({ success: true, insights: analysisPayload });
}
