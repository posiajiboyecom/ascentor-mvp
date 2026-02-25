'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ── Types ──────────────────────────────────────────────── */
type LifeStage = 'explorer' | 'builder' | 'climber';
type ReferralSource = 'instagram' | 'tiktok' | 'linkedin' | 'whatsapp' | 'friend' | 'other';

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  whatsapp: string;
  life_stage: LifeStage;
  country: string;
  industry: string;
  referral_source: ReferralSource | '';
  consent: boolean;
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  whatsapp?: string;
  country?: string;
  life_stage?: string;
  consent?: string;
}

interface SuccessData {
  position: number;
  referral_code: string;
}

/* ── Constants ──────────────────────────────────────────── */
const LIFE_STAGES: { value: LifeStage; emoji: string; label: string; age: string }[] = [
  { value: 'explorer', emoji: '🌱', label: 'Explorer', age: '15–22' },
  { value: 'builder',  emoji: '🚀', label: 'Builder',  age: '22–32' },
  { value: 'climber',  emoji: '⚡', label: 'Climber',  age: '32–50' },
];

const REFERRAL_SOURCES: { value: ReferralSource; label: string }[] = [
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'tiktok',    label: '🎵 TikTok' },
  { value: 'linkedin',  label: '💼 LinkedIn' },
  { value: 'whatsapp',  label: '💬 WhatsApp' },
  { value: 'friend',    label: '👤 A Friend' },
  { value: 'other',     label: '🌐 Other' },
];

const COUNTRIES = [
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'ET', label: '🇪🇹 Ethiopia' },
  { code: 'TZ', label: '🇹🇿 Tanzania' },
  { code: 'UG', label: '🇺🇬 Uganda' },
  { code: 'SN', label: '🇸🇳 Senegal' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'CM', label: '🇨🇲 Cameroon' },
  { code: 'RW', label: '🇷🇼 Rwanda' },
  { code: 'ZM', label: '🇿🇲 Zambia' },
  { code: 'DIASPORA-UK', label: '🇬🇧 UK (Diaspora)' },
  { code: 'DIASPORA-US', label: '🇺🇸 US (Diaspora)' },
  { code: 'DIASPORA-CA', label: '🇨🇦 Canada (Diaspora)' },
  { code: 'OTHER', label: '🌍 Other Africa' },
];

const INDUSTRIES = [
  { value: 'fintech',      label: 'Fintech / Finance' },
  { value: 'tech',         label: 'Technology' },
  { value: 'consulting',   label: 'Consulting / Strategy' },
  { value: 'healthcare',   label: 'Healthcare' },
  { value: 'education',    label: 'Education' },
  { value: 'fmcg',         label: 'FMCG / Retail' },
  { value: 'media',        label: 'Media / Creative' },
  { value: 'startup',      label: 'Startup / Entrepreneurship' },
  { value: 'government',   label: 'Government / Public Sector' },
  { value: 'ngo',          label: 'NGO / Development' },
  { value: 'law',          label: 'Legal / Law' },
  { value: 'engineering',  label: 'Engineering' },
  { value: 'other',        label: 'Other' },
];

/* ── Validation ─────────────────────────────────────────── */
function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.first_name.trim())   errors.first_name = 'First name is required';
  if (!data.last_name.trim())    errors.last_name  = 'Last name is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
                                 errors.email      = 'Enter a valid email address';
  if (!data.whatsapp.trim() || !/^\+?[0-9\s\-]{7,20}$/.test(data.whatsapp.trim()))
                                 errors.whatsapp   = 'Enter a valid WhatsApp number';
  if (!data.country)             errors.country    = 'Please select your country';
  if (!data.life_stage)          errors.life_stage = 'Please select your stage';
  if (!data.consent)             errors.consent    = 'Please accept to continue';
  return errors;
}

/* ── Shared input styles ────────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: '100%',
  background: '#F9FAFB',
  border: '1.5px solid #E5E5E4',
  borderRadius: '10px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0A0E17',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  transition: 'border-color 0.15s',
};

const inputError: React.CSSProperties = {
  ...inputBase,
  borderColor: '#EF4444',
  background: '#FFF5F5',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase' as const,
  color: '#6B7280',
  marginBottom: '6px',
};

/* ── Component ──────────────────────────────────────────── */
export default function WaitlistForm() {
  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    whatsapp: '',
    life_stage: 'builder',
    country: '',
    industry: '',
    referral_source: '',
    consent: false,
  });

  const [errors, setErrors]       = useState<FormErrors>({});
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState<SuccessData | null>(null);
  const [copied, setCopied]       = useState(false);
  const [serverError, setServerError] = useState('');

  /* Field updater */
  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  }

  /* Submit */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      const firstErrKey = Object.keys(errs)[0];
      document.getElementById(firstErrKey)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);

    try {
      // Capture UTM params from URL
      const params = new URLSearchParams(window.location.search);

      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(),
        utm_source:   params.get('utm_source')   ?? undefined,
        utm_medium:   params.get('utm_medium')   ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
        landing_page: window.location.pathname,
      };

      const res  = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok || res.status === 409) {
        setSuccess({ position: data.position ?? 248, referral_code: data.referral_code ?? '' });
      } else {
        setServerError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  /* Copy referral link */
  async function copyLink() {
    const link = `${window.location.origin}/waitlist?ref=${success?.referral_code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  /* ── Success State ── */
  if (success) {
    const shareText = encodeURIComponent(
      "I just joined the Ascentor waitlist — Africa's mentorship platform. Early members get 3 months free. Join me 👇"
    );
    const shareUrl  = encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/waitlist?ref=${success.referral_code}`);

    return (
      <div
        className="rounded-2xl p-7 flex flex-col items-center text-center"
        style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-5"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.25)' }}
        >
          🎉
        </div>

        <h2
          className="text-2xl font-semibold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17', lineHeight: 1.2 }}
        >
          You&apos;re in,{' '}
          <span style={{ color: '#F59E0B', fontStyle: 'italic' }}>officially.</span>
        </h2>
        <p className="text-sm mb-6 max-w-xs" style={{ color: '#6B7280', lineHeight: 1.7 }}>
          Check your inbox — a confirmation is on its way. Your mentor is almost ready for you.
        </p>

        {/* Position card */}
        <div
          className="w-full rounded-xl p-5 mb-6 relative overflow-hidden"
          style={{ background: '#0A0E17' }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: 'linear-gradient(90deg, #F59E0B, #FCD34D, transparent)' }}
          />
          <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#6B7280' }}>
            Your Waitlist Position
          </p>
          <p
            className="text-5xl font-bold mb-1"
            style={{ fontFamily: "'Playfair Display', serif", color: '#F59E0B' }}
          >
            #{success.position}
          </p>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Early members get 3 months free · No credit card needed
          </p>
        </div>

        {/* Share */}
        <div className="w-full">
          <p className="text-xs font-semibold mb-3" style={{ color: '#6B7280' }}>
            Move up the list — share with someone who needs this 🚀
          </p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <a
              href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', color: '#15803D' }}
            >
              💬 WhatsApp
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1D4ED8' }}
            >
              💼 LinkedIn
            </a>
          </div>

          {/* Copy link */}
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: '1.5px solid #E5E5E4' }}
          >
            <span
              className="flex-1 px-3 py-2.5 text-xs truncate"
              style={{ background: '#F9FAFB', color: '#9CA3AF', fontFamily: 'monospace' }}
            >
              {typeof window !== 'undefined'
                ? `${window.location.origin}/waitlist?ref=${success.referral_code}`
                : `/waitlist?ref=${success.referral_code}`}
            </span>
            <button
              onClick={copyLink}
              className="px-4 py-2.5 text-xs font-bold transition-colors"
              style={{
                background: copied ? '#F59E0B' : 'rgba(245,158,11,0.08)',
                color: copied ? '#000' : '#B45309',
                borderLeft: '1.5px solid #E5E5E4',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Back to site */}
        <Link
          href="/"
          className="mt-5 text-xs"
          style={{ color: '#9CA3AF', textDecoration: 'underline' }}
        >
          Back to homepage
        </Link>
      </div>
    );
  }

  /* ── Form State ── */
  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: '#fff', border: '1px solid #E5E5E4', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
    >
      {/* Form header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-semibold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: '#0A0E17' }}
        >
          Secure your early access.
        </h2>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Takes 60 seconds. Early members get 3 months free on launch.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label htmlFor="first_name" style={labelStyle}>First Name</label>
            <input
              id="first_name"
              type="text"
              placeholder="Temi"
              autoComplete="given-name"
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              style={errors.first_name ? inputError : inputBase}
            />
            {errors.first_name && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.first_name}</p>
            )}
          </div>
          <div>
            <label htmlFor="last_name" style={labelStyle}>Last Name</label>
            <input
              id="last_name"
              type="text"
              placeholder="Adeyemi"
              autoComplete="family-name"
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              style={errors.last_name ? inputError : inputBase}
            />
            {errors.last_name && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.last_name}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="mb-4">
          <label htmlFor="email" style={labelStyle}>Email Address</label>
          <input
            id="email"
            type="email"
            placeholder="temi@email.com"
            autoComplete="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            style={errors.email ? inputError : inputBase}
          />
          {errors.email && (
            <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.email}</p>
          )}
        </div>

        {/* WhatsApp — required */}
        <div className="mb-4">
          <label htmlFor="whatsapp" style={labelStyle}>
            WhatsApp Number
          </label>
          <input
            id="whatsapp"
            type="tel"
            placeholder="+234 801 234 5678"
            autoComplete="tel"
            value={form.whatsapp}
            onChange={e => set('whatsapp', e.target.value)}
            style={errors.whatsapp ? inputError : inputBase}
          />
          {errors.whatsapp && (
            <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.whatsapp}</p>
          )}
        </div>

        {/* Life Stage */}
        <div className="mb-4">
          <label style={labelStyle}>Your Life Stage</label>
          <div className="grid grid-cols-3 gap-2">
            {LIFE_STAGES.map(s => {
              const active = form.life_stage === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set('life_stage', s.value)}
                  className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                  style={{
                    background: active ? 'rgba(245,158,11,0.06)' : '#F9FAFB',
                    border: active ? '1.5px solid #F59E0B' : '1.5px solid #E5E5E4',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span
                    className="text-[11px] font-bold tracking-wide"
                    style={{ color: active ? '#B45309' : '#6B7280' }}
                  >
                    {s.label}
                  </span>
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>{s.age}</span>
                </button>
              );
            })}
          </div>
          {errors.life_stage && (
            <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.life_stage}</p>
          )}
        </div>

        {/* Country + Industry */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label htmlFor="country" style={labelStyle}>Country</label>
            <select
              id="country"
              value={form.country}
              onChange={e => set('country', e.target.value)}
              style={{
                ...(errors.country ? inputError : inputBase),
                appearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
                cursor: 'pointer',
              }}
            >
              <option value="">Select country</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            {errors.country && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.country}</p>
            )}
          </div>

          <div>
            <label htmlFor="industry" style={labelStyle}>
              Industry <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <select
              id="industry"
              value={form.industry}
              onChange={e => set('industry', e.target.value)}
              style={{
                ...inputBase,
                appearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
                cursor: 'pointer',
              }}
            >
              <option value="">Your industry</option>
              {INDUSTRIES.map(i => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Referral source */}
        <div className="mb-5">
          <label style={labelStyle}>
            How did you hear about us?{' '}
            <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {REFERRAL_SOURCES.map(s => {
              const active = form.referral_source === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set('referral_source', active ? '' : s.value as ReferralSource)}
                  className="py-2 px-2 rounded-lg text-xs font-medium transition-all text-center"
                  style={{
                    background: active ? 'rgba(245,158,11,0.06)' : '#F9FAFB',
                    border: active ? '1.5px solid #F59E0B' : '1.5px solid #E5E5E4',
                    color: active ? '#B45309' : '#6B7280',
                    cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Consent */}
        <label
          className="flex items-start gap-3 mb-5 cursor-pointer"
          htmlFor="consent"
        >
          <input
            id="consent"
            type="checkbox"
            checked={form.consent}
            onChange={e => set('consent', e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ width: '16px', height: '16px', accentColor: '#F59E0B', cursor: 'pointer' }}
          />
          <span className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
            I agree to receive updates about Ascentor&apos;s launch and early access offers.
            No spam — ever. View our{' '}
            <Link href="/terms" className="underline" style={{ color: '#F59E0B' }}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.consent && (
          <p className="text-xs mb-4 -mt-3" style={{ color: '#EF4444' }}>{errors.consent}</p>
        )}

        {/* Server error */}
        {serverError && (
          <div
            className="text-xs px-4 py-3 rounded-lg mb-4"
            style={{ background: '#FFF5F5', border: '1px solid #FCA5A5', color: '#DC2626' }}
          >
            {serverError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-sm font-bold transition-all"
          style={{
            background: loading ? 'rgba(245,158,11,0.6)' : '#F59E0B',
            color: '#000',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '0.01em',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(245,158,11,0.3)',
          }}
        >
          {loading ? 'Securing your spot...' : 'Secure My Spot →'}
        </button>

        {/* Trust row */}
        <div
          className="flex items-center justify-center gap-4 mt-4 pt-4"
          style={{ borderTop: '1px solid #F3F4F6' }}
        >
          {[
            { icon: '🔒', text: 'Secure & private' },
            { icon: '🎁', text: '3 months free' },
            { icon: '✨', text: 'No spam, ever' },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-1.5">
              <span className="text-xs">{t.icon}</span>
              <span className="text-xs" style={{ color: '#9CA3AF' }}>{t.text}</span>
            </div>
          ))}
        </div>

      </form>
    </div>
  );
}
