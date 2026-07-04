// app/onboarding/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Ascentor onboarding — 3 screens, ~45 seconds
//
// Screen 1 — Identity:    Name + primary dimension (one tap → advance)
// Screen 2 — Mission:     "I am building…" (seeds goal_text + what_building)
// Screen 3 — Commitment:  "This week I will…" (seeds first user_commitment)
//
// Saves: full_name, ascent_stage, what_building, onboarding_completed = true
//        Creates: user_goals row, user_commitments row
// Auth callback reads: onboarding_completed (priority 1) + ascent_stage (resume)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD   = '#C8A96E';
const DARK   = '#0F0F0E';
const BG     = '#FAFAF8';
const MUTED  = '#9CA3AF';
const BORDER = '#E8E6E1';
const CARD   = '#FFFFFF';

// ── The 7 dimensions ─────────────────────────────────────────────────────────
const DIMENSIONS = [
  { value: 'purpose',       label: 'Purpose',       sub: 'Why I exist'                  },
  { value: 'mind',          label: 'Mind',           sub: 'How I think'                  },
  { value: 'character',     label: 'Character',      sub: 'How I live'                   },
  { value: 'work',          label: 'Work',           sub: 'How I contribute'             },
  { value: 'relationships', label: 'Relationships',  sub: 'Who I build with'             },
  { value: 'community',     label: 'Community',      sub: 'What I build beyond myself'   },
  { value: 'legacy',        label: 'Legacy',         sub: 'What remains when I am gone'  },
] as const;

type Dimension = typeof DIMENSIONS[number]['value'];

// ── Shared styles ─────────────────────────────────────────────────────────────
const fontDisplay = "var(--font-display,'Plus Jakarta Sans',sans-serif)";
const fontBody    = "var(--font-body,'Inter',sans-serif)";

const H1: React.CSSProperties = {
  fontFamily: fontDisplay,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  fontWeight: 800, lineHeight: 1.15,
  letterSpacing: '-0.02em', color: DARK,
  margin: '0 0 0.375rem',
};
const SUB: React.CSSProperties = {
  fontSize: 15, color: '#6B7280',
  lineHeight: 1.6, margin: '0 0 1.75rem',
  fontFamily: fontBody,
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: DARK, marginBottom: 8, fontFamily: fontBody,
};
const INPUT: React.CSSProperties = {
  width: '100%', padding: '0.875rem 1rem',
  background: '#F6F5F1',
  border: `1.5px solid ${BORDER}`,
  borderRadius: '0.625rem',
  fontFamily: fontBody,
  fontSize: 15, color: DARK,
  outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
};
const BTN_PRIMARY: React.CSSProperties = {
  width: '100%', padding: '0.9375rem',
  borderRadius: '0.625rem', border: 'none',
  background: DARK, color: BG,
  fontSize: 15, fontWeight: 700,
  cursor: 'pointer', fontFamily: fontDisplay,
  transition: 'opacity 0.2s',
};
const BTN_GHOST: React.CSSProperties = {
  padding: '0.9375rem 1.25rem',
  borderRadius: '0.625rem',
  border: `1.5px solid ${BORDER}`,
  background: 'transparent',
  color: MUTED, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: fontDisplay,
};

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: '1.75rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 9999,
          background: i < step ? DARK : BORDER,
          transition: 'background 0.4s',
        }} />
      ))}
    </div>
  );
}

// ── Eyebrow ───────────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: GOLD,
      fontFamily: fontBody, margin: '0 0 0.875rem',
    }}>
      {children}
    </p>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const initialStep  = parseInt(searchParams.get('step') || '1', 10) as 1 | 2 | 3;
  const [screen, setScreen]       = useState<1 | 2 | 3>(initialStep);
  const [fullName, setFullName]   = useState('');
  const [dimension, setDimension] = useState<Dimension | null>(null);
  const [building, setBuilding]   = useState('');
  const [commitment, setCommitment] = useState('');
  const [saving, setSaving]       = useState(false);
  const [nameError, setNameError] = useState(false);

  const nameRef       = useRef<HTMLInputElement>(null);
  const buildingRef   = useRef<HTMLInputElement>(null);
  const commitmentRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { if (screen === 2) buildingRef.current?.focus(); }, [screen]);
  useEffect(() => { if (screen === 3) commitmentRef.current?.focus(); }, [screen]);

  // Screen 1: tap dimension → if name present, advance; else shake
  function handleDimensionSelect(d: Dimension) {
    setDimension(d);
    if (!fullName.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      setTimeout(() => setNameError(false), 700);
      return;
    }
    setTimeout(() => setScreen(2), 200);
  }

  // Screen 2: save mission → advance
  async function handleMissionNext() {
    if (!building.trim() || saving) return;
    setScreen(3);
  }

  // Screen 3: save everything → dashboard
  async function handleComplete() {
    if (!commitment.trim() || saving) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: existing } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single();

    const referralCode = existing?.referral_code ||
      'ASC-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    // Save profile
    await supabase.from('profiles').upsert({
      id:                   user.id,
      full_name:            fullName.trim(),
      ascent_stage:         dimension,
      what_building:        building.trim(),
      referral_code:        referralCode,
      onboarding_completed: true,
      updated_at:           new Date().toISOString(),
    });

    // Seed first goal (powers GoalCard on dashboard)
    await supabase.from('user_goals').insert({
      user_id:   user.id,
      goal_text: building.trim(),
      progress:  0,
    });

    // Seed first commitment (powers CommitmentsCard on dashboard)
    await supabase.from('user_commitments').insert({
      user_id:         user.id,
      commitment_text: commitment.trim(),
      completed:       false,
      due_date: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0], // end of this week
    });

    // Non-blocking welcome email
    fetch('/api/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {});

    router.push('/dashboard');
  }

  return (
    <div style={{
      minHeight: '100dvh', background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      padding: '2rem 1.5rem',
      overflowY: 'auto',
    }}>

      {/* Logo */}
      <div style={{ marginBottom: '2rem' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ascentor-color-for-light-pages.svg"
          alt="Ascentor"
          style={{ height: 26, width: 'auto' }}
        />
      </div>

      {/* Card */}
      <div style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: '1.25rem',
        padding: 'clamp(1.75rem, 5vw, 2.75rem)',
        width: '100%', maxWidth: 500,
        boxShadow: '0 4px 40px rgba(0,0,0,0.06)',
        animation: 'fadeUp 0.3s ease both',
      }}>

        {/* ── SCREEN 1: Identity ── */}
        {screen === 1 && (
          <div key="s1" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={1} />
            <Eyebrow>Your Identity</Eyebrow>
            <h1 style={H1}>Who are you becoming?</h1>
            <p style={SUB}>
              Not your job. Not your title. The person you are <em>building</em>.
            </p>

            {/* Name */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={LABEL}>Your name</label>
              <input
                ref={nameRef}
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && dimension && handleDimensionSelect(dimension)}
                placeholder="First and last name"
                autoComplete="name"
                style={{
                  ...INPUT,
                  borderColor: nameError ? '#EF4444' : BORDER,
                  boxShadow: nameError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
                  animation: nameError ? 'shake 0.4s ease' : 'none',
                }}
              />
              {nameError && (
                <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6, fontFamily: fontBody }}>
                  Enter your name first
                </p>
              )}
            </div>

            {/* Dimension grid */}
            <div>
              <label style={LABEL}>
                Where do you most need to grow right now?
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.5rem',
              }}>
                {DIMENSIONS.map(d => {
                  const active = dimension === d.value;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleDimensionSelect(d.value)}
                      style={{
                        padding: '0.75rem 0.875rem',
                        borderRadius: '0.625rem',
                        border: active
                          ? `2px solid ${GOLD}`
                          : `1.5px solid ${BORDER}`,
                        background: active
                          ? `rgba(200,169,110,0.07)`
                          : BG,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        // Legacy spans full width in the grid
                        gridColumn: d.value === 'legacy' && DIMENSIONS.length % 2 !== 0
                          ? 'span 2' : 'auto',
                      }}
                    >
                      <span style={{
                        display: 'block',
                        fontSize: 13.5, fontWeight: 700,
                        color: active ? GOLD : DARK,
                        fontFamily: fontDisplay,
                        marginBottom: 2,
                      }}>
                        {d.label}
                      </span>
                      <span style={{
                        fontSize: 11.5,
                        color: active ? `${GOLD}cc` : MUTED,
                        fontFamily: fontBody,
                      }}>
                        {d.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{
                fontSize: 11.5, color: MUTED, marginTop: 10,
                fontFamily: fontBody, textAlign: 'center',
              }}>
                Tap to select — you'll advance automatically
              </p>
            </div>
          </div>
        )}

        {/* ── SCREEN 2: Mission ── */}
        {screen === 2 && (
          <div key="s2" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={2} />
            <Eyebrow>Your Mission</Eyebrow>
            <h1 style={H1}>What are you building?</h1>
            <p style={SUB}>
              Not your job description. Not a goal. The thing your life is <em>about</em>.
            </p>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={LABEL}>I am building…</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={buildingRef}
                  type="text"
                  value={building}
                  onChange={e => setBuilding(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && building.trim() && handleMissionNext()}
                  placeholder="e.g. a generation of African leaders who think clearly"
                  maxLength={120}
                  style={{ ...INPUT, paddingRight: '3rem' }}
                />
                {building.trim() && (
                  <span style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 11, color: MUTED, fontFamily: fontBody,
                    pointerEvents: 'none',
                  }}>
                    {building.length}/120
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 8, fontFamily: fontBody }}>
                One sentence. This will become your 90-day goal on the dashboard.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                type="button"
                onClick={() => setScreen(1)}
                style={BTN_GHOST}
              >
                ←
              </button>
              <button
                type="button"
                onClick={handleMissionNext}
                disabled={!building.trim()}
                style={{
                  ...BTN_PRIMARY,
                  flex: 1,
                  opacity: building.trim() ? 1 : 0.35,
                  cursor: building.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Continue →
              </button>
            </div>

            <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 12, fontFamily: fontBody }}>
              Press{' '}
              <kbd style={{
                fontSize: 11, padding: '1px 6px', borderRadius: 4,
                border: `1px solid ${BORDER}`, background: BG, fontFamily: fontBody,
              }}>Enter</kbd>
              {' '}to continue
            </p>
          </div>
        )}

        {/* ── SCREEN 3: Commitment ── */}
        {screen === 3 && (
          <div key="s3" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={3} />
            <Eyebrow>Your First Commitment</Eyebrow>
            <h1 style={H1}>What will you do this week?</h1>
            <p style={SUB}>
              Ascentor is built on commitments, not intentions. Name one thing.
            </p>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={LABEL}>This week I will…</label>
              <input
                ref={commitmentRef}
                type="text"
                value={commitment}
                onChange={e => setCommitment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitment.trim() && handleComplete()}
                placeholder="e.g. read for 30 minutes every morning"
                maxLength={100}
                style={{ ...INPUT }}
              />
              <p style={{ fontSize: 12, color: MUTED, marginTop: 8, fontFamily: fontBody }}>
                This will appear on your dashboard as your first commitment.
              </p>
            </div>

            {/* Quote */}
            <div style={{
              background: '#0C0B08',
              borderRadius: '0.875rem',
              padding: '1.125rem 1.25rem',
              marginBottom: '1.75rem',
              borderLeft: `3px solid ${GOLD}`,
            }}>
              <p style={{
                fontFamily: "var(--font-accent,'Playfair Display',serif)",
                fontStyle: 'italic',
                fontSize: 14, color: GOLD, lineHeight: 1.65, margin: 0,
              }}>
                "Every life that matters was built on purpose. Not accident. Not circumstance. Purpose."
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button
                type="button"
                onClick={() => setScreen(2)}
                style={BTN_GHOST}
              >
                ←
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={!commitment.trim() || saving}
                style={{
                  ...BTN_PRIMARY,
                  flex: 1,
                  opacity: commitment.trim() && !saving ? 1 : 0.35,
                  cursor: commitment.trim() && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? 'Setting things up…' : 'Begin my ascent →'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <p style={{
        marginTop: '1.5rem', fontSize: 12,
        color: MUTED, textAlign: 'center', fontFamily: fontBody,
      }}>
        The Elevation Summit · February 2027 · Lagos, Nigeria
      </p>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60%  { transform: translateX(-6px); }
          40%, 80%  { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
