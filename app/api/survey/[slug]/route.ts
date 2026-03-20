// app/api/survey/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/survey/[slug] — fetch published survey
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('surveys')
    .select('id, title, description, slug, questions')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// POST /api/survey/[slug] — submit response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const body = await req.json();
  const { answers, metadata } = body;

  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Get survey id
  const { data: survey, error: surveyErr } = await supabase
    .from('surveys')
    .select('id')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (surveyErr || !survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
  }

  // Get current user (optional — anonymous submissions allowed)
  const { data: { user } } = await supabase.auth.getUser();

  const { error: insertErr } = await supabase
    .from('survey_responses')
    .insert({
      survey_id: survey.id,
      user_id: user?.id ?? null,
      answers,
      metadata: metadata ?? null,
    });

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
