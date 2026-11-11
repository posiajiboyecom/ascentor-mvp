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
          // Staff, partner portal and APIs
          '/admin', '/admin-login', '/partner$', '/partner/', '/api/',
          // Auth flows and personal links
          '/auth/', '/login', '/signup', '/forgot-password', '/reset-password',
          '/leader-invite/', '/facilitator/', '/join/', '/unsubscribe/', '/survey/',
          // Signed-in member app (app/(app)/*)
          '/dashboard', '/coach', '/community', '/experts', '/learn', '/courses', '/account',
          '/referral', '/onboarding', '/circle', '/sessions', '/messages', '/growth', '/profile',
          '/settings', '/announcements', '/sage', '/call', '/store', '/notifications', '/search', '/help',
          // Transactional pages
          '/checkout', '/shop/cart$', '/shop/thanks$', '/donate/confirmed', '/elevation-summit/confirmed',
          '/elevation-summit/ticket', '/elevation-summit/watch', '/free/*/download',
          '/offline',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
