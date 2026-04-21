import { defineConfig } from '@trigger.dev/sdk/v3';
import { ffmpeg, additionalFiles, aptGet } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: 'proj_zwrdqutfrrdneuwbjvxi',

  // Required by Trigger.dev 4.4.4+
  maxDuration: 300, // 5 minutes — covers video render + stitch pipeline

  // ── Build configuration ───────────────────────────────────
  build: {
    extensions: [
      // Installs FFmpeg into the build image and sets FFMPEG_PATH + FFPROBE_PATH
      ffmpeg(),
      // Chromium system libraries required by Remotion's headless renderer.
      // libnspr4 + libnss3 are the most commonly missing ones in slim images.
      aptGet({
        packages: [
          'libnspr4',
          'libnss3',
          'libatk1.0-0',
          'libatk-bridge2.0-0',
          'libcups2',
          'libdrm2',
          'libxkbcommon0',
          'libxcomposite1',
          'libxdamage1',
          'libxfixes3',
          'libxrandr2',
          'libgbm1',
          'libasound2',
        ],
      }),
      // Include the entire remotion folder — both tasks call bundle() which
      // needs remotion/src/index.ts and all composition files at runtime.
      additionalFiles({
        files: ['./remotion/**'],
      }),
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
