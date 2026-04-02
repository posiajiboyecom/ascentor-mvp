'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// FEATURE #3: SSO (Google + LinkedIn OAuth) — Config & Helpers
// This module provides robust OAuth sign-in with error handling,
// token refresh, and session validation.
// ============================================================

const supabase = createClient();

type OAuthProvider = 'google' | 'linkedin_oidc';

interface SSOResult {
  success: boolean;
  error?: string;
  url?: string;
}

/**
 * Initiate OAuth sign-in with proper redirect and error handling.
 * Replaces direct supabase.auth.signInWithOAuth calls throughout the app.
 */
export async function signInWithSSO(provider: OAuthProvider, redirectTo?: string): Promise<SSOResult> {
  try {
    const callbackUrl = redirectTo || `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
        queryParams: provider === 'google'
          ? { access_type: 'offline', prompt: 'consent' }
          : {},
      },
    });

    if (error) {
      console.error(`SSO ${provider} error:`, error.message);
      return {
        success: false,
        error: getReadableError(provider, error.message),
      };
    }

    return { success: true, url: data.url };
  } catch (err: any) {
    console.error(`SSO ${provider} unexpected error:`, err);
    return {
      success: false,
      error: 'Something went wrong. Please try again.',
    };
  }
}

/**
 * Check if current session is valid and refresh if needed.
 */
export async function validateSession(): Promise<{ valid: boolean; userId?: string }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      // Try refreshing
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        return { valid: false };
      }
      return { valid: true, userId: refreshed.session.user.id };
    }

    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 - Date.now() < 5 * 60 * 1000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session) {
        return { valid: true, userId: refreshed.session.user.id };
      }
    }

    return { valid: true, userId: session.user.id };
  } catch {
    return { valid: false };
  }
}

/**
 * Get the OAuth provider the user originally signed up with.
 */
export async function getAuthProvider(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const provider = user.app_metadata?.provider;
    return provider || 'email';
  } catch {
    return null;
  }
}

/**
 * Sign out from all devices (revokes all refresh tokens).
 */
export async function signOutAllDevices(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to sign out from all devices.' };
  }
}

// --- Helper ---
function getReadableError(provider: OAuthProvider, raw: string): string {
  if (raw.includes('provider is not enabled')) {
    return `${provider === 'google' ? 'Google' : 'LinkedIn'} sign-in is not configured. Please contact support.`;
  }
  if (raw.includes('popup_closed_by_user') || raw.includes('access_denied')) {
    return 'Sign-in was cancelled. Please try again.';
  }
  if (raw.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }
  return `Unable to sign in with ${provider === 'google' ? 'Google' : 'LinkedIn'}. Please try again.`;
}

// --- OAuth Button Components ---
interface OAuthButtonProps {
  provider: OAuthProvider;
  onError?: (error: string) => void;
  disabled?: boolean;
  redirectTo?: string; // FIX: allow passing custom redirect (e.g. /checkout?plan=pro)
}

export function OAuthButton({ provider, onError, disabled, redirectTo }: OAuthButtonProps) {
  const handleClick = async () => {
    const result = await signInWithSSO(provider, redirectTo);
    if (!result.success && onError) {
      onError(result.error || 'Sign-in failed');
    }
  };

  const isGoogle = provider === 'google';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid var(--border, #2A2D3A)',
        background: 'var(--bg-input, #1A1D2E)',
        color: 'var(--text, #F1F0EB)',
        fontSize: '14px',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
      }}
    >
      {isGoogle ? (
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )}
      Continue with {isGoogle ? 'Google' : 'LinkedIn'}
    </button>
  );
}
