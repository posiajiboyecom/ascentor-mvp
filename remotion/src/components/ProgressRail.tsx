// ═══════════════════════════════════════════════════════════
// A thin progress rail at the bottom of the frame — fills with
// amber as the video plays. Adds a subtle "player" feel that
// makes the video feel more intentional than generic AI output.
// ═══════════════════════════════════════════════════════════
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { themeColors } from '../utils/palette';

interface Props {
  theme: 'dark' | 'light';
}

export const ProgressRail: React.FC<Props> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const c = themeColors(theme);
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', height: 3, width: '100%', background: c.rail }}>
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: `${progress * 100}%`,
            background: c.accent,
            boxShadow: `0 0 12px ${c.accent}`,
            transition: 'none',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
