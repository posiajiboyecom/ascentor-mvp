'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// /signup redirects to /login?mode=signup
// Preserves plan and billing params from pricing page
export default function SignupPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const query = new URLSearchParams();
    query.set('mode', 'signup');

    const plan    = params.get('plan');
    const billing = params.get('billing');
    if (plan)    query.set('plan', plan);
    if (billing) query.set('billing', billing);

    router.replace(`/login?${query.toString()}`);
  }, [router, params]);

  return null;
}
