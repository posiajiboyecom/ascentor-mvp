// components/TierUpgradeModal.tsx
// ============================================================
// Shown when a user taps locked content (event, course, community).
// Displays the required plan and a CTA to upgrade.
// Triggered by all three content pages — zero prop drilling needed.
// ============================================================

'use client'

import { useRouter } from 'next/navigation'
import { TIER_META, type PlanTier } from '@/lib/planTier'

interface Props {
  requiredTier: PlanTier
  contentType:  'event' | 'course' | 'community'
  contentName?: string
  onClose:      () => void
}

export default function TierUpgradeModal({ requiredTier, contentType, contentName, onClose }: Props) {
  const router = useRouter()
  const meta   = TIER_META[requiredTier]

  const typeLabel: Record<Props['contentType'], string> = {
    event:     'expert event',
    course:    'course',
    community: 'community circle',
  }

  const actionLabel: Record<Props['contentType'], string> = {
    event:     'register for',
    course:    'access',
    community: 'join',
  }

  function handleUpgrade() {
    onClose()
    router.push(`/checkout?required=${requiredTier}&reason=content_locked`)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          100,
        background:      'rgba(12,11,8,0.82)',
        backdropFilter:  'blur(6px)',
        display:         'flex',
        alignItems:      'flex-end',
        justifyContent:  'center',
        padding:         '0 0 env(safe-area-inset-bottom)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:           '100%',
          maxWidth:        560,
          background:      'var(--bg-card, #141310)',
          borderRadius:    '20px 20px 0 0',
          border:          `1px solid ${meta.border}`,
          borderBottom:    'none',
          padding:         '28px 24px 36px',
          animation:       'slide-up 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <style>{`
          @keyframes slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border, rgba(255,255,255,0.1))', margin: '0 auto 24px' }} />

        {/* Lock icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: meta.bg, border: `1px solid ${meta.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize:   26,
          fontWeight: 700,
          color:      'var(--text, #D4CFC3)',
          marginBottom: 10,
          lineHeight: 1.15,
        }}>
          {meta.label} plan required
        </h2>

        {/* Description */}
        <p style={{
          fontFamily:   "'Syne', system-ui, sans-serif",
          fontSize:     14,
          color:        'var(--text-muted, #7A7260)',
          lineHeight:   1.65,
          marginBottom: 24,
        }}>
          {contentName
            ? <>To {actionLabel[contentType]} <strong style={{ color: 'var(--text, #D4CFC3)' }}>{contentName}</strong>, you need the <strong style={{ color: meta.color }}>{meta.label}</strong> plan or above.</>
            : <>This {typeLabel[contentType]} requires the <strong style={{ color: meta.color }}>{meta.label}</strong> plan or above.</>
          }
          {' '}Higher plans include all lower-tier content too.
        </p>

        {/* Plan badge */}
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          8,
          padding:      '6px 14px',
          borderRadius: 100,
          background:   meta.bg,
          border:       `1px solid ${meta.border}`,
          marginBottom: 24,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
          <span style={{
            fontFamily:    "'DM Mono', monospace",
            fontSize:      11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         meta.color,
          }}>
            {meta.label} and above
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          style={{
            width:        '100%',
            padding:      '14px 0',
            borderRadius: 12,
            border:       'none',
            background:   meta.color,
            color:        requiredTier === 'builder' ? '#0C0B08' : '#fff',
            fontFamily:   "'Syne', system-ui, sans-serif",
            fontSize:     14,
            fontWeight:   700,
            cursor:       'pointer',
            marginBottom: 10,
            letterSpacing: '0.02em',
          }}
        >
          Upgrade to {meta.label}
        </button>

        {/* Dismiss */}
        <button
          onClick={onClose}
          style={{
            width:      '100%',
            padding:    '10px 0',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            fontFamily: "'DM Mono', monospace",
            fontSize:   11,
            letterSpacing: '0.08em',
            color:      'var(--text-muted, #7A7260)',
            textTransform: 'uppercase',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
