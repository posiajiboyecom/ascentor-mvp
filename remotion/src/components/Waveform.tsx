// ═══════════════════════════════════════════════════════════
// Audio waveform — reads frequency data from the audio source
// and renders bars that pulse reactively.
//
// Uses @remotion/media-utils which is bundled with Remotion.
// If no audio is playing (audioMode === 'none'), nothing renders.
//
// Split into two components so the hook receives a guaranteed
// non-null string (Remotion's useAudioData throws on falsy input
// and is typed as (src: string) => ...). The outer guard handles
// the nullable case; the inner component does the real work.
// ═══════════════════════════════════════════════════════════
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';

interface Props {
  audioUrl: string | null | undefined;
  color:    string;
  theme:    'dark' | 'light';
}

export const Waveform: React.FC<Props> = ({ audioUrl, color, theme }) => {
  if (!audioUrl) return null;
  return <WaveformInner audioUrl={audioUrl} color={color} theme={theme} />;
};

// Inner component — only mounted when audioUrl is guaranteed non-null.
// Because React unmounts/remounts this when audioUrl changes, the hook
// call is fine.
const WaveformInner: React.FC<{ audioUrl: string; color: string; theme: 'dark' | 'light' }> = ({
  audioUrl, color, theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const audioData = useAudioData(audioUrl);

  // Audio still fetching — render nothing until metadata is ready.
  if (!audioData) return null;

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
