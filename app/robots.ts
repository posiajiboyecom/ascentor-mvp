// app/robots.ts
// Served automatically at /robots.txt.
// Blocks the authed app shell, admin, APIs, and auth flows from crawling;
// everything else (marketing layer, blog, summit) is open. No crawler is singled out: GPTBot, OAI-SearchBot, ClaudeBot,
// PerplexityBot, Google-Extended and Bingbot all fall under the open '*' rule on purpose, so Ascentor can appear in AI answers.
// Also check that no firewall or bot protection in front of the site (Vercel, Cloudflare) blocks them.

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
          '/circle',
          '/sessions',
          '/messages',
          '/profile',
          '/settings',
          '/sage',
          '/search',
          '/store',
          '/notifications',
          '/announcements',
          '/growth',
          '/help',
          '/call',
          '/facilitator',
          '/admin-login',
          '/leader-invite',
          '/payment',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
