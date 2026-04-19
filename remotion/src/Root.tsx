// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Root composition declaration
//
// Duration, width, height are calculated at resolve-time
// from inputProps via calculateMetadata. Trigger.dev calls
// selectComposition() → this function runs → returns the real
// durationInFrames based on the scenes Claude generated.
// ═══════════════════════════════════════════════════════════
import { Composition } from 'remotion';
import { AscentorKineticVideo } from './compositions/AscentorKineticVideo';
import type { VideoJobPayload } from '../../types/video';

// 30fps is plenty for kinetic text — 60fps doubles render time with no visible benefit.
export const FPS = 30;

// 1080x1920 — vertical, optimised for LinkedIn / mobile feeds.
// If you want a square (1080x1080) or horizontal (1920x1080) variant later,
// add another Composition registration below.
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AscentorKineticVideo"
        component={AscentorKineticVideo}
        // Fallback duration — real value comes from calculateMetadata.
        durationInFrames={300}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        // Fallback props for Remotion Studio preview — real props come from Trigger.dev.
        defaultProps={{
          jobId: 'preview',
          theme: 'dark',
          logoUrl: '',
          scenes: [],
          ctaScreen: {
            template: 'dark-centered',
            headlineText: 'Preview mode',
            subtitleText: 'Pass real inputProps to see a real video',
            buttonText: 'Open Ascentor',
            buttonUrl: 'https://ascentorbi.com',
            durationSeconds: 8,
          },
          audioMode: 'none',
          totalDurationSeconds: 10,
        } as VideoJobPayload}
        calculateMetadata={({ props }) => {
          // Cast through `unknown` — Remotion types `props` as
          // Record<string, unknown>, which TS (correctly) refuses to
          // narrow directly to VideoJobPayload.
          const payload = props as unknown as VideoJobPayload;
          const sceneSeconds = (payload.scenes ?? []).reduce(
            (sum, s) => sum + (s.durationSeconds || 0),
            0,
          );
          const ctaSeconds = payload.ctaScreen?.durationSeconds ?? 8;
          const totalSeconds = Math.max(sceneSeconds + ctaSeconds, 3);
          return {
            durationInFrames: Math.ceil(totalSeconds * FPS),
            fps: FPS,
            width: WIDTH,
            height: HEIGHT,
          };
        }}
      />
    </>
  );
};
