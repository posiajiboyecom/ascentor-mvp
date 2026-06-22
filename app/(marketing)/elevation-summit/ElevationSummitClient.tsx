'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';

const h = (s: string) => s.replace(/<(?!br\s*\/?>)[^>]*>/gi, '');

export default function ElevationSummitClient({ cms }: { cms: PublishedPage | null }) {
  const supabase = createClient();

  // CMS section keys for /admin/marketing-pages/elevation-summit:
  //   hero         → {eyebrow, headline, subhead, cta_label, cta2_label}
  //   what_it_is   → {eyebrow, headline, body}
  //   register     → {eyebrow, headline, subhead}
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow   = hero?.eyebrow    || 'Annual Gathering · February 2027';
  const heroHeadline  = hero?.headline   || 'The Elevation<br />Summit';
  const heroSubhead   = hero?.subhead    || 'One gathering. One decision. The rest of your life.';
  const heroCtaLabel  = hero?.cta_label  || 'Register Interest →';
  const heroCta2Label = hero?.cta2_label || 'What is The Summit?';

  const whatItIs = cms?.sections.what_it_is?.data as Record<string, string> | undefined;
  const whatEyebrow  = whatItIs?.eyebrow  || 'What It Is';
  const whatHeadline = whatItIs?.headline || 'Not a conference.<br /><span style="color:#C8A96E">A defining moment.</span>';
  const whatBody     = whatItIs?.body     || 'The Elevation Summit is a deliberate interruption of the ordinary rhythms of life — to ask the questions that drift never allows: Who am I becoming? What am I building? What will remain when I am gone?';

  const register = cms?.sections.register?.data as Record<string, string> | undefined;
  const regEyebrow  = register?.eyebrow  || 'Register Interest';
  const regHeadline = register?.headline || 'Be among the first.';
  const regSubhead  = register?.subhead  || 'The inaugural Elevation Summit is coming. Register your interest and be among the first to receive details on dates, location, and how to attend.';

  const [form, setForm] = useState({ name: '', email: '', what_building: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: dbError } = await supabase.from('summit_interest').insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      what_building: form.what_building.trim() || null,
    });

    setLoading(false);

    if (dbError) {
      if (dbError.code === '23505') {
        setError("You've already registered your interest. We'll be in touch.");
      } else {
        setError('Something went wrong. Please try again.');
      }
    } else {
      setSubmitted(true);
    }
  };

  return (
    <>
      <style>{`
        body { background: #FAFAF8 !important; color: #0F0F0E !important; }

        .eyebrow {
          font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #C8A96E;
        }

        .hero-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(3rem, 7vw, 6rem);
          font-weight: 800; line-height: 1.0; letter-spacing: -0.03em;
          color: #FAFAF8;
        }

        .section-headline {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(1.875rem, 4vw, 3rem);
          font-weight: 700; line-height: 1.15; letter-spacing: -0.02em;
        }

        .gold-bar {
          width: 2.5rem; height: 3px; background: #C8A96E;
          border-radius: 2px; margin-bottom: 1rem;
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

        .pillar {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 1rem; padding: 2rem;
        }
        .pillar h3 {
          font-family: var(--font-display, 'Plus Jakarta Sans', sans-serif);
          font-size: 1.125rem; font-weight: 700;
          color: #FAFAF8; margin-bottom: 0.75rem;
        }
        .pillar p { font-size: 0.9375rem; color: #9CA3AF; line-height: 1.7; }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,14,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
            fontSize: '1.25rem', fontWeight: 800, color: '#FAFAF8',
            letterSpacing: '-0.03em', textDecoration: 'none',
          }}>Ascentor</Link>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/movement" style={{ fontSize: '0.875rem', color: '#9CA3AF', textDecoration: 'none', fontWeight: 500 }}>The Movement</Link>
            <Link href="/signup" className="btn-gold" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
              Join Ascentor →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>{heroEyebrow}</p>
          <h1 className="hero-headline" style={{ marginBottom: '1.5rem', maxWidth: '840px' }}
            dangerouslySetInnerHTML={{ __html: h(heroHeadline) }} />
          <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)', color: '#9CA3AF', lineHeight: 1.75, maxWidth: '600px', marginBottom: '3rem' }}>
            {heroSubhead}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#register" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
              {heroCtaLabel}
            </a>
            <a href="#what-it-is" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.875rem 2rem', borderColor: 'rgba(255,255,255,0.15)', color: '#FAFAF8' }}>
              {heroCta2Label}
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ background: '#C8A96E', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { value: 'February 2027', label: 'Inaugural Gathering' },
            { value: 'Lagos, Nigeria', label: 'Location' },
            { value: '1 Day', label: 'Defining Moment' },
            { value: 'Open', label: 'Registration' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontWeight: 800, fontSize: '1.25rem', color: '#0F0F0E', display: 'block' }}>{stat.value}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(15,15,14,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* What It Is */}
      <section id="what-it-is" style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px', marginBottom: '4rem' }}>
            <p className="eyebrow" style={{ marginBottom: '1.5rem' }}>{whatEyebrow}</p>
            <h2 className="section-headline" style={{ color: '#FAFAF8', marginBottom: '1.5rem' }}
              dangerouslySetInnerHTML={{ __html: h(whatHeadline) }} />
            <p style={{ fontSize: '1.0625rem', color: '#9CA3AF', lineHeight: 1.8 }}>{whatBody}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              {
                title: 'Not a Motivational Spectacle',
                description: 'The Summit does not exist to excite you for 72 hours and send you home unchanged. It exists to send you home more built than you arrived.',
              },
              {
                title: 'Not a Networking Event',
                description: 'You will meet extraordinary people. But the purpose is not connection for career advancement — it is the encounter with others who have chosen the same ascent.',
              },
              {
                title: 'Not a Conference',
                description: 'There are no passive attendees. Every person in the room is a participant — challenged, accountable, and choosing, in real time, who they will be.',
              },
            ].map((item) => (
              <div key={item.title} className="pillar">
                <div className="gold-bar" />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who Attends */}
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem' }}>Who Attends</p>
          <h2 className="section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem' }}>
            Purposeful individuals at every stage of ascent.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.75 }}>
            The Summit is not defined by industry, age, geography, or title. It is defined by one decision: to live with intention and build with purpose.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { stage: 'The Seeker', description: 'Still finding the thread. Coming to the Summit to name what has been unnamed and commit to the direction.' },
            { stage: 'The Builder', description: 'Already building. Coming to the Summit to be sharpened, challenged, and surrounded by people who understand the ascent.' },
            { stage: 'The Leader', description: 'Responsible for others. Coming to the Summit to think at the level their position demands and to invest in the next generation of builders.' },
          ].map((item) => (
            <div key={item.stage} style={{ background: '#FAFAF8', border: '1px solid #E8E6E1', borderRadius: '1rem', padding: '2rem', transition: 'box-shadow 0.2s' }}>
              <div className="gold-bar" />
              <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>
                {item.stage}
              </h3>
              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.7 }}>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-accent, "Playfair Display", serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
            color: '#0F0F0E',
            lineHeight: 1.55,
            marginBottom: '1.5rem',
          }}>
            "Every gathering has one purpose: to send people back to their lives more built than they arrived."
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            The Founding Document · Ascentor
          </p>
        </div>
      </section>

      {/* Register Interest */}
      <section id="register" style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p className="eyebrow" style={{ marginBottom: '1rem', textAlign: 'center' }}>{regEyebrow}</p>
          <h2 className="section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem', textAlign: 'center', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            {regHeadline}
          </h2>
          <p style={{ color: '#6B7280', lineHeight: 1.75, marginBottom: '2.5rem', textAlign: 'center', fontSize: '1rem' }}>
            {regSubhead}
          </p>

          {submitted ? (
            <div style={{
              background: '#0F0F0E', border: '1px solid #C8A96E',
              borderRadius: '1rem', padding: '2.5rem', textAlign: 'center',
            }}>
              <p style={{
                fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                fontSize: '1.25rem', fontWeight: 700, color: '#C8A96E', marginBottom: '0.75rem',
              }}>You're registered.</p>
              <p style={{ color: '#9CA3AF', fontSize: '1rem', lineHeight: 1.7 }}>
                We have your details. When the time comes, you will be among the first to know. Build well until then.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your full name"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your@email.com"
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  What are you building? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
                </label>
                <textarea
                  value={form.what_building}
                  onChange={(e) => setForm({ ...form, what_building: e.target.value })}
                  placeholder="Describe what you are building with your life — not your job title."
                  rows={3}
                  className="input-field"
                  style={{ resize: 'vertical', minHeight: '90px' }}
                />
                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginTop: '0.375rem' }}>
                  This helps us understand who is coming to the Summit.
                </p>
              </div>

              {error && (
                <p style={{ fontSize: '0.875rem', color: '#DC2626', background: '#FEF2F2', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #FECACA' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem', marginTop: '0.5rem' }}>
                {loading ? 'Registering...' : 'Register My Interest →'}
              </button>

              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center' }}>
                No spam. No selling your data. Just the Summit when it's ready.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Speak / Partner anchors */}
      <section id="speak" style={{ background: '#F4F3EF', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <div className="gold-bar" />
            <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>
              Become a Speaker
            </h3>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem', marginBottom: '1rem' }}>
              The Elevation Summit features voices that have built something real — not polished presenters, but proven builders. If you have a story worth telling to an audience of purposeful people, we want to hear from you.
            </p>
            <a href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit — Speaker Interest" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C8A96E', textDecoration: 'none' }}>
              Express speaker interest →
            </a>
          </div>

          <div id="partner">
            <div className="gold-bar" />
            <h3 style={{ fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>
              Partner With Us
            </h3>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem', marginBottom: '1rem' }}>
              The Elevation Summit brings together some of the most intentional, high-potential individuals on the continent. If your organization exists to serve purposeful people, there is a conversation to be had.
            </p>
            <a href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit — Partnership Interest" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C8A96E', textDecoration: 'none' }}>
              Explore partnership →
            </a>
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
