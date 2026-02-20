import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "tr_dev_oqGylBdkxhVVvNFi52R4",
  maxDuration: 300,
  dirs: ["./src/trigger"],
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