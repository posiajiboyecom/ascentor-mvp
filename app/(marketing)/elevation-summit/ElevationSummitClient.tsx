'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { summitFormSchema, SummitFormValues } from './summitFormSchema';
import type { PublishedPage } from '@/lib/supabase/queries/marketing';
import '@/styles/marketing.css';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
// Bundled inline-SVG flags — the default flag <img> tags load from an
// external CDN which fails in production. This renders flags locally.
import flags from 'react-phone-number-input/flags';
import { useModal } from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { Compass, Hammer, Crown, Sparkles, Network, Monitor, CalendarDays, MapPin, Clock, TicketCheck, Check } from 'lucide-react';
import SummitCountdown from '@/components/SummitCountdown';
import SummitSpeakers from '@/components/SummitSpeakers';
import SummitFAQ from '@/components/SummitFAQ';

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


type SummitPrices = { onsite: number; virtual: number };

export default function ElevationSummitClient({ cms, prices }: { cms: PublishedPage | null; prices: SummitPrices }) {
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
  const whatBody     = whatItIs?.body     || 'The Elevation Summit is a deliberate interruption of the ordinary rhythms of life. To ask the questions that drift never allows: Who am I becoming? What am I building? What will remain when I am gone?';

  const regSection = cms?.sections.register?.data as Record<string, string> | undefined;
  const regEyebrow  = regSection?.eyebrow  || 'Event Registration';
  const regHeadline = regSection?.headline || 'Secure your place.';
  const regSubhead  = regSection?.subhead  || 'Registration is open for the inaugural Elevation Summit, 19 November, 2026, Lagos - attend physically or join virtually. Complete the form below - every detail helps us prepare the right experience for you.';

  const { alert } = useModal();
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

  // Venue carousel — Aderemi Makanjuola Hall, Lagos State University.
  // Same crossfade pattern as the landing page hero carousel.
  const VENUE_IMAGES = [
    '/images/venue-1.jpg',
    '/images/venue-2.jpg',
    '/images/venue-3.jpg',
    '/images/venue-4.jpg',
  ];

  const shuffledTop = useMemo(() => GALLERY_IMAGES, []);
  const shuffledBottom = useMemo(() => [...GALLERY_IMAGES].reverse(), []);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SummitFormValues>({
    resolver: zodResolver(summitFormSchema),
    defaultValues: {
      attendance_type: 'onsite',
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

  const [activeTab, setActiveTab] = useState<'onsite' | 'virtual'>('onsite');
  const [venueSlide, setVenueSlide] = useState(0);
  // Non-null while the post-payment success overlay is showing
  const [paymentSuccess, setPaymentSuccess] = useState<'onsite' | 'virtual' | null>(null);
  // Non-null while the pre-payment confirmation overlay is showing
  const [pendingPayment, setPendingPayment] = useState<{
    registrationId: string;
    config: any;
    attendanceType: 'onsite' | 'virtual';
    amountNaira: number;
  } | null>(null);
  // Guards against a second Paystack launch while one is already being set up
  const paymentStarting = useRef(false);

  // keep react-hook-form's attendance_type value in sync with the tab
  useEffect(() => {
    setValue('attendance_type', activeTab);
  }, [activeTab, setValue]);

  const onSubmit = async (data: SummitFormValues) => {
    try {
      const res = await fetch('/api/summit/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        await alert(
          "This email address is already confirmed for the Elevation Summit. Check your inbox for your confirmation email. If you can't find it, contact us and we'll help you locate it.",
          'Already Registered'
        );
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
        await alert(
          "We couldn't process your registration. Please check your details and try again. If this keeps happening, reach out to us for help.",
          'Something Went Wrong'
        );
        return;
      }

      // Branded confirm overlay — the shared Modal can't render bold
      // multi-line content and uses dark app tokens that clash here.
      setPendingPayment({
        registrationId,
        config,
        attendanceType: activeTab,
        amountNaira: config.amount / 100,
      });
    } catch (err) {
      await alert(
        "We couldn't process your registration. Please check your details and try again. If this keeps happening, reach out to us for help.",
        'Something Went Wrong'
      );
    }
  };

  const startPayment = async (registrationId: string, config: any) => {
    if (paymentStarting.current) return;
    paymentStarting.current = true;
    try {
      if (typeof (window as any).PaystackPop === 'undefined') {
        paymentStarting.current = false;
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
          paymentStarting.current = false;
          alert(
            'You closed the payment window before finishing your purchase. Your registration details are saved, so you can come back and complete payment at any time to secure your spot.',
            'Payment Not Completed'
          );
        },
      });

      handler.openIframe();
    } catch (err) {
      paymentStarting.current = false;
      await alert(
        "We couldn't process your registration. Please check your details and try again. If this keeps happening, reach out to us for help.",
        'Something Went Wrong'
      );
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
        // Branded success overlay auto-redirects — no click required.
        setPaymentSuccess(activeTab);
        window.setTimeout(() => router.push('/elevation-summit/confirmed'), 3200);
      } else {
        const data = await res.json().catch(() => ({} as any));
        await alert(
          "If you were charged, your money is safe. Contact us with the email address you registered with and we'll confirm your registration manually within 24 hours.",
          "We Couldn't Verify Your Payment"
        );
      }
    } catch (err) {
      await alert(
        "If you were charged, your money is safe. Contact us with the email address you registered with and we'll confirm your registration manually within 24 hours.",
        "We Couldn't Verify Your Payment"
      );
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setVenueSlide((prev) => (prev + 1) % VENUE_IMAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [VENUE_IMAGES.length]);

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
      <section style={{
        background: '#FFFFFF',
        // SVG texture — graph-paper grid in gold, subtle enough that
        // the white base still reads through.
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M48 0H0V48' fill='none' stroke='%23C8A96E' stroke-opacity='0.20' stroke-width='1'/%3E%3C/svg%3E")`,
        padding: 'clamp(5rem, 10vw, 9rem) 1.5rem clamp(4rem, 8vw, 7rem)',
      }}>
        <div className="summit-hero-grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="summit-hero-image">
            <img
              src="/images/elevation-summit-flyer.jpg"
              alt="The Elevation Summit: The Rise We Choose, 19 November 2026, Aderemi Makanjuola Hall, Lagos State University"
              style={{ width: '100%', height: 'auto', borderRadius: '1rem', display: 'block' }}
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
            { value: '19 November, 2026', label: 'Inaugural Gathering', icon: CalendarDays },
            { value: 'Lagos, Nigeria', label: 'Location', icon: MapPin },
            { value: '1 Day', label: 'Defining Moment', icon: Clock },
            { value: 'Open', label: 'Registration', icon: TicketCheck },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <StatIcon size={22} strokeWidth={2} style={{ color: '#0F0F0E', display: 'block', margin: '0 auto 0.5rem' }} aria-hidden="true" />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: '#0F0F0E', display: 'block' }}>{stat.value}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(15,15,14,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</span>
              </div>
            );
          })}
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

      {/* Speakers */}
      <SummitSpeakers />

      {/* Countdown — sits immediately before the registration form section */}
      <SummitCountdown />

      {/* The Venue — image column first in DOM so it renders on top on
          mobile; desktop reorders to text-left / image-right. Reuses the
          summit-hero-grid classes and the landing page hero carousel
          pattern (fixed 4:3 box, crossfade, dot nav). */}
      <section style={{ background: '#F4F3EF', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
        <div className="summit-hero-grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div className="summit-hero-image">
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: '1rem', overflow: 'hidden', background: '#E8E6E1' }}>
              {VENUE_IMAGES.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt="Aderemi Makanjuola Hall, Lagos State University"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: venueSlide === i ? 1 : 0,
                    transition: 'opacity 0.6s ease',
                    pointerEvents: 'none',
                  }}
                />
              ))}
              <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '0.5rem', zIndex: 2 }}>
                {VENUE_IMAGES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setVenueSlide(i)}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: 'none',
                      background: venueSlide === i ? '#0F0F0E' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      transition: 'background 0.2s, transform 0.15s',
                      padding: 0,
                    }}
                    aria-label={`Go to venue photo ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="summit-hero-text">
            <p className="mkt-eyebrow" style={{ marginBottom: '1.5rem' }}>The Venue</p>
            <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1.5rem' }}>
              Aderemi Makanjuola Hall, Lagos State University.
            </h2>
            <p style={{ fontSize: '1.0625rem', color: '#6B7280', lineHeight: 1.8, maxWidth: '560px', marginBottom: '2.5rem' }}>
              A landmark room for a landmark decision. Set on Iba Road, Lagos, the Hall hosts the inaugural Elevation Summit on 19 November, 2026. Come physically, or join from anywhere in the world.
            </p>
            <div>
              <a href="#register" className="btn-gold" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>Secure your place →</a>
            </div>
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

            {/* Attendance tabs — both render the same fields; the tab only
                switches attendance_type and the displayed price. */}
            <div role="tablist" aria-label="Choose how you will attend"
              style={{ gridColumn: '1 / -1', display: 'flex', borderBottom: '1px solid #E8E6E1', marginBottom: '0.5rem' }}>
              {(['onsite', 'virtual'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    fontFamily: 'Metropolis, "Inter", sans-serif',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === t ? '2px solid #C8A96E' : '2px solid transparent',
                    color: activeTab === t ? '#0F0F0E' : '#9CA3AF',
                    marginBottom: '-1px',
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {t === 'onsite'
                    ? `Onsite, Lagos · ₦${prices.onsite.toLocaleString()}`
                    : `Virtual · ₦${prices.virtual.toLocaleString()}`}
                </button>
              ))}
            </div>

            {/* key={activeTab} remounts this wrapper on every tab switch,
                replaying the entrance animation — same fields, fresh feel.
                RHF keeps values in its own store so nothing is lost. */}
            <div key={activeTab} className="summit-fields-anim">

            <p style={{ gridColumn: '1 / -1', fontSize: '0.8125rem', color: '#9CA3AF', margin: 0 }}>
              {activeTab === 'onsite'
                ? 'Attending in person, Aderemi Makanjuola Lecture Theatre, Lagos.'
                : 'Joining virtually. Your join link arrives by email once payment is confirmed.'}
            </p>

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
                    flags={flags}
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

            </div>{/* end .summit-fields-anim */}

            <style jsx>{`
              .summit-form {
                display: grid;
                grid-template-columns: 1fr;
                gap: 1rem;
              }
              .summit-fields-anim {
                grid-column: 1 / -1;
                display: grid;
                grid-template-columns: 1fr;
                gap: 1rem;
                animation: summitFieldsIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
              }
              @keyframes summitFieldsIn {
                from { opacity: 0; transform: translateY(14px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @media (min-width: 768px) {
                .summit-form {
                  grid-template-columns: 1fr 1fr;
                }
                .summit-fields-anim {
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

      {/* FAQ — immediately after the gallery section */}
      <SummitFAQ />

      {/* Partners Marquee — infinite dual-row scroll, paused on hover */}
      <section style={{ background: '#FAFAF8', padding: 'clamp(4rem, 7vw, 6rem) 0', overflow: 'hidden' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', padding: '0 1.5rem 3rem' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Partners &amp; Supporters</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
            Organisations that believe in the rise.
          </h2>
        </div>

        {/* Row 1 — scrolls left */}
        <div className="pm-outer">
          <div className="pm-track pm-left">
            {[1, 2, 3, 4].flatMap(() => [
              <span key={Math.random()} className="pm-item"><img src="/logos/ploy-logo-dark.svg"       alt="Ploy"          className="pm-logo" /></span>,
              <span key={Math.random()} className="pm-item"><img src="/logos/rexta-header.png"         alt="Rexta"         className="pm-logo" /></span>,
              <span key={Math.random()} className="pm-item"><img src="/logos/dear-tech-bro-logo.jpg"   alt="Dear Tech Bro" className="pm-logo" /></span>,
            ])}
          </div>
        </div>

        {/* Row 2 — scrolls right */}
        <div className="pm-outer" style={{ marginTop: '2rem' }}>
          <div className="pm-track pm-right">
            {[1, 2, 3, 4].flatMap(() => [
              <span key={Math.random()} className="pm-item"><img src="/logos/dear-tech-bro-logo.jpg"   alt="Dear Tech Bro" className="pm-logo" /></span>,
              <span key={Math.random()} className="pm-item"><img src="/logos/rexta-header.png"         alt="Rexta"         className="pm-logo" /></span>,
              <span key={Math.random()} className="pm-item"><img src="/logos/ploy-logo-dark.svg"       alt="Ploy"          className="pm-logo" /></span>,
            ])}
          </div>
        </div>

        <style>{`
          .pm-outer {
            overflow: hidden;
            width: 100%;
            /* fade edges for a polished look */
            -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
            mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
          }
          .pm-track {
            display: flex;
            align-items: center;
            width: max-content;
            gap: 0;
          }
          .pm-left {
            animation: pm-scroll-left 28s linear infinite;
          }
          .pm-right {
            animation: pm-scroll-right 28s linear infinite;
          }
          .pm-outer:hover .pm-track {
            animation-play-state: paused;
          }
          @keyframes pm-scroll-left {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          @keyframes pm-scroll-right {
            from { transform: translateX(-50%); }
            to   { transform: translateX(0); }
          }
          .pm-item {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0 2.5rem;
            border-right: 1px solid #E8E6E1;
            flex-shrink: 0;
          }
          .pm-logo {
            height: 44px;
            width: auto;
            max-width: 160px;
            object-fit: contain;
            filter: grayscale(1);
            opacity: 0.65;
            transition: filter 0.2s, opacity 0.2s;
          }
          .pm-item:hover .pm-logo {
            filter: grayscale(0);
            opacity: 1;
          }
          @media (prefers-reduced-motion: reduce) {
            .pm-left, .pm-right { animation: none; }
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

      {/* Pre-payment confirmation — shows what they're buying in bold,
          then hands off to Paystack. */}
      {pendingPayment && (
        <div
          role="alertdialog"
          aria-label="Confirm your registration"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 15, 14, 0.55)', backdropFilter: 'blur(6px)',
            padding: '1.5rem', animation: 'summitOverlayIn 0.25s ease-out',
          }}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: '1.25rem',
            padding: '2.75rem 2.5rem 2.5rem', maxWidth: '440px', width: '100%',
            textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'summitCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', color: '#0F0F0E',
              fontSize: '1.625rem', fontWeight: 700, margin: '0 0 1.75rem',
            }}>
              Confirm Your Registration
            </h2>

            <p style={{ color: '#374151', lineHeight: 1.8, fontSize: '1rem', margin: '0 0 1.25rem' }}>
              You're registering for{' '}
              <strong style={{ color: '#0F0F0E' }}>
                {pendingPayment.attendanceType === 'virtual' ? 'Virtual' : 'Onsite'} attendance
              </strong>{' '}
              at the Elevation Summit.
            </p>

            <p style={{ fontSize: '1.125rem', margin: '0 0 1.25rem' }}>
              <strong style={{ color: '#0F0F0E' }}>
                Ticket Amount: ₦{pendingPayment.amountNaira.toLocaleString()}
              </strong>
            </p>

            <p style={{ color: '#6B7280', lineHeight: 1.8, fontSize: '0.9375rem', margin: '0 0 2rem' }}>
              Click Confirm to proceed to secure payment. You'll be redirected
              to <strong style={{ color: '#0F0F0E' }}>Paystack</strong>, our secure
              third-party payment provider.
              {pendingPayment.attendanceType === 'virtual' && ' Your join link will be emailed once payment is confirmed.'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const p = pendingPayment;
                  setPendingPayment(null);
                  startPayment(p.registrationId, p.config);
                }}
                className="btn-gold"
                style={{ fontSize: '0.9375rem', padding: '0.75rem 1.75rem', border: 'none', cursor: 'pointer' }}
              >
                Confirm →
              </button>
              <button
                onClick={() => setPendingPayment(null)}
                style={{
                  fontSize: '0.9375rem', padding: '0.75rem 1.75rem',
                  background: 'transparent', border: '1.5px solid #E8E6E1',
                  borderRadius: '0.625rem', color: '#6B7280', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment success overlay — light-themed to match this page (the
          shared Modal uses dark app tokens). Auto-redirects after ~3s;
          the button is a manual escape hatch if navigation stalls. */}
      {paymentSuccess && (
        <div
          role="alertdialog"
          aria-label="Payment confirmed"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 15, 14, 0.55)', backdropFilter: 'blur(6px)',
            padding: '1.5rem', animation: 'summitOverlayIn 0.25s ease-out',
          }}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: '1.25rem',
            padding: '3rem 2.5rem 2.5rem', maxWidth: '420px', width: '100%',
            textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'summitCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#C8A96E', margin: '0 auto 1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'summitCheckPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
            }}>
              <Check size={36} color="#0F0F0E" strokeWidth={3} />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', color: '#0F0F0E',
              fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.75rem',
            }}>
              You're Confirmed
            </h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '1rem', margin: '0 0 2rem' }}>
              Your payment was successful and your {paymentSuccess} spot at the
              Elevation Summit is secured. A confirmation email is on its way.
            </p>
            {/* Progress bar doubles as the redirect countdown */}
            <div style={{
              height: '3px', borderRadius: '2px', background: '#F0EDE6',
              overflow: 'hidden', marginBottom: '1.5rem',
            }}>
              <div style={{
                height: '100%', background: '#C8A96E', width: '0',
                animation: 'summitBarFill 3s linear forwards',
              }} />
            </div>
            <button
              onClick={() => router.push('/elevation-summit/confirmed')}
              className="btn-gold"
              style={{ fontSize: '0.9375rem', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer' }}
            >
              Continue →
            </button>
          </div>

          <style>{`
            @keyframes summitOverlayIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes summitCardIn {
              from { opacity: 0; transform: translateY(16px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes summitCheckPop {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
            @keyframes summitBarFill { from { width: 0; } to { width: 100%; } }
          `}</style>
        </div>
      )}

    </>
  );
}
