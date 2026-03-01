'use client';

import { useState } from 'react';
import Link from 'next/link';

const INDUSTRIES = [
  'Finance & Banking', 'Technology & Engineering', 'Consulting & Strategy',
  'Entrepreneurship & Startups', 'Healthcare & Medicine', 'Law & Policy',
  'Media & Communications', 'Education & Academia', 'Energy & Infrastructure',
  'Marketing & Brand', 'HR & Talent', 'Other',
];

const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Ethiopia', 'Tanzania',
  'Rwanda', 'Senegal', 'Côte d\'Ivoire', 'Egypt', 'Morocco', 'Uganda',
  'Cameroon', 'Zimbabwe', 'Zambia', 'Other African country', 'Diaspora (UK)',
  'Diaspora (US)', 'Diaspora (Canada)', 'Diaspora (Europe)', 'Other',
];

export default function MentorApplyPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    country: '',
    role_title: '',
    company: '',
    years_experience: '',
    industry: '',
    linkedin_url: '',
    career_summary: '',
    why_mentor: '',
    mentor_style: '',
    availability_hours: '',
    has_mentored_before: '',
    success_story: '',
    age_groups: [] as string[],
    agree_to_terms: false,
  });

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const toggleAgeGroup = (group: string) => {
    setForm(f => ({
      ...f,
      age_groups: f.age_groups.includes(group)
        ? f.age_groups.filter(g => g !== group)
        : [...f.age_groups, group],
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.full_name.trim() || !form.email.trim() || !form.country || !form.role_title.trim() || !form.company.trim() || !form.years_experience || !form.industry)
        return 'Please fill in all required fields.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Please enter a valid email.';
    }
    if (step === 2) {
      if (!form.career_summary.trim() || !form.why_mentor.trim() || !form.mentor_style.trim())
        return 'Please fill in all required fields.';
    }
    if (step === 3) {
      if (!form.availability_hours || !form.has_mentored_before || form.age_groups.length === 0)
        return 'Please fill in all required fields.';
      if (!form.agree_to_terms) return 'Please agree to the terms.';
    }
    return '';
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error: dbErr } = await supabase.from('mentor_applications').insert({
        ...form,
        age_groups: form.age_groups.join(', '),
        status: 'pending',
        applied_at: new Date().toISOString(),
      });
      if (dbErr) throw dbErr;
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all";
  const inputStyle = {
    background: 'var(--ma-input)',
    color: 'var(--ma-text)',
    border: '1px solid var(--ma-border)',
  };
  const inputFocusStyle = { border: '1px solid rgba(232,160,32,0.6)' };

  const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--ma-text-dim)' }}>
      {children}{required && <span style={{ color: '#E8A020' }}> *</span>}
    </label>
  );

  if (submitted) {
    return (
      <div className="ma-page">
        <style>{maStyles}</style>
        <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-for-light-pages.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
        <div className="ma-success-wrap">
          <div className="ma-success-card">
            <div className="ma-success-icon">✦</div>
            <h1 className="ma-success-title">Application Received</h1>
            <p className="ma-success-sub">
              Thank you, <strong>{form.full_name.split(' ')[0]}</strong>. We've received your application to join as a Founding Mentor. Our team reviews every application personally — you'll hear from us within 5–7 business days.
            </p>
            <div className="ma-success-detail">
              <span>Sent to</span>
              <strong>{form.email}</strong>
            </div>
            <Link href="/" className="ma-success-btn">← Back to Ascentor</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ma-page">
      <style>{maStyles}</style>

      {/* NAV */}
      <nav className="ma-nav">
        <Link href="/" className="lp-nav-logo">
            <img
              src="/ascentor-color-for-light-pages.svg"
              alt="Ascentor"
              style={{ height: '32px', width: 'auto' }}
            />
            </Link>
        <span className="ma-nav-tag">Founding Mentor Application</span>
      </nav>

      {/* HERO */}
      <div className="ma-hero">
        <div className="ma-hero-bg" />
        <div className="ma-hero-content">
          <span className="ma-hero-label">Founding Mentors</span>
          <h1 className="ma-hero-headline">
            Invest your experience.<br />
            <span className="ma-accent">Change a career.</span>
          </h1>
          <p className="ma-hero-sub">
            Founding Mentors are the backbone of Ascentor. You've done the hard work of building a career in Africa — now help the next generation do the same. Limited spots. Serious applicants only.
          </p>
          <div className="ma-hero-perks">
            {['Recognized as a Founding Mentor', 'Shape the platform with your feedback', 'Connect with Africa\'s top professionals', 'Flexible — 2–4 hrs/month commitment'].map(p => (
              <div key={p} className="ma-perk"><span className="ma-perk-check">✓</span>{p}</div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="ma-form-wrap">

        {/* Progress */}
        <div className="ma-progress-bar">
          {[1, 2, 3].map(n => (
            <div key={n} className={`ma-progress-step ${step >= n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
              <div className="ma-progress-dot">{step > n ? '✓' : n}</div>
              <span className="ma-progress-label">
                {n === 1 ? 'Your Background' : n === 2 ? 'Your Story' : 'Commitment'}
              </span>
              {n < 3 && <div className={`ma-progress-line ${step > n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="ma-form-card">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="ma-step">
              <div className="ma-step-header">
                <h2 className="ma-step-title">Your Background</h2>
                <p className="ma-step-desc">Tell us who you are and where you've been.</p>
              </div>
              <div className="ma-fields">
                <div className="ma-field-row">
                  <div className="ma-field">
                    <Label required>Full Name</Label>
                    <input className={inputClass} style={inputStyle} placeholder="Tunde Adeyemi"
                      value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                  </div>
                  <div className="ma-field">
                    <Label required>Email Address</Label>
                    <input type="email" className={inputClass} style={inputStyle} placeholder="tunde@example.com"
                      value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                </div>
                <div className="ma-field-row">
                  <div className="ma-field">
                    <Label>Phone / WhatsApp</Label>
                    <input className={inputClass} style={inputStyle} placeholder="+234 800 000 0000"
                      value={form.phone} onChange={e => set('phone', e.target.value)} />
                  </div>
                  <div className="ma-field">
                    <Label required>Country</Label>
                    <select className={inputClass} style={inputStyle}
                      value={form.country} onChange={e => set('country', e.target.value)}>
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ma-field-row">
                  <div className="ma-field">
                    <Label required>Current Role / Title</Label>
                    <input className={inputClass} style={inputStyle} placeholder="VP Engineering"
                      value={form.role_title} onChange={e => set('role_title', e.target.value)} />
                  </div>
                  <div className="ma-field">
                    <Label required>Company / Organisation</Label>
                    <input className={inputClass} style={inputStyle} placeholder="Company name"
                      value={form.company} onChange={e => set('company', e.target.value)} />
                  </div>
                </div>
                <div className="ma-field-row">
                  <div className="ma-field">
                    <Label required>Years of Experience</Label>
                    <select className={inputClass} style={inputStyle}
                      value={form.years_experience} onChange={e => set('years_experience', e.target.value)}>
                      <option value="">Select range</option>
                      <option>5–8 years</option><option>8–12 years</option>
                      <option>12–18 years</option><option>18–25 years</option><option>25+ years</option>
                    </select>
                  </div>
                  <div className="ma-field">
                    <Label required>Primary Industry</Label>
                    <select className={inputClass} style={inputStyle}
                      value={form.industry} onChange={e => set('industry', e.target.value)}>
                      <option value="">Select industry</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ma-field">
                  <Label>LinkedIn URL</Label>
                  <input className={inputClass} style={inputStyle} placeholder="https://linkedin.com/in/yourname"
                    value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="ma-step">
              <div className="ma-step-header">
                <h2 className="ma-step-title">Your Story</h2>
                <p className="ma-step-desc">Help us understand your journey and why you want to mentor.</p>
              </div>
              <div className="ma-fields">
                <div className="ma-field">
                  <Label required>Career Summary</Label>
                  <p className="ma-field-hint">Give us a 2–4 sentence overview of your career path and biggest achievements.</p>
                  <textarea className={inputClass} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                    placeholder="I started as a software engineer at MTN before moving into product leadership at Paystack..."
                    value={form.career_summary} onChange={e => set('career_summary', e.target.value)} />
                </div>
                <div className="ma-field">
                  <Label required>Why do you want to mentor?</Label>
                  <p className="ma-field-hint">What motivates you to invest time in the next generation of African professionals?</p>
                  <textarea className={inputClass} style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                    placeholder="I remember how lost I felt when I was starting out..."
                    value={form.why_mentor} onChange={e => set('why_mentor', e.target.value)} />
                </div>
                <div className="ma-field">
                  <Label required>Your Mentoring Style</Label>
                  <p className="ma-field-hint">How would a mentee describe working with you? Direct? Listening? Structured? Challenge-driven?</p>
                  <textarea className={inputClass} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    placeholder="I tend to ask hard questions rather than give answers..."
                    value={form.mentor_style} onChange={e => set('mentor_style', e.target.value)} />
                </div>
                <div className="ma-field">
                  <Label>A mentee success story (optional)</Label>
                  <p className="ma-field-hint">If you've mentored before — formally or informally — share a moment that stuck with you.</p>
                  <textarea className={inputClass} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    placeholder="A junior colleague I supported for 6 months went on to lead their own team..."
                    value={form.success_story} onChange={e => set('success_story', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="ma-step">
              <div className="ma-step-header">
                <h2 className="ma-step-title">Your Commitment</h2>
                <p className="ma-step-desc">We keep it lean — great mentorship doesn't require hours every day.</p>
              </div>
              <div className="ma-fields">
                <div className="ma-field">
                  <Label required>Monthly time availability</Label>
                  <p className="ma-field-hint">How many hours per month can you realistically commit?</p>
                  <div className="ma-option-group">
                    {['1–2 hours', '2–4 hours', '4–6 hours', '6+ hours'].map(opt => (
                      <button key={opt} type="button"
                        className={`ma-option ${form.availability_hours === opt ? 'selected' : ''}`}
                        onClick={() => set('availability_hours', opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
                <div className="ma-field">
                  <Label required>Have you formally mentored before?</Label>
                  <div className="ma-option-group">
                    {['Yes, formally', 'Informally yes', 'Not yet, but ready'].map(opt => (
                      <button key={opt} type="button"
                        className={`ma-option ${form.has_mentored_before === opt ? 'selected' : ''}`}
                        onClick={() => set('has_mentored_before', opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
                <div className="ma-field">
                  <Label required>Who do you most want to mentor?</Label>
                  <p className="ma-field-hint">Select all that apply.</p>
                  <div className="ma-option-group">
                    {['Explorers (15–22)', 'Builders (22–32)', 'Climbers (32–50)'].map(opt => (
                      <button key={opt} type="button"
                        className={`ma-option ${form.age_groups.includes(opt) ? 'selected' : ''}`}
                        onClick={() => toggleAgeGroup(opt)}>{opt}</button>
                    ))}
                  </div>
                </div>

                <div className="ma-divider" />

                <div className="ma-review-box">
                  <p className="ma-review-title">Your application summary</p>
                  <div className="ma-review-grid">
                    <span>Name</span><strong>{form.full_name || '—'}</strong>
                    <span>Email</span><strong>{form.email || '—'}</strong>
                    <span>Role</span><strong>{form.role_title}{form.company ? ` · ${form.company}` : ''}</strong>
                    <span>Industry</span><strong>{form.industry || '—'}</strong>
                    <span>Experience</span><strong>{form.years_experience || '—'}</strong>
                    <span>Country</span><strong>{form.country || '—'}</strong>
                  </div>
                </div>

                <label className="ma-agree">
                  <input type="checkbox" checked={form.agree_to_terms}
                    onChange={e => set('agree_to_terms', e.target.checked)} />
                  <span>I understand this is a volunteer role and I commit to responding to mentee messages within 48 hours. I agree to uphold Ascentor's community standards.</span>
                </label>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="ma-error">{error}</div>
          )}

          {/* Footer buttons */}
          <div className="ma-form-footer">
            {step > 1 && (
              <button onClick={back} className="ma-btn-back">← Back</button>
            )}
            <div style={{ flex: 1 }} />
            {step < 3 ? (
              <button onClick={next} className="ma-btn-next">Continue →</button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="ma-btn-submit">
                {loading ? 'Submitting...' : 'Submit Application →'}
              </button>
            )}
          </div>
        </div>

        <p className="ma-footer-note">We review every application personally. No automated rejections.</p>
      </div>
    </div>
  );
}

const maStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --ma-gold: #E8A020;
    --ma-gold-light: #F5C55A;
    --ma-gold-pale: #FDF3E0;
    --ma-dark: #0F0E0B;
    --ma-dark-2: #1A1914;
    --ma-white: #FDFCF9;
    --ma-light: #F7F4EE;
    --ma-text: #2A2820;
    --ma-text-dim: #7A7560;
    --ma-border: rgba(42,40,32,0.12);
    --ma-input: #FDFCF9;
  }

  .ma-page { font-family: 'Syne', system-ui, sans-serif; background: var(--ma-light); min-height: 100vh; }

  /* NAV */
  .ma-nav {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 48px;
    background: rgba(253,252,249,0.95); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(232,160,32,0.12);
  }
  .ma-nav-logo { display: flex; align-items: center; gap: 6px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; font-weight: 700; color: var(--ma-dark); text-decoration: none; }
  .ma-nav-logo span { color: var(--ma-gold); }
  .ma-nav-tag { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; padding: 5px 12px; border-radius: 100px; background: rgba(232,160,32,0.1); color: #8B6010; }

  /* HERO */
  .ma-hero { position: relative; padding: 80px 48px 72px; overflow: hidden; background: var(--ma-dark); }
  .ma-hero-bg {
    position: absolute; inset: 0; opacity: 0.04;
    background: radial-gradient(ellipse 70% 60% at 80% 50%, var(--ma-gold) 0%, transparent 70%);
  }
  .ma-hero-content { position: relative; z-index: 1; max-width: 720px; }
  .ma-hero-label { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ma-gold); margin-bottom: 20px; }
  .ma-hero-headline { font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(36px, 5vw, 60px); font-weight: 900; line-height: 1.08; color: #FDFCF9; margin-bottom: 20px; }
  .ma-accent { color: var(--ma-gold); }
  .ma-hero-sub { font-size: 16px; line-height: 1.75; color: rgba(255,255,255,0.55); max-width: 560px; margin-bottom: 36px; }
  .ma-hero-perks { display: flex; flex-direction: column; gap: 10px; }
  .ma-perk { display: flex; align-items: center; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.7); }
  .ma-perk-check { color: var(--ma-gold); font-size: 13px; flex-shrink: 0; }

  /* FORM WRAP */
  .ma-form-wrap { max-width: 760px; margin: 0 auto; padding: 48px 24px 80px; }

  /* PROGRESS */
  .ma-progress-bar { display: flex; align-items: center; justify-content: center; margin-bottom: 32px; gap: 0; }
  .ma-progress-step { display: flex; align-items: center; gap: 8px; position: relative; }
  .ma-progress-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; transition: all 0.3s; background: var(--ma-white); border: 2px solid var(--ma-border); color: var(--ma-text-dim); }
  .ma-progress-step.active .ma-progress-dot { border-color: var(--ma-gold); color: var(--ma-gold); background: rgba(232,160,32,0.08); }
  .ma-progress-step.done .ma-progress-dot { background: var(--ma-gold); border-color: var(--ma-gold); color: var(--ma-dark); }
  .ma-progress-label { font-size: 12px; font-weight: 600; color: var(--ma-text-dim); white-space: nowrap; }
  .ma-progress-step.active .ma-progress-label { color: var(--ma-text); }
  .ma-progress-line { width: 56px; height: 1.5px; background: var(--ma-border); margin: 0 12px; transition: background 0.3s; }
  .ma-progress-line.done { background: var(--ma-gold); }

  /* CARD */
  .ma-form-card { background: var(--ma-white); border-radius: 20px; padding: 40px; border: 1px solid var(--ma-border); box-shadow: 0 4px 40px rgba(0,0,0,0.04); }

  /* STEP */
  .ma-step-header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--ma-border); }
  .ma-step-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 26px; font-weight: 700; color: var(--ma-dark); margin-bottom: 6px; }
  .ma-step-desc { font-size: 14px; color: var(--ma-text-dim); }

  /* FIELDS */
  .ma-fields { display: flex; flex-direction: column; gap: 22px; }
  .ma-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .ma-field { display: flex; flex-direction: column; }
  .ma-field input, .ma-field select, .ma-field textarea {
    font-family: 'Syne', system-ui, sans-serif;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .ma-field input:focus, .ma-field select:focus, .ma-field textarea:focus {
    border-color: rgba(232,160,32,0.5) !important;
    box-shadow: 0 0 0 3px rgba(232,160,32,0.08);
  }
  .ma-field-hint { font-size: 12px; color: var(--ma-text-dim); margin-bottom: 8px; line-height: 1.5; }

  /* OPTIONS */
  .ma-option-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .ma-option {
    padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; font-family: 'Syne', system-ui, sans-serif;
    background: var(--ma-light); color: var(--ma-text-dim);
    border: 1.5px solid var(--ma-border);
  }
  .ma-option:hover { border-color: rgba(232,160,32,0.4); color: var(--ma-text); }
  .ma-option.selected { background: rgba(232,160,32,0.1); border-color: var(--ma-gold); color: #7A5010; font-weight: 600; }

  /* REVIEW */
  .ma-divider { height: 1px; background: var(--ma-border); }
  .ma-review-box { background: var(--ma-light); border-radius: 12px; padding: 20px 24px; border: 1px solid var(--ma-border); }
  .ma-review-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ma-text-dim); margin-bottom: 14px; }
  .ma-review-grid { display: grid; grid-template-columns: 100px 1fr; gap: 8px 16px; }
  .ma-review-grid span { font-size: 12px; color: var(--ma-text-dim); display: flex; align-items: center; }
  .ma-review-grid strong { font-size: 13px; color: var(--ma-text); font-weight: 600; }

  /* AGREE */
  .ma-agree { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; }
  .ma-agree input[type="checkbox"] { width: 16px; height: 16px; margin-top: 2px; accent-color: var(--ma-gold); flex-shrink: 0; cursor: pointer; }
  .ma-agree span { font-size: 13px; line-height: 1.6; color: var(--ma-text-dim); }

  /* ERROR */
  .ma-error { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); color: #b91c1c; font-size: 13px; padding: 12px 16px; border-radius: 10px; margin-top: 8px; }

  /* BUTTONS */
  .ma-form-footer { display: flex; align-items: center; gap: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--ma-border); }
  .ma-btn-back { padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'Syne', system-ui, sans-serif; background: transparent; color: var(--ma-text-dim); border: 1.5px solid var(--ma-border); }
  .ma-btn-back:hover { border-color: var(--ma-text-dim); color: var(--ma-text); }
  .ma-btn-next { padding: 13px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Syne', system-ui, sans-serif; background: var(--ma-gold); color: var(--ma-dark); border: none; box-shadow: 0 4px 16px rgba(232,160,32,0.3); }
  .ma-btn-next:hover { background: var(--ma-gold-light); transform: translateY(-1px); }
  .ma-btn-submit { padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Syne', system-ui, sans-serif; background: var(--ma-dark); color: var(--ma-gold); border: none; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
  .ma-btn-submit:hover:not(:disabled) { background: #1A1914; transform: translateY(-1px); }
  .ma-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .ma-footer-note { text-align: center; font-size: 13px; color: var(--ma-text-dim); margin-top: 20px; }

  /* SUCCESS */
  .ma-success-wrap { min-height: calc(100vh - 60px); display: flex; align-items: center; justify-content: center; padding: 48px 24px; background: var(--ma-light); }
  .ma-success-card { background: var(--ma-white); border-radius: 24px; padding: 56px 48px; max-width: 520px; width: 100%; text-align: center; border: 1px solid var(--ma-border); box-shadow: 0 8px 60px rgba(0,0,0,0.06); }
  .ma-success-icon { font-size: 40px; color: var(--ma-gold); margin-bottom: 20px; }
  .ma-success-title { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 32px; font-weight: 700; color: var(--ma-dark); margin-bottom: 16px; }
  .ma-success-sub { font-size: 15px; line-height: 1.75; color: var(--ma-text-dim); margin-bottom: 28px; }
  .ma-success-sub strong { color: var(--ma-text); font-weight: 600; }
  .ma-success-detail { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--ma-light); border-radius: 10px; padding: 12px 20px; font-size: 13px; color: var(--ma-text-dim); margin-bottom: 32px; }
  .ma-success-detail strong { color: var(--ma-text); }
  .ma-success-btn { display: inline-block; padding: 13px 28px; background: var(--ma-gold); color: var(--ma-dark); border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; transition: all 0.2s; }
  .ma-success-btn:hover { background: var(--ma-gold-light); transform: translateY(-1px); }

  @media (max-width: 640px) {
    .ma-nav { padding: 14px 20px; }
    .ma-hero { padding: 56px 20px 48px; }
    .ma-form-wrap { padding: 32px 16px 60px; }
    .ma-form-card { padding: 24px 20px; }
    .ma-field-row { grid-template-columns: 1fr; }
    .ma-progress-label { display: none; }
    .ma-success-card { padding: 40px 24px; }
  }
`;
