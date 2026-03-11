import type { NextConfig } from 'next';

// ── Content Security Policy ───────────────────────────────────────────────────
// Restricts which resources the browser can load. Adjust if you add new
// external scripts, fonts, or API domains.
const CSP = [
  // Only load scripts from our own origin + trusted CDNs
  `script-src 'self' 'unsafe-inline' https://js.paystack.co https://plausible.io https://cdnjs.cloudflare.com`,
  // Styles: self + inline (required by Next.js) + Google Fonts
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  // Fonts: self + Google Fonts CDN
  `font-src 'self' data: https://fonts.gstatic.com`,
  // Images: self + data URIs + Supabase storage bucket
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

const nextConfig: NextConfig = {
  // Keep web-push on the server only — it uses Node.js built-ins
  // that don't exist in the browser and will crash client-side.
  serverExternalPackages: ['web-push'],

  // ── Image domains — allow partner logos from Supabase ─────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'ascentorbi.com',
      },
      {
        protocol: 'https',
        hostname: '*.ascentorbi.com', // Partner subdomains
      },
    ],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Allow partner custom domains to load assets via API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin',      value: '*' },
          { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // ── Rewrites — custom domain → internal partner routes ────
  // NOTE: The proxy.ts middleware handles most routing.
  // This is a backup for edge cases Next.js can't rewrite
  // in middleware (e.g. static asset paths).
  async rewrites() {
    return {
      beforeFiles: [
        // /p/[subdomain] → served by app/p/[subdomain] directory
        // Already handled by directory structure — no rewrite needed
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

// ============================================================
// VERCEL CONFIG — vercel.json
//
// Add this to your project root vercel.json (create if missing).
// This tells Vercel to route ALL custom partner domains
// to your Next.js app so proxy.ts can handle them.
// ============================================================
//
// {
//   "rewrites": [
//     {
//       "source": "/(.*)",
//       "destination": "/$1"
//     }
//   ]
// }
//
// Then in Vercel dashboard:
// Settings → Domains → Add Domain → coaching.johnadeyemi.com
// Partner sets CNAME: coaching.johnadeyemi.com → cname.vercel-dns.com
// ============================================================
