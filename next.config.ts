import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ─── Required for Vercel build to pass ──────────────────────────────────────
  // Ignore TypeScript errors during build (remove once all types are clean)
  

  // ─── Prevent build hangs ─────────────────────────────────────────────────────
  // Exclude the bloated icon folders from Vercel's file tracing.
  // The "Ascentor — AI Leadership Coach..." folder alone has 17 downloaded web
  // assets that should never be in the repo — they slow tracing to a crawl.
  outputFileTracingExcludes: {
    '*': [
      'public/icon/AppImages/**',
      'public/icon/AppImages (1)/**',
      'public/icon/Ascentor*/**',
    ],
  },

  // ─── Image domains ──────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // ─── Subdomain / white-label rewrites ────────────────────────────────────────
  // This rewrites requests from partner subdomains (e.g. acme.ascentor.co)
  // to the /p/[subdomain] route group, which reads the tenant config from DB.
  //
  // HOW IT WORKS:
  //   acme.ascentor.co/dashboard  →  /p/acme/dashboard
  //   acme.ascentor.co/           →  /p/acme
  //   ascentor.co/partner         →  serves the /partner admin portal (no rewrite needed)
  //
  // For local dev: use header x-subdomain or set NEXT_PUBLIC_SUBDOMAIN in .env.local
  async rewrites() {
    return {
      beforeFiles: [
        // Skip rewrites for the main domain and known top-level paths
        // so they continue serving the default Ascentor app
        {
          source: '/:path*',
          has: [
            {
              type: 'host',
              // matches *.ascentor.co but NOT ascentor.co itself
              value: '(?<subdomain>[^.]+)\\.ascentor\\.co',
            },
          ],
          destination: '/p/:subdomain/:path*',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  // ─── Headers ─────────────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Security headers on all routes
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
