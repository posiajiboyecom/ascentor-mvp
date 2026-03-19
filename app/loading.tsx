'use client';

import { useEffect, useState } from 'react';

export default function Loading() {
  // Read theme synchronously to avoid flash — same pattern as AppThemeProvider
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Read from html attr (set by blocking script in layout.tsx) or localStorage
    const attr = document.documentElement.getAttribute('data-app-theme');
    if (attr === 'light' || attr === 'dark') {
      setIsDark(attr === 'dark');
    } else {
      const stored = localStorage.getItem('asc-theme');
      setIsDark(stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const bg   = isDark ? '#0C0B08' : '#FAF7F2';
  const ring = isDark ? 'rgba(232,160,32,0.15)' : 'rgba(232,160,32,0.25)';
  const mid  = isDark ? 'rgba(232,160,32,0.25)' : 'rgba(232,160,32,0.4)';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: bg,
      transition: 'background 0.2s',
    }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>

        {/* Outer ring */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: `1px solid ${ring}`,
          animation: 'pulse-ring 2s ease-out infinite',
        }} />

        {/* Middle ring */}
        <div style={{
          position: 'absolute', inset: 8,
          borderRadius: '50%',
          border: `1px solid ${mid}`,
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
