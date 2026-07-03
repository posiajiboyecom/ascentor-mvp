'use client';

// app/(marketing)/events/[slug]/EventPageClient.tsx
// Universal event registration page. The registration form is driven by
// event.registration_fields (a JSON array of field keys). Admin controls
// which fields appear by editing the event in /admin/events.

import { useState } from 'react';
import Link from 'next/link';
import '@/styles/marketing.css';

const COUNTRIES = [
  'Nigeria','Ghana','Kenya','South Africa','Ethiopia','Tanzania','Uganda','Rwanda',
  'Senegal','Côte d\'Ivoire','Cameroon','Angola','Mozambique','Zambia','Zimbabwe',
  'Botswana','Namibia','Sierra Leone','Liberia','Guinea','Mali','Burkina Faso',
  'Niger','Chad','Sudan','Egypt','Morocco','Tunisia','Algeria','Libya',
  'United Kingdom','United States','Canada','Germany','France','Netherlands',
  'UAE','Qatar','Saudi Arabia','Other',
];
const INDUSTRIES = [
  'Technology','Finance & Banking','Consulting','Healthcare','Education',
  'Energy & Resources','Government & Policy','Media & Entertainment','Legal',
  'Real Estate','Agriculture','Manufacturing','NGO / Non-profit',
  'Entrepreneurship','Creative Arts','Other',
];
const HOW_HEARD = [
  'Ascentor platform','Instagram','LinkedIn','X / Twitter','WhatsApp',
  'Friend or colleague','Email newsletter','Google / search','Other',
];

const S = {
  input: {
    display: 'block' as const, width: '100%', padding: '0.75rem 1rem',
    fontSize: '0.9375rem', borderRadius: '0.625rem', border: '1.5px solid #E8E6E1',
    background: '#FAFAF8', color: '#0F0F0E', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  },
  label: {
    display: 'block' as const, fontSize: '0.875rem', fontWeight: 600 as const,
    color: '#0F0F0E', marginBottom: '0.4rem',
  },
  hint:  { fontSize: '0.8125rem', color: '#9CA3AF', marginTop: '0.3rem' },
  sec:   { fontSize: '0.75rem', fontWeight: 700 as const, letterSpacing: '0.1em',
           textTransform: 'uppercase' as const, color: '#C8A96E',
           marginBottom: '1.25rem', marginTop: '1.75rem' },
};

const ALL_FIELDS = [
  'full_name','email','whatsapp','phone',
  'country','city',
  'current_role','organisation','industry',
  'what_building','why_attend','how_heard',
  'dietary_needs','accessibility',
];

type Form = Record<string, string>;

export default function EventPageClient({ event }: { event: any }) {
  const fields: string[] = event.registration_fields ?? ['full_name','email','whatsapp','country'];
  const has = (f: string) => fields.includes(f);

  const init: Form = Object.fromEntries(ALL_FIELDS.map(f => [f, '']));
  const [form, setForm] = useState<Form>(init);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const payload: Record<string, string | null> = { eventId: event.id };
    fields.forEach(f => { payload[f] = form[f]?.trim() || null; });

    const res = await fetch('/api/events/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Something went wrong. Please try again.');
    } else { setSubmitted(true); }
  };

  const bgColor = event.cover_color || '#0F0F0E';

  return (
    <>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,15,14,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/ascentor-color-for-dark-pages.svg" alt="Ascentor" height={26} style={{ display: 'block' }} /></Link>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <Link href="/events" style={{ fontSize: '0.875rem', color: '#9CA3AF', textDecoration: 'none', fontWeight: 500 }}>All Events</Link>
            <Link href="/signup" className="btn-gold" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>Join Ascentor →</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: bgColor, padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1.25rem' }}>
            {[event.event_date, event.location].filter(Boolean).join(' · ')}
          </p>
          <h1 className="mkt-hero-headline" style={{ marginBottom: '1.25rem', maxWidth: '800px' }}>
            {event.title}
          </h1>
          {event.tagline && (
            <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)', color: '#9CA3AF', lineHeight: 1.75, maxWidth: '600px', marginBottom: '2rem' }}>
              {event.tagline}
            </p>
          )}
          <a href="#register" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem', display: 'inline-block' }}>
            Register Now →
          </a>
        </div>
      </section>

      {/* About */}
      {event.description && (
        <section style={{ padding: 'clamp(3rem, 6vw, 5rem) 1.5rem', maxWidth: '760px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>About this event</p>
          <p style={{ fontSize: '1.0625rem', color: '#374151', lineHeight: 1.8 }}>{event.description}</p>
        </section>
      )}

      {/* Registration form */}
      <section id="register" style={{ padding: 'clamp(3rem, 6vw, 5rem) 1.5rem', background: '#F4F3EF' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '0.75rem', textAlign: 'center' }}>Registration</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', textAlign: 'center', marginBottom: '0.75rem' }}>
            Secure your place.
          </h2>
          {event.registration_open ? (
            <p style={{ color: '#6B7280', textAlign: 'center', lineHeight: 1.7, marginBottom: '2.5rem' }}>
              Complete the form below to register for {event.title}.
            </p>
          ) : (
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ color: '#92400E', fontWeight: 600 }}>Registration is currently closed for this event.</p>
            </div>
          )}

          {submitted ? (
            <div style={{ background: '#0F0F0E', border: '1px solid #C8A96E', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>◇</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 700, color: '#C8A96E', marginBottom: '0.75rem' }}>
                You&apos;re registered.
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '1rem', lineHeight: 1.7, maxWidth: '440px', margin: '0 auto' }}>
                {event.confirmation_body || "We have your details and will be in touch closer to the event."}
              </p>
            </div>
          ) : event.registration_open ? (
            <form onSubmit={handleSubmit} style={{ background: '#FAFAF8', borderRadius: '1rem', padding: '2rem', border: '1px solid #E8E6E1' }}>

              {/* Personal */}
              {(has('full_name') || has('email') || has('whatsapp') || has('phone') || has('country') || has('city')) && (
                <p style={S.sec}>Personal details</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                {has('full_name') && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Full Name *</label>
                    <input style={S.input} type="text" required value={form.full_name} onChange={set('full_name')} placeholder="Your full name" />
                  </div>
                )}
                {has('email') && (
                  <div>
                    <label style={S.label}>Email *</label>
                    <input style={S.input} type="email" required value={form.email} onChange={set('email')} placeholder="your@email.com" />
                  </div>
                )}
                {has('whatsapp') && (
                  <div>
                    <label style={S.label}>WhatsApp {fields.includes('whatsapp') && has('email') ? '' : '*'}</label>
                    <input style={S.input} type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+234 800 000 0000" />
                    <p style={S.hint}>For event updates and logistics.</p>
                  </div>
                )}
                {has('phone') && (
                  <div>
                    <label style={S.label}>Phone <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 800 000 0000" />
                  </div>
                )}
                {has('country') && (
                  <div>
                    <label style={S.label}>Country *</label>
                    <select style={{ ...S.input, cursor: 'pointer' }} required value={form.country} onChange={set('country')}>
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {has('city') && (
                  <div>
                    <label style={S.label}>City <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="text" value={form.city} onChange={set('city')} placeholder="Lagos, Nairobi…" />
                  </div>
                )}
              </div>

              {/* Professional */}
              {(has('current_role') || has('organisation') || has('industry')) && (
                <p style={S.sec}>Professional</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                {has('current_role') && (
                  <div>
                    <label style={S.label}>Role <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="text" value={form.current_role} onChange={set('current_role')} placeholder="CEO, Engineer, Student…" />
                  </div>
                )}
                {has('organisation') && (
                  <div>
                    <label style={S.label}>Organisation <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="text" value={form.organisation} onChange={set('organisation')} placeholder="Company or institution" />
                  </div>
                )}
                {has('industry') && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Industry <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <select style={{ ...S.input, cursor: 'pointer' }} value={form.industry} onChange={set('industry')}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Intent */}
              {(has('what_building') || has('why_attend') || has('how_heard')) && (
                <p style={S.sec}>About you</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '0.5rem' }}>
                {has('what_building') && (
                  <div>
                    <label style={S.label}>What are you building? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <textarea style={{ ...S.input, resize: 'vertical', minHeight: '80px' }} rows={3} value={form.what_building} onChange={set('what_building')}
                      placeholder="Describe what you are building with your life." />
                  </div>
                )}
                {has('why_attend') && (
                  <div>
                    <label style={S.label}>Why do you want to attend? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <textarea style={{ ...S.input, resize: 'vertical', minHeight: '80px' }} rows={3} value={form.why_attend} onChange={set('why_attend')}
                      placeholder="What are you hoping to take away?" />
                  </div>
                )}
                {has('how_heard') && (
                  <div>
                    <label style={S.label}>How did you hear about this event? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <select style={{ ...S.input, cursor: 'pointer' }} value={form.how_heard} onChange={set('how_heard')}>
                      <option value="">Select one</option>
                      {HOW_HEARD.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Logistics */}
              {(has('dietary_needs') || has('accessibility')) && (
                <p style={S.sec}>Logistics</p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {has('dietary_needs') && (
                  <div>
                    <label style={S.label}>Dietary needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="text" value={form.dietary_needs} onChange={set('dietary_needs')} placeholder="Vegetarian, halal…" />
                  </div>
                )}
                {has('accessibility') && (
                  <div>
                    <label style={S.label}>Accessibility needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
                    <input style={S.input} type="text" value={form.accessibility} onChange={set('accessibility')} placeholder="Wheelchair, hearing loop…" />
                  </div>
                )}
              </div>

              {error && (
                <p style={{ color: '#DC2626', background: '#FEF2F2', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #FECACA', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem' }}>
                {loading ? 'Submitting…' : 'Complete Registration →'}
              </button>
              <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center', marginTop: '1rem' }}>
                Your information is kept private and only used for this event.
              </p>

              <style>{`@media(max-width:560px){form > div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr!important}}`}</style>
            </form>
          ) : null}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0F0F0E', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontFamily: 'var(--font-accent,"Playfair Display",serif)', fontStyle: 'italic', color: '#C8A96E', fontSize: '0.9375rem' }}>
            "Build a life that outlasts you."
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#4B5563' }}>© 2026 Ascentor.</p>
          <Link href="/" style={{ fontSize: '0.875rem', color: '#6B7280', textDecoration: 'none' }}>← Back to Ascentor</Link>
        </div>
      </footer>
    </>
  );
}
