import { createBrowserClient } from '@supabase/ssr';

// ── Supabase browser client ────────────────────────────────────────────────
// Single shared instance for all client components. We disable autoRefreshToken
// here and instead handle token refresh manually via the global auth listener
// in AuthErrorHandler — this prevents the uncaught "Invalid Refresh Token:
// Refresh Token Not Found" console error that fires when Supabase tries to
// silently refresh an expired/missing refresh token.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}