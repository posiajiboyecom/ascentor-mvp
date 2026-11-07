// lib/auth/sign-out.ts
// One reliable way to sign out from the browser. Use this instead of calling supabase.auth.signOut() directly.
//
// supabase.auth.signOut() in the browser gives up WITHOUT clearing the session when its copy of the session is stale
// or a request fails, and callers never checked the error, so members stayed signed in. This:
//   1. asks the server to sign out and delete the session cookies (/api/auth/logout, always clears them),
//   2. clears the browser's own copy (cookies and storage), even if step 1 could not be reached,
//   3. leaves with a full page load, so no cached signed-in page is shown again.
// It never hangs: each step is bounded by a timeout.

import { createClient } from '@/lib/supabase/client';
import { clearUserCache } from '@/lib/sw-cache';

const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

function clearBrowserSession() {
  try {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name && name.startsWith('sb-') && name.includes('auth-token')) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch { /* nothing to clear */ }
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-') && k.includes('auth-token')) localStorage.removeItem(k);
  } catch { /* storage unavailable */ }
}

export async function signOutAndLeave(dest = '/', scope: 'local' | 'global' = 'local'): Promise<void> {
  void clearUserCache(); // saved pages belong to this account
  await within(Promise.allSettled([
    fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }), credentials: 'same-origin', cache: 'no-store' }),
    createClient().auth.signOut({ scope: 'local' }),
  ]), 5000);
  clearBrowserSession();
  window.location.replace(dest);
}
