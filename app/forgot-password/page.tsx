'use client';

import { useEffect, useState } from 'react';
import { rememberResetOrigin, signInPathAfterReset } from '@/lib/resetOrigin';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

type ModalState =
  | { type: 'idle' }
  | { type: 'success'; email: string }
  | { type: 'oauth'; provider: string }
  | { type: 'not_found' }
  | { type: 'error'; message: string };

export default function ForgotPasswordPage() {
  const [modal, setModal] = useState<ModalState>({ type: 'idle' });
  const [loading, setLoading] = useState(false);
  const [signInHref, setSignInHref] = useState('/login');

  useEffect(() => {
    rememberResetOrigin();
    setSignInHref(signInPathAfterReset());
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    setLoading(true);
    setModal({ type: 'idle' });

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await res.json();

      if (result.status === 'not_found') {
        setModal({ type: 'not_found' });
      } else if (result.status === 'oauth_only') {
        setModal({ type: 'oauth', provider: result.provider });
      } else if (result.status === 'sent') {
        setModal({ type: 'success', email: data.email });
      } else {
        setModal({ type: 'error', message: result.error || 'Something went wrong. Please try again.' });
      }
    } catch {
      setModal({ type: 'error', message: 'Network error. Please try again.' });
    }
    setLoading(false);
  }

  const closeModal = () => setModal({ type: 'idle' });

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

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }
        .modal {
          background: #FFFFFF;
          border-radius: 16px;
          padding: 32px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          animation: slideUp 0.3s ease;
        }
        .modal-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          font-size: 24px;
        }
        .modal-icon.success { background: rgba(34, 197, 94, 0.1); color: #16A34A; }
        .modal-icon.warning { background: rgba(200, 169, 110, 0.15); color: #92700A; }
        .modal-icon.error { background: rgba(220, 38, 38, 0.08); color: #DC2626; }
        .modal-title {
          font-family: Metropolis;
          font-weight: 800;
          font-size: 1.25rem;
          color: #0F0F0E;
          margin: 0 0 8px;
          lineHeight: 1.2;
        }
        .modal-text {
          font-size: 0.9375rem;
          color: #6B7280;
          line-height: 1.6;
          margin: '0 0 24px';
        }
        .modal-btn {
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
          transition: background 0.15s;
          text-decoration: none;
          display: block;
          text-align: center;
        }
        .modal-btn:hover { background: #2A2A29; }
        .modal-btn.secondary {
          background: transparent;
          color: #0F0F0E;
          border: 1.5px solid #E8E6E1;
          margin-top: 8px;
        }
        .modal-btn.secondary:hover { background: #F4F3EF; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
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
              Forgot your password?
            </h1>
            <p style={{ fontSize: '0.9375rem', color: '#6B7280', margin: '0 0 1.75rem', lineHeight: 1.6 }}>
              No worries. Enter your email and we'll send you a 6-digit reset code.
            </p>

            {/* Gold rule */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #C8A96E 0%, transparent 100%)', borderRadius: '2px', marginBottom: '1.75rem' }} />

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

              <button type="submit" disabled={loading} className="auth-btn" style={{ marginTop: '0.25rem' }}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </form>

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

      {/* Modal */}
      {modal.type !== 'idle' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.type === 'success' && (
              <>
                <div className="modal-icon success">✓</div>
                <h2 className="modal-title">Check your inbox</h2>
                <p className="modal-text">
                  If an account exists for <strong>{modal.email}</strong>, a 6-digit reset code has been sent. Please check your inbox and spam folder. If you signed up with Google or LinkedIn, sign in with that account instead.
                </p>
                <Link href="/reset-password" className="modal-btn" style={{ marginTop: 12 }}>
                  Enter reset code →
                </Link>
              </>
            )}

            {modal.type === 'oauth' && (
              <>
                <div className="modal-icon warning">!</div>
                <h2 className="modal-title">Social account detected</h2>
                <p className="modal-text">
                  You signed up with <strong>{modal.provider}</strong>. Please use your {modal.provider} account to sign in. Password reset is not available for social accounts.
                </p>
                <Link href={signInHref} className="modal-btn">
                  Back to login
                </Link>
              </>
            )}

            {modal.type === 'not_found' && (
              <>
                <div className="modal-icon error">✕</div>
                <h2 className="modal-title">No account found</h2>
                <p className="modal-text">
                  No account exists with that email address. Would you like to create one?
                </p>
                <Link href="/signup" className="modal-btn">
                  Join Ascentor
                </Link>
                <button className="modal-btn secondary" onClick={closeModal} style={{ marginTop: 8 }}>
                  Try another email
                </button>
              </>
            )}

            {modal.type === 'error' && (
              <>
                <div className="modal-icon error">✕</div>
                <h2 className="modal-title">Something went wrong</h2>
                <p className="modal-text">{modal.message}</p>
                <button className="modal-btn" onClick={closeModal}>
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
