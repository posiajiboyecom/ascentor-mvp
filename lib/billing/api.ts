// lib/billing/api.ts
// Shared guard for the member billing API routes (/api/billing/*).
//   requireBillingMember() -> { ok:true, userId, email } | { ok:false, response }
//     404 JSON { error: 'Not found' } when BILLING_V2 is off (the feature does not exist yet), 401 when not signed in.
// The user id ALWAYS comes from the session, never from the request body or query.

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingV2Enabled } from './flags';

export async function requireBillingMember(): Promise<
  { ok: true; userId: string; email: string } | { ok: false; response: NextResponse }
> {
  if (!billingV2Enabled()) return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { ok: true, userId: user.id, email: user.email ?? '' };
}
