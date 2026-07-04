'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';

// Narrow sanitizer for the hero headline specifically — allows ONLY
// <br> / <br/> tags (needed for the two-line headline layout) and
// strips everything else, including script tags and event handler
// attributes. Writes to marketing_sections are already gated to
// admin/moderator role via RLS + the API route's auth check, so this
// isn't defending against an untrusted public writer — it's defense
// in depth in case that assumption ever changes, and it keeps this
// one field from becoming a general-purpose "admin can inject any
// HTML" surface just because it needed one tag.
function sanitizeHeroHeadline(html: string): string {
  return html
    .replace(/<(?!br\s*\/?>)[^>]*>/gi, '') // strip every tag except <br> / <br/>
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
}

// app/LandingPageClient.tsx
// ============================================================
// Client half of the landing page. app/page.tsx (server component)
// fetches CMS content via getPublishedPage('landing') and passes it
// here as `cms`. Everything interactive (newsletter form, mobile
// menu, the two count fetches) stays here since CMS content fetching
// must happen server-side (getPublishedPage uses the server Supabase
// client, which a 'use client' component can't call directly).
//
// CMS WIRING STATUS: only the Hero section is wired so far (see the
// `cms?.sections.hero?.data` usage below) — this is the first proof
// of the full CMS loop end to end. The remaining sections (Summit
// Banner, Problem, Who It's For, Three Pillars, Total Person, Quote,
// Newsletter, Final CTA, Footer) are NOT yet wired and still render
// their original hardcoded copy. Wiring those is a separate,
// section-by-section follow-up — see the chat log for why this was
// deliberately scoped to one section first rather than all at once.
//
// FALLBACK CONTRACT (see lib/supabase/queries/marketing.ts usage
// note): every CMS-sourced value below falls back to the ORIGINAL
// hardcoded copy if cms is null or that section hasn't been
// published yet. The hardcoded strings are the safety net, not dead
// code — do not delete them when more sections get wired.
export default function LandingPageClient({ cms }: { cms: PublishedPage | null }) {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [hasBlogPosts, setHasBlogPosts] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [userCount, setUserCount] = useState<number | null>(null);
  const [events, setEvents] = useState<Array<{ slug: string; title: string; tagline: string | null; event_date: string | null; is_featured: boolean }>>([]);
  const [eventsOpen, setEventsOpen] = useState(false);

  // Hero content — CMS first, hardcoded fallback second. The CMS
  // shape (set via the 'structured' field editor in
  // /admin/marketing-pages/landing) is whatever fields an admin
  // chooses to add — headline/subhead/cta_label/cta_href/eyebrow are
  // the field NAMES this component looks for, but nothing enforces
  // an admin actually creating fields with exactly these names. If
  // a field is missing or misnamed, that one value silently falls
  // back to hardcoded copy rather than rendering blank or crashing.
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow  = hero?.eyebrow   || 'The Elevation Summit Platform';
  const heroHeadline = hero?.headline  || 'You were not built<br />to drift.';
  const heroSubhead  = hero?.subhead   || 'Ascentor is the daily platform of The Elevation Summit — a global community of purposeful individuals building lives of meaning, leadership, and lasting impact.';
  const heroCtaLabel    = hero?.cta_label    || 'Join the Movement →';
  const heroCtaHref     = hero?.cta_href     || '/signup';
  const heroCta2Label   = hero?.cta2_label   || 'What is The Elevation Summit?';
  const heroCta2Href    = hero?.cta2_href    || '/elevation-summit';

  // Summit Banner
  const banner = cms?.sections.summit_banner?.data as Record<string, string> | undefined;
  const bannerEyebrow = banner?.eyebrow || 'The Elevation Summit';
  const bannerDate    = banner?.date    || 'February 2027 · Lagos, Nigeria';
  const bannerSub     = banner?.sub     || 'The inaugural gathering. One defining moment.';
  const bannerCta     = banner?.cta     || 'Register →';
  const bannerHref    = banner?.href    || '/elevation-summit';

  // Problem Section
  const problem = cms?.sections.problem?.data as Record<string, string> | undefined;
  const problemHeadline  = problem?.headline  || 'Most people don\'t fail because they lack talent.<br /><span style="color:#C8A96E">They fail because they lack architecture.</span>';
  const problemBody1     = problem?.body1     || 'No framework for their life. No community holding them accountable. No ideology anchoring their decisions. Just reaction after reaction to whatever the world demands of them.';
  const problemBody2     = problem?.body2     || 'Ascentor exists for the ones who are done reacting.';

  // Who It's For section header
  const whoHeader = cms?.sections.who_header?.data as Record<string, string> | undefined;
  const whoEyebrow   = whoHeader?.eyebrow   || "Who It's For";
  const whoHeadline  = whoHeader?.headline  || 'One platform.<br />Every stage of ascent.';
  // Who It's For: repeating persona cards
  const whoItems = (cms?.sections.who_cards?.items || []) as Array<Record<string, string>>;
  const defaultWhoCards = [
    { stage: 'The Seeker', description: 'Still finding the thread. You know there is more, but you have not named it yet. Ascentor helps you find your purpose framework and start building toward it.' },
    { stage: 'The Builder', description: 'You know where you are going. Now you are doing the daily work of getting there. Ascentor gives you community, accountability, and development to build faster.' },
    { stage: 'The Leader', description: 'You have built something. Now you are responsible for others. Ascentor connects you with people operating at your level — and challenges you toward the century-long impact you were built for.' },
  ];
  const whoCards = whoItems.length > 0 ? whoItems : defaultWhoCards;

  // Three Pillars section header
  const pillarsHeader = cms?.sections.pillars_header?.data as Record<string, string> | undefined;
  const pillarsEyebrow  = pillarsHeader?.eyebrow  || 'How It Works';
  const pillarsHeadline = pillarsHeader?.headline || 'Three forces.<br />One direction.';
  // Repeating pillar cards
  const pillarItems = (cms?.sections.pillars?.items || []) as Array<Record<string, string>>;
  const defaultPillars = [
    { pillar: 'Community', description: 'A global circle of purposeful individuals. Not a networking group. A brotherhood and sisterhood anchored by shared ideology and mutual accountability.', featured: '', badge: '', cta_label: '', cta_href: '' },
    { pillar: 'Development', description: 'Structured pathways for becoming the total person — in mind, character, vocation, relationships, and civic impact.', featured: '', badge: '', cta_label: '', cta_href: '' },
    { pillar: 'The Elevation Summit', description: 'Once a year, the community gathers. The annual Summit is the peak moment — inspiration, challenge, and the collective experience of people who chose to ascend.', featured: 'true', badge: 'Next gathering: February 2027', cta_label: 'Learn about The Elevation Summit →', cta_href: '/elevation-summit' },
  ];
  const pillarCards = pillarItems.length > 0 ? pillarItems : defaultPillars;

  // Total Person section
  const totalHeader = cms?.sections.total_person_header?.data as Record<string, string> | undefined;
  const totalEyebrow  = totalHeader?.eyebrow  || 'The Total Person';
  const totalHeadline = totalHeader?.headline || 'Six dimensions.<br />One complete life.';
  const totalBody     = totalHeader?.body     || 'Ascentor is built around a single conviction: that human development cannot be reduced to career outcomes. Every feature, every conversation, every resource is oriented toward these six dimensions.';
  // Repeating dimension cards
  const dimensionItems = (cms?.sections.dimensions?.items || []) as Array<Record<string, string>>;
  const defaultDimensions = [
    { dimension: 'Mind', description: 'How you think — independently, critically, and without the distortion of trend or fear.' },
    { dimension: 'Character', description: 'How you live — your private and public life as one consistent, principled whole.' },
    { dimension: 'Vocation', description: 'How you work — with purpose, not just productivity. For impact, not just income.' },
    { dimension: 'Relationships', description: 'How you lead others — as a partner, parent, friend, mentor, and example.' },
    { dimension: 'Community', description: 'What you build beyond yourself — civic contribution and national responsibility.' },
    { dimension: 'Legacy', description: 'What remains when you are gone — the institutions, ideas, and people you set in motion.' },
  ];
  const dimensions = dimensionItems.length > 0 ? dimensionItems : defaultDimensions;

  // Quote Section
  const quote = cms?.sections.quote?.data as Record<string, string> | undefined;
  const quoteText       = quote?.text       || '"An unbuilt person cannot build anything that lasts."';
  const quoteAttrib     = quote?.attribution || 'The founding conviction of Ascentor';

  // Newsletter Section
  const newsletter = cms?.sections.newsletter?.data as Record<string, string> | undefined;
  const newsletterEyebrow  = newsletter?.eyebrow  || 'Stay Connected';
  const newsletterHeadline = newsletter?.headline || 'Join the movement newsletter.';
  const newsletterBody     = newsletter?.body     || 'Insights on purposeful living, updates on The Elevation Summit, and the ideas shaping the movement — delivered weekly.';

  // Final CTA
  const finalCta = cms?.sections.final_cta?.data as Record<string, string> | undefined;
  const finalCtaEyebrow  = finalCta?.eyebrow  || 'Your ascent begins here';
  const finalCtaHeadline = finalCta?.headline || 'Build a life that<br />outlasts you.';
  const finalCtaBody     = finalCta?.body     || 'Ascentor is not for everyone. It is for the ones who have decided.';
  const finalCtaLabel    = finalCta?.cta_label || 'Join Ascentor →';
  const finalCtaHref     = finalCta?.cta_href  || '/signup';

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .then(({ count }) => { if ((count || 0) > 0) setHasBlogPosts(true); });

    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count) setUserCount(count); });

    fetch('/api/events/list')
      .then(r => r.json())
      .then(d => { if (d.events) setEvents(d.events); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSubLoading(true);
    setSubError('');
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: trimmed,
      is_active: true,
      source: 'landing_page',
      subscribed_at: new Date().toISOString(),
    });
    setSubLoading(false);
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source: 'landing_page' }),
        }).catch(() => {});
        setSubError("You're already subscribed!");
      } else {
        setSubError('Something went wrong. Please try again.');
      }
    } else {
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'landing_page' }),
      }).catch(() => {});
      setSubscribed(true);
    }
  };

  return (
    <>
      <style>{`
        /* ── Page-level overrides ── */
        body { background: #FAFAF8 !important; color: #0F0F0E !important; }

        .nav-link {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
          text-decoration: none;
          transition: color 0.2s;
          white-space: nowrap;
        }
        .nav-link:hover { color: #0F0F0E; }

        .eyebrow {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #C8A96E;
        }

        .hero-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(2.75rem, 7vw, 5.5rem);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: #0F0F0E;
        }

        .section-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(2rem, 4vw, 3.25rem);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: #0F0F0E;
        }

        .card {
          background: #FFFFFF;
          border: 1px solid #E8E6E1;
          border-radius: 1rem;
          padding: 2rem;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }

        .card-number {
          font-family: var(--font-accent, 'Playfair Display', serif);
          font-size: 3rem;
          font-weight: 700;
          color: #E8E6E1;
          line-height: 1;
          margin-bottom: 1rem;
        }

        .gold-bar {
          width: 2.5rem;
          height: 3px;
          background: #C8A96E;
          border-radius: 2px;
          margin-bottom: 1rem;
        }

        .dimension-card {
          background: #FFFFFF;
          border: 1px solid #E8E6E1;
          border-radius: 0.75rem;
          padding: 1.5rem;
        }
        .dimension-card h3 {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: 1rem;
          font-weight: 700;
          color: #0F0F0E;
          margin-bottom: 0.5rem;
        }
        .dimension-card p {
          font-size: 0.875rem;
          color: #6B7280;
          line-height: 1.6;
        }

        .pillar-card {
          border: 1px solid #E8E6E1;
          border-radius: 1rem;
          padding: 2rem;
          background: #FAFAF8;
          position: relative;
        }
        .pillar-card.featured {
          background: #0F0F0E;
          border-color: #C8A96E;
        }
        .pillar-card.featured h3,
        .pillar-card.featured p {
          color: #FAFAF8;
        }
        .pillar-card.featured p { color: #9CA3AF; }

        .stage-badge {
          display: inline-block;
          padding: 0.375rem 0.875rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          background: #F4F3EF;
          color: #6B7280;
          margin-bottom: 1rem;
        }

        .quote-block {
          font-family: var(--font-accent, 'Playfair Display', serif);
          font-style: italic;
          font-size: clamp(1.25rem, 2.5vw, 1.75rem);
          line-height: 1.5;
          color: #0F0F0E;
        }

        .summit-banner {
          background: #0F0F0E;
          border-radius: 1rem;
          padding: 1.25rem 1.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .input-field {
          width: 100%;
          padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid #E8E6E1;
          border-radius: 0.5rem;
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.9375rem;
          color: #0F0F0E;
          outline: none;
          transition: border-color 0.2s;
        }
        .input-field:focus { border-color: #C8A96E; }
        .input-field::placeholder { color: #9CA3AF; }

        .events-dropdown-wrap { position: relative; }
        .events-dropdown-btn {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.9rem; font-weight: 500; color: #374151;
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 4px; padding: 0;
          transition: color 0.2s;
        }
        .events-dropdown-btn:hover { color: #0F0F0E; }
        .events-dropdown-btn svg { transition: transform 0.2s; }
        .events-dropdown-btn.open svg { transform: rotate(180deg); }
        .events-dropdown-menu {
          position: absolute; top: calc(100% + 12px); left: 50%;
          transform: translateX(-50%);
          background: #FFFFFF; border: 1px solid #E8E6E1;
          border-radius: 12px; padding: 8px; min-width: 240px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          z-index: 60;
        }
        .events-dropdown-item {
          display: block; padding: 10px 14px; border-radius: 8px;
          text-decoration: none; transition: background 0.15s;
        }
        .events-dropdown-item:hover { background: #F4F3EF; }
        .events-dropdown-item-title {
          font-size: 0.875rem; font-weight: 600; color: #0F0F0E; display: block;
        }
        .events-dropdown-item-sub {
          font-size: 0.75rem; color: #9CA3AF; margin-top: 1px; display: block;
        }

        nav .desktop-nav { display: none !important; }
        @media(min-width: 860px) { nav .desktop-nav { display: flex !important; } }

        .mobile-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px; height: 36px;
          background: none;
          border: 1.5px solid #E8E6E1;
          border-radius: 8px;
          cursor: pointer;
          color: #374151;
          flex-direction: column;
          gap: 4px;
          padding: 0;
        }
        .mobile-menu-btn span {
          display: block;
          width: 16px;
          height: 1.5px;
          background: currentColor;
          border-radius: 2px;
          transition: all 0.2s;
        }
        @media(min-width: 860px) { .mobile-menu-btn { display: none !important; } }

        .mobile-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 49;
          background: rgba(250,250,248,0.98);
          backdrop-filter: blur(16px);
          padding: 80px 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .mobile-menu-link {
          display: block;
          padding: 1rem 0;
          border-bottom: 1px solid #E8E6E1;
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: 1.125rem;
          font-weight: 600;
          color: #0F0F0E;
          text-decoration: none;
        }
        .mobile-menu-link:hover { color: #C8A96E; }

        footer a {
          color: #6B7280;
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        footer a:hover { color: #0F0F0E; }
      `}</style>

      {/* ── Navigation ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,248,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E6E1',
      }} onClick={() => setEventsOpen(false)}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '64px', position: 'relative' }}>
            <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" height={26} width={98} style={{ display: 'block' }} />
            </Link>
            <div style={{ alignItems: 'center', gap: '2rem', position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }} className="desktop-nav">
              <Link href="/movement" className="nav-link">The Movement</Link>
              <Link href="/signup" className="nav-link">Join Community</Link>
              <div className="events-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button className={`events-dropdown-btn${eventsOpen ? ' open' : ''}`} onClick={() => setEventsOpen(o => !o)}>
                  Events
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {eventsOpen && (
                  <div className="events-dropdown-menu">
                    {events.length === 0 ? (
                      <p style={{ padding: '10px 14px', fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>No upcoming events</p>
                    ) : events.map(ev => (
                      <Link key={ev.slug} href={`/events/${ev.slug}`} className="events-dropdown-item" onClick={() => setEventsOpen(false)}>
                        <span className="events-dropdown-item-title">{ev.title}</span>
                        {(ev.event_date || ev.tagline) && (
                          <span className="events-dropdown-item-sub">{ev.event_date || ev.tagline}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {hasBlogPosts && <Link href="/blog" className="nav-link">Resources</Link>}
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/contact" className="nav-link">Contact</Link>
            </div>
            <button
              className="mobile-menu-btn"
              onClick={e => { e.stopPropagation(); setMobileMenuOpen(o => !o); }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              style={{ marginLeft: 'auto' }}
            >
              <span style={{ transform: mobileMenuOpen ? 'rotate(45deg) translate(4px,4px)' : 'none' }} />
              <span style={{ opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ transform: mobileMenuOpen ? 'rotate(-45deg) translate(4px,-4px)' : 'none' }} />
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <Link href="/movement" className="mobile-menu-link">The Movement</Link>
          <Link href="/signup" className="mobile-menu-link">Join Community</Link>
          <p style={{ padding: '0.75rem 0', borderBottom: '1px solid #E8E6E1', margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>Events</p>
          {events.map(ev => (
            <Link key={ev.slug} href={`/events/${ev.slug}`} className="mobile-menu-link" style={{ paddingLeft: '1rem', fontSize: '1rem', fontWeight: 500 }}>
              {ev.title}
            </Link>
          ))}
          {hasBlogPosts && <Link href="/blog" className="mobile-menu-link">Resources</Link>}
          <Link href="/about" className="mobile-menu-link">About</Link>
          <Link href="/contact" className="mobile-menu-link">Contact</Link>
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href="/login" className="mobile-menu-link" style={{ border: 'none', fontSize: '0.9375rem', color: '#6B7280' }}>Sign in</Link>
            <Link href="/signup" className="btn-primary" style={{ textAlign: 'center', padding: '0.875rem' }}>Join Ascentor →</Link>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section style={{ padding: 'clamp(5rem, 10vw, 8rem) 1.5rem clamp(4rem, 8vw, 6rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '820px' }}>
          <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>{heroEyebrow}</p>

          <h1 className="hero-headline" style={{ marginBottom: '1.5rem' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(heroHeadline) }} />

          <p style={{
            fontSize: 'clamp(1.0625rem, 2vw, 1.25rem)',
            color: '#374151',
            lineHeight: 1.7,
            maxWidth: '600px',
            marginBottom: '2.5rem',
          }}>
            {heroSubhead}
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <Link href={heroCtaHref} className="btn-primary">{heroCtaLabel}</Link>
            <Link href={heroCta2Href} className="btn-secondary">{heroCta2Label}</Link>
          </div>

          {userCount && userCount > 5 && (
            <p style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>
              Join {userCount.toLocaleString()}+ people who chose direction over drift.
            </p>
          )}
        </div>
      </section>

      {/* ── Summit Banner ── */}
      <section style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem 5rem' }}>
        <div className="summit-banner">
          <div>
            <p className="eyebrow" style={{ color: '#C8A96E', marginBottom: '0.25rem' }}>{bannerEyebrow}</p>
            <p style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontWeight: 700, fontSize: '1.125rem', color: '#FAFAF8' }}>{bannerDate}</p>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>{bannerSub}</p>
          </div>
          <Link href={bannerHref} className="btn-gold">{bannerCta}</Link>
        </div>
      </section>

      {/* ── Problem Section ── */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px' }}>
            <h2 className="section-headline" style={{ color: '#FAFAF8', marginBottom: '1.5rem' }}
              dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(problemHeadline) }} />
            <p style={{ fontSize: '1.125rem', color: '#9CA3AF', lineHeight: 1.75, marginBottom: '1.5rem' }}>
              {problemBody1}
            </p>
            <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#FAFAF8' }}>
              {problemBody2}
            </p>
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>{whoEyebrow}</p>
          <h2 className="section-headline" dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(whoHeadline) }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {whoCards.map((item, i) => (
            <div key={item.stage} className="card">
              <div className="card-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="gold-bar" />
              <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>{item.stage}</h3>
              <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three Pillars ── */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>{pillarsEyebrow}</p>
            <h2 className="section-headline" dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(pillarsHeadline) }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {pillarCards.map((item) => (
              <div key={item.pillar} className={`pillar-card ${item.featured === 'true' ? 'featured' : ''}`}>
                {item.badge && (
                  <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(200,169,110,0.15)', color: '#C8A96E', marginBottom: '1rem' }}>{item.badge}</span>
                )}
                <div className="gold-bar" />
                <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: item.featured === 'true' ? '#FAFAF8' : '#0F0F0E' }}>{item.pillar}</h3>
                <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: item.cta_label ? '1.5rem' : 0, color: item.featured === 'true' ? '#9CA3AF' : '#6B7280' }}>{item.description}</p>
                {item.cta_label && item.cta_href && (
                  <Link href={item.cta_href} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C8A96E', textDecoration: 'none' }}>{item.cta_label}</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Total Person ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>{totalEyebrow}</p>
          <h2 className="section-headline" dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(totalHeadline) }} />
          <p style={{ color: '#6B7280', lineHeight: 1.7, marginTop: '1rem', fontSize: '1rem' }}>{totalBody}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {dimensions.map((item) => (
            <div key={item.dimension} className="dimension-card">
              <div className="gold-bar" style={{ marginBottom: '0.75rem' }} />
              <h3>{item.dimension}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quote Section ── */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 6rem) 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p className="quote-block" style={{ marginBottom: '1.5rem' }}>{quoteText}</p>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            {quoteAttrib}
          </p>
        </div>
      </section>

      {/* ── Newsletter / Join ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>{newsletterEyebrow}</p>
          <h2 className="section-headline" style={{ marginBottom: '1rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            {newsletterHeadline}
          </h2>
          <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '2rem', fontSize: '1rem' }}>
            {newsletterBody}
          </p>

          {subscribed ? (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <p style={{ fontWeight: 600, color: '#16A34A', marginBottom: '0.25rem' }}>You're in.</p>
              <p style={{ fontSize: '0.875rem', color: '#374151' }}>Welcome to the movement. Watch your inbox.</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required className="input-field" style={{ maxWidth: '360px' }} />
              <button type="submit" className="btn-primary" disabled={subLoading}>
                {subLoading ? 'Joining...' : 'Join the Movement'}
              </button>
              {subError && <p style={{ width: '100%', fontSize: '0.875rem', color: '#DC2626' }}>{subError}</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(5rem, 10vw, 8rem) 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <p className="eyebrow" style={{ color: '#C8A96E', marginBottom: '1.5rem' }}>{finalCtaEyebrow}</p>
          <h2 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 800, color: '#FAFAF8', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1.5rem' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHeroHeadline(finalCtaHeadline) }} />
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', marginBottom: '2.5rem', lineHeight: 1.7 }}>{finalCtaBody}</p>
          <Link href={finalCtaHref} className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>{finalCtaLabel}</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#0F0F0E', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '3rem 1.5rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            {/* Brand */}
            <div>
              <span style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#FAFAF8',
                letterSpacing: '-0.03em',
                display: 'block',
                marginBottom: '0.75rem',
              }}>Ascentor</span>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                The official platform of The Elevation Summit movement.
              </p>
            </div>

            {/* The Movement */}
            <div>
              <h4 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: '#FAFAF8',
                marginBottom: '1rem',
              }}>The Movement</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Link href="/movement">Our Ideology</Link>
                <Link href="/movement#total-person">The Total Person</Link>
                <Link href="/about">About Ascentor</Link>
              </nav>
            </div>

            {/* Community */}
            <div>
              <h4 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: '#FAFAF8',
                marginBottom: '1rem',
              }}>Community</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Link href="/signup">Join Free</Link>
                <Link href="/community">The Circle</Link>
                {hasBlogPosts && <Link href="/blog">Resources</Link>}
                <Link href="/products">Products</Link>
                <Link href="/newsletter">Newsletter</Link>
                <Link href="/contact">Contact</Link>
              </nav>
            </div>

            {/* The Elevation Summit */}
            <div>
              <h4 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: '#FAFAF8',
                marginBottom: '1rem',
              }}>The Elevation Summit</h4>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <Link href="/elevation-summit">About the Summit</Link>
                <Link href="/elevation-summit#register">February 2027</Link>
                <Link href="/elevation-summit#speak">Become a Speaker</Link>
                <Link href="/elevation-summit#partner">Partner with Us</Link>
              </nav>
            </div>
          </div>

          {/* Footer Bottom */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <p style={{
              fontFamily: 'var(--font-accent, "Playfair Display", serif)',
              fontStyle: 'italic',
              fontSize: '1rem',
              color: '#C8A96E',
            }}>
              "Build a life that outlasts you."
            </p>

            <p style={{ fontSize: '0.8125rem', color: '#4B5563' }}>
              © 2026 Ascentor. All rights reserved.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="https://x.com/ascentorhq" target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none' }}>X / Twitter</a>
              <a href="https://linkedin.com/company/ascentorhq" target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none' }}>LinkedIn</a>
              <a href="https://instagram.com/ascentorhq" target="_blank" rel="noopener noreferrer" style={{ color: '#6B7280', fontSize: '0.875rem', textDecoration: 'none' }}>Instagram</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
