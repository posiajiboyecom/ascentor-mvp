import { defineConfig } from "@trigger.dev/sdk/v3";
import { pythonExtension } from "@trigger.dev/python/extension";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
  build: {
    extensions: [
      pythonExtension({
        requirementsFile: "./requirements.txt",
      }),
    ],
  },
});