'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const [step, setStep]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [checking, setChecking] = useState(true); // FIX 4 — resume-check loading state
  const [error, setError]     = useState('');     // FIX 1 — inline errors, not alert()
  const router  = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState({
    full_name:          '',
    current_role:       '',
    industry:           '',
    goal_role:          '',
    biggest_challenge:  '',
    time_commitment:    '15min',
  });

  const [goal, setGoal] = useState({
    goal_text:   '',
    milestone_1: '',
    milestone_2: '',
    milestone_3: '',
  });

  const industries = [
    'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
    'Education', 'Energy', 'Telecom', 'Government', 'NGO', 'Other',
  ];

  // ─────────────────────────────────────────────────────────
  // FIX 4 — On mount: check if onboarding already completed
  // or if step 1 was already saved so we can resume at step 2.
  // This is the PRIMARY fix for post-payment abandonment.
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const checkResume = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Not logged in — send to login
        router.replace('/login');
        return;
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('onboarding_completed, full_name, current_role, industry, goal_role, biggest_challenge')
        .eq('id', user.id)
        .single();

      if (existingProfile?.onboarding_completed) {
        // Already done — skip onboarding entirely, go to dashboard
        router.replace('/dashboard');
        return;
      }

      // Resume at step 2 if step 1 fields are already filled
      if (
        existingProfile?.full_name &&
        existingProfile?.current_role &&
        existingProfile?.industry
      ) {
        // Pre-fill what we have and jump to goal step
        setProfile(prev => ({ ...prev, ...existingProfile }));
        setStep(2);
      }

      setChecking(false);
    };

    checkResume();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────
  // STEP 1 SAVE — Profile
  // FIX 1: setSaving(true/false) correctly
  // FIX 2: inline error display instead of alert()
  // ─────────────────────────────────────────────────────────
  const handleProfileSave = async () => {
    setError('');
    setSaving(true); // FIX 1 — was missing entirely

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('Session expired. Please refresh the page and try again.');
        return;
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id:         user.id,
          ...profile,
          updated_at: new Date().toISOString(),
          // NOTE: onboarding_completed is intentionally NOT set here yet —
          // only set true after step 2 so partial saves don't mark as complete
        });

      if (dbError) {
        console.error('[onboarding] Profile upsert failed:', dbError);
        setError('Failed to save your profile. Please try again.');
        return;
      }

      setStep(2);
    } finally {
      setSaving(false); // FIX 1 — always reset, even on error
    }
  };

  // ─────────────────────────────────────────────────────────
  // STEP 2 SAVE — Goal + mark onboarding complete
  // FIX 3: setSaving(false) on success path
  // FIX 5: onboarding_completed = true written here
  // ─────────────────────────────────────────────────────────
  const handleGoalSave = async () => {
    setError('');
    setSaving(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('Session expired. Please refresh and try again.');
        return;
      }

      // Save the 90-day goal
      const { error: goalError } = await supabase.from('user_goals').insert({
        user_id:     user.id,
        goal_text:   goal.goal_text,
        timeframe:   '90 days',
        milestone_1: goal.milestone_1,
        milestone_2: goal.milestone_2,
        milestone_3: goal.milestone_3,
      });

      if (goalError) {
        console.error('[onboarding] Goal insert failed:', goalError);
        setError('Failed to save your goal. Please try again.');
        return;
      }

      // FIX 5 — Mark onboarding as complete on the profile.
      // This is the critical flag that unlocks the dashboard
      // and prevents the post-payment redirect loop.
      const { error: completeError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed:    true,
          onboarding_completed_at: new Date().toISOString(),
          updated_at:              new Date().toISOString(),
        })
        .eq('id', user.id);

      if (completeError) {
        // Non-fatal — goal is saved, log the error but continue.
        // User can still use the product; we can fix the flag manually.
        console.error('[onboarding] Failed to mark onboarding_completed:', completeError);
      }

      // Apply waitlist referral code if present (non-blocking)
      try {
        const storedRef = localStorage.getItem('ascentor_referral');
        if (storedRef) {
          await fetch('/api/referral', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ referralCode: storedRef }),
          });
          localStorage.removeItem('ascentor_referral');
        }
      } catch (refErr) {
        console.warn('[onboarding] Referral application failed (non-blocking):', refErr);
      }

      // FIX 3 — setSaving(false) before navigation so button resets
      setSaving(false);
      router.push('/dashboard');

    } catch (err) {
      console.error('[onboarding] Unexpected error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false); // FIX 3 — always reset
    }
  };

  // ─────────────────────────────────────────────────────────
  // Loading screen while we check resume state
  // ─────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // STEP 1 — Profile
  // ─────────────────────────────────────────────────────────
  if (step === 1) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6 py-12">
      <div className="w-full max-w-md">

        {/* Progress bar */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 h-1 rounded bg-amber-500" />
          <div className="flex-1 h-1 rounded bg-gray-800" />
        </div>
        <p className="text-xs text-gray-500 mb-8">Step 1 of 2</p>

        <h2 className="text-2xl font-bold text-white mb-2">Tell us about you</h2>
        <p className="text-gray-400 text-sm mb-6">
          This helps us personalise your AI mentor and match you with the right circles.
        </p>

        {/* Inline error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <input
            placeholder="Full Name"
            value={profile.full_name}
            onChange={e => setProfile({ ...profile, full_name: e.target.value })}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 transition-colors"
          />
          <input
            placeholder="Current Role (e.g. Software Engineer)"
            value={profile.current_role}
            onChange={e => setProfile({ ...profile, current_role: e.target.value })}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 transition-colors"
          />
          <select
            value={profile.industry}
            onChange={e => setProfile({ ...profile, industry: e.target.value })}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 transition-colors"
          >
            <option value="">Select Industry</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input
            placeholder="Goal Role (e.g. Engineering Manager)"
            value={profile.goal_role}
            onChange={e => setProfile({ ...profile, goal_role: e.target.value })}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 transition-colors"
          />
          <textarea
            placeholder="What's your biggest professional challenge right now?"
            value={profile.biggest_challenge}
            onChange={e => setProfile({ ...profile, biggest_challenge: e.target.value })}
            rows={3}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 resize-none transition-colors"
          />
          <button
            onClick={handleProfileSave}
            disabled={
              saving ||
              !profile.full_name.trim() ||
              !profile.current_role.trim() ||
              !profile.industry ||
              !profile.goal_role.trim()
            }
            className="p-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" /> Saving...</>
              : 'Continue →'
            }
          </button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────
  // STEP 2 — 90-Day Goal
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6 py-12">
      <div className="w-full max-w-md">

        {/* Progress bar */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 h-1 rounded bg-amber-500" />
          <div className="flex-1 h-1 rounded bg-amber-500" />
        </div>
        <p className="text-xs text-gray-500 mb-8">Step 2 of 2 — Almost there!</p>

        <h2 className="text-2xl font-bold text-white mb-2">Your 90-Day Goal</h2>
        <p className="text-gray-400 text-sm mb-6">
          Set a clear goal and your AI mentor will keep you accountable to it every session.
        </p>

        {/* Inline error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950 border border-red-800 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <textarea
            placeholder="e.g. Get promoted to Engineering Manager"
            value={goal.goal_text}
            onChange={e => setGoal({ ...goal, goal_text: e.target.value })}
            rows={2}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 resize-none transition-colors"
          />

          <div>
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
              3 Milestones to get there
            </p>
            <div className="flex flex-col gap-3">
              {(['milestone_1', 'milestone_2', 'milestone_3'] as const).map((key, i) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <input
                    placeholder={`Milestone ${i + 1}`}
                    value={goal[key]}
                    onChange={e => setGoal({ ...goal, [key]: e.target.value })}
                    className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Back link */}
          <button
            onClick={() => { setError(''); setStep(1); }}
            className="text-gray-600 text-sm hover:text-gray-400 transition-colors text-left"
          >
            ← Back to profile
          </button>

          <button
            onClick={handleGoalSave}
            disabled={saving || !goal.goal_text.trim()}
            className="p-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" /> Setting up your dashboard...</>
              : 'Start Coaching →'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
