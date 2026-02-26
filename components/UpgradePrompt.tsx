'use client';

import { useRouter } from 'next/navigation';

interface UpgradePromptProps {
  feature?: 'learn' | 'coaching' | 'community' | 'export' | 'analytics';
  message?: string;
  compact?: boolean;
  onDismiss?: () => void;
}

// Each feature gets its own color from the Ascentor brand palette
const FEATURE_CONFIG: Record<string, {
  title: string; desc: string; icon: string;
  color: string; glow: string; btnText: string; btnTextColor: string;
}> = {
  learn: {
    title: 'Unlock the Full Course Library',
    desc: 'Access expert-curated courses on leadership, management, and career growth tailored for African professionals.',
    icon: '📚',
    color: '#A6A2FF',          // maximum blue purple
    glow: 'rgba(166,162,255,0.1)',
    btnText: 'Unlock Courses',
    btnTextColor: '#0F0F14',
  },
  coaching: {
    title: "You've Reached Today's Coaching Limit",
    desc: 'Free accounts get 10 coaching sessions per day. Upgrade for unlimited access to your AI coach.',
    icon: '🤖',
    color: '#6662FF',          // primary brand blue
    glow: 'rgba(102,98,255,0.12)',
    btnText: 'Upgrade Now',
    btnTextColor: '#fff',
  },
  community: {
    title: 'Join More Cohorts',
    desc: 'Free accounts can join up to 3 communities. Upgrade to connect with unlimited cohorts and grow your network.',
    icon: '👥',
    color: '#FD81FD',          // fuchsia pink
    glow: 'rgba(253,129,253,0.1)',
    btnText: 'Join More Cohorts',
    btnTextColor: '#0F0F14',
  },
  export: {
    title: 'Export Your Data',
    desc: 'Download your coaching history, session notes, and progress reports in one click.',
    icon: '📥',
    color: '#CFFF5E',          // lime green
    glow: 'rgba(207,255,94,0.1)',
    btnText: 'Enable Exports',
    btnTextColor: '#0F0F14',
  },
  analytics: {
    title: 'Advanced Analytics',
    desc: 'Track your leadership growth with detailed insights, trend lines, and personal progress dashboards.',
    icon: '📊',
    color: '#14B8A6',          // teal
    glow: 'rgba(20,184,166,0.1)',
    btnText: 'Unlock Analytics',
    btnTextColor: '#0F0F14',
  },
};

const DEFAULT_CONFIG = {
  title: 'Premium Feature',
  desc: 'This feature is available on the Pro plan.',
  icon: '🔒',
  color: '#6662FF',
  glow: 'rgba(102,98,255,0.12)',
  btnText: 'Start Free Trial',
  btnTextColor: '#fff',
};

export default function UpgradePrompt({ feature, message, compact, onDismiss }: UpgradePromptProps) {
  const router = useRouter();
  const cfg = feature ? FEATURE_CONFIG[feature] : DEFAULT_CONFIG;

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 12,
        background: cfg.glow,
        border: `1px solid ${cfg.color}28`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${cfg.color}18`, fontSize: 18,
        }}>
          {cfg.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700,
            color: 'var(--text)', fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {message || cfg.title}
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)',
            fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
          }}>
            {cfg.desc}
          </p>
        </div>
        <button
          onClick={() => router.push('/checkout')}
          style={{
            padding: '8px 16px', borderRadius: 9, border: 'none',
            background: cfg.color, color: cfg.btnTextColor,
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
            flexShrink: 0, transition: 'opacity 0.18s',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.85'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '1'; }}
        >
          Upgrade
        </button>
      </div>
    );
  }

  // Full-page prompt
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', padding: '40px 20px', textAlign: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${cfg.color}22`,
        borderRadius: 22, padding: '48px 36px', maxWidth: 440, width: '100%',
        boxShadow: `0 24px 64px rgba(0,0,0,0.3), 0 0 0 1px ${cfg.color}10`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow orbs */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 160, height: 160,
          borderRadius: '50%', background: cfg.glow, filter: 'blur(50px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40, width: 100, height: 100,
          borderRadius: '50%', background: cfg.glow, filter: 'blur(40px)', pointerEvents: 'none',
        }} />

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 18, margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${cfg.color}18`,
          border: `1px solid ${cfg.color}30`,
          fontSize: 32, position: 'relative',
        }}>
          {cfg.icon}
          {/* Decorative ring */}
          <div style={{
            position: 'absolute', inset: -6, borderRadius: 24,
            border: `1px solid ${cfg.color}15`,
          }} />
        </div>

        <h2 style={{
          fontSize: 21, fontWeight: 800, color: 'var(--text)', marginBottom: 10,
          fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.3,
        }}>
          {cfg.title}
        </h2>
        <p style={{
          fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7,
          marginBottom: 28, fontFamily: 'Inter, sans-serif',
        }}>
          {message || cfg.desc}
        </p>

        {/* CTA button */}
        <button
          onClick={() => router.push('/checkout')}
          style={{
            padding: '13px 32px', borderRadius: 12, border: 'none',
            background: cfg.color, color: cfg.btnTextColor,
            fontWeight: 800, fontSize: 15, cursor: 'pointer', width: '100%',
            marginBottom: 10, fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: `0 6px 24px ${cfg.color}40`,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.transform = 'translateY(-1px)';
            (e.target as HTMLElement).style.boxShadow = `0 10px 32px ${cfg.color}55`;
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.transform = 'translateY(0)';
            (e.target as HTMLElement).style.boxShadow = `0 6px 24px ${cfg.color}40`;
          }}
        >
          {cfg.btnText}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Inter, sans-serif' }}>
          7-day free trial · No card required · Cancel anytime
        </p>

        {onDismiss && (
          <button onClick={onDismiss} style={{
            display: 'block', margin: '12px auto 0',
            background: 'none', border: 'none',
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}>
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}

export { UpgradePrompt };
