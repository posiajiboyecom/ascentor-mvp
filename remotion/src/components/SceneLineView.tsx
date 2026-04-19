// ═══════════════════════════════════════════════════════════
// Scene line — renders one SceneLine with entrance/exit motion
// ═══════════════════════════════════════════════════════════
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { lineEntrance, lineExit } from '../utils/motion';
import { emphasisStyle, FONT_DISPLAY } from '../utils/palette';
import type { SceneLine as SceneLineType, SceneAnimation } from '../../../types/video';

interface Props {
  line:            SceneLineType;
  animation:       SceneAnimation;
  sceneDurationFrames: number;
  accentColor:     string;
  textColor:       string;
}

export const SceneLineView: React.FC<Props> = ({
  line,
  animation,
  sceneDurationFrames,
  accentColor,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayFrames = Math.round((line.delayMs / 1000) * fps);
  const localFrame  = frame - delayFrames;

  // Not visible yet — delay hasn't elapsed
  if (localFrame < 0) return null;

  const entrance = lineEntrance(localFrame, fps, animation);
  const exit     = lineExit(sceneDurationFrames - frame);

  const combined = {
    opacity:   entrance.opacity * exit.opacity,
    transform: `${entrance.transform} ${exit.transform}`.replace(/none/g, '').trim() || 'none',
    filter:    entrance.filter,
  };

  const emphasisStyles = emphasisStyle(line.emphasis, accentColor, textColor);

  // word-by-word mode: split text into words and stagger each
  if (animation === 'word-by-word') {
    const words = line.text.split(/(\s+)/); // keep whitespace
    return (
      <div
        style={{
          ...combined,
          ...emphasisStyles,
          fontFamily: FONT_DISPLAY,
          fontSize:   72,
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
          textAlign: 'center',
          maxWidth: '88%',
          margin: '0 auto',
          padding: '0 48px',
        }}
      >
        {words.map((w, i) => {
          if (/^\s+$/.test(w)) return <span key={i}>{w}</span>;
          const wordDelay = i * 2; // 2 frames per word
          const wordT = Math.max(0, Math.min(1, (localFrame - wordDelay) / 10));
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: wordT,
                transform: `translateY(${(1 - wordT) * 16}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        ...combined,
        ...emphasisStyles,
        fontFamily: FONT_DISPLAY,
        fontSize:   line.emphasis === 'whisper' ? 54 : 72,
        lineHeight: 1.15,
        letterSpacing: '-0.015em',
        textAlign: 'center',
        maxWidth: '88%',
        margin: '0 auto',
        padding: '0 48px',
      }}
    >
      {line.text}
    </div>
  );
};
