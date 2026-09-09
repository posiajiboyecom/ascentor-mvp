'use client';

import { useState, useEffect } from 'react';

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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const duration = 3000;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const pct = Math.min(100, ((ts - start) / duration) * 100);
      setProgress(Math.floor(pct));
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dim = { sm: 44, md: 72, lg: 96 }[size];
  const inset = { sm: 7, md: 11, lg: 15 }[size];

  const messageStyle = {
    fontFamily: 'var(--font-display)',
    fontSize: size === 'sm' ? 10 : 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim, #4A4438)',
    margin: 0,
  };

  const orb = (
    <div style={{ position: 'relative', width: dim, height: dim }}>
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
        position: 'absolute', inset: inset,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 36%, rgba(245,197,90,0.22), rgba(232,160,32,0.09) 60%, transparent)',
        border: '1.5px solid rgba(232,160,32,0.4)',
        animation: 'sage-pulse 2s ease-in-out infinite',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src="/ascentor-LM-gold.svg"
          alt=""
          style={{ width: dim * 0.55, height: dim * 0.55, objectFit: 'contain' }}
        />
      </div>
    </div>
  );

  const fullScreenContent = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: 'min(80vw, 320px)' }}>
      {message !== undefined && (
        <p style={{ ...messageStyle, color: 'var(--text, #FAFAF8)' }}>
          {message || 'Loading…'}
        </p>
      )}
      <div style={{ width: '100%', height: 4, background: 'rgba(200,169,110,0.25)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--accent, #C8A96E)',
          borderRadius: 2,
          transition: 'width 0.05s linear',
        }} />
      </div>
      <p style={{ fontSize: 12, letterSpacing: '0.1em', color: 'var(--accent, #C8A96E)', margin: 0 }}>
        {progress}%
      </p>
    </div>
  );

  const inlineContent = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size === 'sm' ? 10 : 16 }}>
      {orb}
      {message !== undefined && (
        <p style={messageStyle}>
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
          background: 'var(--bg, #0C0B08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {fullScreenContent}
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: size === 'sm' ? '20px 0' : '64px 0',
          width: '100%',
        }}>
          {inlineContent}
        </div>
      )}
    </>
  );
}
