// ═══════════════════════════════════════════════════════════
// Motion helpers for kinetic text.
// Uses Remotion's interpolate + spring — no external animation lib.
// ═══════════════════════════════════════════════════════════
import { interpolate, spring } from 'remotion';

// Cubic easing that feels natural for fade-ups
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutQuart = (t: number) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

export interface LineEntranceStyle {
  opacity: number;
  transform: string;
  filter?: string;
}

/**
 * Produces entrance styling for a single line.
 * `localFrame` = frames since line.delayMs relative to scene start.
 */
export function lineEntrance(
  localFrame: number,
  fps: number,
  animation: 'fade-up' | 'fade-in' | 'word-by-word' | 'slide-left',
): LineEntranceStyle {
  // Enter over 18 frames (~600ms at 30fps)
  const t = Math.max(0, Math.min(1, localFrame / 18));
  const eased = easeOutCubic(t);

  switch (animation) {
    case 'fade-in':
      return {
        opacity: eased,
        transform: 'none',
      };
    case 'slide-left':
      return {
        opacity: eased,
        transform: `translateX(${(1 - eased) * -40}px)`,
      };
    case 'word-by-word':
      // Actual word staggering happens in the line component — this provides a
      // subtle container fade so the line as a whole appears smoothly.
      return {
        opacity: eased,
        transform: `translateY(${(1 - eased) * 6}px)`,
      };
    case 'fade-up':
    default:
      return {
        opacity: eased,
        transform: `translateY(${(1 - eased) * 28}px)`,
        filter: t < 0.5 ? `blur(${(1 - eased) * 2}px)` : undefined,
      };
  }
}

/**
 * Exit styling for a line — fades out over the last 10 frames of its scene.
 */
export function lineExit(
  framesUntilSceneEnd: number,
): LineEntranceStyle {
  if (framesUntilSceneEnd > 10) return { opacity: 1, transform: 'none' };
  const t = Math.max(0, framesUntilSceneEnd / 10);
  return {
    opacity: t,
    transform: `translateY(${(1 - t) * -8}px)`,
  };
}

/**
 * Scene-level cross-dissolve: returns the opacity envelope of a scene given
 * absolute frame position relative to its own start.
 */
export function sceneEnvelope(
  localFrame: number,
  sceneDurationFrames: number,
): number {
  // Fade in over 6 frames, fade out over 8 frames
  const fadeIn = Math.min(1, localFrame / 6);
  const framesLeft = sceneDurationFrames - localFrame;
  const fadeOut = Math.min(1, framesLeft / 8);
  return Math.max(0, Math.min(1, fadeIn)) * Math.max(0, Math.min(1, fadeOut));
}

/**
 * A gentle "breathing" motion — adds life to static elements between animated ones.
 */
export function breathing(frame: number, fps: number, amplitude = 2): number {
  const periodSeconds = 4;
  const phase = (frame / fps / periodSeconds) * Math.PI * 2;
  return Math.sin(phase) * amplitude;
}

export { interpolate, spring, easeOutCubic, easeInOutQuart };
