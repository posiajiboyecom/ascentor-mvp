import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],
  // No global retries — free tier, tasks handle their own fallbacks
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
});
