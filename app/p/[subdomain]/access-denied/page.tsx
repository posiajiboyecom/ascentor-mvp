'use client';

// ============================================================
// ACCESS DENIED — app/p/[subdomain]/access-denied/page.tsx
//
// Shown when a user tries to access a partner platform but:
//   - reason=not_invited  → email not in partner_members
//   - reason=suspended    → member has been suspended by coach
//   - reason=removed      → member has been removed
//   - reason=no_email     → OAuth account has no email (edge case)
// ============================================================

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const REASONS: Record<string, { icon: string; title: string; desc: string }> = {
  not_invited: {
    icon:  '◎',
    title: 'Invite required',
    desc:  'This platform is invite-only. Ask the coach to add your email to get access.',
  },
  suspended: {
    icon:  '◈',
    title: 'Access suspended',
    desc:  'Your access to this platform has been suspended. Contact the coach if you think this is a mistake.',
  },
  removed: {
    icon:  '⊘',
    title: 'Access removed',
    desc:  'Your access to this platform has been removed.',
  },
  no_email: {
    icon:  '◌',
    title: 'No email on account',
    desc:  'Your sign-in method didn\'t provide an email address. Please sign in with an email-based account.',
  },
};

function AccessDeniedContent() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const supabase     = createClient();

  const subdomain = params.subdomain as string;
  const reason    = searchParams.get('reason') || 'not_invited';
  const config    = REASONS[reason] || REASONS.not_invited;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, textAlign: 'center',
      }}>

        {/* Icon */}
        <div style={{
          fontSize: 48, color: 'var(--accent)', opacity: 0.35,
          marginBottom: 24,
          fontFamily: 'var(--font-heading)',
        }}>
          {config.icon}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(22px, 4vw, 28px)',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 12,
          lineHeight: 1.2,
        }}>
          {config.title}
        </h1>

        {/* Description */}
        <p style={{
          fontSize: 14,
          color: 'var(--text-dim)',
          lineHeight: 1.7,
          marginBottom: 32,
          maxWidth: 320,
          margin: '0 auto 32px',
        }}>
          {config.desc}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          {reason === 'not_invited' && (
            <Link
              href="/login"
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: 'var(--accent)', color: '#000',
                fontSize: 13, fontWeight: 700, textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Try a different account →
            </Link>
          )}

          <button
            onClick={handleSignOut}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>

        {/* Partner home link */}
        <div style={{ marginTop: 40 }}>
          <Link
            href="/"
            style={{
              fontSize: 12,
              color: 'var(--text-dim)',
              textDecoration: 'none',
              opacity: 0.6,
            }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</p>
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
