import type { NextConfig } from 'next';

// ── Content Security Policy ───────────────────────────────────────────────────
// NOTE: script-src 'unsafe-inline' has been removed (M-06 fix).
// The per-request nonce is now injected by proxy.ts (the Next.js middleware),
// which overwrites this header with a nonce-based CSP on every request.
// This static CSP is a fallback only - it applies to routes the middleware
// does not process (e.g., _next/static assets). It intentionally omits
// script-src 'unsafe-inline' so those paths also stay protected.
const CSP = [
  // script-src: nonce is set dynamically in proxy.ts per request
  // This fallback only covers static assets (no inline scripts needed there)
  `script-src 'self' https://challenges.cloudflare.com https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com https://www.youtube.com https://s.ytimg.com https://c.daily.co https://c.dailywebrtc.com https://*.daily.co https://*.dailywebrtc.com https://*.dailywebrtc.net 'wasm-unsafe-eval'`,
  // Styles: self + inline (required by Next.js CSS-in-JS) + Google Fonts
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://paystack.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https://i.ytimg.com https:`,
  `frame-src https://challenges.cloudflare.com https://js.paystack.co https://checkout.paystack.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://checkout.paystack.com https://plausible.io https://api.bufferapp.com https://www.youtube.com https://*.daily.co wss://*.daily.co https://*.dailywebrtc.com wss://*.dailywebrtc.com https://*.dailywebrtc.net wss://*.dailywebrtc.net https://*.banuba.cloud https://*.ingest.sentry.io https://*.pluot.blue wss://*.pluot.blue https://*.r2.dev https://*.r2.cloudflarestorage.com`,
  `media-src 'self' blob: https://*.supabase.co https://*.r2.dev`,
  `worker-src 'self' blob:`,
  `default-src 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  // Prevents browsers from MIME-sniffing responses away from declared type
  { key: 'X-Content-Type-Options',       value: 'nosniff' },
  // Prevents clickjacking - only allow embedding from same origin
  { key: 'X-Frame-Options',              value: 'SAMEORIGIN' },
  // Forces HTTPS for 1 year, includes subdomains
  { key: 'Strict-Transport-Security',    value: 'max-age=31536000; includeSubDomains; preload' },
  // Controls how much referrer info is sent with requests
  { key: 'Referrer-Policy',              value: 'strict-origin-when-cross-origin' },
  // Disables browser features we don't use
  { key: 'Permissions-Policy',           value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()' },
  // Cross-Origin policies - use same-origin-allow-popups so YouTube's
  // iframe player postMessage API works while retaining Spectre mitigations.
  { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin-allow-popups' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
  // Content Security Policy
  { key: 'Content-Security-Policy',      value: CSP },
];

const nextConfig: NextConfig = {
  // ── Production hardening ────────────────────────────────────────
  // No "X-Powered-By: Next.js" fingerprint, no public source maps, and console.log/debug stripped
  // from production bundles (error / warn / info stay, so operational logs still reach Vercel).
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn', 'info'] } : false,
  },

  // Keep these on the server only - they use Node.js built-ins
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
      { source: '/how-it-works', destination: '/movement',         permanent: false },
      { source: '/products',     destination: '/shop',             permanent: false },
      { source: '/mentor-apply', destination: '/elevation-summit', permanent: false },
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
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
