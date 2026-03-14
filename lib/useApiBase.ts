// lib/useApiBase.ts
//
// Returns the base URL to prefix /api/... calls with.
// On ascentorbi.com: returns '' so relative URLs work unchanged.
// On partner subdomains (demo.ascentorbi.com) or custom domains:
// returns 'https://ascentorbi.com' so API calls route correctly.
//
// Usage:
//   const apiBase = useApiBase();
//   fetch(`${apiBase}/api/partner/analytics`)

'use client';
import { useState } from 'react';

function getApiBase(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'ascentorbi.com' || host === 'localhost' || host === '127.0.0.1') {
    return '';
  }
  // Partner subdomain or custom domain — must prefix with main app origin
  return 'https://ascentorbi.com';
}

export function useApiBase(): string {
  // Initialise synchronously so the value is correct on the very first render.
  // Previously this used useState('') + useEffect, which meant the first render
  // always had base='' — on partner subdomains the first fetch would hit the wrong
  // host, fail, and set the error state before the correct base was available.
  const [base] = useState<string>(getApiBase);
  return base;
}
