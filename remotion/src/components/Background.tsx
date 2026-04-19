// ═══════════════════════════════════════════════════════════
// Cinematic background layer:
// - base color from theme
// - slow-drifting radial amber glow (off-screen, subtle)
// - vertical vignette
// - SVG grain overlay for texture
// ═══════════════════════════════════════════════════════════
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { themeColors, PALETTE } from '../utils/palette';

interface Props {
  theme: 'dark' | 'light';
}

export const Background: React.FC<Props> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const t = frame / fps;

  const c = themeColors(theme);

  // Glow position drifts diagonally over the full video duration
  const progress = frame / Math.max(1, durationInFrames);
  const glowX = 50 + Math.sin(progress * Math.PI) * 25;
  const glowY = 30 + progress * 40;

  return (
    <AbsoluteFill>
      {/* Base */}
      <AbsoluteFill style={{ background: c.bg }} />

      {/* Amber radial glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${glowX}% ${glowY}%, ${c.accentSoft} 0%, transparent 70%)`,
        }}
      />

      {/* Vertical vignette — darker at edges, clearer in the middle */}
      <AbsoluteFill
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)'
              : 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.08) 100%)',
        }}
      />

      {/* Subtle grain texture — SVG fractalNoise, very low opacity */}
      <AbsoluteFill style={{ opacity: theme === 'dark' ? 0.08 : 0.04, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
