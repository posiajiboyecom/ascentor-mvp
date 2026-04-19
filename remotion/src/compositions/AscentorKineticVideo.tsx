// ═══════════════════════════════════════════════════════════
// Ascentor Kinetic Video — top-level composition
//
// Layers (back → front):
//   1. Background (animated gradient + grain)
//   2. Narrative scenes, each wrapped in a <Sequence>
//   3. CTA screen <Sequence> at the tail
//   4. LogoMark (fades in at start, persists through narrative)
//   5. ProgressRail (bottom, fills left-to-right)
//   6. Waveform (above rail, reactive to audio)
//   7. AudioTrack (voiceover or soundtrack)
//
// The CTA screen fully replaces the narrative canvas during
// its <Sequence>, so logo/rail/waveform only render during
// the narrative portion.
// ═══════════════════════════════════════════════════════════
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { NarrativeSceneView } from '../components/NarrativeSceneView';
import { CTAScreen } from '../components/CTAScreen';
import { LogoMark } from '../components/LogoMark';
import { ProgressRail } from '../components/ProgressRail';
import { Waveform } from '../components/Waveform';
import { AudioTrack } from '../audio/AudioTrack';
import { themeColors } from '../utils/palette';
import type { VideoJobPayload } from '../../../types/video';

export const AscentorKineticVideo: React.FC<VideoJobPayload> = (props) => {
  const {
    theme,
    logoUrl,
    scenes,
    ctaScreen,
    audioMode,
    voiceoverUrl,
    soundtrackUrl,
  } = props;

  const { fps } = useVideoConfig();
  const c = themeColors(theme);

  // Compute the start frame of each scene so we can wrap them in <Sequence>.
  let cursorFrame = 0;
  const narrativeSequences = scenes.map((scene, i) => {
    const startFrame = cursorFrame;
    const durationFrames = Math.ceil(scene.durationSeconds * fps);
    cursorFrame += durationFrames;
    return (
      <Sequence
        key={scene.id ?? i}
        from={startFrame}
        durationInFrames={durationFrames}
        name={`scene-${i + 1}`}
      >
        <NarrativeSceneView
          scene={scene}
          accentColor={c.accent}
          textColor={c.text}
        />
      </Sequence>
    );
  });

  const narrativeEndFrame = cursorFrame;
  const ctaDurationFrames = Math.ceil(ctaScreen.durationSeconds * fps);

  // Decide which audio URL the waveform should read from.
  const waveformAudioUrl =
    audioMode === 'voiceover' ? voiceoverUrl :
    audioMode === 'soundtrack' ? soundtrackUrl :
    null;

  return (
    <AbsoluteFill>
      {/* ── Layer 1: Background (spans full duration) ───────── */}
      <Background theme={theme} />

      {/* ── Layer 2: Narrative scenes (only visible while narrating) ── */}
      <Sequence from={0} durationInFrames={narrativeEndFrame} name="narrative">
        <AbsoluteFill>
          {narrativeSequences}
          {/* Logo, rail, waveform only during narrative — CTA has its own design */}
          <LogoMark logoUrl={logoUrl} />
          <Waveform audioUrl={waveformAudioUrl} color={c.accent} theme={theme} />
          <ProgressRail theme={theme} />
        </AbsoluteFill>
      </Sequence>

      {/* ── Layer 3: CTA screen (takes over at the end) ─────── */}
      <Sequence from={narrativeEndFrame} durationInFrames={ctaDurationFrames} name="cta">
        <CTAScreen cta={ctaScreen} theme={theme} logoUrl={logoUrl} />
      </Sequence>

      {/* ── Layer 4: Audio (spans full duration) ─────────────── */}
      <AudioTrack
        mode={audioMode}
        voiceoverUrl={voiceoverUrl}
        soundtrackUrl={soundtrackUrl}
      />
    </AbsoluteFill>
  );
};
