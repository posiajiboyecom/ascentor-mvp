// GET /api/auth/google/mode  - tells the sign-in buttons which Google flow to use: { custom: boolean }.
// Public and harmless (it reveals only whether the switch is on, never a credential). Anything unexpected means "supabase", the old flow.
import { NextResponse } from 'next/server';
import { resolveGoogleMode } from '@/lib/auth/google-oauth';

export const dynamic = 'force-dynamic';

let warned = false;

export async function GET() {
  const { mode, warning } = resolveGoogleMode();
  if (warning && !warned) { warned = true; console.warn('[google-oauth]', warning); }
  return NextResponse.json({ custom: mode === 'custom' }, { headers: { 'Cache-Control': 'no-store' } });
}
