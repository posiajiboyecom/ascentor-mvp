'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Added new components
import PasswordInput from '@/components/PasswordInput';
import { OAuthButton } from '@/lib/sso';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Email & Password Log In ---
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      // Feature #6: Security check on email login
      try {
        const res = await fetch('/api/auth/security-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.session?.user.id }),
        });
        const check = await res.json();
        if (!check.allowed) {
          await supabase.auth.signOut();
          setError(check.message);
          setLoading(false);
          return;
        }
      } catch {} // Non-critical — don't block login if check fails

      router.push('/dashboard'); 
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#0B0D17' }}>
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400">Log in to continue.</p>
        </div>

        {/* Updated OAuth Buttons using the SSO Library */}
        <div className="space-y-3">
          <OAuthButton provider="google" onError={setError} />
          <OAuthButton provider="linkedin_oidc" onError={setError} />
        </div>

        {/* Divider */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink-0 mx-4 text-gray-500 text-sm">or log in with email</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
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
          
          {/* Replaced standard input with the new Password toggle component */}
          <div>
            <PasswordInput 
              value={password} 
              onChange={setPassword} 
              placeholder="Enter your password" 
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
            {loading ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <Link href="/signup" className="text-amber-500 hover:text-amber-400 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}