import {
  defineConfig
} from "../../chunk-SGGS4MSR.mjs";
import "../../chunk-EOLRM24S.mjs";
import {
  init_esm
} from "../../chunk-4QJE3SM7.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 300,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4,
      factor: 2
    }
  },
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
