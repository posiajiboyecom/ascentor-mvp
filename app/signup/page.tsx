'use client';

// ============================================================
// FILE: app/signup/page.tsx
//
// FLOW (onboarding is NEVER skipped):
//   Free plan:  signup → /onboarding?next=/dashboard
//   Paid plan:  signup → /onboarding?next=/checkout?plan=X
//
// The onboarding page reads the `next` param and redirects
// there after the user completes their profile setup.
// ============================================================

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan') || 'free';
  const isPaidPlan = ['explorer', 'builder'].includes(planParam);

  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const supabase = createClient();

    // 1. Create auth account
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // 2. Seed the profiles row (handles cases where DB trigger isn't set up)
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        subscription_plan: 'free',
        subscription_status: 'inactive',
        onboarding_completed: false,   // ← key flag used by middleware & onboarding page
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Always go to onboarding first — pass the intended destination as `next`
    //    Onboarding page reads `next` and redirects there on completion.
    const nextDestination = isPaidPlan
      ? `/checkout?plan=${planParam}`
      : `/dashboard`;

    router.push(`/onboarding?next=${encodeURIComponent(nextDestination)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-3xl mb-3">⬆</div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
            >
              Create your account
            </h1>
            {isPaidPlan ? (
              <p className="text-sm mt-2" style={{ color: 'var(--teal, #14b8a6)' }}>
                Signing up for the{' '}
                <strong>{planParam.charAt(0).toUpperCase() + planParam.slice(1)}</strong> plan
                — 7-day free trial included.
              </p>
            ) : (
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                Free forever. Upgrade any time.
              </p>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {[
              { label: 'Full name', value: fullName, setter: setFullName, type: 'text', placeholder: 'Your full name' },
              { label: 'Email address', value: email, setter: setEmail, type: 'email', placeholder: 'you@example.com' },
              { label: 'Password', value: password, setter: setPassword, type: 'password', placeholder: 'Min. 8 characters' },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label}>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  disabled={loading}
                  className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition"
                  style={{
                    background: 'var(--input-bg, rgba(255,255,255,0.05))',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            ))}

            {error && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171' }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2"
              style={{
                background: loading ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
                color: loading ? 'var(--text-muted)' : '#000',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? 'Creating account...'
                : isPaidPlan
                ? 'Create account & set up profile →'
                : 'Create free account →'}
            </button>
          </div>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link
              href={`/login${isPaidPlan ? `?plan=${planParam}` : ''}`}
              style={{ color: 'var(--accent)', textDecoration: 'underline' }}
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
