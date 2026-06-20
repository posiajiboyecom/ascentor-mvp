// ============================================================
// SEO METADATA — Root layout metadata for Ascentor
// Place in: app/layout.tsx (merge with existing)
//
// Next.js App Router uses the exported `metadata` object
// for automatic <head> tag generation.
// ============================================================

import type { Metadata, Viewport } from 'next';

// Base URL — update after deployment
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ascentor-mvp.vercel.app';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0D14' },
    { media: '(prefers-color-scheme: light)', color: '#0A0D14' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: 'Ascentor — AI Leadership Coaching for Ambitious Professionals',
    template: '%s | Ascentor',
  },

  description:
    'AI-powered leadership coaching for purposeful individuals worldwide. Get personalized coaching, join expert-led communities, and accelerate your career growth.',

  keywords: [
    'AI coaching', 'leadership coaching', 'purposeful individuals',
    'purposeful development', 'executive coaching', 'AI mentor',
    'professional development', 'leadership skills', 'global leaders',
    'coaching platform', 'career growth', 'management skills',
  ],

  authors: [{ name: 'Ascentor', url: BASE_URL }],
  creator: 'Ascentor',
  publisher: 'Ascentor',

  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Ascentor',
    title: 'Ascentor — AI Leadership Coaching for Ambitious Professionals',
    description:
      'Personalized AI coaching, expert-led communities, and courses designed to develop the next generation of global leaders.',
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Ascentor — AI Leadership Coaching',
        type: 'image/png',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Ascentor — AI Leadership Coaching for Ambitious Professionals',
    description:
      'Personalized AI coaching for purposeful individuals worldwide. Start your .',
    images: [`${BASE_URL}/og-image.png`],
    creator: '@ascentorbi',
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },

  // Manifest (PWA)
  manifest: '/manifest.json',

  // Verification (add your IDs)
  // verification: {
  //   google: 'your-google-verification-id',
  // },

  // Category
  category: 'education',

  // Alternate languages (future)
  // alternates: {
  //   languages: { 'fr': '/fr', 'sw': '/sw' },
  // },
};

// ============================================================
// PAGE-SPECIFIC METADATA HELPERS
// Use in individual page files:
//
// import { generatePageMetadata } from '@/lib/seo';
// export const metadata = generatePageMetadata({ ... });
// ============================================================

export function generatePageMetadata({
  title,
  description,
  path = '',
  image,
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${BASE_URL}${path}`;
  const ogImage = image || `${BASE_URL}/og-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ============================================================
// STRUCTURED DATA (JSON-LD)
// Add to root layout or specific pages
// ============================================================

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Ascentor',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'AI-powered leadership coaching for purposeful individuals',
    sameAs: [
      'https://twitter.com/ascentorbi',
      'https://linkedin.com/company/ascentor',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@ascentorbi.com',
      contactType: 'customer service',
    },
  };
}

export function getSoftwareAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Ascentor',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '15',
      highPrice: '49',
      priceCurrency: 'USD',
      offerCount: 3,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '50',
    },
  };
}
