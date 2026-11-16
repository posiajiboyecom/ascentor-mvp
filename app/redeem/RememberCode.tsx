'use client';
// Keeps the code on this device while the visitor creates an account, so it's used automatically when they
// finish onboarding (app/onboarding/actions.ts). Thirty days; cleared once used.
import { useEffect } from 'react';
import { REWARD_COOKIE } from '@/lib/rewards/cookie';

export default function RememberCode({ code }: { code: string }) {
  useEffect(() => {
    if (!code) return;
    document.cookie = `${REWARD_COOKIE}=${encodeURIComponent(code)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }, [code]);
  return null;
}
