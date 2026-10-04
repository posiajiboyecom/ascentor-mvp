// lib/auth/admin-mfa.ts
// Second-factor (TOTP) enforcement for staff. Off by default so nobody is locked
// out before they have enrolled: set ADMIN_MFA_REQUIRED=true once admins have
// enrolled an authenticator (the admin sign-in page walks them through it).
// TOTP must be enabled in Supabase: Authentication -> Multi-Factor.
import type { SupabaseClient } from '@supabase/supabase-js';

export const adminMfaRequired = () => process.env.ADMIN_MFA_REQUIRED === 'true';

/** True when the current session has passed a second factor (aal2). */
export async function sessionIsAal2(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === 'aal2';
  } catch {
    return false;
  }
}
