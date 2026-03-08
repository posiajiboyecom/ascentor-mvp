import {
  defineConfig
} from "../../chunk-MN3LL5E3.mjs";
import "../../chunk-7QMGN3HH.mjs";
import {
  init_esm
} from "../../chunk-UQUWQY52.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],
  // No global retries — free tier, tasks handle their own fallbacks
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 }
  },
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
