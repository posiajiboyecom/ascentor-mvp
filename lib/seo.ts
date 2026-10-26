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
// TODO(posi): the SEO kit uses @joinascentor; this file used @ascentorhq before. Confirm the real X handle.
export const TWITTER_HANDLE = '@joinascentor';

/** Founder display name, used everywhere. The long legal form is only ever an alternateName in schema. */
export const FOUNDER_NAME = 'Posi Ajiboye';
export const FOUNDER_LEGAL_NAME = 'Ajiboye Ayomiposi Samuel';

/** The one-line truth from the SEO kit. Use this sentence (or the short form) wherever Ascentor is described. */
export const ONE_LINER =
  'Ascentor is a mentorship and leadership development platform for ambitious young Africans: small Circles for accountability, human mentors, and Sage, an AI coach, built around six dimensions of a whole life (Mind, Character, Vocation, Relationships, Community, Legacy). It is also home to The Elevation Summit, its annual gathering.';
export const ONE_LINER_SHORT = 'Mentorship and leadership development for ambitious young Africans.';

// ── Elevation Summit event constants ─────────────────────────
// Only facts the SEO kit settles. Date: 19 Nov 2026 (TODO(posi): confirm). endDate is left out until the programme end
// time is fixed (the kit says to add it then). startDate/endDate must be ISO 8601 with timezone offset.
export const SUMMIT = {
  name: 'The Elevation Summit 2026',
  description:
    'A one-day summit for people ready to stop drifting and start building. Theme: The Rise We Choose. Attend in Lagos or join virtually from anywhere.',
  startDate: '2026-11-19T10:00:00+01:00',
  venue: {
    name: 'Aderemi Makanjuola Hall, Lagos State University',
    locality: 'Lagos',
    country: 'NG',
  },
  url: `${SITE_URL}/elevation-summit`,
  image: `${SITE_URL}/images/elevation-summit-flyer-v3.jpg`,
} as const;

// ── Page metadata helper (kept API-compatible) ────────────────
import type { Metadata } from 'next';

type PageMetaOpts = {
  /** Page title without the site suffix. */
  title: string;
  description: string;
  /** '/', '/about', ... */
  path: string;
  /** Default: the generated site OG image. */
  image?: string;
  /** True for the homepage: the title is used exactly as written, with no suffix. */
  absoluteTitle?: boolean;
};

/**
 * Full metadata for one page: title, description, canonical, openGraph (with image) and twitter.
 * Next replaces a layout's openGraph and inherits its canonical, so every page sets all of it here and
 * the root layout sets none of it.
 */
export function pageMeta({ title, description, path, image = '/opengraph-image', absoluteTitle }: PageMetaOpts): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    // The root layout's title template adds the suffix, so a plain title is passed through.
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      title: fullTitle,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

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

// Organization + founder Person + WebSite as one linked graph (ids let search engines join them).
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon/icon-512.png`,
        description:
          'Ascentor is a mentorship and leadership development platform for ambitious young Africans: small Circles for accountability, human mentors, and Sage, an AI coach.',
        slogan: 'Build a life that outlasts you.',
        email: 'contact@joinascentor.com',
        address: { '@type': 'PostalAddress', addressLocality: 'Lekki, Lagos', addressCountry: 'NG' },
        founder: { '@id': `${SITE_URL}/about#founder` },
        sameAs: [
          'https://x.com/joinascentor',
          'https://linkedin.com/company/joinascentor',
          'https://instagram.com/joinascentor',
        ],
      },
      {
        '@type': 'Person',
        '@id': `${SITE_URL}/about#founder`,
        name: FOUNDER_NAME,
        alternateName: FOUNDER_LEGAL_NAME,
        jobTitle: 'Founder, Ascentor',
        worksFor: { '@id': `${SITE_URL}/#org` },
        sameAs: ['https://www.linkedin.com/in/ayomiposiajiboye/', 'https://www.instagram.com/posi_ajiboye/'],
      },
      { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL, name: SITE_NAME, publisher: { '@id': `${SITE_URL}/#org` } },
    ],
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
      'Mentorship and leadership development with Sage, an AI coach, across six dimensions of a whole life: Mind, Character, Vocation, Relationships, Community, and Legacy.',
  };
}

export function getSummitEventSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: SUMMIT.name,
    description: SUMMIT.description,
    startDate: SUMMIT.startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    // Physical + virtual - this value marks it as a hybrid event.
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    location: [
      {
        '@type': 'Place',
        name: SUMMIT.venue.name,
        address: { '@type': 'PostalAddress', addressLocality: SUMMIT.venue.locality, addressCountry: SUMMIT.venue.country },
      },
      { '@type': 'VirtualLocation', url: SUMMIT.url },
    ],
    image: [SUMMIT.image],
    // Registration is free (the SEO kit and the page both say so).
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'NGN',
      availability: 'https://schema.org/InStock',
      url: `${SUMMIT.url}#register`,
    },
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
