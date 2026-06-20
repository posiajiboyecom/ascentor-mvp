'use client';

import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  feature?: 'learn' | 'coaching' | 'community' | 'experts';
  message?: string;
  compact?: boolean;
  onDismiss?: () => void;
}

const FEATURE_MESSAGES: Record<string, { title: string; desc: string; icon: string }> = {
  learn: {
    title: 'Unlock the Full Course Library',
    desc: 'Access expert-curated courses on leadership, management, and career growth tailored for purposeful individuals.',
    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  },
  coaching: {
    title: "You've Used All Your Coaching Sessions This Month",
    desc: "Free accounts get 5 AI coaching sessions per month. Upgrade to Explorer for 30, or Builder for unlimited.",
    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>',
  },
  community: {
    title: 'Join More Cohorts',
    desc: 'Free accounts can join 1 cohort. Upgrade to Explorer for 3, or Builder for unlimited cohorts.',
    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  },
  experts: {
    title: 'Unlock Expert Sessions',
    desc: 'Explorer gets 1 expert session/month. Builder gets 2. Climber gets unlimited access to all sessions.',
    icon: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  },
};

export default function UpgradePrompt({ feature, message, compact, onDismiss }: UpgradePromptProps) {
  const router = useRouter();
  const info = feature ? FEATURE_MESSAGES[feature] : null;

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '10px',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}>
        <span style={{ fontSize: '20px', flexShrink: 0 }}>
          <span dangerouslySetInnerHTML={{ __html: info?.icon || '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #F1F0EB)', fontWeight: 600 }}>
            {message || info?.title || 'Upgrade Required'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted, #8B8A85)' }}>
            {info?.desc || 'Start your  to unlock this feature.'}
          </p>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent, #F59E0B)',
            color: '#000',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Upgrade
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '40px 20px',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card, #12151F)',
        border: '1px solid var(--border, #2A2D3A)',
        borderRadius: '16px',
        padding: '48px 32px',
        maxWidth: '440px',
        width: '100%',
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>
          <span dangerouslySetInnerHTML={{ __html: info?.icon || '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' }} />
        </span>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
          {info?.title || 'Premium Feature'}
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '28px' }}>
          {message || info?.desc || 'This feature requires a subscription.'}
        </p>
        <button
          onClick={() => router.push('/checkout')}
          style={{
            padding: '14px 32px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--accent, #F59E0B)',
            color: '#000',
            fontWeight: 700,
            fontSize: '15px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '12px',
          }}
        >
          Start 7-Day Free Trial
        </button>
        <p style={{ fontSize: '12px', color: 'var(--text-dim, #6B6A65)' }}>
          No charge for 7 days · 
        </p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}
          >
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}

export { UpgradePrompt };
