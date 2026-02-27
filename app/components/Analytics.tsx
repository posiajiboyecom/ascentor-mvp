'use client';

// ============================================================
// ANALYTICS — Plausible Analytics + Custom Event Tracking
//
// Why Plausible: Privacy-friendly (no cookie banner needed),
// lightweight (< 1KB), open source, GDPR compliant out of box.
// Perfect for African market where trust matters.
//
// Setup: Sign up at https://plausible.io (or self-host)
//        Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN in env vars.
//
// Usage in layout.tsx:
//   import AnalyticsProvider from '@/components/Analytics';
//   <AnalyticsProvider />
//
// Track events anywhere:
//   import { trackEvent } from '@/lib/analytics';
//   trackEvent('signup_completed', { method: 'google' });
// ============================================================

import Script from 'next/script';

const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || '';
const PLAUSIBLE_API = process.env.NEXT_PUBLIC_PLAUSIBLE_API_HOST || 'https://plausible.io';

export default function AnalyticsProvider() {
  if (!PLAUSIBLE_DOMAIN) return null;

  return (
    <>
      {/* Plausible — lightweight, privacy-first analytics */}
      <Script
        defer
        data-domain={PLAUSIBLE_DOMAIN}
        src={`${PLAUSIBLE_API}/js/script.tagged-events.revenue.js`}
        strategy="afterInteractive"
      />
      {/* Initialize plausible queue */}
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }`}
      </Script>
    </>
  );
}
