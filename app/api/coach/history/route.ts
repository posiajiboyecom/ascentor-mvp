import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ sessions: [], total: 0 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit')  || '10', 10), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0',  10), 0);

  // Get total count first (for "X earlier sessions" label)
  const { count } = await supabase
    .from('coaching_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: sessions, error } = await supabase
    .from('coaching_sessions')
    .select('id, user_input, ai_response, session_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) // newest first, reversed in client
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[coach/history]', error);
    return NextResponse.json({ sessions: [], total: 0 });
  }

  return NextResponse.json({
    sessions: (sessions || []).reverse(), // chronological order for display
    total: count || 0,
    offset,
    limit,
  });
}
