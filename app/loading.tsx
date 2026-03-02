export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0C0B08',
    }}>
      {/* Sage-style pulsing orb — matches SageLoader brand */}
      <div style={{ position: 'relative', width: 56, height: 56 }}>

        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '1px solid rgba(232,160,32,0.15)',
          animation: 'pulse-ring 2s ease-out infinite',
        }} />

        {/* Middle ring */}
        <div style={{
          position: 'absolute', inset: 8,
          borderRadius: '50%',
          border: '1px solid rgba(232,160,32,0.25)',
          animation: 'pulse-ring 2s ease-out infinite 0.4s',
        }} />

        {/* Inner S monogram */}
        <div style={{
          position: 'absolute', inset: 16,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #E8A020, #B9760A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 11, fontWeight: 700, color: '#0C0B08',
          }}>S</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          60%  { transform: scale(1.4); opacity: 0.1; }
          100% { transform: scale(1.4); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
