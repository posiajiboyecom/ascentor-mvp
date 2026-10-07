// app/api/rx/export/route.ts
// GET -> a JSON download of the signed-in member's own data from the reimagined app.
// Everything is read as the member, so row level security limits it to what they could already see about themselves.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const OWN: [string, string][] = [
  ['member_profile', 'user_id'], ['user_goals', 'user_id'], ['practices', 'user_id'], ['practice_checkins', 'user_id'],
  ['rx_lesson_progress', 'user_id'], ['sage_memories', 'user_id'], ['mentee_intake', 'user_id'],
  ['feed_posts', 'user_id'], ['feed_replies', 'user_id'], ['circle_reports', 'user_id'], ['circle_reviews', 'user_id'],
  ['rx_group_members', 'user_id'], ['announcement_reads', 'user_id'], ['rx_group_requests', 'user_id'],
];

export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), userId: user.id, email: user.email };
  for (const [table, col] of OWN) {
    const { data } = await db.from(table).select('*').eq(col, user.id);
    out[table] = data ?? [];
  }
  const [msgs, dms, circleMsgs] = await Promise.all([
    db.from('rx_group_messages').select('*').eq('user_id', user.id),
    db.from('dm_messages').select('*').eq('sender_id', user.id),
    db.from('circle_messages').select('*').eq('user_id', user.id),
  ]);
  // Survey answers and scores are private tables, read here for the member only.
  const [answers, scores, sage] = await Promise.all([
    supabaseAdmin.from('private_survey_responses').select('wave, item, value, taken_at').eq('user_id', user.id),
    supabaseAdmin.from('private_growth_scores').select('kind, flourishing, purpose, initiative, taken_at').eq('user_id', user.id),
    supabaseAdmin.from('sage_messages').select('role, body, created_at').eq('user_id', user.id).order('created_at'),
  ]);
  out.survey_answers = answers.data ?? []; out.growth_scores = scores.data ?? []; out.sage_conversations = sage.data ?? [];
  out.group_messages = msgs.data ?? []; out.direct_messages_sent = dms.data ?? []; out.circle_messages = circleMsgs.data ?? [];

  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="ascentor-my-data.json"`, 'Cache-Control': 'no-store' },
  });
}
