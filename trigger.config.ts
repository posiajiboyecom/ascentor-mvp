import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
});