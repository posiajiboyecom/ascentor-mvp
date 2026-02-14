import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ sessions: [] });
  }

  const { data: sessions } = await supabase
    .from('coaching_sessions')
    .select('user_input, ai_response, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50);

  return NextResponse.json({ sessions: sessions || [] });
}