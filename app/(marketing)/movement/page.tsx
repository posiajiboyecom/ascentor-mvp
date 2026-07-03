import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/marketing.css';

export const metadata: Metadata = {
  title: 'The Movement',
  description:
    'A generation is drifting. Ascentor and The Elevation Summit exist to change that. Discover the ideology, the conviction, and the vision behind the movement.',
};

const dimensions = [
  {
    name: 'Mind',
    subtitle: 'How You Think',
    description:
      'The total person thinks independently. They assess what is happening around them without the distortion of bias, trend, or fear. They read. They question. They hold complexity without collapsing into simplicity.',
    contrast: 'The unbuilt person reacts. The total person reflects, then responds.',
  },
  {
    name: 'Character',
    subtitle: 'How You Live',
    description:
      'The total person is morally grounded. Their private life and their public life are the same life. They keep their word. They take responsibility for their failures. Their integrity is not situational.',
    contrast: 'The unbuilt person performs virtue. The total person practices it.',
  },
  {
    name: 'Vocation',
    subtitle: 'How You Work',
    description:
      'The total person works with purpose, not just productivity. They understand that their work is not merely a source of income — it is an expression of their calling and a contribution to something larger than themselves.',
    contrast: 'The unbuilt person works for approval. The total person works for impact.',
  },
  {
    name: 'Relationships',
    subtitle: 'How You Lead Others',
    description:
      'The total person understands that no life is built in isolation. They invest in relationships with intention — as a partner, parent, friend, leader, and mentor. They lead through the earned trust of consistent example.',
    contrast: 'The unbuilt person uses relationships. The total person builds them.',
  },
  {
    name: 'Community',
    subtitle: 'What You Build Beyond Yourself',
    description:
      'The total person is civic. They understand that their life is embedded in a community, a nation, a generation — and that they bear responsibility for what that community becomes. They do not merely consume. They contribute.',
    contrast: 'The unbuilt person asks what they can get. The total person asks what they can build.',
  },
  {
    name: 'Legacy',
    subtitle: 'What Remains When You Are Gone',
    description:
      'The total person thinks in centuries, not quarters. They make decisions with their great-grandchildren in mind. They build institutions, not just careers. They plant trees under whose shade they will never sit.',
    contrast: 'The unbuilt person lives for today. The total person builds for tomorrow.',
  },
];

import { getPublishedPage } from '@/lib/supabase/queries/marketing';

export default async function MovementPage() {
  const cms = await getPublishedPage('movement');
  // Helper to safely accept admin-authored html with <br> tags only
  const h = (s: string) => s.replace(/<(?!br\s*\/?>)[^>]*>/gi, '');

  // CMS-driven content with hardcoded fallbacks.
  // Section keys for this page in /admin/marketing-pages/movement:
  //   hero         → {eyebrow, headline, subhead}
  //   crisis       → {eyebrow, part, headline, paragraphs (newline-separated)}
  //   conviction   → {eyebrow, part, headline}
  //   vision       → {eyebrow, part, headline, body}
  //   dimensions_header → {eyebrow, headline, body}
  // Dimensions cards use the shared 'dimensions' repeating section
  // (same keys as landing page: dimension, subtitle, description, contrast)
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow  = hero?.eyebrow  || 'The Movement';
  const heroHeadline = hero?.headline || 'A generation is drifting.<br /><span style="color:#C8A96E">We exist to change that.</span>';
  const heroSubhead  = hero?.subhead  || 'Ascentor is not a product. It is a movement — built around one uncompromising conviction about what is wrong with the world and what is required to fix it.';

  const crisis = cms?.sections.crisis?.data as Record<string, string> | undefined;
  const crisisHeadline = crisis?.headline || 'The Crisis';
  const crisisParagraphs = crisis?.paragraphs
    ? crisis.paragraphs.split('\n').filter(Boolean)
    : [
        'Something has gone deeply wrong. Not with resources. Not with intelligence. Not with opportunity alone. What has gone wrong is internal.',
        'A generation of people exists without architecture. They wake up each day and respond — to notifications, to trends, to the expectations of others, to the gravity of immediate gain. They are not lazy. They are not unintelligent. They are not bad.',
        'They are unbuilt.',
        'Leaders without vision, managing rather than building. Professionals without purpose, performing rather than creating. Communities without direction, reacting rather than architecting. Nations without ideology, surviving rather than ascending.',
        'This is not a political problem. It is not an economic problem. It is a human architecture problem. And it demands a movement.',
      ];

  const vision = cms?.sections.vision?.data as Record<string, string> | undefined;
  const visionHeadline = vision?.headline || 'The Vision';
  const visionBody     = vision?.body     || 'A global community of purposeful, ideologically grounded individuals — in every nation, at every level of society — who have chosen to ascend rather than drift. Who are developing themselves completely. Who are building things that last.';

  const dimHeader = cms?.sections.dimensions_header?.data as Record<string, string> | undefined;
  const dimHeadline = dimHeader?.headline || 'The Total Person';
  const dimBody     = dimHeader?.body     || 'The movement is built around one model of human development. Not career success. Not social media influence. Not productivity. The total person.';
  const dimItems = (cms?.sections.dimensions?.items || []) as Array<Record<string, string>>;
  const defaultDimensions = dimensions; // use the const already defined above
  return (
    <>

      {/* Nav */}
      <nav className="mkt-nav mkt-nav-light">
        <div className="mkt-nav-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" height={26} style={{ display: 'block' }} /></Link>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/elevation-summit" style={{ fontSize: '0.875rem', color: '#374151', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
              className="mkt-nav-summit-link">
              The Elevation Summit
            </Link>
            <Link href="/signup" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              Join Ascentor →
            </Link>
          </div>
        </div>
      </nav>

      <style>{`.mkt-nav-summit-link { display: none; } @media(min-width: 640px){ .mkt-nav-summit-link { display: inline; } }`}</style>

      {/* Hero */}
      <section style={{ padding: 'clamp(5rem, 10vw, 8rem) 1.5rem clamp(3rem, 6vw, 5rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>The Movement</p>
        <h1 className="mkt-page-headline" style={{ marginBottom: '1.5rem', maxWidth: '780px' }}
          dangerouslySetInnerHTML={{ __html: h(heroHeadline) }} />
        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: '#374151', lineHeight: 1.75, maxWidth: '620px' }}>
          {heroSubhead}
        </p>
      </section>

      {/* The Crisis */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px' }}>
            <p className="mkt-eyebrow" style={{ color: '#C8A96E', marginBottom: '1.5rem' }}>Part I</p>
            <h2 className="mkt-section-headline" style={{ color: '#FAFAF8', marginBottom: '2rem' }}>{crisisHeadline}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {crisisParagraphs.map((para, i) => (
                <p key={i} style={{
                  fontSize: para === 'They are unbuilt.' ? '1.5rem' : '1.0625rem',
                  color: para === 'They are unbuilt.' ? '#C8A96E' : '#9CA3AF',
                  fontWeight: para === 'They are unbuilt.' ? 700 : 400,
                  fontFamily: para === 'They are unbuilt.'
                    ? 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
                    : 'var(--font-body, "Inter", sans-serif)',
                  lineHeight: 1.75,
                }}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The Conviction */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '760px' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>Part II</p>
          <h2 className="mkt-section-headline" style={{ marginBottom: '2rem' }}>The Conviction</h2>

          <div className="conviction-block" style={{ marginBottom: '2.5rem' }}>
            <p style={{
              fontFamily: 'var(--font-accent, "Playfair Display", serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              color: '#C8A96E',
              lineHeight: 1.5,
            }}>
              "Every life that matters was built on purpose. Not accident. Not circumstance. Purpose."
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { label: 'Purpose is not discovered passively', text: '— it is built through deliberate confrontation with one\'s own capacity and calling.' },
              { label: 'Character is not inherited', text: '— it is forged through discipline, accountability, and the willingness to be challenged.' },
              { label: 'Impact is not accidental', text: '— it is the result of people who thought in decades and centuries, not quarters and trends.' },
              { label: 'The individual and the community rise together', text: '— no person ascends alone, and no community ascends without purposeful individuals within it.' },
              { label: 'The world does not need more talented people', text: '— it needs more built people.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C8A96E', marginTop: '0.6rem', flexShrink: 0 }} />
                <p style={{ fontSize: '1.0625rem', color: '#374151', lineHeight: 1.75 }}>
                  <strong style={{ color: '#0F0F0E', fontWeight: 600 }}>{item.label}</strong> {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Total Person */}
      <section id="total-person" style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>The Mission</p>
            <h2 className="mkt-section-headline" style={{ maxWidth: '640px', marginBottom: '1rem' }}>
              Build the total person.
            </h2>
            <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.75, maxWidth: '620px' }}>
              {dimBody}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {(dimItems.length > 0 ? dimItems : defaultDimensions).map((dim) => (
              <div key={dim.name} className="mkt-dimension-card">
                <div className="mkt-gold-bar" />
                <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.25rem' }}>{dim.name}</h3>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#9CA3AF', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{dim.subtitle}</p>
                <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7 }}>{dim.description}</p>
                <p className="contrast">{dim.contrast}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Vision 2050 */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px', marginBottom: '4rem' }}>
            <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>The Vision</p>
            <h2 className="mkt-section-headline" style={{ marginBottom: '1.5rem' }}>{visionHeadline === 'The Vision' ? '2050.' : visionHeadline}</h2>
            <p style={{ fontSize: '1.0625rem', color: '#374151', lineHeight: 1.75, marginBottom: '1.25rem' }}>
              {visionBody}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
            {[
              { title: 'World Leaders', sub: 'In government, diplomacy, and global institutions' },
              { title: 'Business Titans', sub: 'Building enterprises that solve real problems at scale' },
              { title: 'Political Architects', sub: 'Redesigning the systems that govern nations' },
              { title: 'Thought Leaders', sub: 'Producing the ideas that shape culture and civilization' },
              { title: 'Culture Shapers', sub: 'Defining what excellence and integrity look like in their generation' },
              { title: 'Nation Builders', sub: 'Leaving their nations measurably better than they found them' },
            ].map((item) => (
              <div key={item.title} style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #E8E6E1', borderRadius: '0.75rem' }}>
                <div className="mkt-gold-bar" style={{ marginBottom: '0.75rem' }} />
                <h3 style={{
                  fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                  fontSize: '1rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.5rem',
                }}>{item.title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Founder */}
      <section style={{ padding: '0 1.5rem clamp(4rem, 8vw, 7rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="founder-section">
          <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>The Founder's Mandate</p>
          <div style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                'I did not choose this mission because it was convenient. I chose it because I grew up inside the crisis it exists to solve.',
                'I came from lack and limitation. I watched men and women around me drift — not because they were incapable but because no one had ever shown them what a built life looked like.',
                'I was not spared those circumstances. But somewhere in the middle of them, something was decided in me — not perfectly, not finally, but decisively:',
                'I will not drift. And I will spend my life making it harder for others to drift.',
                'Everything I build — every company, every community, every platform, every conversation — is in service of that one thing: to build and raise people of value and of great impact.',
              ].map((para, i) => (
                <p key={i} style={{
                  fontSize: para.startsWith('I will not') ? '1.25rem' : '1.0625rem',
                  color: para.startsWith('I will not') ? '#0F0F0E' : '#374151',
                  fontWeight: para.startsWith('I will not') ? 700 : 400,
                  fontFamily: para.startsWith('I will not')
                    ? 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
                    : 'var(--font-body, "Inter", sans-serif)',
                  lineHeight: 1.75,
                }}>
                  {para}
                </p>
              ))}
            </div>
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #E8E6E1' }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0F0F0E' }}>
                Ajiboye Ayomiposi Samuel
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Founder, Ascentor · The Elevation Summit · Lagos, Nigeria
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Call / CTA */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(5rem, 10vw, 8rem) 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ color: '#C8A96E', marginBottom: '1.5rem' }}>The Call</p>
          <h2 style={{
            fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            fontWeight: 800, color: '#FAFAF8',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            marginBottom: '1.5rem',
          }}>
            If you have read this far, something in you recognized itself in these words.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>
            Ascentor is not for everyone. It is for the ones who have decided. If that is you — your ascent begins here.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
              Join Ascentor →
            </Link>
            <Link href="/elevation-summit" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.875rem 2rem', borderColor: 'rgba(255,255,255,0.15)', color: '#FAFAF8' }}>
              The Elevation Summit →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F0F0E', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1.5rem', textAlign: 'center' }}>
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
