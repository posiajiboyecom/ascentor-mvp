'use client';

// ============================================================
// FILE: app/onboarding/page.tsx
//
// This replaces or augments your existing onboarding page.
// KEY ADDITION: reads ?next= param so it knows where to send
// the user after they finish — either /dashboard or /checkout?plan=X
//
// On completion:
//   1. Saves profile fields to Supabase
//   2. Sets onboarding_completed = true
//   3. Redirects to the `next` destination
//
// If you already have a multi-step onboarding UI, just replace
// the handleComplete function and the router.push at the end.
// ============================================================

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Onboarding steps ─────────────────────────────────────────
const STEPS = [
  {
    id: 'role',
    question: "What's your current role?",
    field: 'current_role',
    placeholder: 'e.g. Product Manager, Engineer, Consultant...',
    type: 'text',
  },
  {
    id: 'industry',
    question: 'Which industry are you in?',
    field: 'industry',
    placeholder: 'e.g. Banking, Tech, Oil & Gas, Healthcare...',
    type: 'text',
  },
  {
    id: 'goal_role',
    question: "What's the role you're working towards?",
    field: 'goal_role',
    placeholder: 'e.g. VP of Engineering, CEO, Director of Strategy...',
    type: 'text',
  },
  {
    id: 'biggest_challenge',
    question: "What's your biggest career challenge right now?",
    field: 'biggest_challenge',
    placeholder: 'Be honest — this helps your AI coach understand you deeply.',
    type: 'textarea',
  },
];

export default function OnboardingPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();

  // Where to go after onboarding — default to dashboard
  const nextPath = searchParams.get('next') || '/dashboard';

  const [step, setStep]       = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const currentStep = STEPS[step];
  const currentValue = answers[currentStep.field] || '';
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (!currentValue.trim()) {
      setError('Please answer this question before continuing.');
      return;
    }
    setError('');
    if (isLast) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    // Save all answers + mark onboarding done
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        ...Object.fromEntries(
          STEPS.map((s) => [s.field, answers[s.field] || ''])
        ),
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (saveError) {
      console.error('Onboarding save error:', saveError);
      setError('Failed to save your profile. Please try again.');
      setSaving(false);
      return;
    }

    // Redirect to wherever the user was heading (checkout or dashboard)
    router.push(nextPath);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span>Setting up your profile</span>
            <span>{step + 1} of {STEPS.length}</span>
          </div>
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-center mb-8">
            <div className="text-3xl mb-3">⬆</div>
            <h1
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
            >
              {currentStep.question}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              This helps your AI coach personalise every session for you.
            </p>
          </div>

          {/* Input */}
          {currentStep.type === 'textarea' ? (
            <textarea
              value={currentValue}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [currentStep.field]: e.target.value }))
              }
              placeholder={currentStep.placeholder}
              rows={4}
              disabled={saving}
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition resize-none mb-4"
              style={{
                background: 'var(--input-bg, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          ) : (
            <input
              type="text"
              value={currentValue}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [currentStep.field]: e.target.value }))
              }
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              placeholder={currentStep.placeholder}
              disabled={saving}
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition mb-4"
              style={{
                background: 'var(--input-bg, rgba(255,255,255,0.05))',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          )}

          {error && (
            <div
              className="rounded-lg p-3 mb-4 text-sm"
              style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={saving}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: saving ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
              color: saving ? 'var(--text-muted)' : '#000',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : isLast ? 'Complete setup →' : 'Continue →'}
          </button>

          {/* Skip option — goes to next destination but marks onboarding done */}
          {!saving && (
            <button
              onClick={async () => {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase
                    .from('profiles')
                    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
                    .eq('id', user.id);
                }
                router.push(nextPath);
              }}
              className="w-full text-center text-xs mt-4 transition-colors"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Skip for now →
            </button>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          You can update these answers anytime in your profile settings.
        </p>
      </div>
    </div>
  );
}
