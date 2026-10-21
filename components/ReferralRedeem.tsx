'use client';

import { useEffect } from 'react';

/** Applies a referral code remembered by /signup (localStorage) once the new member is signed in. */
export default function ReferralRedeem() {
  useEffect(() => {
    let code: string | null = null;
    try { code = localStorage.getItem('ascentor_referral'); } catch { return; }
    if (!code) return;
    fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode: code }),
    })
      .then((res) => {
        // Applied, already applied, invalid or own code: nothing more to try. Keep it only on server errors.
        if (res.status < 500) { try { localStorage.removeItem('ascentor_referral'); } catch { /* ignore */ } }
      })
      .catch(() => { /* offline: try again next visit */ });
  }, []);
  return null;
}
