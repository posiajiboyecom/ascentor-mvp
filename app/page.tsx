'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LandingPage() {
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [hasBlogPosts, setHasBlogPosts] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [userCount, setUserCount] = useState<number | null>(null);

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
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            {/* Logo */}
            <Link href="/" style={{ textDecoration: 'none' }}>
              <span style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0F0F0E',
                letterSpacing: '-0.03em',
              }}>Ascentor</span>
            </Link>

            {/* Desktop Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }} className="desktop-nav">
              <Link href="/movement" className="nav-link">The Movement</Link>
              <Link href="/community" className="nav-link">Community</Link>
              <Link href="/elevation-summit" className="nav-link">The Elevation Summit</Link>
              {hasBlogPosts && <Link href="/blog" className="nav-link">Resources</Link>}
              <Link href="/about" className="nav-link">About</Link>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Link href="/login" style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                textDecoration: 'none',
              }}>Sign in</Link>
              <Link href="/signup" className="btn-primary" style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}>
                Join Ascentor →
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: 'clamp(5rem, 10vw, 8rem) 1.5rem clamp(4rem, 8vw, 6rem)', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '820px' }}>
          <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>The Elevation Summit Movement</p>

          <h1 className="hero-headline" style={{ marginBottom: '1.5rem' }}>
            You were not built<br />to drift.
          </h1>

          <p style={{
            fontSize: 'clamp(1.0625rem, 2vw, 1.25rem)',
            color: '#374151',
            lineHeight: 1.7,
            maxWidth: '600px',
            marginBottom: '2.5rem',
          }}>
            Ascentor is the daily platform of The Elevation Summit —
            a global community of purposeful individuals building lives
            of meaning, leadership, and lasting impact.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <Link href="/signup" className="btn-primary">Join the Movement →</Link>
            <Link href="/elevation-summit" className="btn-secondary">What is The Elevation Summit?</Link>
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
            <p className="eyebrow" style={{ color: '#C8A96E', marginBottom: '0.25rem' }}>The Elevation Summit</p>
            <p style={{
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
              fontWeight: 700,
              fontSize: '1.125rem',
              color: '#FAFAF8',
            }}>February 2027 · Lagos, Nigeria</p>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>
              The inaugural gathering. One defining moment.
            </p>
          </div>
          <Link href="/elevation-summit" className="btn-gold">
            Register Interest →
          </Link>
        </div>
      </section>

      {/* ── Problem Section ── */}
      <section style={{
        background: '#0F0F0E',
        padding: 'clamp(4rem, 8vw, 7rem) 1.5rem',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px' }}>
            <h2 className="section-headline" style={{ color: '#FAFAF8', marginBottom: '1.5rem' }}>
              Most people don't fail because they lack talent.
              <br />
              <span style={{ color: '#C8A96E' }}>They fail because they lack architecture.</span>
            </h2>

            <p style={{ fontSize: '1.125rem', color: '#9CA3AF', lineHeight: 1.75, marginBottom: '1.5rem' }}>
              No framework for their life. No community holding them accountable.
              No ideology anchoring their decisions. Just reaction after reaction
              to whatever the world demands of them.
            </p>

            <p style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#FAFAF8',
            }}>
              Ascentor exists for the ones who are done reacting.
            </p>
          </div>
        </div>
      </section>

      {/* ── Who It's For ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>Who It's For</p>
          <h2 className="section-headline">
            One platform.<br />Every stage of ascent.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[
            {
              stage: 'The Seeker',
              description:
                'Still finding the thread. You know there is more, but you have not named it yet. Ascentor helps you find your purpose framework and start building toward it.',
            },
            {
              stage: 'The Builder',
              description:
                'You know where you are going. Now you are doing the daily work of getting there. Ascentor gives you community, accountability, and development to build faster.',
            },
            {
              stage: 'The Leader',
              description:
                'You have built something. Now you are responsible for others. Ascentor connects you with people operating at your level — and challenges you toward the century-long impact you were built for.',
            },
          ].map((item, i) => (
            <div key={item.stage} className="card">
              <div className="card-number">{String(i + 1).padStart(2, '0')}</div>
              <div className="gold-bar" />
              <h3 style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#0F0F0E',
                marginBottom: '0.75rem',
              }}>{item.stage}</h3>
              <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three Pillars ── */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <p className="eyebrow" style={{ marginBottom: '1rem' }}>How It Works</p>
            <h2 className="section-headline">Three forces.<br />One direction.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {[
              {
                pillar: 'Community',
                description:
                  'A global circle of purposeful individuals. Not a networking group. A brotherhood and sisterhood anchored by shared ideology and mutual accountability.',
                featured: false,
              },
              {
                pillar: 'Development',
                description:
                  'Structured pathways for becoming the total person — in mind, character, vocation, relationships, and civic impact.',
                featured: false,
              },
              {
                pillar: 'The Elevation Summit',
                description:
                  'Once a year, the community gathers. The annual Summit is the peak moment — inspiration, challenge, and the collective experience of people who chose to ascend.',
                featured: true,
                badge: 'Next gathering: February 2027',
                cta: { label: 'Learn about The Elevation Summit →', href: '/elevation-summit' },
              },
            ].map((item) => (
              <div key={item.pillar} className={`pillar-card ${item.featured ? 'featured' : ''}`}>
                {item.badge && (
                  <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'rgba(200,169,110,0.15)',
                    color: '#C8A96E',
                    marginBottom: '1rem',
                  }}>{item.badge}</span>
                )}
                <div className="gold-bar" />
                <h3 style={{
                  fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                  color: item.featured ? '#FAFAF8' : '#0F0F0E',
                }}>{item.pillar}</h3>
                <p style={{
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  marginBottom: item.cta ? '1.5rem' : 0,
                  color: item.featured ? '#9CA3AF' : '#6B7280',
                }}>{item.description}</p>
                {item.cta && (
                  <Link href={item.cta.href} style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#C8A96E',
                    textDecoration: 'none',
                  }}>{item.cta.label}</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Total Person ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>The Total Person</p>
          <h2 className="section-headline">
            Six dimensions.<br />One complete life.
          </h2>
          <p style={{ color: '#6B7280', lineHeight: 1.7, marginTop: '1rem', fontSize: '1rem' }}>
            Ascentor is built around a single conviction: that human development cannot be reduced to career outcomes. Every feature, every conversation, every resource is oriented toward these six dimensions.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {[
            { dimension: 'Mind', description: 'How you think — independently, critically, and without the distortion of trend or fear.' },
            { dimension: 'Character', description: 'How you live — your private and public life as one consistent, principled whole.' },
            { dimension: 'Vocation', description: 'How you work — with purpose, not just productivity. For impact, not just income.' },
            { dimension: 'Relationships', description: 'How you lead others — as a partner, parent, friend, mentor, and example.' },
            { dimension: 'Community', description: 'What you build beyond yourself — civic contribution and national responsibility.' },
            { dimension: 'Legacy', description: 'What remains when you are gone — the institutions, ideas, and people you set in motion.' },
          ].map((item) => (
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
          <p className="quote-block" style={{ marginBottom: '1.5rem' }}>
            "An unbuilt person cannot build anything that lasts."
          </p>
          <p style={{ fontSize: '0.875rem', color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            The founding conviction of Ascentor
          </p>
        </div>
      </section>

      {/* ── Newsletter / Join ── */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          maxWidth: '640px',
          margin: '0 auto',
          textAlign: 'center',
        }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>Stay Connected</p>
          <h2 className="section-headline" style={{ marginBottom: '1rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            Join the movement newsletter.
          </h2>
          <p style={{ color: '#6B7280', lineHeight: 1.7, marginBottom: '2rem', fontSize: '1rem' }}>
            Insights on purposeful living, updates on The Elevation Summit, and the ideas shaping the movement — delivered weekly.
          </p>

          {subscribed ? (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <p style={{ fontWeight: 600, color: '#16A34A', marginBottom: '0.25rem' }}>You're in.</p>
              <p style={{ fontSize: '0.875rem', color: '#374151' }}>Welcome to the movement. Watch your inbox.</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="input-field"
                style={{ maxWidth: '360px' }}
              />
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
          <p className="eyebrow" style={{ color: '#C8A96E', marginBottom: '1.5rem' }}>
            Your ascent begins here
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
            fontSize: 'clamp(2.25rem, 5vw, 4rem)',
            fontWeight: 800,
            color: '#FAFAF8',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1.5rem',
          }}>
            Build a life that<br />outlasts you.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', marginBottom: '2.5rem', lineHeight: 1.7 }}>
            Ascentor is not for everyone. It is for the ones who have decided.
          </p>
          <Link href="/signup" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
            Join Ascentor →
          </Link>
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
                <Link href="/newsletter">Newsletter</Link>
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
