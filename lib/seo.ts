// ============================================================
// lib/seo.ts — Central SEO configuration & JSON-LD builders
// Single source of truth for site identity, canonical URLs, and
// structured data. Never hardcode ascentorbi.com in page files.
//
// NOTE: this file intentionally contains NO fabricated ratings or
// review markup. Only add aggregateRating when real, verifiable
// user reviews exist — fake ratings violate Google's structured
// data policies and can get all rich results revoked.
// ============================================================

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ascentorbi.com';
export const SITE_NAME = 'Ascentor';
export const TWITTER_HANDLE = '@ascentorhq';

// ── Elevation Summit event constants ─────────────────────────
// TODO: set exact confirmed date/time once locked with LASU.
// startDate/endDate must be ISO 8601 with timezone offset.
export const SUMMIT = {
  name: 'The Elevation Summit 2026',
  description:
    'One gathering. One decision. The rest of your life. The inaugural Elevation Summit — a movement for purposeful living, leadership, and legacy. Lagos, December 2026, with global virtual access.',
  startDate: '2026-12-12T10:00:00+01:00', // TODO: confirm exact date
  endDate: '2026-12-12T18:00:00+01:00',   // TODO: confirm exact date
  venue: {
    name: 'Femi Gbajabiamila Conference Centre, Lagos State University',
    street: 'Lagos State University Main Campus, LASU-Isheri Road',
    locality: 'Ojo',
    region: 'Lagos',
    country: 'NG',
  },
  url: `${SITE_URL}/elevation-summit`,
  // Update as ticket tiers go live. Prices in NGN.
  offers: [
    { name: 'Early Bird', price: '15000' },
    { name: 'Virtual Access', price: '5000' },
  ],
} as const;

// ── Page metadata helper (kept API-compatible) ────────────────
import type { Metadata } from 'next';

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
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: TWITTER_HANDLE,
      ...(image ? { images: [image] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ── JSON-LD builders ──────────────────────────────────────────

export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    // Connects the former brand to the current identity so search
    // engines and AI answers merge them instead of describing the
    // old "career platform" positioning.
    alternateName: ['AscentorBI', 'Ascentor BI'],
    url: SITE_URL,
    logo: `${SITE_URL}/icon/icon-512.png`,
    description:
      'Ascentor (formerly AscentorBI) is a purposeful living and leadership development platform — AI coaching with Sage, community in The Circle, expert sessions, courses, and The Elevation Summit, its annual gathering in Lagos.',
    founder: {
      '@type': 'Person',
      name: 'Ajiboye Ayomiposi Samuel',
      jobTitle: 'Founder',
    },
    sameAs: [
      'https://twitter.com/ascentorhq',
      // TODO: add Instagram / LinkedIn / YouTube profile URLs when live
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@ascentorbi.com',
      contactType: 'customer service',
    },
  };
}

export function getWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
  };
}

// Kept for backwards compatibility with components/StructuredData.tsx.
// Deliberately minimal: no offers/ratings until real data exists.
export function getSoftwareAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    description:
      'AI-powered coaching for purposeful living across six dimensions: Mind, Character, Work, Relationships, Community, and Legacy.',
  };
}

export function getSummitEventSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: SUMMIT.name,
    description: SUMMIT.description,
    startDate: SUMMIT.startDate,
    endDate: SUMMIT.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    // Physical + virtual — this value marks it as a hybrid event.
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    location: [
      {
        '@type': 'Place',
        name: SUMMIT.venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: SUMMIT.venue.street,
          addressLocality: SUMMIT.venue.locality,
          addressRegion: SUMMIT.venue.region,
          addressCountry: SUMMIT.venue.country,
        },
      },
      { '@type': 'VirtualLocation', url: SUMMIT.url },
    ],
    image: [`${SITE_URL}/opengraph-image`],
    offers: SUMMIT.offers.map((o) => ({
      '@type': 'Offer',
      name: o.name,
      price: o.price,
      priceCurrency: 'NGN',
      availability: 'https://schema.org/InStock',
      url: SUMMIT.url,
      validFrom: '2026-08-01T00:00:00+01:00',
    })),
    organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };
}

export function getArticleSchema(post: {
  title: string;
  excerpt?: string | null;
  slug: string;
  author_name?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  cover_image?: string | null; // matches blog_posts.cover_image column
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? undefined,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    image: post.cover_image ? [post.cover_image] : [`${SITE_URL}/opengraph-image`],
    author: { '@type': 'Person', name: post.author_name || 'Ascentor Editorial' },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon/icon-512.png` },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };
}

export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
