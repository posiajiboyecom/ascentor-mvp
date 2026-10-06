// lib/auth/account-lookup.ts
// Finds an existing account by email and reports HOW it signs in. This is what lets sign-up and
// sign-in say "use Google instead" or "you already have an account" instead of a generic error.
// Deliberately explicit (it reveals that an address is registered); the endpoints that call it are
// rate limited and CAPTCHA protected.
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface AccountInfo {
  id: string;
  providers: string[];
  emailConfirmed: boolean;
  /** True when the account can sign in with an email and password. */
  hasPassword: boolean;
}

export const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  linkedin_oidc: 'LinkedIn',
  linkedin: 'LinkedIn',
  email: 'email and password',
};

export const OAUTH_PROVIDERS = ['google', 'linkedin_oidc', 'linkedin'];

export async function findAccountByEmail(rawEmail: string): Promise<AccountInfo | null> {
  const email = rawEmail.toLowerCase().trim();
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (!profile) return null;

  const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const user = data?.user;
  if (!user) return null;

  const fromMeta = [...((user.app_metadata?.providers as string[] | undefined) ?? []), user.app_metadata?.provider as string | undefined];
  const fromIdentities = (user.identities ?? []).map((i) => i.provider);
  const providers = [...new Set([...fromMeta, ...fromIdentities].filter((p): p is string => Boolean(p)))];

  return {
    id: user.id,
    providers,
    emailConfirmed: Boolean(user.email_confirmed_at),
    hasPassword: providers.includes('email'),
  };
}

/** The OAuth provider an account uses, if it has no password. */
export function oauthOnlyProvider(account: AccountInfo | null): string | null {
  if (!account || account.hasPassword) return null;
  return account.providers.find((p) => OAUTH_PROVIDERS.includes(p)) ?? null;
}
