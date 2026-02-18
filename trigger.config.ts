import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi", // Use your Project ID string directly or via env
  directories: ["./trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },
});