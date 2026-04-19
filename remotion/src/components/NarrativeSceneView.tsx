// ═══════════════════════════════════════════════════════════
// Narrative scene — stacks SceneLines vertically + applies a
// scene-level opacity envelope so scenes cross-dissolve cleanly.
// ═══════════════════════════════════════════════════════════
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { sceneEnvelope } from '../utils/motion';
import { SceneLineView } from './SceneLineView';
import type { NarrativeScene as NarrativeSceneType } from '../../../types/video';

interface Props {
  scene:       NarrativeSceneType;
  accentColor: string;
  textColor:   string;
}

export const NarrativeSceneView: React.FC<Props> = ({ scene, accentColor, textColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneDurationFrames = Math.ceil(scene.durationSeconds * fps);
  const envelope = sceneEnvelope(frame, sceneDurationFrames);

  return (
    <AbsoluteFill
      style={{
        opacity: envelope,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '0 64px',
      }}
    >
      {scene.lines.map((line, i) => (
        <SceneLineView
          key={i}
          line={line}
          animation={scene.animation}
          sceneDurationFrames={sceneDurationFrames}
          accentColor={accentColor}
          textColor={textColor}
        />
      ))}
    </AbsoluteFill>
  );
};
