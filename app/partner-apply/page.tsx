// ============================================================
// app/partner-apply/page.tsx
// Public page — coaches apply to become Ascentor partners
// Already in your PUBLIC_ROUTES so no auth needed to view.
// ============================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, width: '100%',
};

const NICHES = [
  'Career & Leadership', 'Executive Coaching', 'Entrepreneur & Business',
  'Life & Mindset', 'Finance & Wealth', 'Health & Wellness',
  'Tech & Engineering', 'Sales & Marketing', 'Academic & Student', 'Other',
];

export default function PartnerApplyPage() {
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [platformName, setPlatform] = useState('');
  const [subdomain, setSubdomain]   = useState('');
  const [niche, setNiche]           = useState('');
  const [bio, setBio]               = useState('');
  const [agreed, setAgreed]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  // Auto-generate subdomain from platform name
  const handlePlatformChange = (val: string) => {
    setPlatform(val);
    if (!subdomain || subdomain === autoSlug(platformName)) {
      setSubdomain(autoSlug(val));
    }
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    const res = await fetch('/api/partner/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform_name: platformName,
        subdomain,
        coaching_niche: niche,
        bio,
        agreed_to_terms: agreed,
      }),
    });
    const data = await res.json();
    if (res.ok) { setDone(true); }
    else { setError(data.error || 'Submission failed'); }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, color: 'var(--text)', marginBottom: 12 }}>
            Application Received
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
            We'll review your application and get back to you within 48 hours.
            Your platform will be live at{' '}
            <strong style={{ color: 'var(--accent)' }}>{subdomain}.ascentorbi.com</strong>{' '}
            once approved.
          </p>
          <Link href="/dashboard"
            style={{
              padding: '12px 28px', borderRadius: 10, background: 'var(--accent)',
              color: '#000', textDecoration: 'none', fontSize: 14, fontWeight: 700,
            }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Nav */}
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            Ascentor
          </span>
        </Link>
        <Link href="/login" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none' }}>
          Log in →
        </Link>
      </nav>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 8 }}>
            Partner Programme
          </p>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 34, color: 'var(--text)', marginBottom: 10, lineHeight: 1.2 }}>
            Launch your coaching platform
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7 }}>
            Get your own branded platform — your logo, your colours, your domain.
            Powered by Ascentor's AI and community infrastructure.
          </p>
        </div>

        {/* Benefits */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 32 }}>
          {[
            ['✦', 'Your brand', 'Logo, colours, domain'],
            ['◈', '70% revenue', 'Of every member payment'],
            ['⬡', 'AI coach', 'Sage, fully branded'],
            ['⚙', 'Your members', 'Invite & manage'],
          ].map(([icon, title, sub]) => (
            <div key={title} style={{
              padding: '12px 14px', borderRadius: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 14, marginBottom: 2 }}>{icon}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{title}</p>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <Field label="Platform Name *">
            <input
              value={platformName}
              onChange={e => handlePlatformChange(e.target.value)}
              placeholder="e.g. Amara Leads, Rising Eagles, The Pivot Lab"
              style={inputStyle}
            />
          </Field>

          <Field label="Your Subdomain *">
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input
                value={subdomain}
                onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20))}
                placeholder="yourname"
                style={{ ...inputStyle, borderRadius: '10px 0 0 10px', borderRight: 'none' }}
              />
              <span style={{
                padding: '10px 14px', background: 'var(--bg-input)',
                border: '1px solid var(--border)', borderRadius: '0 10px 10px 0',
                fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap',
              }}>
                .ascentorbi.com
              </span>
            </div>
            {subdomain && (
              <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                Your platform: {subdomain}.ascentorbi.com
              </p>
            )}
          </Field>

          <Field label="Coaching Niche">
            <select value={niche} onChange={e => setNiche(e.target.value)} style={inputStyle}>
              <option value="">Select your niche</option>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>

          <Field label="Brief Bio / What you do">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell us about your coaching practice and who you serve..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' as any }}
            />
          </Field>

          {/* Terms */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <button
              onClick={() => setAgreed(!agreed)}
              style={{
                width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border)',
                background: agreed ? 'var(--accent)' : 'transparent',
                cursor: 'pointer', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {agreed && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✓</span>}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              I agree to the Ascentor Partner Terms. I understand I receive 70% of revenue,
              Ascentor receives 30%, and I cannot extract member data from the platform.
            </p>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--error)', fontWeight: 600 }}>✗ {error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !platformName || !subdomain || !agreed}
            style={{
              padding: '13px', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#000',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
              opacity: (submitting || !platformName || !subdomain || !agreed) ? 0.5 : 1,
            }}>
            {submitting ? 'Submitting...' : 'Apply to become a partner →'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
