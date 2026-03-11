import type { NextConfig } from 'next';

// ── Content Security Policy ───────────────────────────────────────────────────
// Restricts which resources the browser can load.
// WHITE-LABEL ADDITIONS: Added fonts.googleapis.com (already present),
// *.supabase.co already covers partner logo storage.
const CSP = [
  // Only load scripts from our own origin + trusted CDNs
  `script-src 'self' 'unsafe-inline' https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com`,
  // Styles: self + inline (required by Next.js) + Google Fonts
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  // Fonts: self + Google Fonts CDN
  `font-src 'self' data: https://fonts.gstatic.com`,
  // Images: self + data URIs + Supabase storage bucket (covers partner logos) + Gravatar
  `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com`,
  // Frames: only Paystack iframe + YouTube embeds
  `frame-src https://js.paystack.co https://www.youtube.com https://youtube.com`,
  // API/fetch calls: self + Supabase + Anthropic + Paystack + Plausible
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://plausible.io`,
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
  // Cross-Origin policies (required for SharedArrayBuffer + Spectre mitigations)
  { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Content Security Policy
  { key: 'Content-Security-Policy',      value: CSP },
];

// ── Partner API CORS headers ──────────────────────────────────────────────────
// Applied ONLY to /api/partner/* routes — allows partner custom domains
// to call back to Ascentor APIs (webhook verification, brand fetch, etc.)
// Does NOT relax security on any other route.
const partnerApiHeaders = [
  { key: 'Access-Control-Allow-Credentials', value: 'true'                                          },
  { key: 'Access-Control-Allow-Origin',      value: '*'                                             },
  { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,DELETE,OPTIONS'                   },
  { key: 'Access-Control-Allow-Headers',     value: 'Content-Type, Authorization, x-partner-id'    },
];

const nextConfig: NextConfig = {
  // Keep web-push on the server only — it uses Node.js built-ins
  // that don't exist in the browser and will crash client-side.
  serverExternalPackages: ['web-push'],

  // ── Image domains ─────────────────────────────────────────────────────────
  // Allows Next.js <Image> to serve partner logos from Supabase storage
  // and partner custom domains.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      // ── Security headers on ALL routes (your existing setup) ──────────────
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // ── CORS on partner API routes only ───────────────────────────────────
      // Needed so partner custom domains (coaching.amara.com) can POST
      // to ascentorbi.com/api/partner/* without CORS block.
      {
        source: '/api/partner/:path*',
        headers: partnerApiHeaders,
      },
      // ── Preflight OPTIONS for partner API ─────────────────────────────────
      {
        source: '/api/partner/:path*',
        headers: [{ key: 'Access-Control-Max-Age', value: '86400' }],
      },
    ];
  },
};

export default nextConfig;
