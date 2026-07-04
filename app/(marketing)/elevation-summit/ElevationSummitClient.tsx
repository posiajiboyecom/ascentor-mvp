'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';
import '@/styles/marketing.css';

const h = (s: string) => s.replace(/<(?!br\s*\/?>)[^>]*>/gi, '');

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Ethiopia', 'Tanzania',
  'Uganda', 'Rwanda', 'Senegal', 'Côte d\'Ivoire', 'Cameroon', 'Angola',
  'Mozambique', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Sierra Leone',
  'Liberia', 'Guinea', 'Mali', 'Burkina Faso', 'Niger', 'Chad', 'Sudan',
  'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya',
  'United Kingdom', 'United States', 'Canada', 'Germany', 'France',
  'Netherlands', 'UAE', 'Qatar', 'Saudi Arabia', 'Other',
];

const HOW_HEARD = [
  'Ascentor platform', 'Instagram', 'LinkedIn', 'X / Twitter',
  'WhatsApp', 'Friend or colleague', 'Email newsletter',
  'Google / search', 'Other',
];

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
  'Education', 'Energy & Resources', 'Government & Policy',
  'Media & Entertainment', 'Legal', 'Real Estate', 'Agriculture',
  'Manufacturing', 'NGO / Non-profit', 'Entrepreneurship',
  'Creative Arts', 'Other',
];

const INPUT = {
  display: 'block' as const,
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '0.9375rem',
  borderRadius: '0.625rem',
  border: '1.5px solid #E8E6E1',
  background: '#FAFAF8',
  color: '#0F0F0E',
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'var(--font-body, "Inter", sans-serif)',
  transition: 'border-color 0.15s',
};

const LABEL = {
  display: 'block' as const,
  fontSize: '0.875rem',
  fontWeight: 600 as const,
  color: '#0F0F0E',
  marginBottom: '0.4rem',
};

const HINT = {
  fontSize: '0.8125rem',
  color: '#9CA3AF',
  marginTop: '0.3rem',
};

type Form = {
  full_name: string;
  email: string;
  whatsapp: string;
  phone: string;
  country: string;
  city: string;
  current_role: string;
  organisation: string;
  industry: string;
  what_building: string;
  why_attend: string;
  how_heard: string;
  dietary_needs: string;
  accessibility: string;
};

const EMPTY: Form = {
  full_name: '', email: '', whatsapp: '', phone: '',
  country: '', city: '', current_role: '', organisation: '', industry: '',
  what_building: '', why_attend: '', how_heard: '',
  dietary_needs: '', accessibility: '',
};

export default function ElevationSummitClient({ cms }: { cms: PublishedPage | null }) {
  // CMS section keys
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow   = hero?.eyebrow    || 'Inaugural Gathering · December 2026';
  const heroHeadline  = hero?.headline   || 'The Elevation<br />Summit';
  const heroSubhead   = hero?.subhead    || 'One gathering. One decision. The rest of your life.';
  const heroCtaLabel  = hero?.cta_label  || 'Register Now →';
  const heroCta2Label = hero?.cta2_label || 'What is The Summit?';

  const whatItIs = cms?.sections.what_it_is?.data as Record<string, string> | undefined;
  const whatEyebrow  = whatItIs?.eyebrow  || 'What It Is';
  const whatHeadline = whatItIs?.headline || 'Not a conference.<br /><span style="color:#C8A96E">A defining moment.</span>';
  const whatBody     = whatItIs?.body     || 'The Elevation Summit is a deliberate interruption of the ordinary rhythms of life — to ask the questions that drift never allows: Who am I becoming? What am I building? What will remain when I am gone?';

  const register = cms?.sections.register?.data as Record<string, string> | undefined;
  const regEyebrow  = register?.eyebrow  || 'Event Registration';
  const regHeadline = register?.headline || 'Secure your place.';
  const regSubhead  = register?.subhead  || 'Registration is open for the inaugural Elevation Summit, December 2026, Lagos — attend physically or join virtually. Complete the form below — every detail helps us prepare the right experience for you.';

  const [form, setForm] = useState<Form>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      full_name:    form.full_name.trim(),
      email:        form.email.trim().toLowerCase(),
      whatsapp:     form.whatsapp.trim(),
      phone:        form.phone.trim() || null,
      country:      form.country,
      city:         form.city.trim() || null,
      current_role: form.current_role.trim() || null,
      organisation: form.organisation.trim() || null,
      industry:     form.industry || null,
      what_building: form.what_building.trim() || null,
      why_attend:   form.why_attend.trim() || null,
      how_heard:    form.how_heard || null,
      dietary_needs: form.dietary_needs.trim() || null,
      accessibility: form.accessibility.trim() || null,
    };

    const res = await fetch('/api/summit/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Something went wrong. Please try again.');
    } else {
      setSubmitted(true);
    }
  };

  return (
    <>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,14,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" height={28} style={{ display: 'block' }} /></Link>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/movement" style={{ fontSize: '0.875rem', color: '#9CA3AF', textDecoration: 'none', fontWeight: 500 }}>The Movement</Link>
            <Link href="/signup" className="btn-gold" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>Join Ascentor →</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: '#0F0F0E', padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>{heroEyebrow}</p>
          <h1 className="mkt-hero-headline" style={{ marginBottom: '1.5rem', maxWidth: '840px' }}
            dangerouslySetInnerHTML={{ __html: h(heroHeadline) }} />
          <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)', color: '#9CA3AF', lineHeight: 1.75, maxWidth: '600px', marginBottom: '3rem' }}>
            {heroSubhead}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="#register" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>{heroCtaLabel}</a>
            <a href="#what-it-is" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.875rem 2rem', borderColor: 'rgba(255,255,255,0.15)', color: '#FAFAF8' }}>{heroCta2Label}</a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ background: '#C8A96E', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { value: 'December 2026', label: 'Inaugural Gathering' },
            { value: 'Lagos, Nigeria', label: 'Location' },
            { value: '1 Day', label: 'Defining Moment' },
            { value: 'Open', label: 'Registration' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: '#0F0F0E', display: 'block' }}>{stat.value}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(15,15,14,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* What It Is */}
      <section id="what-it-is" style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ maxWidth: '760px', marginBottom: '4rem' }}>
            <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>{whatEyebrow}</p>
            <h2 className="mkt-section-headline" style={{ color: '#FAFAF8', marginBottom: '1.5rem' }}
              dangerouslySetInnerHTML={{ __html: h(whatHeadline) }} />
            <p style={{ fontSize: '1.0625rem', color: '#9CA3AF', lineHeight: 1.8 }}>{whatBody}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              { title: 'Not a Motivational Spectacle', description: 'The Summit does not exist to excite you for 72 hours and send you home unchanged. It exists to send you home more built than you arrived.' },
              { title: 'Not a Networking Event', description: 'You will meet extraordinary people. But the purpose is not connection for career advancement — it is the encounter with others who have chosen the same ascent.' },
              { title: 'Not a Conference', description: 'There are no passive attendees. Every person in the room is a participant — challenged, accountable, and choosing, in real time, who they will be.' },
            ].map((item) => (
              <div key={item.title} className="mkt-pillar">
                <div className="mkt-gold-bar" />
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
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Who Attends</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem' }}>Purposeful individuals at every stage of ascent.</h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.75 }}>The Summit is not defined by industry, age, geography, or title. It is defined by one decision: to live with intention and build with purpose.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { stage: 'The Seeker', description: 'Still finding the thread. Coming to the Summit to name what has been unnamed and commit to the direction.' },
            { stage: 'The Builder', description: 'Already building. Coming to the Summit to be sharpened, challenged, and surrounded by people who understand the ascent.' },
            { stage: 'The Leader', description: 'Responsible for others. Coming to the Summit to think at the level their position demands and to invest in the next generation of builders.' },
          ].map((item) => (
            <div key={item.stage} style={{ background: '#FAFAF8', border: '1px solid #E8E6E1', borderRadius: '1rem', padding: '2rem' }}>
              <div className="mkt-gold-bar" />
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>{item.stage}</h3>
              <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.7 }}>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-accent, "Playfair Display", serif)', fontStyle: 'italic', fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', color: '#0F0F0E', lineHeight: 1.55, marginBottom: '1.5rem' }}>
            "Every gathering has one purpose: to send people back to their lives more built than they arrived."
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            The Founding Document · Ascentor
          </p>
        </div>
      </section>

      {/* ── Registration form ── */}
      <section id="register" style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', background: '#FAFAF8' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem', textAlign: 'center' }}>{regEyebrow}</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem', textAlign: 'center', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>{regHeadline}</h2>
          <p style={{ color: '#6B7280', lineHeight: 1.75, marginBottom: '2.5rem', textAlign: 'center', fontSize: '1rem' }}>{regSubhead}</p>

          {submitted ? (
            <div style={{ background: '#0F0F0E', border: '1px solid #C8A96E', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>◇</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, color: '#C8A96E', marginBottom: '0.75rem' }}>
                You&apos;re registered.
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '1rem', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
                We have your details. A confirmation will be sent to your email. We&apos;ll be in touch on WhatsApp closer to the event. Build well until then.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

              {/* Section: Personal */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '1.25rem', marginTop: '0.5rem' }}>Personal details</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Full Name *</label>
                  <input style={INPUT} type="text" required value={form.full_name} onChange={set('full_name')} placeholder="Your full name" />
                </div>
                <div>
                  <label style={LABEL}>Email Address *</label>
                  <input style={INPUT} type="email" required value={form.email} onChange={set('email')} placeholder="your@email.com" />
                </div>
                <div>
                  <label style={LABEL}>WhatsApp Number *</label>
                  <input style={INPUT} type="tel" required value={form.whatsapp} onChange={set('whatsapp')} placeholder="+234 800 000 0000" />
                  <p style={HINT}>We use WhatsApp for event updates and logistics.</p>
                </div>
                <div>
                  <label style={LABEL}>Country *</label>
                  <select style={{ ...INPUT, cursor: 'pointer' }} required value={form.country} onChange={set('country')}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>City <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <input style={INPUT} type="text" value={form.city} onChange={set('city')} placeholder="Lagos, Nairobi, London…" />
                </div>
              </div>

              {/* Section: Professional */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '1.25rem', marginTop: '1.5rem' }}>Professional context</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={LABEL}>Current Role <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <input style={INPUT} type="text" value={form.current_role} onChange={set('current_role')} placeholder="Software Engineer, CEO, Student…" />
                </div>
                <div>
                  <label style={LABEL}>Organisation <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <input style={INPUT} type="text" value={form.organisation} onChange={set('organisation')} placeholder="Company or institution" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Industry <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <select style={{ ...INPUT, cursor: 'pointer' }} value={form.industry} onChange={set('industry')}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Section: Intent */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '1.25rem', marginTop: '1.5rem' }}>Your ascent</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={LABEL}>What are you building? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} value={form.what_building} onChange={set('what_building')}
                    placeholder="Describe what you are building with your life — not your job title." rows={3} />
                  <p style={HINT}>This helps us understand who is in the room.</p>
                </div>
                <div>
                  <label style={LABEL}>Why do you want to attend? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} value={form.why_attend} onChange={set('why_attend')}
                    placeholder="What are you hoping to take away from The Elevation Summit?" rows={3} />
                </div>
                <div>
                  <label style={LABEL}>How did you hear about the Summit? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <select style={{ ...INPUT, cursor: 'pointer' }} value={form.how_heard} onChange={set('how_heard')}>
                    <option value="">Select one</option>
                    {HOW_HEARD.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Section: Logistics */}
              <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '1.25rem', marginTop: '1.5rem' }}>Logistics</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={LABEL}>Dietary needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <input style={INPUT} type="text" value={form.dietary_needs} onChange={set('dietary_needs')} placeholder="Vegetarian, halal, allergies…" />
                </div>
                <div>
                  <label style={LABEL}>Accessibility needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                  <input style={INPUT} type="text" value={form.accessibility} onChange={set('accessibility')} placeholder="Wheelchair, hearing loop…" />
                </div>
              </div>

              {error && (
                <p style={{ fontSize: '0.875rem', color: '#DC2626', background: '#FEF2F2', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #FECACA', marginBottom: '1rem' }}>
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem' }}>
                {loading ? 'Submitting…' : 'Complete Registration →'}
              </button>

              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', marginTop: '1rem' }}>
                Your information is kept private. We will only contact you about The Elevation Summit.
              </p>

              {/* Mobile responsive grid */}
              <style>{`@media(max-width:560px){form > div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr!important}}`}</style>
            </form>
          )}
        </div>
      </section>

      {/* Speak / Partner */}
      <section id="speak" style={{ background: '#F4F3EF', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <div>
            <div className="mkt-gold-bar" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>Become a Speaker</h3>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem', marginBottom: '1rem' }}>The Elevation Summit features voices that have built something real — not polished presenters, but proven builders. If you have a story worth telling to an audience of purposeful people, we want to hear from you.</p>
            <a href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit — Speaker Interest" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C8A96E', textDecoration: 'none' }}>Express speaker interest →</a>
          </div>
          <div id="partner">
            <div className="mkt-gold-bar" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>Partner With Us</h3>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '0.9375rem', marginBottom: '1rem' }}>The Elevation Summit brings together some of the most intentional, high-potential individuals on the continent. If your organization exists to serve purposeful people, there is a conversation to be had.</p>
            <a href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit — Partnership Interest" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#C8A96E', textDecoration: 'none' }}>Explore partnership →</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F0F0E', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-accent, "Playfair Display", serif)', fontStyle: 'italic', color: '#C8A96E', fontSize: '0.9375rem' }}>"Build a life that outlasts you."</p>
          <p style={{ fontSize: '0.8125rem', color: '#4B5563' }}>© 2026 Ascentor. All rights reserved.</p>
          <Link href="/" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>← Back to Ascentor</Link>
        </div>
      </footer>
    </>
  );
}
