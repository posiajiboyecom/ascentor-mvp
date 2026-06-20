// FILE: app/onboarding/page.tsx
// ASCENTOR REBRAND v2 — Movement-aligned onboarding
// 3 steps: Stage → What Building → Commitment/Welcome

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const initialStep = parseInt(searchParams.get('step') || '1', 10);
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // ── Step 1 state ──
  const [ascentStage, setAscentStage] = useState<'seeker' | 'builder' | 'leader' | ''>('');

  // ── Step 2 state ──
  const [whatBuilding, setWhatBuilding] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');

  // ── Step 1 → Step 2 ──
  const handleStageSelect = (stage: 'seeker' | 'builder' | 'leader') => {
    setAscentStage(stage);
  };

  const goToStep2 = () => {
    if (!ascentStage) return;
    setStep(2);
  };

  // ── Step 2 → Step 3 (save profile) ──
  const handleProfileSave = async () => {
    if (!whatBuilding.trim() || !fullName.trim()) return;
    setSaving(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert('Session expired. Please sign in again.');
      setSaving(false);
      return;
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    const referralCode = existingProfile?.referral_code || (
      'ASC-' + Math.random().toString(36).substring(2, 6).toUpperCase()
    );

    const { error: dbError } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName.trim(),
      ascent_stage: ascentStage,
      what_building: whatBuilding.trim(),
      whatsapp_phone: whatsappPhone.trim() || null,
      referral_code: referralCode,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      alert('Error saving profile: ' + dbError.message);
      setSaving(false);
      return;
    }

    // Fire welcome email
    try {
      await fetch('/api/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (_) { /* non-blocking */ }

    setSaving(false);
    setStep(3);
  };

  // ── Step 3 → Dashboard ──
  const handleComplete = () => {
    router.push('/dashboard');
  };

  // ── Styles ──
  const styles = {
    page: {
      minHeight: '100vh',
      background: '#FAFAF8',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
    },
    card: {
      background: '#FFFFFF',
      border: '1px solid #E8E6E1',
      borderRadius: '1.25rem',
      padding: 'clamp(2rem, 5vw, 3.5rem)',
      width: '100%',
      maxWidth: '560px',
      boxShadow: '0 4px 40px rgba(0,0,0,0.06)',
    },
    eyebrow: {
      fontFamily: 'var(--font-body, "Inter", sans-serif)',
      fontSize: '0.75rem',
      fontWeight: 600 as const,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: '#C8A96E',
      marginBottom: '1rem',
      display: 'block',
    },
    headline: {
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
      fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
      fontWeight: 800 as const,
      lineHeight: 1.15,
      letterSpacing: '-0.02em',
      color: '#0F0F0E',
      marginBottom: '0.75rem',
    },
    subtext: {
      fontSize: '1rem',
      color: '#6B7280',
      lineHeight: 1.7,
      marginBottom: '2rem',
    },
    input: {
      width: '100%',
      padding: '0.875rem 1rem',
      background: '#F4F3EF',
      border: '1.5px solid #E8E6E1',
      borderRadius: '0.5rem',
      fontFamily: 'var(--font-body, "Inter", sans-serif)',
      fontSize: '0.9375rem',
      color: '#0F0F0E',
      outline: 'none',
    },
    btnPrimary: {
      width: '100%',
      padding: '0.875rem',
      background: '#0F0F0E',
      color: '#FAFAF8',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
      fontWeight: 700 as const,
      fontSize: '1rem',
      borderRadius: '0.625rem',
      border: 'none',
      cursor: 'pointer',
      transition: 'background 0.2s',
      marginTop: '1.5rem',
    },
    progressDots: {
      display: 'flex',
      gap: '0.5rem',
      justifyContent: 'center',
      marginTop: '2rem',
    },
  };

  const stageOptions = [
    {
      value: 'seeker' as const,
      label: 'The Seeker',
      sub: 'I am finding my purpose',
      description: 'You know there is more, but you have not fully named it yet.',
    },
    {
      value: 'builder' as const,
      label: 'The Builder',
      sub: 'I am building toward it',
      description: 'You know where you are going and are doing the daily work.',
    },
    {
      value: 'leader' as const,
      label: 'The Leader',
      sub: 'I am leading others in it',
      description: 'You have built something and are now responsible for others.',
    },
  ];

  return (
    <div style={styles.page}>
      {/* Logo */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
          fontSize: '1.375rem',
          fontWeight: 800,
          color: '#0F0F0E',
          letterSpacing: '-0.03em',
        }}>Ascentor</span>
      </div>

      <div style={styles.card}>

        {/* ── STEP 1: The Stage ── */}
        {step === 1 && (
          <>
            <span style={styles.eyebrow}>Step 1 of 3</span>
            <h1 style={styles.headline}>Where are you in your ascent?</h1>
            <p style={styles.subtext}>
              Choose the stage that best describes where you are right now. There are no wrong answers — only honest ones.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {stageOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStageSelect(option.value)}
                  style={{
                    width: '100%',
                    padding: '1.25rem 1.375rem',
                    borderRadius: '0.75rem',
                    border: ascentStage === option.value
                      ? '2px solid #C8A96E'
                      : '1.5px solid #E8E6E1',
                    background: ascentStage === option.value
                      ? 'rgba(200,169,110,0.06)'
                      : '#FAFAF8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'block',
                    fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: ascentStage === option.value ? '#C8A96E' : '#0F0F0E',
                    marginBottom: '0.2rem',
                  }}>
                    {option.label}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#9CA3AF', display: 'block', marginBottom: '0.375rem' }}>
                    {option.sub}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5 }}>
                    {option.description}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={goToStep2}
              disabled={!ascentStage}
              style={{
                ...styles.btnPrimary,
                opacity: ascentStage ? 1 : 0.4,
                cursor: ascentStage ? 'pointer' : 'not-allowed',
              }}
            >
              Continue →
            </button>
          </>
        )}

        {/* ── STEP 2: The Decision ── */}
        {step === 2 && (
          <>
            <span style={styles.eyebrow}>Step 2 of 3</span>
            <h1 style={styles.headline}>What are you building?</h1>
            <p style={styles.subtext}>
              Not your job title. Not your career goal.{' '}
              <strong style={{ color: '#0F0F0E' }}>What are you building with your life?</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Full name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  style={styles.input}
                  required
                />
              </div>

              {/* What building */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  What are you building? *
                </label>
                <textarea
                  value={whatBuilding}
                  onChange={(e) => setWhatBuilding(e.target.value)}
                  placeholder="I am building..."
                  rows={4}
                  style={{
                    ...styles.input,
                    resize: 'vertical',
                    minHeight: '100px',
                    lineHeight: '1.6',
                  }}
                  required
                />
                <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.375rem' }}>
                  2–3 sentences is enough. This is how the community will know you.
                </p>
              </div>

              {/* WhatsApp */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F0F0E', marginBottom: '0.5rem' }}>
                  WhatsApp Number <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  style={styles.input}
                />
                <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.375rem' }}>
                  For community updates and Summit notifications.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  flex: '0 0 auto',
                  padding: '0.875rem 1.25rem',
                  background: 'transparent',
                  color: '#6B7280',
                  fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  borderRadius: '0.625rem',
                  border: '1.5px solid #E8E6E1',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleProfileSave}
                disabled={saving || !whatBuilding.trim() || !fullName.trim()}
                style={{
                  ...styles.btnPrimary,
                  flex: 1,
                  marginTop: 0,
                  opacity: (!saving && whatBuilding.trim() && fullName.trim()) ? 1 : 0.4,
                  cursor: (!saving && whatBuilding.trim() && fullName.trim()) ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: The Commitment / Welcome ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            {/* Gold checkmark */}
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'rgba(200,169,110,0.12)',
              border: '2px solid #C8A96E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8A96E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <span style={styles.eyebrow}>Step 3 of 3</span>
            <h1 style={{ ...styles.headline, textAlign: 'center' }}>
              Welcome to The Circle.
            </h1>
            <p style={{ ...styles.subtext, textAlign: 'center' }}>
              Ascentor is built on one thing: intentional people holding each other accountable to becoming who they were built to be.
            </p>

            <div style={{
              background: '#0F0F0E',
              borderRadius: '1rem',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
            }}>
              <p style={{
                fontFamily: 'var(--font-accent, "Playfair Display", serif)',
                fontStyle: 'italic',
                fontSize: '1rem',
                color: '#C8A96E',
                lineHeight: 1.65,
              }}>
                "Every life that matters was built on purpose. Not accident. Not circumstance. Purpose."
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              {[
                'Engage with The Circle — your community of purposeful builders',
                'Use the AI Coach to think clearly about what you\'re building',
                'Register your interest in The Elevation Summit — February 2027',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C8A96E', marginTop: '0.5rem', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.6 }}>{item}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleComplete}
              style={styles.btnPrimary}
            >
              I'm ready. Let's begin. →
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div style={styles.progressDots}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              width: s === step ? '24px' : '8px',
              height: '8px',
              borderRadius: '9999px',
              background: s === step ? '#C8A96E' : s < step ? '#0F0F0E' : '#E8E6E1',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

      </div>

      {/* Footer note */}
      <p style={{ marginTop: '1.5rem', fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center' }}>
        The Elevation Summit · February 2027 · Lagos, Nigeria
      </p>
    </div>
  );
}
