import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 300,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
  build: {
    external: [
      "@remotion/bundler",
      "@remotion/renderer",
      "@remotion/lambda",
      "remotion",
      "@rspack/core",
      "@rspack/binding",
    ],
    aptInstall: [
      "libnss3",
      "libnspr4",
      "libatk1.0-0",
      "libatk-bridge2.0-0",
      "libcups2",
      "libdrm2",
      "libdbus-1-3",
      "libxkbcommon0",
      "libxcomposite1",
      "libxdamage1",
      "libxfixes3",
      "libxrandr2",
      "libgbm1",
      "libasound2",
      "libpango-1.0-0",
      "libcairo2",
      "libatspi2.0-0",
    ],
  },
  additionalFiles: [
    "./remotion/**",
  ],
});
