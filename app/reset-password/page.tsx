'use client';

import { useEffect, useState } from 'react';
import { signInPathAfterReset } from '@/lib/resetOrigin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';
import { PASSWORD_MIN } from '@/lib/auth/password-policy';

const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  otp_code: z
    .string()
    .min(6, 'Reset code must be 6 digits')
    .max(6, 'Reset code must be 6 digits')
    .regex(/^\d{6}$/, 'Reset code must contain only numbers'),
  password: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm: z
    .string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signInHref, setSignInHref] = useState('/login');

  useEffect(() => { setSignInHref(signInPathAfterReset()); }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  async function onSubmit(data: ResetPasswordFormData) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          otp_code: data.otp_code,
          new_password: data.password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to reset password');
      } else {
        setSuccess(true);
        setTimeout(() => router.push(signInPathAfterReset()), 2500);
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #FAFAF8 !important; color: #0F0F0E !important; }

        .auth-split {
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1fr;
          background: #FAFAF8;
        }
        @media (min-width: 1024px) {
          .auth-split { grid-template-columns: 1fr 1fr; }
        }

        .auth-image {
          display: none;
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
        }
        .auth-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          inset: 0;
        }
        .auth-image::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(15, 15, 14, 0.15) 0%, rgba(15, 15, 14, 0.55) 100%);
          pointer-events: none;
        }
        @media (min-width: 1024px) { .auth-image { display: block; } }

        .auth-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #FAFAF8;
        }
        .auth-form-inner {
          width: 100%;
          max-width: 420px;
        }

        .auth-input {
          width: 100%;
          padding: 0.875rem 1rem;
          background: #FFFFFF;
          border: 1.5px solid #E8E6E1;
          border-radius: 0.625rem;
          color: #0F0F0E;
          font-family: Metropolis;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .auth-input::placeholder { color: #9CA3AF; }
        .auth-input:focus { border-color: #C8A96E; }
        .auth-input.error { border-color: #DC2626; }

        .auth-btn {
          width: 100%;
          padding: 0.875rem;
          border-radius: 0.625rem;
          border: none;
          cursor: pointer;
          background: #0F0F0E;
          color: #FAFAF8;
          font-family: Metropolis;
          font-size: 1rem;
          font-weight: 700;
          transition: background 0.15s, opacity 0.15s;
        }
        .auth-btn:hover:not(:disabled) { background: #2A2A29; }
        .auth-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .field-error {
          color: #DC2626;
          font-size: 0.8125rem;
          margin-top: 0.375rem;
          line-height: 1.4;
        }

        .auth-error {
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: rgba(220,38,38,0.05);
          border: 1px solid rgba(220,38,38,0.2);
          color: #DC2626;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .auth-success {
          padding: 0.875rem 1rem;
          border-radius: 0.5rem;
          background: rgba(34,197,94,0.05);
          border: 1px solid rgba(34,197,94,0.2);
          color: #16A34A;
          font-size: 0.875rem;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .otp-input {
          text-align: center;
          font-family: Metropolis, 'Inter', sans-serif;
          font-size: 1.5rem;
          letter-spacing: 0.5em;
        }
      `}</style>

      <div className="auth-split">
        {/* Left: Image */}
        <div className="auth-image">
          <img src="/images/login-hero.jpg" alt="" />
        </div>

        {/* Right: Form */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {/* Mobile logo */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 24, width: 'auto' }} />
              </Link>
            </div>

            <h1 style={{
              fontFamily: 'Metropolis',
              fontWeight: 800,
              fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
              color: '#0F0F0E',
              margin: '0 0 0.375rem',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}>
              Choose a new password.
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              Enter the reset code sent to your email, then choose a new password.
            </p>

            {/* Gold rule */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #C8A96E 0%, transparent 100%)', borderRadius: '2px', marginBottom: '1.75rem' }} />

            {success ? (
              <div className="auth-success">
                Password updated successfully. Redirecting you to login...
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="Email address"
                    className={`auth-input ${errors.email ? 'error' : ''}`}
                    disabled={loading}
                  />
                  {errors.email && <p className="field-error">{errors.email.message}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    {...register('otp_code')}
                    placeholder="6-digit reset code"
                    className={`auth-input otp-input ${errors.otp_code ? 'error' : ''}`}
                    maxLength={6}
                    disabled={loading}
                  />
                  {errors.otp_code && <p className="field-error">{errors.otp_code.message}</p>}
                </div>
                <div>
                  <PasswordInput
                    {...register('password')}
                    placeholder="New password (min 10 chars)"
                    className={errors.password ? 'error' : ''}
                  />
                  {errors.password && <p className="field-error">{errors.password.message}</p>}
                </div>
                <div>
                  <PasswordInput
                    {...register('confirm')}
                    placeholder="Confirm new password"
                    className={errors.confirm ? 'error' : ''}
                  />
                  {errors.confirm && <p className="field-error">{errors.confirm.message}</p>}
                </div>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" disabled={loading} className="auth-btn" style={{ marginTop: '0.25rem' }}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}

            {/* Back to login */}
            <div style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #E8E6E1',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
                Remember your password?{' '}
                <Link href={signInHref} style={{ color: '#C8A96E', fontWeight: 700, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
