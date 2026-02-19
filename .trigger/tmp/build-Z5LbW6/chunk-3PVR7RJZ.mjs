import {
  __commonJS,
  __require,
  init_esm
} from "./chunk-4QJE3SM7.mjs";

// ../../AppData/Local/npm-cache/_npx/f35930adf21a2162/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js
var require_execAsync = __commonJS({
  "../../AppData/Local/npm-cache/_npx/f35930adf21a2162/node_modules/@opentelemetry/resources/build/src/detectors/platform/node/machine-id/execAsync.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.execAsync = void 0;
    var child_process = __require("child_process");
    var util = __require("util");
    exports.execAsync = util.promisify(child_process.exec);
  }
});

export {
  require_execAsync
};
//# sourceMappingURL=chunk-3PVR7RJZ.mjs.map
