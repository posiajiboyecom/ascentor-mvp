// lib/useApiBase.ts
//
// Returns the base URL to prefix /api/... calls with.
//
// The partner admin layout (app/p/[subdomain]/admin/layout.tsx) injects a
// <meta name="x-ascentor-api-base"> tag whose content is the
// x-ascentor-api-base response header set by proxy.ts on every
// partner subdomain / custom domain request.
//
// Value is 'https://ascentorbi.com' on partner subdomains and custom domains.
// Value is '' on ascentorbi.com itself (relative URLs work fine there).
//
// Usage:
//   const apiBase = useApiBase();
//   fetch(`${apiBase}/api/partner/analytics`)

'use client';
import { useState } from 'react';

function getApiBase(): string {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="x-ascentor-api-base"]'
  );
  return meta?.content || '';
}

export function useApiBase(): string {
  // Reads synchronously from the <meta> tag injected by the server layout.
  // useState(getApiBase) runs the initialiser once on first render — the meta
  // tag is already in the DOM at that point so the value is always correct
  // and no useEffect / re-render is needed.
  const [base] = useState<string>(getApiBase);
  return base;
}
