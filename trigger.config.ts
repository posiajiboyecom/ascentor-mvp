import { defineConfig } from '@trigger.dev/sdk/v3';
import { ffmpeg } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: 'proj_zwrdqutfrrdneuwbjvxi',

  // Required by Trigger.dev 4.4.4+
  maxDuration: 300, // 5 minutes — covers video render + stitch pipeline

  // ── Build configuration ───────────────────────────────────
  build: {
    extensions: [
      // Installs FFmpeg into the build image and sets FFMPEG_PATH + FFPROBE_PATH
      ffmpeg(),
    ],
    external: [
      // Remotion uses native deps that esbuild cannot inline
      '@remotion/renderer',
      '@remotion/bundler',
    ],
  },

  // ── Where tasks live ─────────────────────────────────────
  dirs: ['src/trigger'],

  // ── Retry defaults ───────────────────────────────────────
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});
