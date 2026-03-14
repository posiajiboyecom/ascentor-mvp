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
import { useState, useEffect } from 'react';

export function useApiBase(): string {
  const [base, setBase] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    // If we're on the main app domain, relative URLs work fine
    if (host === 'ascentorbi.com' || host === 'localhost' || host === '127.0.0.1') {
      setBase('');
    } else {
      // Partner subdomain or custom domain — must prefix with main app origin
      setBase('https://ascentorbi.com');
    }
  }, []);

  return base;
}
