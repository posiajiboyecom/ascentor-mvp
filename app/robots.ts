// app/robots.ts
// Served automatically at /robots.txt.
// Blocks the authed app shell, admin, APIs, and auth flows from crawling;
// everything else (marketing layer, blog, summit) is open.

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/auth/',
          '/dashboard',
          '/coach',
          '/community',
          '/experts',
          '/learn',
          '/account',
          '/referral',
          '/onboarding',
          '/checkout',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/offline',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
