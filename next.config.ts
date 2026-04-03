import type { NextConfig } from 'next';

// ── Content Security Policy ───────────────────────────────────────────────────
const CSP = [
  // Scripts: self + inline (Next.js) + Paystack inline SDK + analytics
  `script-src 'self' 'unsafe-inline' https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com`,

  // Styles: self + inline + Google Fonts
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,

  // Fonts: self + Google Fonts CDN
  `font-src 'self' data: https://fonts.gstatic.com`,

  // Images: self + data URIs + blob + Supabase + Gravatar + any https
  `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https:`,

  // Frames: Paystack checkout iframe + YouTube embeds
  `frame-src https://js.paystack.co https://checkout.paystack.com https://www.youtube.com https://youtube.com`,

  // API/WebSocket connections:
  // FIX 1: Added https://js.paystack.co — the Paystack inline script makes
  //         fetch calls back to js.paystack.co. Without this the SW intercept
  //         attempt triggers a CSP violation and the popup never opens.
  // FIX 2: Added wss://js.paystack.co for Paystack's WebSocket channel.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://js.paystack.co wss://js.paystack.co https://checkout.paystack.com https://plausible.io https://api.bufferapp.com`,

  // Workers / service worker
  `worker-src 'self' blob:`,

  // Everything else: self only
  `default-src 'self'`,

  // Block all <object> / <embed> / Flash
  `object-src 'none'`,

  // Upgrade any accidental http: requests to https:
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options',       value: 'nosniff' },
  { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
  { key: 'Strict-Transport-Security',    value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Referrer-Policy',              value: 'strict-origin-when-cross-origin' },

  // FIX 3: payment=() was BLOCKING the Paystack Payment Request API.
  // Removed payment from the deny list so Paystack's iframe can function.
  { key: 'Permissions-Policy',           value: 'camera=(), microphone=(), geolocation=()' },

  { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy',      value: CSP },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['web-push'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
