'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';
import '@/styles/marketing.css';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import { useModal } from '@/components/Modal';
import { useNotifications } from '@/components/Notifications';

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

const ERROR = {
  fontSize: '0.8125rem',
  color: '#DC2626',
  marginTop: '0.25rem',
};

const summitFormSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Enter a valid email address'),
  whatsapp: z.string().min(8, 'WhatsApp number is required'),
  phone: z.string().min(8, 'Phone number is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  current_role: z.string().min(1, 'Role is required'),
  organisation: z.string().min(1, 'Organisation is required'),
  industry: z.string().min(1, 'Industry is required'),
  what_building: z.string().min(1, 'This field is required'),
  why_attend: z.string().min(1, 'This field is required'),
  how_heard: z.string().min(1, 'This field is required'),
  dietary_needs: z.string().optional(),
  accessibility: z.string().optional(),
  other_messages: z.string().optional(),
  consent: z.boolean().refine((val) => val === true, {
    message: 'You must accept the privacy policy to register',
  }),
});

type SummitFormValues = z.infer<typeof summitFormSchema>;

export default function ElevationSummitClient({ cms }: { cms: PublishedPage | null }) {
  // CMS section keys
  const hero = cms?.sections.hero?.data as Record<string, string> | undefined;
  const heroEyebrow   = hero?.eyebrow    || 'Inaugural Gathering · 19 November, 2026';
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
  const regSubhead  = register?.subhead  || 'Registration is open for the inaugural Elevation Summit, 19 November, 2026, Lagos — attend physically or join virtually. Complete the form below — every detail helps us prepare the right experience for you.';

  const { alert } = useModal();
  const { showToast } = useNotifications();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SummitFormValues>({
    resolver: zodResolver(summitFormSchema),
    defaultValues: {
      full_name: '',
      email: '',
      whatsapp: '',
      phone: '',
      country: '',
      city: '',
      current_role: '',
      organisation: '',
      industry: '',
      what_building: '',
      why_attend: '',
      how_heard: '',
      dietary_needs: '',
      accessibility: '',
      other_messages: '',
      consent: false,
    },
  });

  const onSubmit = async (data: SummitFormValues) => {
    try {
      const res = await fetch('/api/summit/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          email: data.email.toLowerCase(),
          whatsapp: data.whatsapp.trim(),
          phone: data.phone.trim(),
          city: data.city.trim(),
          current_role: data.current_role.trim(),
          organisation: data.organisation.trim(),
          what_building: data.what_building.trim(),
          why_attend: data.why_attend.trim(),
          dietary_needs: data.dietary_needs?.trim() || null,
          accessibility: data.accessibility?.trim() || null,
          other_messages: data.other_messages?.trim() || null,
        }),
      });

      if (res.status === 409) {
        showToast('Already registered', 'This email is already registered for the Summit.', 'error');
        return;
      }

      if (!res.ok) {
        throw new Error('Registration failed');
      }

      reset();
      await alert('We have your details. A confirmation will be sent to your email. We will be in touch on WhatsApp closer to the event. Build well until then.', 'You\'re registered.');
    } catch (err) {
      showToast('Registration failed', 'Something went wrong. Please try again.', 'error');
    }
  };

  return (
    <>
      {/* Hero */}
      <section style={{ background: '#FFFFFF', padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'center' }}>
          <div>
            <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>{heroEyebrow}</p>
            <h1 className="mkt-hero-headline" style={{ marginBottom: '1.5rem', maxWidth: '840px', color: '#0F0F0E' }}
              dangerouslySetInnerHTML={{ __html: h(heroHeadline) }} />
            <p style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.375rem)', color: '#6B7280', lineHeight: 1.75, maxWidth: '600px', marginBottom: '3rem' }}>
              {heroSubhead}
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a href="#register" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>{heroCtaLabel}</a>
              <a href="#what-it-is" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.875rem 2rem', borderColor: '#0F0F0E', color: '#0F0F0E' }}>{heroCta2Label}</a>
            </div>
          </div>
          <div>
            <img
              src="/images/elevation-summit-2.jpeg"
              alt="The Elevation Summit"
              style={{ width: '100%', borderRadius: '1rem', objectFit: 'cover', maxHeight: '520px', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ background: '#C8A96E', padding: '1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
          {[
            { value: '19 November, 2026', label: 'Inaugural Gathering' },
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

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>

            {/* Section: Personal */}
            <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '0.25rem' }}>Personal details</p>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Full Name *</label>
              <input style={INPUT} type="text" {...register('full_name')} placeholder="Your full name" />
              {errors.full_name && <p style={ERROR}>{errors.full_name.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Email Address *</label>
              <input style={INPUT} type="email" {...register('email')} placeholder="your@email.com" />
              {errors.email && <p style={ERROR}>{errors.email.message}</p>}
            </div>

            <div>
              <label style={LABEL}>WhatsApp Number *</label>
              <Controller
                name="whatsapp"
                control={control}
                rules={{ required: 'WhatsApp number is required' }}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    international
                    defaultCountry="NG"
                    className="phone-input"
                    placeholder="+234 800 000 0000"
                  />
                )}
              />
              {errors.whatsapp && <p style={ERROR}>{errors.whatsapp.message}</p>}
              <p style={HINT}>We use WhatsApp for event updates and logistics.</p>
            </div>

            <div>
              <label style={LABEL}>Phone Number *</label>
              <Controller
                name="phone"
                control={control}
                rules={{ required: 'Phone number is required' }}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    international
                    defaultCountry="NG"
                    className="phone-input"
                    placeholder="+234 800 000 0000"
                  />
                )}
              />
              {errors.phone && <p style={ERROR}>{errors.phone.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Country *</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} {...register('country')}>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.country && <p style={ERROR}>{errors.country.message}</p>}
            </div>

            <div>
              <label style={LABEL}>City *</label>
              <input style={INPUT} type="text" {...register('city')} placeholder="Lagos, Nairobi, London…" />
              {errors.city && <p style={ERROR}>{errors.city.message}</p>}
            </div>

            {/* Section: Professional */}
            <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '0.25rem', marginTop: '1.5rem' }}>Professional context</p>

            <div>
              <label style={LABEL}>Current Role *</label>
              <input style={INPUT} type="text" {...register('current_role')} placeholder="Software Engineer, CEO, Student…" />
              {errors.current_role && <p style={ERROR}>{errors.current_role.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Organisation *</label>
              <input style={INPUT} type="text" {...register('organisation')} placeholder="Company or institution" />
              {errors.organisation && <p style={ERROR}>{errors.organisation.message}</p>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Industry *</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} {...register('industry')}>
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {errors.industry && <p style={ERROR}>{errors.industry.message}</p>}
            </div>

            {/* Section: Intent */}
            <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '0.25rem', marginTop: '1.5rem' }}>Your ascent</p>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>What are you building? *</label>
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} {...register('what_building')} rows={3}
                placeholder="Describe what you are building with your life — not your job title." />
              {errors.what_building && <p style={ERROR}>{errors.what_building.message}</p>}
              <p style={HINT}>This helps us understand who is in the room.</p>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Why do you want to attend? *</label>
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} {...register('why_attend')} rows={3}
                placeholder="What are you hoping to take away from The Elevation Summit?" />
              {errors.why_attend && <p style={ERROR}>{errors.why_attend.message}</p>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>How did you hear about the Summit? *</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} {...register('how_heard')}>
                <option value="">Select one</option>
                {HOW_HEARD.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.how_heard && <p style={ERROR}>{errors.how_heard.message}</p>}
            </div>

            {/* Section: Logistics */}
            <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: '0.25rem', marginTop: '1.5rem' }}>Logistics</p>

            <div>
              <label style={LABEL}>Dietary needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <input style={INPUT} type="text" {...register('dietary_needs')} placeholder="Vegetarian, halal, allergies…" />
            </div>

            <div>
              <label style={LABEL}>Accessibility needs <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <input style={INPUT} type="text" {...register('accessibility')} placeholder="Wheelchair, hearing loop…" />
            </div>

            {/* Other messages */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL} htmlFor="other_messages">Anything else you would like us to know? <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} id="other_messages" {...register('other_messages')} rows={4}
                placeholder="Share any additional details, questions, or requests." />
            </div>

            {/* Consent */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', color: '#0F0F0E', cursor: 'pointer' }}>
                <input type="checkbox" {...register('consent')} style={{ marginTop: '0.25rem' }} />
                <span>
                  I agree to the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#C8A96E', textDecoration: 'underline' }}>privacy policy</a>
                  {' '}and consent to being contacted about the Elevation Summit.
                </span>
              </label>
              {errors.consent && <p style={ERROR}>{errors.consent.message}</p>}
            </div>

            <button type="submit" className="btn-primary" disabled={isSubmitting}
              style={{ gridColumn: '1 / -1', width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem' }}>
              {isSubmitting ? 'Submitting…' : 'Complete Registration →'}
            </button>

            <p style={{ gridColumn: '1 / -1', fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center' }}>
              Your information is kept private. We will only contact you about The Elevation Summit.
            </p>

            <style jsx>{`
              .phone-input input {
                width: 100%;
                padding: 0.75rem 1rem;
                font-size: 0.9375rem;
                border-radius: 0.625rem;
                border: 1.5px solid #E8E6E1;
                background: #FAFAF8;
                color: #0F0F0E;
                outline: none;
                box-sizing: border-box;
                font-family: var(--font-body, "Inter", sans-serif);
                transition: border-color 0.15s;
              }
              .phone-input .PhoneInputCountry {
                padding-right: 0.75rem;
              }
            `}</style>
          </form>
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

    </>
  );
}
