'use client';

import { useRouter } from 'next/navigation';

// ============================================================
// UPGRADE PROMPT — Reusable component for paywalls
// Shows when free users hit limits or try to access paid features.
// Use as: <UpgradePrompt feature="learn" /> or <UpgradePrompt message="..." />
// ============================================================

interface UpgradePromptProps {
  feature?: 'learn' | 'coaching' | 'community' | 'export' | 'analytics';
  message?: string;
  compact?: boolean; // inline vs full-page
  onDismiss?: () => void;
}

const FEATURE_MESSAGES: Record<string, { title: string; desc: string; icon: string }> = {
  learn: {
    title: 'Unlock the Full Course Library',
    desc: 'Access expert-curated courses on leadership, management, and career growth tailored for African professionals.',
    icon: '📚',
  },
  coaching: {
    title: "You've Reached Today's Coaching Limit",
    desc: "Free accounts get 10 coaching sessions per day. Upgrade for more.",
    icon: '🤖',
  },
  community: {
    title: 'Join More Communities',
    desc: 'Free accounts can join up to 3 communities. Upgrade to connect with unlimited cohorts.',
    icon: '👥',
  },
  export: {
    title: 'Export Your Data',
    desc: 'Download your coaching history, session notes, and progress reports.',
    icon: '📥',
  },
  analytics: {
    title: 'Advanced Analytics',
    desc: 'Track your leadership growth with detailed insights and progress dashboards.',
    icon: '📊',
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
        <span style={{ fontSize: '20px', flexShrink: 0 }}>{info?.icon || '⭐'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text, #F1F0EB)', fontWeight: 600 }}>
            {message || info?.title || 'Upgrade Required'}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted, #8B8A85)' }}>
            {info?.desc || 'Start your 7-day free trial to unlock this feature.'}
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

  // Full-page prompt
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
          {info?.icon || '🔒'}
        </span>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '8px',
        }}>
          {info?.title || 'Premium Feature'}
        </h2>
        <p style={{
          fontSize: '15px',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}>
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
          No charge for 7 days · Cancel anytime
        </p>

        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              marginTop: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}

// Hook for checking subscription in components
export { UpgradePrompt };
