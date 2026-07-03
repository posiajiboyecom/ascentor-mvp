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
  // Images: self + data URIs + Supabase + any https (blog cover images, social media)
  `img-src 'self' data: blob: https://*.supabase.co https://www.gravatar.com https:`,
  // Frames: only Paystack iframe + YouTube embeds
  `frame-src https://js.paystack.co https://www.youtube.com https://youtube.com`,
  // API/fetch calls: self + Supabase + Anthropic + Paystack + Plausible + Buffer
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.paystack.co https://plausible.io https://api.bufferapp.com`,
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
