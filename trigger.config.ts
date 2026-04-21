import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'proj_zwrdqutfrrdneuwbjvxi',

  // ── Build configuration ───────────────────────────────────
  build: {
    // These packages ship native binaries that esbuild cannot bundle.
    // Marking them external tells Trigger.dev to install them in the
    // runtime environment rather than trying to inline them.
    external: [
      '@ffmpeg-installer/ffmpeg',
      '@ffprobe-installer/ffprobe',
      'fluent-ffmpeg',
      // Remotion also uses native deps — already works but listed for clarity
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
