// lib/auth/post-login.ts
// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth for "where does this person go after signing in?"
// Used by /auth/callback (OAuth + email-confirmation links) and /auth/continue
// (email + password sign-in), so every sign-in method lands in the same place.
//
// Priority:
//   1. Staff (admin / moderator)          → `next` (or /dashboard)
//   2. onboarding_completed               → `next` (never back into checkout/onboarding)
//   3. Paid but not onboarded             → /onboarding   (they still need a goal)
//   4. next = /onboarding                 → /onboarding
//   5. next = /checkout?...               → that checkout (paid-plan intent)
//   6. Started onboarding                 → /onboarding?step=2
//   7. Fresh user                         → /onboarding
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { safeNext } from './safe-next';

export async function resolvePostLoginPath(
  supabase: SupabaseClient,
  user: User,
  rawNext: string | null | undefined,
): Promise<string> {
  const next = safeNext(rawNext, '/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, subscription_status, full_name, primary_dimension, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role === 'admin' || profile?.role === 'moderator') return next;

  if (profile?.onboarding_completed === true) {
    return next.startsWith('/checkout') || next.startsWith('/onboarding') ? '/dashboard' : next;
  }

  if (next.startsWith('/onboarding')) return '/onboarding';
  if (next.startsWith('/checkout')) return next;

  if (profile?.full_name && profile?.primary_dimension) return '/onboarding?step=2';
  return '/onboarding';
}
