// app/api/auth/logout/route.ts
// POST { scope?: 'local' | 'global' } -> { ok: true }
// Signs the caller out on the server and deletes every Supabase session cookie in the response, whatever happens.
//
// Why on the server: the browser's supabase.auth.signOut() returns an error WITHOUT clearing the session whenever its
// copy of the session is stale (e.g. the proxy already rotated the refresh token) or the network blips. The cookies then
// survive, the redirect lands on the dashboard again, and the Sign out button seems to do nothing. Deleting the cookies
// here makes signing out always work. 'global' also revokes the session on every other device.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let scope: 'local' | 'global' = 'local';
  try { const b = (await req.json()) as { scope?: string }; if (b?.scope === 'global') scope = 'global'; } catch { /* no body: this device */ }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope });
  } catch { /* the cookies are removed below regardless */ }

  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  const store = await cookies();
  for (const c of store.getAll()) {
    if ((c.name.startsWith('sb-') && c.name.includes('auth-token')) || c.name === 'last_active') {
      res.cookies.set(c.name, '', { path: '/', maxAge: 0, expires: new Date(0) });
    }
  }
  return res;
}
