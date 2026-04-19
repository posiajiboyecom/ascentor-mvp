// ═══════════════════════════════════════════════════════════
// Trigger.dev project config
// Drop in: trigger.config.ts (repo root)
//
// Fixes from previous version:
//   • `aptInstall: [...]` at the top level is not valid and was
//     breaking the TS compile. Moved the same package list into
//     the `aptGet()` build extension — the proper Trigger.dev
//     pattern for installing system packages into the deployed
//     container image.
//   • `additionalFiles: [...]` at the top level is also not a
//     top-level config option. Moved into the `additionalFiles()`
//     build extension so the `remotion/` project files actually
//     ship inside the task container (Remotion's `bundle()` needs
//     `remotion/src/index.ts` to exist on disk at render time).
//
// Kept from previous version:
//   • project ref, maxDuration, dirs, retries (no auto-retries —
//     the Phase 4 /retry UI handles it manually).
//   • Full external[] list so Remotion's native-binding deps load
//     at runtime rather than getting bundled by esbuild.
//   • Full package list for Chromium's headless launch.
// ═══════════════════════════════════════════════════════════
import { defineConfig } from '@trigger.dev/sdk/v3';
import { aptGet, additionalFiles } from '@trigger.dev/build/extensions/core';

export default defineConfig({
  project: 'proj_zwrdqutfrrdneuwbjvxi',
  maxDuration: 300,
  dirs: ['./src/trigger'],

  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },

  build: {
    external: [
      '@remotion/bundler',
      '@remotion/renderer',
      '@remotion/lambda',
      'remotion',
      '@rspack/core',
      '@rspack/binding',
    ],

    extensions: [
      // System packages required by Chromium / Remotion's headless render.
      aptGet({
        packages: [
          'libnss3',
          'libnspr4',
          'libatk1.0-0',
          'libatk-bridge2.0-0',
          'libcups2',
          'libdrm2',
          'libdbus-1-3',
          'libxkbcommon0',
          'libxcomposite1',
          'libxdamage1',
          'libxfixes3',
          'libxrandr2',
          'libgbm1',
          'libasound2',
          'libpango-1.0-0',
          'libcairo2',
          'libatspi2.0-0',
        ],
      }),

      // Ship the remotion/ project files into the deployed container.
      // The video-generator task calls bundle({ entryPoint: 'remotion/src/index.ts' })
      // — that path must resolve at render time, so the whole folder
      // needs to be copied into the build output.
      additionalFiles({
        files: ['./remotion/**'],
      }),
    ],
  },
});
