// components/loading.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Inline loading state used inside authenticated pages (e.g. as a client-side
// suspense fallback inside the app shell). CSS variables are available here
// because AppThemeProvider has already mounted and set data-app-theme.
//
// Uses the same Sage-orb animation as SageLoader for consistency.
// ─────────────────────────────────────────────────────────────────────────────

export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      background: 'var(--bg, #FAFAF8)',
    }}>
      {/* Sage orb — matches SageLoader md */}
      <div style={{ position: 'relative', width: 72, height: 72 }}>
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(232,160,32,0.45)',
          animation: 'sage-ring 2s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(232,160,32,0.25)',
          animation: 'sage-ring 2s ease-out infinite 0.75s',
        }} />
        <div style={{
          position: 'absolute', inset: 11,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.22), rgba(232,160,32,0.09) 60%, transparent)',
          border: '1.5px solid rgba(232,160,32,0.4)',
          animation: 'sage-pulse 2s ease-in-out infinite',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-accent, "Playfair Display", Georgia, serif)',
            fontWeight: 700,
            fontSize: 22,
            color: '#E8A020',
            letterSpacing: '-0.5px',
            lineHeight: 1,
            userSelect: 'none',
          }}>S</span>
        </div>
      </div>

      <p style={{
        fontFamily: 'var(--font-display, "Plus Jakarta Sans", system-ui, sans-serif)',
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--text-dim, #6B7280)',
        margin: 0,
      }}>
        Loading…
      </p>

      <style>{`
        @keyframes sage-pulse {
          0%, 100% { transform: scale(1);    opacity: 1;    }
          50%       { transform: scale(1.15); opacity: 0.75; }
        }
        @keyframes sage-ring {
          0%   { transform: scale(1);    opacity: 0.5; }
          100% { transform: scale(1.85); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
