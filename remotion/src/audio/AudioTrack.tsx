// ═══════════════════════════════════════════════════════════
// Audio track — renders an <Audio> for whichever audio mode
// is active. Soundtracks fade in/out at start and end.
// ═══════════════════════════════════════════════════════════
import { Audio, useCurrentFrame, useVideoConfig } from 'remotion';

interface Props {
  mode:          'voiceover' | 'soundtrack' | 'none';
  voiceoverUrl?: string;
  soundtrackUrl?: string;
}

export const AudioTrack: React.FC<Props> = ({ mode, voiceoverUrl, soundtrackUrl }) => {
  const { durationInFrames, fps } = useVideoConfig();

  if (mode === 'voiceover' && voiceoverUrl) {
    // Voiceover — play at normal volume, no fade (it has natural silence at ends).
    return <Audio src={voiceoverUrl} volume={1} />;
  }

  if (mode === 'soundtrack' && soundtrackUrl) {
    // Soundtrack — fade in over 24 frames, hold at 0.55 (so any later voiceover work could sit over it), fade out over 48 frames.
    return (
      <Audio
        src={soundtrackUrl}
        volume={(frame) => {
          const fadeInFrames  = 24;
          const fadeOutFrames = 48;
          if (frame < fadeInFrames) return (frame / fadeInFrames) * 0.55;
          const framesLeft = durationInFrames - frame;
          if (framesLeft < fadeOutFrames) return (framesLeft / fadeOutFrames) * 0.55;
          return 0.55;
        }}
      />
    );
  }

  return null;
};
