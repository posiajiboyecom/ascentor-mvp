// app/api/coach/history/route.ts
// ============================================================
// GET /api/coach/history?sessionId=...
// Returns the full message array for a single coaching session,
// used when the user taps a card in "Recent Sessions" to resume it.
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CoachMessage } from '@/types/coach';

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from('coaching_sessions')
    .select('id, user_id, session_type, messages')
    .eq('id', sessionId)
    .single();

  if (error || !session || session.user_id !== user.id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    sessionTypeId: session.session_type,
    messages: (session.messages as CoachMessage[]) ?? [],
  });
}
