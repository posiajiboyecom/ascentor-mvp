// ============================================================
// lib/seo.ts - Central SEO configuration & JSON-LD builders
// Single source of truth for site identity, canonical URLs, and
// structured data. Never hardcode joinascentor.com in page files.
//
// NOTE: this file intentionally contains NO fabricated ratings or
// review markup. Only add aggregateRating when real, verifiable
// user reviews exist - fake ratings violate Google's structured
// data policies and can get all rich results revoked.
// ============================================================

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://joinascentor.com';
export const SITE_NAME = 'Ascentor';
export const TWITTER_HANDLE = '@ascentorhq';

// Default social card: the dynamic app/opengraph-image.tsx (1200x630). Next stops inheriting the
// root OG image as soon as a page defines its own openGraph block, so pages pass this explicitly.
// Summit pages share the official flyer.
export const SUMMIT_OG_IMAGE = { url: `${SITE_URL}/images/elevation-summit-flyer-v3.jpg`, width: 1200, height: 1600, alt: 'The Elevation Summit, 19 November 2026, Lagos State University' };
export const DEFAULT_OG_IMAGE = { url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Ascentor, the platform of The Elevation Summit' };

// ── Elevation Summit event constants ─────────────────────────
// startDate/endDate must be ISO 8601 with timezone offset.
export const SUMMIT = {
  name: 'The Elevation Summit 2026',
  description:
    'One gathering. One decision. The rest of your life. The Elevation Summit 2.0 is a movement for purposeful living, leadership, and legacy. 19 November 2026 at Lagos State University, Ojo, with global virtual access. Registration is free.',
  startDate: '2026-11-19T10:00:00+01:00', // Date Confirmed
  endDate: '2026-11-19T15:00:00+01:00',   // Date Confirmed
  venue: {
    name: 'Aderemi Makanjuola Hall, Lagos State University',
    street: 'Lagos State University Main Campus, LASU-Isheri Road',
    locality: 'Ojo',
    region: 'Lagos',
    country: 'NG',
  },
  url: `${SITE_URL}/elevation-summit`,
  // Registration is free (one free ticket for in-person or virtual).
  offers: [{ name: 'Free registration', price: '0' }],
} as const;

// ── Page metadata helper (kept API-compatible) ────────────────
import { SUPPORT_EMAIL } from '@/lib/contact';
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
      type: 'website',
      images: [image ? { url: image, width: 1200, height: 630 } : DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: TWITTER_HANDLE,
      images: [image ?? DEFAULT_OG_IMAGE.url],
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
      'Ascentor (formerly AscentorBI) is a purposeful living and leadership development platform: AI coaching with Sage, community in The Circle, expert sessions, courses, and The Elevation Summit, its annual gathering in Lagos.',
    founder: {
      '@type': 'Person',
      name: 'Ajiboye Ayomiposi Samuel',
      jobTitle: 'Founder',
    },
    sameAs: [
      'https://twitter.com/ascentorhq',
      'https://www.linkedin.com/company/joinascentor',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: SUPPORT_EMAIL,
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
    isAccessibleForFree: true,
    sameAs: ['https://x.com/elevatnsummit', 'https://www.instagram.com/theelevationsummit'],
    // Physical + virtual - this value marks it as a hybrid event.
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

/**
 * Serialises JSON-LD for a <script type="application/ld+json"> tag. JSON.stringify alone leaves "<" as-is,
 * so a title containing "</script>" (CMS or DB text) could close the tag and inject markup. Escaping
 * < > & and the JS line separators keeps the JSON identical for parsers and inert for the HTML parser.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** schema.org Event for a CMS event page (public_events row). Only emitted when the event has a date. */
export function getPublicEventSchema(e: {
  slug: string; title: string; tagline?: string | null; description?: string | null;
  event_date_iso?: string | null; location?: string | null; registration_open?: boolean | null;
}) {
  if (!e.event_date_iso) return null;
  const url = `${SITE_URL}/events/${e.slug}`;
  const online = !e.location || /online|virtual|zoom|livestream/i.test(e.location);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    description: e.tagline || e.description?.slice(0, 300) || undefined,
    startDate: e.event_date_iso,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: online
      ? { '@type': 'VirtualLocation', url }
      : { '@type': 'Place', name: e.location, address: e.location },
    organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    url,
    ...(e.registration_open ? { offers: { '@type': 'Offer', url, price: '0', priceCurrency: 'NGN', availability: 'https://schema.org/InStock' } } : {}),
  };
}
