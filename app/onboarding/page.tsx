// FILE: app/onboarding/page.tsx
// FIX: Added required WhatsApp phone number field to Step 1.
//      Button stays disabled until whatsapp_phone is filled.
//      Field is saved to profiles table via the existing upsert.
//      NOTE: Run the SQL migration below if whatsapp_phone column doesn't exist.

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

const industries = [
  'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
  'Education', 'Energy', 'Telecom', 'Government', 'NGO', 'Other',
];

const timeOptions = [
  { value: '10min', label: '10 min / day' },
  { value: '15min', label: '15 min / day' },
  { value: '30min', label: '30 min / day' },
  { value: '60min', label: '1 hour / day' },
];

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const initialStep = searchParams.get('step') === '2' ? 2 : 1;
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState({
    full_name: '',
    current_role: '',
    industry: '',
    goal_role: '',
    biggest_challenge: '',
    time_commitment: '15min',
    whatsapp_phone: '',
  });

  const [goal, setGoal] = useState({
    goal_text: '',
    milestone_1: '',
    milestone_2: '',
    milestone_3: '',
  });

  const handleProfileSave = async () => {
    setSaving(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert(authError?.message || 'Not logged in. Please sign in again.');
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
      ...profile,
      referral_code: referralCode,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      alert('Error: ' + dbError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep(2);
  };

  const handleGoalSave = async () => {
    setSaving(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert('Session expired. Please sign in again.');
      setSaving(false);
      return;
    }

    try {
      // 1. Save the 90-day goal
      const { error: goalError } = await supabase.from('user_goals').insert({
        user_id: user.id,
        goal_text: goal.goal_text,
        timeframe: '90 days',
        milestone_1: goal.milestone_1,
        milestone_2: goal.milestone_2,
        milestone_3: goal.milestone_3,
      });

      if (goalError) {
        if (!goalError.message.includes('duplicate') && goalError.code !== '23505') {
          alert(`Error saving goal: ${goalError.message}`);
          setSaving(false);
          return;
        }
      }

      // 2. Mark onboarding complete — fire-and-forget
      supabase.from('profiles').update({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).then(({ error }) => {
        if (error) console.warn('[onboarding] onboarding_completed update failed (non-fatal):', error.message);
      });

      // 3. ML tagging — fire-and-forget
      if (user.email) {
        fetch('/api/checkout-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: profile.full_name || user.email.split('@')[0],
            userId: user.id,
          }),
        }).catch(() => {});
      }

      // 4. Referral — fire-and-forget
      try {
        const storedRef = localStorage.getItem('ascentor_referral');
        if (storedRef) {
          fetch('/api/referral', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: storedRef }),
          }).catch(() => {});
          localStorage.removeItem('ascentor_referral');
        }
      } catch { /* non-fatal */ }

      // ── CHANGED: Send to /checkout instead of /dashboard ──────────
      // User chooses free or paid plan after completing profile setup.
      router.push('/checkout?from=onboarding');

    } catch (err: any) {
      console.error('[onboarding] handleGoalSave error:', err);
      alert('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  const step1Valid = profile.full_name && profile.current_role && profile.industry && profile.goal_role && profile.whatsapp_phone;
  const step2Valid = goal.goal_text;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600;1,700&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ob-root {
          min-height: 100vh;
          background: #0C0B08;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          position: relative;
          overflow: hidden;
          font-family: 'Syne', sans-serif;
        }

        .ob-root::before {
          content: '';
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 700px;
          height: 700px;
          background: radial-gradient(circle, rgba(232,160,32,0.06) 0%, transparent 65%);
          pointer-events: none;
        }

        .ob-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(232,160,32,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,160,32,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        .ob-card {
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 1;
          animation: ob-rise 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }

        @keyframes ob-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ob-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 40px; }
        .ob-logo-mark { width: 28px; height: 28px; }
        .ob-logo-text {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700; font-size: 20px; color: #fff; letter-spacing: -0.2px;
        }

        .ob-steps { display: flex; align-items: center; gap: 8px; margin-bottom: 36px; }
        .ob-step-bar {
          flex: 1; height: 2px; border-radius: 2px;
          background: #2E2A22; overflow: hidden; transition: background 0.4s;
        }
        .ob-step-bar.active { background: #E8A020; }
        .ob-step-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.12em; color: #7A7260; white-space: nowrap;
        }

        .ob-eyebrow {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.16em; color: #E8A020; text-transform: uppercase; margin-bottom: 10px;
        }
        .ob-heading {
          font-family: 'Cormorant Garamond', serif; font-weight: 700;
          font-size: 36px; line-height: 1.1; color: #fff;
          margin-bottom: 8px; letter-spacing: -0.5px;
        }
        .ob-subheading {
          font-size: 14px; color: #7A7260; margin-bottom: 32px;
          line-height: 1.5; font-weight: 400;
        }

        .ob-form { display: flex; flex-direction: column; gap: 14px; }
        .ob-field { display: flex; flex-direction: column; gap: 6px; }
        .ob-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.12em; color: #4A4438; text-transform: uppercase;
        }

        .ob-input, .ob-textarea, .ob-select {
          width: 100%; padding: 13px 16px;
          background: #1E1C17; border: 1px solid #2E2A22; border-radius: 10px;
          color: #D4CFC3; font-family: 'Syne', sans-serif; font-size: 14px;
          font-weight: 400; outline: none; transition: border-color 0.2s, background 0.2s;
          -webkit-appearance: none;
        }
        .ob-input::placeholder, .ob-textarea::placeholder { color: #4A4438; }
        .ob-input:focus, .ob-textarea:focus, .ob-select:focus {
          border-color: rgba(232,160,32,0.5); background: #2E2A22;
        }
        .ob-textarea { resize: none; line-height: 1.5; }
        .ob-select { cursor: pointer; color: #D4CFC3; }
        .ob-select option { background: #1E1C17; }

        .ob-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 480px) { .ob-grid-2 { grid-template-columns: 1fr; } }

        .ob-milestones-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: 0.12em; color: #4A4438;
          text-transform: uppercase; margin-bottom: 2px;
        }
        .ob-milestone-row { display: flex; align-items: center; gap: 12px; }
        .ob-milestone-num {
          width: 24px; height: 24px; border-radius: 50%;
          background: #2E2A22; border: 1px solid #4A4438;
          display: flex; align-items: center; justify-content: center;
          font-family: 'DM Mono', monospace; font-size: 10px; color: #7A7260; flex-shrink: 0;
        }

        .ob-journey {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px;
          background: rgba(232,160,32,0.04); border: 1px solid rgba(232,160,32,0.12);
          border-radius: 10px; font-size: 13px;
        }
        .ob-journey-from { color: #7A7260; }
        .ob-journey-arrow { color: #4A4438; }
        .ob-journey-to { color: #E8A020; font-weight: 600; }

        .ob-btn {
          width: 100%; padding: 15px 24px;
          background: #E8A020; color: #0C0B08; border: none; border-radius: 10px;
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          letter-spacing: 0.04em; cursor: pointer; transition: background 0.2s, transform 0.15s;
          margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .ob-btn:hover:not(:disabled) { background: #F5C55A; transform: translateY(-1px); }
        .ob-btn:active:not(:disabled) { transform: translateY(0); }
        .ob-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .ob-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          background: rgba(232,160,32,0.08); border: 1px solid rgba(232,160,32,0.18);
          border-radius: 100px; font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: 0.1em; color: #E8A020; margin-bottom: 20px;
        }
        .ob-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A020; }
        .ob-divider { height: 1px; background: #2E2A22; margin: 4px 0 8px; }
      `}</style>

      <div className="ob-root">
        <div className="ob-card">

          {/* Logo */}
          <div className="ob-logo">
            <svg className="ob-logo-mark" viewBox="0 0 32 32" fill="none">
              <path d="M4 26L16 6l12 20H4z" stroke="#E8A020" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
              <path d="M8 26L16 12l8 14H8z" stroke="#E8A020" strokeWidth="1.2" strokeLinejoin="round" fill="rgba(232,160,32,0.1)"/>
              <path d="M4 26h24" stroke="#E8A020" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="ob-logo-text">Ascentor</span>
          </div>

          {/* Step bars — 3 steps: Profile, Goal, Choose Plan */}
          <div className="ob-steps">
            <div className={`ob-step-bar ${step >= 1 ? 'active' : ''}`} />
            <div className={`ob-step-bar ${step >= 2 ? 'active' : ''}`} />
            <div className="ob-step-bar" /> {/* Step 3 = /checkout */}
            <span className="ob-step-label">STEP {step} OF 3</span>
          </div>

          {/* ─── STEP 1: Profile ─── */}
          {step === 1 && (
            <>
              <p className="ob-eyebrow">Your Profile</p>
              <h1 className="ob-heading">Let's meet<br/>your mentor.</h1>
              <p className="ob-subheading">
                Sage is trained on African career context. The more it knows about you, the sharper the guidance.
              </p>

              <div className="ob-form">
                <div className="ob-field">
                  <label className="ob-label">Full Name</label>
                  <input
                    className="ob-input"
                    placeholder="e.g. Amara Osei"
                    value={profile.full_name}
                    onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  />
                </div>

                <div className="ob-grid-2">
                  <div className="ob-field">
                    <label className="ob-label">Current Role</label>
                    <input
                      className="ob-input"
                      placeholder="e.g. Software Engineer"
                      value={profile.current_role}
                      onChange={e => setProfile({ ...profile, current_role: e.target.value })}
                    />
                  </div>
                  <div className="ob-field">
                    <label className="ob-label">Goal Role</label>
                    <input
                      className="ob-input"
                      placeholder="e.g. Engineering Manager"
                      value={profile.goal_role}
                      onChange={e => setProfile({ ...profile, goal_role: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ob-grid-2">
                  <div className="ob-field">
                    <label className="ob-label">Industry</label>
                    <select
                      className="ob-select"
                      value={profile.industry}
                      onChange={e => setProfile({ ...profile, industry: e.target.value })}
                    >
                      <option value="">Select</option>
                      {industries.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="ob-field">
                    <label className="ob-label">Daily Time</label>
                    <select
                      className="ob-select"
                      value={profile.time_commitment}
                      onChange={e => setProfile({ ...profile, time_commitment: e.target.value })}
                    >
                      {timeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ob-field">
                  <label className="ob-label">WhatsApp Number <span style={{ color: '#E8A020' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 18, pointerEvents: 'none', lineHeight: 1,
                    }}>📱</span>
                    <input
                      className="ob-input"
                      style={{ paddingLeft: 44 }}
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={profile.whatsapp_phone}
                      onChange={e => setProfile({ ...profile, whatsapp_phone: e.target.value })}
                    />
                  </div>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#4A4438', letterSpacing: '0.06em' }}>
                    Used for community updates and accountability nudges
                  </span>
                </div>

                <div className="ob-field">
                  <label className="ob-label">Biggest Career Challenge Right Now</label>
                  <textarea
                    className="ob-textarea"
                    placeholder="Be specific — Sage can only help as well as you share."
                    rows={3}
                    value={profile.biggest_challenge}
                    onChange={e => setProfile({ ...profile, biggest_challenge: e.target.value })}
                  />
                </div>

                {(profile.current_role || profile.goal_role) && (
                  <div className="ob-journey">
                    <span className="ob-journey-from">{profile.current_role || '...'}</span>
                    <span className="ob-journey-arrow">→</span>
                    <span className="ob-journey-to">{profile.goal_role || '...'}</span>
                  </div>
                )}

                <button
                  className="ob-btn"
                  onClick={handleProfileSave}
                  disabled={!step1Valid || saving}
                >
                  {saving ? 'Saving...' : <>Continue <span>→</span></>}
                </button>
              </div>
            </>
          )}

          {/* ─── STEP 2: 90-Day Goal ─── */}
          {step === 2 && (
            <>
              <p className="ob-eyebrow">Your 90-Day Goal</p>
              <h1 className="ob-heading">What will your<br/>mentor help you achieve?</h1>
              <p className="ob-subheading">
                Members who set a 90-day goal are 3x more likely to hit a measurable career outcome.
              </p>

              <div className="ob-badge">
                <div className="ob-badge-dot" />
                STEP 2 OF 3 · GOAL SETTING
              </div>

              <div className="ob-form">
                <div className="ob-field">
                  <label className="ob-label">Your Goal</label>
                  <textarea
                    className="ob-textarea"
                    placeholder="e.g. Get promoted to Engineering Manager at my current company"
                    rows={3}
                    value={goal.goal_text}
                    onChange={e => setGoal({ ...goal, goal_text: e.target.value })}
                  />
                </div>

                <div className="ob-divider" />

                <p className="ob-milestones-label">3 Milestones to get there</p>

                {(['milestone_1', 'milestone_2', 'milestone_3'] as const).map((key, i) => (
                  <div key={key} className="ob-milestone-row">
                    <div className="ob-milestone-num">{i + 1}</div>
                    <input
                      className="ob-input"
                      style={{ flex: 1 }}
                      placeholder={
                        i === 0 ? 'e.g. Lead my first cross-team project'
                        : i === 1 ? 'e.g. Present roadmap to senior leadership'
                        : 'e.g. Request formal promotion review'
                      }
                      value={goal[key]}
                      onChange={e => setGoal({ ...goal, [key]: e.target.value })}
                    />
                  </div>
                ))}

                <button
                  className="ob-btn"
                  onClick={handleGoalSave}
                  disabled={!step2Valid || saving}
                >
                  {saving ? 'Setting up your plan...' : <>Choose Your Plan <span>→</span></>}
                </button>

                {/* Step back */}
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: "'DM Mono', monospace", fontSize: 11,
                    letterSpacing: '0.06em', color: '#4A4438', textAlign: 'center',
                    marginTop: 4,
                  }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
