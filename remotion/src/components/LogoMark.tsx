// ═══════════════════════════════════════════════════════════
// Small persistent logo in the top-left. Fades in at start,
// stays for the full video, and gets a subtle breathing motion.
// ═══════════════════════════════════════════════════════════
import { Img, useCurrentFrame, useVideoConfig } from 'remotion';
import { breathing } from '../utils/motion';

interface Props {
  logoUrl: string;
}

export const LogoMark: React.FC<Props> = ({ logoUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in over first 18 frames
  const opacity = Math.min(1, frame / 18);
  const drift = breathing(frame, fps, 2);

  if (!logoUrl) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        left: 56,
        opacity,
        transform: `translateY(${drift}px)`,
      }}
    >
      <Img
        src={logoUrl}
        style={{
          height: 42,
          width: 'auto',
          display: 'block',
        }}
      />
    </div>
  );
};
