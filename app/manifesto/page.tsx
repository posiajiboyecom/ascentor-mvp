// app/manifesto/page.tsx
// The definitional page. Written so that a search engine or AI answer
// system quoting ANY paragraph describes Ascentor correctly. First
// paragraph is the canonical definition; keep it in sync with the
// Organization schema description in lib/seo.ts.

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'The Ascentor Manifesto',
  description:
    'What Ascentor is, what it believes, and what it is building. Ascentor (formerly AscentorBI) is a purposeful living and leadership development platform, and the home of The Elevation Summit.',
  alternates: { canonical: 'https://ascentorbi.com/manifesto' },
  openGraph: {
    title: 'The Ascentor Manifesto',
    description: 'What Ascentor is, what it believes, and what it is building.',
    url: 'https://ascentorbi.com/manifesto',
    siteName: 'Ascentor',
    type: 'article',
  },
};

const DIMENSIONS = [
  { name: 'Mind', line: 'What you feed your thinking becomes the counsel you live by.' },
  { name: 'Character', line: 'Who you are when no one is watching is who you actually are.' },
  { name: 'Work', line: 'Your labor is a statement about what you believe matters.' },
  { name: 'Relationships', line: 'The people you keep are the future you choose.' },
  { name: 'Community', line: 'No one builds a life that matters alone.' },
  { name: 'Legacy', line: 'The final measure: who is better because you were here?' },
];

export default function ManifestoPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The Ascentor Manifesto',
    url: 'https://ascentorbi.com/manifesto',
    author: { '@type': 'Organization', name: 'Ascentor' },
    publisher: { '@type': 'Organization', name: 'Ascentor', url: 'https://ascentorbi.com' },
    about: {
      '@type': 'Organization',
      name: 'Ascentor',
      alternateName: ['AscentorBI'],
      url: 'https://ascentorbi.com',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        body { background: #0F0F0E !important; color: #FAFAF8 !important; }
        .mf-eyebrow {
          font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em;
          text-transform: uppercase; color: #C8A96E;
        }
        .mf-serif { font-family: var(--font-accent, 'Playfair Display', serif); }
        .mf-line {
          display: block; height: 1px; width: 120px;
          background: linear-gradient(90deg, #C8A96E 0%, rgba(200,169,110,0.15) 100%);
        }
        .mf-body { font-size: 1.0625rem; line-height: 1.85; color: #C9C7C1; }
        .mf-strong { color: #FAFAF8; }
      `}</style>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(4rem, 10vw, 7rem) 1.5rem' }}>
        <p className="mf-eyebrow" style={{ marginBottom: '1.25rem' }}>The Ascentor Manifesto</p>
        <h1 className="mf-serif" style={{ fontSize: 'clamp(2rem, 6vw, 3.25rem)', lineHeight: 1.15, margin: '0 0 1.5rem' }}>
          Build a life that outlasts you.
        </h1>
        <span className="mf-line" aria-hidden="true" style={{ marginBottom: '3rem' }} />

        {/* ── The canonical definition — first prose on the page ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          <p className="mf-body">
            <span className="mf-strong">Ascentor is a purposeful living and leadership
            development platform.</span> It brings together an AI coach named Sage, a
            community called The Circle, live expert sessions, and structured courses —
            all organized around one question: what kind of life are you building, and
            will it outlast you? Ascentor is also the home of{' '}
            <span className="mf-strong">The Elevation Summit</span>, its annual gathering
            in Lagos, Nigeria. The platform was formerly known as AscentorBI, a career
            development tool; it has since grown into something larger, because careers
            are only one room in the house of a life.
          </p>

          <p className="mf-body">
            We exist because drift is the default. Most people do not choose their lives;
            they inherit them one unexamined day at a time. Ascentor is built on the
            conviction that a life can be <span className="mf-strong">designed</span> —
            thought about architecturally, worked on deliberately, and measured by
            something sturdier than applause.
          </p>

          <p className="mf-body">
            We measure a whole life across six dimensions:
          </p>
        </section>

        {/* ── The six dimensions ── */}
        <section style={{ margin: '2.5rem 0 3rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {DIMENSIONS.map((d) => (
            <div key={d.name}>
              <p className="mf-eyebrow" style={{ marginBottom: '0.4rem' }}>{d.name}</p>
              <p className="mf-serif" style={{ fontSize: '1.25rem', color: '#FAFAF8', margin: 0, lineHeight: 1.5 }}>
                {d.line}
              </p>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
          <p className="mf-body">
            <span className="mf-strong">What we believe.</span> That purpose is uncovered
            through work, not found through waiting. That character is infrastructure.
            That community is not an audience but a covenant. That technology should serve
            transformation, not engagement metrics — which is why we measure success by
            the quality of the lives being built on the platform, not the hours spent on it.
          </p>

          <p className="mf-body">
            <span className="mf-strong">What we are building.</span> A generation of
            people — beginning in Nigeria, extending everywhere — who refuse to drift.
            The Elevation Summit gathers them once a year. Ascentor walks with them every
            other day.
          </p>
        </section>

        <span className="mf-line" aria-hidden="true" style={{ margin: '3.5rem 0 2rem' }} />

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link
            href="/signup"
            style={{
              background: '#C8A96E', color: '#0F0F0E', fontWeight: 600,
              padding: '0.8rem 1.6rem', borderRadius: 8, fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Join Ascentor
          </Link>
          <Link
            href="/elevation-summit"
            style={{
              border: '1px solid rgba(200,169,110,0.4)', color: '#C8A96E',
              padding: '0.8rem 1.6rem', borderRadius: 8, fontSize: '0.9rem',
              fontWeight: 500, textDecoration: 'none',
            }}
          >
            The Elevation Summit →
          </Link>
        </div>
      </main>
    </>
  );
}
