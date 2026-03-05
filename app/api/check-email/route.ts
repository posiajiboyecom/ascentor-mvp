import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';

// POST /api/auth/check-email
// Returns { exists: boolean } — used by forgot-password page to
// block reset attempts for emails not registered in the system.
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const supabase = createClient();

  // Check profiles table — every registered user has a profile row
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    console.error('[check-email]', error);
    // Fail open — don't block legitimate users due to a DB error
    return NextResponse.json({ exists: true });
  }

  return NextResponse.json({ exists: !!data });
}
