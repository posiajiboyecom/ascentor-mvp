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
  },
  additionalFiles: [
    "./remotion/**",
  ],
});
