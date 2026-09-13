'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { summitFormSchema, SummitFormValues } from './summitFormSchema';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';
import '@/styles/marketing.css';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import { useModal } from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { Compass, Hammer, Crown, Sparkles, Network, Monitor } from 'lucide-react';

const h = (s: string) => s.replace(/<(?!br\s*\/?>)[^>]*>/gi, '');


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
  fontFamily: 'Metropolis, "Inter", sans-serif',
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
  const whatBody     = whatItIs?.body     || 'The Elevation Summit is a deliberate interruption of the ordinary rhythms of life - to ask the questions that drift never allows: Who am I becoming? What am I building? What will remain when I am gone?';

  const regSection = cms?.sections.register?.data as Record<string, string> | undefined;
  const regEyebrow  = regSection?.eyebrow  || 'Event Registration';
  const regHeadline = regSection?.headline || 'Secure your place.';
  const regSubhead  = regSection?.subhead  || 'Registration is open for the inaugural Elevation Summit, 19 November, 2026, Lagos - attend physically or join virtually. Complete the form below - every detail helps us prepare the right experience for you.';

  const { alert, confirm } = useModal();
  const router = useRouter();

  const GALLERY_IMAGES = [
    '/images/IMG-20250125-WA0113.jpg',
    '/images/IMG_5584.jpg',
    '/images/IMG_5592.jpg',
    '/images/IMG_5592_(1).jpg',
    '/images/IMG_5593.jpg',
    '/images/IMG_5602.jpg',
    '/images/IMG_5603.jpg',
    '/images/IMG_5610.jpg',
    '/images/IMG_5612.jpg',
    '/images/IMG_5613.jpg',
    '/images/IMG_5615.jpg',
    '/images/IMG_5621.jpg',
    '/images/IMG_5628.jpg',
    '/images/IMG_5639.jpg',
    '/images/IMG_5645.jpg',
    '/images/IMG_5654.jpg',
    '/images/IMG_5665.jpg',
    '/images/IMG_5666.jpg',
    '/images/PXL_20250125_093829687.LONG_EXPOSURE-01.COVER.jpg',
    '/images/PXL_20250125_093950863.jpg',
    '/images/PXL_20250125_105854172.PORTRAIT.jpg',
    '/images/PXL_20250125_110049979.jpg',
    '/images/PXL_20250125_114854095.MP.jpg',
    '/images/PXL_20250125_114916546.MP.jpg',
    '/images/PXL_20250125_115406391.jpg',
    '/images/PXL_20250125_115412210.jpg',
    '/images/PXL_20250125_115416461.jpg',
  ];

  const shuffledTop = useMemo(() => GALLERY_IMAGES, []);
  const shuffledBottom = useMemo(() => [...GALLERY_IMAGES].reverse(), []);

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
      location: '',
      organisation: '',
      current_role: '',
      other_messages: '',
      consent: false,
    },
  });

  const onSubmit = async (data: SummitFormValues) => {
    try {
      const res = await fetch('/api/summit/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        await alert('This email is already confirmed for the Summit.', 'Already registered');
        return;
      }

      if (!res.ok) {
        throw new Error('Registration failed');
      }

      const { registrationId } = await res.json() as { registrationId: string };

      const payRes = await fetch('/api/summit/pay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId }),
      });
      const config = await payRes.json();

      if (!payRes.ok) {
        await alert(config.error || 'Could not prepare your payment.', 'Payment setup failed');
        return;
      }

      const naira = (config.amount / 100).toLocaleString('en-NG');
      const userConfirmed = await confirm(
        `Payment for your ticket confirms your registration. The Elevation Summit costs ₦${naira}. Click OK to proceed to payment.`,
        'Confirm your registration',
        'success'
      );

      if (!userConfirmed) return;

      startPayment(registrationId, config);
    } catch (err) {
      await alert('Something went wrong. Please try again in a moment.', 'Registration failed');
    }
  };

  const startPayment = async (registrationId: string, config: any) => {
    try {
      if (typeof (window as any).PaystackPop === 'undefined') {
        await alert('The payment script is still loading. Please refresh the page and try again.', 'Payment unavailable');
        return;
      }

      const handler = (window as any).PaystackPop.setup({
        key: config.public_key,
        email: config.email,
        amount: config.amount,
        currency: config.currency,
        ref: config.reference,
        metadata: {
          registration_id: registrationId,
          full_name: config.full_name,
        },
        callback: (response: { reference: string }) => {
          verifyAndFinish(response.reference, registrationId);
        },
        onClose: () => {
          alert('Payment was not completed. You can retry from this page whenever you are ready.', 'Payment not completed');
        },
      });

      handler.openIframe();
    } catch (err) {
      await alert('Could not prepare your payment.', 'Payment setup failed');
    }
  };

  const verifyAndFinish = async (reference: string, registrationId: string) => {
    try {
      const res = await fetch('/api/summit/pay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, registrationId }),
      });

      if (res.ok) {
        reset();
        await alert('Check your email for payment confirmation.', 'You are confirmed');
        router.push('/elevation-summit/confirmed');
      } else {
        const data = await res.json().catch(() => ({} as any));
        await alert(data.error || 'Contact us if you were charged.', 'Payment could not be verified');
      }
    } catch (err) {
      await alert('Contact us if you were charged.', 'Payment could not be verified');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script';
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <>
      {/* Hero — image first in DOM so it always renders on top on mobile;
          desktop reorders to text-left / image-right. Same pattern as the
          landing page hero-grid. */}
      <section style={{ background: '#FFFFFF', padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)' }}>
        <div className="summit-hero-grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="summit-hero-image">
            <img
              src="/images/elevation-summit-2.jpeg"
              alt="The Elevation Summit"
              style={{ width: '100%', borderRadius: '1rem', objectFit: 'cover', maxHeight: '520px', display: 'block' }}
            />
          </div>
          <div className="summit-hero-text">
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
        </div>

        <style>{`
          .summit-hero-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2.5rem;
            align-items: center;
          }
          .summit-hero-grid .summit-hero-image { order: 1; }
          .summit-hero-grid .summit-hero-text { order: 2; }
          @media (min-width: 860px) {
            .summit-hero-grid {
              grid-template-columns: 1fr 1fr;
              gap: 4rem;
            }
            .summit-hero-grid .summit-hero-image { order: 2; }
            .summit-hero-grid .summit-hero-text { order: 1; }
          }
        `}</style>
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
              { title: 'Not a Motivational Spectacle', icon: Sparkles, description: 'The Summit does not exist to excite you for 72 hours and send you home unchanged. It exists to send you home more built than you arrived.' },
              { title: 'Not a Networking Event', icon: Network, description: 'You will meet extraordinary people. But the purpose is not connection for career advancement - it is the encounter with others who have chosen the same ascent.' },
              { title: 'Not a Conference', icon: Monitor, description: 'There are no passive attendees. Every person in the room is a participant - challenged, accountable, and choosing, in real time, who they will be.' },
            ].map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.title} className="mkt-pillar">
                  <ItemIcon size={24} style={{ color: '#C8A96E', marginBottom: '0.75rem' }} />
                  <div className="mkt-gold-bar" />
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who Attends */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Who Attends</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem' }}>Purposeful individuals at every stage of ascent.</h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.75 }}>The Summit is not defined by industry, age, geography, or title. It is defined by one decision: to live with intention and build with purpose.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { stage: 'The Seeker', icon: Compass, description: 'Still finding the thread. Coming to the Summit to name what has been unnamed and commit to the direction.' },
            { stage: 'The Builder', icon: Hammer, description: 'Already building. Coming to the Summit to be sharpened, challenged, and surrounded by people who understand the ascent.' },
            { stage: 'The Leader', icon: Crown, description: 'Responsible for others. Coming to the Summit to think at the level their position demands and to invest in the next generation of builders.' },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.stage} style={{ background: '#FAFAF8', border: '1px solid #E8E6E1', borderRadius: '1rem', padding: '2rem' }}>
                <ItemIcon size={24} style={{ color: '#0F0F0E', marginBottom: '0.75rem' }} />
                <div className="mkt-gold-bar" />
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginBottom: '0.75rem' }}>{item.stage}</h3>
                <p style={{ fontSize: '0.9375rem', color: '#6B7280', lineHeight: 1.7 }}>{item.description}</p>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {/* ── Registration form ── */}
      <section id="register" style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', background: '#FAFAF8' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem', textAlign: 'center' }}>{regEyebrow}</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem', textAlign: 'center', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>{regHeadline}</h2>
          <p style={{ color: '#6B7280', lineHeight: 1.75, marginBottom: '2.5rem', textAlign: 'center', fontSize: '1rem' }}>{regSubhead}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="summit-form">

            <div>
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
                    value={field.value || undefined}
                    onChange={field.onChange}
                    international
                    defaultCountry="NG"
                    className="phone-input"
                    numberInputProps={{ style: INPUT, placeholder: '+234 800 000 0000' }}
                  />
                )}
              />
              {errors.whatsapp && <p style={ERROR}>{errors.whatsapp.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Location *</label>
              <input style={INPUT} type="text" {...register('location')} placeholder="Lagos, Nigeria" />
              {errors.location && <p style={ERROR}>{errors.location.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Current Company *</label>
              <input style={INPUT} type="text" {...register('organisation')} placeholder="Company or institution" />
              {errors.organisation && <p style={ERROR}>{errors.organisation.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Current Role *</label>
              <input style={INPUT} type="text" {...register('current_role')} placeholder="Software Engineer, CEO, Student…" />
              {errors.current_role && <p style={ERROR}>{errors.current_role.message}</p>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Other Messages <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '80px' }} {...register('other_messages')} rows={4}
                placeholder="Share any additional details, questions, or requests." />
              {errors.other_messages && <p style={ERROR}>{errors.other_messages.message}</p>}
            </div>

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
              .summit-form {
                display: grid;
                grid-template-columns: 1fr;
                gap: 1rem;
              }
              @media (min-width: 768px) {
                .summit-form {
                  grid-template-columns: 1fr 1fr;
                }
              }
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
                font-family: 'Metropolis', 'Inter', sans-serif;
                transition: border-color 0.15s;
              }
              .phone-input input::placeholder,
              .summit-form input::placeholder,
              .summit-form textarea::placeholder {
                font-family: 'Metropolis', 'Inter', sans-serif;
                color: #9CA3AF;
              }
              .phone-input input:focus {
                border-color: #C8A96E;
              }
              .phone-input .PhoneInputCountry {
                padding-right: 0.75rem;
              }
            `}</style>
          </form>
        </div>
      </section>

      {/* Gallery */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '2.5rem' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>From Past Editions</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem' }}>Moments from the journey.</h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.75, maxWidth: '640px' }}>
            A few snapshots of the people, conversations, and decisions that have shaped the Elevation Summit so far.
          </p>
        </div>

        <div className="gallery-row" style={{ marginBottom: '1.25rem' }}>
          <div className="gallery-track-left">
            {[...shuffledTop, ...shuffledTop].map((src, i) => (
              <img
                key={`left-${i}`}
                src={src}
                alt="Elevation Summit moment"
                style={{ height: '180px', width: 'auto', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0 }}
              />
            ))}
          </div>
        </div>

        <div className="gallery-row">
          <div className="gallery-track-right">
            {[...shuffledBottom, ...shuffledBottom].map((src, i) => (
              <img
                key={`right-${i}`}
                src={src}
                alt="Elevation Summit moment"
                style={{ height: '180px', width: 'auto', borderRadius: '0.75rem', objectFit: 'cover', flexShrink: 0 }}
              />
            ))}
          </div>
        </div>

        <style jsx>{`
          .gallery-row {
            overflow: hidden;
            width: 100%;
          }
          .gallery-track-left,
          .gallery-track-right {
            display: flex;
            gap: 1rem;
            width: max-content;
          }
          .gallery-row:hover .gallery-track-left,
          .gallery-row:hover .gallery-track-right {
            animation-play-state: paused;
          }
          .gallery-track-left {
            animation: scrollLeft 60s linear infinite;
          }
          .gallery-track-right {
            animation: scrollRight 60s linear infinite;
          }
          @keyframes scrollLeft {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes scrollRight {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
        `}</style>
      </section>

      {/* Get Involved */}
      <section id="speak" style={{ background: '#0F0F0E', padding: 'clamp(4rem, 8vw, 6rem) 1.5rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Get Involved</p>
          <h2 style={{ fontFamily: 'var(--font-display)', color: '#FAFAF8', marginBottom: '1.25rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', fontWeight: 700 }}>
            Bring your voice or your organisation.
          </h2>
          <p style={{ color: '#9CA3AF', lineHeight: 1.8, fontSize: '1rem', marginBottom: '2.5rem' }}>
            The Elevation Summit is built by people who have built something real - and by organisations that serve them. If you have a story worth telling to purposeful people, or you want to bring your organisation into the conversation, we would love to hear from you.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <a className="summit-cta-link" href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit - Speaker Interest">
              Express speaker interest →
            </a>
            <a className="summit-cta-link" href="mailto:asamuel@ascentorbi.com?subject=Elevation Summit - Partnership Interest">
              Explore partnership →
            </a>
          </div>

          <style jsx>{`
            .summit-cta-link {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.25rem;
              border-radius: 0.5rem;
              background: #C8A96E;
              color: #0F0F0E;
              font-weight: 600;
              font-size: 0.875rem;
              text-decoration: none;
              transition: background 0.2s, color 0.2s;
            }
            .summit-cta-link:hover {
              background: #FFFFFF;
              color: #0F0F0E;
            }
          `}</style>
        </div>
      </section>

    </>
  );
}
