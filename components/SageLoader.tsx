// ─────────────────────────────────────────────────────────────
// SageLoader — Ascentor's universal loading indicator
// The pulsing S-orb used across all pages for consistency.
//
// Usage:
//   import SageLoader from '@/components/SageLoader';
//
//   // Full page (centered vertically):
//   <SageLoader />
//
//   // With custom message:
//   <SageLoader message="Loading your circles..." />
//
//   // Inline / small (no message, smaller orb):
//   <SageLoader size="sm" />
//
//   // Full screen overlay:
//   <SageLoader fullScreen />
// ─────────────────────────────────────────────────────────────

type SageLoaderProps = {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
};

export default function SageLoader({
  message,
  size = 'md',
  fullScreen = false,
}: SageLoaderProps) {
  const dim = { sm: 44, md: 72, lg: 96 }[size];
  const fontSize = { sm: 14, md: 22, lg: 30 }[size];
  const inset = { sm: 7, md: 11, lg: 15 }[size];

  const orb = (
    <div style={{ position: 'relative', width: dim, height: dim }}>
      {/* Ring 1 */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: '1px solid rgba(232,160,32,0.45)',
        animation: 'sage-ring 2s ease-out infinite',
      }} />
      {/* Ring 2 — offset */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: '1px solid rgba(232,160,32,0.25)',
        animation: 'sage-ring 2s ease-out infinite 0.75s',
      }} />
      {/* Core orb */}
      <div style={{
        position: 'absolute', inset: inset,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.22), rgba(232,160,32,0.09) 60%, transparent)',
        border: '1.5px solid rgba(232,160,32,0.4)',
        animation: 'sage-pulse 2s ease-in-out infinite',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontWeight: 700,
          fontSize,
          color: '#E8A020',
          letterSpacing: '-0.5px',
          lineHeight: 1,
          userSelect: 'none',
        }}>S</span>
      </div>
    </div>
  );

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size === 'sm' ? 10 : 16 }}>
      {orb}
      {message !== undefined && (
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: size === 'sm' ? 10 : 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-dim, #4A4438)',
          margin: 0,
        }}>
          {message || (size === 'sm' ? '' : 'Loading…')}
        </p>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes sage-pulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.15); opacity: 0.75; }
        }
        @keyframes sage-ring {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(1.85); opacity: 0; }
        }
      `}</style>

      {fullScreen ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#0C0B08',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {content}
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: size === 'sm' ? '20px 0' : '64px 0',
          width: '100%',
        }}>
          {content}
        </div>
      )}
    </>
  );
}
