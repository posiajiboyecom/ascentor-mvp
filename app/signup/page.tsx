'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
// Added new components
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0D17' }}>
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refCode = searchParams.get('ref');
  const [referralBanner, setReferralBanner] = useState('');

  useEffect(() => {
    if (refCode) {
      localStorage.setItem('ascentor_referral', refCode.toUpperCase());
      setReferralBanner(refCode.toUpperCase());
    } else {
      const stored = localStorage.getItem('ascentor_referral');
      if (stored) setReferralBanner(stored);
    }
  }, [refCode]);

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (error) {
      setError(error.message);
    } else {
      router.push('/checkout');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#0B0D17' }}>
      <div className="w-full max-w-md space-y-8">

        {referralBanner && (
          <div className="rounded-lg px-4 py-3 text-center"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
            <p className="text-sm font-semibold" style={{ color: '#10B981' }}>
              🎁 You've been referred!
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6EE7B7' }}>
              Sign up and you both get 7 extra days free.
            </p>
          </div>
        )}

        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Join Ascentor</h2>
          <p className="text-gray-400">Start your leadership journey.</p>
        </div>

        {/* Simplified OAuth Section */}
        <div className="space-y-3">
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="linkedin_oidc" onError={setError} />
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">or sign up with email</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 rounded-lg bg-[#141724] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          
          {/* Password Input with Strength Meter enabled */}
          <div>
            <PasswordInput 
              value={password} 
              onChange={setPassword} 
              showStrength={true} 
              placeholder="Create a password" 
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-black font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#F59E0B' }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}