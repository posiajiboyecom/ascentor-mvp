'use client';

// Fires the community-gate modal whenever the URL contains ?gate=1.
// This is triggered by the proxy middleware redirecting /login and /signup.

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export default function GateAutoOpen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get('gate') === '1') {
      window.dispatchEvent(new Event('community-gate'));
      // Remove the ?gate=1 param from the URL without a page reload
      const params = new URLSearchParams(searchParams.toString());
      params.delete('gate');
      const clean = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(clean, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  return null;
}
