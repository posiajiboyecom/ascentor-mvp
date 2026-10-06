// app/onboarding/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Ascentor onboarding - 4 screens, about a minute, personalised with the member's name.
//
// Screen 1 - Identity:    confirm name + primary dimension (one tap advances)
// Screen 2 - Mission:     "I am building..." (seeds goal_text + what_building)
// Screen 3 - About you:   stage, current and goal role, industry, daily time, biggest challenge
// Screen 4 - Commitment:  "This week I will..." (seeds the first user_commitment)
//
// The name comes from the account itself: the sign-up form (email) or the provider profile (Google,
// LinkedIn). Saves: full_name, primary_dimension, what_building, onboarding_completed = true and
// creates the first goal and commitment. Light theme, Metropolis throughout.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Compass, Brain, Anchor, Hammer, Handshake, Users, Mountain, type LucideIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD   = '#8A6A2B';   // gold readable as text on white
const GOLD_BG = '#C8A96E';
const DARK   = '#0F0F0E';
const BG     = '#FAFAF8';
const MUTED  = '#6B7280';
const BORDER = '#E8E6E1';
const CARD   = '#FFFFFF';

// ── The 7 dimensions of a total person ───────────────────────────────────────
const DIMENSIONS: readonly { value: string; label: string; sub: string; Icon: LucideIcon }[] = [
  { value: 'purpose',       label: 'Purpose',       sub: 'Why I exist',                  Icon: Compass },
  { value: 'mind',          label: 'Mind',          sub: 'How I think',                  Icon: Brain },
  { value: 'character',     label: 'Character',     sub: 'How I live',                   Icon: Anchor },
  { value: 'work',          label: 'Work',          sub: 'How I contribute',             Icon: Hammer },
  { value: 'relationships', label: 'Relationships', sub: 'Who I build with',             Icon: Handshake },
  { value: 'community',     label: 'Community',     sub: 'What I build beyond myself',   Icon: Users },
  { value: 'legacy',        label: 'Legacy',        sub: 'What remains when I am gone',  Icon: Mountain },
];

// Theme fonts only (Metropolis comes from the global tokens). No hard-coded families.
const fontDisplay = 'var(--font-display)';
const fontBody    = 'var(--font-body)';

const H1: React.CSSProperties = {
  fontFamily: fontDisplay,
  fontSize: 'clamp(1.5rem, 4vw, 2rem)',
  fontWeight: 800, lineHeight: 1.15,
  letterSpacing: '-0.02em', color: DARK,
  margin: '0 0 0.375rem',
};
const SUB: React.CSSProperties = {
  fontFamily: fontBody, fontSize: 15, color: MUTED,
  lineHeight: 1.6, margin: '0 0 1.75rem',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontFamily: fontBody, fontSize: 13, fontWeight: 600,
  color: DARK, marginBottom: 8,
};
const HINT: React.CSSProperties = { fontFamily: fontBody, fontSize: 12, color: MUTED, marginTop: 8 };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '0.875rem 1rem',
  background: '#F6F5F1', border: `1.5px solid ${BORDER}`, borderRadius: '0.625rem',
  fontFamily: fontBody, fontSize: 15, color: DARK,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
const BTN_PRIMARY: React.CSSProperties = {
  width: '100%', padding: '0.9375rem', borderRadius: '0.625rem', border: 'none',
  background: DARK, color: BG, fontFamily: fontDisplay, fontSize: 15, fontWeight: 700,
  cursor: 'pointer', transition: 'opacity 0.2s',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
const BTN_GHOST: React.CSSProperties = {
  padding: '0.9375rem 1.1rem', borderRadius: '0.625rem', border: `1.5px solid ${BORDER}`,
  background: 'transparent', color: MUTED, fontFamily: fontDisplay, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};

const STAGES = [
  { value: 'seeker',  label: 'The Seeker',  sub: 'Finding my purpose' },
  { value: 'builder', label: 'The Builder', sub: 'Building toward it' },
  { value: 'leader',  label: 'The Leader',  sub: 'Leading others' },
] as const;
const INDUSTRIES = ['Technology', 'Finance & Banking', 'Consulting', 'Healthcare', 'Education', 'Energy', 'Telecom', 'Government', 'NGO', 'Real Estate', 'Manufacturing', 'Media & Entertainment', 'Agriculture', 'Legal', 'Retail', 'Other'];
// Must match the profiles_time_commitment_check constraint.
const TIMES = [
  { value: '5min',  label: '5 min a day' },
  { value: '15min', label: '15 min a day' },
  { value: '30min', label: '30 min a day' },
] as const;

function ProgressBar({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div role="img" aria-label={`Step ${step} of ${total}`} style={{ display: 'flex', gap: 8, marginBottom: '1.75rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ height: 3, width: 28, borderRadius: 9999, background: i < step ? GOLD_BG : BORDER, transition: 'background 0.4s' }} />
      ))}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: fontBody, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, margin: '0 0 0.875rem' }}>
      {children}
    </p>
  );
}

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** The name an account already carries, ignoring the placeholder the database trigger uses. */
function usableName(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v && v.toLowerCase() !== 'new user' ? v : '';
}

/** Human message for a failed save, with the real reason kept for the console and a small detail line. */
function saveFailure(err: unknown): { message: string; detail: string } {
  const e = err as { code?: string; message?: string };
  const detail = [e?.code, e?.message].filter(Boolean).join(': ');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { message: 'You appear to be offline. Reconnect and try again.', detail };
  }
  if (e?.code === '23514' || e?.code === '23505') {
    return { message: 'One of your answers could not be saved in that form. Please go back, adjust it and try again.', detail };
  }
  if (e?.code === '42501') {
    return { message: 'Your session no longer has permission to save this. Please sign in again.', detail };
  }
  return { message: 'We could not save your details just now. Please try again in a moment.', detail };
}

export default function OnboardingPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const initialStep = parseInt(searchParams.get('step') || '1', 10);
  const [screen, setScreen]         = useState<1 | 2 | 3 | 4>(initialStep === 2 ? 2 : initialStep === 3 ? 3 : initialStep === 4 ? 4 : 1);
  const [stage, setStage]           = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [goalRole, setGoalRole]     = useState('');
  const [industry, setIndustry]     = useState('');
  const [timeCommitment, setTimeCommitment] = useState('15min');
  const [challenge, setChallenge]   = useState('');
  const [fullName, setFullName]     = useState('');
  const [nameFromAccount, setNameFromAccount] = useState(false);
  const [dimension, setDimension]   = useState<string | null>(null);
  const [building, setBuilding]     = useState('');
  const [commitment, setCommitment] = useState('');
  const [saving, setSaving]         = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [saveError, setSaveError]   = useState<{ message: string; detail: string } | null>(null);
  const [nameError, setNameError]   = useState(false);
  const [greeting, setGreeting]     = useState('Welcome');

  const nameRef       = useRef<HTMLInputElement>(null);
  const buildingRef   = useRef<HTMLInputElement>(null);
  const commitmentRef = useRef<HTMLInputElement>(null);

  const first = fullName.trim().split(/\s+/)[0] ?? '';
  const chosen = DIMENSIONS.find((d) => d.value === dimension) ?? null;

  // Load who this member already is: profile first, then the sign-up or provider metadata.
  useEffect(() => {
    setGreeting(greetingFor());
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, onboarding_completed, primary_dimension, what_building, ascent_stage, current_role, goal_role, industry, time_commitment, biggest_challenge')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;

      // Already finished: onboarding is not a place to come back to.
      if (profile?.onboarding_completed === true) { router.replace('/dashboard'); return; }

      const meta = user.user_metadata ?? {};
      const name = usableName(profile?.full_name) || usableName(meta.full_name) || usableName(meta.name)
        || [usableName(meta.given_name), usableName(meta.family_name)].filter(Boolean).join(' ');
      if (name) { setFullName(name); setNameFromAccount(true); }
      if (profile?.primary_dimension && DIMENSIONS.some((d) => d.value === profile.primary_dimension)) setDimension(profile.primary_dimension);
      if (profile?.what_building) setBuilding(profile.what_building);
      if (profile?.ascent_stage) setStage(profile.ascent_stage);
      if (profile?.current_role) setCurrentRole(profile.current_role);
      if (profile?.goal_role) setGoalRole(profile.goal_role);
      if (profile?.industry) setIndustry(profile.industry);
      if (profile?.time_commitment) setTimeCommitment(profile.time_commitment);
      if (profile?.biggest_challenge) setChallenge(profile.biggest_challenge);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (screen === 1 && !nameFromAccount) nameRef.current?.focus(); }, [screen, nameFromAccount]);
  useEffect(() => { if (screen === 2) buildingRef.current?.focus(); }, [screen]);
  useEffect(() => { if (screen === 4) commitmentRef.current?.focus(); }, [screen]);

  function handleDimensionSelect(value: string) {
    setDimension(value);
    if (!fullName.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      setTimeout(() => setNameError(false), 700);
      return;
    }
    setTimeout(() => setScreen(2), 200);
  }

  function handleMissionNext() {
    if (!building.trim() || saving) return;
    setScreen(3);
  }

  function handleAboutNext() {
    if (!stage) return;
    setScreen(4);
  }

  // Idempotent: a double click, a retry after an error or a revisit never duplicates the goal or the
  // commitment, and never re-sends the welcome email.
  async function handleComplete() {
    if (!commitment.trim() || saving) return;
    setSaving(true);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: existing } = await supabase
        .from('profiles')
        .select('referral_code, onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      let referralCode: string | undefined = existing?.referral_code ?? undefined;
      for (let i = 0; !referralCode && i < 6; i++) {
        const candidate = 'ASC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data: taken } = await supabase.from('profiles').select('id').eq('referral_code', candidate).maybeSingle();
        if (!taken) referralCode = candidate;
      }

      const fields = {
        full_name:            fullName.trim(),
        primary_dimension:    dimension,
        what_building:        building.trim(),
        ascent_stage:         stage || null,
        current_role:         currentRole.trim() || null,
        goal_role:            goalRole.trim() || null,
        industry:             industry || null,
        time_commitment:      timeCommitment,
        biggest_challenge:    challenge.trim() || null,
        referral_code:        referralCode,
        onboarding_completed: true,
        updated_at:           new Date().toISOString(),
      };
      // The profile row is created at sign-up; update it, and only insert if it is somehow missing.
      const { error: profileError } = existing
        ? await supabase.from('profiles').update(fields).eq('id', user.id)
        : await supabase.from('profiles').insert({ id: user.id, email: user.email, ...fields });
      if (profileError) throw profileError;

      const [{ count: goalCount }, { count: commitmentCount }] = await Promise.all([
        supabase.from('user_goals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('user_commitments').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      if (!goalCount) {
        const { error } = await supabase.from('user_goals').insert({ user_id: user.id, goal_text: building.trim(), progress: 0 });
        if (error) throw error;
      }
      if (!commitmentCount) {
        const { error } = await supabase.from('user_commitments').insert({
          user_id: user.id, commitment_text: commitment.trim(), completed: false,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        if (error) throw error;
      }

      if (!existing?.onboarding_completed && user.email) {
        fetch('/api/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: fullName.trim(), userId: user.id }),
        }).catch(() => {});
      }

      setCelebrating(true);
      setTimeout(() => router.push('/dashboard'), 2200);
    } catch (err) {
      console.error('[onboarding] save failed:', err);
      setSaveError(saveFailure(err));
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: BG, fontFamily: fontBody,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      padding: '2rem 1.5rem', overflowY: 'auto',
    }}>

      {/* Completion moment (light, like the rest of the app) */}
      {celebrating && (
        <div
          role="status"
          aria-label="Onboarding complete"
          style={{
            position: 'fixed', inset: 0, zIndex: 100, background: BG,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '2rem', animation: 'fadeUp 0.35s ease both',
          }}
        >
          <span className="ledger-line" style={{ maxWidth: 220, marginBottom: '1.5rem' }} aria-hidden="true" />
          <p style={{ fontFamily: fontDisplay, fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.02em', color: DARK, margin: 0, textAlign: 'center' }}>
            Your ascent begins{first ? `, ${first}` : ''}.
          </p>
          {chosen && (
            <p style={{ fontFamily: fontBody, fontSize: 14, color: MUTED, marginTop: '0.75rem', textAlign: 'center' }}>
              Starting with {chosen.label.toLowerCase()}: {chosen.sub.toLowerCase()}.
            </p>
          )}
        </div>
      )}

      {/* Logo, linked home */}
      <Link href="/" aria-label="Ascentor home" style={{ marginBottom: '2rem', display: 'inline-block' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 26, width: 'auto', display: 'block' }} />
      </Link>

      <div style={{
        background: CARD, border: `1px solid ${BORDER}`, borderRadius: '1.25rem',
        padding: 'clamp(1.75rem, 5vw, 2.75rem)', width: '100%', maxWidth: 520,
        boxShadow: '0 4px 40px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s ease both',
      }}>

        {/* ── SCREEN 1: Identity ── */}
        {screen === 1 && (
          <div key="s1" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={1} />
            <Eyebrow>{greeting}{first ? `, ${first}` : ''}</Eyebrow>
            <h1 style={H1}>{first ? `${first}, who are you becoming?` : 'Who are you becoming?'}</h1>
            <p style={SUB}>
              Not your job. Not your title. The person you are <em>building</em>.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="ob-name" style={LABEL}>{nameFromAccount ? 'How should we address you?' : 'Your name'}</label>
              <input
                id="ob-name"
                ref={nameRef}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dimension && handleDimensionSelect(dimension)}
                placeholder="First and last name"
                autoComplete="name"
                style={{
                  ...INPUT,
                  borderColor: nameError ? '#EF4444' : BORDER,
                  boxShadow: nameError ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
                  animation: nameError ? 'shake 0.4s ease' : 'none',
                }}
              />
              {nameError && <p role="alert" style={{ fontFamily: fontBody, fontSize: 12, color: '#EF4444', marginTop: 6 }}>Enter your name first</p>}
            </div>

            <div>
              <p id="ob-dim-label" style={LABEL}>
                {first ? `${first}, where do you most need to grow right now?` : 'Where do you most need to grow right now?'}
              </p>
              <div role="group" aria-labelledby="ob-dim-label" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {DIMENSIONS.map((d, i) => {
                  const active = dimension === d.value;
                  const Icon = d.Icon;
                  const lastOdd = i === DIMENSIONS.length - 1 && DIMENSIONS.length % 2 !== 0;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleDimensionSelect(d.value)}
                      style={{
                        padding: '0.9rem 0.75rem', borderRadius: '0.75rem',
                        border: active ? `2px solid ${GOLD_BG}` : `1.5px solid ${BORDER}`,
                        background: active ? 'rgba(200,169,110,0.09)' : BG,
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        gridColumn: lastOdd ? 'span 2' : 'auto',
                      }}
                    >
                      <Icon size={22} color={active ? GOLD : DARK} aria-hidden="true" />
                      <span style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 700, color: active ? GOLD : DARK }}>{d.label}</span>
                      <span style={{ fontFamily: fontBody, fontSize: 12, color: MUTED, lineHeight: 1.35 }}>{d.sub}</span>
                    </button>
                  );
                })}
              </div>
              <p style={{ ...HINT, textAlign: 'center', marginTop: 10 }}>Tap one to continue</p>
            </div>
          </div>
        )}

        {/* ── SCREEN 2: Mission ── */}
        {screen === 2 && (
          <div key="s2" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={2} />
            <Eyebrow>Your Mission</Eyebrow>
            <h1 style={H1}>{first ? `${first}, what are you building?` : 'What are you building?'}</h1>
            <p style={SUB}>
              {chosen ? `You chose ${chosen.label.toLowerCase()}: ${chosen.sub.toLowerCase()}. ` : ''}
              Not your job description. The thing your life is <em>about</em>.
            </p>

            <div style={{ marginBottom: '1.75rem' }}>
              <label htmlFor="ob-building" style={LABEL}>I am building…</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="ob-building"
                  ref={buildingRef}
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && building.trim() && handleMissionNext()}
                  placeholder="e.g. a generation of African leaders who think clearly"
                  maxLength={120}
                  style={{ ...INPUT, paddingRight: '3.5rem' }}
                />
                {building.trim() && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: fontBody, fontSize: 11, color: MUTED, pointerEvents: 'none' }}>
                    {building.length}/120
                  </span>
                )}
              </div>
              <p style={HINT}>One sentence. This becomes your 90-day goal on your dashboard.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button type="button" onClick={() => setScreen(1)} style={BTN_GHOST} aria-label="Back"><ArrowLeft size={18} aria-hidden="true" /></button>
              <button
                type="button"
                onClick={handleMissionNext}
                disabled={!building.trim()}
                style={{ ...BTN_PRIMARY, flex: 1, opacity: building.trim() ? 1 : 0.35, cursor: building.trim() ? 'pointer' : 'not-allowed' }}
              >
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ── SCREEN 3: About you ── */}
        {screen === 3 && (
          <div key="s3" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={3} />
            <Eyebrow>About you</Eyebrow>
            <h1 style={H1}>{first ? `${first}, where are you in your ascent?` : 'Where are you in your ascent?'}</h1>
            <p style={SUB}>This shapes your coaching, sessions and goals. You can change any of it later in Settings.</p>

            <div role="group" aria-label="Your stage" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {STAGES.map((st) => {
                const active = stage === st.value;
                return (
                  <button key={st.value} type="button" aria-pressed={active} onClick={() => setStage(st.value)}
                    style={{ padding: '0.8rem 0.5rem', borderRadius: '0.75rem', textAlign: 'center', cursor: 'pointer',
                      border: active ? `2px solid ${GOLD_BG}` : `1.5px solid ${BORDER}`, background: active ? 'rgba(200,169,110,0.09)' : BG }}>
                    <span style={{ display: 'block', fontFamily: fontDisplay, fontSize: 13, fontWeight: 700, color: active ? GOLD : DARK }}>{st.label}</span>
                    <span style={{ display: 'block', fontFamily: fontBody, fontSize: 11, color: MUTED, marginTop: 2 }}>{st.sub}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.875rem', marginBottom: '0.875rem' }}>
              <div>
                <label htmlFor="ob-role" style={LABEL}>Current role</label>
                <input id="ob-role" type="text" value={currentRole} onChange={(e) => setCurrentRole(e.target.value)} placeholder="e.g. Software Engineer" maxLength={80} style={INPUT} />
              </div>
              <div>
                <label htmlFor="ob-goal" style={LABEL}>Goal role</label>
                <input id="ob-goal" type="text" value={goalRole} onChange={(e) => setGoalRole(e.target.value)} placeholder="e.g. Engineering Manager" maxLength={80} style={INPUT} />
              </div>
              <div>
                <label htmlFor="ob-industry" style={LABEL}>Industry</label>
                <select id="ob-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} style={INPUT}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ob-time" style={LABEL}>Daily commitment</label>
                <select id="ob-time" value={timeCommitment} onChange={(e) => setTimeCommitment(e.target.value)} style={INPUT}>
                  {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="ob-challenge" style={LABEL}>Biggest challenge right now</label>
              <textarea id="ob-challenge" value={challenge} onChange={(e) => setChallenge(e.target.value)} rows={2} maxLength={300}
                placeholder="What is getting in the way?" style={{ ...INPUT, resize: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button type="button" onClick={() => setScreen(2)} style={BTN_GHOST} aria-label="Back"><ArrowLeft size={18} aria-hidden="true" /></button>
              <button type="button" onClick={handleAboutNext} disabled={!stage}
                style={{ ...BTN_PRIMARY, flex: 1, opacity: stage ? 1 : 0.35, cursor: stage ? 'pointer' : 'not-allowed' }}>
                Continue <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* ── SCREEN 4: Commitment ── */}
        {screen === 4 && (
          <div key="s4" style={{ animation: 'fadeUp 0.25s ease both' }}>
            <ProgressBar step={4} />
            <Eyebrow>Your First Commitment</Eyebrow>
            <h1 style={H1}>{first ? `What will you do this week, ${first}?` : 'What will you do this week?'}</h1>
            <p style={SUB}>
              {building.trim() ? `You are building “${building.trim()}”. ` : ''}
              Ascentor runs on commitments, not intentions. Name one thing you will do this week to move it forward.
            </p>

            <div style={{ marginBottom: '1.75rem' }}>
              <label htmlFor="ob-commitment" style={LABEL}>This week I will…</label>
              <input
                id="ob-commitment"
                ref={commitmentRef}
                type="text"
                value={commitment}
                onChange={(e) => setCommitment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitment.trim() && handleComplete()}
                placeholder="e.g. read for 30 minutes every morning"
                maxLength={100}
                style={INPUT}
              />
              <p style={HINT}>It appears on your dashboard as your first commitment.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button type="button" onClick={() => setScreen(3)} style={BTN_GHOST} aria-label="Back"><ArrowLeft size={18} aria-hidden="true" /></button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={!commitment.trim() || saving}
                style={{ ...BTN_PRIMARY, flex: 1, opacity: commitment.trim() && !saving ? 1 : 0.35, cursor: commitment.trim() && !saving ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Setting things up…' : <>Begin my ascent <ArrowRight size={16} aria-hidden="true" /></>}
              </button>
            </div>
            {saveError && (
              <div role="alert" style={{ marginTop: 12, textAlign: 'center' }}>
                <p style={{ fontFamily: fontBody, color: '#DC2626', fontSize: 13, margin: 0 }}>{saveError.message}</p>
                {saveError.detail && <p style={{ fontFamily: fontBody, color: MUTED, fontSize: 11, margin: '4px 0 0', wordBreak: 'break-word' }}>{saveError.detail}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer: copyright and legal, linked */}
      <p style={{ marginTop: '1.5rem', fontFamily: fontBody, fontSize: 12, color: MUTED, textAlign: 'center' }}>
        © {new Date().getFullYear()} Ascentor ·{' '}
        <Link href="/privacy" style={{ color: MUTED }}>Privacy</Link> ·{' '}
        <Link href="/terms" style={{ color: MUTED }}>Terms</Link>
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
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
