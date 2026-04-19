// ═══════════════════════════════════════════════════════════
// Audio waveform — reads frequency data from the audio source
// and renders bars that pulse reactively.
//
// Uses @remotion/media-utils which is bundled with Remotion.
// If no audio is playing (audioMode === 'none'), nothing renders.
// ═══════════════════════════════════════════════════════════
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

interface Props {
  audioUrl: string | null | undefined;
  color:    string;
  theme:    'dark' | 'light';
}

export const Waveform: React.FC<Props> = ({ audioUrl, color, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioUrl ?? null);

  // If there's no audio, or it hasn't loaded yet, render nothing.
  if (!audioUrl || !audioData) return null;

  const NUM_BARS = 48;
  let visualization: number[] = [];
  try {
    visualization = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples: 64, // power of 2 required
    }).slice(0, NUM_BARS);
  } catch {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32, // sit just above the progress rail
        left: 0, right: 0,
        height: 70,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
        pointerEvents: 'none',
        opacity: theme === 'dark' ? 0.55 : 0.45,
      }}
    >
      {visualization.map((v, i) => {
        // Amplify low signals so the waveform is visible even for quiet voiceover
        const amplified = Math.min(1, Math.pow(v, 0.55) * 2);
        const barHeight = Math.max(3, amplified * 64);
        return (
          <div
            key={i}
            style={{
              width: 4,
              height: barHeight,
              background: color,
              borderRadius: 2,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};
