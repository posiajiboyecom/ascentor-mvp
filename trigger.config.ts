import { defineConfig } from "@trigger.dev/sdk/v3";
import { videoGeneratorTask } from './src/trigger/video-generator'


export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
});