import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Ascentor is the official platform of The Elevation Summit — a movement for purposeful individuals building lives of lasting impact. Learn who we are and why we exist.',
};

export default function AboutPage() {
  return (
    <>
      <style>{`
        body { background: #FAFAF8 !important; color: #0F0F0E !important; }

        .about-nav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(250,250,248,0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #E8E6E1;
        }
        .about-nav-inner {
          max-width: 1200px; margin: 0 auto; padding: 0 1.5rem;
          display: flex; align-items: center; justify-content: space-between;
          height: 64px;
        }

        .eyebrow {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #C8A96E;
        }

        .page-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 800; line-height: 1.05; letter-spacing: -0.03em;
          color: #0F0F0E;
        }

        .section-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          font-weight: 700; line-height: 1.15; letter-spacing: -0.02em;
          color: #0F0F0E;
        }

        .gold-bar {
          width: 2.5rem; height: 3px; background: #C8A96E;
          border-radius: 2px; margin-bottom: 1rem;
        }

        .value-card {
          background: #FFFFFF; border: 1px solid #E8E6E1;
          border-radius: 1rem; padding: 1.75rem;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .value-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.06);
          transform: translateY(-2px);
        }
        .value-card h3 {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: 1.0625rem; font-weight: 700;
          color: #0F0F0E; margin-bottom: 0.625rem;
        }
        .value-card p {
          font-size: 0.9375rem; color: #6B7280; line-height: 1.7;
        }

        .team-card {
          background: #FFFFFF; border: 1px solid #E8E6E1;
          border-radius: 1rem; padding: 2rem;
        }

        footer a { color: #6B7280; text-decoration: none; font-size: 0.875rem; }
        footer a:hover { color: #0F0F0E; }
      `}</style>

      {/* Nav */}
      <nav className="about-nav">
        <div className="about-nav-inner">
          <Link href="/" style={{
            fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
            fontSize: '1.25rem', fontWeight: 800, color: '#0F0F0E',
            letterSpacing: '-0.03em', textDecoration: 'none',
          }}>Ascentor</Link>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/movement" style={{ fontSize: '0.875rem', color: '#374151', textDecoration: 'none', fontWeight: 500 }}>The Movement</Link>
            <Link href="/elevation-summit" style={{ fontSize: '0.875rem', color: '#374151', textDecoration: 'none', fontWeight: 500 }}>The Summit</Link>
            <Link href="/signup" style={{
              padding: '0.5rem 1.25rem',
              background: '#0F0F0E', color: '#FAFAF8',
              borderRadius: '0.5rem', textDecoration: 'none',
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 700, fontSize: '0.875rem',
            }}>Join Ascentor →</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: 'clamp(5rem, 10vw, 8rem) 1.5rem clamp(3rem, 6vw, 5rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>About Ascentor</p>
        <h1 className="page-headline" style={{ maxWidth: '820px', marginBottom: '1.5rem' }}>
          We exist because<br />
          <span style={{ color: '#C8A96E' }}>drift is a choice.</span>
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#374151', lineHeight: 1.75, maxWidth: '620px' }}>
          Ascentor is the official daily platform of The Elevation Summit movement — built for purposeful individuals who have decided to build lives of meaning, leadership, and lasting impact.
        </p>
      </section>

      {/* What We Are */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>What We Are</p>
            <h2 style={{
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
              fontWeight: 700, color: '#FAFAF8',
              lineHeight: 1.15, letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
            }}>
              Not a platform.<br />
              <span style={{ color: '#C8A96E' }}>A movement with a platform.</span>
            </h2>
            <p style={{ fontSize: '1.0625rem', color: '#9CA3AF', lineHeight: 1.8, marginBottom: '1.25rem' }}>
              Most products optimize for engagement. Ascentor optimizes for transformation. We measure success not by time spent on the platform but by the quality of the lives being built by the people on it.
            </p>
            <p style={{ fontSize: '1.0625rem', color: '#9CA3AF', lineHeight: 1.8 }}>
              The Elevation Summit is the annual gathering where the movement comes alive in person. Ascentor is where it lives every other day of the year.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'The Circle', desc: 'A global community of purposeful individuals holding each other accountable.' },
              { label: 'The Coach', desc: 'AI-powered development support, available whenever you need to think clearly.' },
              { label: 'The Resources', desc: 'Structured learning pathways built around the six dimensions of the total person.' },
              { label: 'The Elevation Summit', desc: 'The annual gathering. The peak moment. February 2027, Lagos.' },
            ].map((item) => (
              <div key={item.label} style={{
                padding: '1.25rem 1.5rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '0.875rem',
              }}>
                <p style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontWeight: 700, fontSize: '0.9375rem', color: '#C8A96E', marginBottom: '0.375rem' }}>{item.label}</p>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>What We Believe</p>
          <h2 className="section-headline" style={{ maxWidth: '560px' }}>
            The convictions we build on.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {[
            {
              title: 'Purpose is built, not found',
              body: 'We do not believe in waiting to "discover" your purpose. Purpose is constructed through deliberate confrontation with your own capacity and calling.',
            },
            {
              title: 'Character is the foundation',
              body: 'No strategy, skill, or network substitutes for character. We build around the conviction that who you are determines what you build.',
            },
            {
              title: 'Community accelerates everything',
              body: 'No person ascends alone. The quality of your community determines the ceiling of your growth. We are intentional about who is in The Circle.',
            },
            {
              title: 'The individual and the nation rise together',
              body: 'We believe that building purposeful individuals is the highest form of nation building. Africa needs built people, not just resourced ones.',
            },
            {
              title: 'Think in centuries',
              body: 'We orient everything toward legacy. Decisions made with great-grandchildren in mind are different decisions. We build that instinct into the platform.',
            },
            {
              title: 'Mediocrity is a betrayal',
              body: 'Not of some external standard — of your own potential. We hold each other to the standard of becoming who we were built to be.',
            },
          ].map((item) => (
            <div key={item.title} className="value-card">
              <div className="gold-bar" />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Founder */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px' }}>
            <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>The Founder</p>
            <h2 className="section-headline" style={{ marginBottom: '2rem' }}>
              Ajiboye Ayomiposi Samuel
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              {[
                'Ajiboye is a Lagos-based technology and security professional, the founder of Guardsmann Technologies, and the creator of Ascentor — the official platform of The Elevation Summit.',
                'He built Ascentor because he grew up inside the crisis it exists to solve. He watched people around him drift — not because they were incapable, but because no one had ever shown them what a built life looked like, or challenged them to think architecturally about their existence.',
                'The Elevation Summit is not his career. It is not his brand. It is his life\'s purpose given organizational form — and he is building it to outlast him.',
              ].map((para, i) => (
                <p key={i} style={{ fontSize: '1.0625rem', color: '#374151', lineHeight: 1.8 }}>{para}</p>
              ))}
            </div>

            <div style={{
              background: '#0F0F0E',
              borderRadius: '1rem',
              padding: '1.5rem 2rem',
              borderLeft: '4px solid #C8A96E',
            }}>
              <p style={{
                fontFamily: 'var(--font-accent, "Playfair Display", serif)',
                fontStyle: 'italic',
                fontSize: '1.125rem',
                color: '#C8A96E',
                lineHeight: 1.65,
                marginBottom: '0.75rem',
              }}>
                "I will not drift. And I will spend my life making it harder for others to drift."
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#4B5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ajiboye Ayomiposi Samuel · Founder, Ascentor
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications / Credibility */}
      <section style={{ padding: 'clamp(3rem, 6vw, 5rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'CISM', sub: 'Certified Information Security Manager' },
            { label: 'CRISC', sub: 'Certified in Risk and Information Systems Control' },
            { label: 'CIPP/C', sub: 'Certified Information Privacy Professional' },
            { label: 'B.Tech', sub: 'Information Systems · FUTA' },
          ].map((item) => (
            <div key={item.label} style={{ padding: '1.25rem', background: '#FFFFFF', border: '1px solid #E8E6E1', borderRadius: '0.75rem', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontWeight: 800, fontSize: '1.125rem', color: '#C8A96E', marginBottom: '0.375rem' }}>{item.label}</p>
              <p style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Elevation Summit CTA */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(5rem, 10vw, 8rem) 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p className="eyebrow" style={{ color: '#C8A96E', marginBottom: '1.5rem' }}>February 2027</p>
          <h2 style={{
            fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800, color: '#FAFAF8',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            marginBottom: '1.25rem',
          }}>
            The inaugural Elevation Summit is coming.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>
            Lagos, Nigeria. One gathering. One decision. The rest of your life.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/elevation-summit" style={{
              padding: '0.875rem 2rem',
              background: '#C8A96E', color: '#0F0F0E',
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 700, fontSize: '1rem',
              borderRadius: '0.5rem', textDecoration: 'none',
            }}>Register Interest →</Link>
            <Link href="/signup" style={{
              padding: '0.875rem 2rem',
              background: 'transparent', color: '#FAFAF8',
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 600, fontSize: '1rem',
              borderRadius: '0.5rem', textDecoration: 'none',
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}>Join Ascentor →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F0F0E', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-accent, "Playfair Display", serif)', fontStyle: 'italic', color: '#C8A96E', fontSize: '0.9375rem' }}>
            "Build a life that outlasts you."
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#4B5563' }}>© 2026 Ascentor. All rights reserved.</p>
          <Link href="/" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>← Back to Ascentor</Link>
        </div>
      </footer>
    </>
  );
}
