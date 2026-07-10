import type { NextConfig } from 'next';

// ── Content Security Policy ───────────────────────────────────────────────────
// NOTE: script-src 'unsafe-inline' has been removed (M-06 fix).
// The per-request nonce is now injected by proxy.ts (the Next.js middleware),
// which overwrites this header with a nonce-based CSP on every request.
// This static CSP is a fallback only — it applies to routes the middleware
// does not process (e.g., _next/static assets). It intentionally omits
// script-src 'unsafe-inline' so those paths also stay protected.
const CSP = [
  // script-src: nonce is set dynamically in proxy.ts per request
  // This fallback only covers static assets (no inline scripts needed there)
  `script-src 'self' https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com https://www.youtube.com https://s.ytimg.com`,
  // Styles: self + inline (required by Next.js CSS-in-JS) + Google Fonts
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https://i.ytimg.com https:`,
  `frame-src https://js.paystack.co https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://plausible.io https://api.bufferapp.com https://www.youtube.com`,
  `worker-src 'self' blob:`,
  `default-src 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  // Prevents browsers from MIME-sniffing responses away from declared type
  { key: 'X-Content-Type-Options',       value: 'nosniff' },
  // Prevents clickjacking — only allow embedding from same origin
  { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
  // Forces HTTPS for 1 year, includes subdomains
  { key: 'Strict-Transport-Security',    value: 'max-age=31536000; includeSubDomains; preload' },
  // Controls how much referrer info is sent with requests
  { key: 'Referrer-Policy',              value: 'strict-origin-when-cross-origin' },
  // Disables browser features we don't use
  { key: 'Permissions-Policy',           value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Cross-Origin policies — use same-origin-allow-popups so YouTube's
  // iframe player postMessage API works while retaining Spectre mitigations.
  { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
  // Content Security Policy
  { key: 'Content-Security-Policy',      value: CSP },
];

const nextConfig: NextConfig = {
  // Keep these on the server only — they use Node.js built-ins
  // or native binaries that don't exist in the browser.
  //
  // pdfkit + fontkit: fontkit imports applyDecoratedDescriptor from @swc/helpers,
  // which was renamed to _apply_decorated_descriptor in newer versions. Turbopack
  // catches this at build time (webpack didn't). Marking pdfkit as external tells
  // Turbopack to leave it as a Node.js require() instead of bundling it, which
  // bypasses the ESM re-export mismatch entirely. fontkit is included explicitly
  // because it's the actual source of the broken import.
  serverExternalPackages: [
    'web-push',
    'pdfkit',
    'fontkit',
  ],

  // ── Redirects for deprecated pages ──────────────────────────────
  async redirects() {
    return [
      { source: '/pricing',      destination: '/community',        permanent: false },
      { source: '/who-its-for',  destination: '/movement',         permanent: false },
      { source: '/how-it-works', destination: '/movement',         permanent: false },
      { source: '/products',     destination: '/community',        permanent: false },
      { source: '/mentor-apply', destination: '/elevation-summit', permanent: false },
      { source: '/circle',       destination: '/community',        permanent: false },
      { source: '/summit',       destination: '/elevation-summit', permanent: false },
    ];
  },

  // ── Security headers ─────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ── Images ───────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
