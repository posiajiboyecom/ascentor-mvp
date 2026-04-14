import {
  NoReactInternals,
  VERSION,
  init_no_react,
  init_version,
  random,
  require_jsx_runtime,
  require_merge_stream
} from "./chunk-JSNTL3OG.mjs";
import {
  require_src
} from "./chunk-7KMAXNMD.mjs";
import "./chunk-Q3S2BM77.mjs";
import {
  __commonJS,
  __name,
  __require,
  __toESM,
  init_esm
} from "./chunk-UQUWQY52.mjs";

// node_modules/isexe/windows.js
var require_windows = __commonJS({
  "node_modules/isexe/windows.js"(exports, module) {
    init_esm();
    module.exports = isexe;
    isexe.sync = sync;
    var fs19 = __require("fs");
    function checkPathExt(path28, options) {
      var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
      if (!pathext) {
        return true;
      }
      pathext = pathext.split(";");
      if (pathext.indexOf("") !== -1) {
        return true;
      }
      for (var i = 0; i < pathext.length; i++) {
        var p = pathext[i].toLowerCase();
        if (p && path28.substr(-p.length).toLowerCase() === p) {
          return true;
        }
      }
      return false;
    }
    __name(checkPathExt, "checkPathExt");
    function checkStat(stat, path28, options) {
      if (!stat.isSymbolicLink() && !stat.isFile()) {
        return false;
      }
      return checkPathExt(path28, options);
    }
    __name(checkStat, "checkStat");
    function isexe(path28, options, cb) {
      fs19.stat(path28, function(er, stat) {
        cb(er, er ? false : checkStat(stat, path28, options));
      });
    }
    __name(isexe, "isexe");
    function sync(path28, options) {
      return checkStat(fs19.statSync(path28), path28, options);
    }
    __name(sync, "sync");
  }
});

// node_modules/isexe/mode.js
var require_mode = __commonJS({
  "node_modules/isexe/mode.js"(exports, module) {
    init_esm();
    module.exports = isexe;
    isexe.sync = sync;
    var fs19 = __require("fs");
    function isexe(path28, options, cb) {
      fs19.stat(path28, function(er, stat) {
        cb(er, er ? false : checkStat(stat, options));
      });
    }
    __name(isexe, "isexe");
    function sync(path28, options) {
      return checkStat(fs19.statSync(path28), options);
    }
    __name(sync, "sync");
    function checkStat(stat, options) {
      return stat.isFile() && checkMode(stat, options);
    }
    __name(checkStat, "checkStat");
    function checkMode(stat, options) {
      var mod = stat.mode;
      var uid = stat.uid;
      var gid = stat.gid;
      var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
      var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
      var u = parseInt("100", 8);
      var g = parseInt("010", 8);
      var o = parseInt("001", 8);
      var ug = u | g;
      var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
      return ret;
    }
    __name(checkMode, "checkMode");
  }
});

// node_modules/isexe/index.js
var require_isexe = __commonJS({
  "node_modules/isexe/index.js"(exports, module) {
    init_esm();
    var fs19 = __require("fs");
    var core;
    if (process.platform === "win32" || global.TESTING_WINDOWS) {
      core = require_windows();
    } else {
      core = require_mode();
    }
    module.exports = isexe;
    isexe.sync = sync;
    function isexe(path28, options, cb) {
      if (typeof options === "function") {
        cb = options;
        options = {};
      }
      if (!cb) {
        if (typeof Promise !== "function") {
          throw new TypeError("callback not provided");
        }
        return new Promise(function(resolve3, reject) {
          isexe(path28, options || {}, function(er, is) {
            if (er) {
              reject(er);
            } else {
              resolve3(is);
            }
          });
        });
      }
      core(path28, options || {}, function(er, is) {
        if (er) {
          if (er.code === "EACCES" || options && options.ignoreErrors) {
            er = null;
            is = false;
          }
        }
        cb(er, is);
      });
    }
    __name(isexe, "isexe");
    function sync(path28, options) {
      try {
        return core.sync(path28, options || {});
      } catch (er) {
        if (options && options.ignoreErrors || er.code === "EACCES") {
          return false;
        } else {
          throw er;
        }
      }
    }
    __name(sync, "sync");
  }
});

// node_modules/which/which.js
var require_which = __commonJS({
  "node_modules/which/which.js"(exports, module) {
    init_esm();
    var isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
    var path28 = __require("path");
    var COLON = isWindows ? ";" : ":";
    var isexe = require_isexe();
    var getNotFoundError = /* @__PURE__ */ __name((cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" }), "getNotFoundError");
    var getPathInfo = /* @__PURE__ */ __name((cmd, opt) => {
      const colon = opt.colon || COLON;
      const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
        // windows always checks the cwd first
        ...isWindows ? [process.cwd()] : [],
        ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
        "").split(colon)
      ];
      const pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "";
      const pathExt = isWindows ? pathExtExe.split(colon) : [""];
      if (isWindows) {
        if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
          pathExt.unshift("");
      }
      return {
        pathEnv,
        pathExt,
        pathExtExe
      };
    }, "getPathInfo");
    var which = /* @__PURE__ */ __name((cmd, opt, cb) => {
      if (typeof opt === "function") {
        cb = opt;
        opt = {};
      }
      if (!opt)
        opt = {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      const step = /* @__PURE__ */ __name((i) => new Promise((resolve3, reject) => {
        if (i === pathEnv.length)
          return opt.all && found.length ? resolve3(found) : reject(getNotFoundError(cmd));
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path28.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        resolve3(subStep(p, i, 0));
      }), "step");
      const subStep = /* @__PURE__ */ __name((p, i, ii) => new Promise((resolve3, reject) => {
        if (ii === pathExt.length)
          return resolve3(step(i + 1));
        const ext = pathExt[ii];
        isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
          if (!er && is) {
            if (opt.all)
              found.push(p + ext);
            else
              return resolve3(p + ext);
          }
          return resolve3(subStep(p, i, ii + 1));
        });
      }), "subStep");
      return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
    }, "which");
    var whichSync = /* @__PURE__ */ __name((cmd, opt) => {
      opt = opt || {};
      const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
      const found = [];
      for (let i = 0; i < pathEnv.length; i++) {
        const ppRaw = pathEnv[i];
        const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;
        const pCmd = path28.join(pathPart, cmd);
        const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        for (let j = 0; j < pathExt.length; j++) {
          const cur = p + pathExt[j];
          try {
            const is = isexe.sync(cur, { pathExt: pathExtExe });
            if (is) {
              if (opt.all)
                found.push(cur);
              else
                return cur;
            }
          } catch (ex) {
          }
        }
      }
      if (opt.all && found.length)
        return found;
      if (opt.nothrow)
        return null;
      throw getNotFoundError(cmd);
    }, "whichSync");
    module.exports = which;
    which.sync = whichSync;
  }
});

// node_modules/path-key/index.js
var require_path_key = __commonJS({
  "node_modules/path-key/index.js"(exports, module) {
    "use strict";
    init_esm();
    var pathKey = /* @__PURE__ */ __name((options = {}) => {
      const environment = options.env || process.env;
      const platform3 = options.platform || process.platform;
      if (platform3 !== "win32") {
        return "PATH";
      }
      return Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
    }, "pathKey");
    module.exports = pathKey;
    module.exports.default = pathKey;
  }
});

// node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = __commonJS({
  "node_modules/cross-spawn/lib/util/resolveCommand.js"(exports, module) {
    "use strict";
    init_esm();
    var path28 = __require("path");
    var which = require_which();
    var getPathKey = require_path_key();
    function resolveCommandAttempt(parsed, withoutPathExt) {
      const env = parsed.options.env || process.env;
      const cwd = process.cwd();
      const hasCustomCwd = parsed.options.cwd != null;
      const shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
      if (shouldSwitchCwd) {
        try {
          process.chdir(parsed.options.cwd);
        } catch (err) {
        }
      }
      let resolved;
      try {
        resolved = which.sync(parsed.command, {
          path: env[getPathKey({ env })],
          pathExt: withoutPathExt ? path28.delimiter : void 0
        });
      } catch (e) {
      } finally {
        if (shouldSwitchCwd) {
          process.chdir(cwd);
        }
      }
      if (resolved) {
        resolved = path28.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved);
      }
      return resolved;
    }
    __name(resolveCommandAttempt, "resolveCommandAttempt");
    function resolveCommand(parsed) {
      return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
    }
    __name(resolveCommand, "resolveCommand");
    module.exports = resolveCommand;
  }
});

// node_modules/cross-spawn/lib/util/escape.js
var require_escape = __commonJS({
  "node_modules/cross-spawn/lib/util/escape.js"(exports, module) {
    "use strict";
    init_esm();
    var metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
    function escapeCommand(arg) {
      arg = arg.replace(metaCharsRegExp, "^$1");
      return arg;
    }
    __name(escapeCommand, "escapeCommand");
    function escapeArgument(arg, doubleEscapeMetaChars) {
      arg = `${arg}`;
      arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
      arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1");
      arg = `"${arg}"`;
      arg = arg.replace(metaCharsRegExp, "^$1");
      if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, "^$1");
      }
      return arg;
    }
    __name(escapeArgument, "escapeArgument");
    module.exports.command = escapeCommand;
    module.exports.argument = escapeArgument;
  }
});

// node_modules/shebang-regex/index.js
var require_shebang_regex = __commonJS({
  "node_modules/shebang-regex/index.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = /^#!(.*)/;
  }
});

// node_modules/shebang-command/index.js
var require_shebang_command = __commonJS({
  "node_modules/shebang-command/index.js"(exports, module) {
    "use strict";
    init_esm();
    var shebangRegex = require_shebang_regex();
    module.exports = (string = "") => {
      const match = string.match(shebangRegex);
      if (!match) {
        return null;
      }
      const [path28, argument] = match[0].replace(/#! ?/, "").split(" ");
      const binary = path28.split("/").pop();
      if (binary === "env") {
        return argument;
      }
      return argument ? `${binary} ${argument}` : binary;
    };
  }
});

// node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = __commonJS({
  "node_modules/cross-spawn/lib/util/readShebang.js"(exports, module) {
    "use strict";
    init_esm();
    var fs19 = __require("fs");
    var shebangCommand = require_shebang_command();
    function readShebang(command) {
      const size = 150;
      const buffer = Buffer.alloc(size);
      let fd;
      try {
        fd = fs19.openSync(command, "r");
        fs19.readSync(fd, buffer, 0, size, 0);
        fs19.closeSync(fd);
      } catch (e) {
      }
      return shebangCommand(buffer.toString());
    }
    __name(readShebang, "readShebang");
    module.exports = readShebang;
  }
});

// node_modules/cross-spawn/lib/parse.js
var require_parse = __commonJS({
  "node_modules/cross-spawn/lib/parse.js"(exports, module) {
    "use strict";
    init_esm();
    var path28 = __require("path");
    var resolveCommand = require_resolveCommand();
    var escape = require_escape();
    var readShebang = require_readShebang();
    var isWin = process.platform === "win32";
    var isExecutableRegExp = /\.(?:com|exe)$/i;
    var isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
    function detectShebang(parsed) {
      parsed.file = resolveCommand(parsed);
      const shebang = parsed.file && readShebang(parsed.file);
      if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;
        return resolveCommand(parsed);
      }
      return parsed.file;
    }
    __name(detectShebang, "detectShebang");
    function parseNonShell(parsed) {
      if (!isWin) {
        return parsed;
      }
      const commandFile = detectShebang(parsed);
      const needsShell = !isExecutableRegExp.test(commandFile);
      if (parsed.options.forceShell || needsShell) {
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
        parsed.command = path28.normalize(parsed.command);
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
        const shellCommand = [parsed.command].concat(parsed.args).join(" ");
        parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`];
        parsed.command = process.env.comspec || "cmd.exe";
        parsed.options.windowsVerbatimArguments = true;
      }
      return parsed;
    }
    __name(parseNonShell, "parseNonShell");
    function parse(command, args, options) {
      if (args && !Array.isArray(args)) {
        options = args;
        args = null;
      }
      args = args ? args.slice(0) : [];
      options = Object.assign({}, options);
      const parsed = {
        command,
        args,
        options,
        file: void 0,
        original: {
          command,
          args
        }
      };
      return options.shell ? parsed : parseNonShell(parsed);
    }
    __name(parse, "parse");
    module.exports = parse;
  }
});

// node_modules/cross-spawn/lib/enoent.js
var require_enoent = __commonJS({
  "node_modules/cross-spawn/lib/enoent.js"(exports, module) {
    "use strict";
    init_esm();
    var isWin = process.platform === "win32";
    function notFoundError(original, syscall) {
      return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: "ENOENT",
        errno: "ENOENT",
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args
      });
    }
    __name(notFoundError, "notFoundError");
    function hookChildProcess(cp, parsed) {
      if (!isWin) {
        return;
      }
      const originalEmit = cp.emit;
      cp.emit = function(name, arg1) {
        if (name === "exit") {
          const err = verifyENOENT(arg1, parsed);
          if (err) {
            return originalEmit.call(cp, "error", err);
          }
        }
        return originalEmit.apply(cp, arguments);
      };
    }
    __name(hookChildProcess, "hookChildProcess");
    function verifyENOENT(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawn");
      }
      return null;
    }
    __name(verifyENOENT, "verifyENOENT");
    function verifyENOENTSync(status, parsed) {
      if (isWin && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, "spawnSync");
      }
      return null;
    }
    __name(verifyENOENTSync, "verifyENOENTSync");
    module.exports = {
      hookChildProcess,
      verifyENOENT,
      verifyENOENTSync,
      notFoundError
    };
  }
});

// node_modules/cross-spawn/index.js
var require_cross_spawn = __commonJS({
  "node_modules/cross-spawn/index.js"(exports, module) {
    "use strict";
    init_esm();
    var cp = __require("child_process");
    var parse = require_parse();
    var enoent = require_enoent();
    function spawn4(command, args, options) {
      const parsed = parse(command, args, options);
      const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
      enoent.hookChildProcess(spawned, parsed);
      return spawned;
    }
    __name(spawn4, "spawn");
    function spawnSync(command, args, options) {
      const parsed = parse(command, args, options);
      const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
      result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);
      return result;
    }
    __name(spawnSync, "spawnSync");
    module.exports = spawn4;
    module.exports.spawn = spawn4;
    module.exports.sync = spawnSync;
    module.exports._parse = parse;
    module.exports._enoent = enoent;
  }
});

// node_modules/@remotion/renderer/node_modules/strip-final-newline/index.js
var require_strip_final_newline = __commonJS({
  "node_modules/@remotion/renderer/node_modules/strip-final-newline/index.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = (input) => {
      const LF = typeof input === "string" ? "\n" : "\n".charCodeAt();
      const CR = typeof input === "string" ? "\r" : "\r".charCodeAt();
      if (input[input.length - 1] === LF) {
        input = input.slice(0, input.length - 1);
      }
      if (input[input.length - 1] === CR) {
        input = input.slice(0, input.length - 1);
      }
      return input;
    };
  }
});

// node_modules/@remotion/renderer/node_modules/npm-run-path/index.js
var require_npm_run_path = __commonJS({
  "node_modules/@remotion/renderer/node_modules/npm-run-path/index.js"(exports, module) {
    "use strict";
    init_esm();
    var path28 = __require("path");
    var pathKey = require_path_key();
    var npmRunPath = /* @__PURE__ */ __name((options) => {
      options = {
        cwd: process.cwd(),
        path: process.env[pathKey()],
        execPath: process.execPath,
        ...options
      };
      let previous;
      let cwdPath = path28.resolve(options.cwd);
      const result = [];
      while (previous !== cwdPath) {
        result.push(path28.join(cwdPath, "node_modules/.bin"));
        previous = cwdPath;
        cwdPath = path28.resolve(cwdPath, "..");
      }
      const execPathDir = path28.resolve(options.cwd, options.execPath, "..");
      result.push(execPathDir);
      return result.concat(options.path).join(path28.delimiter);
    }, "npmRunPath");
    module.exports = npmRunPath;
    module.exports.default = npmRunPath;
    module.exports.env = (options) => {
      options = {
        env: process.env,
        ...options
      };
      const env = { ...options.env };
      const path29 = pathKey({ env });
      options.path = env[path29];
      env[path29] = module.exports(options);
      return env;
    };
  }
});

// node_modules/mimic-fn/index.js
var require_mimic_fn = __commonJS({
  "node_modules/mimic-fn/index.js"(exports, module) {
    "use strict";
    init_esm();
    var mimicFn = /* @__PURE__ */ __name((to, from) => {
      for (const prop of Reflect.ownKeys(from)) {
        Object.defineProperty(to, prop, Object.getOwnPropertyDescriptor(from, prop));
      }
      return to;
    }, "mimicFn");
    module.exports = mimicFn;
    module.exports.default = mimicFn;
  }
});

// node_modules/@remotion/renderer/node_modules/onetime/index.js
var require_onetime = __commonJS({
  "node_modules/@remotion/renderer/node_modules/onetime/index.js"(exports, module) {
    "use strict";
    init_esm();
    var mimicFn = require_mimic_fn();
    var calledFunctions = /* @__PURE__ */ new WeakMap();
    var onetime = /* @__PURE__ */ __name((function_, options = {}) => {
      if (typeof function_ !== "function") {
        throw new TypeError("Expected a function");
      }
      let returnValue;
      let callCount = 0;
      const functionName = function_.displayName || function_.name || "<anonymous>";
      const onetime2 = /* @__PURE__ */ __name(function(...arguments_) {
        calledFunctions.set(onetime2, ++callCount);
        if (callCount === 1) {
          returnValue = function_.apply(this, arguments_);
          function_ = null;
        } else if (options.throw === true) {
          throw new Error(`Function \`${functionName}\` can only be called once`);
        }
        return returnValue;
      }, "onetime");
      mimicFn(onetime2, function_);
      calledFunctions.set(onetime2, callCount);
      return onetime2;
    }, "onetime");
    module.exports = onetime;
    module.exports.default = onetime;
    module.exports.callCount = (function_) => {
      if (!calledFunctions.has(function_)) {
        throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
      }
      return calledFunctions.get(function_);
    };
  }
});

// node_modules/@remotion/renderer/node_modules/human-signals/build/src/core.js
var require_core = __commonJS({
  "node_modules/@remotion/renderer/node_modules/human-signals/build/src/core.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SIGNALS = void 0;
    var SIGNALS = [
      {
        name: "SIGHUP",
        number: 1,
        action: "terminate",
        description: "Terminal closed",
        standard: "posix"
      },
      {
        name: "SIGINT",
        number: 2,
        action: "terminate",
        description: "User interruption with CTRL-C",
        standard: "ansi"
      },
      {
        name: "SIGQUIT",
        number: 3,
        action: "core",
        description: "User interruption with CTRL-\\",
        standard: "posix"
      },
      {
        name: "SIGILL",
        number: 4,
        action: "core",
        description: "Invalid machine instruction",
        standard: "ansi"
      },
      {
        name: "SIGTRAP",
        number: 5,
        action: "core",
        description: "Debugger breakpoint",
        standard: "posix"
      },
      {
        name: "SIGABRT",
        number: 6,
        action: "core",
        description: "Aborted",
        standard: "ansi"
      },
      {
        name: "SIGIOT",
        number: 6,
        action: "core",
        description: "Aborted",
        standard: "bsd"
      },
      {
        name: "SIGBUS",
        number: 7,
        action: "core",
        description: "Bus error due to misaligned, non-existing address or paging error",
        standard: "bsd"
      },
      {
        name: "SIGEMT",
        number: 7,
        action: "terminate",
        description: "Command should be emulated but is not implemented",
        standard: "other"
      },
      {
        name: "SIGFPE",
        number: 8,
        action: "core",
        description: "Floating point arithmetic error",
        standard: "ansi"
      },
      {
        name: "SIGKILL",
        number: 9,
        action: "terminate",
        description: "Forced termination",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGUSR1",
        number: 10,
        action: "terminate",
        description: "Application-specific signal",
        standard: "posix"
      },
      {
        name: "SIGSEGV",
        number: 11,
        action: "core",
        description: "Segmentation fault",
        standard: "ansi"
      },
      {
        name: "SIGUSR2",
        number: 12,
        action: "terminate",
        description: "Application-specific signal",
        standard: "posix"
      },
      {
        name: "SIGPIPE",
        number: 13,
        action: "terminate",
        description: "Broken pipe or socket",
        standard: "posix"
      },
      {
        name: "SIGALRM",
        number: 14,
        action: "terminate",
        description: "Timeout or timer",
        standard: "posix"
      },
      {
        name: "SIGTERM",
        number: 15,
        action: "terminate",
        description: "Termination",
        standard: "ansi"
      },
      {
        name: "SIGSTKFLT",
        number: 16,
        action: "terminate",
        description: "Stack is empty or overflowed",
        standard: "other"
      },
      {
        name: "SIGCHLD",
        number: 17,
        action: "ignore",
        description: "Child process terminated, paused or unpaused",
        standard: "posix"
      },
      {
        name: "SIGCLD",
        number: 17,
        action: "ignore",
        description: "Child process terminated, paused or unpaused",
        standard: "other"
      },
      {
        name: "SIGCONT",
        number: 18,
        action: "unpause",
        description: "Unpaused",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGSTOP",
        number: 19,
        action: "pause",
        description: "Paused",
        standard: "posix",
        forced: true
      },
      {
        name: "SIGTSTP",
        number: 20,
        action: "pause",
        description: 'Paused using CTRL-Z or "suspend"',
        standard: "posix"
      },
      {
        name: "SIGTTIN",
        number: 21,
        action: "pause",
        description: "Background process cannot read terminal input",
        standard: "posix"
      },
      {
        name: "SIGBREAK",
        number: 21,
        action: "terminate",
        description: "User interruption with CTRL-BREAK",
        standard: "other"
      },
      {
        name: "SIGTTOU",
        number: 22,
        action: "pause",
        description: "Background process cannot write to terminal output",
        standard: "posix"
      },
      {
        name: "SIGURG",
        number: 23,
        action: "ignore",
        description: "Socket received out-of-band data",
        standard: "bsd"
      },
      {
        name: "SIGXCPU",
        number: 24,
        action: "core",
        description: "Process timed out",
        standard: "bsd"
      },
      {
        name: "SIGXFSZ",
        number: 25,
        action: "core",
        description: "File too big",
        standard: "bsd"
      },
      {
        name: "SIGVTALRM",
        number: 26,
        action: "terminate",
        description: "Timeout or timer",
        standard: "bsd"
      },
      {
        name: "SIGPROF",
        number: 27,
        action: "terminate",
        description: "Timeout or timer",
        standard: "bsd"
      },
      {
        name: "SIGWINCH",
        number: 28,
        action: "ignore",
        description: "Terminal window size changed",
        standard: "bsd"
      },
      {
        name: "SIGIO",
        number: 29,
        action: "terminate",
        description: "I/O is available",
        standard: "other"
      },
      {
        name: "SIGPOLL",
        number: 29,
        action: "terminate",
        description: "Watched event",
        standard: "other"
      },
      {
        name: "SIGINFO",
        number: 29,
        action: "ignore",
        description: "Request for process information",
        standard: "other"
      },
      {
        name: "SIGPWR",
        number: 30,
        action: "terminate",
        description: "Device running out of power",
        standard: "systemv"
      },
      {
        name: "SIGSYS",
        number: 31,
        action: "core",
        description: "Invalid system call",
        standard: "other"
      },
      {
        name: "SIGUNUSED",
        number: 31,
        action: "terminate",
        description: "Invalid system call",
        standard: "other"
      }
    ];
    exports.SIGNALS = SIGNALS;
  }
});

// node_modules/@remotion/renderer/node_modules/human-signals/build/src/realtime.js
var require_realtime = __commonJS({
  "node_modules/@remotion/renderer/node_modules/human-signals/build/src/realtime.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SIGRTMAX = exports.getRealtimeSignals = void 0;
    var getRealtimeSignals = /* @__PURE__ */ __name(function() {
      const length = SIGRTMAX - SIGRTMIN + 1;
      return Array.from({ length }, getRealtimeSignal);
    }, "getRealtimeSignals");
    exports.getRealtimeSignals = getRealtimeSignals;
    var getRealtimeSignal = /* @__PURE__ */ __name(function(value, index) {
      return {
        name: `SIGRT${index + 1}`,
        number: SIGRTMIN + index,
        action: "terminate",
        description: "Application-specific signal (realtime)",
        standard: "posix"
      };
    }, "getRealtimeSignal");
    var SIGRTMIN = 34;
    var SIGRTMAX = 64;
    exports.SIGRTMAX = SIGRTMAX;
  }
});

// node_modules/@remotion/renderer/node_modules/human-signals/build/src/signals.js
var require_signals = __commonJS({
  "node_modules/@remotion/renderer/node_modules/human-signals/build/src/signals.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSignals = void 0;
    var _os = __require("os");
    var _core = require_core();
    var _realtime = require_realtime();
    var getSignals = /* @__PURE__ */ __name(function() {
      const realtimeSignals = (0, _realtime.getRealtimeSignals)();
      const signals = [..._core.SIGNALS, ...realtimeSignals].map(normalizeSignal);
      return signals;
    }, "getSignals");
    exports.getSignals = getSignals;
    var normalizeSignal = /* @__PURE__ */ __name(function({
      name,
      number: defaultNumber,
      description,
      action,
      forced = false,
      standard
    }) {
      const {
        signals: { [name]: constantSignal }
      } = _os.constants;
      const supported = constantSignal !== void 0;
      const number = supported ? constantSignal : defaultNumber;
      return { name, number, description, supported, action, forced, standard };
    }, "normalizeSignal");
  }
});

// node_modules/@remotion/renderer/node_modules/human-signals/build/src/main.js
var require_main = __commonJS({
  "node_modules/@remotion/renderer/node_modules/human-signals/build/src/main.js"(exports) {
    "use strict";
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.signalsByNumber = exports.signalsByName = void 0;
    var _os = __require("os");
    var _signals = require_signals();
    var _realtime = require_realtime();
    var getSignalsByName = /* @__PURE__ */ __name(function() {
      const signals = (0, _signals.getSignals)();
      return signals.reduce(getSignalByName, {});
    }, "getSignalsByName");
    var getSignalByName = /* @__PURE__ */ __name(function(signalByNameMemo, { name, number, description, supported, action, forced, standard }) {
      return {
        ...signalByNameMemo,
        [name]: { name, number, description, supported, action, forced, standard }
      };
    }, "getSignalByName");
    var signalsByName = getSignalsByName();
    exports.signalsByName = signalsByName;
    var getSignalsByNumber = /* @__PURE__ */ __name(function() {
      const signals = (0, _signals.getSignals)();
      const length = _realtime.SIGRTMAX + 1;
      const signalsA = Array.from({ length }, (value, number) => getSignalByNumber(number, signals));
      return Object.assign({}, ...signalsA);
    }, "getSignalsByNumber");
    var getSignalByNumber = /* @__PURE__ */ __name(function(number, signals) {
      const signal = findSignalByNumber(number, signals);
      if (signal === void 0) {
        return {};
      }
      const { name, description, supported, action, forced, standard } = signal;
      return {
        [number]: {
          name,
          number,
          description,
          supported,
          action,
          forced,
          standard
        }
      };
    }, "getSignalByNumber");
    var findSignalByNumber = /* @__PURE__ */ __name(function(number, signals) {
      const signal = signals.find(({ name }) => _os.constants.signals[name] === number);
      if (signal !== void 0) {
        return signal;
      }
      return signals.find((signalA) => signalA.number === number);
    }, "findSignalByNumber");
    var signalsByNumber = getSignalsByNumber();
    exports.signalsByNumber = signalsByNumber;
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/error.js
var require_error = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/error.js"(exports, module) {
    "use strict";
    init_esm();
    var { signalsByName } = require_main();
    var getErrorPrefix = /* @__PURE__ */ __name(({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled }) => {
      if (timedOut) {
        return `timed out after ${timeout} milliseconds`;
      }
      if (isCanceled) {
        return "was canceled";
      }
      if (errorCode !== void 0) {
        return `failed with ${errorCode}`;
      }
      if (signal !== void 0) {
        return `was killed with ${signal} (${signalDescription})`;
      }
      if (exitCode !== void 0) {
        return `failed with exit code ${exitCode}`;
      }
      return "failed";
    }, "getErrorPrefix");
    var makeError = /* @__PURE__ */ __name(({
      stdout,
      stderr,
      all,
      error,
      signal,
      exitCode,
      command,
      escapedCommand,
      timedOut,
      isCanceled,
      killed,
      parsed: { options: { timeout } }
    }) => {
      exitCode = exitCode === null ? void 0 : exitCode;
      signal = signal === null ? void 0 : signal;
      const signalDescription = signal === void 0 ? void 0 : signalsByName[signal].description;
      const errorCode = error && error.code;
      const prefix = getErrorPrefix({ timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled });
      const execaMessage = `Command ${prefix}: ${command}`;
      const isError = Object.prototype.toString.call(error) === "[object Error]";
      const shortMessage = isError ? `${execaMessage}
${error.message}` : execaMessage;
      const message = [shortMessage, stderr, stdout].filter(Boolean).join("\n");
      if (isError) {
        error.originalMessage = error.message;
        error.message = message;
      } else {
        error = new Error(message);
      }
      error.shortMessage = shortMessage;
      error.command = command;
      error.escapedCommand = escapedCommand;
      error.exitCode = exitCode;
      error.signal = signal;
      error.signalDescription = signalDescription;
      error.stdout = stdout;
      error.stderr = stderr;
      if (all !== void 0) {
        error.all = all;
      }
      if ("bufferedData" in error) {
        delete error.bufferedData;
      }
      error.failed = true;
      error.timedOut = Boolean(timedOut);
      error.isCanceled = isCanceled;
      error.killed = killed && !timedOut;
      return error;
    }, "makeError");
    module.exports = makeError;
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/stdio.js
var require_stdio = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/stdio.js"(exports, module) {
    "use strict";
    init_esm();
    var aliases = ["stdin", "stdout", "stderr"];
    var hasAlias = /* @__PURE__ */ __name((options) => aliases.some((alias) => options[alias] !== void 0), "hasAlias");
    var normalizeStdio = /* @__PURE__ */ __name((options) => {
      if (!options) {
        return;
      }
      const { stdio } = options;
      if (stdio === void 0) {
        return aliases.map((alias) => options[alias]);
      }
      if (hasAlias(options)) {
        throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${aliases.map((alias) => `\`${alias}\``).join(", ")}`);
      }
      if (typeof stdio === "string") {
        return stdio;
      }
      if (!Array.isArray(stdio)) {
        throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
      }
      const length = Math.max(stdio.length, aliases.length);
      return Array.from({ length }, (value, index) => stdio[index]);
    }, "normalizeStdio");
    module.exports = normalizeStdio;
    module.exports.node = (options) => {
      const stdio = normalizeStdio(options);
      if (stdio === "ipc") {
        return "ipc";
      }
      if (stdio === void 0 || typeof stdio === "string") {
        return [stdio, stdio, stdio, "ipc"];
      }
      if (stdio.includes("ipc")) {
        return stdio;
      }
      return [...stdio, "ipc"];
    };
  }
});

// node_modules/@remotion/renderer/node_modules/signal-exit/signals.js
var require_signals2 = __commonJS({
  "node_modules/@remotion/renderer/node_modules/signal-exit/signals.js"(exports, module) {
    init_esm();
    module.exports = [
      "SIGABRT",
      "SIGALRM",
      "SIGHUP",
      "SIGINT",
      "SIGTERM"
    ];
    if (process.platform !== "win32") {
      module.exports.push(
        "SIGVTALRM",
        "SIGXCPU",
        "SIGXFSZ",
        "SIGUSR2",
        "SIGTRAP",
        "SIGSYS",
        "SIGQUIT",
        "SIGIOT"
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === "linux") {
      module.exports.push(
        "SIGIO",
        "SIGPOLL",
        "SIGPWR",
        "SIGSTKFLT",
        "SIGUNUSED"
      );
    }
  }
});

// node_modules/@remotion/renderer/node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  "node_modules/@remotion/renderer/node_modules/signal-exit/index.js"(exports, module) {
    init_esm();
    var process2 = global.process;
    var processOk = /* @__PURE__ */ __name(function(process3) {
      return process3 && typeof process3 === "object" && typeof process3.removeListener === "function" && typeof process3.emit === "function" && typeof process3.reallyExit === "function" && typeof process3.listeners === "function" && typeof process3.kill === "function" && typeof process3.pid === "number" && typeof process3.on === "function";
    }, "processOk");
    if (!processOk(process2)) {
      module.exports = function() {
        return function() {
        };
      };
    } else {
      assert3 = __require("assert");
      signals = require_signals2();
      isWin = /^win/i.test(process2.platform);
      EE = __require("events");
      if (typeof EE !== "function") {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module.exports = function(cb, opts) {
        if (!processOk(global.process)) {
          return function() {
          };
        }
        assert3.equal(typeof cb, "function", "a callback must be provided for exit handler");
        if (loaded === false) {
          load();
        }
        var ev = "exit";
        if (opts && opts.alwaysLast) {
          ev = "afterexit";
        }
        var remove = /* @__PURE__ */ __name(function() {
          emitter.removeListener(ev, cb);
          if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) {
            unload();
          }
        }, "remove");
        emitter.on(ev, cb);
        return remove;
      };
      unload = /* @__PURE__ */ __name(function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function(sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {
          }
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      }, "unload");
      module.exports.unload = unload;
      emit = /* @__PURE__ */ __name(function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      }, "emit");
      sigListeners = {};
      signals.forEach(function(sig) {
        sigListeners[sig] = /* @__PURE__ */ __name(function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit("exit", null, sig);
            emit("afterexit", null, sig);
            if (isWin && sig === "SIGHUP") {
              sig = "SIGINT";
            }
            process2.kill(process2.pid, sig);
          }
        }, "listener");
      });
      module.exports.signals = function() {
        return signals;
      };
      loaded = false;
      load = /* @__PURE__ */ __name(function load2() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function(sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      }, "load");
      module.exports.load = load;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = /* @__PURE__ */ __name(function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code || /* istanbul ignore next */
        0;
        emit("exit", process2.exitCode, null);
        emit("afterexit", process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      }, "processReallyExit");
      originalProcessEmit = process2.emit;
      processEmit = /* @__PURE__ */ __name(function processEmit2(ev, arg) {
        if (ev === "exit" && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit("exit", process2.exitCode, null);
          emit("afterexit", process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      }, "processEmit");
    }
    var assert3;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/kill.js
var require_kill = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/kill.js"(exports, module) {
    "use strict";
    init_esm();
    var os10 = __require("os");
    var onExit = require_signal_exit();
    var DEFAULT_FORCE_KILL_TIMEOUT = 1e3 * 5;
    var spawnedKill = /* @__PURE__ */ __name((kill, signal = "SIGTERM", options = {}) => {
      const killResult = kill(signal);
      setKillTimeout(kill, signal, options, killResult);
      return killResult;
    }, "spawnedKill");
    var setKillTimeout = /* @__PURE__ */ __name((kill, signal, options, killResult) => {
      if (!shouldForceKill(signal, options, killResult)) {
        return;
      }
      const timeout = getForceKillAfterTimeout(options);
      const t = setTimeout(() => {
        kill("SIGKILL");
      }, timeout);
      if (t.unref) {
        t.unref();
      }
    }, "setKillTimeout");
    var shouldForceKill = /* @__PURE__ */ __name((signal, { forceKillAfterTimeout }, killResult) => {
      return isSigterm(signal) && forceKillAfterTimeout !== false && killResult;
    }, "shouldForceKill");
    var isSigterm = /* @__PURE__ */ __name((signal) => {
      return signal === os10.constants.signals.SIGTERM || typeof signal === "string" && signal.toUpperCase() === "SIGTERM";
    }, "isSigterm");
    var getForceKillAfterTimeout = /* @__PURE__ */ __name(({ forceKillAfterTimeout = true }) => {
      if (forceKillAfterTimeout === true) {
        return DEFAULT_FORCE_KILL_TIMEOUT;
      }
      if (!Number.isFinite(forceKillAfterTimeout) || forceKillAfterTimeout < 0) {
        throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${forceKillAfterTimeout}\` (${typeof forceKillAfterTimeout})`);
      }
      return forceKillAfterTimeout;
    }, "getForceKillAfterTimeout");
    var spawnedCancel = /* @__PURE__ */ __name((spawned, context) => {
      const killResult = spawned.kill();
      if (killResult) {
        context.isCanceled = true;
      }
    }, "spawnedCancel");
    var timeoutKill = /* @__PURE__ */ __name((spawned, signal, reject) => {
      spawned.kill(signal);
      reject(Object.assign(new Error("Timed out"), { timedOut: true, signal }));
    }, "timeoutKill");
    var setupTimeout = /* @__PURE__ */ __name((spawned, { timeout, killSignal = "SIGTERM" }, spawnedPromise) => {
      if (timeout === 0 || timeout === void 0) {
        return spawnedPromise;
      }
      let timeoutId;
      const timeoutPromise = new Promise((resolve3, reject) => {
        timeoutId = setTimeout(() => {
          timeoutKill(spawned, killSignal, reject);
        }, timeout);
      });
      const safeSpawnedPromise = spawnedPromise.finally(() => {
        clearTimeout(timeoutId);
      });
      return Promise.race([timeoutPromise, safeSpawnedPromise]);
    }, "setupTimeout");
    var validateTimeout = /* @__PURE__ */ __name(({ timeout }) => {
      if (timeout !== void 0 && (!Number.isFinite(timeout) || timeout < 0)) {
        throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
      }
    }, "validateTimeout");
    var setExitHandler = /* @__PURE__ */ __name(async (spawned, { cleanup, detached }, timedPromise) => {
      if (!cleanup || detached) {
        return timedPromise;
      }
      const removeExitHandler = onExit(() => {
        spawned.kill();
      });
      return timedPromise.finally(() => {
        removeExitHandler();
      });
    }, "setExitHandler");
    module.exports = {
      spawnedKill,
      spawnedCancel,
      setupTimeout,
      validateTimeout,
      setExitHandler
    };
  }
});

// node_modules/@remotion/renderer/node_modules/is-stream/index.js
var require_is_stream = __commonJS({
  "node_modules/@remotion/renderer/node_modules/is-stream/index.js"(exports, module) {
    "use strict";
    init_esm();
    var isStream = /* @__PURE__ */ __name((stream) => stream !== null && typeof stream === "object" && typeof stream.pipe === "function", "isStream");
    isStream.writable = (stream) => isStream(stream) && stream.writable !== false && typeof stream._write === "function" && typeof stream._writableState === "object";
    isStream.readable = (stream) => isStream(stream) && stream.readable !== false && typeof stream._read === "function" && typeof stream._readableState === "object";
    isStream.duplex = (stream) => isStream.writable(stream) && isStream.readable(stream);
    isStream.transform = (stream) => isStream.duplex(stream) && typeof stream._transform === "function";
    module.exports = isStream;
  }
});

// node_modules/@remotion/renderer/node_modules/get-stream/buffer-stream.js
var require_buffer_stream = __commonJS({
  "node_modules/@remotion/renderer/node_modules/get-stream/buffer-stream.js"(exports, module) {
    "use strict";
    init_esm();
    var { PassThrough: PassThroughStream } = __require("stream");
    module.exports = (options) => {
      options = { ...options };
      const { array } = options;
      let { encoding } = options;
      const isBuffer = encoding === "buffer";
      let objectMode = false;
      if (array) {
        objectMode = !(encoding || isBuffer);
      } else {
        encoding = encoding || "utf8";
      }
      if (isBuffer) {
        encoding = null;
      }
      const stream = new PassThroughStream({ objectMode });
      if (encoding) {
        stream.setEncoding(encoding);
      }
      let length = 0;
      const chunks = [];
      stream.on("data", (chunk3) => {
        chunks.push(chunk3);
        if (objectMode) {
          length = chunks.length;
        } else {
          length += chunk3.length;
        }
      });
      stream.getBufferedValue = () => {
        if (array) {
          return chunks;
        }
        return isBuffer ? Buffer.concat(chunks, length) : chunks.join("");
      };
      stream.getBufferedLength = () => length;
      return stream;
    };
  }
});

// node_modules/@remotion/renderer/node_modules/get-stream/index.js
var require_get_stream = __commonJS({
  "node_modules/@remotion/renderer/node_modules/get-stream/index.js"(exports, module) {
    "use strict";
    init_esm();
    var { constants: BufferConstants } = __require("buffer");
    var stream = __require("stream");
    var { promisify: promisify2 } = __require("util");
    var bufferStream = require_buffer_stream();
    var streamPipelinePromisified = promisify2(stream.pipeline);
    var MaxBufferError = class extends Error {
      static {
        __name(this, "MaxBufferError");
      }
      constructor() {
        super("maxBuffer exceeded");
        this.name = "MaxBufferError";
      }
    };
    async function getStream(inputStream, options) {
      if (!inputStream) {
        throw new Error("Expected a stream");
      }
      options = {
        maxBuffer: Infinity,
        ...options
      };
      const { maxBuffer } = options;
      const stream2 = bufferStream(options);
      await new Promise((resolve3, reject) => {
        const rejectPromise = /* @__PURE__ */ __name((error) => {
          if (error && stream2.getBufferedLength() <= BufferConstants.MAX_LENGTH) {
            error.bufferedData = stream2.getBufferedValue();
          }
          reject(error);
        }, "rejectPromise");
        (async () => {
          try {
            await streamPipelinePromisified(inputStream, stream2);
            resolve3();
          } catch (error) {
            rejectPromise(error);
          }
        })();
        stream2.on("data", () => {
          if (stream2.getBufferedLength() > maxBuffer) {
            rejectPromise(new MaxBufferError());
          }
        });
      });
      return stream2.getBufferedValue();
    }
    __name(getStream, "getStream");
    module.exports = getStream;
    module.exports.buffer = (stream2, options) => getStream(stream2, { ...options, encoding: "buffer" });
    module.exports.array = (stream2, options) => getStream(stream2, { ...options, array: true });
    module.exports.MaxBufferError = MaxBufferError;
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/stream.js
var require_stream = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/stream.js"(exports, module) {
    "use strict";
    init_esm();
    var isStream = require_is_stream();
    var getStream = require_get_stream();
    var mergeStream = require_merge_stream();
    var handleInput = /* @__PURE__ */ __name((spawned, input) => {
      if (input === void 0 || spawned.stdin === void 0) {
        return;
      }
      if (isStream(input)) {
        input.pipe(spawned.stdin);
      } else {
        spawned.stdin.end(input);
      }
    }, "handleInput");
    var makeAllStream = /* @__PURE__ */ __name((spawned, { all }) => {
      if (!all || !spawned.stdout && !spawned.stderr) {
        return;
      }
      const mixed = mergeStream();
      if (spawned.stdout) {
        mixed.add(spawned.stdout);
      }
      if (spawned.stderr) {
        mixed.add(spawned.stderr);
      }
      return mixed;
    }, "makeAllStream");
    var getBufferedData = /* @__PURE__ */ __name(async (stream, streamPromise) => {
      if (!stream) {
        return;
      }
      stream.destroy();
      try {
        return await streamPromise;
      } catch (error) {
        return error.bufferedData;
      }
    }, "getBufferedData");
    var getStreamPromise = /* @__PURE__ */ __name((stream, { encoding, buffer, maxBuffer }) => {
      if (!stream || !buffer) {
        return;
      }
      if (encoding) {
        return getStream(stream, { encoding, maxBuffer });
      }
      return getStream.buffer(stream, { maxBuffer });
    }, "getStreamPromise");
    var getSpawnedResult = /* @__PURE__ */ __name(async ({ stdout, stderr, all }, { encoding, buffer, maxBuffer }, processDone) => {
      const stdoutPromise = getStreamPromise(stdout, { encoding, buffer, maxBuffer });
      const stderrPromise = getStreamPromise(stderr, { encoding, buffer, maxBuffer });
      const allPromise = getStreamPromise(all, { encoding, buffer, maxBuffer: maxBuffer * 2 });
      try {
        return await Promise.all([processDone, stdoutPromise, stderrPromise, allPromise]);
      } catch (error) {
        return Promise.all([
          { error, signal: error.signal, timedOut: error.timedOut },
          getBufferedData(stdout, stdoutPromise),
          getBufferedData(stderr, stderrPromise),
          getBufferedData(all, allPromise)
        ]);
      }
    }, "getSpawnedResult");
    var validateInputSync = /* @__PURE__ */ __name(({ input }) => {
      if (isStream(input)) {
        throw new TypeError("The `input` option cannot be a stream in sync mode");
      }
    }, "validateInputSync");
    module.exports = {
      handleInput,
      makeAllStream,
      getSpawnedResult,
      validateInputSync
    };
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/promise.js
var require_promise = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/promise.js"(exports, module) {
    "use strict";
    init_esm();
    var nativePromisePrototype = (async () => {
    })().constructor.prototype;
    var descriptors = ["then", "catch", "finally"].map((property) => [
      property,
      Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)
    ]);
    var mergePromise = /* @__PURE__ */ __name((spawned, promise) => {
      for (const [property, descriptor] of descriptors) {
        const value = typeof promise === "function" ? (...args) => Reflect.apply(descriptor.value, promise(), args) : descriptor.value.bind(promise);
        Reflect.defineProperty(spawned, property, { ...descriptor, value });
      }
      return spawned;
    }, "mergePromise");
    var getSpawnedPromise = /* @__PURE__ */ __name((spawned) => {
      return new Promise((resolve3, reject) => {
        spawned.on("exit", (exitCode, signal) => {
          resolve3({ exitCode, signal });
        });
        spawned.on("error", (error) => {
          reject(error);
        });
        if (spawned.stdin) {
          spawned.stdin.on("error", (error) => {
            reject(error);
          });
        }
      });
    }, "getSpawnedPromise");
    module.exports = {
      mergePromise,
      getSpawnedPromise
    };
  }
});

// node_modules/@remotion/renderer/node_modules/execa/lib/command.js
var require_command = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/lib/command.js"(exports, module) {
    "use strict";
    init_esm();
    var normalizeArgs = /* @__PURE__ */ __name((file, args = []) => {
      if (!Array.isArray(args)) {
        return [file];
      }
      return [file, ...args];
    }, "normalizeArgs");
    var NO_ESCAPE_REGEXP = /^[\w.-]+$/;
    var DOUBLE_QUOTES_REGEXP = /"/g;
    var escapeArg = /* @__PURE__ */ __name((arg) => {
      if (typeof arg !== "string" || NO_ESCAPE_REGEXP.test(arg)) {
        return arg;
      }
      return `"${arg.replace(DOUBLE_QUOTES_REGEXP, '\\"')}"`;
    }, "escapeArg");
    var joinCommand = /* @__PURE__ */ __name((file, args) => {
      return normalizeArgs(file, args).join(" ");
    }, "joinCommand");
    var getEscapedCommand = /* @__PURE__ */ __name((file, args) => {
      return normalizeArgs(file, args).map((arg) => escapeArg(arg)).join(" ");
    }, "getEscapedCommand");
    var SPACES_REGEXP = / +/g;
    var parseCommand = /* @__PURE__ */ __name((command) => {
      const tokens = [];
      for (const token of command.trim().split(SPACES_REGEXP)) {
        const previousToken = tokens[tokens.length - 1];
        if (previousToken && previousToken.endsWith("\\")) {
          tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`;
        } else {
          tokens.push(token);
        }
      }
      return tokens;
    }, "parseCommand");
    module.exports = {
      joinCommand,
      getEscapedCommand,
      parseCommand
    };
  }
});

// node_modules/@remotion/renderer/node_modules/execa/index.js
var require_execa = __commonJS({
  "node_modules/@remotion/renderer/node_modules/execa/index.js"(exports, module) {
    "use strict";
    init_esm();
    var path28 = __require("path");
    var childProcess2 = __require("child_process");
    var crossSpawn = require_cross_spawn();
    var stripFinalNewline = require_strip_final_newline();
    var npmRunPath = require_npm_run_path();
    var onetime = require_onetime();
    var makeError = require_error();
    var normalizeStdio = require_stdio();
    var { spawnedKill, spawnedCancel, setupTimeout, validateTimeout, setExitHandler } = require_kill();
    var { handleInput, getSpawnedResult, makeAllStream, validateInputSync } = require_stream();
    var { mergePromise, getSpawnedPromise } = require_promise();
    var { joinCommand, parseCommand, getEscapedCommand } = require_command();
    var DEFAULT_MAX_BUFFER = 1e3 * 1e3 * 100;
    var getEnv = /* @__PURE__ */ __name(({ env: envOption, extendEnv, preferLocal, localDir, execPath }) => {
      const env = extendEnv ? { ...process.env, ...envOption } : envOption;
      if (preferLocal) {
        return npmRunPath.env({ env, cwd: localDir, execPath });
      }
      return env;
    }, "getEnv");
    var handleArguments = /* @__PURE__ */ __name((file, args, options = {}) => {
      const parsed = crossSpawn._parse(file, args, options);
      file = parsed.command;
      args = parsed.args;
      options = parsed.options;
      options = {
        maxBuffer: DEFAULT_MAX_BUFFER,
        buffer: true,
        stripFinalNewline: true,
        extendEnv: true,
        preferLocal: false,
        localDir: options.cwd || process.cwd(),
        execPath: process.execPath,
        encoding: "utf8",
        reject: true,
        cleanup: true,
        all: false,
        windowsHide: true,
        ...options
      };
      options.env = getEnv(options);
      options.stdio = normalizeStdio(options);
      if (process.platform === "win32" && path28.basename(file, ".exe") === "cmd") {
        args.unshift("/q");
      }
      return { file, args, options, parsed };
    }, "handleArguments");
    var handleOutput = /* @__PURE__ */ __name((options, value, error) => {
      if (typeof value !== "string" && !Buffer.isBuffer(value)) {
        return error === void 0 ? void 0 : "";
      }
      if (options.stripFinalNewline) {
        return stripFinalNewline(value);
      }
      return value;
    }, "handleOutput");
    var execa3 = /* @__PURE__ */ __name((file, args, options) => {
      const parsed = handleArguments(file, args, options);
      const command = joinCommand(file, args);
      const escapedCommand = getEscapedCommand(file, args);
      validateTimeout(parsed.options);
      let spawned;
      try {
        spawned = childProcess2.spawn(parsed.file, parsed.args, parsed.options);
      } catch (error) {
        const dummySpawned = new childProcess2.ChildProcess();
        const errorPromise = Promise.reject(makeError({
          error,
          stdout: "",
          stderr: "",
          all: "",
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false
        }));
        return mergePromise(dummySpawned, errorPromise);
      }
      const spawnedPromise = getSpawnedPromise(spawned);
      const timedPromise = setupTimeout(spawned, parsed.options, spawnedPromise);
      const processDone = setExitHandler(spawned, parsed.options, timedPromise);
      const context = { isCanceled: false };
      spawned.kill = spawnedKill.bind(null, spawned.kill.bind(spawned));
      spawned.cancel = spawnedCancel.bind(null, spawned, context);
      const handlePromise = /* @__PURE__ */ __name(async () => {
        const [{ error, exitCode, signal, timedOut }, stdoutResult, stderrResult, allResult] = await getSpawnedResult(spawned, parsed.options, processDone);
        const stdout = handleOutput(parsed.options, stdoutResult);
        const stderr = handleOutput(parsed.options, stderrResult);
        const all = handleOutput(parsed.options, allResult);
        if (error || exitCode !== 0 || signal !== null) {
          const returnedError = makeError({
            error,
            exitCode,
            signal,
            stdout,
            stderr,
            all,
            command,
            escapedCommand,
            parsed,
            timedOut,
            isCanceled: context.isCanceled,
            killed: spawned.killed
          });
          if (!parsed.options.reject) {
            return returnedError;
          }
          throw returnedError;
        }
        return {
          command,
          escapedCommand,
          exitCode: 0,
          stdout,
          stderr,
          all,
          failed: false,
          timedOut: false,
          isCanceled: false,
          killed: false
        };
      }, "handlePromise");
      const handlePromiseOnce = onetime(handlePromise);
      handleInput(spawned, parsed.options.input);
      spawned.all = makeAllStream(spawned, parsed.options);
      return mergePromise(spawned, handlePromiseOnce);
    }, "execa");
    module.exports = execa3;
    module.exports.sync = (file, args, options) => {
      const parsed = handleArguments(file, args, options);
      const command = joinCommand(file, args);
      const escapedCommand = getEscapedCommand(file, args);
      validateInputSync(parsed.options);
      let result;
      try {
        result = childProcess2.spawnSync(parsed.file, parsed.args, parsed.options);
      } catch (error) {
        throw makeError({
          error,
          stdout: "",
          stderr: "",
          all: "",
          command,
          escapedCommand,
          parsed,
          timedOut: false,
          isCanceled: false,
          killed: false
        });
      }
      const stdout = handleOutput(parsed.options, result.stdout, result.error);
      const stderr = handleOutput(parsed.options, result.stderr, result.error);
      if (result.error || result.status !== 0 || result.signal !== null) {
        const error = makeError({
          stdout,
          stderr,
          error: result.error,
          signal: result.signal,
          exitCode: result.status,
          command,
          escapedCommand,
          parsed,
          timedOut: result.error && result.error.code === "ETIMEDOUT",
          isCanceled: false,
          killed: result.signal !== null
        });
        if (!parsed.options.reject) {
          return error;
        }
        throw error;
      }
      return {
        command,
        escapedCommand,
        exitCode: 0,
        stdout,
        stderr,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false
      };
    };
    module.exports.command = (command, options) => {
      const [file, ...args] = parseCommand(command);
      return execa3(file, args, options);
    };
    module.exports.commandSync = (command, options) => {
      const [file, ...args] = parseCommand(command);
      return execa3.sync(file, args, options);
    };
    module.exports.node = (scriptPath, args, options = {}) => {
      if (args && !Array.isArray(args) && typeof args === "object") {
        options = args;
        args = [];
      }
      const stdio = normalizeStdio.node(options);
      const defaultExecArgv = process.execArgv.filter((arg) => !arg.startsWith("--inspect"));
      const {
        nodePath = process.execPath,
        nodeOptions = defaultExecArgv
      } = options;
      return execa3(
        nodePath,
        [
          ...nodeOptions,
          scriptPath,
          ...Array.isArray(args) ? args : []
        ],
        {
          ...options,
          stdin: void 0,
          stdout: void 0,
          stderr: void 0,
          stdio,
          shell: false
        }
      );
    };
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/stream.js
var require_stream2 = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    init_esm();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    __name(emitClose, "emitClose");
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    __name(duplexOnEnd, "duplexOnEnd");
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    __name(duplexOnError, "duplexOnError");
    function createWebSocketStream2(ws2, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws2.on("message", /* @__PURE__ */ __name(function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws2.pause();
      }, "message"));
      ws2.once("error", /* @__PURE__ */ __name(function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      }, "error"));
      ws2.once("close", /* @__PURE__ */ __name(function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      }, "close"));
      duplex._destroy = function(err, callback) {
        if (ws2.readyState === ws2.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws2.once("error", /* @__PURE__ */ __name(function error(err2) {
          called = true;
          callback(err2);
        }, "error"));
        ws2.once("close", /* @__PURE__ */ __name(function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        }, "close"));
        if (terminateOnDestroy) ws2.terminate();
      };
      duplex._final = function(callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", /* @__PURE__ */ __name(function open() {
            duplex._final(callback);
          }, "open"));
          return;
        }
        if (ws2._socket === null) return;
        if (ws2._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws2._socket.once("finish", /* @__PURE__ */ __name(function finish() {
            callback();
          }, "finish"));
          ws2.close();
        }
      };
      duplex._read = function() {
        if (ws2.isPaused) ws2.resume();
      };
      duplex._write = function(chunk3, encoding, callback) {
        if (ws2.readyState === ws2.CONNECTING) {
          ws2.once("open", /* @__PURE__ */ __name(function open() {
            duplex._write(chunk3, encoding, callback);
          }, "open"));
          return;
        }
        ws2.send(chunk3, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    __name(createWebSocketStream2, "createWebSocketStream");
    module.exports = createWebSocketStream2;
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = {
      BINARY_TYPES: ["nodebuffer", "arraybuffer", "fragments"],
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: /* @__PURE__ */ __name(() => {
      }, "NOOP")
    };
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    init_esm();
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    __name(concat, "concat");
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    __name(_mask, "_mask");
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    __name(_unmask, "_unmask");
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    __name(toArrayBuffer, "toArrayBuffer");
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    __name(toBuffer, "toBuffer");
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    init_esm();
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      static {
        __name(this, "Limiter");
      }
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    init_esm();
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate = class {
      static {
        __name(this, "PerMessageDeflate");
      }
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       * @param {Boolean} [isServer=false] Create the instance in either server or
       *     client mode
       * @param {Number} [maxPayload=0] The maximum allowed message length
       */
      constructor(options, isServer, maxPayload) {
        this._maxPayload = maxPayload | 0;
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._isServer = !!isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate;
    function deflateOnData(chunk3) {
      this[kBuffers].push(chunk3);
      this[kTotalLength] += chunk3.length;
    }
    __name(deflateOnData, "deflateOnData");
    function inflateOnData(chunk3) {
      this[kTotalLength] += chunk3.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk3);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    __name(inflateOnData, "inflateOnData");
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
    __name(inflateOnError, "inflateOnError");
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    init_esm();
    var { isUtf8 } = __require("buffer");
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    __name(isValidStatusCode, "isValidStatusCode");
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    __name(_isValidUTF8, "_isValidUTF8");
    module.exports = {
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    init_esm();
    var { Writable } = __require("stream");
    var PerMessageDeflate = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      static {
        __name(this, "Receiver");
      }
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk3, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        this._bufferedBytes += chunk3.length;
        this._buffers.push(chunk3);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    init_esm();
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var PerMessageDeflate = require_permessage_deflate();
    var { EMPTY_BUFFER } = require_constants();
    var { isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var Sender2 = class _Sender {
      static {
        __name(this, "Sender");
      }
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions2, generateMask) {
        this._extensions = extensions2 || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._deflating = false;
        this._queue = [];
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else {
            buf.set(data, 2);
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._deflating) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (this._deflating) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (this._deflating) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        if (perMessageDeflate) {
          const opts = {
            [kByteLength]: byteLength,
            fin: options.fin,
            generateMask: this._generateMask,
            mask: options.mask,
            maskBuffer: this._maskBuffer,
            opcode,
            readOnly,
            rsv1
          };
          if (this._deflating) {
            this.enqueue([this.dispatch, data, this._compress, opts, cb]);
          } else {
            this.dispatch(data, this._compress, opts, cb);
          }
        } else {
          this.sendFrame(
            _Sender.frame(data, {
              [kByteLength]: byteLength,
              fin: options.fin,
              generateMask: this._generateMask,
              mask: options.mask,
              maskBuffer: this._maskBuffer,
              opcode,
              readOnly,
              rsv1: false
            }),
            cb
          );
        }
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._deflating = true;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            if (typeof cb === "function") cb(err);
            for (let i = 0; i < this._queue.length; i++) {
              const params = this._queue[i];
              const callback = params[params.length - 1];
              if (typeof callback === "function") callback(err);
            }
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._deflating = false;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (!this._deflating && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {Buffer[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    init_esm();
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      static {
        __name(this, "Event");
      }
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      static {
        __name(this, "CloseEvent");
      }
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      static {
        __name(this, "ErrorEvent");
      }
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      static {
        __name(this, "MessageEvent");
      }
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = /* @__PURE__ */ __name(function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          }, "onMessage");
        } else if (type === "close") {
          wrapper = /* @__PURE__ */ __name(function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          }, "onClose");
        } else if (type === "error") {
          wrapper = /* @__PURE__ */ __name(function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          }, "onError");
        } else if (type === "open") {
          wrapper = /* @__PURE__ */ __name(function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          }, "onOpen");
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
    __name(callListener, "callListener");
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    init_esm();
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    __name(push, "push");
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    __name(parse, "parse");
    function format2(extensions2) {
      return Object.keys(extensions2).map((extension) => {
        let configurations = extensions2[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    __name(format2, "format");
    module.exports = { format: format2, parse };
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    init_esm();
    var EventEmitter2 = __require("events");
    var https2 = __require("https");
    var http3 = __require("http");
    var net2 = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL3 } = __require("url");
    var PerMessageDeflate = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener: addEventListener2, removeEventListener }
    } = require_event_target();
    var { format: format2, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var closeTimeout = 30 * 1e3;
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter2 {
      static {
        __name(this, "WebSocket");
      }
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._isServer = true;
        }
      }
      /**
       * This deviates from the WHATWG interface since ws doesn't support the
       * required default "blob" type (instead we define a custom "nodebuffer"
       * type).
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        this._sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._socket = socket;
        receiver[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate.extensionName]) {
          this._extensions[PerMessageDeflate.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._closeTimer = setTimeout(
          this._socket.destroy.bind(this._socket),
          closeTimeout
        );
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener2;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        protocolVersion: protocolVersions[1],
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL3) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL3(address);
        } catch (e) {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https2.request : http3.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate(
          opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
          false,
          opts.maxPayload
        );
        opts.headers["Sec-WebSocket-Extensions"] = format2({
          [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL3(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions2;
          try {
            extensions2 = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions2);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions2[PerMessageDeflate.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    __name(initAsClient, "initAsClient");
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    __name(emitErrorAndClose, "emitErrorAndClose");
    function netConnect(options) {
      options.path = options.socketPath;
      return net2.connect(options);
    }
    __name(netConnect, "netConnect");
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net2.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    __name(tlsConnect, "tlsConnect");
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    __name(abortHandshake, "abortHandshake");
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    __name(sendAfterClose, "sendAfterClose");
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    __name(receiverOnConclude, "receiverOnConclude");
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    __name(receiverOnDrain, "receiverOnDrain");
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      websocket.emit("error", err);
    }
    __name(receiverOnError, "receiverOnError");
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    __name(receiverOnFinish, "receiverOnFinish");
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    __name(receiverOnMessage, "receiverOnMessage");
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    __name(receiverOnPing, "receiverOnPing");
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    __name(receiverOnPong, "receiverOnPong");
    function resume(stream) {
      stream.resume();
    }
    __name(resume, "resume");
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      let chunk3;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk3 = websocket._socket.read()) !== null) {
        websocket._receiver.write(chunk3);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    __name(socketOnClose, "socketOnClose");
    function socketOnData(chunk3) {
      if (!this[kWebSocket]._receiver.write(chunk3)) {
        this.pause();
      }
    }
    __name(socketOnData, "socketOnData");
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    __name(socketOnEnd, "socketOnEnd");
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
    __name(socketOnError, "socketOnError");
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    init_esm();
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    __name(parse, "parse");
    module.exports = { parse };
  }
});

// node_modules/@remotion/renderer/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/@remotion/renderer/node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    init_esm();
    var EventEmitter2 = __require("events");
    var http3 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension = require_extension();
    var PerMessageDeflate = require_permessage_deflate();
    var subprotocol = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter2 {
      static {
        __name(this, "WebSocketServer");
      }
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http3.createServer((req, res) => {
            const body = http3.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: /* @__PURE__ */ __name((req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }, "upgrade")
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 8 && version !== 13) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions2 = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate(
            this.options.perMessageDeflate,
            true,
            this.options.maxPayload
          );
          try {
            const offers = extension.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
              extensions2[PerMessageDeflate.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions2,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions2, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions2, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws2 = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws2._protocol = protocol;
          }
        }
        if (extensions2[PerMessageDeflate.extensionName]) {
          const params = extensions2[PerMessageDeflate.extensionName].params;
          const value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws2._extensions = extensions2;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws2.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws2);
          ws2.on("close", () => {
            this.clients.delete(ws2);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws2, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map3) {
      for (const event of Object.keys(map3)) server.on(event, map3[event]);
      return /* @__PURE__ */ __name(function removeListeners() {
        for (const event of Object.keys(map3)) {
          server.removeListener(event, map3[event]);
        }
      }, "removeListeners");
    }
    __name(addListeners, "addListeners");
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    __name(emitClose, "emitClose");
    function socketOnError() {
      this.destroy();
    }
    __name(socketOnError, "socketOnError");
    function abortHandshake(socket, code, message, headers) {
      message = message || http3.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http3.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    __name(abortHandshake, "abortHandshake");
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message);
      }
    }
    __name(abortHandshakeOrEmitwsClientError, "abortHandshakeOrEmitwsClientError");
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/base64.js
var require_base64 = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/base64.js"(exports) {
    init_esm();
    var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
    exports.encode = function(number) {
      if (0 <= number && number < intToCharMap.length) {
        return intToCharMap[number];
      }
      throw new TypeError("Must be between 0 and 63: " + number);
    };
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/base64-vlq.js
var require_base64_vlq = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/base64-vlq.js"(exports) {
    init_esm();
    var base64 = require_base64();
    var VLQ_BASE_SHIFT = 5;
    var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
    var VLQ_BASE_MASK = VLQ_BASE - 1;
    var VLQ_CONTINUATION_BIT = VLQ_BASE;
    function toVLQSigned(aValue) {
      return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
    }
    __name(toVLQSigned, "toVLQSigned");
    exports.encode = /* @__PURE__ */ __name(function base64VLQ_encode(aValue) {
      let encoded = "";
      let digit;
      let vlq = toVLQSigned(aValue);
      do {
        digit = vlq & VLQ_BASE_MASK;
        vlq >>>= VLQ_BASE_SHIFT;
        if (vlq > 0) {
          digit |= VLQ_CONTINUATION_BIT;
        }
        encoded += base64.encode(digit);
      } while (vlq > 0);
      return encoded;
    }, "base64VLQ_encode");
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/url.js
var require_url = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/url.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = typeof URL === "function" ? URL : __require("url").URL;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/util.js
var require_util = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/util.js"(exports) {
    init_esm();
    var URL3 = require_url();
    function getArg(aArgs, aName, aDefaultValue) {
      if (aName in aArgs) {
        return aArgs[aName];
      } else if (arguments.length === 3) {
        return aDefaultValue;
      }
      throw new Error('"' + aName + '" is a required argument.');
    }
    __name(getArg, "getArg");
    exports.getArg = getArg;
    var supportsNullProto = function() {
      const obj = /* @__PURE__ */ Object.create(null);
      return !("__proto__" in obj);
    }();
    function identity(s) {
      return s;
    }
    __name(identity, "identity");
    function toSetString(aStr) {
      if (isProtoString(aStr)) {
        return "$" + aStr;
      }
      return aStr;
    }
    __name(toSetString, "toSetString");
    exports.toSetString = supportsNullProto ? identity : toSetString;
    function fromSetString(aStr) {
      if (isProtoString(aStr)) {
        return aStr.slice(1);
      }
      return aStr;
    }
    __name(fromSetString, "fromSetString");
    exports.fromSetString = supportsNullProto ? identity : fromSetString;
    function isProtoString(s) {
      if (!s) {
        return false;
      }
      const length = s.length;
      if (length < 9) {
        return false;
      }
      if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) {
        return false;
      }
      for (let i = length - 10; i >= 0; i--) {
        if (s.charCodeAt(i) !== 36) {
          return false;
        }
      }
      return true;
    }
    __name(isProtoString, "isProtoString");
    function strcmp(aStr1, aStr2) {
      if (aStr1 === aStr2) {
        return 0;
      }
      if (aStr1 === null) {
        return 1;
      }
      if (aStr2 === null) {
        return -1;
      }
      if (aStr1 > aStr2) {
        return 1;
      }
      return -1;
    }
    __name(strcmp, "strcmp");
    function compareByGeneratedPositionsInflated(mappingA, mappingB) {
      let cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    __name(compareByGeneratedPositionsInflated, "compareByGeneratedPositionsInflated");
    exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
    function parseSourceMapInput(str) {
      return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
    }
    __name(parseSourceMapInput, "parseSourceMapInput");
    exports.parseSourceMapInput = parseSourceMapInput;
    var PROTOCOL = "http:";
    var PROTOCOL_AND_HOST = `${PROTOCOL}//host`;
    function createSafeHandler(cb) {
      return (input) => {
        const type = getURLType(input);
        const base = buildSafeBase(input);
        const url2 = new URL3(input, base);
        cb(url2);
        const result = url2.toString();
        if (type === "absolute") {
          return result;
        } else if (type === "scheme-relative") {
          return result.slice(PROTOCOL.length);
        } else if (type === "path-absolute") {
          return result.slice(PROTOCOL_AND_HOST.length);
        }
        return computeRelativeURL(base, result);
      };
    }
    __name(createSafeHandler, "createSafeHandler");
    function withBase(url2, base) {
      return new URL3(url2, base).toString();
    }
    __name(withBase, "withBase");
    function buildUniqueSegment(prefix, str) {
      let id = 0;
      do {
        const ident = prefix + id++;
        if (str.indexOf(ident) === -1) return ident;
      } while (true);
    }
    __name(buildUniqueSegment, "buildUniqueSegment");
    function buildSafeBase(str) {
      const maxDotParts = str.split("..").length - 1;
      const segment = buildUniqueSegment("p", str);
      let base = `${PROTOCOL_AND_HOST}/`;
      for (let i = 0; i < maxDotParts; i++) {
        base += `${segment}/`;
      }
      return base;
    }
    __name(buildSafeBase, "buildSafeBase");
    var ABSOLUTE_SCHEME = /^[A-Za-z0-9\+\-\.]+:/;
    function getURLType(url2) {
      if (url2[0] === "/") {
        if (url2[1] === "/") return "scheme-relative";
        return "path-absolute";
      }
      return ABSOLUTE_SCHEME.test(url2) ? "absolute" : "path-relative";
    }
    __name(getURLType, "getURLType");
    function computeRelativeURL(rootURL, targetURL) {
      if (typeof rootURL === "string") rootURL = new URL3(rootURL);
      if (typeof targetURL === "string") targetURL = new URL3(targetURL);
      const targetParts = targetURL.pathname.split("/");
      const rootParts = rootURL.pathname.split("/");
      if (rootParts.length > 0 && !rootParts[rootParts.length - 1]) {
        rootParts.pop();
      }
      while (targetParts.length > 0 && rootParts.length > 0 && targetParts[0] === rootParts[0]) {
        targetParts.shift();
        rootParts.shift();
      }
      const relativePath = rootParts.map(() => "..").concat(targetParts).join("/");
      return relativePath + targetURL.search + targetURL.hash;
    }
    __name(computeRelativeURL, "computeRelativeURL");
    var ensureDirectory = createSafeHandler((url2) => {
      url2.pathname = url2.pathname.replace(/\/?$/, "/");
    });
    var trimFilename = createSafeHandler((url2) => {
      url2.href = new URL3(".", url2.toString()).toString();
    });
    var normalize = createSafeHandler((url2) => {
    });
    exports.normalize = normalize;
    function join6(aRoot, aPath) {
      const pathType = getURLType(aPath);
      const rootType = getURLType(aRoot);
      aRoot = ensureDirectory(aRoot);
      if (pathType === "absolute") {
        return withBase(aPath, void 0);
      }
      if (rootType === "absolute") {
        return withBase(aPath, aRoot);
      }
      if (pathType === "scheme-relative") {
        return normalize(aPath);
      }
      if (rootType === "scheme-relative") {
        return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(PROTOCOL.length);
      }
      if (pathType === "path-absolute") {
        return normalize(aPath);
      }
      if (rootType === "path-absolute") {
        return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(PROTOCOL_AND_HOST.length);
      }
      const base = buildSafeBase(aPath + aRoot);
      const newPath = withBase(aPath, withBase(aRoot, base));
      return computeRelativeURL(base, newPath);
    }
    __name(join6, "join");
    exports.join = join6;
    function relative(rootURL, targetURL) {
      const result = relativeIfPossible(rootURL, targetURL);
      return typeof result === "string" ? result : normalize(targetURL);
    }
    __name(relative, "relative");
    exports.relative = relative;
    function relativeIfPossible(rootURL, targetURL) {
      const urlType = getURLType(rootURL);
      if (urlType !== getURLType(targetURL)) {
        return null;
      }
      const base = buildSafeBase(rootURL + targetURL);
      const root = new URL3(rootURL, base);
      const target = new URL3(targetURL, base);
      try {
        new URL3("", target.toString());
      } catch (err) {
        return null;
      }
      if (target.protocol !== root.protocol || target.user !== root.user || target.password !== root.password || target.hostname !== root.hostname || target.port !== root.port) {
        return null;
      }
      return computeRelativeURL(root, target);
    }
    __name(relativeIfPossible, "relativeIfPossible");
    function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
      if (sourceRoot && getURLType(sourceURL) === "path-absolute") {
        sourceURL = sourceURL.replace(/^\//, "");
      }
      let url2 = normalize(sourceURL || "");
      if (sourceRoot) url2 = join6(sourceRoot, url2);
      if (sourceMapURL) url2 = join6(trimFilename(sourceMapURL), url2);
      return url2;
    }
    __name(computeSourceURL, "computeSourceURL");
    exports.computeSourceURL = computeSourceURL;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/array-set.js
var require_array_set = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/array-set.js"(exports) {
    init_esm();
    var ArraySet = class _ArraySet {
      static {
        __name(this, "ArraySet");
      }
      constructor() {
        this._array = [];
        this._set = /* @__PURE__ */ new Map();
      }
      /**
       * Static method for creating ArraySet instances from an existing array.
       */
      static fromArray(aArray, aAllowDuplicates) {
        const set = new _ArraySet();
        for (let i = 0, len = aArray.length; i < len; i++) {
          set.add(aArray[i], aAllowDuplicates);
        }
        return set;
      }
      /**
       * Return how many unique items are in this ArraySet. If duplicates have been
       * added, than those do not count towards the size.
       *
       * @returns Number
       */
      size() {
        return this._set.size;
      }
      /**
       * Add the given string to this set.
       *
       * @param String aStr
       */
      add(aStr, aAllowDuplicates) {
        const isDuplicate = this.has(aStr);
        const idx = this._array.length;
        if (!isDuplicate || aAllowDuplicates) {
          this._array.push(aStr);
        }
        if (!isDuplicate) {
          this._set.set(aStr, idx);
        }
      }
      /**
       * Is the given string a member of this set?
       *
       * @param String aStr
       */
      has(aStr) {
        return this._set.has(aStr);
      }
      /**
       * What is the index of the given string in the array?
       *
       * @param String aStr
       */
      indexOf(aStr) {
        const idx = this._set.get(aStr);
        if (idx >= 0) {
          return idx;
        }
        throw new Error('"' + aStr + '" is not in the set.');
      }
      /**
       * What is the element at the given index?
       *
       * @param Number aIdx
       */
      at(aIdx) {
        if (aIdx >= 0 && aIdx < this._array.length) {
          return this._array[aIdx];
        }
        throw new Error("No element indexed by " + aIdx);
      }
      /**
       * Returns the array representation of this set (which has the proper indices
       * indicated by indexOf). Note that this is a copy of the internal array used
       * for storing the members so that no one can mess with internal state.
       */
      toArray() {
        return this._array.slice();
      }
    };
    exports.ArraySet = ArraySet;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/mapping-list.js
var require_mapping_list = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/mapping-list.js"(exports) {
    init_esm();
    var util = require_util();
    function generatedPositionAfter(mappingA, mappingB) {
      const lineA = mappingA.generatedLine;
      const lineB = mappingB.generatedLine;
      const columnA = mappingA.generatedColumn;
      const columnB = mappingB.generatedColumn;
      return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
    }
    __name(generatedPositionAfter, "generatedPositionAfter");
    var MappingList = class {
      static {
        __name(this, "MappingList");
      }
      constructor() {
        this._array = [];
        this._sorted = true;
        this._last = { generatedLine: -1, generatedColumn: 0 };
      }
      /**
       * Iterate through internal items. This method takes the same arguments that
       * `Array.prototype.forEach` takes.
       *
       * NOTE: The order of the mappings is NOT guaranteed.
       */
      unsortedForEach(aCallback, aThisArg) {
        this._array.forEach(aCallback, aThisArg);
      }
      /**
       * Add the given source mapping.
       *
       * @param Object aMapping
       */
      add(aMapping) {
        if (generatedPositionAfter(this._last, aMapping)) {
          this._last = aMapping;
          this._array.push(aMapping);
        } else {
          this._sorted = false;
          this._array.push(aMapping);
        }
      }
      /**
       * Returns the flat, sorted array of mappings. The mappings are sorted by
       * generated position.
       *
       * WARNING: This method returns internal data without copying, for
       * performance. The return value must NOT be mutated, and should be treated as
       * an immutable borrow. If you want to take ownership, you must make your own
       * copy.
       */
      toArray() {
        if (!this._sorted) {
          this._array.sort(util.compareByGeneratedPositionsInflated);
          this._sorted = true;
        }
        return this._array;
      }
    };
    exports.MappingList = MappingList;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/source-map-generator.js
var require_source_map_generator = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/source-map-generator.js"(exports) {
    init_esm();
    var base64VLQ = require_base64_vlq();
    var util = require_util();
    var ArraySet = require_array_set().ArraySet;
    var MappingList = require_mapping_list().MappingList;
    var SourceMapGenerator = class _SourceMapGenerator {
      static {
        __name(this, "SourceMapGenerator");
      }
      constructor(aArgs) {
        if (!aArgs) {
          aArgs = {};
        }
        this._file = util.getArg(aArgs, "file", null);
        this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
        this._skipValidation = util.getArg(aArgs, "skipValidation", false);
        this._sources = new ArraySet();
        this._names = new ArraySet();
        this._mappings = new MappingList();
        this._sourcesContents = null;
      }
      /**
       * Creates a new SourceMapGenerator based on a SourceMapConsumer
       *
       * @param aSourceMapConsumer The SourceMap.
       */
      static fromSourceMap(aSourceMapConsumer) {
        const sourceRoot = aSourceMapConsumer.sourceRoot;
        const generator = new _SourceMapGenerator({
          file: aSourceMapConsumer.file,
          sourceRoot
        });
        aSourceMapConsumer.eachMapping(function(mapping) {
          const newMapping = {
            generated: {
              line: mapping.generatedLine,
              column: mapping.generatedColumn
            }
          };
          if (mapping.source != null) {
            newMapping.source = mapping.source;
            if (sourceRoot != null) {
              newMapping.source = util.relative(sourceRoot, newMapping.source);
            }
            newMapping.original = {
              line: mapping.originalLine,
              column: mapping.originalColumn
            };
            if (mapping.name != null) {
              newMapping.name = mapping.name;
            }
          }
          generator.addMapping(newMapping);
        });
        aSourceMapConsumer.sources.forEach(function(sourceFile) {
          let sourceRelative = sourceFile;
          if (sourceRoot !== null) {
            sourceRelative = util.relative(sourceRoot, sourceFile);
          }
          if (!generator._sources.has(sourceRelative)) {
            generator._sources.add(sourceRelative);
          }
          const content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content != null) {
            generator.setSourceContent(sourceFile, content);
          }
        });
        return generator;
      }
      /**
       * Add a single mapping from original source line and column to the generated
       * source's line and column for this source map being created. The mapping
       * object should have the following properties:
       *
       *   - generated: An object with the generated line and column positions.
       *   - original: An object with the original line and column positions.
       *   - source: The original source file (relative to the sourceRoot).
       *   - name: An optional original token name for this mapping.
       */
      addMapping(aArgs) {
        const generated = util.getArg(aArgs, "generated");
        const original = util.getArg(aArgs, "original", null);
        let source = util.getArg(aArgs, "source", null);
        let name = util.getArg(aArgs, "name", null);
        if (!this._skipValidation) {
          this._validateMapping(generated, original, source, name);
        }
        if (source != null) {
          source = String(source);
          if (!this._sources.has(source)) {
            this._sources.add(source);
          }
        }
        if (name != null) {
          name = String(name);
          if (!this._names.has(name)) {
            this._names.add(name);
          }
        }
        this._mappings.add({
          generatedLine: generated.line,
          generatedColumn: generated.column,
          originalLine: original != null && original.line,
          originalColumn: original != null && original.column,
          source,
          name
        });
      }
      /**
       * Set the source content for a source file.
       */
      setSourceContent(aSourceFile, aSourceContent) {
        let source = aSourceFile;
        if (this._sourceRoot != null) {
          source = util.relative(this._sourceRoot, source);
        }
        if (aSourceContent != null) {
          if (!this._sourcesContents) {
            this._sourcesContents = /* @__PURE__ */ Object.create(null);
          }
          this._sourcesContents[util.toSetString(source)] = aSourceContent;
        } else if (this._sourcesContents) {
          delete this._sourcesContents[util.toSetString(source)];
          if (Object.keys(this._sourcesContents).length === 0) {
            this._sourcesContents = null;
          }
        }
      }
      /**
       * Applies the mappings of a sub-source-map for a specific source file to the
       * source map being generated. Each mapping to the supplied source file is
       * rewritten using the supplied source map. Note: The resolution for the
       * resulting mappings is the minimium of this map and the supplied map.
       *
       * @param aSourceMapConsumer The source map to be applied.
       * @param aSourceFile Optional. The filename of the source file.
       *        If omitted, SourceMapConsumer's file property will be used.
       * @param aSourceMapPath Optional. The dirname of the path to the source map
       *        to be applied. If relative, it is relative to the SourceMapConsumer.
       *        This parameter is needed when the two source maps aren't in the same
       *        directory, and the source map to be applied contains relative source
       *        paths. If so, those relative source paths need to be rewritten
       *        relative to the SourceMapGenerator.
       */
      applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
        let sourceFile = aSourceFile;
        if (aSourceFile == null) {
          if (aSourceMapConsumer.file == null) {
            throw new Error(
              `SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's "file" property. Both were omitted.`
            );
          }
          sourceFile = aSourceMapConsumer.file;
        }
        const sourceRoot = this._sourceRoot;
        if (sourceRoot != null) {
          sourceFile = util.relative(sourceRoot, sourceFile);
        }
        const newSources = this._mappings.toArray().length > 0 ? new ArraySet() : this._sources;
        const newNames = new ArraySet();
        this._mappings.unsortedForEach(function(mapping) {
          if (mapping.source === sourceFile && mapping.originalLine != null) {
            const original = aSourceMapConsumer.originalPositionFor({
              line: mapping.originalLine,
              column: mapping.originalColumn
            });
            if (original.source != null) {
              mapping.source = original.source;
              if (aSourceMapPath != null) {
                mapping.source = util.join(aSourceMapPath, mapping.source);
              }
              if (sourceRoot != null) {
                mapping.source = util.relative(sourceRoot, mapping.source);
              }
              mapping.originalLine = original.line;
              mapping.originalColumn = original.column;
              if (original.name != null) {
                mapping.name = original.name;
              }
            }
          }
          const source = mapping.source;
          if (source != null && !newSources.has(source)) {
            newSources.add(source);
          }
          const name = mapping.name;
          if (name != null && !newNames.has(name)) {
            newNames.add(name);
          }
        }, this);
        this._sources = newSources;
        this._names = newNames;
        aSourceMapConsumer.sources.forEach(function(srcFile) {
          const content = aSourceMapConsumer.sourceContentFor(srcFile);
          if (content != null) {
            if (aSourceMapPath != null) {
              srcFile = util.join(aSourceMapPath, srcFile);
            }
            if (sourceRoot != null) {
              srcFile = util.relative(sourceRoot, srcFile);
            }
            this.setSourceContent(srcFile, content);
          }
        }, this);
      }
      /**
       * A mapping can have one of the three levels of data:
       *
       *   1. Just the generated position.
       *   2. The Generated position, original position, and original source.
       *   3. Generated and original position, original source, as well as a name
       *      token.
       *
       * To maintain consistency, we validate that any new mapping being added falls
       * in to one of these categories.
       */
      _validateMapping(aGenerated, aOriginal, aSource, aName) {
        if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
          throw new Error(
            "original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values."
          );
        }
        if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
        } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
        } else {
          throw new Error("Invalid mapping: " + JSON.stringify({
            generated: aGenerated,
            source: aSource,
            original: aOriginal,
            name: aName
          }));
        }
      }
      /**
       * Serialize the accumulated mappings in to the stream of base 64 VLQs
       * specified by the source map format.
       */
      _serializeMappings() {
        let previousGeneratedColumn = 0;
        let previousGeneratedLine = 1;
        let previousOriginalColumn = 0;
        let previousOriginalLine = 0;
        let previousName = 0;
        let previousSource = 0;
        let result = "";
        let next;
        let mapping;
        let nameIdx;
        let sourceIdx;
        const mappings = this._mappings.toArray();
        for (let i = 0, len = mappings.length; i < len; i++) {
          mapping = mappings[i];
          next = "";
          if (mapping.generatedLine !== previousGeneratedLine) {
            previousGeneratedColumn = 0;
            while (mapping.generatedLine !== previousGeneratedLine) {
              next += ";";
              previousGeneratedLine++;
            }
          } else if (i > 0) {
            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
              continue;
            }
            next += ",";
          }
          next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
          previousGeneratedColumn = mapping.generatedColumn;
          if (mapping.source != null) {
            sourceIdx = this._sources.indexOf(mapping.source);
            next += base64VLQ.encode(sourceIdx - previousSource);
            previousSource = sourceIdx;
            next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
            previousOriginalLine = mapping.originalLine - 1;
            next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
            previousOriginalColumn = mapping.originalColumn;
            if (mapping.name != null) {
              nameIdx = this._names.indexOf(mapping.name);
              next += base64VLQ.encode(nameIdx - previousName);
              previousName = nameIdx;
            }
          }
          result += next;
        }
        return result;
      }
      _generateSourcesContent(aSources, aSourceRoot) {
        return aSources.map(function(source) {
          if (!this._sourcesContents) {
            return null;
          }
          if (aSourceRoot != null) {
            source = util.relative(aSourceRoot, source);
          }
          const key = util.toSetString(source);
          return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
        }, this);
      }
      /**
       * Externalize the source map.
       */
      toJSON() {
        const map3 = {
          version: this._version,
          sources: this._sources.toArray(),
          names: this._names.toArray(),
          mappings: this._serializeMappings()
        };
        if (this._file != null) {
          map3.file = this._file;
        }
        if (this._sourceRoot != null) {
          map3.sourceRoot = this._sourceRoot;
        }
        if (this._sourcesContents) {
          map3.sourcesContent = this._generateSourcesContent(map3.sources, map3.sourceRoot);
        }
        return map3;
      }
      /**
       * Render the source map being generated to a string.
       */
      toString() {
        return JSON.stringify(this.toJSON());
      }
    };
    SourceMapGenerator.prototype._version = 3;
    exports.SourceMapGenerator = SourceMapGenerator;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/binary-search.js
var require_binary_search = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/binary-search.js"(exports) {
    init_esm();
    exports.GREATEST_LOWER_BOUND = 1;
    exports.LEAST_UPPER_BOUND = 2;
    function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
      const mid = Math.floor((aHigh - aLow) / 2) + aLow;
      const cmp = aCompare(aNeedle, aHaystack[mid], true);
      if (cmp === 0) {
        return mid;
      } else if (cmp > 0) {
        if (aHigh - mid > 1) {
          return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
        }
        if (aBias == exports.LEAST_UPPER_BOUND) {
          return aHigh < aHaystack.length ? aHigh : -1;
        }
        return mid;
      }
      if (mid - aLow > 1) {
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
      }
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return mid;
      }
      return aLow < 0 ? -1 : aLow;
    }
    __name(recursiveSearch, "recursiveSearch");
    exports.search = /* @__PURE__ */ __name(function search(aNeedle, aHaystack, aCompare, aBias) {
      if (aHaystack.length === 0) {
        return -1;
      }
      let index = recursiveSearch(
        -1,
        aHaystack.length,
        aNeedle,
        aHaystack,
        aCompare,
        aBias || exports.GREATEST_LOWER_BOUND
      );
      if (index < 0) {
        return -1;
      }
      while (index - 1 >= 0) {
        if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
          break;
        }
        --index;
      }
      return index;
    }, "search");
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/read-wasm.js
var require_read_wasm = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/read-wasm.js"(exports, module) {
    "use strict";
    init_esm();
    var fs19 = __require("fs");
    var path28 = __require("path");
    module.exports = /* @__PURE__ */ __name(function readWasm() {
      return new Promise((resolve3, reject) => {
        const wasmPath = path28.join(__dirname, "mappings.wasm");
        fs19.readFile(wasmPath, null, (error, data) => {
          if (error) {
            reject(error);
            return;
          }
          resolve3(data.buffer);
        });
      });
    }, "readWasm");
    module.exports.initialize = (_) => {
      console.debug("SourceMapConsumer.initialize is a no-op when running in node.js");
    };
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/wasm.js
var require_wasm = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/wasm.js"(exports, module) {
    init_esm();
    var readWasm = require_read_wasm();
    function Mapping() {
      this.generatedLine = 0;
      this.generatedColumn = 0;
      this.lastGeneratedColumn = null;
      this.source = null;
      this.originalLine = null;
      this.originalColumn = null;
      this.name = null;
    }
    __name(Mapping, "Mapping");
    var cachedWasm = null;
    module.exports = /* @__PURE__ */ __name(function wasm() {
      if (cachedWasm) {
        return cachedWasm;
      }
      const callbackStack = [];
      cachedWasm = readWasm().then((buffer) => {
        return WebAssembly.instantiate(buffer, {
          env: {
            mapping_callback(generatedLine, generatedColumn, hasLastGeneratedColumn, lastGeneratedColumn, hasOriginal, source, originalLine, originalColumn, hasName, name) {
              const mapping = new Mapping();
              mapping.generatedLine = generatedLine + 1;
              mapping.generatedColumn = generatedColumn;
              if (hasLastGeneratedColumn) {
                mapping.lastGeneratedColumn = lastGeneratedColumn - 1;
              }
              if (hasOriginal) {
                mapping.source = source;
                mapping.originalLine = originalLine + 1;
                mapping.originalColumn = originalColumn;
                if (hasName) {
                  mapping.name = name;
                }
              }
              callbackStack[callbackStack.length - 1](mapping);
            },
            start_all_generated_locations_for() {
              console.time("all_generated_locations_for");
            },
            end_all_generated_locations_for() {
              console.timeEnd("all_generated_locations_for");
            },
            start_compute_column_spans() {
              console.time("compute_column_spans");
            },
            end_compute_column_spans() {
              console.timeEnd("compute_column_spans");
            },
            start_generated_location_for() {
              console.time("generated_location_for");
            },
            end_generated_location_for() {
              console.timeEnd("generated_location_for");
            },
            start_original_location_for() {
              console.time("original_location_for");
            },
            end_original_location_for() {
              console.timeEnd("original_location_for");
            },
            start_parse_mappings() {
              console.time("parse_mappings");
            },
            end_parse_mappings() {
              console.timeEnd("parse_mappings");
            },
            start_sort_by_generated_location() {
              console.time("sort_by_generated_location");
            },
            end_sort_by_generated_location() {
              console.timeEnd("sort_by_generated_location");
            },
            start_sort_by_original_location() {
              console.time("sort_by_original_location");
            },
            end_sort_by_original_location() {
              console.timeEnd("sort_by_original_location");
            }
          }
        });
      }).then((Wasm) => {
        return {
          exports: Wasm.instance.exports,
          withMappingCallback: /* @__PURE__ */ __name((mappingCallback, f) => {
            callbackStack.push(mappingCallback);
            try {
              f();
            } finally {
              callbackStack.pop();
            }
          }, "withMappingCallback")
        };
      }).then(null, (e) => {
        cachedWasm = null;
        throw e;
      });
      return cachedWasm;
    }, "wasm");
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/source-map-consumer.js
var require_source_map_consumer = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/source-map-consumer.js"(exports) {
    init_esm();
    var util = require_util();
    var binarySearch = require_binary_search();
    var ArraySet = require_array_set().ArraySet;
    var base64VLQ = require_base64_vlq();
    var readWasm = require_read_wasm();
    var wasm = require_wasm();
    var INTERNAL = Symbol("smcInternal");
    var SourceMapConsumer2 = class _SourceMapConsumer {
      static {
        __name(this, "SourceMapConsumer");
      }
      constructor(aSourceMap, aSourceMapURL) {
        if (aSourceMap == INTERNAL) {
          return Promise.resolve(this);
        }
        return _factory(aSourceMap, aSourceMapURL);
      }
      static initialize(opts) {
        readWasm.initialize(opts["lib/mappings.wasm"]);
      }
      static fromSourceMap(aSourceMap, aSourceMapURL) {
        return _factoryBSM(aSourceMap, aSourceMapURL);
      }
      /**
       * Construct a new `SourceMapConsumer` from `rawSourceMap` and `sourceMapUrl`
       * (see the `SourceMapConsumer` constructor for details. Then, invoke the `async
       * function f(SourceMapConsumer) -> T` with the newly constructed consumer, wait
       * for `f` to complete, call `destroy` on the consumer, and return `f`'s return
       * value.
       *
       * You must not use the consumer after `f` completes!
       *
       * By using `with`, you do not have to remember to manually call `destroy` on
       * the consumer, since it will be called automatically once `f` completes.
       *
       * ```js
       * const xSquared = await SourceMapConsumer.with(
       *   myRawSourceMap,
       *   null,
       *   async function (consumer) {
       *     // Use `consumer` inside here and don't worry about remembering
       *     // to call `destroy`.
       *
       *     const x = await whatever(consumer);
       *     return x * x;
       *   }
       * );
       *
       * // You may not use that `consumer` anymore out here; it has
       * // been destroyed. But you can use `xSquared`.
       * console.log(xSquared);
       * ```
       */
      static async with(rawSourceMap, sourceMapUrl, f) {
        const consumer = await new _SourceMapConsumer(rawSourceMap, sourceMapUrl);
        try {
          return await f(consumer);
        } finally {
          consumer.destroy();
        }
      }
      /**
       * Iterate over each mapping between an original source/line/column and a
       * generated line/column in this source map.
       *
       * @param Function aCallback
       *        The function that is called with each mapping.
       * @param Object aContext
       *        Optional. If specified, this object will be the value of `this` every
       *        time that `aCallback` is called.
       * @param aOrder
       *        Either `SourceMapConsumer.GENERATED_ORDER` or
       *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
       *        iterate over the mappings sorted by the generated file's line/column
       *        order or the original's source/line/column order, respectively. Defaults to
       *        `SourceMapConsumer.GENERATED_ORDER`.
       */
      eachMapping(aCallback, aContext, aOrder) {
        throw new Error("Subclasses must implement eachMapping");
      }
      /**
       * Returns all generated line and column information for the original source,
       * line, and column provided. If no column is provided, returns all mappings
       * corresponding to a either the line we are searching for or the next
       * closest line that has any mappings. Otherwise, returns all mappings
       * corresponding to the given line and either the column we are searching for
       * or the next closest column that has any offsets.
       *
       * The only argument is an object with the following properties:
       *
       *   - source: The filename of the original source.
       *   - line: The line number in the original source.  The line number is 1-based.
       *   - column: Optional. the column number in the original source.
       *    The column number is 0-based.
       *
       * and an array of objects is returned, each with the following properties:
       *
       *   - line: The line number in the generated source, or null.  The
       *    line number is 1-based.
       *   - column: The column number in the generated source, or null.
       *    The column number is 0-based.
       */
      allGeneratedPositionsFor(aArgs) {
        throw new Error("Subclasses must implement allGeneratedPositionsFor");
      }
      destroy() {
        throw new Error("Subclasses must implement destroy");
      }
    };
    SourceMapConsumer2.prototype._version = 3;
    SourceMapConsumer2.GENERATED_ORDER = 1;
    SourceMapConsumer2.ORIGINAL_ORDER = 2;
    SourceMapConsumer2.GREATEST_LOWER_BOUND = 1;
    SourceMapConsumer2.LEAST_UPPER_BOUND = 2;
    exports.SourceMapConsumer = SourceMapConsumer2;
    var BasicSourceMapConsumer = class _BasicSourceMapConsumer extends SourceMapConsumer2 {
      static {
        __name(this, "BasicSourceMapConsumer");
      }
      constructor(aSourceMap, aSourceMapURL) {
        return super(INTERNAL).then((that) => {
          let sourceMap = aSourceMap;
          if (typeof aSourceMap === "string") {
            sourceMap = util.parseSourceMapInput(aSourceMap);
          }
          const version = util.getArg(sourceMap, "version");
          const sources = util.getArg(sourceMap, "sources").map(String);
          const names = util.getArg(sourceMap, "names", []);
          const sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
          const sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
          const mappings = util.getArg(sourceMap, "mappings");
          const file = util.getArg(sourceMap, "file", null);
          if (version != that._version) {
            throw new Error("Unsupported version: " + version);
          }
          that._sourceLookupCache = /* @__PURE__ */ new Map();
          that._names = ArraySet.fromArray(names.map(String), true);
          that._sources = ArraySet.fromArray(sources, true);
          that._absoluteSources = ArraySet.fromArray(that._sources.toArray().map(function(s) {
            return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
          }), true);
          that.sourceRoot = sourceRoot;
          that.sourcesContent = sourcesContent;
          that._mappings = mappings;
          that._sourceMapURL = aSourceMapURL;
          that.file = file;
          that._computedColumnSpans = false;
          that._mappingsPtr = 0;
          that._wasm = null;
          return wasm().then((w) => {
            that._wasm = w;
            return that;
          });
        });
      }
      /**
       * Utility function to find the index of a source.  Returns -1 if not
       * found.
       */
      _findSourceIndex(aSource) {
        const cachedIndex = this._sourceLookupCache.get(aSource);
        if (typeof cachedIndex === "number") {
          return cachedIndex;
        }
        const sourceAsMapRelative = util.computeSourceURL(null, aSource, this._sourceMapURL);
        if (this._absoluteSources.has(sourceAsMapRelative)) {
          const index = this._absoluteSources.indexOf(sourceAsMapRelative);
          this._sourceLookupCache.set(aSource, index);
          return index;
        }
        const sourceAsSourceRootRelative = util.computeSourceURL(this.sourceRoot, aSource, this._sourceMapURL);
        if (this._absoluteSources.has(sourceAsSourceRootRelative)) {
          const index = this._absoluteSources.indexOf(sourceAsSourceRootRelative);
          this._sourceLookupCache.set(aSource, index);
          return index;
        }
        return -1;
      }
      /**
       * Create a BasicSourceMapConsumer from a SourceMapGenerator.
       *
       * @param SourceMapGenerator aSourceMap
       *        The source map that will be consumed.
       * @param String aSourceMapURL
       *        The URL at which the source map can be found (optional)
       * @returns BasicSourceMapConsumer
       */
      static fromSourceMap(aSourceMap, aSourceMapURL) {
        return new _BasicSourceMapConsumer(aSourceMap.toString());
      }
      get sources() {
        return this._absoluteSources.toArray();
      }
      _getMappingsPtr() {
        if (this._mappingsPtr === 0) {
          this._parseMappings();
        }
        return this._mappingsPtr;
      }
      /**
       * Parse the mappings in a string in to a data structure which we can easily
       * query (the ordered arrays in the `this.__generatedMappings` and
       * `this.__originalMappings` properties).
       */
      _parseMappings() {
        const aStr = this._mappings;
        const size = aStr.length;
        const mappingsBufPtr = this._wasm.exports.allocate_mappings(size);
        const mappingsBuf = new Uint8Array(this._wasm.exports.memory.buffer, mappingsBufPtr, size);
        for (let i = 0; i < size; i++) {
          mappingsBuf[i] = aStr.charCodeAt(i);
        }
        const mappingsPtr = this._wasm.exports.parse_mappings(mappingsBufPtr);
        if (!mappingsPtr) {
          const error = this._wasm.exports.get_last_error();
          let msg = `Error parsing mappings (code ${error}): `;
          switch (error) {
            case 1:
              msg += "the mappings contained a negative line, column, source index, or name index";
              break;
            case 2:
              msg += "the mappings contained a number larger than 2**32";
              break;
            case 3:
              msg += "reached EOF while in the middle of parsing a VLQ";
              break;
            case 4:
              msg += "invalid base 64 character while parsing a VLQ";
              break;
            default:
              msg += "unknown error code";
              break;
          }
          throw new Error(msg);
        }
        this._mappingsPtr = mappingsPtr;
      }
      eachMapping(aCallback, aContext, aOrder) {
        const context = aContext || null;
        const order = aOrder || SourceMapConsumer2.GENERATED_ORDER;
        this._wasm.withMappingCallback(
          (mapping) => {
            if (mapping.source !== null) {
              mapping.source = this._absoluteSources.at(mapping.source);
              if (mapping.name !== null) {
                mapping.name = this._names.at(mapping.name);
              }
            }
            if (this._computedColumnSpans && mapping.lastGeneratedColumn === null) {
              mapping.lastGeneratedColumn = Infinity;
            }
            aCallback.call(context, mapping);
          },
          () => {
            switch (order) {
              case SourceMapConsumer2.GENERATED_ORDER:
                this._wasm.exports.by_generated_location(this._getMappingsPtr());
                break;
              case SourceMapConsumer2.ORIGINAL_ORDER:
                this._wasm.exports.by_original_location(this._getMappingsPtr());
                break;
              default:
                throw new Error("Unknown order of iteration.");
            }
          }
        );
      }
      allGeneratedPositionsFor(aArgs) {
        let source = util.getArg(aArgs, "source");
        const originalLine = util.getArg(aArgs, "line");
        const originalColumn = aArgs.column || 0;
        source = this._findSourceIndex(source);
        if (source < 0) {
          return [];
        }
        if (originalLine < 1) {
          throw new Error("Line numbers must be >= 1");
        }
        if (originalColumn < 0) {
          throw new Error("Column numbers must be >= 0");
        }
        const mappings = [];
        this._wasm.withMappingCallback(
          (m) => {
            let lastColumn = m.lastGeneratedColumn;
            if (this._computedColumnSpans && lastColumn === null) {
              lastColumn = Infinity;
            }
            mappings.push({
              line: m.generatedLine,
              column: m.generatedColumn,
              lastColumn
            });
          },
          () => {
            this._wasm.exports.all_generated_locations_for(
              this._getMappingsPtr(),
              source,
              originalLine - 1,
              "column" in aArgs,
              originalColumn
            );
          }
        );
        return mappings;
      }
      destroy() {
        if (this._mappingsPtr !== 0) {
          this._wasm.exports.free_mappings(this._mappingsPtr);
          this._mappingsPtr = 0;
        }
      }
      /**
       * Compute the last column for each generated mapping. The last column is
       * inclusive.
       */
      computeColumnSpans() {
        if (this._computedColumnSpans) {
          return;
        }
        this._wasm.exports.compute_column_spans(this._getMappingsPtr());
        this._computedColumnSpans = true;
      }
      /**
       * Returns the original source, line, and column information for the generated
       * source's line and column positions provided. The only argument is an object
       * with the following properties:
       *
       *   - line: The line number in the generated source.  The line number
       *     is 1-based.
       *   - column: The column number in the generated source.  The column
       *     number is 0-based.
       *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
       *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
       *     closest element that is smaller than or greater than the one we are
       *     searching for, respectively, if the exact element cannot be found.
       *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
       *
       * and an object is returned with the following properties:
       *
       *   - source: The original source file, or null.
       *   - line: The line number in the original source, or null.  The
       *     line number is 1-based.
       *   - column: The column number in the original source, or null.  The
       *     column number is 0-based.
       *   - name: The original identifier, or null.
       */
      originalPositionFor(aArgs) {
        const needle = {
          generatedLine: util.getArg(aArgs, "line"),
          generatedColumn: util.getArg(aArgs, "column")
        };
        if (needle.generatedLine < 1) {
          throw new Error("Line numbers must be >= 1");
        }
        if (needle.generatedColumn < 0) {
          throw new Error("Column numbers must be >= 0");
        }
        let bias = util.getArg(aArgs, "bias", SourceMapConsumer2.GREATEST_LOWER_BOUND);
        if (bias == null) {
          bias = SourceMapConsumer2.GREATEST_LOWER_BOUND;
        }
        let mapping;
        this._wasm.withMappingCallback((m) => mapping = m, () => {
          this._wasm.exports.original_location_for(
            this._getMappingsPtr(),
            needle.generatedLine - 1,
            needle.generatedColumn,
            bias
          );
        });
        if (mapping) {
          if (mapping.generatedLine === needle.generatedLine) {
            let source = util.getArg(mapping, "source", null);
            if (source !== null) {
              source = this._absoluteSources.at(source);
            }
            let name = util.getArg(mapping, "name", null);
            if (name !== null) {
              name = this._names.at(name);
            }
            return {
              source,
              line: util.getArg(mapping, "originalLine", null),
              column: util.getArg(mapping, "originalColumn", null),
              name
            };
          }
        }
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      }
      /**
       * Return true if we have the source content for every source in the source
       * map, false otherwise.
       */
      hasContentsOfAllSources() {
        if (!this.sourcesContent) {
          return false;
        }
        return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
          return sc == null;
        });
      }
      /**
       * Returns the original source content. The only argument is the url of the
       * original source file. Returns null if no original source content is
       * available.
       */
      sourceContentFor(aSource, nullOnMissing) {
        if (!this.sourcesContent) {
          return null;
        }
        const index = this._findSourceIndex(aSource);
        if (index >= 0) {
          return this.sourcesContent[index];
        }
        if (nullOnMissing) {
          return null;
        }
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
      /**
       * Returns the generated line and column information for the original source,
       * line, and column positions provided. The only argument is an object with
       * the following properties:
       *
       *   - source: The filename of the original source.
       *   - line: The line number in the original source.  The line number
       *     is 1-based.
       *   - column: The column number in the original source.  The column
       *     number is 0-based.
       *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
       *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
       *     closest element that is smaller than or greater than the one we are
       *     searching for, respectively, if the exact element cannot be found.
       *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
       *
       * and an object is returned with the following properties:
       *
       *   - line: The line number in the generated source, or null.  The
       *     line number is 1-based.
       *   - column: The column number in the generated source, or null.
       *     The column number is 0-based.
       */
      generatedPositionFor(aArgs) {
        let source = util.getArg(aArgs, "source");
        source = this._findSourceIndex(source);
        if (source < 0) {
          return {
            line: null,
            column: null,
            lastColumn: null
          };
        }
        const needle = {
          source,
          originalLine: util.getArg(aArgs, "line"),
          originalColumn: util.getArg(aArgs, "column")
        };
        if (needle.originalLine < 1) {
          throw new Error("Line numbers must be >= 1");
        }
        if (needle.originalColumn < 0) {
          throw new Error("Column numbers must be >= 0");
        }
        let bias = util.getArg(aArgs, "bias", SourceMapConsumer2.GREATEST_LOWER_BOUND);
        if (bias == null) {
          bias = SourceMapConsumer2.GREATEST_LOWER_BOUND;
        }
        let mapping;
        this._wasm.withMappingCallback((m) => mapping = m, () => {
          this._wasm.exports.generated_location_for(
            this._getMappingsPtr(),
            needle.source,
            needle.originalLine - 1,
            needle.originalColumn,
            bias
          );
        });
        if (mapping) {
          if (mapping.source === needle.source) {
            let lastColumn = mapping.lastGeneratedColumn;
            if (this._computedColumnSpans && lastColumn === null) {
              lastColumn = Infinity;
            }
            return {
              line: util.getArg(mapping, "generatedLine", null),
              column: util.getArg(mapping, "generatedColumn", null),
              lastColumn
            };
          }
        }
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      }
    };
    BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer2;
    exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
    var IndexedSourceMapConsumer = class extends SourceMapConsumer2 {
      static {
        __name(this, "IndexedSourceMapConsumer");
      }
      constructor(aSourceMap, aSourceMapURL) {
        return super(INTERNAL).then((that) => {
          let sourceMap = aSourceMap;
          if (typeof aSourceMap === "string") {
            sourceMap = util.parseSourceMapInput(aSourceMap);
          }
          const version = util.getArg(sourceMap, "version");
          const sections = util.getArg(sourceMap, "sections");
          if (version != that._version) {
            throw new Error("Unsupported version: " + version);
          }
          let lastOffset = {
            line: -1,
            column: 0
          };
          return Promise.all(sections.map((s) => {
            if (s.url) {
              throw new Error("Support for url field in sections not implemented.");
            }
            const offset = util.getArg(s, "offset");
            const offsetLine = util.getArg(offset, "line");
            const offsetColumn = util.getArg(offset, "column");
            if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) {
              throw new Error("Section offsets must be ordered and non-overlapping.");
            }
            lastOffset = offset;
            const cons = new SourceMapConsumer2(util.getArg(s, "map"), aSourceMapURL);
            return cons.then((consumer) => {
              return {
                generatedOffset: {
                  // The offset fields are 0-based, but we use 1-based indices when
                  // encoding/decoding from VLQ.
                  generatedLine: offsetLine + 1,
                  generatedColumn: offsetColumn + 1
                },
                consumer
              };
            });
          })).then((s) => {
            that._sections = s;
            return that;
          });
        });
      }
      /**
       * The list of original sources.
       */
      get sources() {
        const sources = [];
        for (let i = 0; i < this._sections.length; i++) {
          for (let j = 0; j < this._sections[i].consumer.sources.length; j++) {
            sources.push(this._sections[i].consumer.sources[j]);
          }
        }
        return sources;
      }
      /**
       * Returns the original source, line, and column information for the generated
       * source's line and column positions provided. The only argument is an object
       * with the following properties:
       *
       *   - line: The line number in the generated source.  The line number
       *     is 1-based.
       *   - column: The column number in the generated source.  The column
       *     number is 0-based.
       *
       * and an object is returned with the following properties:
       *
       *   - source: The original source file, or null.
       *   - line: The line number in the original source, or null.  The
       *     line number is 1-based.
       *   - column: The column number in the original source, or null.  The
       *     column number is 0-based.
       *   - name: The original identifier, or null.
       */
      originalPositionFor(aArgs) {
        const needle = {
          generatedLine: util.getArg(aArgs, "line"),
          generatedColumn: util.getArg(aArgs, "column")
        };
        const sectionIndex = binarySearch.search(
          needle,
          this._sections,
          function(aNeedle, section2) {
            const cmp = aNeedle.generatedLine - section2.generatedOffset.generatedLine;
            if (cmp) {
              return cmp;
            }
            return aNeedle.generatedColumn - section2.generatedOffset.generatedColumn;
          }
        );
        const section = this._sections[sectionIndex];
        if (!section) {
          return {
            source: null,
            line: null,
            column: null,
            name: null
          };
        }
        return section.consumer.originalPositionFor({
          line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
          column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
          bias: aArgs.bias
        });
      }
      /**
       * Return true if we have the source content for every source in the source
       * map, false otherwise.
       */
      hasContentsOfAllSources() {
        return this._sections.every(function(s) {
          return s.consumer.hasContentsOfAllSources();
        });
      }
      /**
       * Returns the original source content. The only argument is the url of the
       * original source file. Returns null if no original source content is
       * available.
       */
      sourceContentFor(aSource, nullOnMissing) {
        for (let i = 0; i < this._sections.length; i++) {
          const section = this._sections[i];
          const content = section.consumer.sourceContentFor(aSource, true);
          if (content) {
            return content;
          }
        }
        if (nullOnMissing) {
          return null;
        }
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
      _findSectionIndex(source) {
        for (let i = 0; i < this._sections.length; i++) {
          const { consumer } = this._sections[i];
          if (consumer._findSourceIndex(source) !== -1) {
            return i;
          }
        }
        return -1;
      }
      /**
       * Returns the generated line and column information for the original source,
       * line, and column positions provided. The only argument is an object with
       * the following properties:
       *
       *   - source: The filename of the original source.
       *   - line: The line number in the original source.  The line number
       *     is 1-based.
       *   - column: The column number in the original source.  The column
       *     number is 0-based.
       *
       * and an object is returned with the following properties:
       *
       *   - line: The line number in the generated source, or null.  The
       *     line number is 1-based.
       *   - column: The column number in the generated source, or null.
       *     The column number is 0-based.
       */
      generatedPositionFor(aArgs) {
        const index = this._findSectionIndex(util.getArg(aArgs, "source"));
        const section = index >= 0 ? this._sections[index] : null;
        const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
        const generatedPosition = section && section.consumer.generatedPositionFor(aArgs);
        if (generatedPosition && generatedPosition.line !== null) {
          const lineShift = section.generatedOffset.generatedLine - 1;
          const columnShift = section.generatedOffset.generatedColumn - 1;
          if (generatedPosition.line === 1) {
            generatedPosition.column += columnShift;
            if (typeof generatedPosition.lastColumn === "number") {
              generatedPosition.lastColumn += columnShift;
            }
          }
          if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) {
            generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
          }
          generatedPosition.line += lineShift;
          return generatedPosition;
        }
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      }
      allGeneratedPositionsFor(aArgs) {
        const index = this._findSectionIndex(util.getArg(aArgs, "source"));
        const section = index >= 0 ? this._sections[index] : null;
        const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
        if (!section) return [];
        return section.consumer.allGeneratedPositionsFor(aArgs).map(
          (generatedPosition) => {
            const lineShift = section.generatedOffset.generatedLine - 1;
            const columnShift = section.generatedOffset.generatedColumn - 1;
            if (generatedPosition.line === 1) {
              generatedPosition.column += columnShift;
              if (typeof generatedPosition.lastColumn === "number") {
                generatedPosition.lastColumn += columnShift;
              }
            }
            if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) {
              generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
            }
            generatedPosition.line += lineShift;
            return generatedPosition;
          }
        );
      }
      eachMapping(aCallback, aContext, aOrder) {
        this._sections.forEach((section, index) => {
          const nextSection = index + 1 < this._sections.length ? this._sections[index + 1] : null;
          const { generatedOffset } = section;
          const lineShift = generatedOffset.generatedLine - 1;
          const columnShift = generatedOffset.generatedColumn - 1;
          section.consumer.eachMapping(function(mapping) {
            if (mapping.generatedLine === 1) {
              mapping.generatedColumn += columnShift;
              if (typeof mapping.lastGeneratedColumn === "number") {
                mapping.lastGeneratedColumn += columnShift;
              }
            }
            if (mapping.lastGeneratedColumn === Infinity && nextSection && mapping.generatedLine === nextSection.generatedOffset.generatedLine) {
              mapping.lastGeneratedColumn = nextSection.generatedOffset.generatedColumn - 2;
            }
            mapping.generatedLine += lineShift;
            aCallback.call(this, mapping);
          }, aContext, aOrder);
        });
      }
      computeColumnSpans() {
        for (let i = 0; i < this._sections.length; i++) {
          this._sections[i].consumer.computeColumnSpans();
        }
      }
      destroy() {
        for (let i = 0; i < this._sections.length; i++) {
          this._sections[i].consumer.destroy();
        }
      }
    };
    exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
    function _factory(aSourceMap, aSourceMapURL) {
      let sourceMap = aSourceMap;
      if (typeof aSourceMap === "string") {
        sourceMap = util.parseSourceMapInput(aSourceMap);
      }
      const consumer = sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
      return Promise.resolve(consumer);
    }
    __name(_factory, "_factory");
    function _factoryBSM(aSourceMap, aSourceMapURL) {
      return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
    }
    __name(_factoryBSM, "_factoryBSM");
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/lib/source-node.js
var require_source_node = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/lib/source-node.js"(exports) {
    init_esm();
    var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
    var util = require_util();
    var REGEX_NEWLINE = /(\r?\n)/;
    var NEWLINE_CODE = 10;
    var isSourceNode = "$$$isSourceNode$$$";
    var SourceNode = class _SourceNode {
      static {
        __name(this, "SourceNode");
      }
      constructor(aLine, aColumn, aSource, aChunks, aName) {
        this.children = [];
        this.sourceContents = {};
        this.line = aLine == null ? null : aLine;
        this.column = aColumn == null ? null : aColumn;
        this.source = aSource == null ? null : aSource;
        this.name = aName == null ? null : aName;
        this[isSourceNode] = true;
        if (aChunks != null) this.add(aChunks);
      }
      /**
       * Creates a SourceNode from generated code and a SourceMapConsumer.
       *
       * @param aGeneratedCode The generated code
       * @param aSourceMapConsumer The SourceMap for the generated code
       * @param aRelativePath Optional. The path that relative sources in the
       *        SourceMapConsumer should be relative to.
       */
      static fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
        const node = new _SourceNode();
        const remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
        let remainingLinesIndex = 0;
        const shiftNextLine = /* @__PURE__ */ __name(function() {
          const lineContents = getNextLine();
          const newLine = getNextLine() || "";
          return lineContents + newLine;
          function getNextLine() {
            return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : void 0;
          }
          __name(getNextLine, "getNextLine");
        }, "shiftNextLine");
        let lastGeneratedLine = 1, lastGeneratedColumn = 0;
        let lastMapping = null;
        let nextLine;
        aSourceMapConsumer.eachMapping(function(mapping) {
          if (lastMapping !== null) {
            if (lastGeneratedLine < mapping.generatedLine) {
              addMappingWithCode(lastMapping, shiftNextLine());
              lastGeneratedLine++;
              lastGeneratedColumn = 0;
            } else {
              nextLine = remainingLines[remainingLinesIndex] || "";
              const code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
              remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
              lastGeneratedColumn = mapping.generatedColumn;
              addMappingWithCode(lastMapping, code);
              lastMapping = mapping;
              return;
            }
          }
          while (lastGeneratedLine < mapping.generatedLine) {
            node.add(shiftNextLine());
            lastGeneratedLine++;
          }
          if (lastGeneratedColumn < mapping.generatedColumn) {
            nextLine = remainingLines[remainingLinesIndex] || "";
            node.add(nextLine.substr(0, mapping.generatedColumn));
            remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
          }
          lastMapping = mapping;
        }, this);
        if (remainingLinesIndex < remainingLines.length) {
          if (lastMapping) {
            addMappingWithCode(lastMapping, shiftNextLine());
          }
          node.add(remainingLines.splice(remainingLinesIndex).join(""));
        }
        aSourceMapConsumer.sources.forEach(function(sourceFile) {
          const content = aSourceMapConsumer.sourceContentFor(sourceFile);
          if (content != null) {
            if (aRelativePath != null) {
              sourceFile = util.join(aRelativePath, sourceFile);
            }
            node.setSourceContent(sourceFile, content);
          }
        });
        return node;
        function addMappingWithCode(mapping, code) {
          if (mapping === null || mapping.source === void 0) {
            node.add(code);
          } else {
            const source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
            node.add(new _SourceNode(
              mapping.originalLine,
              mapping.originalColumn,
              source,
              code,
              mapping.name
            ));
          }
        }
        __name(addMappingWithCode, "addMappingWithCode");
      }
      /**
       * Add a chunk of generated JS to this source node.
       *
       * @param aChunk A string snippet of generated JS code, another instance of
       *        SourceNode, or an array where each member is one of those things.
       */
      add(aChunk) {
        if (Array.isArray(aChunk)) {
          aChunk.forEach(function(chunk3) {
            this.add(chunk3);
          }, this);
        } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
          if (aChunk) {
            this.children.push(aChunk);
          }
        } else {
          throw new TypeError(
            "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
          );
        }
        return this;
      }
      /**
       * Add a chunk of generated JS to the beginning of this source node.
       *
       * @param aChunk A string snippet of generated JS code, another instance of
       *        SourceNode, or an array where each member is one of those things.
       */
      prepend(aChunk) {
        if (Array.isArray(aChunk)) {
          for (let i = aChunk.length - 1; i >= 0; i--) {
            this.prepend(aChunk[i]);
          }
        } else if (aChunk[isSourceNode] || typeof aChunk === "string") {
          this.children.unshift(aChunk);
        } else {
          throw new TypeError(
            "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
          );
        }
        return this;
      }
      /**
       * Walk over the tree of JS snippets in this node and its children. The
       * walking function is called once for each snippet of JS and is passed that
       * snippet and the its original associated source's line/column location.
       *
       * @param aFn The traversal function.
       */
      walk(aFn) {
        let chunk3;
        for (let i = 0, len = this.children.length; i < len; i++) {
          chunk3 = this.children[i];
          if (chunk3[isSourceNode]) {
            chunk3.walk(aFn);
          } else if (chunk3 !== "") {
            aFn(chunk3, {
              source: this.source,
              line: this.line,
              column: this.column,
              name: this.name
            });
          }
        }
      }
      /**
       * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
       * each of `this.children`.
       *
       * @param aSep The separator.
       */
      join(aSep) {
        let newChildren;
        let i;
        const len = this.children.length;
        if (len > 0) {
          newChildren = [];
          for (i = 0; i < len - 1; i++) {
            newChildren.push(this.children[i]);
            newChildren.push(aSep);
          }
          newChildren.push(this.children[i]);
          this.children = newChildren;
        }
        return this;
      }
      /**
       * Call String.prototype.replace on the very right-most source snippet. Useful
       * for trimming whitespace from the end of a source node, etc.
       *
       * @param aPattern The pattern to replace.
       * @param aReplacement The thing to replace the pattern with.
       */
      replaceRight(aPattern, aReplacement) {
        const lastChild = this.children[this.children.length - 1];
        if (lastChild[isSourceNode]) {
          lastChild.replaceRight(aPattern, aReplacement);
        } else if (typeof lastChild === "string") {
          this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
        } else {
          this.children.push("".replace(aPattern, aReplacement));
        }
        return this;
      }
      /**
       * Set the source content for a source file. This will be added to the SourceMapGenerator
       * in the sourcesContent field.
       *
       * @param aSourceFile The filename of the source file
       * @param aSourceContent The content of the source file
       */
      setSourceContent(aSourceFile, aSourceContent) {
        this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
      }
      /**
       * Walk over the tree of SourceNodes. The walking function is called for each
       * source file content and is passed the filename and source content.
       *
       * @param aFn The traversal function.
       */
      walkSourceContents(aFn) {
        for (let i = 0, len = this.children.length; i < len; i++) {
          if (this.children[i][isSourceNode]) {
            this.children[i].walkSourceContents(aFn);
          }
        }
        const sources = Object.keys(this.sourceContents);
        for (let i = 0, len = sources.length; i < len; i++) {
          aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
        }
      }
      /**
       * Return the string representation of this source node. Walks over the tree
       * and concatenates all the various snippets together to one string.
       */
      toString() {
        let str = "";
        this.walk(function(chunk3) {
          str += chunk3;
        });
        return str;
      }
      /**
       * Returns the string representation of this source node along with a source
       * map.
       */
      toStringWithSourceMap(aArgs) {
        const generated = {
          code: "",
          line: 1,
          column: 0
        };
        const map3 = new SourceMapGenerator(aArgs);
        let sourceMappingActive = false;
        let lastOriginalSource = null;
        let lastOriginalLine = null;
        let lastOriginalColumn = null;
        let lastOriginalName = null;
        this.walk(function(chunk3, original) {
          generated.code += chunk3;
          if (original.source !== null && original.line !== null && original.column !== null) {
            if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
              map3.addMapping({
                source: original.source,
                original: {
                  line: original.line,
                  column: original.column
                },
                generated: {
                  line: generated.line,
                  column: generated.column
                },
                name: original.name
              });
            }
            lastOriginalSource = original.source;
            lastOriginalLine = original.line;
            lastOriginalColumn = original.column;
            lastOriginalName = original.name;
            sourceMappingActive = true;
          } else if (sourceMappingActive) {
            map3.addMapping({
              generated: {
                line: generated.line,
                column: generated.column
              }
            });
            lastOriginalSource = null;
            sourceMappingActive = false;
          }
          for (let idx = 0, length = chunk3.length; idx < length; idx++) {
            if (chunk3.charCodeAt(idx) === NEWLINE_CODE) {
              generated.line++;
              generated.column = 0;
              if (idx + 1 === length) {
                lastOriginalSource = null;
                sourceMappingActive = false;
              } else if (sourceMappingActive) {
                map3.addMapping({
                  source: original.source,
                  original: {
                    line: original.line,
                    column: original.column
                  },
                  generated: {
                    line: generated.line,
                    column: generated.column
                  },
                  name: original.name
                });
              }
            } else {
              generated.column++;
            }
          }
        });
        this.walkSourceContents(function(sourceFile, sourceContent) {
          map3.setSourceContent(sourceFile, sourceContent);
        });
        return { code: generated.code, map: map3 };
      }
    };
    exports.SourceNode = SourceNode;
  }
});

// node_modules/@remotion/renderer/node_modules/source-map/source-map.js
var require_source_map = __commonJS({
  "node_modules/@remotion/renderer/node_modules/source-map/source-map.js"(exports) {
    init_esm();
    exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
    exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
    exports.SourceNode = require_source_node().SourceNode;
  }
});

// node_modules/wrappy/wrappy.js
var require_wrappy = __commonJS({
  "node_modules/wrappy/wrappy.js"(exports, module) {
    init_esm();
    module.exports = wrappy;
    function wrappy(fn, cb) {
      if (fn && cb) return wrappy(fn)(cb);
      if (typeof fn !== "function")
        throw new TypeError("need wrapper function");
      Object.keys(fn).forEach(function(k) {
        wrapper[k] = fn[k];
      });
      return wrapper;
      function wrapper() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        var ret = fn.apply(this, args);
        var cb2 = args[args.length - 1];
        if (typeof ret === "function" && ret !== cb2) {
          Object.keys(cb2).forEach(function(k) {
            ret[k] = cb2[k];
          });
        }
        return ret;
      }
      __name(wrapper, "wrapper");
    }
    __name(wrappy, "wrappy");
  }
});

// node_modules/once/once.js
var require_once = __commonJS({
  "node_modules/once/once.js"(exports, module) {
    init_esm();
    var wrappy = require_wrappy();
    module.exports = wrappy(once);
    module.exports.strict = wrappy(onceStrict);
    once.proto = once(function() {
      Object.defineProperty(Function.prototype, "once", {
        value: /* @__PURE__ */ __name(function() {
          return once(this);
        }, "value"),
        configurable: true
      });
      Object.defineProperty(Function.prototype, "onceStrict", {
        value: /* @__PURE__ */ __name(function() {
          return onceStrict(this);
        }, "value"),
        configurable: true
      });
    });
    function once(fn) {
      var f = /* @__PURE__ */ __name(function() {
        if (f.called) return f.value;
        f.called = true;
        return f.value = fn.apply(this, arguments);
      }, "f");
      f.called = false;
      return f;
    }
    __name(once, "once");
    function onceStrict(fn) {
      var f = /* @__PURE__ */ __name(function() {
        if (f.called)
          throw new Error(f.onceError);
        f.called = true;
        return f.value = fn.apply(this, arguments);
      }, "f");
      var name = fn.name || "Function wrapped with `once`";
      f.onceError = name + " shouldn't be called more than once";
      f.called = false;
      return f;
    }
    __name(onceStrict, "onceStrict");
  }
});

// node_modules/end-of-stream/index.js
var require_end_of_stream = __commonJS({
  "node_modules/end-of-stream/index.js"(exports, module) {
    init_esm();
    var once = require_once();
    var noop3 = /* @__PURE__ */ __name(function() {
    }, "noop");
    var qnt = global.Bare ? queueMicrotask : process.nextTick.bind(process);
    var isRequest = /* @__PURE__ */ __name(function(stream) {
      return stream.setHeader && typeof stream.abort === "function";
    }, "isRequest");
    var isChildProcess = /* @__PURE__ */ __name(function(stream) {
      return stream.stdio && Array.isArray(stream.stdio) && stream.stdio.length === 3;
    }, "isChildProcess");
    var eos = /* @__PURE__ */ __name(function(stream, opts, callback) {
      if (typeof opts === "function") return eos(stream, null, opts);
      if (!opts) opts = {};
      callback = once(callback || noop3);
      var ws2 = stream._writableState;
      var rs = stream._readableState;
      var readable = opts.readable || opts.readable !== false && stream.readable;
      var writable = opts.writable || opts.writable !== false && stream.writable;
      var cancelled = false;
      var onlegacyfinish = /* @__PURE__ */ __name(function() {
        if (!stream.writable) onfinish();
      }, "onlegacyfinish");
      var onfinish = /* @__PURE__ */ __name(function() {
        writable = false;
        if (!readable) callback.call(stream);
      }, "onfinish");
      var onend = /* @__PURE__ */ __name(function() {
        readable = false;
        if (!writable) callback.call(stream);
      }, "onend");
      var onexit = /* @__PURE__ */ __name(function(exitCode) {
        callback.call(stream, exitCode ? new Error("exited with error code: " + exitCode) : null);
      }, "onexit");
      var onerror = /* @__PURE__ */ __name(function(err) {
        callback.call(stream, err);
      }, "onerror");
      var onclose = /* @__PURE__ */ __name(function() {
        qnt(onclosenexttick);
      }, "onclose");
      var onclosenexttick = /* @__PURE__ */ __name(function() {
        if (cancelled) return;
        if (readable && !(rs && (rs.ended && !rs.destroyed))) return callback.call(stream, new Error("premature close"));
        if (writable && !(ws2 && (ws2.ended && !ws2.destroyed))) return callback.call(stream, new Error("premature close"));
      }, "onclosenexttick");
      var onrequest = /* @__PURE__ */ __name(function() {
        stream.req.on("finish", onfinish);
      }, "onrequest");
      if (isRequest(stream)) {
        stream.on("complete", onfinish);
        stream.on("abort", onclose);
        if (stream.req) onrequest();
        else stream.on("request", onrequest);
      } else if (writable && !ws2) {
        stream.on("end", onlegacyfinish);
        stream.on("close", onlegacyfinish);
      }
      if (isChildProcess(stream)) stream.on("exit", onexit);
      stream.on("end", onend);
      stream.on("finish", onfinish);
      if (opts.error !== false) stream.on("error", onerror);
      stream.on("close", onclose);
      return function() {
        cancelled = true;
        stream.removeListener("complete", onfinish);
        stream.removeListener("abort", onclose);
        stream.removeListener("request", onrequest);
        if (stream.req) stream.req.removeListener("finish", onfinish);
        stream.removeListener("end", onlegacyfinish);
        stream.removeListener("close", onlegacyfinish);
        stream.removeListener("finish", onfinish);
        stream.removeListener("exit", onexit);
        stream.removeListener("end", onend);
        stream.removeListener("error", onerror);
        stream.removeListener("close", onclose);
      };
    }, "eos");
    module.exports = eos;
  }
});

// node_modules/pump/index.js
var require_pump = __commonJS({
  "node_modules/pump/index.js"(exports, module) {
    init_esm();
    var once = require_once();
    var eos = require_end_of_stream();
    var fs19;
    try {
      fs19 = __require("fs");
    } catch (e) {
    }
    var noop3 = /* @__PURE__ */ __name(function() {
    }, "noop");
    var ancient = typeof process === "undefined" ? false : /^v?\.0/.test(process.version);
    var isFn = /* @__PURE__ */ __name(function(fn) {
      return typeof fn === "function";
    }, "isFn");
    var isFS = /* @__PURE__ */ __name(function(stream) {
      if (!ancient) return false;
      if (!fs19) return false;
      return (stream instanceof (fs19.ReadStream || noop3) || stream instanceof (fs19.WriteStream || noop3)) && isFn(stream.close);
    }, "isFS");
    var isRequest = /* @__PURE__ */ __name(function(stream) {
      return stream.setHeader && isFn(stream.abort);
    }, "isRequest");
    var destroyer = /* @__PURE__ */ __name(function(stream, reading, writing, callback) {
      callback = once(callback);
      var closed = false;
      stream.on("close", function() {
        closed = true;
      });
      eos(stream, { readable: reading, writable: writing }, function(err) {
        if (err) return callback(err);
        closed = true;
        callback();
      });
      var destroyed = false;
      return function(err) {
        if (closed) return;
        if (destroyed) return;
        destroyed = true;
        if (isFS(stream)) return stream.close(noop3);
        if (isRequest(stream)) return stream.abort();
        if (isFn(stream.destroy)) return stream.destroy();
        callback(err || new Error("stream was destroyed"));
      };
    }, "destroyer");
    var call = /* @__PURE__ */ __name(function(fn) {
      fn();
    }, "call");
    var pipe = /* @__PURE__ */ __name(function(from, to) {
      return from.pipe(to);
    }, "pipe");
    var pump = /* @__PURE__ */ __name(function() {
      var streams = Array.prototype.slice.call(arguments);
      var callback = isFn(streams[streams.length - 1] || noop3) && streams.pop() || noop3;
      if (Array.isArray(streams[0])) streams = streams[0];
      if (streams.length < 2) throw new Error("pump requires two streams per minimum");
      var error;
      var destroys = streams.map(function(stream, i) {
        var reading = i < streams.length - 1;
        var writing = i > 0;
        return destroyer(stream, reading, writing, function(err) {
          if (!error) error = err;
          if (err) destroys.forEach(call);
          if (reading) return;
          destroys.forEach(call);
          callback(error);
        });
      });
      return streams.reduce(pipe);
    }, "pump");
    module.exports = pump;
  }
});

// node_modules/extract-zip/node_modules/get-stream/buffer-stream.js
var require_buffer_stream2 = __commonJS({
  "node_modules/extract-zip/node_modules/get-stream/buffer-stream.js"(exports, module) {
    "use strict";
    init_esm();
    var { PassThrough: PassThroughStream } = __require("stream");
    module.exports = (options) => {
      options = { ...options };
      const { array } = options;
      let { encoding } = options;
      const isBuffer = encoding === "buffer";
      let objectMode = false;
      if (array) {
        objectMode = !(encoding || isBuffer);
      } else {
        encoding = encoding || "utf8";
      }
      if (isBuffer) {
        encoding = null;
      }
      const stream = new PassThroughStream({ objectMode });
      if (encoding) {
        stream.setEncoding(encoding);
      }
      let length = 0;
      const chunks = [];
      stream.on("data", (chunk3) => {
        chunks.push(chunk3);
        if (objectMode) {
          length = chunks.length;
        } else {
          length += chunk3.length;
        }
      });
      stream.getBufferedValue = () => {
        if (array) {
          return chunks;
        }
        return isBuffer ? Buffer.concat(chunks, length) : chunks.join("");
      };
      stream.getBufferedLength = () => length;
      return stream;
    };
  }
});

// node_modules/extract-zip/node_modules/get-stream/index.js
var require_get_stream2 = __commonJS({
  "node_modules/extract-zip/node_modules/get-stream/index.js"(exports, module) {
    "use strict";
    init_esm();
    var { constants: BufferConstants } = __require("buffer");
    var pump = require_pump();
    var bufferStream = require_buffer_stream2();
    var MaxBufferError = class extends Error {
      static {
        __name(this, "MaxBufferError");
      }
      constructor() {
        super("maxBuffer exceeded");
        this.name = "MaxBufferError";
      }
    };
    async function getStream(inputStream, options) {
      if (!inputStream) {
        return Promise.reject(new Error("Expected a stream"));
      }
      options = {
        maxBuffer: Infinity,
        ...options
      };
      const { maxBuffer } = options;
      let stream;
      await new Promise((resolve3, reject) => {
        const rejectPromise = /* @__PURE__ */ __name((error) => {
          if (error && stream.getBufferedLength() <= BufferConstants.MAX_LENGTH) {
            error.bufferedData = stream.getBufferedValue();
          }
          reject(error);
        }, "rejectPromise");
        stream = pump(inputStream, bufferStream(options), (error) => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolve3();
        });
        stream.on("data", () => {
          if (stream.getBufferedLength() > maxBuffer) {
            rejectPromise(new MaxBufferError());
          }
        });
      });
      return stream.getBufferedValue();
    }
    __name(getStream, "getStream");
    module.exports = getStream;
    module.exports.default = getStream;
    module.exports.buffer = (stream, options) => getStream(stream, { ...options, encoding: "buffer" });
    module.exports.array = (stream, options) => getStream(stream, { ...options, array: true });
    module.exports.MaxBufferError = MaxBufferError;
  }
});

// node_modules/pend/index.js
var require_pend = __commonJS({
  "node_modules/pend/index.js"(exports, module) {
    init_esm();
    module.exports = Pend;
    function Pend() {
      this.pending = 0;
      this.max = Infinity;
      this.listeners = [];
      this.waiting = [];
      this.error = null;
    }
    __name(Pend, "Pend");
    Pend.prototype.go = function(fn) {
      if (this.pending < this.max) {
        pendGo(this, fn);
      } else {
        this.waiting.push(fn);
      }
    };
    Pend.prototype.wait = function(cb) {
      if (this.pending === 0) {
        cb(this.error);
      } else {
        this.listeners.push(cb);
      }
    };
    Pend.prototype.hold = function() {
      return pendHold(this);
    };
    function pendHold(self) {
      self.pending += 1;
      var called = false;
      return onCb;
      function onCb(err) {
        if (called) throw new Error("callback called twice");
        called = true;
        self.error = self.error || err;
        self.pending -= 1;
        if (self.waiting.length > 0 && self.pending < self.max) {
          pendGo(self, self.waiting.shift());
        } else if (self.pending === 0) {
          var listeners = self.listeners;
          self.listeners = [];
          listeners.forEach(cbListener);
        }
      }
      __name(onCb, "onCb");
      function cbListener(listener) {
        listener(self.error);
      }
      __name(cbListener, "cbListener");
    }
    __name(pendHold, "pendHold");
    function pendGo(self, fn) {
      fn(pendHold(self));
    }
    __name(pendGo, "pendGo");
  }
});

// node_modules/fd-slicer/index.js
var require_fd_slicer = __commonJS({
  "node_modules/fd-slicer/index.js"(exports) {
    init_esm();
    var fs19 = __require("fs");
    var util = __require("util");
    var stream = __require("stream");
    var Readable = stream.Readable;
    var Writable = stream.Writable;
    var PassThrough = stream.PassThrough;
    var Pend = require_pend();
    var EventEmitter2 = __require("events").EventEmitter;
    exports.createFromBuffer = createFromBuffer;
    exports.createFromFd = createFromFd;
    exports.BufferSlicer = BufferSlicer;
    exports.FdSlicer = FdSlicer;
    util.inherits(FdSlicer, EventEmitter2);
    function FdSlicer(fd, options) {
      options = options || {};
      EventEmitter2.call(this);
      this.fd = fd;
      this.pend = new Pend();
      this.pend.max = 1;
      this.refCount = 0;
      this.autoClose = !!options.autoClose;
    }
    __name(FdSlicer, "FdSlicer");
    FdSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      var self = this;
      self.pend.go(function(cb) {
        fs19.read(self.fd, buffer, offset, length, position, function(err, bytesRead, buffer2) {
          cb();
          callback(err, bytesRead, buffer2);
        });
      });
    };
    FdSlicer.prototype.write = function(buffer, offset, length, position, callback) {
      var self = this;
      self.pend.go(function(cb) {
        fs19.write(self.fd, buffer, offset, length, position, function(err, written, buffer2) {
          cb();
          callback(err, written, buffer2);
        });
      });
    };
    FdSlicer.prototype.createReadStream = function(options) {
      return new ReadStream(this, options);
    };
    FdSlicer.prototype.createWriteStream = function(options) {
      return new WriteStream(this, options);
    };
    FdSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    FdSlicer.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount > 0) return;
      if (self.refCount < 0) throw new Error("invalid unref");
      if (self.autoClose) {
        fs19.close(self.fd, onCloseDone);
      }
      function onCloseDone(err) {
        if (err) {
          self.emit("error", err);
        } else {
          self.emit("close");
        }
      }
      __name(onCloseDone, "onCloseDone");
    };
    util.inherits(ReadStream, Readable);
    function ReadStream(context, options) {
      options = options || {};
      Readable.call(this, options);
      this.context = context;
      this.context.ref();
      this.start = options.start || 0;
      this.endOffset = options.end;
      this.pos = this.start;
      this.destroyed = false;
    }
    __name(ReadStream, "ReadStream");
    ReadStream.prototype._read = function(n) {
      var self = this;
      if (self.destroyed) return;
      var toRead = Math.min(self._readableState.highWaterMark, n);
      if (self.endOffset != null) {
        toRead = Math.min(toRead, self.endOffset - self.pos);
      }
      if (toRead <= 0) {
        self.destroyed = true;
        self.push(null);
        self.context.unref();
        return;
      }
      self.context.pend.go(function(cb) {
        if (self.destroyed) return cb();
        var buffer = new Buffer(toRead);
        fs19.read(self.context.fd, buffer, 0, toRead, self.pos, function(err, bytesRead) {
          if (err) {
            self.destroy(err);
          } else if (bytesRead === 0) {
            self.destroyed = true;
            self.push(null);
            self.context.unref();
          } else {
            self.pos += bytesRead;
            self.push(buffer.slice(0, bytesRead));
          }
          cb();
        });
      });
    };
    ReadStream.prototype.destroy = function(err) {
      if (this.destroyed) return;
      err = err || new Error("stream destroyed");
      this.destroyed = true;
      this.emit("error", err);
      this.context.unref();
    };
    util.inherits(WriteStream, Writable);
    function WriteStream(context, options) {
      options = options || {};
      Writable.call(this, options);
      this.context = context;
      this.context.ref();
      this.start = options.start || 0;
      this.endOffset = options.end == null ? Infinity : +options.end;
      this.bytesWritten = 0;
      this.pos = this.start;
      this.destroyed = false;
      this.on("finish", this.destroy.bind(this));
    }
    __name(WriteStream, "WriteStream");
    WriteStream.prototype._write = function(buffer, encoding, callback) {
      var self = this;
      if (self.destroyed) return;
      if (self.pos + buffer.length > self.endOffset) {
        var err = new Error("maximum file length exceeded");
        err.code = "ETOOBIG";
        self.destroy();
        callback(err);
        return;
      }
      self.context.pend.go(function(cb) {
        if (self.destroyed) return cb();
        fs19.write(self.context.fd, buffer, 0, buffer.length, self.pos, function(err2, bytes) {
          if (err2) {
            self.destroy();
            cb();
            callback(err2);
          } else {
            self.bytesWritten += bytes;
            self.pos += bytes;
            self.emit("progress");
            cb();
            callback();
          }
        });
      });
    };
    WriteStream.prototype.destroy = function() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.context.unref();
    };
    util.inherits(BufferSlicer, EventEmitter2);
    function BufferSlicer(buffer, options) {
      EventEmitter2.call(this);
      options = options || {};
      this.refCount = 0;
      this.buffer = buffer;
      this.maxChunkSize = options.maxChunkSize || Number.MAX_SAFE_INTEGER;
    }
    __name(BufferSlicer, "BufferSlicer");
    BufferSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      var end = position + length;
      var delta = end - this.buffer.length;
      var written = delta > 0 ? delta : length;
      this.buffer.copy(buffer, offset, position, end);
      setImmediate(function() {
        callback(null, written);
      });
    };
    BufferSlicer.prototype.write = function(buffer, offset, length, position, callback) {
      buffer.copy(this.buffer, position, offset, offset + length);
      setImmediate(function() {
        callback(null, length, buffer);
      });
    };
    BufferSlicer.prototype.createReadStream = function(options) {
      options = options || {};
      var readStream = new PassThrough(options);
      readStream.destroyed = false;
      readStream.start = options.start || 0;
      readStream.endOffset = options.end;
      readStream.pos = readStream.endOffset || this.buffer.length;
      var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
      var offset = 0;
      while (true) {
        var nextOffset = offset + this.maxChunkSize;
        if (nextOffset >= entireSlice.length) {
          if (offset < entireSlice.length) {
            readStream.write(entireSlice.slice(offset, entireSlice.length));
          }
          break;
        }
        readStream.write(entireSlice.slice(offset, nextOffset));
        offset = nextOffset;
      }
      readStream.end();
      readStream.destroy = function() {
        readStream.destroyed = true;
      };
      return readStream;
    };
    BufferSlicer.prototype.createWriteStream = function(options) {
      var bufferSlicer = this;
      options = options || {};
      var writeStream = new Writable(options);
      writeStream.start = options.start || 0;
      writeStream.endOffset = options.end == null ? this.buffer.length : +options.end;
      writeStream.bytesWritten = 0;
      writeStream.pos = writeStream.start;
      writeStream.destroyed = false;
      writeStream._write = function(buffer, encoding, callback) {
        if (writeStream.destroyed) return;
        var end = writeStream.pos + buffer.length;
        if (end > writeStream.endOffset) {
          var err = new Error("maximum file length exceeded");
          err.code = "ETOOBIG";
          writeStream.destroyed = true;
          callback(err);
          return;
        }
        buffer.copy(bufferSlicer.buffer, writeStream.pos, 0, buffer.length);
        writeStream.bytesWritten += buffer.length;
        writeStream.pos = end;
        writeStream.emit("progress");
        callback();
      };
      writeStream.destroy = function() {
        writeStream.destroyed = true;
      };
      return writeStream;
    };
    BufferSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    BufferSlicer.prototype.unref = function() {
      this.refCount -= 1;
      if (this.refCount < 0) {
        throw new Error("invalid unref");
      }
    };
    function createFromBuffer(buffer, options) {
      return new BufferSlicer(buffer, options);
    }
    __name(createFromBuffer, "createFromBuffer");
    function createFromFd(fd, options) {
      return new FdSlicer(fd, options);
    }
    __name(createFromFd, "createFromFd");
  }
});

// node_modules/buffer-crc32/index.js
var require_buffer_crc32 = __commonJS({
  "node_modules/buffer-crc32/index.js"(exports, module) {
    init_esm();
    var Buffer2 = __require("buffer").Buffer;
    var CRC_TABLE = [
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ];
    if (typeof Int32Array !== "undefined") {
      CRC_TABLE = new Int32Array(CRC_TABLE);
    }
    function ensureBuffer(input) {
      if (Buffer2.isBuffer(input)) {
        return input;
      }
      var hasNewBufferAPI = typeof Buffer2.alloc === "function" && typeof Buffer2.from === "function";
      if (typeof input === "number") {
        return hasNewBufferAPI ? Buffer2.alloc(input) : new Buffer2(input);
      } else if (typeof input === "string") {
        return hasNewBufferAPI ? Buffer2.from(input) : new Buffer2(input);
      } else {
        throw new Error("input must be buffer, number, or string, received " + typeof input);
      }
    }
    __name(ensureBuffer, "ensureBuffer");
    function bufferizeInt(num) {
      var tmp = ensureBuffer(4);
      tmp.writeInt32BE(num, 0);
      return tmp;
    }
    __name(bufferizeInt, "bufferizeInt");
    function _crc32(buf, previous) {
      buf = ensureBuffer(buf);
      if (Buffer2.isBuffer(previous)) {
        previous = previous.readUInt32BE(0);
      }
      var crc = ~~previous ^ -1;
      for (var n = 0; n < buf.length; n++) {
        crc = CRC_TABLE[(crc ^ buf[n]) & 255] ^ crc >>> 8;
      }
      return crc ^ -1;
    }
    __name(_crc32, "_crc32");
    function crc32() {
      return bufferizeInt(_crc32.apply(null, arguments));
    }
    __name(crc32, "crc32");
    crc32.signed = function() {
      return _crc32.apply(null, arguments);
    };
    crc32.unsigned = function() {
      return _crc32.apply(null, arguments) >>> 0;
    };
    module.exports = crc32;
  }
});

// node_modules/yauzl/index.js
var require_yauzl = __commonJS({
  "node_modules/yauzl/index.js"(exports) {
    init_esm();
    var fs19 = __require("fs");
    var zlib = __require("zlib");
    var fd_slicer = require_fd_slicer();
    var crc32 = require_buffer_crc32();
    var util = __require("util");
    var EventEmitter2 = __require("events").EventEmitter;
    var Transform = __require("stream").Transform;
    var PassThrough = __require("stream").PassThrough;
    var Writable = __require("stream").Writable;
    exports.open = open;
    exports.fromFd = fromFd;
    exports.fromBuffer = fromBuffer;
    exports.fromRandomAccessReader = fromRandomAccessReader;
    exports.dosDateTimeToDate = dosDateTimeToDate;
    exports.validateFileName = validateFileName;
    exports.ZipFile = ZipFile;
    exports.Entry = Entry;
    exports.RandomAccessReader = RandomAccessReader;
    function open(path28, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = null;
      }
      if (options == null) options = {};
      if (options.autoClose == null) options.autoClose = true;
      if (options.lazyEntries == null) options.lazyEntries = false;
      if (options.decodeStrings == null) options.decodeStrings = true;
      if (options.validateEntrySizes == null) options.validateEntrySizes = true;
      if (options.strictFileNames == null) options.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs19.open(path28, "r", function(err, fd) {
        if (err) return callback(err);
        fromFd(fd, options, function(err2, zipfile) {
          if (err2) fs19.close(fd, defaultCallback);
          callback(err2, zipfile);
        });
      });
    }
    __name(open, "open");
    function fromFd(fd, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = null;
      }
      if (options == null) options = {};
      if (options.autoClose == null) options.autoClose = false;
      if (options.lazyEntries == null) options.lazyEntries = false;
      if (options.decodeStrings == null) options.decodeStrings = true;
      if (options.validateEntrySizes == null) options.validateEntrySizes = true;
      if (options.strictFileNames == null) options.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs19.fstat(fd, function(err, stats) {
        if (err) return callback(err);
        var reader = fd_slicer.createFromFd(fd, { autoClose: true });
        fromRandomAccessReader(reader, stats.size, options, callback);
      });
    }
    __name(fromFd, "fromFd");
    function fromBuffer(buffer, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = null;
      }
      if (options == null) options = {};
      options.autoClose = false;
      if (options.lazyEntries == null) options.lazyEntries = false;
      if (options.decodeStrings == null) options.decodeStrings = true;
      if (options.validateEntrySizes == null) options.validateEntrySizes = true;
      if (options.strictFileNames == null) options.strictFileNames = false;
      var reader = fd_slicer.createFromBuffer(buffer, { maxChunkSize: 65536 });
      fromRandomAccessReader(reader, buffer.length, options, callback);
    }
    __name(fromBuffer, "fromBuffer");
    function fromRandomAccessReader(reader, totalSize, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = null;
      }
      if (options == null) options = {};
      if (options.autoClose == null) options.autoClose = true;
      if (options.lazyEntries == null) options.lazyEntries = false;
      if (options.decodeStrings == null) options.decodeStrings = true;
      var decodeStrings = !!options.decodeStrings;
      if (options.validateEntrySizes == null) options.validateEntrySizes = true;
      if (options.strictFileNames == null) options.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
      if (totalSize > Number.MAX_SAFE_INTEGER) {
        throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
      }
      reader.ref();
      var eocdrWithoutCommentSize = 22;
      var maxCommentSize = 65535;
      var bufferSize = Math.min(eocdrWithoutCommentSize + maxCommentSize, totalSize);
      var buffer = newBuffer(bufferSize);
      var bufferReadStart = totalSize - buffer.length;
      readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
        if (err) return callback(err);
        for (var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1) {
          if (buffer.readUInt32LE(i) !== 101010256) continue;
          var eocdrBuffer = buffer.slice(i);
          var diskNumber = eocdrBuffer.readUInt16LE(4);
          if (diskNumber !== 0) {
            return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
          }
          var entryCount = eocdrBuffer.readUInt16LE(10);
          var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
          var commentLength = eocdrBuffer.readUInt16LE(20);
          var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
          if (commentLength !== expectedCommentLength) {
            return callback(new Error("invalid comment length. expected: " + expectedCommentLength + ". found: " + commentLength));
          }
          var comment = decodeStrings ? decodeBuffer(eocdrBuffer, 22, eocdrBuffer.length, false) : eocdrBuffer.slice(22);
          if (!(entryCount === 65535 || centralDirectoryOffset === 4294967295)) {
            return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, options.lazyEntries, decodeStrings, options.validateEntrySizes, options.strictFileNames));
          }
          var zip64EocdlBuffer = newBuffer(20);
          var zip64EocdlOffset = bufferReadStart + i - zip64EocdlBuffer.length;
          readAndAssertNoEof(reader, zip64EocdlBuffer, 0, zip64EocdlBuffer.length, zip64EocdlOffset, function(err2) {
            if (err2) return callback(err2);
            if (zip64EocdlBuffer.readUInt32LE(0) !== 117853008) {
              return callback(new Error("invalid zip64 end of central directory locator signature"));
            }
            var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
            var zip64EocdrBuffer = newBuffer(56);
            readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err3) {
              if (err3) return callback(err3);
              if (zip64EocdrBuffer.readUInt32LE(0) !== 101075792) {
                return callback(new Error("invalid zip64 end of central directory record signature"));
              }
              entryCount = readUInt64LE(zip64EocdrBuffer, 32);
              centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
              return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options.autoClose, options.lazyEntries, decodeStrings, options.validateEntrySizes, options.strictFileNames));
            });
          });
          return;
        }
        callback(new Error("end of central directory record signature not found"));
      });
    }
    __name(fromRandomAccessReader, "fromRandomAccessReader");
    util.inherits(ZipFile, EventEmitter2);
    function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
      var self = this;
      EventEmitter2.call(self);
      self.reader = reader;
      self.reader.on("error", function(err) {
        emitError(self, err);
      });
      self.reader.once("close", function() {
        self.emit("close");
      });
      self.readEntryCursor = centralDirectoryOffset;
      self.fileSize = fileSize;
      self.entryCount = entryCount;
      self.comment = comment;
      self.entriesRead = 0;
      self.autoClose = !!autoClose;
      self.lazyEntries = !!lazyEntries;
      self.decodeStrings = !!decodeStrings;
      self.validateEntrySizes = !!validateEntrySizes;
      self.strictFileNames = !!strictFileNames;
      self.isOpen = true;
      self.emittedError = false;
      if (!self.lazyEntries) self._readEntry();
    }
    __name(ZipFile, "ZipFile");
    ZipFile.prototype.close = function() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.reader.unref();
    };
    function emitErrorAndAutoClose(self, err) {
      if (self.autoClose) self.close();
      emitError(self, err);
    }
    __name(emitErrorAndAutoClose, "emitErrorAndAutoClose");
    function emitError(self, err) {
      if (self.emittedError) return;
      self.emittedError = true;
      self.emit("error", err);
    }
    __name(emitError, "emitError");
    ZipFile.prototype.readEntry = function() {
      if (!this.lazyEntries) throw new Error("readEntry() called without lazyEntries:true");
      this._readEntry();
    };
    ZipFile.prototype._readEntry = function() {
      var self = this;
      if (self.entryCount === self.entriesRead) {
        setImmediate(function() {
          if (self.autoClose) self.close();
          if (self.emittedError) return;
          self.emit("end");
        });
        return;
      }
      if (self.emittedError) return;
      var buffer = newBuffer(46);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
        if (err) return emitErrorAndAutoClose(self, err);
        if (self.emittedError) return;
        var entry = new Entry();
        var signature = buffer.readUInt32LE(0);
        if (signature !== 33639248) return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
        entry.versionMadeBy = buffer.readUInt16LE(4);
        entry.versionNeededToExtract = buffer.readUInt16LE(6);
        entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
        entry.compressionMethod = buffer.readUInt16LE(10);
        entry.lastModFileTime = buffer.readUInt16LE(12);
        entry.lastModFileDate = buffer.readUInt16LE(14);
        entry.crc32 = buffer.readUInt32LE(16);
        entry.compressedSize = buffer.readUInt32LE(20);
        entry.uncompressedSize = buffer.readUInt32LE(24);
        entry.fileNameLength = buffer.readUInt16LE(28);
        entry.extraFieldLength = buffer.readUInt16LE(30);
        entry.fileCommentLength = buffer.readUInt16LE(32);
        entry.internalFileAttributes = buffer.readUInt16LE(36);
        entry.externalFileAttributes = buffer.readUInt32LE(38);
        entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);
        if (entry.generalPurposeBitFlag & 64) return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));
        self.readEntryCursor += 46;
        buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
        readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err2) {
          if (err2) return emitErrorAndAutoClose(self, err2);
          if (self.emittedError) return;
          var isUtf8 = (entry.generalPurposeBitFlag & 2048) !== 0;
          entry.fileName = self.decodeStrings ? decodeBuffer(buffer, 0, entry.fileNameLength, isUtf8) : buffer.slice(0, entry.fileNameLength);
          var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
          var extraFieldBuffer = buffer.slice(entry.fileNameLength, fileCommentStart);
          entry.extraFields = [];
          var i = 0;
          while (i < extraFieldBuffer.length - 3) {
            var headerId = extraFieldBuffer.readUInt16LE(i + 0);
            var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
            var dataStart = i + 4;
            var dataEnd = dataStart + dataSize;
            if (dataEnd > extraFieldBuffer.length) return emitErrorAndAutoClose(self, new Error("extra field length exceeds extra field buffer size"));
            var dataBuffer = newBuffer(dataSize);
            extraFieldBuffer.copy(dataBuffer, 0, dataStart, dataEnd);
            entry.extraFields.push({
              id: headerId,
              data: dataBuffer
            });
            i = dataEnd;
          }
          entry.fileComment = self.decodeStrings ? decodeBuffer(buffer, fileCommentStart, fileCommentStart + entry.fileCommentLength, isUtf8) : buffer.slice(fileCommentStart, fileCommentStart + entry.fileCommentLength);
          entry.comment = entry.fileComment;
          self.readEntryCursor += buffer.length;
          self.entriesRead += 1;
          if (entry.uncompressedSize === 4294967295 || entry.compressedSize === 4294967295 || entry.relativeOffsetOfLocalHeader === 4294967295) {
            var zip64EiefBuffer = null;
            for (var i = 0; i < entry.extraFields.length; i++) {
              var extraField = entry.extraFields[i];
              if (extraField.id === 1) {
                zip64EiefBuffer = extraField.data;
                break;
              }
            }
            if (zip64EiefBuffer == null) {
              return emitErrorAndAutoClose(self, new Error("expected zip64 extended information extra field"));
            }
            var index = 0;
            if (entry.uncompressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
              }
              entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.compressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
              }
              entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.relativeOffsetOfLocalHeader === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
              }
              entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
          }
          if (self.decodeStrings) {
            for (var i = 0; i < entry.extraFields.length; i++) {
              var extraField = entry.extraFields[i];
              if (extraField.id === 28789) {
                if (extraField.data.length < 6) {
                  continue;
                }
                if (extraField.data.readUInt8(0) !== 1) {
                  continue;
                }
                var oldNameCrc32 = extraField.data.readUInt32LE(1);
                if (crc32.unsigned(buffer.slice(0, entry.fileNameLength)) !== oldNameCrc32) {
                  continue;
                }
                entry.fileName = decodeBuffer(extraField.data, 5, extraField.data.length, true);
                break;
              }
            }
          }
          if (self.validateEntrySizes && entry.compressionMethod === 0) {
            var expectedCompressedSize = entry.uncompressedSize;
            if (entry.isEncrypted()) {
              expectedCompressedSize += 12;
            }
            if (entry.compressedSize !== expectedCompressedSize) {
              var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
              return emitErrorAndAutoClose(self, new Error(msg));
            }
          }
          if (self.decodeStrings) {
            if (!self.strictFileNames) {
              entry.fileName = entry.fileName.replace(/\\/g, "/");
            }
            var errorMessage = validateFileName(entry.fileName, self.validateFileNameOptions);
            if (errorMessage != null) return emitErrorAndAutoClose(self, new Error(errorMessage));
          }
          self.emit("entry", entry);
          if (!self.lazyEntries) self._readEntry();
        });
      });
    };
    ZipFile.prototype.openReadStream = function(entry, options, callback) {
      var self = this;
      var relativeStart = 0;
      var relativeEnd = entry.compressedSize;
      if (callback == null) {
        callback = options;
        options = {};
      } else {
        if (options.decrypt != null) {
          if (!entry.isEncrypted()) {
            throw new Error("options.decrypt can only be specified for encrypted entries");
          }
          if (options.decrypt !== false) throw new Error("invalid options.decrypt value: " + options.decrypt);
          if (entry.isCompressed()) {
            if (options.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false");
          }
        }
        if (options.decompress != null) {
          if (!entry.isCompressed()) {
            throw new Error("options.decompress can only be specified for compressed entries");
          }
          if (!(options.decompress === false || options.decompress === true)) {
            throw new Error("invalid options.decompress value: " + options.decompress);
          }
        }
        if (options.start != null || options.end != null) {
          if (entry.isCompressed() && options.decompress !== false) {
            throw new Error("start/end range not allowed for compressed entry without options.decompress === false");
          }
          if (entry.isEncrypted() && options.decrypt !== false) {
            throw new Error("start/end range not allowed for encrypted entry without options.decrypt === false");
          }
        }
        if (options.start != null) {
          relativeStart = options.start;
          if (relativeStart < 0) throw new Error("options.start < 0");
          if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
        }
        if (options.end != null) {
          relativeEnd = options.end;
          if (relativeEnd < 0) throw new Error("options.end < 0");
          if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
          if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
        }
      }
      if (!self.isOpen) return callback(new Error("closed"));
      if (entry.isEncrypted()) {
        if (options.decrypt !== false) return callback(new Error("entry is encrypted, and options.decrypt !== false"));
      }
      self.reader.ref();
      var buffer = newBuffer(30);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
        try {
          if (err) return callback(err);
          var signature = buffer.readUInt32LE(0);
          if (signature !== 67324752) {
            return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
          }
          var fileNameLength = buffer.readUInt16LE(26);
          var extraFieldLength = buffer.readUInt16LE(28);
          var localFileHeaderEnd = entry.relativeOffsetOfLocalHeader + buffer.length + fileNameLength + extraFieldLength;
          var decompress;
          if (entry.compressionMethod === 0) {
            decompress = false;
          } else if (entry.compressionMethod === 8) {
            decompress = options.decompress != null ? options.decompress : true;
          } else {
            return callback(new Error("unsupported compression method: " + entry.compressionMethod));
          }
          var fileDataStart = localFileHeaderEnd;
          var fileDataEnd = fileDataStart + entry.compressedSize;
          if (entry.compressedSize !== 0) {
            if (fileDataEnd > self.fileSize) {
              return callback(new Error("file data overflows file bounds: " + fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
            }
          }
          var readStream = self.reader.createReadStream({
            start: fileDataStart + relativeStart,
            end: fileDataStart + relativeEnd
          });
          var endpointStream = readStream;
          if (decompress) {
            var destroyed = false;
            var inflateFilter = zlib.createInflateRaw();
            readStream.on("error", function(err2) {
              setImmediate(function() {
                if (!destroyed) inflateFilter.emit("error", err2);
              });
            });
            readStream.pipe(inflateFilter);
            if (self.validateEntrySizes) {
              endpointStream = new AssertByteCountStream(entry.uncompressedSize);
              inflateFilter.on("error", function(err2) {
                setImmediate(function() {
                  if (!destroyed) endpointStream.emit("error", err2);
                });
              });
              inflateFilter.pipe(endpointStream);
            } else {
              endpointStream = inflateFilter;
            }
            endpointStream.destroy = function() {
              destroyed = true;
              if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
              readStream.unpipe(inflateFilter);
              readStream.destroy();
            };
          }
          callback(null, endpointStream);
        } finally {
          self.reader.unref();
        }
      });
    };
    function Entry() {
    }
    __name(Entry, "Entry");
    Entry.prototype.getLastModDate = function() {
      return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime);
    };
    Entry.prototype.isEncrypted = function() {
      return (this.generalPurposeBitFlag & 1) !== 0;
    };
    Entry.prototype.isCompressed = function() {
      return this.compressionMethod === 8;
    };
    function dosDateTimeToDate(date, time) {
      var day = date & 31;
      var month = (date >> 5 & 15) - 1;
      var year = (date >> 9 & 127) + 1980;
      var millisecond = 0;
      var second = (time & 31) * 2;
      var minute = time >> 5 & 63;
      var hour = time >> 11 & 31;
      return new Date(year, month, day, hour, minute, second, millisecond);
    }
    __name(dosDateTimeToDate, "dosDateTimeToDate");
    function validateFileName(fileName) {
      if (fileName.indexOf("\\") !== -1) {
        return "invalid characters in fileName: " + fileName;
      }
      if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
        return "absolute path: " + fileName;
      }
      if (fileName.split("/").indexOf("..") !== -1) {
        return "invalid relative path: " + fileName;
      }
      return null;
    }
    __name(validateFileName, "validateFileName");
    function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
      if (length === 0) {
        return setImmediate(function() {
          callback(null, newBuffer(0));
        });
      }
      reader.read(buffer, offset, length, position, function(err, bytesRead) {
        if (err) return callback(err);
        if (bytesRead < length) {
          return callback(new Error("unexpected EOF"));
        }
        callback();
      });
    }
    __name(readAndAssertNoEof, "readAndAssertNoEof");
    util.inherits(AssertByteCountStream, Transform);
    function AssertByteCountStream(byteCount) {
      Transform.call(this);
      this.actualByteCount = 0;
      this.expectedByteCount = byteCount;
    }
    __name(AssertByteCountStream, "AssertByteCountStream");
    AssertByteCountStream.prototype._transform = function(chunk3, encoding, cb) {
      this.actualByteCount += chunk3.length;
      if (this.actualByteCount > this.expectedByteCount) {
        var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb(null, chunk3);
    };
    AssertByteCountStream.prototype._flush = function(cb) {
      if (this.actualByteCount < this.expectedByteCount) {
        var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb();
    };
    util.inherits(RandomAccessReader, EventEmitter2);
    function RandomAccessReader() {
      EventEmitter2.call(this);
      this.refCount = 0;
    }
    __name(RandomAccessReader, "RandomAccessReader");
    RandomAccessReader.prototype.ref = function() {
      this.refCount += 1;
    };
    RandomAccessReader.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount > 0) return;
      if (self.refCount < 0) throw new Error("invalid unref");
      self.close(onCloseDone);
      function onCloseDone(err) {
        if (err) return self.emit("error", err);
        self.emit("close");
      }
      __name(onCloseDone, "onCloseDone");
    };
    RandomAccessReader.prototype.createReadStream = function(options) {
      var start = options.start;
      var end = options.end;
      if (start === end) {
        var emptyStream = new PassThrough();
        setImmediate(function() {
          emptyStream.end();
        });
        return emptyStream;
      }
      var stream = this._readStreamForRange(start, end);
      var destroyed = false;
      var refUnrefFilter = new RefUnrefFilter(this);
      stream.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) refUnrefFilter.emit("error", err);
        });
      });
      refUnrefFilter.destroy = function() {
        stream.unpipe(refUnrefFilter);
        refUnrefFilter.unref();
        stream.destroy();
      };
      var byteCounter = new AssertByteCountStream(end - start);
      refUnrefFilter.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) byteCounter.emit("error", err);
        });
      });
      byteCounter.destroy = function() {
        destroyed = true;
        refUnrefFilter.unpipe(byteCounter);
        refUnrefFilter.destroy();
      };
      return stream.pipe(refUnrefFilter).pipe(byteCounter);
    };
    RandomAccessReader.prototype._readStreamForRange = function(start, end) {
      throw new Error("not implemented");
    };
    RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
      var readStream = this.createReadStream({ start: position, end: position + length });
      var writeStream = new Writable();
      var written = 0;
      writeStream._write = function(chunk3, encoding, cb) {
        chunk3.copy(buffer, offset + written, 0, chunk3.length);
        written += chunk3.length;
        cb();
      };
      writeStream.on("finish", callback);
      readStream.on("error", function(error) {
        callback(error);
      });
      readStream.pipe(writeStream);
    };
    RandomAccessReader.prototype.close = function(callback) {
      setImmediate(callback);
    };
    util.inherits(RefUnrefFilter, PassThrough);
    function RefUnrefFilter(context) {
      PassThrough.call(this);
      this.context = context;
      this.context.ref();
      this.unreffedYet = false;
    }
    __name(RefUnrefFilter, "RefUnrefFilter");
    RefUnrefFilter.prototype._flush = function(cb) {
      this.unref();
      cb();
    };
    RefUnrefFilter.prototype.unref = function(cb) {
      if (this.unreffedYet) return;
      this.unreffedYet = true;
      this.context.unref();
    };
    var cp437 = "\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
    function decodeBuffer(buffer, start, end, isUtf8) {
      if (isUtf8) {
        return buffer.toString("utf8", start, end);
      } else {
        var result = "";
        for (var i = start; i < end; i++) {
          result += cp437[buffer[i]];
        }
        return result;
      }
    }
    __name(decodeBuffer, "decodeBuffer");
    function readUInt64LE(buffer, offset) {
      var lower32 = buffer.readUInt32LE(offset);
      var upper32 = buffer.readUInt32LE(offset + 4);
      return upper32 * 4294967296 + lower32;
    }
    __name(readUInt64LE, "readUInt64LE");
    var newBuffer;
    if (typeof Buffer.allocUnsafe === "function") {
      newBuffer = /* @__PURE__ */ __name(function(len) {
        return Buffer.allocUnsafe(len);
      }, "newBuffer");
    } else {
      newBuffer = /* @__PURE__ */ __name(function(len) {
        return new Buffer(len);
      }, "newBuffer");
    }
    function defaultCallback(err) {
      if (err) throw err;
    }
    __name(defaultCallback, "defaultCallback");
  }
});

// node_modules/extract-zip/index.js
var require_extract_zip = __commonJS({
  "node_modules/extract-zip/index.js"(exports, module) {
    init_esm();
    var debug = require_src()("extract-zip");
    var { createWriteStream: createWriteStream2, promises: fs19 } = __require("fs");
    var getStream = require_get_stream2();
    var path28 = __require("path");
    var { promisify: promisify2 } = __require("util");
    var stream = __require("stream");
    var yauzl = require_yauzl();
    var openZip = promisify2(yauzl.open);
    var pipeline = promisify2(stream.pipeline);
    var Extractor = class {
      static {
        __name(this, "Extractor");
      }
      constructor(zipPath, opts) {
        this.zipPath = zipPath;
        this.opts = opts;
      }
      async extract() {
        debug("opening", this.zipPath, "with opts", this.opts);
        this.zipfile = await openZip(this.zipPath, { lazyEntries: true });
        this.canceled = false;
        return new Promise((resolve3, reject) => {
          this.zipfile.on("error", (err) => {
            this.canceled = true;
            reject(err);
          });
          this.zipfile.readEntry();
          this.zipfile.on("close", () => {
            if (!this.canceled) {
              debug("zip extraction complete");
              resolve3();
            }
          });
          this.zipfile.on("entry", async (entry) => {
            if (this.canceled) {
              debug("skipping entry", entry.fileName, { cancelled: this.canceled });
              return;
            }
            debug("zipfile entry", entry.fileName);
            if (entry.fileName.startsWith("__MACOSX/")) {
              this.zipfile.readEntry();
              return;
            }
            const destDir = path28.dirname(path28.join(this.opts.dir, entry.fileName));
            try {
              await fs19.mkdir(destDir, { recursive: true });
              const canonicalDestDir = await fs19.realpath(destDir);
              const relativeDestDir = path28.relative(this.opts.dir, canonicalDestDir);
              if (relativeDestDir.split(path28.sep).includes("..")) {
                throw new Error(`Out of bound path "${canonicalDestDir}" found while processing file ${entry.fileName}`);
              }
              await this.extractEntry(entry);
              debug("finished processing", entry.fileName);
              this.zipfile.readEntry();
            } catch (err) {
              this.canceled = true;
              this.zipfile.close();
              reject(err);
            }
          });
        });
      }
      async extractEntry(entry) {
        if (this.canceled) {
          debug("skipping entry extraction", entry.fileName, { cancelled: this.canceled });
          return;
        }
        if (this.opts.onEntry) {
          this.opts.onEntry(entry, this.zipfile);
        }
        const dest = path28.join(this.opts.dir, entry.fileName);
        const mode = entry.externalFileAttributes >> 16 & 65535;
        const IFMT = 61440;
        const IFDIR = 16384;
        const IFLNK = 40960;
        const symlink = (mode & IFMT) === IFLNK;
        let isDir = (mode & IFMT) === IFDIR;
        if (!isDir && entry.fileName.endsWith("/")) {
          isDir = true;
        }
        const madeBy = entry.versionMadeBy >> 8;
        if (!isDir) isDir = madeBy === 0 && entry.externalFileAttributes === 16;
        debug("extracting entry", { filename: entry.fileName, isDir, isSymlink: symlink });
        const procMode = this.getExtractedMode(mode, isDir) & 511;
        const destDir = isDir ? dest : path28.dirname(dest);
        const mkdirOptions = { recursive: true };
        if (isDir) {
          mkdirOptions.mode = procMode;
        }
        debug("mkdir", { dir: destDir, ...mkdirOptions });
        await fs19.mkdir(destDir, mkdirOptions);
        if (isDir) return;
        debug("opening read stream", dest);
        const readStream = await promisify2(this.zipfile.openReadStream.bind(this.zipfile))(entry);
        if (symlink) {
          const link = await getStream(readStream);
          debug("creating symlink", link, dest);
          await fs19.symlink(link, dest);
        } else {
          await pipeline(readStream, createWriteStream2(dest, { mode: procMode }));
        }
      }
      getExtractedMode(entryMode, isDir) {
        let mode = entryMode;
        if (mode === 0) {
          if (isDir) {
            if (this.opts.defaultDirMode) {
              mode = parseInt(this.opts.defaultDirMode, 10);
            }
            if (!mode) {
              mode = 493;
            }
          } else {
            if (this.opts.defaultFileMode) {
              mode = parseInt(this.opts.defaultFileMode, 10);
            }
            if (!mode) {
              mode = 420;
            }
          }
        }
        return mode;
      }
    };
    module.exports = async function(zipPath, opts) {
      debug("creating target directory", opts.dir);
      if (!path28.isAbsolute(opts.dir)) {
        throw new Error("Target directory is expected to be absolute");
      }
      await fs19.mkdir(opts.dir, { recursive: true });
      opts.dir = await fs19.realpath(opts.dir);
      return new Extractor(zipPath, opts).extract();
    };
  }
});

// node_modules/@remotion/renderer/dist/esm/index.mjs
init_esm();
var import_execa = __toESM(require_execa(), 1);
init_version();
init_no_react();
init_no_react();
import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import * as tty from "tty";
import { execSync } from "node:child_process";
import fs3, { rmSync } from "node:fs";
import os from "node:os";
import path3 from "node:path";
import fs2 from "node:fs";
import path2 from "node:path";
import https from "https";
import http from "node:http";
import * as childProcess from "node:child_process";
import { join } from "node:path";
import fs4, { existsSync } from "node:fs";
import { promises as dns } from "node:dns";
import { URL as URL2 } from "node:url";

// node_modules/@remotion/renderer/node_modules/ws/wrapper.mjs
init_esm();
var import_stream = __toESM(require_stream2(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);
var wrapper_default = import_websocket.default;

// node_modules/@remotion/renderer/dist/esm/index.mjs
var import_execa2 = __toESM(require_execa(), 1);
init_no_react();
var import_source_map = __toESM(require_source_map(), 1);
init_no_react();
init_no_react();
init_no_react();
var import_extract_zip = __toESM(require_extract_zip(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
init_no_react();
init_no_react();
init_version();
import { spawn as spawn2 } from "node:child_process";
import path5 from "path";
import path4 from "path";
import { accessSync, chmodSync, constants, statSync } from "node:fs";
import os2 from "node:os";
import { readFileSync } from "fs";
import path6 from "path";
import fs10 from "node:fs";
import os6 from "node:os";
import path9 from "node:path";
import fs8 from "fs";
import * as fs7 from "node:fs";
import * as os4 from "node:os";
import * as path8 from "node:path";
import { promisify } from "node:util";
import * as fs5 from "node:fs";
import * as os3 from "node:os";
import fs6 from "node:fs";
import path7 from "node:path";
import fs9 from "node:fs";
import { execSync as execSync2 } from "node:child_process";
import os5 from "node:os";
import { freemem } from "node:os";
import { readFileSync as readFileSync4 } from "node:fs";
import { existsSync as existsSync3, readFileSync as readFileSync5 } from "node:fs";
import { existsSync as existsSync4 } from "node:fs";
import path19 from "node:path";
import fs11 from "node:fs";
import path11, { extname as extname2 } from "node:path";
import { extname } from "node:path";
import path10 from "node:path";
import { mkdirSync as mkdirSync2 } from "node:fs";
import path15 from "node:path";
import { URLSearchParams } from "node:url";
import { spawn as spawn3 } from "node:child_process";
import path12 from "node:path";

// node_modules/@remotion/streaming/dist/esm/index.mjs
init_esm();
var streamingKey = "remotion_buffer:";
var makeStreamer = /* @__PURE__ */ __name((onMessage) => {
  const separator = new Uint8Array(streamingKey.length);
  for (let i = 0; i < streamingKey.length; i++) {
    separator[i] = streamingKey.charCodeAt(i);
  }
  let unprocessedBuffers = [];
  let outputBuffer = new Uint8Array(0);
  let missingData = null;
  const findSeparatorIndex = /* @__PURE__ */ __name(() => {
    let searchIndex = 0;
    while (true) {
      const separatorIndex = outputBuffer.indexOf(separator[0], searchIndex);
      if (separatorIndex === -1) {
        return -1;
      }
      if (outputBuffer.subarray(separatorIndex, separatorIndex + separator.length).toString() !== separator.toString()) {
        searchIndex = separatorIndex + 1;
        continue;
      }
      return separatorIndex;
    }
  }, "findSeparatorIndex");
  const processInput = /* @__PURE__ */ __name(() => {
    let separatorIndex = findSeparatorIndex();
    if (separatorIndex === -1) {
      return;
    }
    separatorIndex += separator.length;
    let nonceString = "";
    let lengthString = "";
    let statusString = "";
    while (true) {
      if (separatorIndex > outputBuffer.length - 1) {
        return;
      }
      const nextDigit = outputBuffer[separatorIndex];
      separatorIndex++;
      if (nextDigit === 58) {
        break;
      }
      nonceString += String.fromCharCode(nextDigit);
    }
    while (true) {
      if (separatorIndex > outputBuffer.length - 1) {
        return;
      }
      const nextDigit = outputBuffer[separatorIndex];
      separatorIndex++;
      if (nextDigit === 58) {
        break;
      }
      lengthString += String.fromCharCode(nextDigit);
    }
    while (true) {
      if (separatorIndex > outputBuffer.length - 1) {
        return;
      }
      const nextDigit = outputBuffer[separatorIndex];
      if (nextDigit === 58) {
        break;
      }
      separatorIndex++;
      statusString += String.fromCharCode(nextDigit);
    }
    const length = Number(lengthString);
    const status = Number(statusString);
    const dataLength = outputBuffer.length - separatorIndex - 1;
    if (dataLength < length) {
      missingData = {
        dataMissing: length - dataLength
      };
      return;
    }
    const data = outputBuffer.subarray(separatorIndex + 1, separatorIndex + 1 + Number(lengthString));
    onMessage(status === 1 ? "error" : "success", nonceString, data);
    missingData = null;
    outputBuffer = outputBuffer.subarray(separatorIndex + Number(lengthString) + 1);
    processInput();
  }, "processInput");
  const onData = /* @__PURE__ */ __name((data) => {
    unprocessedBuffers.push(data);
    if (missingData) {
      missingData.dataMissing -= data.length;
    }
    if (missingData && missingData.dataMissing > 0) {
      return;
    }
    const newBuffer = new Uint8Array(outputBuffer.length + unprocessedBuffers.reduce((acc, val) => acc + val.length, 0));
    newBuffer.set(outputBuffer, 0);
    let offset = outputBuffer.length;
    for (const buf of unprocessedBuffers) {
      newBuffer.set(buf, offset);
      offset += buf.length;
    }
    outputBuffer = newBuffer;
    unprocessedBuffers = [];
    processInput();
  }, "onData");
  return {
    onData,
    getOutputBuffer: /* @__PURE__ */ __name(() => outputBuffer, "getOutputBuffer"),
    clear: /* @__PURE__ */ __name(() => {
      unprocessedBuffers = [];
      outputBuffer = new Uint8Array(0);
    }, "clear")
  };
}, "makeStreamer");

// node_modules/@remotion/renderer/dist/esm/index.mjs
var import_jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
init_no_react();
init_version();
init_no_react();
init_version();
init_no_react();
init_no_react();
init_no_react();
import fs12, { mkdirSync } from "node:fs";
import os7 from "node:os";
import path13 from "node:path";
import fs13, { writeSync } from "node:fs";
import path14 from "node:path";
import path16 from "path";
import http2 from "node:http";
import net from "net";
import os8 from "os";
import { createReadStream, promises as promises2 } from "node:fs";
import path18 from "node:path";
import path17 from "node:path";
import fs15 from "node:fs";
import path21 from "node:path";
import { rmSync as rmSync3, writeFileSync as writeFileSync2 } from "fs";
import { join as join3 } from "path";
import path20 from "path";
import * as assert2 from "node:assert";
import fs14 from "node:fs";
import fs17 from "node:fs";
import os9 from "node:os";
import path26 from "node:path";

// node_modules/@remotion/licensing/dist/esm/index.mjs
init_esm();
function isNetworkError(error) {
  if (error.message.includes("Failed to fetch") || error.message.includes("Load failed") || error.message.includes("NetworkError when attempting to fetch resource")) {
    return true;
  }
  return false;
}
__name(isNetworkError, "isNetworkError");
var HOST = "https://www.remotion.pro";
var DEFAULT_MAX_RETRIES = 3;
var exponentialBackoffMs = /* @__PURE__ */ __name((attempt) => {
  return 1e3 * 2 ** (attempt - 1);
}, "exponentialBackoffMs");
var sleep = /* @__PURE__ */ __name((ms) => {
  return new Promise((resolve3) => {
    setTimeout(resolve3, ms);
  });
}, "sleep");
var internalRegisterUsageEvent = /* @__PURE__ */ __name(async ({
  host,
  succeeded,
  event,
  isStill,
  isProduction,
  licenseKey
}) => {
  let lastError;
  const totalAttempts = DEFAULT_MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, 1e4);
    try {
      const res = await fetch(`${HOST}/api/track/register-usage-point`, {
        method: "POST",
        body: JSON.stringify({
          event,
          apiKey: licenseKey,
          host,
          succeeded,
          isStill,
          isProduction
        }),
        headers: {
          "Content-Type": "application/json"
        },
        signal: abortController.signal
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (json.success) {
        return {
          billable: json.billable,
          classification: json.classification
        };
      }
      if (!res.ok) {
        throw new Error(json.error);
      }
      throw new Error(`Unexpected response from server: ${JSON.stringify(json)}`);
    } catch (err) {
      clearTimeout(timeout);
      const error = err;
      const isTimeout = error.name === "AbortError";
      const isRetryable = isNetworkError(error) || isTimeout;
      if (!isRetryable) {
        throw err;
      }
      lastError = isTimeout ? new Error("Request timed out after 10 seconds") : error;
      if (attempt < totalAttempts) {
        const backoffMs = exponentialBackoffMs(attempt);
        console.log(`Failed to send usage event (attempt ${attempt}/${totalAttempts}), retrying in ${backoffMs}ms...`, err);
        await sleep(backoffMs);
      }
    }
  }
  throw lastError;
}, "internalRegisterUsageEvent");
var LicensingInternals = {
  internalRegisterUsageEvent
};

// node_modules/@remotion/renderer/dist/esm/index.mjs
init_no_react();
init_no_react();
var import_jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
var import_jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
init_no_react();
init_version();
import { cpSync as cpSync2, promises as promises3, rmSync as rmSync4 } from "node:fs";
import path25 from "node:path";
import path24 from "path";
import url from "node:url";
import { cpSync } from "node:fs";
import path23 from "node:path";
import fs16, { existsSync as existsSync5 } from "node:fs";
import path22 from "node:path";
import fs18, { statSync as statSync2 } from "node:fs";
import path27 from "node:path";
init_no_react();
init_no_react();
init_version();
import { rmSync as rmSync6 } from "node:fs";
import { join as join5 } from "node:path";
import { rmSync as rmSync5, writeFileSync as writeFileSync3 } from "fs";
import { join as join4 } from "path";
import { resolve as resolve2 } from "node:path";
var __defProp = Object.defineProperty;
var __export = /* @__PURE__ */ __name((target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: /* @__PURE__ */ __name((newValue) => all[name] = () => newValue, "set")
    });
}, "__export");
var __require2 = /* @__PURE__ */ createRequire(import.meta.url);
var ensureOutputDirectory = /* @__PURE__ */ __name((outputLocation) => {
  const dirName = path.dirname(outputLocation);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {
      recursive: true
    });
  }
}, "ensureOutputDirectory");
var isColorSupported = /* @__PURE__ */ __name(() => {
  const env = process.env || {};
  const isForceDisabled = "NO_COLOR" in env;
  if (isForceDisabled) {
    return false;
  }
  const isForced = "FORCE_COLOR" in env;
  if (isForced) {
    return true;
  }
  const isWindows = process.platform === "win32";
  const isCompatibleTerminal = tty?.isatty?.(1) && env.TERM && env.TERM !== "dumb";
  const isCI = "CI" in env && ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);
  return isWindows || isCompatibleTerminal || isCI;
}, "isColorSupported");
var chalk = (() => {
  const colors = {
    enabled: /* @__PURE__ */ __name(() => isColorSupported(), "enabled"),
    visible: true,
    styles: {},
    keys: {}
  };
  const ansi = /* @__PURE__ */ __name((st) => {
    const open = `\x1B[${st.codes[0]}m`;
    const close = `\x1B[${st.codes[1]}m`;
    const regex = new RegExp(`\\u001b\\[${st.codes[1]}m`, "g");
    st.wrap = (input, newline) => {
      if (input.includes(close))
        input = input.replace(regex, close + open);
      const output = open + input + close;
      return newline ? output.replace(/\r*\n/g, `${close}$&${open}`) : output;
    };
    return st;
  }, "ansi");
  const wrap = /* @__PURE__ */ __name((sty, input, newline) => {
    return sty.wrap?.(input, newline);
  }, "wrap");
  const style = /* @__PURE__ */ __name((input, stack) => {
    if (input === "" || input === null || input === void 0)
      return "";
    if (colors.enabled() === false)
      return input;
    if (colors.visible === false)
      return "";
    let str = String(input);
    const nl = str.includes(`
`);
    let n = stack.length;
    while (n-- > 0)
      str = wrap(colors.styles[stack[n]], str, nl);
    return str;
  }, "style");
  const define = /* @__PURE__ */ __name((name, codes, type) => {
    colors.styles[name] = ansi({ name, codes });
    const keys = colors.keys[type] || (colors.keys[type] = []);
    keys.push(name);
    Reflect.defineProperty(colors, name, {
      configurable: true,
      enumerable: true,
      set(value) {
        colors.alias?.(name, value);
      },
      get() {
        const color = /* @__PURE__ */ __name((input) => style(input, color.stack), "color");
        Reflect.setPrototypeOf(color, colors);
        color.stack = this.stack ? this.stack.concat(name) : [name];
        return color;
      }
    });
  }, "define");
  define("reset", [0, 0], "modifier");
  define("bold", [1, 22], "modifier");
  define("dim", [2, 22], "modifier");
  define("italic", [3, 23], "modifier");
  define("underline", [4, 24], "modifier");
  define("inverse", [7, 27], "modifier");
  define("hidden", [8, 28], "modifier");
  define("strikethrough", [9, 29], "modifier");
  define("black", [30, 39], "color");
  define("red", [31, 39], "color");
  define("green", [32, 39], "color");
  define("yellow", [33, 39], "color");
  define("blue", [34, 39], "color");
  define("magenta", [35, 39], "color");
  define("cyan", [36, 39], "color");
  define("white", [37, 39], "color");
  define("gray", [90, 39], "color");
  define("grey", [90, 39], "color");
  define("bgBlack", [40, 49], "bg");
  define("bgRed", [41, 49], "bg");
  define("bgGreen", [42, 49], "bg");
  define("bgYellow", [43, 49], "bg");
  define("bgBlue", [44, 49], "bg");
  define("bgMagenta", [45, 49], "bg");
  define("bgWhite", [47, 49], "bg");
  define("blackBright", [90, 39], "bright");
  define("redBright", [91, 39], "bright");
  define("greenBright", [92, 39], "bright");
  define("yellowBright", [93, 39], "bright");
  define("blueBright", [94, 39], "bright");
  define("magentaBright", [95, 39], "bright");
  define("whiteBright", [97, 39], "bright");
  define("bgBlackBright", [100, 49], "bgBright");
  define("bgRedBright", [101, 49], "bgBright");
  define("bgGreenBright", [102, 49], "bgBright");
  define("bgYellowBright", [103, 49], "bgBright");
  define("bgBlueBright", [104, 49], "bgBright");
  define("bgMagentaBright", [105, 49], "bgBright");
  define("bgWhiteBright", [107, 49], "bgBright");
  colors.alias = (name, color) => {
    const fn = colors[color];
    if (typeof fn !== "function") {
      throw new TypeError("Expected alias to be the name of an existing color (string) or a function");
    }
    if (!fn.stack) {
      Reflect.defineProperty(fn, "name", { value: name });
      colors.styles[name] = fn;
      fn.stack = [name];
    }
    Reflect.defineProperty(colors, name, {
      configurable: true,
      enumerable: true,
      set(value) {
        colors.alias?.(name, value);
      },
      get() {
        const col = /* @__PURE__ */ __name((input) => style(input, col.stack), "col");
        Reflect.setPrototypeOf(col, colors);
        col.stack = this.stack ? this.stack.concat(fn.stack) : fn.stack;
        return col;
      }
    });
  };
  return colors;
})();
var logLevels = ["trace", "verbose", "info", "warn", "error"];
var getNumberForLogLevel = /* @__PURE__ */ __name((level) => {
  return logLevels.indexOf(level);
}, "getNumberForLogLevel");
var isValidLogLevel = /* @__PURE__ */ __name((level) => {
  return getNumberForLogLevel(level) > -1;
}, "isValidLogLevel");
var isEqualOrBelowLogLevel = /* @__PURE__ */ __name((currentLevel, level) => {
  return getNumberForLogLevel(currentLevel) <= getNumberForLogLevel(level);
}, "isEqualOrBelowLogLevel");
var recursionLimit = 5;
var findClosestPackageJson = /* @__PURE__ */ __name(() => {
  let currentDir = process.cwd();
  let possiblePackageJson = "";
  for (let i = 0; i < recursionLimit; i++) {
    possiblePackageJson = path2.join(currentDir, "package.json");
    const exists = fs2.existsSync(possiblePackageJson);
    if (exists) {
      return possiblePackageJson;
    }
    currentDir = path2.dirname(currentDir);
  }
  return null;
}, "findClosestPackageJson");
var findRemotionRoot = /* @__PURE__ */ __name(() => {
  const closestPackageJson = findClosestPackageJson();
  if (closestPackageJson === null) {
    return process.cwd();
  }
  return path2.dirname(closestPackageJson);
}, "findRemotionRoot");
var isServeUrl = /* @__PURE__ */ __name((potentialUrl) => {
  if (typeof potentialUrl === "undefined") {
    throw new Error("serveUrl is undefined");
  }
  if (potentialUrl.startsWith("www.") || potentialUrl.includes("amazonaws.com")) {
    return true;
  }
  return potentialUrl.startsWith("https://") || potentialUrl.startsWith("http://");
}, "isServeUrl");
var REPRO_DIR = ".remotionrepro";
var LOG_FILE_NAME = "logs.txt";
var INPUT_DIR = "bundle";
var OUTPUT_DIR = "output";
var LINE_SPLIT = `
`;
var getZipFileName = /* @__PURE__ */ __name((name) => `remotion-repro-${name}-${Date.now()}.zip`, "getZipFileName");
var readyDirSync = /* @__PURE__ */ __name((dir) => {
  let items;
  try {
    items = fs3.readdirSync(dir);
  } catch {
    return fs3.mkdirSync(dir, { recursive: true });
  }
  items.forEach((item) => {
    item = path3.join(dir, item);
    fs3.rmSync(item, { recursive: true, force: true });
  });
}, "readyDirSync");
var zipFolder = /* @__PURE__ */ __name(({
  sourceFolder,
  targetZip,
  indent,
  logLevel
}) => {
  const platform3 = os.platform();
  try {
    Log.info({ indent, logLevel }, "+ Creating reproduction ZIP");
    if (platform3 === "win32") {
      execSync(`powershell.exe Compress-Archive -Path "${sourceFolder}" -DestinationPath "${targetZip}"`);
    } else {
      execSync(`zip -r "${targetZip}" "${sourceFolder}"`);
    }
    rmSync(sourceFolder, { recursive: true });
    Log.info({ indent, logLevel }, `${chalk.blue(`+ Repro: ${targetZip}`)}`);
  } catch (error) {
    Log.error({ indent, logLevel }, `Failed to zip repro folder, The repro folder is ${sourceFolder}. You can try manually zip it.`);
    Log.error({ indent, logLevel }, error);
  }
}, "zipFolder");
var reproWriter = /* @__PURE__ */ __name((name) => {
  const root = findRemotionRoot();
  const reproFolder = path3.join(root, REPRO_DIR);
  const logPath = path3.join(reproFolder, LOG_FILE_NAME);
  const zipFile = path3.join(root, getZipFileName(name));
  readyDirSync(reproFolder);
  const reproLogWriteStream = fs3.createWriteStream(logPath, { flags: "a" });
  const serializeArgs = /* @__PURE__ */ __name((args) => JSON.stringify(args), "serializeArgs");
  const writeLine = /* @__PURE__ */ __name((level, ...args) => {
    if (!args.length)
      return;
    const startTime = (/* @__PURE__ */ new Date()).toISOString();
    const line = `[${startTime}] ${level} ${serializeArgs(args)}`;
    reproLogWriteStream.write(line + LINE_SPLIT);
  }, "writeLine");
  const start = /* @__PURE__ */ __name(({
    serveUrl,
    serializedInputPropsWithCustomSchema,
    serializedResolvedPropsWithCustomSchema
  }) => {
    const isServe = isServeUrl(serveUrl);
    if (!isServe) {
      const inputDir = path3.resolve(reproFolder, INPUT_DIR);
      readyDirSync(inputDir);
      fs3.cpSync(serveUrl, inputDir, { recursive: true });
    }
    const serializedProps = path3.resolve(reproFolder, "input-props.json");
    fs3.writeFileSync(serializedProps, serializedInputPropsWithCustomSchema);
    const serializedResolvedProps = path3.resolve(reproFolder, "resolved-props.json");
    fs3.writeFileSync(serializedResolvedProps, serializedResolvedPropsWithCustomSchema);
    writeLine("info", [`Args: ${JSON.stringify(process.argv)}`]);
    writeLine("info", [`Node/Bun version: ${process.version}`]);
    writeLine("info", [`OS: ${process.platform}-${process.arch}`]);
    writeLine("info", [`Serve URL: ${serveUrl}`]);
    writeLine("info", [`Remotion version: ${VERSION}`]);
  }, "start");
  const onRenderSucceed = /* @__PURE__ */ __name(({
    indent,
    logLevel,
    output
  }) => {
    return new Promise((resolve3, reject) => {
      try {
        if (output) {
          const outputDir = path3.resolve(reproFolder, OUTPUT_DIR);
          readyDirSync(outputDir);
          const fileName = path3.basename(output);
          const targetPath = path3.join(outputDir, fileName);
          fs3.copyFileSync(output, targetPath);
        }
        disableRepro();
        reproLogWriteStream.end(() => {
          reproLogWriteStream.close(() => {
            zipFolder({
              sourceFolder: reproFolder,
              targetZip: zipFile,
              indent,
              logLevel
            });
            resolve3();
          });
        });
      } catch (error) {
        Log.error({ indent: false, logLevel }, `repro render success error:`);
        Log.error({ indent: false, logLevel }, error);
        reject(error);
      }
    });
  }, "onRenderSucceed");
  return {
    start,
    writeLine,
    onRenderSucceed
  };
}, "reproWriter");
var reproWriteInstance = null;
var getReproWriter = /* @__PURE__ */ __name(() => {
  if (!reproWriteInstance) {
    throw new Error("reproWriteInstance is not initialized");
  }
  return reproWriteInstance;
}, "getReproWriter");
var writeInRepro = /* @__PURE__ */ __name((level, ...args) => {
  if (isReproEnabled()) {
    getReproWriter().writeLine(level, ...args);
  }
}, "writeInRepro");
var shouldRepro = false;
var enableRepro = /* @__PURE__ */ __name(({
  serveUrl,
  compositionName,
  serializedInputPropsWithCustomSchema,
  serializedResolvedPropsWithCustomSchema
}) => {
  shouldRepro = true;
  reproWriteInstance = reproWriter(compositionName);
  getReproWriter().start({
    serveUrl,
    serializedInputPropsWithCustomSchema,
    serializedResolvedPropsWithCustomSchema
  });
}, "enableRepro");
var disableRepro = /* @__PURE__ */ __name(() => {
  shouldRepro = false;
}, "disableRepro");
var isReproEnabled = /* @__PURE__ */ __name(() => shouldRepro, "isReproEnabled");
function truthy(value) {
  return Boolean(value);
}
__name(truthy, "truthy");
var INDENT_TOKEN = chalk.gray("│");
var verboseTag = /* @__PURE__ */ __name((str) => {
  return isColorSupported() ? chalk.bgBlack(` ${str} `) : `[${str}]`;
}, "verboseTag");
var Log = {
  formatLogs: /* @__PURE__ */ __name((logLevel, options, args) => {
    return [
      options.indent ? INDENT_TOKEN : null,
      options.tag ? verboseTag(options.tag) : null
    ].filter(truthy).concat(args.map((a) => {
      if (logLevel === "warn") {
        return chalk.yellow(a);
      }
      if (logLevel === "error") {
        return chalk.red(a);
      }
      if (logLevel === "verbose" || logLevel === "trace") {
        return chalk.gray(a);
      }
      return a;
    }));
  }, "formatLogs"),
  trace: /* @__PURE__ */ __name((options, ...args) => {
    writeInRepro("trace", ...args);
    if (isEqualOrBelowLogLevel(options.logLevel, "trace")) {
      if (args.length === 0) {
        return process.stdout.write(`
`);
      }
      return console.log(...Log.formatLogs("trace", options, args));
    }
  }, "trace"),
  verbose: /* @__PURE__ */ __name((options, ...args) => {
    writeInRepro("verbose", ...args);
    if (isEqualOrBelowLogLevel(options.logLevel, "verbose")) {
      if (args.length === 0) {
        return process.stdout.write(`
`);
      }
      return console.log(...Log.formatLogs("verbose", options, args));
    }
  }, "verbose"),
  info: /* @__PURE__ */ __name((options, ...args) => {
    writeInRepro("info", ...args);
    if (isEqualOrBelowLogLevel(options.logLevel, "info")) {
      if (args.length === 0) {
        return process.stdout.write(`
`);
      }
      return console.log(...Log.formatLogs("info", options, args));
    }
  }, "info"),
  warn: /* @__PURE__ */ __name((options, ...args) => {
    writeInRepro("warn", ...args);
    if (isEqualOrBelowLogLevel(options.logLevel, "warn")) {
      if (args.length === 0) {
        return process.stdout.write(`
`);
      }
      return console.warn(...Log.formatLogs("warn", options, args));
    }
  }, "warn"),
  error: /* @__PURE__ */ __name((options, ...args) => {
    writeInRepro("error", ...args);
    if (isEqualOrBelowLogLevel(options.logLevel, "error")) {
      if (args.length === 0) {
        return process.stdout.write(`
`);
      }
      return console.error(...Log.formatLogs("error", options, args));
    }
  }, "error")
};
var redirectStatusCodes = [301, 302, 303, 307, 308];
var getClient = /* @__PURE__ */ __name((url2) => {
  if (url2.startsWith("https://")) {
    return https.get;
  }
  if (url2.startsWith("http://")) {
    return http.get;
  }
  throw new Error(`Can only download URLs starting with http:// or https://, got "${url2}"`);
}, "getClient");
var readFileWithoutRedirect = /* @__PURE__ */ __name((url2) => {
  return new Promise((resolve3, reject) => {
    const client = getClient(url2);
    const req = client(url2, typeof Bun === "undefined" ? {
      headers: {
        "user-agent": "Mozilla/5.0 (@remotion/renderer - https://remotion.dev)"
      }
    } : {}, (res) => {
      resolve3({ request: req, response: res });
    });
    req.on("error", (err) => {
      req.destroy();
      return reject(err);
    });
  });
}, "readFileWithoutRedirect");
var readFile = /* @__PURE__ */ __name(async (url2, redirectsSoFar = 0) => {
  if (redirectsSoFar > 10) {
    throw new Error(`Too many redirects while downloading ${url2}`);
  }
  const { request, response } = await readFileWithoutRedirect(url2);
  if (redirectStatusCodes.includes(response.statusCode)) {
    if (!response.headers.location) {
      throw new Error(`Received a status code ${response.statusCode} but no "Location" header while calling ${response.headers.location}`);
    }
    const { origin } = new URL(url2);
    const redirectUrl = new URL(response.headers.location, origin).toString();
    request.destroy();
    response.destroy();
    return readFile(redirectUrl, redirectsSoFar + 1);
  }
  if (response.statusCode >= 400) {
    const body = await tryToObtainBody(response);
    request.destroy();
    response.destroy();
    throw new Error([
      `Received a status code of ${response.statusCode} while downloading file ${url2}.`,
      body ? `The response body was:` : null,
      body ? `---` : null,
      body ? body : null,
      body ? `---` : null
    ].filter(truthy).join(`
`));
  }
  return { request, response };
}, "readFile");
var tryToObtainBody = /* @__PURE__ */ __name(async (file) => {
  const success = new Promise((resolve3) => {
    let data = "";
    file.on("data", (chunk3) => {
      data += chunk3;
    });
    file.on("end", () => {
      resolve3(data);
    });
    file.on("error", () => resolve3(data));
  });
  let timeout = null;
  const body = await Promise.race([
    success,
    new Promise((resolve3) => {
      timeout = setTimeout(() => {
        resolve3(null);
      }, 5e3);
    })
  ]);
  if (timeout) {
    clearTimeout(timeout);
  }
  return body;
}, "tryToObtainBody");
var CANCELLED_ERROR = "cancelled";
var incorrectContentLengthToken = "Download finished with";
var noDataSentToken = "but the server sent no data for";
var downloadFileWithoutRetries = /* @__PURE__ */ __name(({
  onProgress,
  url: url2,
  to: toFn,
  abortSignal
}) => {
  return new Promise((resolve3, reject) => {
    let rejected = false;
    let resolved = false;
    let timeout;
    const resolveAndFlag = /* @__PURE__ */ __name((val) => {
      abortSignal.removeEventListener("abort", onAbort);
      resolved = true;
      resolve3(val);
      if (timeout) {
        clearTimeout(timeout);
      }
    }, "resolveAndFlag");
    const rejectAndFlag = /* @__PURE__ */ __name((err) => {
      abortSignal.removeEventListener("abort", onAbort);
      if (timeout) {
        clearTimeout(timeout);
      }
      reject(err);
      rejected = true;
    }, "rejectAndFlag");
    const refreshTimeout = /* @__PURE__ */ __name(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        if (resolved) {
          return;
        }
        rejectAndFlag(new Error(`Tried to download file ${url2}, ${noDataSentToken} 20 seconds`));
      }, 2e4);
    }, "refreshTimeout");
    refreshTimeout();
    let finishEventSent = false;
    let closeConnection = /* @__PURE__ */ __name(() => {
      return;
    }, "closeConnection");
    const onAbort = /* @__PURE__ */ __name(() => {
      rejectAndFlag(new Error(CANCELLED_ERROR));
      closeConnection();
    }, "onAbort");
    abortSignal.addEventListener("abort", onAbort);
    readFile(url2).then(({ response, request }) => {
      closeConnection = /* @__PURE__ */ __name(() => {
        request.destroy();
        response.destroy();
      }, "closeConnection");
      if (abortSignal.aborted) {
        onAbort();
        return;
      }
      const contentDisposition = response.headers["content-disposition"] ?? null;
      const contentType = response.headers["content-type"] ?? null;
      const to = toFn(contentDisposition, contentType);
      ensureOutputDirectory(to);
      const sizeHeader = response.headers["content-length"];
      const totalSize = typeof sizeHeader === "undefined" ? null : Number(sizeHeader);
      const writeStream = createWriteStream(to);
      let downloaded = 0;
      writeStream.on("close", () => {
        if (rejected) {
          return;
        }
        if (!finishEventSent) {
          onProgress?.({
            downloaded,
            percent: 1,
            totalSize: downloaded
          });
        }
        refreshTimeout();
        return resolveAndFlag({ sizeInBytes: downloaded, to });
      });
      writeStream.on("error", (err) => rejectAndFlag(err));
      response.on("error", (err) => {
        closeConnection();
        rejectAndFlag(err);
      });
      response.pipe(writeStream).on("error", (err) => rejectAndFlag(err));
      response.on("data", (d) => {
        refreshTimeout();
        downloaded += d.length;
        refreshTimeout();
        const percent = totalSize === null ? null : downloaded / totalSize;
        onProgress?.({
          downloaded,
          percent,
          totalSize
        });
        if (percent === 1) {
          finishEventSent = true;
        }
      });
      response.on("close", () => {
        if (totalSize !== null && downloaded !== totalSize) {
          rejectAndFlag(new Error(`${incorrectContentLengthToken} ${downloaded} bytes, but expected ${totalSize} bytes from 'Content-Length'.`));
        }
        writeStream.close();
        closeConnection();
      });
    }).catch((err) => {
      rejectAndFlag(err);
    });
  });
}, "downloadFileWithoutRetries");
var downloadFile = /* @__PURE__ */ __name(async (options, retries = 2, attempt = 1) => {
  try {
    const res = await downloadFileWithoutRetries(options);
    return res;
  } catch (err) {
    const { message } = err;
    if (message === CANCELLED_ERROR) {
      throw err;
    }
    if (message === "aborted" || message.includes("ECONNRESET") || message.includes(incorrectContentLengthToken) || message.includes(noDataSentToken) || message.includes("503") || message.includes("502") || message.includes("504") || message.includes("500")) {
      if (retries === 0) {
        throw err;
      }
      Log.warn({ indent: options.indent, logLevel: options.logLevel }, `Downloading ${options.url} failed (will retry): ${message}`);
      const backoffInSeconds = (attempt + 1) ** 2;
      await new Promise((resolve3) => {
        setTimeout(() => resolve3(), backoffInSeconds * 1e3);
      });
      return downloadFile(options, retries - 1, attempt + 1);
    }
    throw err;
  }
}, "downloadFile");
var DEFAULT_BROWSER = "chrome";
var assert = /* @__PURE__ */ __name((value, message) => {
  if (!value) {
    throw new Error(message);
  }
}, "assert");
var formatRemoteObject = /* @__PURE__ */ __name((remoteObject) => {
  if (remoteObject.preview) {
    return formatObjectPreview(remoteObject.preview);
  }
  if (remoteObject.type === "string") {
    const isDelayRenderClear = remoteObject.value.includes(NoReactInternals.DELAY_RENDER_CLEAR_TOKEN);
    if (isDelayRenderClear) {
      return chalk.gray(`${remoteObject.value}`);
    }
    return `${remoteObject.value}`;
  }
  if (remoteObject.type === "number") {
    return chalk.yellow(`${remoteObject.value}`);
  }
  if (remoteObject.type === "bigint") {
    return chalk.yellow(`${remoteObject.description}`);
  }
  if (remoteObject.type === "boolean") {
    return chalk.yellow(`${remoteObject.value}`);
  }
  if (remoteObject.type === "function") {
    return chalk.cyan(String(remoteObject.description));
  }
  if (remoteObject.type === "object") {
    if (remoteObject.subtype === "null") {
      return `null`;
    }
    return chalk.reset(`Object`);
  }
  if (remoteObject.type === "symbol") {
    return chalk.green(`${remoteObject.description}`);
  }
  if (remoteObject.type === "undefined") {
    return chalk.gray(`undefined`);
  }
  throw new Error("unhandled remote object");
}, "formatRemoteObject");
var formatObjectPreview = /* @__PURE__ */ __name((preview) => {
  if (typeof preview === "undefined") {
    return "";
  }
  if (preview.type === "object") {
    if (preview.subtype === "date") {
      return chalk.reset(`Date { ${chalk.magenta(String(preview.description))} }`);
    }
    const properties = preview.properties.map((property) => {
      return chalk.reset(`${property.name}: ${formatProperty(property)}`);
    });
    if (preview.subtype === "array") {
      if (preview.overflow) {
        return chalk.reset(`[ ${preview.properties.map((p) => formatProperty(p)).join(", ")}, …]`);
      }
      return chalk.reset(`[ ${preview.properties.map((p) => formatProperty(p)).join(", ")} ]`);
    }
    if (preview.subtype === "arraybuffer") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "dataview") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "generator") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "iterator") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "map") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "node") {
      return chalk.magenta(`<${preview.description}>`);
    }
    if (preview.subtype === "null") {
      return chalk.white(String(preview.description));
    }
    if (preview.subtype === "promise") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "proxy") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "regexp") {
      return chalk.red(String(preview.description));
    }
    if (preview.subtype === "set") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "typedarray") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "error") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "wasmvalue") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "weakmap") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "weakset") {
      return chalk.reset(String(preview.description));
    }
    if (preview.subtype === "webassemblymemory") {
      return chalk.reset(String(preview.description));
    }
    if (properties.length === 0) {
      return chalk.reset("{}");
    }
    if (preview.overflow) {
      return chalk.reset(`{ ${properties.join(", ")}, …}`);
    }
    return chalk.reset(`{ ${properties.join(", ")} }`);
  }
  return "";
}, "formatObjectPreview");
var formatProperty = /* @__PURE__ */ __name((property) => {
  if (property.type === "string") {
    return chalk.green(`"${property.value}"`);
  }
  if (property.type === "object") {
    if (!property.subtype && property.value === "Object") {
      return chalk.reset(`{…}`);
    }
    if (property.subtype === "date") {
      return chalk.reset(`Date { ${chalk.magenta(String(property.value))} }`);
    }
    if (property.subtype === "arraybuffer") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "array") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "dataview") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "error") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "generator") {
      return chalk.reset(`[generator ${property.value}]`);
    }
    if (property.subtype === "iterator") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "map") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "node") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "null") {
      return chalk.white(`${property.value}`);
    }
    if (property.subtype === "promise") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "proxy") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "regexp") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "set") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "typedarray") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "wasmvalue") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "webassemblymemory") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "weakmap") {
      return chalk.reset(`${property.value}`);
    }
    if (property.subtype === "weakset") {
      return chalk.reset(`${property.value}`);
    }
    return chalk.reset(`${property.value}`);
  }
  if (property.type === "accessor") {
    return chalk.gray(`get()`);
  }
  if (property.type === "bigint") {
    return chalk.yellow(`${property.value}`);
  }
  if (property.type === "boolean") {
    return chalk.yellow(`${property.value}`);
  }
  if (property.type === "function") {
    return chalk.cyan(`Function`);
  }
  if (property.type === "number") {
    return chalk.yellow(`${property.value}`);
  }
  if (property.type === "symbol") {
    return chalk.green(`${property.value}`);
  }
  if (property.type === "undefined") {
    return chalk.gray(`undefined`);
  }
  throw new Error("unexpected property type " + JSON.stringify(property));
}, "formatProperty");
var ConsoleMessage = class {
  static {
    __name(this, "ConsoleMessage");
  }
  type;
  text;
  args;
  previewString;
  #stackTraceLocations;
  logLevel;
  tag;
  constructor({
    type,
    text,
    args,
    stackTraceLocations,
    previewString,
    logLevel,
    tag
  }) {
    this.type = type;
    this.text = text;
    this.args = args;
    this.previewString = previewString;
    this.#stackTraceLocations = stackTraceLocations;
    this.logLevel = logLevel;
    this.tag = tag;
  }
  stackTrace() {
    return this.#stackTraceLocations;
  }
};
function mitt(all) {
  all = all || /* @__PURE__ */ new Map();
  return {
    all,
    on: /* @__PURE__ */ __name((type, handler) => {
      const handlers = all?.get(type);
      const added = handlers?.push(handler);
      if (!added) {
        all?.set(type, [handler]);
      }
    }, "on"),
    off: /* @__PURE__ */ __name((type, handler) => {
      const handlers = all?.get(type);
      if (handlers) {
        handlers.splice(handlers.indexOf(handler) >>> 0, 1);
      }
    }, "off"),
    emit: /* @__PURE__ */ __name((type, evt) => {
      (all?.get(type) || []).slice().forEach((handler) => {
        handler(evt);
      });
      (all?.get("*") || []).slice().forEach((handler) => {
        handler(type, evt);
      });
    }, "emit")
  };
}
__name(mitt, "mitt");
var EventEmitter = class {
  static {
    __name(this, "EventEmitter");
  }
  emitter;
  eventsMap = /* @__PURE__ */ new Map();
  constructor() {
    this.emitter = mitt(this.eventsMap);
  }
  on(event, handler) {
    this.emitter.on(event, handler);
    return this;
  }
  off(event, handler) {
    this.emitter.off(event, handler);
    return this;
  }
  addListener(event, handler) {
    this.on(event, handler);
    return this;
  }
  emit(event, eventData) {
    this.emitter.emit(event, eventData);
    return this.eventListenersCount(event) > 0;
  }
  once(event, handler) {
    const onceHandler = /* @__PURE__ */ __name((eventData) => {
      handler(eventData);
      this.off(event, onceHandler);
    }, "onceHandler");
    return this.on(event, onceHandler);
  }
  listenerCount(event) {
    return this.eventListenersCount(event);
  }
  removeAllListeners(event) {
    if (event) {
      this.eventsMap.delete(event);
    } else {
      this.eventsMap.clear();
    }
    return this;
  }
  eventListenersCount(event) {
    return this.eventsMap.get(event)?.length || 0;
  }
};
var CustomError = class extends Error {
  static {
    __name(this, "CustomError");
  }
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
};
var TimeoutError = class extends CustomError {
  static {
    __name(this, "TimeoutError");
  }
};
var ProtocolError = class extends CustomError {
  static {
    __name(this, "ProtocolError");
  }
  code;
  originalMessage = "";
};
var ConnectionEmittedEvents = {
  Disconnected: Symbol("Connection.Disconnected")
};
var Connection = class extends EventEmitter {
  static {
    __name(this, "Connection");
  }
  transport;
  #lastId = 0;
  #sessions = /* @__PURE__ */ new Map();
  #closed = false;
  #callbacks = /* @__PURE__ */ new Map();
  constructor(transport) {
    super();
    this.transport = transport;
    this.transport.onmessage = this.#onMessage.bind(this);
    this.transport.onclose = this.#onClose.bind(this);
  }
  static fromSession(session) {
    return session.connection();
  }
  session(sessionId) {
    return this.#sessions.get(sessionId) || null;
  }
  send(method, ...paramArgs) {
    const params = paramArgs.length ? paramArgs[0] : void 0;
    const id = this._rawSend({ method, params });
    return new Promise((resolve3, reject) => {
      this.#callbacks.set(id, {
        resolve: resolve3,
        reject,
        method,
        returnSize: true,
        stack: new Error().stack ?? "",
        fn: method + JSON.stringify(params)
      });
    });
  }
  _rawSend(message) {
    const id = ++this.#lastId;
    const stringifiedMessage = JSON.stringify({ ...message, id });
    this.transport.send(stringifiedMessage);
    return id;
  }
  #onMessage(message) {
    const object = JSON.parse(message);
    if (object.method === "Target.attachedToTarget") {
      const { sessionId } = object.params;
      const session = new CDPSession(this, object.params.targetInfo.type, sessionId);
      this.#sessions.set(sessionId, session);
      this.emit("sessionattached", session);
      const parentSession = this.#sessions.get(object.sessionId);
      if (parentSession) {
        parentSession.emit("sessionattached", session);
      }
    } else if (object.method === "Target.detachedFromTarget") {
      const session = this.#sessions.get(object.params.sessionId);
      if (session) {
        session._onClosed();
        this.#sessions.delete(object.params.sessionId);
        this.emit("sessiondetached", session);
        const parentSession = this.#sessions.get(object.sessionId);
        if (parentSession) {
          parentSession.emit("sessiondetached", session);
        }
      }
    }
    if (object.sessionId) {
      const session = this.#sessions.get(object.sessionId);
      if (session) {
        session._onMessage(object, message.length);
      }
    } else if (object.id) {
      const callback = this.#callbacks.get(object.id);
      if (callback) {
        this.#callbacks.delete(object.id);
        if (object.error) {
          callback.reject(createProtocolError(callback.method, object));
        } else if (callback.returnSize) {
          callback.resolve({ value: object.result, size: message.length });
        } else {
          callback.resolve(object.result);
        }
      }
    } else {
      this.emit(object.method, object.params);
    }
  }
  #onClose() {
    if (this.#closed) {
      return;
    }
    this.transport.onmessage = void 0;
    this.transport.onclose = void 0;
    for (const callback of this.#callbacks.values()) {
      callback.reject(rewriteError(new ProtocolError(), `Protocol error (${callback.method}): Target closed. https://www.remotion.dev/docs/target-closed`));
    }
    this.#callbacks.clear();
    for (const session of this.#sessions.values()) {
      session._onClosed();
    }
    this.#sessions.clear();
    this.emit(ConnectionEmittedEvents.Disconnected);
  }
  dispose() {
    this.#onClose();
    this.transport.close();
  }
  async createSession(targetInfo) {
    const {
      value: { sessionId }
    } = await this.send("Target.attachToTarget", {
      targetId: targetInfo.targetId,
      flatten: true
    });
    const session = this.#sessions.get(sessionId);
    if (!session) {
      throw new Error("CDPSession creation failed.");
    }
    return session;
  }
};
var CDPSessionEmittedEvents = {
  Disconnected: Symbol("CDPSession.Disconnected")
};
var CDPSession = class extends EventEmitter {
  static {
    __name(this, "CDPSession");
  }
  #sessionId;
  #targetType;
  #callbacks = /* @__PURE__ */ new Map();
  #connection;
  constructor(connection, targetType, sessionId) {
    super();
    this.#connection = connection;
    this.#targetType = targetType;
    this.#sessionId = sessionId;
  }
  connection() {
    return this.#connection;
  }
  send(method, ...paramArgs) {
    if (!this.#connection) {
      return Promise.reject(new Error(`Protocol error (${method}): Session closed. Most likely the ${this.#targetType} has been closed.`));
    }
    const params = paramArgs.length ? paramArgs[0] : void 0;
    const id = this.#connection._rawSend({
      sessionId: this.#sessionId,
      method,
      params
    });
    return new Promise((resolve3, reject) => {
      if (this.#callbacks.size > 100) {
        for (const callback of this.#callbacks.values()) {
          Log.info({ indent: false, logLevel: "info" }, callback.fn);
        }
        throw new Error("Leak detected: Too many callbacks");
      }
      this.#callbacks.set(id, {
        resolve: resolve3,
        reject,
        method,
        returnSize: true,
        stack: new Error().stack ?? "",
        fn: method + JSON.stringify(params)
      });
    });
  }
  _onMessage(object, size) {
    const callback = object.id ? this.#callbacks.get(object.id) : void 0;
    if (object.id && callback) {
      this.#callbacks.delete(object.id);
      if (object.error) {
        callback.reject(createProtocolError(callback.method, object));
      } else if (callback.returnSize) {
        callback.resolve({ value: object.result, size });
      } else {
        callback.resolve(object.result);
      }
    } else {
      this.emit(object.method, object.params);
    }
  }
  _onClosed() {
    this.#connection = void 0;
    for (const callback of this.#callbacks.values()) {
      callback.reject(rewriteError(new ProtocolError(), `Protocol error (${callback.method}): Target closed. https://www.remotion.dev/docs/target-closed`));
    }
    this.#callbacks.clear();
    this.emit(CDPSessionEmittedEvents.Disconnected);
  }
  id() {
    return this.#sessionId;
  }
};
function createProtocolError(method, object) {
  let message = `Protocol error (${method}): ${object.error.message}`;
  if ("data" in object.error) {
    message += ` ${object.error.data}`;
  }
  return rewriteError(new ProtocolError(), message, object.error.message);
}
__name(createProtocolError, "createProtocolError");
function rewriteError(error, message, originalMessage) {
  error.message = message;
  error.originalMessage = originalMessage ?? error.originalMessage;
  return error;
}
__name(rewriteError, "rewriteError");
function getExceptionMessage(exceptionDetails) {
  if (exceptionDetails.exception) {
    return exceptionDetails.exception.description || exceptionDetails.exception.value;
  }
  let message = exceptionDetails.text;
  if (exceptionDetails.stackTrace) {
    for (const callframe of exceptionDetails.stackTrace.callFrames) {
      const location = callframe.url + ":" + callframe.lineNumber + ":" + callframe.columnNumber;
      const functionName = callframe.functionName || "<anonymous>";
      message += `
    at ${functionName} (${location})`;
    }
  }
  return message;
}
__name(getExceptionMessage, "getExceptionMessage");
function valueFromRemoteObject(remoteObject) {
  assert(!remoteObject.objectId, "Cannot extract value when objectId is given");
  if (remoteObject.unserializableValue) {
    if (remoteObject.type === "bigint" && typeof BigInt !== "undefined") {
      return BigInt(remoteObject.unserializableValue.replace("n", ""));
    }
    switch (remoteObject.unserializableValue) {
      case "-0":
        return -0;
      case "NaN":
        return NaN;
      case "Infinity":
        return Infinity;
      case "-Infinity":
        return -Infinity;
      default:
        throw new Error("Unsupported unserializable value: " + remoteObject.unserializableValue);
    }
  }
  return remoteObject.value;
}
__name(valueFromRemoteObject, "valueFromRemoteObject");
async function releaseObject(client, remoteObject) {
  if (!remoteObject.objectId) {
    return;
  }
  await client.send("Runtime.releaseObject", { objectId: remoteObject.objectId }).catch(() => {
  });
}
__name(releaseObject, "releaseObject");
function addEventListener(emitter, eventName, handler) {
  emitter.on(eventName, handler);
  return () => emitter.off(eventName, handler);
}
__name(addEventListener, "addEventListener");
function removeEventListeners(listeners) {
  for (const listener of listeners) {
    listener();
  }
  listeners.length = 0;
}
__name(removeEventListeners, "removeEventListeners");
var isString = /* @__PURE__ */ __name((obj) => {
  return typeof obj === "string" || obj instanceof String;
}, "isString");
function evaluationString(fun, ...args) {
  if (isString(fun)) {
    assert(args.length === 0, "Cannot evaluate a string with arguments");
    return fun;
  }
  function serializeArgument(arg) {
    if (Object.is(arg, void 0)) {
      return "undefined";
    }
    return JSON.stringify(arg);
  }
  __name(serializeArgument, "serializeArgument");
  return `(${fun})(${args.map(serializeArgument).join(",")})`;
}
__name(evaluationString, "evaluationString");
function pageBindingDeliverResultString(name, seq, result) {
  function deliverResult(_name, _seq, _result) {
    window[_name].callbacks.get(_seq).resolve(_result);
    window[_name].callbacks.delete(_seq);
  }
  __name(deliverResult, "deliverResult");
  return evaluationString(deliverResult, name, seq, result);
}
__name(pageBindingDeliverResultString, "pageBindingDeliverResultString");
function pageBindingDeliverErrorString(name, seq, message, stack) {
  function deliverError(_name, _seq, _message, _stack) {
    const error = new Error(_message);
    error.stack = _stack;
    window[_name].callbacks.get(_seq).reject(error);
    window[_name].callbacks.delete(_seq);
  }
  __name(deliverError, "deliverError");
  return evaluationString(deliverError, name, seq, message, stack);
}
__name(pageBindingDeliverErrorString, "pageBindingDeliverErrorString");
function pageBindingDeliverErrorValueString(name, seq, value) {
  function deliverErrorValue(_name, _seq, _value) {
    window[_name].callbacks.get(_seq).reject(_value);
    window[_name].callbacks.delete(_seq);
  }
  __name(deliverErrorValue, "deliverErrorValue");
  return evaluationString(deliverErrorValue, name, seq, value);
}
__name(pageBindingDeliverErrorValueString, "pageBindingDeliverErrorValueString");
async function waitWithTimeout(promise, taskName, timeout, browser) {
  let reject;
  const timeoutError = new TimeoutError(`waiting for ${taskName} failed: timeout ${timeout}ms exceeded`);
  const timeoutPromise = new Promise((_res, rej) => {
    reject = rej;
  });
  let timeoutTimer = null;
  if (timeout) {
    timeoutTimer = setTimeout(() => {
      return reject(timeoutError);
    }, timeout);
  }
  try {
    return await Promise.race([
      new Promise((_, rej) => {
        browser.once("closed", () => {
          return rej();
        });
      }),
      promise,
      timeoutPromise
    ]);
  } finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
    }
  }
}
__name(waitWithTimeout, "waitWithTimeout");
function isErrorLike(obj) {
  return typeof obj === "object" && obj !== null && "name" in obj && "message" in obj;
}
__name(isErrorLike, "isErrorLike");
function isErrnoException(obj) {
  return isErrorLike(obj) && ("errno" in obj || "code" in obj || "path" in obj || "syscall" in obj);
}
__name(isErrnoException, "isErrnoException");
var DOMWorld = class {
  static {
    __name(this, "DOMWorld");
  }
  #frame;
  #contextPromise = null;
  #contextResolveCallback = null;
  #detached = false;
  #waitTasks = /* @__PURE__ */ new Set();
  get _waitTasks() {
    return this.#waitTasks;
  }
  constructor(frame) {
    this.#frame = frame;
    this._setContext(null);
  }
  frame() {
    return this.#frame;
  }
  _setContext(context) {
    if (context) {
      assert(this.#contextResolveCallback, "Execution Context has already been set.");
      this.#contextResolveCallback?.call(null, context);
      this.#contextResolveCallback = null;
      for (const waitTask of this._waitTasks) {
        waitTask.rerun();
      }
    } else {
      this.#contextPromise = new Promise((fulfill) => {
        this.#contextResolveCallback = fulfill;
      });
    }
  }
  _hasContext() {
    return !this.#contextResolveCallback;
  }
  _detach() {
    this.#detached = true;
    for (const waitTask of this._waitTasks) {
      waitTask.terminate(new Error("waitForFunction failed: frame got detached."));
    }
  }
  executionContext() {
    if (this.#detached) {
      throw new Error(`Execution context is not available in detached frame "${this.#frame.url()}" (are you trying to evaluate?)`);
    }
    if (this.#contextPromise === null) {
      throw new Error(`Execution content promise is missing`);
    }
    return this.#contextPromise;
  }
  async evaluateHandle(pageFunction, ...args) {
    const context = await this.executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }
  async evaluate(pageFunction, ...args) {
    const context = await this.executionContext();
    return context.evaluate(pageFunction, ...args);
  }
  waitForFunction({
    browser,
    timeout,
    pageFunction,
    title
  }) {
    return new WaitTask({
      domWorld: this,
      predicateBody: pageFunction,
      title,
      timeout,
      args: [],
      browser
    });
  }
};
var noop = /* @__PURE__ */ __name(() => {
  return;
}, "noop");
var WaitTask = class {
  static {
    __name(this, "WaitTask");
  }
  #domWorld;
  #timeout;
  #predicateBody;
  #args;
  #runCount = 0;
  #resolve = noop;
  #reject = noop;
  #timeoutTimer;
  #terminated = false;
  #browser;
  promise;
  constructor(options) {
    function getPredicateBody(predicateBody) {
      if (isString(predicateBody)) {
        return `return (${predicateBody});`;
      }
      return `return (${predicateBody})(...args);`;
    }
    __name(getPredicateBody, "getPredicateBody");
    this.#domWorld = options.domWorld;
    this.#timeout = options.timeout;
    this.#predicateBody = getPredicateBody(options.predicateBody);
    this.#args = options.args;
    this.#runCount = 0;
    this.#domWorld._waitTasks.add(this);
    this.promise = new Promise((resolve3, reject) => {
      this.#resolve = resolve3;
      this.#reject = reject;
    });
    if (options.timeout) {
      const timeoutError = new TimeoutError(`waiting for ${options.title} failed: timeout ${options.timeout}ms exceeded`);
      this.#timeoutTimer = setTimeout(() => {
        return this.#reject(timeoutError);
      }, options.timeout);
    }
    this.#browser = options.browser;
    this.#browser.on("closed", this.onBrowserClose);
    this.#browser.on("closed-silent", this.onBrowserCloseSilent);
    this.rerun();
  }
  onBrowserClose = /* @__PURE__ */ __name(() => {
    return this.terminate(new Error("Browser was closed"));
  }, "onBrowserClose");
  onBrowserCloseSilent = /* @__PURE__ */ __name(() => {
    return this.terminate(null);
  }, "onBrowserCloseSilent");
  terminate(error) {
    this.#terminated = true;
    if (error) {
      this.#reject(error);
    }
    this.#cleanup();
  }
  async rerun() {
    const runCount = ++this.#runCount;
    let success = null;
    let error = null;
    const context = await this.#domWorld.executionContext();
    if (this.#terminated || runCount !== this.#runCount) {
      return;
    }
    if (this.#terminated || runCount !== this.#runCount) {
      return;
    }
    try {
      success = await context.evaluateHandle(waitForPredicatePageFunction, this.#predicateBody, this.#timeout, ...this.#args);
    } catch (error_) {
      error = error_;
    }
    if (this.#terminated || runCount !== this.#runCount) {
      if (success) {
        await success.dispose();
      }
      return;
    }
    if (!error && await this.#domWorld.evaluate((s) => {
      return !s;
    }, success).catch(() => {
      return true;
    })) {
      if (!success) {
        throw new Error("Assertion: result handle is not available");
      }
      await success.dispose();
      return;
    }
    if (error) {
      if (error.message.includes("TypeError: binding is not a function")) {
        return this.rerun();
      }
      if (error.message.includes("Execution context is not available in detached frame")) {
        this.terminate(new Error("waitForFunction failed: frame got detached."));
        return;
      }
      if (error.message.includes("Execution context was destroyed")) {
        return;
      }
      if (error.message.includes("Cannot find context with specified id")) {
        return;
      }
      this.#reject(error);
    } else {
      if (!success) {
        throw new Error("Assertion: result handle is not available");
      }
      this.#resolve(success);
    }
    this.#cleanup();
  }
  #cleanup() {
    if (this.#timeoutTimer !== void 0) {
      clearTimeout(this.#timeoutTimer);
    }
    this.#browser.off("closed", this.onBrowserClose);
    this.#browser.off("closed-silent", this.onBrowserCloseSilent);
    if (this.#domWorld._waitTasks.size > 100) {
      throw new Error("Leak detected: Too many WaitTasks");
    }
    this.#domWorld._waitTasks.delete(this);
  }
};
function waitForPredicatePageFunction(predicateBody, timeout, ...args) {
  const predicate = new Function("...args", predicateBody);
  let timedOut = false;
  if (timeout) {
    setTimeout(() => {
      timedOut = true;
    }, timeout);
  }
  return new Promise((resolve3) => {
    async function onRaf() {
      if (timedOut) {
        resolve3(void 0);
        return;
      }
      const success = await predicate(...args);
      if (success) {
        resolve3(success);
      } else {
        requestAnimationFrame(onRaf);
      }
    }
    __name(onRaf, "onRaf");
    onRaf();
  });
}
__name(waitForPredicatePageFunction, "waitForPredicatePageFunction");
function _createJSHandle(context, remoteObject) {
  const frame = context.frame();
  if (remoteObject.subtype === "node" && frame) {
    return new ElementHandle(context, context._client, remoteObject);
  }
  return new JSHandle(context, context._client, remoteObject);
}
__name(_createJSHandle, "_createJSHandle");
var JSHandle = class {
  static {
    __name(this, "JSHandle");
  }
  #client;
  #disposed = false;
  #context;
  #remoteObject;
  get _disposed() {
    return this.#disposed;
  }
  get _remoteObject() {
    return this.#remoteObject;
  }
  get _context() {
    return this.#context;
  }
  constructor(context, client, remoteObject) {
    this.#context = context;
    this.#client = client;
    this.#remoteObject = remoteObject;
  }
  executionContext() {
    return this.#context;
  }
  evaluateHandle(pageFunction, ...args) {
    return this.executionContext().evaluateHandle(pageFunction, this, ...args);
  }
  asElement() {
    return null;
  }
  async dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    await releaseObject(this.#client, this.#remoteObject);
  }
  toString() {
    if (this.#remoteObject.objectId) {
      const type = this.#remoteObject.subtype || this.#remoteObject.type;
      return "JSHandle@" + type;
    }
    return valueFromRemoteObject(this.#remoteObject);
  }
};
var ElementHandle = class extends JSHandle {
  static {
    __name(this, "ElementHandle");
  }
  asElement() {
    return this;
  }
};
var EVALUATION_SCRIPT_URL = "pptr://__puppeteer_evaluation_script__";
var SOURCE_URL_REGEX = /^[\x20\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;
var ExecutionContext = class {
  static {
    __name(this, "ExecutionContext");
  }
  _client;
  _world;
  _contextId;
  _contextName;
  constructor(client, contextPayload, world) {
    this._client = client;
    this._world = world;
    this._contextId = contextPayload.id;
    this._contextName = contextPayload.name;
  }
  frame() {
    return this._world ? this._world.frame() : null;
  }
  evaluate(pageFunction, ...args) {
    return this.#evaluate(true, pageFunction, ...args);
  }
  evaluateHandle(pageFunction, ...args) {
    return this.#evaluate(false, pageFunction, ...args);
  }
  async #evaluate(returnByValue, pageFunction, ...args) {
    const suffix = `//# sourceURL=${EVALUATION_SCRIPT_URL}`;
    if (isString(pageFunction)) {
      const contextId = this._contextId;
      const expression = pageFunction;
      const expressionWithSourceUrl = SOURCE_URL_REGEX.test(expression) ? expression : expression + `
` + suffix;
      const {
        value: { exceptionDetails: _details, result: _remoteObject }
      } = await this._client.send("Runtime.evaluate", {
        expression: expressionWithSourceUrl,
        contextId,
        returnByValue,
        awaitPromise: true,
        userGesture: true
      }).catch(rewriteError2);
      if (_details) {
        throw new Error("Evaluation failed: " + getExceptionMessage(_details));
      }
      return returnByValue ? valueFromRemoteObject(_remoteObject) : _createJSHandle(this, _remoteObject);
    }
    if (typeof pageFunction !== "function") {
      throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);
    }
    let functionText = pageFunction.toString();
    try {
      new Function("(" + functionText + ")");
    } catch (error) {
      if (functionText.startsWith("async ")) {
        functionText = "async function " + functionText.substring("async ".length);
      } else {
        functionText = "function " + functionText;
      }
      try {
        new Function("(" + functionText + ")");
      } catch (_error) {
        throw new Error("Passed function is not well-serializable!");
      }
    }
    let callFunctionOnPromise;
    try {
      callFunctionOnPromise = this._client.send("Runtime.callFunctionOn", {
        functionDeclaration: functionText + `
` + suffix + `
`,
        executionContextId: this._contextId,
        arguments: args.map(convertArgument2.bind(this)),
        returnByValue,
        awaitPromise: true,
        userGesture: true
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.startsWith("Converting circular structure to JSON")) {
        error.message += " Recursive objects are not allowed.";
      }
      throw error;
    }
    const {
      value: { exceptionDetails, result: remoteObject }
    } = await callFunctionOnPromise.catch(rewriteError2);
    if (exceptionDetails) {
      throw new Error("Evaluation failed: " + getExceptionMessage(exceptionDetails));
    }
    return returnByValue ? valueFromRemoteObject(remoteObject) : _createJSHandle(this, remoteObject);
    function convertArgument2(arg) {
      if (typeof arg === "bigint") {
        return { unserializableValue: `${arg.toString()}n` };
      }
      if (Object.is(arg, -0)) {
        return { unserializableValue: "-0" };
      }
      if (Object.is(arg, Infinity)) {
        return { unserializableValue: "Infinity" };
      }
      if (Object.is(arg, -Infinity)) {
        return { unserializableValue: "-Infinity" };
      }
      if (Object.is(arg, NaN)) {
        return { unserializableValue: "NaN" };
      }
      const objectHandle = arg && arg instanceof JSHandle ? arg : null;
      if (objectHandle) {
        if (objectHandle._context !== this) {
          throw new Error("JSHandles can be evaluated only in the context they were created!");
        }
        if (objectHandle._disposed) {
          throw new Error("JSHandle is disposed!");
        }
        if (objectHandle._remoteObject.unserializableValue) {
          return {
            unserializableValue: objectHandle._remoteObject.unserializableValue
          };
        }
        if (!objectHandle._remoteObject.objectId) {
          return { value: objectHandle._remoteObject.value };
        }
        return { objectId: objectHandle._remoteObject.objectId };
      }
      return { value: arg };
    }
    __name(convertArgument2, "convertArgument");
    function rewriteError2(error) {
      if (error.message.includes("Object reference chain is too long")) {
        return { value: { result: { type: "undefined" } }, size: 1 };
      }
      if (error.message.includes("Object couldn't be returned by value")) {
        return { value: { result: { type: "undefined" } }, size: 1 };
      }
      if (error.message.endsWith("Cannot find context with specified id") || error.message.endsWith("Inspected target navigated or closed")) {
        throw new Error("Execution context was destroyed, most likely because of a navigation.");
      }
      throw error;
    }
    __name(rewriteError2, "rewriteError2");
  }
};
var isTargetClosedErr = /* @__PURE__ */ __name((error) => {
  return error?.message?.includes("Target closed") || error?.message?.includes("Session closed");
}, "isTargetClosedErr");
var isFlakyNetworkError = /* @__PURE__ */ __name((error) => {
  return error?.message?.includes("ERR_CONNECTION_REFUSED") || error?.message?.includes("ERR_CONNECTION_RESET") || error?.message?.includes("ERR_CONNECTION_TIMED_OUT") || error?.message?.includes("ERR_INTERNET_DISCONNECTED") || error?.message?.includes("ERR_NAME_RESOLUTION_FAILED") || error?.message?.includes("ERR_ADDRESS_UNREACHABLE") || error?.message?.includes("ERR_NETWORK_CHANGED");
}, "isFlakyNetworkError");
var handleFailedResource = /* @__PURE__ */ __name(({
  extraInfo,
  logLevel,
  indent,
  request,
  event
}) => {
  const firstExtraInfo = extraInfo[0] ?? null;
  Log.warn({ indent, logLevel }, `Browser failed to load ${request._url} (${event.type}): ${event.errorText}`);
  if (firstExtraInfo) {
    Log.warn({ indent, logLevel }, `HTTP status code: ${firstExtraInfo.statusCode}, headers:`);
    Log.warn({ indent, logLevel }, JSON.stringify(firstExtraInfo.headers, null, 2));
  }
  if (event.errorText === "net::ERR_FAILED" && event.type === "Fetch" && request._url?.includes("/proxy")) {
    Log.warn({ indent, logLevel }, "This could be caused by Chrome rejecting the request because the disk space is low.");
    Log.warn({ indent, logLevel }, "This could be caused by Chrome rejecting the request because the disk space is low.");
    Log.warn({ indent, logLevel }, "Consider increasing the disk size of your Lambda function.");
  }
}, "handleFailedResource");
var HTTPRequest = class {
  static {
    __name(this, "HTTPRequest");
  }
  _requestId;
  _response = null;
  _url = null;
  _fromMemoryCache = false;
  #isNavigationRequest;
  #frame;
  constructor(frame, event) {
    this._requestId = event.requestId;
    this.#isNavigationRequest = event.requestId === event.loaderId && event.type === "Document";
    this.#frame = frame;
    this._url = event.request.url;
  }
  response() {
    return this._response;
  }
  frame() {
    return this.#frame;
  }
  isNavigationRequest() {
    return this.#isNavigationRequest;
  }
};
var HTTPResponse = class {
  static {
    __name(this, "HTTPResponse");
  }
  #status;
  constructor(responsePayload, extraInfo) {
    this.#status = extraInfo ? extraInfo.statusCode : responsePayload.status;
  }
  status() {
    return this.#status;
  }
};
var NetworkEventManager = class {
  static {
    __name(this, "NetworkEventManager");
  }
  #requestWillBeSentMap = /* @__PURE__ */ new Map();
  #requestPausedMap = /* @__PURE__ */ new Map();
  #httpRequestsMap = /* @__PURE__ */ new Map();
  #responseReceivedExtraInfoMap = /* @__PURE__ */ new Map();
  #queuedRedirectInfoMap = /* @__PURE__ */ new Map();
  #queuedEventGroupMap = /* @__PURE__ */ new Map();
  #failedLoadInfoMap = /* @__PURE__ */ new Map();
  forget(networkRequestId) {
    this.#requestWillBeSentMap.delete(networkRequestId);
    this.#requestPausedMap.delete(networkRequestId);
    this.#queuedEventGroupMap.delete(networkRequestId);
    this.#queuedRedirectInfoMap.delete(networkRequestId);
    this.#responseReceivedExtraInfoMap.delete(networkRequestId);
    this.#failedLoadInfoMap.delete(networkRequestId);
  }
  queueFailedLoadInfo(networkRequestId, event) {
    this.#failedLoadInfoMap.set(networkRequestId, { event });
  }
  getFailedLoadInfo(networkRequestId) {
    return this.#failedLoadInfoMap.get(networkRequestId)?.event;
  }
  getResponseExtraInfo(networkRequestId) {
    if (!this.#responseReceivedExtraInfoMap.has(networkRequestId)) {
      this.#responseReceivedExtraInfoMap.set(networkRequestId, []);
    }
    return this.#responseReceivedExtraInfoMap.get(networkRequestId);
  }
  queuedRedirectInfo(fetchRequestId) {
    if (!this.#queuedRedirectInfoMap.has(fetchRequestId)) {
      this.#queuedRedirectInfoMap.set(fetchRequestId, []);
    }
    return this.#queuedRedirectInfoMap.get(fetchRequestId);
  }
  queueRedirectInfo(fetchRequestId, redirectInfo) {
    this.queuedRedirectInfo(fetchRequestId).push(redirectInfo);
  }
  takeQueuedRedirectInfo(fetchRequestId) {
    return this.queuedRedirectInfo(fetchRequestId).shift();
  }
  storeRequestWillBeSent(networkRequestId, event) {
    this.#requestWillBeSentMap.set(networkRequestId, event);
  }
  getRequestWillBeSent(networkRequestId) {
    return this.#requestWillBeSentMap.get(networkRequestId);
  }
  forgetRequestWillBeSent(networkRequestId) {
    this.#requestWillBeSentMap.delete(networkRequestId);
  }
  storeRequestPaused(networkRequestId, event) {
    this.#requestPausedMap.set(networkRequestId, event);
  }
  getRequest(networkRequestId) {
    return this.#httpRequestsMap.get(networkRequestId);
  }
  storeRequest(networkRequestId, request) {
    this.#httpRequestsMap.set(networkRequestId, request);
  }
  forgetRequest(networkRequestId) {
    this.#httpRequestsMap.delete(networkRequestId);
  }
  getQueuedEventGroup(networkRequestId) {
    return this.#queuedEventGroupMap.get(networkRequestId);
  }
  queueEventGroup(networkRequestId, event) {
    this.#queuedEventGroupMap.set(networkRequestId, event);
  }
  forgetQueuedEventGroup(networkRequestId) {
    this.#queuedEventGroupMap.delete(networkRequestId);
  }
};
var NetworkManagerEmittedEvents = {
  Request: Symbol("NetworkManager.Request")
};
var NetworkManager = class extends EventEmitter {
  static {
    __name(this, "NetworkManager");
  }
  #client;
  #frameManager;
  #networkEventManager = new NetworkEventManager();
  #indent;
  #logLevel;
  constructor(client, frameManager, indent, logLevel) {
    super();
    this.#client = client;
    this.#frameManager = frameManager;
    this.#indent = indent;
    this.#logLevel = logLevel;
    this.#client.on("Fetch.requestPaused", this.#onRequestPaused.bind(this));
    this.#client.on("Network.requestWillBeSent", this.#onRequestWillBeSent.bind(this));
    this.#client.on("Network.requestServedFromCache", this.#onRequestServedFromCache.bind(this));
    this.#client.on("Network.responseReceived", this.#onResponseReceived.bind(this));
    this.#client.on("Network.loadingFinished", this.#onLoadingFinished.bind(this));
    this.#client.on("Network.loadingFailed", this.#onLoadingFailed.bind(this));
    this.#client.on("Network.responseReceivedExtraInfo", this.#onResponseReceivedExtraInfo.bind(this));
  }
  async initialize() {
    await this.#client.send("Network.enable");
  }
  #onRequestWillBeSent(event) {
    this.#onRequest(event, void 0);
  }
  #onRequestPaused(event) {
    const { networkId: networkRequestId, requestId: fetchRequestId } = event;
    if (!networkRequestId) {
      return;
    }
    const requestWillBeSentEvent = (() => {
      const _requestWillBeSentEvent = this.#networkEventManager.getRequestWillBeSent(networkRequestId);
      if (_requestWillBeSentEvent && (_requestWillBeSentEvent.request.url !== event.request.url || _requestWillBeSentEvent.request.method !== event.request.method)) {
        this.#networkEventManager.forgetRequestWillBeSent(networkRequestId);
        return;
      }
      return _requestWillBeSentEvent;
    })();
    if (requestWillBeSentEvent) {
      this.#patchRequestEventHeaders(requestWillBeSentEvent, event);
      this.#onRequest(requestWillBeSentEvent, fetchRequestId);
    } else {
      this.#networkEventManager.storeRequestPaused(networkRequestId, event);
    }
  }
  #patchRequestEventHeaders(requestWillBeSentEvent, requestPausedEvent) {
    requestWillBeSentEvent.request.headers = {
      ...requestWillBeSentEvent.request.headers,
      ...requestPausedEvent.request.headers
    };
  }
  #onRequest(event, fetchRequestId) {
    if (event.redirectResponse) {
      let redirectResponseExtraInfo = null;
      if (event.redirectHasExtraInfo) {
        redirectResponseExtraInfo = this.#networkEventManager.getResponseExtraInfo(event.requestId).shift();
        if (!redirectResponseExtraInfo) {
          this.#networkEventManager.queueRedirectInfo(event.requestId, {
            event,
            fetchRequestId
          });
          return;
        }
      }
      const _request = this.#networkEventManager.getRequest(event.requestId);
      if (_request) {
        this.#handleRequestRedirect(_request, event.redirectResponse, redirectResponseExtraInfo);
      }
    }
    const frame = event.frameId ? this.#frameManager.frame(event.frameId) : null;
    const request = new HTTPRequest(frame, event);
    this.#networkEventManager.storeRequest(event.requestId, request);
    this.emit(NetworkManagerEmittedEvents.Request, request);
  }
  #onRequestServedFromCache(event) {
    const request = this.#networkEventManager.getRequest(event.requestId);
    if (request) {
      request._fromMemoryCache = true;
    }
  }
  #handleRequestRedirect(request, responsePayload, extraInfo) {
    const response = new HTTPResponse(responsePayload, extraInfo);
    request._response = response;
    this.#forgetRequest(request, false);
  }
  #emitResponseEvent(responseReceived, extraInfo) {
    const request = this.#networkEventManager.getRequest(responseReceived.requestId);
    if (!request) {
      return;
    }
    const response = new HTTPResponse(responseReceived.response, extraInfo);
    request._response = response;
  }
  #onResponseReceived(event) {
    const request = this.#networkEventManager.getRequest(event.requestId);
    let extraInfo = null;
    if (request && !request._fromMemoryCache && event.hasExtraInfo) {
      extraInfo = this.#networkEventManager.getResponseExtraInfo(event.requestId).shift();
      if (!extraInfo) {
        this.#networkEventManager.queueEventGroup(event.requestId, {
          responseReceivedEvent: event
        });
        return;
      }
    }
    this.#emitResponseEvent(event, extraInfo);
  }
  #onResponseReceivedExtraInfo(event) {
    const redirectInfo = this.#networkEventManager.takeQueuedRedirectInfo(event.requestId);
    if (redirectInfo) {
      this.#networkEventManager.getResponseExtraInfo(event.requestId).push(event);
      this.#onRequest(redirectInfo.event, redirectInfo.fetchRequestId);
      return;
    }
    const queuedEvents = this.#networkEventManager.getQueuedEventGroup(event.requestId);
    if (queuedEvents) {
      this.#networkEventManager.forgetQueuedEventGroup(event.requestId);
      this.#emitResponseEvent(queuedEvents.responseReceivedEvent, event);
      if (queuedEvents.loadingFinishedEvent) {
        this.#emitLoadingFinished(queuedEvents.loadingFinishedEvent);
      }
      if (queuedEvents.loadingFailedEvent) {
        this.#emitLoadingFailed(queuedEvents.loadingFailedEvent);
      }
      return;
    }
    this.#networkEventManager.getResponseExtraInfo(event.requestId).push(event);
  }
  #forgetRequest(request, events) {
    const requestId = request._requestId;
    this.#networkEventManager.forgetRequest(requestId);
    if (events) {
      this.#networkEventManager.forget(requestId);
    }
  }
  #onLoadingFinished(event) {
    const queuedEvents = this.#networkEventManager.getQueuedEventGroup(event.requestId);
    if (queuedEvents) {
      queuedEvents.loadingFinishedEvent = event;
    } else {
      this.#emitLoadingFinished(event);
    }
  }
  #emitLoadingFinished(event) {
    const request = this.#networkEventManager.getRequest(event.requestId);
    if (!request) {
      return;
    }
    this.#forgetRequest(request, true);
  }
  #onLoadingFailed(event) {
    const queuedEvents = this.#networkEventManager.getQueuedEventGroup(event.requestId);
    if (queuedEvents) {
      queuedEvents.loadingFailedEvent = event;
    } else {
      this.#emitLoadingFailed(event);
    }
  }
  #emitLoadingFailed(event) {
    const request = this.#networkEventManager.getRequest(event.requestId);
    if (!request) {
      return;
    }
    if (event.canceled) {
      this.#forgetRequest(request, true);
      return;
    }
    const extraInfo = this.#networkEventManager.getResponseExtraInfo(event.requestId);
    handleFailedResource({
      extraInfo,
      event,
      indent: this.#indent,
      logLevel: this.#logLevel,
      request
    });
    this.#forgetRequest(request, true);
  }
};
var puppeteerToProtocolLifecycle = /* @__PURE__ */ new Map([["load", "load"]]);
var noop2 = /* @__PURE__ */ __name(() => {
  return;
}, "noop2");
var LifecycleWatcher = class {
  static {
    __name(this, "LifecycleWatcher");
  }
  #expectedLifecycle;
  #frameManager;
  #frame;
  #timeout;
  #navigationRequest = null;
  #eventListeners;
  #sameDocumentNavigationCompleteCallback = noop2;
  #sameDocumentNavigationPromise = new Promise((fulfill) => {
    this.#sameDocumentNavigationCompleteCallback = fulfill;
  });
  #lifecycleCallback = noop2;
  #lifecyclePromise = new Promise((fulfill) => {
    this.#lifecycleCallback = fulfill;
  });
  #newDocumentNavigationCompleteCallback = noop2;
  #newDocumentNavigationPromise = new Promise((fulfill) => {
    this.#newDocumentNavigationCompleteCallback = fulfill;
  });
  #terminationCallback = noop2;
  #terminationPromise = new Promise((fulfill) => {
    this.#terminationCallback = fulfill;
  });
  #timeoutPromise;
  #maximumTimer;
  #hasSameDocumentNavigation;
  #newDocumentNavigation;
  #swapped;
  constructor(frameManager, frame, waitUntil, timeout) {
    const protocolEvent = puppeteerToProtocolLifecycle.get(waitUntil);
    assert(protocolEvent, "Unknown value for options.waitUntil: " + waitUntil);
    this.#expectedLifecycle = [waitUntil];
    this.#frameManager = frameManager;
    this.#frame = frame;
    this.#timeout = timeout;
    this.#eventListeners = [
      addEventListener(frameManager._client, CDPSessionEmittedEvents.Disconnected, this.#terminate.bind(this, new Error("Navigation failed because browser has disconnected!"))),
      addEventListener(this.#frameManager, FrameManagerEmittedEvents.LifecycleEvent, this.#checkLifecycleComplete.bind(this)),
      addEventListener(this.#frameManager, FrameManagerEmittedEvents.FrameNavigatedWithinDocument, this.#navigatedWithinDocument.bind(this)),
      addEventListener(this.#frameManager, FrameManagerEmittedEvents.FrameNavigated, this.#navigated.bind(this)),
      addEventListener(this.#frameManager, FrameManagerEmittedEvents.FrameSwapped, this.#frameSwapped.bind(this)),
      addEventListener(this.#frameManager, FrameManagerEmittedEvents.FrameDetached, this.#onFrameDetached.bind(this)),
      addEventListener(this.#frameManager.networkManager(), NetworkManagerEmittedEvents.Request, this.#onRequest.bind(this))
    ];
    this.#timeoutPromise = this.#createTimeoutPromise();
    this.#checkLifecycleComplete();
  }
  #onRequest(request) {
    if (request.frame() !== this.#frame || !request.isNavigationRequest()) {
      return;
    }
    this.#navigationRequest = request;
  }
  #onFrameDetached(frame) {
    if (this.#frame === frame) {
      this.#terminationCallback.call(null, new Error("Navigating frame was detached"));
      return;
    }
    this.#checkLifecycleComplete();
  }
  navigationResponse() {
    if (!this.#navigationRequest) {
      return null;
    }
    const res = this.#navigationRequest.response();
    return res;
  }
  #terminate(error) {
    this.#terminationCallback.call(null, error);
  }
  sameDocumentNavigationPromise() {
    return this.#sameDocumentNavigationPromise;
  }
  newDocumentNavigationPromise() {
    return this.#newDocumentNavigationPromise;
  }
  lifecyclePromise() {
    return this.#lifecyclePromise;
  }
  timeoutOrTerminationPromise() {
    return Promise.race([this.#timeoutPromise, this.#terminationPromise]);
  }
  async #createTimeoutPromise() {
    if (!this.#timeout) {
      return new Promise(noop2);
    }
    const errorMessage = "Navigation timeout of " + this.#timeout + " ms exceeded";
    await new Promise((fulfill) => {
      this.#maximumTimer = setTimeout(fulfill, this.#timeout);
    });
    return new TimeoutError(errorMessage);
  }
  #navigatedWithinDocument(frame) {
    if (frame !== this.#frame) {
      return;
    }
    this.#hasSameDocumentNavigation = true;
    this.#checkLifecycleComplete();
  }
  #navigated(frame) {
    if (frame !== this.#frame) {
      return;
    }
    this.#newDocumentNavigation = true;
    this.#checkLifecycleComplete();
  }
  #frameSwapped(frame) {
    if (frame !== this.#frame) {
      return;
    }
    this.#swapped = true;
    this.#checkLifecycleComplete();
  }
  #checkLifecycleComplete() {
    if (!checkLifecycle(this.#frame, this.#expectedLifecycle)) {
      return;
    }
    this.#lifecycleCallback();
    if (this.#hasSameDocumentNavigation) {
      this.#sameDocumentNavigationCompleteCallback();
    }
    if (this.#swapped || this.#newDocumentNavigation) {
      this.#newDocumentNavigationCompleteCallback();
    }
    function checkLifecycle(frame, expectedLifecycle) {
      for (const event of expectedLifecycle) {
        if (!frame._lifecycleEvents.has(event)) {
          return false;
        }
      }
      for (const child of frame.childFrames()) {
        if (child._hasStartedLoading && !checkLifecycle(child, expectedLifecycle)) {
          return false;
        }
      }
      return true;
    }
    __name(checkLifecycle, "checkLifecycle");
  }
  dispose() {
    removeEventListeners(this.#eventListeners);
    if (this.#maximumTimer !== void 0) {
      clearTimeout(this.#maximumTimer);
    }
  }
};
var UTILITY_WORLD_NAME = "__puppeteer_utility_world__";
var FrameManagerEmittedEvents = {
  FrameNavigated: Symbol("FrameManager.FrameNavigated"),
  FrameDetached: Symbol("FrameManager.FrameDetached"),
  FrameSwapped: Symbol("FrameManager.FrameSwapped"),
  LifecycleEvent: Symbol("FrameManager.LifecycleEvent"),
  FrameNavigatedWithinDocument: Symbol("FrameManager.FrameNavigatedWithinDocument"),
  ExecutionContextCreated: Symbol("FrameManager.ExecutionContextCreated"),
  ExecutionContextDestroyed: Symbol("FrameManager.ExecutionContextDestroyed")
};
var FrameManager = class extends EventEmitter {
  static {
    __name(this, "FrameManager");
  }
  #page;
  #networkManager;
  #frames = /* @__PURE__ */ new Map();
  #contextIdToContext = /* @__PURE__ */ new Map();
  #isolatedWorlds = /* @__PURE__ */ new Set();
  #mainFrame;
  #client;
  get _client() {
    return this.#client;
  }
  constructor(client, page, indent, logLevel) {
    super();
    this.#client = client;
    this.#page = page;
    this.#networkManager = new NetworkManager(client, this, indent, logLevel);
    this.setupEventListeners(this.#client);
  }
  setupEventListeners(session) {
    session.on("Page.frameAttached", (event) => {
      this.#onFrameAttached(session, event.frameId, event.parentFrameId);
    });
    session.on("Page.frameNavigated", (event) => {
      this.#onFrameNavigated(event.frame);
    });
    session.on("Page.navigatedWithinDocument", (event) => {
      this.#onFrameNavigatedWithinDocument(event.frameId, event.url);
    });
    session.on("Page.frameDetached", (event) => {
      this.#onFrameDetached(event.frameId, event.reason);
    });
    session.on("Page.frameStartedLoading", (event) => {
      this.#onFrameStartedLoading(event.frameId);
    });
    session.on("Page.frameStoppedLoading", (event) => {
      this.#onFrameStoppedLoading(event.frameId);
    });
    session.on("Runtime.executionContextCreated", (event) => {
      this.#onExecutionContextCreated(event.context, session);
    });
    session.on("Runtime.executionContextDestroyed", (event) => {
      this.#onExecutionContextDestroyed(event.executionContextId, session);
    });
    session.on("Runtime.executionContextsCleared", () => {
      this.#onExecutionContextsCleared(session);
    });
    session.on("Page.lifecycleEvent", (event) => {
      this.#onLifecycleEvent(event);
    });
    session.on("Target.attachedToTarget", (event) => {
      this.#onAttachedToTarget(event);
    });
    session.on("Target.detachedFromTarget", (event) => {
      this.#onDetachedFromTarget(event);
    });
  }
  async initialize(client = this.#client) {
    try {
      const result = await Promise.all([
        client.send("Page.enable"),
        client.send("Page.getFrameTree"),
        client === this.#client ? Promise.resolve() : client.send("Target.setAutoAttach", {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true
        })
      ]);
      const {
        value: { frameTree }
      } = result[1];
      this.#handleFrameTree(client, frameTree);
      await Promise.all([
        client.send("Page.setLifecycleEventsEnabled", { enabled: true }),
        client.send("Runtime.enable").then(() => {
          return this._ensureIsolatedWorld(client, UTILITY_WORLD_NAME);
        }),
        client === this.#client ? this.#networkManager.initialize() : Promise.resolve()
      ]);
    } catch (error) {
      if (isErrorLike(error) && isTargetClosedErr(error)) {
        return;
      }
      throw error;
    }
  }
  networkManager() {
    return this.#networkManager;
  }
  async navigateFrame(frame, url2, timeout, options = {}) {
    const { referer = void 0, waitUntil = "load" } = options;
    const watcher = new LifecycleWatcher(this, frame, waitUntil, timeout);
    let error = await Promise.race([
      navigate(this.#client, url2, referer, frame._id),
      watcher.timeoutOrTerminationPromise()
    ]);
    if (!error) {
      error = await Promise.race([
        watcher.timeoutOrTerminationPromise(),
        watcher.newDocumentNavigationPromise(),
        watcher.sameDocumentNavigationPromise()
      ]);
    }
    watcher.dispose();
    if (error) {
      throw error;
    }
    return watcher.navigationResponse();
    async function navigate(client, _url, referrer, frameId) {
      try {
        const { value: response } = await client.send("Page.navigate", {
          url: _url,
          referrer,
          frameId
        });
        return response.errorText ? new Error(`${response.errorText} at ${_url}`) : null;
      } catch (_error) {
        if (isErrorLike(_error)) {
          return _error;
        }
        throw _error;
      }
    }
    __name(navigate, "navigate");
  }
  async #onAttachedToTarget(event) {
    if (event.targetInfo.type !== "iframe") {
      return;
    }
    const frame = this.#frames.get(event.targetInfo.targetId);
    const connection = Connection.fromSession(this.#client);
    assert(connection);
    const session = connection.session(event.sessionId);
    assert(session);
    if (frame) {
      frame._updateClient(session);
    }
    this.setupEventListeners(session);
    await this.initialize(session);
  }
  #onDetachedFromTarget(event) {
    if (!event.targetId) {
      return;
    }
    const frame = this.#frames.get(event.targetId);
    if (frame?.isOOPFrame()) {
      this.#removeFramesRecursively(frame);
    }
  }
  #onLifecycleEvent(event) {
    const frame = this.#frames.get(event.frameId);
    if (!frame) {
      return;
    }
    frame._onLifecycleEvent(event.loaderId, event.name);
    this.emit(FrameManagerEmittedEvents.LifecycleEvent, frame);
  }
  #onFrameStartedLoading(frameId) {
    const frame = this.#frames.get(frameId);
    if (!frame) {
      return;
    }
    frame._onLoadingStarted();
  }
  #onFrameStoppedLoading(frameId) {
    const frame = this.#frames.get(frameId);
    if (!frame) {
      return;
    }
    frame._onLoadingStopped();
    this.emit(FrameManagerEmittedEvents.LifecycleEvent, frame);
  }
  #handleFrameTree(session, frameTree) {
    if (frameTree.frame.parentId) {
      this.#onFrameAttached(session, frameTree.frame.id, frameTree.frame.parentId);
    }
    this.#onFrameNavigated(frameTree.frame);
    if (!frameTree.childFrames) {
      return;
    }
    for (const child of frameTree.childFrames) {
      this.#handleFrameTree(session, child);
    }
  }
  page() {
    return this.#page;
  }
  mainFrame() {
    assert(this.#mainFrame, "Requesting main frame too early!");
    return this.#mainFrame;
  }
  frames() {
    return Array.from(this.#frames.values());
  }
  frame(frameId) {
    return this.#frames.get(frameId) || null;
  }
  #onFrameAttached(session, frameId, parentFrameId) {
    if (this.#frames.has(frameId)) {
      const _frame = this.#frames.get(frameId);
      if (session && _frame.isOOPFrame()) {
        _frame._updateClient(session);
      }
      return;
    }
    assert(parentFrameId);
    const parentFrame = this.#frames.get(parentFrameId);
    assert(parentFrame);
    const frame = new Frame(this, parentFrame, frameId, session);
    this.#frames.set(frame._id, frame);
  }
  #onFrameNavigated(framePayload) {
    const isMainFrame = !framePayload.parentId;
    let frame = isMainFrame ? this.#mainFrame : this.#frames.get(framePayload.id);
    assert(isMainFrame || frame, "We either navigate top level or have old version of the navigated frame");
    if (frame) {
      for (const child of frame.childFrames()) {
        this.#removeFramesRecursively(child);
      }
    }
    if (isMainFrame) {
      if (frame) {
        this.#frames.delete(frame._id);
        frame._id = framePayload.id;
      } else {
        frame = new Frame(this, null, framePayload.id, this.#client);
      }
      this.#frames.set(framePayload.id, frame);
      this.#mainFrame = frame;
    }
    assert(frame);
    frame._navigated(framePayload);
    this.emit(FrameManagerEmittedEvents.FrameNavigated, frame);
  }
  async _ensureIsolatedWorld(session, name) {
    const key = `${session.id()}:${name}`;
    if (this.#isolatedWorlds.has(key)) {
      return;
    }
    this.#isolatedWorlds.add(key);
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `//# sourceURL=${EVALUATION_SCRIPT_URL}`,
      worldName: name
    });
    await Promise.all(this.frames().filter((frame) => {
      return frame._client() === session;
    }).map((frame) => {
      return session.send("Page.createIsolatedWorld", {
        frameId: frame._id,
        worldName: name,
        grantUniveralAccess: true
      }).catch(() => {
        return;
      });
    }));
  }
  #onFrameNavigatedWithinDocument(frameId, url2) {
    const frame = this.#frames.get(frameId);
    if (!frame) {
      return;
    }
    frame._navigatedWithinDocument(url2);
    this.emit(FrameManagerEmittedEvents.FrameNavigatedWithinDocument, frame);
    this.emit(FrameManagerEmittedEvents.FrameNavigated, frame);
  }
  #onFrameDetached(frameId, reason) {
    const frame = this.#frames.get(frameId);
    if (reason === "remove") {
      if (frame) {
        this.#removeFramesRecursively(frame);
      }
    } else if (reason === "swap") {
      this.emit(FrameManagerEmittedEvents.FrameSwapped, frame);
    }
  }
  #onExecutionContextCreated(contextPayload, session) {
    const auxData = contextPayload.auxData;
    const frameId = auxData?.frameId;
    const frame = typeof frameId === "string" ? this.#frames.get(frameId) : void 0;
    let world;
    if (frame) {
      if (frame._client() !== session) {
        return;
      }
      if (contextPayload.auxData && Boolean(contextPayload.auxData.isDefault)) {
        world = frame._mainWorld;
      } else if (contextPayload.name === UTILITY_WORLD_NAME && !frame._secondaryWorld._hasContext()) {
        world = frame._secondaryWorld;
      }
    }
    const context = new ExecutionContext(frame?._client() || this.#client, contextPayload, world);
    if (world) {
      world._setContext(context);
    }
    const key = `${session.id()}:${contextPayload.id}`;
    this.#contextIdToContext.set(key, context);
  }
  #onExecutionContextDestroyed(executionContextId, session) {
    const key = `${session.id()}:${executionContextId}`;
    const context = this.#contextIdToContext.get(key);
    if (!context) {
      return;
    }
    this.#contextIdToContext.delete(key);
    if (context._world) {
      context._world._setContext(null);
    }
  }
  #onExecutionContextsCleared(session) {
    for (const [key, context] of this.#contextIdToContext.entries()) {
      if (context._client !== session) {
        continue;
      }
      if (context._world) {
        context._world._setContext(null);
      }
      this.#contextIdToContext.delete(key);
    }
  }
  executionContextById(contextId, session = this.#client) {
    const key = `${session.id()}:${contextId}`;
    const context = this.#contextIdToContext.get(key);
    assert(context, "INTERNAL ERROR: missing context with id = " + contextId);
    return context;
  }
  #removeFramesRecursively(frame) {
    for (const child of frame.childFrames()) {
      this.#removeFramesRecursively(child);
    }
    frame._detach();
    this.#frames.delete(frame._id);
    this.emit(FrameManagerEmittedEvents.FrameDetached, frame);
  }
};
var Frame = class {
  static {
    __name(this, "Frame");
  }
  #parentFrame;
  #url = "";
  #client;
  _frameManager;
  _id;
  _loaderId = "";
  _name;
  _hasStartedLoading = false;
  _lifecycleEvents = /* @__PURE__ */ new Set();
  _mainWorld;
  _secondaryWorld;
  _childFrames;
  constructor(frameManager, parentFrame, frameId, client) {
    this._frameManager = frameManager;
    this.#parentFrame = parentFrame ?? null;
    this.#url = "";
    this._id = frameId;
    this._loaderId = "";
    this._childFrames = /* @__PURE__ */ new Set();
    if (this.#parentFrame) {
      this.#parentFrame._childFrames.add(this);
    }
    this._updateClient(client);
  }
  _updateClient(client) {
    this.#client = client;
    this._mainWorld = new DOMWorld(this);
    this._secondaryWorld = new DOMWorld(this);
  }
  isOOPFrame() {
    return this.#client !== this._frameManager._client;
  }
  goto(url2, timeout, options = {}) {
    return this._frameManager.navigateFrame(this, url2, timeout, options);
  }
  _client() {
    return this.#client;
  }
  executionContext() {
    return this._mainWorld.executionContext();
  }
  evaluateHandle(pageFunction, ...args) {
    return this._mainWorld.evaluateHandle(pageFunction, ...args);
  }
  evaluate(pageFunction, ...args) {
    return this._mainWorld.evaluate(pageFunction, ...args);
  }
  url() {
    return this.#url;
  }
  childFrames() {
    return Array.from(this._childFrames);
  }
  _navigated(framePayload) {
    this._name = framePayload.name;
    this.#url = `${framePayload.url}${framePayload.urlFragment || ""}`;
  }
  _navigatedWithinDocument(url2) {
    this.#url = url2;
  }
  _onLifecycleEvent(loaderId, name) {
    if (name === "init") {
      this._loaderId = loaderId;
      this._lifecycleEvents.clear();
    }
    this._lifecycleEvents.add(name);
  }
  _onLoadingStopped() {
    this._lifecycleEvents.add("load");
  }
  _onLoadingStarted() {
    this._hasStartedLoading = true;
  }
  _detach() {
    this._mainWorld._detach();
    this._secondaryWorld._detach();
    if (this.#parentFrame) {
      this.#parentFrame._childFrames.delete(this);
    }
    this.#parentFrame = null;
  }
};
var TaskQueue = class {
  static {
    __name(this, "TaskQueue");
  }
  #chain;
  constructor() {
    this.#chain = Promise.resolve();
  }
  postTask(task) {
    const result = this.#chain.then(task);
    this.#chain = result.then(() => {
      return;
    }, () => {
      return;
    });
    return result;
  }
};
var DEFAULT_TIMEOUT = 3e4;
var TimeoutSettings = class {
  static {
    __name(this, "TimeoutSettings");
  }
  #defaultTimeout;
  #defaultNavigationTimeout;
  constructor() {
    this.#defaultTimeout = null;
    this.#defaultNavigationTimeout = null;
  }
  setDefaultTimeout(timeout) {
    this.#defaultTimeout = timeout;
  }
  setDefaultNavigationTimeout(timeout) {
    this.#defaultNavigationTimeout = timeout;
  }
  navigationTimeout() {
    if (this.#defaultNavigationTimeout !== null) {
      return this.#defaultNavigationTimeout;
    }
    if (this.#defaultTimeout !== null) {
      return this.#defaultTimeout;
    }
    return DEFAULT_TIMEOUT;
  }
  timeout() {
    if (this.#defaultTimeout !== null) {
      return this.#defaultTimeout;
    }
    return DEFAULT_TIMEOUT;
  }
};
var shouldHideWarning = /* @__PURE__ */ __name((log) => {
  if (log.text.includes("Mixed Content:") && log.text.includes("http://localhost:")) {
    return true;
  }
  return false;
}, "shouldHideWarning");
var format = /* @__PURE__ */ __name((eventType, args) => {
  const previewString = args.filter((a) => !(a.type === "symbol" && a.description?.includes(`__remotion_`))).map((a) => formatRemoteObject(a)).filter(Boolean).join(" ");
  let logLevelFromRemotionLog = null;
  let tag = null;
  for (const a of args) {
    if (a.type === "symbol" && a.description?.includes(`__remotion_level_`)) {
      logLevelFromRemotionLog = a.description?.split("__remotion_level_")?.[1]?.replace(")", "");
    }
    if (a.type === "symbol" && a.description?.includes(`__remotion_tag_`)) {
      tag = a.description?.split("__remotion_tag_")?.[1]?.replace(")", "");
    }
  }
  const logLevelFromEvent = eventType === "debug" ? "verbose" : eventType === "error" ? "error" : eventType === "warning" ? "warn" : "verbose";
  return { previewString, logLevelFromRemotionLog, logLevelFromEvent, tag };
}, "format");
var Page = class _Page extends EventEmitter {
  static {
    __name(this, "Page");
  }
  id;
  static async _create({
    client,
    target,
    defaultViewport,
    browser,
    sourceMapGetter,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    const page = new _Page({
      client,
      target,
      browser,
      sourceMapGetter,
      logLevel,
      indent,
      pageIndex,
      onBrowserLog,
      onLog
    });
    await page.#initialize();
    await page.setViewport(defaultViewport);
    return page;
  }
  closed = false;
  #client;
  #target;
  #timeoutSettings = new TimeoutSettings();
  #frameManager;
  #pageBindings = /* @__PURE__ */ new Map();
  browser;
  screenshotTaskQueue;
  sourceMapGetter;
  logLevel;
  indent;
  pageIndex;
  onBrowserLog;
  onLog;
  constructor({
    client,
    target,
    browser,
    sourceMapGetter,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    super();
    this.#client = client;
    this.#target = target;
    this.#frameManager = new FrameManager(client, this, indent, logLevel);
    this.screenshotTaskQueue = new TaskQueue();
    this.browser = browser;
    this.id = String(Math.random());
    this.sourceMapGetter = sourceMapGetter;
    this.logLevel = logLevel;
    this.indent = indent;
    this.pageIndex = pageIndex;
    this.onBrowserLog = onBrowserLog;
    this.onLog = onLog;
    client.on("Target.attachedToTarget", (event) => {
      switch (event.targetInfo.type) {
        case "iframe":
          break;
        case "worker":
          break;
        default:
          client.send("Target.detachFromTarget", {
            sessionId: event.sessionId
          }).catch((err) => Log.error({ indent, logLevel }, err));
      }
    });
    client.on("Runtime.consoleAPICalled", (event) => {
      return this.#onConsoleAPI(event);
    });
    client.on("Runtime.bindingCalled", (event) => {
      return this.#onBindingCalled(event);
    });
    client.on("Inspector.targetCrashed", () => {
      return this.#onTargetCrashed();
    });
    client.on("Log.entryAdded", (event) => {
      return this.#onLogEntryAdded(event);
    });
  }
  #onConsole = /* @__PURE__ */ __name((log) => {
    const stackTrace = log.stackTrace();
    const { url: url2, columnNumber, lineNumber } = stackTrace[0] ?? {};
    const logLevel = this.logLevel;
    const indent = this.indent;
    if (shouldHideWarning(log)) {
      return;
    }
    this.onBrowserLog?.({
      stackTrace,
      text: log.text,
      type: log.type
    });
    if (url2?.endsWith(NoReactInternals.bundleName) && lineNumber && this.sourceMapGetter()) {
      const origPosition = this.sourceMapGetter()?.originalPositionFor({
        column: columnNumber ?? 0,
        line: lineNumber
      });
      const file = [
        origPosition?.source,
        origPosition?.line,
        origPosition?.column
      ].filter(truthy).join(":");
      const isDelayRenderClear = log.previewString.includes(NoReactInternals.DELAY_RENDER_CLEAR_TOKEN);
      const tabInfo = `Tab ${this.pageIndex}`;
      const tagInfo = [origPosition?.name, isDelayRenderClear ? null : file].filter(truthy).join("@");
      const tag = [tabInfo, log.tag, log.tag ? null : tagInfo].filter(truthy).join(", ");
      this.onLog({
        logLevel: log.logLevel,
        tag,
        previewString: log.previewString
      });
    } else if (log.type === "error") {
      if (log.text.includes("Failed to load resource:")) {
        Log.error({ logLevel, tag: url2, indent }, log.text.replace(/\(\)$/, ""));
      } else {
        Log.error({ logLevel, tag: `console.${log.type}`, indent }, log.text);
      }
    } else {
      Log.verbose({ logLevel, tag: `console.${log.type}`, indent }, log.text);
    }
  }, "#onConsole");
  async #initialize() {
    await Promise.all([
      this.#frameManager.initialize(),
      this.#client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true
      }),
      this.#client.send("Performance.enable"),
      this.#client.send("Log.enable")
    ]);
  }
  on(eventName, handler) {
    return super.on(eventName, handler);
  }
  once(eventName, handler) {
    return super.once(eventName, handler);
  }
  off(eventName, handler) {
    return super.off(eventName, handler);
  }
  target() {
    return this.#target;
  }
  _client() {
    return this.#client;
  }
  #onTargetCrashed() {
    this.emit("error", new Error("Page crashed!"));
  }
  #onLogEntryAdded(event) {
    const { level, text, args, source, url: url2, lineNumber } = event.entry;
    if (args) {
      args.map((arg) => {
        return releaseObject(this.#client, arg);
      });
    }
    const { previewString, logLevelFromRemotionLog, logLevelFromEvent, tag } = format(level, args ?? []);
    if (source !== "worker") {
      const message = new ConsoleMessage({
        type: level,
        text,
        args: [],
        stackTraceLocations: [{ url: url2, lineNumber }],
        previewString,
        logLevel: logLevelFromRemotionLog ?? logLevelFromEvent,
        tag
      });
      this.onBrowserLog?.({
        stackTrace: message.stackTrace(),
        text: message.text,
        type: message.type
      });
      this.#onConsole(message);
    }
  }
  mainFrame() {
    return this.#frameManager.mainFrame();
  }
  async setViewport(viewport) {
    const fromSurface = !process.env.DISABLE_FROM_SURFACE;
    const request = fromSurface ? {
      mobile: false,
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      screenOrientation: {
        angle: 0,
        type: "portraitPrimary"
      }
    } : {
      mobile: false,
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      screenHeight: viewport.height,
      screenWidth: viewport.width,
      scale: viewport.deviceScaleFactor,
      viewport: {
        height: viewport.height * viewport.deviceScaleFactor,
        width: viewport.width * viewport.deviceScaleFactor,
        scale: 1,
        x: 0,
        y: 0
      }
    };
    const { value } = await this.#client.send("Emulation.setDeviceMetricsOverride", request);
    return value;
  }
  setDefaultNavigationTimeout(timeout) {
    this.#timeoutSettings.setDefaultNavigationTimeout(timeout);
  }
  setDefaultTimeout(timeout) {
    this.#timeoutSettings.setDefaultTimeout(timeout);
  }
  async evaluateHandle(pageFunction, ...args) {
    const context = await this.mainFrame().executionContext();
    return context.evaluateHandle(pageFunction, ...args);
  }
  #onConsoleAPI(event) {
    if (event.executionContextId === 0) {
      return;
    }
    const context = this.#frameManager.executionContextById(event.executionContextId, this.#client);
    const values = event.args.map((arg) => {
      return _createJSHandle(context, arg);
    });
    this.#addConsoleMessage(event.type, values, event.stackTrace);
  }
  async #onBindingCalled(event) {
    let payload;
    try {
      payload = JSON.parse(event.payload);
    } catch {
      return;
    }
    const { type, name, seq, args } = payload;
    if (type !== "exposedFun" || !this.#pageBindings.has(name)) {
      return;
    }
    let expression = null;
    try {
      const pageBinding = this.#pageBindings.get(name);
      assert(pageBinding);
      const result = await pageBinding(...args);
      expression = pageBindingDeliverResultString(name, seq, result);
    } catch (_error) {
      if (isErrorLike(_error)) {
        expression = pageBindingDeliverErrorString(name, seq, _error.message, _error.stack);
      } else {
        expression = pageBindingDeliverErrorValueString(name, seq, _error);
      }
    }
    await this.#client.send("Runtime.evaluate", {
      expression,
      contextId: event.executionContextId
    });
  }
  #addConsoleMessage(eventType, args, stackTrace) {
    const textTokens = [];
    for (const arg of args) {
      const remoteObject = arg._remoteObject;
      if (remoteObject.objectId) {
        textTokens.push(arg.toString());
      } else {
        textTokens.push(valueFromRemoteObject(remoteObject));
      }
    }
    const stackTraceLocations = [];
    if (stackTrace) {
      for (const callFrame of stackTrace.callFrames) {
        stackTraceLocations.push({
          url: callFrame.url,
          lineNumber: callFrame.lineNumber,
          columnNumber: callFrame.columnNumber
        });
      }
    }
    const { previewString, logLevelFromRemotionLog, logLevelFromEvent, tag } = format(eventType, args.map((a) => a._remoteObject) ?? []);
    const logLevel = logLevelFromRemotionLog ?? logLevelFromEvent;
    const message = new ConsoleMessage({
      type: eventType,
      text: textTokens.join(" "),
      args,
      stackTraceLocations,
      previewString,
      logLevel,
      tag
    });
    this.#onConsole(message);
  }
  url() {
    return this.mainFrame().url();
  }
  goto({
    url: url2,
    timeout,
    options = {}
  }) {
    return this.#frameManager.mainFrame().goto(url2, timeout, options);
  }
  async bringToFront() {
    await this.#client.send("Page.bringToFront");
  }
  async setAutoDarkModeOverride() {
    const result = await this.#client.send("Emulation.setEmulatedMedia", {
      media: "screen",
      features: [
        {
          name: "prefers-color-scheme",
          value: "dark"
        }
      ]
    });
    console.log(result);
  }
  evaluate(pageFunction, ...args) {
    return this.#frameManager.mainFrame().evaluate(pageFunction, ...args);
  }
  async evaluateOnNewDocument(pageFunction, ...args) {
    const source = evaluationString(pageFunction, ...args);
    await this.#client.send("Page.addScriptToEvaluateOnNewDocument", {
      source
    });
  }
  async close(options = { runBeforeUnload: void 0 }) {
    const connection = this.#client.connection();
    if (!connection) {
      return;
    }
    const runBeforeUnload = Boolean(options.runBeforeUnload);
    if (runBeforeUnload) {
      await this.#client.send("Page.close");
    } else {
      await connection.send("Target.closeTarget", {
        targetId: this.#target._targetId
      });
      await this.#target._isClosedPromise;
    }
  }
  setBrowserSourceMapGetter(context) {
    this.sourceMapGetter = context;
  }
};
var deleteDirectory = /* @__PURE__ */ __name((directory) => {
  if (isServeUrl(directory)) {
    return;
  }
  if (!existsSync(directory)) {
    return;
  }
  let retries = 2;
  while (retries >= 0) {
    try {
      fs4.rmSync(directory, {
        maxRetries: 2,
        recursive: true,
        force: true,
        retryDelay: 100
      });
    } catch {
      retries--;
      continue;
    }
    break;
  }
}, "deleteDirectory");
var ws = wrapper_default;
var NodeWebSocketTransport = class _NodeWebSocketTransport {
  static {
    __name(this, "NodeWebSocketTransport");
  }
  static async create(urlString) {
    const url2 = new URL2(urlString);
    if (url2.hostname === "localhost") {
      const { address } = await dns.lookup(url2.hostname, { verbatim: false });
      url2.hostname = address;
    }
    return new Promise((resolve3, reject) => {
      const ws2 = new ws(url2, [], {
        followRedirects: true,
        perMessageDeflate: false,
        maxPayload: 1024 * 1024 * 1024,
        headers: {
          "User-Agent": `Remotion CLI`
        }
      });
      ws2.addEventListener("open", () => {
        return resolve3(new _NodeWebSocketTransport(ws2));
      });
      ws2.addEventListener("error", reject);
    });
  }
  websocket;
  onmessage;
  onclose;
  constructor(ws2) {
    this.websocket = ws2;
    this.websocket.addEventListener("message", (event) => {
      if (this.onmessage) {
        this.onmessage.call(null, event.data);
      }
    });
    this.websocket.addEventListener("close", () => {
      if (this.onclose) {
        this.onclose.call(null);
      }
    });
    this.websocket.addEventListener("error", () => {
      return;
    });
  }
  send(message) {
    this.websocket.send(message);
  }
  close() {
    this.websocket.close();
  }
  forgetEventLoop() {
    this.websocket._socket.unref();
  }
  rememberEventLoop() {
    this.websocket._socket.ref();
  }
};
var parseBrowserLogMessage = /* @__PURE__ */ __name((input) => {
  const format2 = /^\[([0-9]{4})\/([0-9]{6})\.([0-9]{6}):([A-Z]+):(.*?)(?:\(([0-9]+)\)|:([0-9]+))\](.*)/;
  const match = input.match(format2);
  if (!match) {
    return null;
  }
  const date = match[1];
  const day = parseInt(date.slice(0, 2), 10);
  const month = parseInt(date.slice(2, 4), 10);
  const time = match[2];
  const hour = parseInt(time.slice(0, 2), 10);
  const minute = parseInt(time.slice(2, 4), 10);
  const seconds = parseInt(time.slice(4, 6), 10);
  const microseconds = parseInt(match[3], 10);
  const level = match[4];
  const location = match[5];
  const lineNumber = parseInt(match[6] ?? match[7], 10);
  const message = match[8].trim();
  return {
    day,
    month,
    hour,
    minute,
    seconds,
    microseconds,
    level,
    location,
    lineNumber,
    message
  };
}, "parseBrowserLogMessage");
var shouldLogBrowserMessage = /* @__PURE__ */ __name((message) => {
  if (message.startsWith("DevTools listening on")) {
    return false;
  }
  if (message.includes("Falling back to ALSA for audio output")) {
    return false;
  }
  if (message.includes("Floss manager not present, cannot set Floss enable/disable")) {
    return false;
  }
  if (message.includes("Failed to send GpuControl.CreateCommandBuffer")) {
    return false;
  }
  if (message.includes("CreatePlatformSocket() failed: Address family not supported by protocol")) {
    return false;
  }
  if (message.includes("Fontconfig error: No writable cache directories")) {
    return false;
  }
  if (message.includes("AttributionReportingCrossAppWeb cannot be enabled in this configuration")) {
    return false;
  }
  if (message.includes("Trying to Produce a Memory representation from a non-existent mailbox.")) {
    return false;
  }
  if (message.includes("Received HEADERS for invalid stream")) {
    return false;
  }
  if (message.includes("CVDisplayLinkCreateWithCGDisplay failed")) {
    return false;
  }
  if (message.includes("Falling back to ALSA for audio output")) {
    return false;
  }
  if (message.includes("VizNullHypothesis is disabled")) {
    return false;
  }
  return true;
}, "shouldLogBrowserMessage");
var formatChromeMessage = /* @__PURE__ */ __name((input) => {
  const parsed = parseBrowserLogMessage(input);
  if (!parsed) {
    return { output: input, tag: "chrome" };
  }
  const { location, lineNumber, message } = parsed;
  if (location === "CONSOLE") {
    return null;
  }
  return { output: `${location}:${lineNumber}: ${message}`, tag: "chrome" };
}, "formatChromeMessage");
var PROCESS_ERROR_EXPLANATION = `Puppeteer was unable to kill the process which ran the browser binary.
 This means that, on future Puppeteer launches, Puppeteer might not be able to launch the browser.
 Please check your open processes and ensure that the browser processes that Puppeteer launched have been killed.
 If you think this is a bug, please report it on the Puppeteer issue tracker.`;
var makeBrowserRunner = /* @__PURE__ */ __name(async ({
  executablePath,
  processArguments,
  userDataDir,
  logLevel,
  indent,
  timeout
}) => {
  const dumpio = isEqualOrBelowLogLevel(logLevel, "verbose");
  const stdio = dumpio ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"];
  const proc = childProcess.spawn(executablePath, processArguments, {
    detached: process.platform !== "win32",
    env: process.env,
    stdio
  });
  const browserWSEndpoint = await waitForWSEndpoint({
    browserProcess: proc,
    timeout,
    indent,
    logLevel
  });
  const transport = await NodeWebSocketTransport.create(browserWSEndpoint);
  const connection = new Connection(transport);
  const killProcess = /* @__PURE__ */ __name(() => {
    if (proc.pid && pidExists(proc.pid)) {
      try {
        if (process.platform === "win32") {
          childProcess.exec(`taskkill /pid ${proc.pid} /T /F`, (error) => {
            if (error) {
              proc.kill();
            }
          });
        } else {
          const processGroupId = -proc.pid;
          Log.verbose({ indent, logLevel }, `Trying to kill browser process group ${processGroupId}`);
          try {
            process.kill(processGroupId, "SIGKILL");
          } catch (error) {
            Log.verbose({ indent, logLevel }, `Could not kill browser process group ${processGroupId}. Killing process via Node.js API`);
            proc.kill("SIGKILL");
          }
        }
      } catch (error) {
        throw new Error(`${PROCESS_ERROR_EXPLANATION}
Error cause: ${isErrorLike(error) ? error.stack : error}`);
      }
    }
    deleteDirectory(userDataDir);
    removeEventListeners(listeners);
  }, "killProcess");
  const closeProcess = /* @__PURE__ */ __name(() => {
    if (closed) {
      return Promise.resolve();
    }
    Log.verbose({ indent, logLevel }, "Received SIGTERM signal. Killing browser process");
    killProcess();
    deleteDirectory(userDataDir);
    removeEventListeners(listeners);
    return processClosing;
  }, "closeProcess");
  if (dumpio) {
    proc.stdout?.on("data", (d) => {
      const message = d.toString("utf8").trim();
      if (shouldLogBrowserMessage(message)) {
        const formatted = formatChromeMessage(message);
        if (!formatted) {
          return;
        }
        const { output, tag } = formatted;
        Log.verbose({ indent, logLevel, tag }, output);
      }
    });
    proc.stderr?.on("data", (d) => {
      const message = d.toString("utf8").trim();
      if (shouldLogBrowserMessage(message)) {
        const formatted = formatChromeMessage(message);
        if (!formatted) {
          return;
        }
        const { output, tag } = formatted;
        Log.error({ indent, logLevel, tag }, output);
      }
    });
  }
  let closed = false;
  const processClosing = new Promise((fulfill, reject) => {
    proc.once("exit", () => {
      closed = true;
      try {
        fulfill();
      } catch (error) {
        reject(error);
      }
    });
  });
  const listeners = [addEventListener(process, "exit", killProcess)];
  listeners.push(addEventListener(process, "SIGINT", () => {
    killProcess();
    process.exit(130);
  }));
  listeners.push(addEventListener(process, "SIGTERM", closeProcess));
  listeners.push(addEventListener(process, "SIGHUP", closeProcess));
  const deleteBrowserCaches = /* @__PURE__ */ __name(() => {
    const cachePaths = [
      join(userDataDir, "Default", "Cache", "Cache_Data"),
      join(userDataDir, "Default", "Code Cache"),
      join(userDataDir, "Default", "DawnCache"),
      join(userDataDir, "Default", "GPUCache")
    ];
    for (const p of cachePaths) {
      deleteDirectory(p);
    }
  }, "deleteBrowserCaches");
  const rememberEventLoop = /* @__PURE__ */ __name(() => {
    proc.ref();
    proc.stdout?.ref();
    proc.stderr?.ref();
    assert(connection, "BrowserRunner not connected.");
    connection.transport.rememberEventLoop();
  }, "rememberEventLoop");
  const forgetEventLoop = /* @__PURE__ */ __name(() => {
    proc.unref();
    proc.stdout?.unref();
    proc.stderr?.unref();
    assert(connection, "BrowserRunner not connected.");
    connection.transport.forgetEventLoop();
  }, "forgetEventLoop");
  return {
    listeners,
    deleteBrowserCaches,
    forgetEventLoop,
    rememberEventLoop,
    connection,
    closeProcess
  };
}, "makeBrowserRunner");
function waitForWSEndpoint({
  browserProcess,
  timeout,
  logLevel,
  indent
}) {
  const browserStderr = browserProcess.stderr;
  const browserStdout = browserProcess.stdout;
  assert(browserStderr, "`browserProcess` does not have stderr.");
  assert(browserStdout, "`browserProcess` does not have stdout.");
  let stdioString = "";
  return new Promise((resolve3, reject) => {
    browserStderr.addListener("data", onStdIoData);
    browserStdout.addListener("data", onStdIoData);
    browserStderr.addListener("close", onClose);
    const listeners = [
      () => browserStderr.removeListener("data", onStdIoData),
      () => browserStdout.removeListener("data", onStdIoData),
      () => browserStderr.removeListener("close", onClose),
      addEventListener(browserProcess, "exit", (code, signal) => {
        Log.verbose({ indent, logLevel }, "Browser process exited with code", code, "signal", signal);
        return onClose(new Error(`Closed with ${code} signal: ${signal}`));
      }),
      addEventListener(browserProcess, "error", (error) => {
        return onClose(error);
      })
    ];
    const timeoutId = timeout ? setTimeout(onTimeout, timeout) : 0;
    function onClose(error) {
      cleanup();
      reject(new Error([
        "Failed to launch the browser process!",
        error ? error.stack : null,
        stdioString,
        "Troubleshooting: https://remotion.dev/docs/troubleshooting/browser-launch"
      ].filter(truthy).join(`
`)));
    }
    __name(onClose, "onClose");
    function onTimeout() {
      cleanup();
      reject(new TimeoutError(`Timed out after ${timeout} ms while trying to connect to the browser! Chrome logged the following: ${stdioString}`));
    }
    __name(onTimeout, "onTimeout");
    function onStdIoData(data) {
      stdioString += data.toString("utf8");
      const match = stdioString.match(/DevTools listening on (ws:\/\/.*)/);
      if (!match) {
        return;
      }
      cleanup();
      resolve3(match[1]);
    }
    __name(onStdIoData, "onStdIoData");
    function cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      removeEventListeners(listeners);
    }
    __name(cleanup, "cleanup");
  });
}
__name(waitForWSEndpoint, "waitForWSEndpoint");
function pidExists(pid) {
  try {
    return process.kill(pid, 0);
  } catch (error) {
    if (isErrnoException(error)) {
      if (error.code && error.code === "ESRCH") {
        return false;
      }
    }
    throw error;
  }
}
__name(pidExists, "pidExists");
var isPagetTarget = /* @__PURE__ */ __name((target) => {
  return target.type === "page" || target.type === "background_page" || target.type === "webview";
}, "isPagetTarget");
var Target = class {
  static {
    __name(this, "Target");
  }
  #browserContext;
  #targetInfo;
  #sessionFactory;
  #defaultViewport;
  #pagePromise;
  _initializedPromise;
  _initializedCallback;
  _isClosedPromise;
  _closedCallback;
  _isInitialized;
  _targetId;
  constructor(targetInfo, browserContext, sessionFactory, defaultViewport) {
    this.#targetInfo = targetInfo;
    this.#browserContext = browserContext;
    this._targetId = targetInfo.targetId;
    this.#sessionFactory = sessionFactory;
    this.#defaultViewport = defaultViewport;
    this._initializedPromise = new Promise((fulfill) => {
      this._initializedCallback = fulfill;
    }).then((success) => {
      if (!success) {
        return false;
      }
      const opener = this.opener();
      if (!opener || !opener.#pagePromise || this.type() !== "page") {
        return true;
      }
      return true;
    });
    this._isClosedPromise = new Promise((fulfill) => {
      this._closedCallback = fulfill;
    });
    this._isInitialized = !isPagetTarget(this.#targetInfo) || this.#targetInfo.url !== "";
    if (this._isInitialized) {
      this._initializedCallback(true);
    }
  }
  createCDPSession() {
    return this.#sessionFactory();
  }
  _getTargetInfo() {
    return this.#targetInfo;
  }
  async page({
    sourceMapGetter,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    if (isPagetTarget(this.#targetInfo) && !this.#pagePromise) {
      this.#pagePromise = this.#sessionFactory().then((client) => {
        return Page._create({
          client,
          target: this,
          defaultViewport: this.#defaultViewport ?? null,
          browser: this.browser(),
          sourceMapGetter,
          logLevel,
          indent,
          pageIndex,
          onBrowserLog,
          onLog
        });
      });
    }
    return await this.#pagePromise ?? null;
  }
  async expectPage() {
    return await this.#pagePromise ?? null;
  }
  url() {
    return this.#targetInfo.url;
  }
  type() {
    const { type } = this.#targetInfo;
    if (type === "page" || type === "background_page" || type === "service_worker" || type === "shared_worker" || type === "browser" || type === "webview") {
      return type;
    }
    return "other";
  }
  browser() {
    return this.#browserContext.browser();
  }
  browserContext() {
    return this.#browserContext;
  }
  opener() {
    const { openerId } = this.#targetInfo;
    if (!openerId) {
      return;
    }
    return this.browser()._targets.get(openerId);
  }
  _targetInfoChanged(targetInfo) {
    this.#targetInfo = targetInfo;
    if (!this._isInitialized && (!isPagetTarget(this.#targetInfo) || this.#targetInfo.url !== "")) {
      this._isInitialized = true;
      this._initializedCallback(true);
    }
  }
};
var HeadlessBrowser = class _HeadlessBrowser extends EventEmitter {
  static {
    __name(this, "HeadlessBrowser");
  }
  static async create({
    defaultViewport,
    timeout,
    userDataDir,
    args,
    executablePath,
    logLevel,
    indent
  }) {
    const runner = await makeBrowserRunner({
      executablePath,
      processArguments: args,
      userDataDir,
      indent,
      logLevel,
      timeout
    });
    const browser = new _HeadlessBrowser({
      connection: runner.connection,
      defaultViewport,
      runner
    });
    await runner.connection.send("Target.setDiscoverTargets", { discover: true });
    return browser;
  }
  #defaultViewport;
  connection;
  #defaultContext;
  #contexts;
  #targets;
  id;
  runner;
  get _targets() {
    return this.#targets;
  }
  constructor({
    connection,
    defaultViewport,
    runner
  }) {
    super();
    this.#defaultViewport = defaultViewport;
    this.connection = connection;
    this.id = Math.random().toString(36).substring(2, 15);
    this.#defaultContext = new BrowserContext(this);
    this.#contexts = /* @__PURE__ */ new Map();
    this.#targets = /* @__PURE__ */ new Map();
    this.connection.on("Target.targetCreated", this.#targetCreated.bind(this));
    this.connection.on("Target.targetDestroyed", this.#targetDestroyed.bind(this));
    this.connection.on("Target.targetInfoChanged", this.#targetInfoChanged.bind(this));
    this.runner = runner;
  }
  browserContexts() {
    return [this.#defaultContext, ...Array.from(this.#contexts.values())];
  }
  async #targetCreated(event) {
    const { targetInfo } = event;
    const { browserContextId } = targetInfo;
    const context = browserContextId && this.#contexts.has(browserContextId) ? this.#contexts.get(browserContextId) : this.#defaultContext;
    if (!context) {
      throw new Error("Missing browser context");
    }
    const target = new Target(targetInfo, context, () => {
      return this.connection.createSession(targetInfo);
    }, this.#defaultViewport ?? null);
    assert(!this.#targets.has(event.targetInfo.targetId), "Target should not exist before targetCreated");
    this.#targets.set(event.targetInfo.targetId, target);
    if (await target._initializedPromise) {
      this.emit("targetcreated", target);
    }
  }
  #targetDestroyed(event) {
    const target = this.#targets.get(event.targetId);
    if (!target) {
      throw new Error(`Missing target in _targetDestroyed (id = ${event.targetId})`);
    }
    target._initializedCallback(false);
    this.#targets.delete(event.targetId);
    target._closedCallback();
  }
  #targetInfoChanged(event) {
    const target = this.#targets.get(event.targetInfo.targetId);
    if (!target) {
      throw new Error(`Missing target in targetInfoChanged (id = ${event.targetInfo.targetId})`);
    }
    const previousURL = target.url();
    const wasInitialized = target._isInitialized;
    target._targetInfoChanged(event.targetInfo);
    if (wasInitialized && previousURL !== target.url()) {
      this.emit("targetchanged", target);
    }
  }
  newPage({
    context,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    return this.#defaultContext.newPage({
      context,
      logLevel,
      indent,
      pageIndex,
      onBrowserLog,
      onLog
    });
  }
  async _createPageInContext({
    context,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    const {
      value: { targetId }
    } = await this.connection.send("Target.createTarget", {
      url: "about:blank",
      browserContextId: void 0
    });
    const target = this.#targets.get(targetId);
    if (!target) {
      throw new Error(`Missing target for page (id = ${targetId})`);
    }
    const initialized = await target._initializedPromise;
    if (!initialized) {
      throw new Error(`Failed to create target for page (id = ${targetId})`);
    }
    const page = await target.page({
      sourceMapGetter: context,
      logLevel,
      indent,
      pageIndex,
      onBrowserLog,
      onLog
    });
    if (!page) {
      throw new Error(`Failed to create a page for context`);
    }
    return page;
  }
  targets() {
    return Array.from(this.#targets.values()).filter((target) => {
      return target._isInitialized;
    });
  }
  async waitForTarget(predicate, options = {}) {
    const { timeout = 3e4 } = options;
    let resolve3;
    let isResolved = false;
    const targetPromise = new Promise((x) => {
      resolve3 = x;
    });
    this.on("targetcreated", check);
    this.on("targetchanged", check);
    try {
      if (!timeout) {
        return await targetPromise;
      }
      this.targets().forEach(check);
      return await waitWithTimeout(targetPromise, "target", timeout, this);
    } finally {
      this.off("targetcreated", check);
      this.off("targetchanged", check);
    }
    async function check(target) {
      if (await predicate(target) && !isResolved) {
        isResolved = true;
        resolve3(target);
      }
    }
    __name(check, "check");
  }
  async pages() {
    const contextPages = await Promise.all(this.browserContexts().map((context) => {
      return context.pages();
    }));
    return contextPages.reduce((acc, x) => {
      return acc.concat(x);
    }, []);
  }
  async close({ silent }) {
    await this.runner.closeProcess();
    (await this.pages()).forEach((page) => {
      page.emit(
        "disposed"
        /* Disposed */
      );
      page.closed = true;
    });
    this.disconnect();
    this.emit(
      silent ? "closed-silent" : "closed"
      /* Closed */
    );
  }
  disconnect() {
    this.connection.dispose();
  }
};
var BrowserContext = class extends EventEmitter {
  static {
    __name(this, "BrowserContext");
  }
  #browser;
  constructor(browser) {
    super();
    this.#browser = browser;
  }
  targets() {
    return this.#browser.targets().filter((target) => {
      return target.browserContext() === this;
    });
  }
  waitForTarget(predicate, options = {}) {
    return this.#browser.waitForTarget((target) => {
      return target.browserContext() === this && predicate(target);
    }, options);
  }
  async pages() {
    const pages = await Promise.all(this.targets().filter((target) => target.type() === "page").map((target) => target.expectPage()));
    return pages.filter((page) => {
      return Boolean(page);
    });
  }
  newPage({
    context,
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  }) {
    return this.#browser._createPageInContext({
      context,
      logLevel,
      indent,
      pageIndex,
      onBrowserLog,
      onLog
    });
  }
  browser() {
    return this.#browser;
  }
};
var warned = false;
function isMusl({
  indent,
  logLevel
}) {
  if (!process.report && typeof Bun !== "undefined") {
    if (!warned) {
      Log.warn({ indent, logLevel }, "Bun limitation: Could not determine if your Linux is using musl or glibc. Assuming glibc.");
    }
    warned = true;
    return false;
  }
  const report = process.report?.getReport();
  if (report && typeof report === "string") {
    if (!warned) {
      Log.warn({ indent, logLevel }, "Bun limitation: Could not determine if your Windows is using musl or glibc. Assuming glibc.");
    }
    warned = true;
    return false;
  }
  const { glibcVersionRuntime } = report.header;
  return !glibcVersionRuntime;
}
__name(isMusl, "isMusl");
var getExecutablePath = /* @__PURE__ */ __name(({
  indent,
  logLevel,
  type,
  binariesDirectory
}) => {
  const base = binariesDirectory ?? getExecutableDir(indent, logLevel);
  switch (type) {
    case "compositor":
      if (process.platform === "win32") {
        return path4.resolve(base, "remotion.exe");
      }
      return path4.resolve(base, "remotion");
    case "ffmpeg":
      if (process.platform === "win32") {
        return path4.join(base, "ffmpeg.exe");
      }
      return path4.join(base, "ffmpeg");
    case "ffprobe":
      if (process.platform === "win32") {
        return path4.join(base, "ffprobe.exe");
      }
      return path4.join(base, "ffprobe");
    default:
      throw new Error(`Unknown executable type: ${type}`);
  }
}, "getExecutablePath");
var getExecutableDir = /* @__PURE__ */ __name((indent, logLevel) => {
  switch (process.platform) {
    case "win32":
      switch (process.arch) {
        case "x64":
          return __require2("@remotion/compositor-win32-x64-msvc").dir;
        default:
          throw new Error(`Unsupported architecture on Windows: ${process.arch}`);
      }
    case "darwin":
      switch (process.arch) {
        case "x64":
          return __require2("@remotion/compositor-darwin-x64").dir;
        case "arm64":
          return __require2("@remotion/compositor-darwin-arm64").dir;
        default:
          throw new Error(`Unsupported architecture on macOS: ${process.arch}`);
      }
    case "linux": {
      const musl = isMusl({ indent, logLevel });
      switch (process.arch) {
        case "x64":
          if (musl) {
            return __require2("@remotion/compositor-linux-x64-musl").dir;
          }
          return __require2("@remotion/compositor-linux-x64-gnu").dir;
        case "arm64":
          if (musl) {
            return __require2("@remotion/compositor-linux-arm64-musl").dir;
          }
          return __require2("@remotion/compositor-linux-arm64-gnu").dir;
        default:
          throw new Error(`Unsupported architecture on Linux: ${process.arch}`);
      }
    }
    default:
      throw new Error(`Unsupported OS: ${process.platform}, architecture: ${process.arch}`);
  }
}, "getExecutableDir");
var getExplicitEnv = /* @__PURE__ */ __name((cwd) => {
  return process.platform === "darwin" ? {
    DYLD_LIBRARY_PATH: cwd
  } : void 0;
}, "getExplicitEnv");
var hasPermissions = /* @__PURE__ */ __name((p) => {
  if (process.platform !== "linux" && process.platform !== "darwin") {
    try {
      accessSync(p, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
  const stats = statSync(p);
  const { mode } = stats;
  const othersHaveExecutePermission = Boolean(mode & 1);
  if (othersHaveExecutePermission) {
    return true;
  }
  if (!process.getuid || !process.getgid) {
    throw new Error("Cannot check permissions on Linux without process.getuid and process.getgid");
  }
  const uid = process.getuid();
  const gid = process.getgid();
  const isOwner = uid === stats.uid;
  const isGroup = gid === stats.gid;
  const ownerHasExecutePermission = Boolean(mode & 64);
  const groupHasExecutePermission = Boolean(mode & 8);
  const canExecute = isOwner && ownerHasExecutePermission || isGroup && groupHasExecutePermission;
  return canExecute;
}, "hasPermissions");
var makeFileExecutableIfItIsNot = /* @__PURE__ */ __name((path52) => {
  const hasPermissionsResult = hasPermissions(path52);
  if (!hasPermissionsResult) {
    chmodSync(path52, 493);
  }
}, "makeFileExecutableIfItIsNot");
var callFf = /* @__PURE__ */ __name(({
  args,
  bin,
  indent,
  logLevel,
  options,
  binariesDirectory,
  cancelSignal
}) => {
  const executablePath = getExecutablePath({
    type: bin,
    indent,
    logLevel,
    binariesDirectory
  });
  makeFileExecutableIfItIsNot(executablePath);
  const cwd = path5.dirname(executablePath);
  const task = (0, import_execa2.default)(executablePath, args.filter(truthy), {
    cwd,
    env: getExplicitEnv(cwd),
    ...options
  });
  cancelSignal?.(() => {
    task.kill();
  });
  return task;
}, "callFf");
var callFfNative = /* @__PURE__ */ __name(({
  args,
  bin,
  indent,
  logLevel,
  options,
  binariesDirectory,
  cancelSignal
}) => {
  const executablePath = getExecutablePath({
    type: bin,
    indent,
    logLevel,
    binariesDirectory
  });
  makeFileExecutableIfItIsNot(executablePath);
  const cwd = path5.dirname(executablePath);
  const task = spawn2(executablePath, args.filter(truthy), {
    cwd,
    env: getExplicitEnv(cwd),
    ...options
  });
  cancelSignal?.(() => {
    task.kill();
  });
  return task;
}, "callFfNative");
var isAudioCodec = /* @__PURE__ */ __name((codec) => {
  return codec === "mp3" || codec === "aac" || codec === "wav";
}, "isAudioCodec");
var canUseParallelEncoding = /* @__PURE__ */ __name((codec) => {
  if (getShouldUsePartitionedRendering()) {
    return false;
  }
  if (isAudioCodec(codec)) {
    return false;
  }
  return codec === "h264" || codec === "h264-mkv" || codec === "h265";
}, "canUseParallelEncoding");
var getShouldUsePartitionedRendering = /* @__PURE__ */ __name(() => {
  const shouldUsePartitionedRendering = process.env.REMOTION_PARTITIONED_RENDERING === "true";
  return shouldUsePartitionedRendering;
}, "getShouldUsePartitionedRendering");
var getRequiredLibCVersion = /* @__PURE__ */ __name(() => {
  if (process.platform !== "linux") {
    return null;
  }
  if (isMusl({ indent: false, logLevel: "warn" })) {
    return null;
  }
  if (process.arch === "arm64") {
    return [2, 26];
  }
  return [2, 31];
}, "getRequiredLibCVersion");
var required = getRequiredLibCVersion();
var gLibCErrorMessage = /* @__PURE__ */ __name((libCString) => {
  if (required === null) {
    return null;
  }
  const split = libCString.split(".");
  if (split.length !== 2) {
    return null;
  }
  if (split[0] === String(required[0]) && Number(split[1]) >= required[1]) {
    return null;
  }
  if (Number(split[0]) > required[0]) {
    return null;
  }
  return `Rendering videos requires glibc ${required.join(".")} on your or higher on your OS. Your system has glibc ${libCString}.`;
}, "gLibCErrorMessage");
var checkLibCRequirement = /* @__PURE__ */ __name((logLevel, indent) => {
  if (process.platform === "win32" || process.platform === "darwin") {
    return;
  }
  const { report } = process;
  if (report) {
    const rep = report.getReport();
    if (typeof rep === "string") {
      Log.warn({ logLevel, indent }, "Bun limitation: process.report.getReport() " + rep);
      return;
    }
    const { glibcVersionRuntime } = rep.header;
    if (!glibcVersionRuntime) {
      return;
    }
    const error = gLibCErrorMessage(glibcVersionRuntime);
    if (error) {
      Log.warn({ logLevel, indent }, error);
    }
  }
}, "checkLibCRequirement");
var checkNodeVersion = /* @__PURE__ */ __name(() => {
  const version = process.version.replace("v", "").split(".");
  const majorVersion = Number(version[0]);
  if (majorVersion < NoReactInternals.MIN_NODE_VERSION) {
    throw new Error(`Remotion requires at least Node ${NoReactInternals.MIN_NODE_VERSION}. You currently have ${process.version}. Update your node version to ${NoReactInternals.MIN_NODE_VERSION} to use Remotion.`);
  }
}, "checkNodeVersion");
var checkBunVersion = /* @__PURE__ */ __name(() => {
  if (!Bun.semver.satisfies(Bun.version, `>=${NoReactInternals.MIN_BUN_VERSION}`)) {
    throw new Error(`Remotion requires at least Bun ${NoReactInternals.MIN_BUN_VERSION}. You currently have ${Bun.version}. Update your Bun version to ${NoReactInternals.MIN_BUN_VERSION} to use Remotion.`);
  }
}, "checkBunVersion");
var MIN_DARWIN_VERSION = 22;
var MIN_MACOS_DISPLAY_VERSION = "13 (Ventura)";
var checkMacOSVersion = /* @__PURE__ */ __name((logLevel, indent) => {
  if (process.platform !== "darwin") {
    return;
  }
  const darwinRelease = os2.release();
  const majorVersion = Number(darwinRelease.split(".")[0]);
  if (Number.isNaN(majorVersion)) {
    return;
  }
  if (majorVersion < MIN_DARWIN_VERSION) {
    Log.warn({ logLevel, indent }, `Your macOS version is older than macOS ${MIN_MACOS_DISPLAY_VERSION}. Some features such as rendering may not work.`);
  }
}, "checkMacOSVersion");
var checkRuntimeVersion = /* @__PURE__ */ __name((logLevel, indent) => {
  if (typeof Bun === "undefined") {
    checkNodeVersion();
  } else {
    checkBunVersion();
  }
  checkMacOSVersion(logLevel, indent);
  checkLibCRequirement(logLevel, indent);
}, "checkRuntimeVersion");
var validCodecs = [
  "h264",
  "h265",
  "vp8",
  "vp9",
  "av1",
  "mp3",
  "aac",
  "wav",
  "prores",
  "h264-mkv",
  "h264-ts",
  "gif"
];
var DEFAULT_CODEC = "h264";
var convertToPositiveFrameIndex = /* @__PURE__ */ __name(({
  frame,
  durationInFrames
}) => {
  return frame < 0 ? durationInFrames + frame : frame;
}, "convertToPositiveFrameIndex");
function extractSourceMapUrl(fileContents) {
  const regex = /\/\/[#@] ?sourceMappingURL=([^\s'"]+)\s*$/gm;
  let match = null;
  for (; ; ) {
    const next = regex.exec(fileContents);
    if (next === null || next === void 0) {
      break;
    }
    match = next;
  }
  if (!match?.[1]) {
    return null;
  }
  return match[1].toString();
}
__name(extractSourceMapUrl, "extractSourceMapUrl");
var getSourceMapFromRemoteUrl = /* @__PURE__ */ __name(async (url2) => {
  if (!url2.endsWith(".js.map")) {
    return Promise.reject(new Error(`The URL ${url2} does not seem to be a valid source map URL.`));
  }
  const obj = await fetchUrl(url2);
  return new import_source_map.SourceMapConsumer(obj);
}, "getSourceMapFromRemoteUrl");
var getSourceMap = /* @__PURE__ */ __name((filePath, fileContents, type) => {
  const sm = extractSourceMapUrl(fileContents);
  if (sm === null) {
    return Promise.resolve(null);
  }
  if (sm.indexOf("data:") === 0) {
    const base64 = /^data:application\/json;([\w=:"-]+;)*base64,/;
    const match2 = sm.match(base64);
    if (!match2) {
      throw new Error("Sorry, non-base64 inline source-map encoding is not supported.");
    }
    const converted = window.atob(sm.substring(match2[0].length));
    try {
      const sourceMapConsumer = new import_source_map.SourceMapConsumer(JSON.parse(converted));
      return Promise.resolve(sourceMapConsumer);
    } catch {
      return Promise.resolve(null);
    }
  }
  if (type === "local") {
    const newFilePath = path6.join(path6.dirname(filePath), sm);
    return Promise.resolve(new import_source_map.SourceMapConsumer(readFileSync(newFilePath, "utf8")));
  }
  const index = filePath.lastIndexOf("/");
  const url2 = filePath.substring(0, index + 1) + sm;
  return getSourceMapFromRemoteUrl(url2);
}, "getSourceMap");
var fetchUrl = /* @__PURE__ */ __name(async (url2) => {
  const { request, response } = await readFile(url2);
  return new Promise((resolve3, reject) => {
    let downloaded = "";
    response.on("data", (d) => {
      downloaded += d;
    });
    response.on("end", () => {
      request.destroy();
      response.destroy();
      resolve3(downloaded);
    });
    response.on("error", (err) => {
      request.destroy();
      response.destroy();
      return reject(err);
    });
  });
}, "fetchUrl");
function getLinesAround(line, count, lines) {
  const result = [];
  for (let index = Math.max(0, line - 1 - count) + 1; index <= Math.min(lines.length - 1, line - 1 + count); ++index) {
    result.push({
      lineNumber: index + 1,
      content: lines[index],
      highlight: index + 1 === line
    });
  }
  return result;
}
__name(getLinesAround, "getLinesAround");
var getOriginalPosition = /* @__PURE__ */ __name((source_map, line, column) => {
  const result = source_map.originalPositionFor({
    line,
    column
  });
  return { line: result.line, column: result.column, source: result.source };
}, "getOriginalPosition");
var symbolicateStackTraceFromRemoteFrames = /* @__PURE__ */ __name(async (frames) => {
  const uniqueFileNames = [
    ...new Set(frames.map((f) => f.fileName).filter((f) => f.startsWith("http://") || f.startsWith("https://")).filter(truthy))
  ];
  const maps = await Promise.all(uniqueFileNames.map((fileName) => {
    return getSourceMapFromRemoteFile(fileName);
  }));
  const mapValues = {};
  for (let i = 0; i < uniqueFileNames.length; i++) {
    mapValues[uniqueFileNames[i]] = maps[i];
  }
  return symbolicateFromSources(frames, mapValues);
}, "symbolicateStackTraceFromRemoteFrames");
var symbolicateFromSources = /* @__PURE__ */ __name((frames, mapValues) => {
  return frames.map((frame) => {
    const map3 = mapValues[frame.fileName];
    if (!map3) {
      return null;
    }
    return symbolicateStackFrame(frame, map3);
  }).filter(truthy).filter((f) => f.originalScriptCode !== null);
}, "symbolicateFromSources");
var symbolicateStackFrame = /* @__PURE__ */ __name((frame, map3) => {
  const pos = getOriginalPosition(map3, frame.lineNumber, frame.columnNumber);
  const hasSource = pos.source ? map3.sourceContentFor(pos.source, false) : null;
  const scriptCode = hasSource && pos.line ? getLinesAround(pos.line, 3, hasSource.split(`
`)) : null;
  return {
    originalColumnNumber: pos.column,
    originalFileName: pos.source,
    originalFunctionName: frame.functionName,
    originalLineNumber: pos.line,
    originalScriptCode: scriptCode
  };
}, "symbolicateStackFrame");
var getSourceMapFromRemoteFile = /* @__PURE__ */ __name(async (fileName) => {
  const fileContents = await fetchUrl(fileName);
  return getSourceMap(fileName, fileContents, "remote");
}, "getSourceMapFromRemoteFile");
var getSourceMapFromLocalFile = /* @__PURE__ */ __name((fileName) => {
  const fileContents = readFileSync(fileName, "utf8");
  return getSourceMap(fileName, fileContents, "local");
}, "getSourceMapFromLocalFile");
var regexValidFrame_Chrome = /^\s*(at|in)\s.+(:\d+)/;
var regexValidFrame_FireFox = /(^|@)\S+:\d+|.+line\s+\d+\s+>\s+(eval|Function).+/;
var regexExtractLocation = /\(?(.+?)(?::(\d+))?(?::(\d+))?\)?$/;
function extractLocation(token) {
  const execed = regexExtractLocation.exec(token);
  if (!execed) {
    throw new Error("Could not match in extractLocation");
  }
  return execed.slice(1).map((v) => {
    const p = Number(v);
    if (!isNaN(p)) {
      return p;
    }
    return v;
  });
}
__name(extractLocation, "extractLocation");
var makeStackFrame = /* @__PURE__ */ __name(({
  functionName,
  fileName,
  lineNumber,
  columnNumber
}) => {
  if (functionName && functionName.indexOf("Object.") === 0) {
    functionName = functionName.slice("Object.".length);
  }
  if (functionName === "friendlySyntaxErrorLabel" || functionName === "exports.__esModule" || functionName === "<anonymous>" || !functionName) {
    functionName = null;
  }
  return {
    columnNumber,
    fileName,
    functionName,
    lineNumber
  };
}, "makeStackFrame");
var parseStack = /* @__PURE__ */ __name((stack) => {
  const frames = stack.filter((e) => regexValidFrame_Chrome.test(e) || regexValidFrame_FireFox.test(e)).map((e) => {
    if (regexValidFrame_FireFox.test(e)) {
      let isEval = false;
      if (/ > (eval|Function)/.test(e)) {
        e = e.replace(/ line (\d+)(?: > eval line \d+)* > (eval|Function):\d+:\d+/g, ":$1");
        isEval = true;
      }
      const _data = e.split(/[@]/g);
      const _last = _data.pop();
      if (!_last) {
        throw new Error("could not get last");
      }
      const [_fileName, _lineNumber, _columnNumber] = extractLocation(_last);
      return makeStackFrame({
        functionName: _data.join("@") || (isEval ? "eval" : null),
        fileName: _fileName,
        lineNumber: _lineNumber,
        columnNumber: _columnNumber
      });
    }
    if (e.indexOf("(eval ") !== -1) {
      e = e.replace(/(\(eval at [^()]*)|(\),.*$)/g, "");
    }
    if (e.indexOf("(at ") !== -1) {
      e = e.replace(/\(at /, "(");
    }
    const data = e.trim().split(/\s+/g).slice(1);
    const last = data.pop();
    if (!last) {
      throw new Error("could not get last");
    }
    const [fileName, lineNumber, columnNumber] = extractLocation(last);
    return makeStackFrame({
      functionName: data.join(" ") || null,
      fileName,
      lineNumber,
      columnNumber
    });
  });
  return frames;
}, "parseStack");
var parseDelayRenderEmbeddedStack = /* @__PURE__ */ __name((message) => {
  const index = message.indexOf(NoReactInternals.DELAY_RENDER_CALLSTACK_TOKEN);
  if (index === -1) {
    return null;
  }
  const msg = message.substring(index + NoReactInternals.DELAY_RENDER_CALLSTACK_TOKEN.length).trim();
  const parsed = parseStack(msg.split(`
`));
  return parsed;
}, "parseDelayRenderEmbeddedStack");
var SymbolicateableError = class extends Error {
  static {
    __name(this, "SymbolicateableError");
  }
  stackFrame;
  delayRenderCall;
  frame;
  chunk;
  constructor({
    message,
    stack,
    stackFrame,
    frame,
    name,
    chunk: chunk3
  }) {
    super(message);
    this.stack = stack;
    this.stackFrame = stackFrame;
    this.frame = frame;
    this.chunk = chunk3;
    this.name = name;
    this.delayRenderCall = stack ? parseDelayRenderEmbeddedStack(stack) : null;
  }
};
var ErrorWithStackFrame = class extends Error {
  static {
    __name(this, "ErrorWithStackFrame");
  }
  symbolicatedStackFrames;
  frame;
  chunk;
  name;
  delayRenderCall;
  constructor({
    message,
    symbolicatedStackFrames,
    frame,
    name,
    delayRenderCall,
    stack,
    chunk: chunk3
  }) {
    super(message);
    this.symbolicatedStackFrames = symbolicatedStackFrames;
    this.frame = frame;
    this.chunk = chunk3;
    this.name = name;
    this.delayRenderCall = delayRenderCall;
    this.stack = stack;
  }
};
var cleanUpErrorMessage = /* @__PURE__ */ __name((exception) => {
  let errorMessage = exception.exceptionDetails.exception?.description;
  if (!errorMessage) {
    return null;
  }
  const errorType = exception.exceptionDetails.exception?.className;
  const prefix = `${errorType}: `;
  if (errorMessage.startsWith(prefix)) {
    errorMessage = errorMessage.substring(prefix.length);
  }
  const frames = exception.exceptionDetails.stackTrace?.callFrames.length ?? 0;
  const split = errorMessage.split(`
`);
  return split.slice(0, Math.max(1, split.length - frames)).join(`
`);
}, "cleanUpErrorMessage");
var removeDelayRenderStack = /* @__PURE__ */ __name((message) => {
  const index = message.indexOf(NoReactInternals.DELAY_RENDER_CALLSTACK_TOKEN);
  if (index === -1) {
    return message;
  }
  return message.substring(0, index);
}, "removeDelayRenderStack");
var callFrameToStackFrame = /* @__PURE__ */ __name((callFrame) => {
  return {
    columnNumber: callFrame.columnNumber,
    fileName: callFrame.url,
    functionName: callFrame.functionName,
    lineNumber: callFrame.lineNumber
  };
}, "callFrameToStackFrame");
var handleJavascriptException = /* @__PURE__ */ __name(({
  page,
  onError,
  frame
}) => {
  const client = page._client();
  const handler = /* @__PURE__ */ __name((exception) => {
    const rawErrorMessage = exception.exceptionDetails.exception?.description;
    const cleanErrorMessage = cleanUpErrorMessage(exception);
    if (!cleanErrorMessage) {
      console.error(exception);
      const err = new Error(rawErrorMessage);
      err.stack = rawErrorMessage;
      onError(err);
      return;
    }
    if (!exception.exceptionDetails.stackTrace) {
      const err = new Error(removeDelayRenderStack(cleanErrorMessage));
      err.stack = rawErrorMessage;
      onError(err);
      return;
    }
    const errorType = exception.exceptionDetails.exception?.className;
    const symbolicatedErr = new SymbolicateableError({
      message: removeDelayRenderStack(cleanErrorMessage),
      stackFrame: exception.exceptionDetails.stackTrace.callFrames.map((f) => callFrameToStackFrame(f)),
      frame,
      name: errorType,
      stack: exception.exceptionDetails.exception?.description,
      chunk: null
    });
    onError(symbolicatedErr);
  }, "handler");
  client.on("Runtime.exceptionThrown", handler);
  return () => {
    client.off("Runtime.exceptionThrown", handler);
    return Promise.resolve();
  };
}, "handleJavascriptException");
var symbolicateError = /* @__PURE__ */ __name(async (symbolicateableError) => {
  const { delayRenderCall, stackFrame } = symbolicateableError;
  const [mainErrorFrames, delayRenderFrames] = await Promise.all([
    stackFrame ? symbolicateStackTraceFromRemoteFrames(stackFrame) : null,
    delayRenderCall ? symbolicateStackTraceFromRemoteFrames(delayRenderCall) : null
  ].filter(truthy));
  const symbolicatedErr = new ErrorWithStackFrame({
    message: symbolicateableError.message,
    symbolicatedStackFrames: mainErrorFrames,
    frame: symbolicateableError.frame,
    name: symbolicateableError.name,
    delayRenderCall: delayRenderFrames,
    stack: symbolicateableError.stack,
    chunk: symbolicateableError.chunk
  });
  return symbolicatedErr;
}, "symbolicateError");
var defaultFileExtensionMap = {
  "h264-mkv": {
    default: "mkv",
    forAudioCodec: {
      "pcm-16": { possible: ["mkv"], default: "mkv" },
      mp3: { possible: ["mkv"], default: "mkv" }
    }
  },
  "h264-ts": {
    default: "ts",
    forAudioCodec: {
      "pcm-16": { possible: ["ts"], default: "ts" },
      aac: { possible: ["ts"], default: "ts" }
    }
  },
  aac: {
    default: "aac",
    forAudioCodec: {
      aac: {
        possible: ["aac", "3gp", "m4a", "m4b", "mpg", "mpeg"],
        default: "aac"
      },
      "pcm-16": {
        possible: ["wav"],
        default: "wav"
      }
    }
  },
  gif: {
    default: "gif",
    forAudioCodec: {}
  },
  h264: {
    default: "mp4",
    forAudioCodec: {
      "pcm-16": { possible: ["mkv", "mov"], default: "mkv" },
      aac: { possible: ["mp4", "mkv", "mov"], default: "mp4" },
      mp3: { possible: ["mp4", "mkv", "mov"], default: "mp4" }
    }
  },
  h265: {
    default: "mp4",
    forAudioCodec: {
      aac: { possible: ["mp4", "mkv", "hevc"], default: "mp4" },
      "pcm-16": { possible: ["mkv"], default: "mkv" }
    }
  },
  av1: {
    default: "mp4",
    forAudioCodec: {
      aac: { possible: ["mp4", "mkv"], default: "mp4" },
      opus: { possible: ["webm", "mkv"], default: "webm" },
      "pcm-16": { possible: ["mkv"], default: "mkv" }
    }
  },
  mp3: {
    default: "mp3",
    forAudioCodec: {
      mp3: { possible: ["mp3"], default: "mp3" },
      "pcm-16": { possible: ["wav"], default: "wav" }
    }
  },
  prores: {
    default: "mov",
    forAudioCodec: {
      aac: { possible: ["mov", "mkv", "mxf"], default: "mov" },
      "pcm-16": { possible: ["mov", "mkv", "mxf"], default: "mov" }
    }
  },
  vp8: {
    default: "webm",
    forAudioCodec: {
      "pcm-16": { possible: ["mkv"], default: "mkv" },
      opus: { possible: ["webm"], default: "webm" }
    }
  },
  vp9: {
    default: "webm",
    forAudioCodec: {
      "pcm-16": { possible: ["mkv"], default: "mkv" },
      opus: { possible: ["webm"], default: "webm" }
    }
  },
  wav: {
    default: "wav",
    forAudioCodec: {
      "pcm-16": { possible: ["wav"], default: "wav" }
    }
  }
};
var validateFrameRange = /* @__PURE__ */ __name((frameRange) => {
  if (frameRange === null) {
    return;
  }
  if (typeof frameRange === "number") {
    if (frameRange < 0) {
      throw new TypeError("Frame must be a non-negative number, got " + frameRange);
    }
    if (!Number.isFinite(frameRange)) {
      throw new TypeError("Frame must be a finite number, got " + frameRange);
    }
    if (!Number.isInteger(frameRange)) {
      throw new Error(`Frame must be an integer, but got a float (${frameRange})`);
    }
    return;
  }
  if (Array.isArray(frameRange)) {
    if (frameRange.length !== 2) {
      throw new TypeError("Frame range must be a tuple, got an array with length " + frameRange.length);
    }
    const [first, second] = frameRange;
    if (typeof first !== "number") {
      throw new Error(`The first value of frame range must be a number, but got ${typeof first} (${JSON.stringify(first)})`);
    }
    if (!Number.isFinite(first)) {
      throw new TypeError("The first value of frame range must be finite, but got " + first);
    }
    if (!Number.isInteger(first)) {
      throw new Error(`The first value of frame range must be an integer, but got a float (${first})`);
    }
    if (first < 0) {
      throw new Error(`The first value of frame range must be non-negative, but got ${first}`);
    }
    if (second === null) {
      return;
    }
    if (typeof second !== "number") {
      throw new Error(`The second value of frame range must be a number or null, but got ${typeof second} (${JSON.stringify(second)})`);
    }
    if (!Number.isFinite(second)) {
      throw new TypeError("The second value of frame range must be finite, but got " + second);
    }
    if (!Number.isInteger(second)) {
      throw new Error(`The second value of frame range must be an integer, but got a float (${second})`);
    }
    if (second < 0) {
      throw new Error(`The second value of frame range must be non-negative, but got ${second}`);
    }
    if (second < first) {
      throw new Error("The second value of frame range must be not smaller than the first one, but got " + frameRange.join("-"));
    }
    return;
  }
  throw new TypeError("Frame range must be a number or a tuple of numbers, but got object of type " + typeof frameRange);
}, "validateFrameRange");
function toMegabytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb * 10) / 10} Mb`;
}
__name(toMegabytes, "toMegabytes");
var defaultBrowserDownloadProgress = /* @__PURE__ */ __name(({
  indent,
  logLevel,
  api
}) => ({ chromeMode }) => {
  if (chromeMode === "chrome-for-testing") {
    Log.info({ indent, logLevel }, "Downloading Chrome for Testing https://www.remotion.dev/chrome-for-testing");
  } else {
    Log.info({ indent, logLevel }, "Downloading Chrome Headless Shell https://www.remotion.dev/chrome-headless-shell");
  }
  Log.info({ indent, logLevel }, `Customize this behavior by adding a onBrowserDownload function to ${api}.`);
  let lastProgress = 0;
  return {
    onProgress: /* @__PURE__ */ __name((progress) => {
      if (progress.downloadedBytes > lastProgress + 1e7 || progress.percent === 1) {
        lastProgress = progress.downloadedBytes;
        if (chromeMode === "chrome-for-testing") {
          Log.info({ indent, logLevel }, `Downloading Chrome for Testing - ${toMegabytes(progress.downloadedBytes)}/${toMegabytes(progress.totalSizeInBytes)}`);
        } else {
          Log.info({ indent, logLevel }, `Downloading Chrome Headless Shell - ${toMegabytes(progress.downloadedBytes)}/${toMegabytes(progress.totalSizeInBytes)}`);
        }
      }
    }, "onProgress"),
    version: null
  };
}, "defaultBrowserDownloadProgress");
var defaultOnLog = /* @__PURE__ */ __name(({ logLevel, tag, previewString }) => {
  Log[logLevel]({ logLevel, tag, indent: false }, previewString);
}, "defaultOnLog");
var launchChrome = /* @__PURE__ */ __name(async ({
  args,
  executablePath,
  defaultViewport,
  indent,
  logLevel,
  userDataDir,
  timeout
}) => {
  const browser = await HeadlessBrowser.create({
    defaultViewport,
    args,
    executablePath,
    timeout,
    userDataDir,
    logLevel,
    indent
  });
  try {
    await browser.waitForTarget((t) => {
      return t.type() === "page";
    }, { timeout });
  } catch (error) {
    await browser.close({ silent: false });
    throw error;
  }
  return browser;
}, "launchChrome");
var TESTED_VERSION = "144.0.7559.20";
var PLAYWRIGHT_VERSION = "1207";
var isAmazonLinux2023 = /* @__PURE__ */ __name(() => {
  if (os3.platform() !== "linux") {
    return false;
  }
  try {
    const osRelease = fs5.readFileSync("/etc/os-release", "utf-8");
    return osRelease.includes("Amazon Linux") && osRelease.includes('VERSION="2023"');
  } catch {
    return false;
  }
}, "isAmazonLinux2023");
var MINIMUM_GLIBC_FOR_REMOTION_MEDIA = [2, 35];
var getGlibcVersion = /* @__PURE__ */ __name(() => {
  if (process.platform !== "linux") {
    return null;
  }
  const { report } = process;
  if (!report) {
    return null;
  }
  const rep = report.getReport();
  if (typeof rep === "string") {
    return null;
  }
  const { glibcVersionRuntime } = rep.header;
  if (!glibcVersionRuntime) {
    return null;
  }
  const split = glibcVersionRuntime.split(".");
  if (split.length !== 2) {
    return null;
  }
  return [Number(split[0]), Number(split[1])];
}, "getGlibcVersion");
var isGlibcVersionAtLeast = /* @__PURE__ */ __name((required2) => {
  const version = getGlibcVersion();
  if (version === null) {
    return false;
  }
  const [major, minor] = version;
  const [reqMajor, reqMinor] = required2;
  if (major > reqMajor) {
    return true;
  }
  if (major === reqMajor && minor >= reqMinor) {
    return true;
  }
  return false;
}, "isGlibcVersionAtLeast");
var canUseRemotionMediaBinaries = /* @__PURE__ */ __name(() => {
  if (process.platform !== "linux") {
    return false;
  }
  return isGlibcVersionAtLeast(MINIMUM_GLIBC_FOR_REMOTION_MEDIA);
}, "canUseRemotionMediaBinaries");
function getChromeDownloadUrl({
  platform: platform22,
  version,
  chromeMode
}) {
  if (platform22 === "linux-arm64") {
    if (isAmazonLinux2023() && chromeMode === "headless-shell" && !version) {
      return "https://remotion.media/chromium-headless-shell-amazon-linux-arm64-144.0.7559.20.zip";
    }
    if (chromeMode === "chrome-for-testing") {
      return `https://playwright.azureedge.net/builds/chromium/${version ?? PLAYWRIGHT_VERSION}/chromium-linux-arm64.zip`;
    }
    if (version) {
      return `https://playwright.azureedge.net/builds/chromium/${version}/chromium-headless-shell-linux-arm64.zip`;
    }
    if (canUseRemotionMediaBinaries()) {
      return `https://remotion.media/chromium-headless-shell-linux-arm64-${TESTED_VERSION}.zip?clearcache`;
    }
    return `https://playwright.azureedge.net/builds/chromium/${PLAYWRIGHT_VERSION}/chromium-headless-shell-linux-arm64.zip`;
  }
  if (chromeMode === "headless-shell") {
    if (isAmazonLinux2023() && platform22 === "linux64" && !version) {
      return `https://remotion.media/chromium-headless-shell-amazon-linux-x64-144.0.7559.20.zip`;
    }
    if (platform22 === "linux64" && version === null) {
      if (canUseRemotionMediaBinaries()) {
        return `https://remotion.media/chromium-headless-shell-linux-x64-${TESTED_VERSION}.zip?clearcache`;
      }
      return `https://storage.googleapis.com/chrome-for-testing-public/${TESTED_VERSION}/${platform22}/chrome-headless-shell-${platform22}.zip`;
    }
    return `https://storage.googleapis.com/chrome-for-testing-public/${version ?? TESTED_VERSION}/${platform22}/chrome-headless-shell-${platform22}.zip`;
  }
  return `https://storage.googleapis.com/chrome-for-testing-public/${version ?? TESTED_VERSION}/${platform22}/chrome-${platform22}.zip`;
}
__name(getChromeDownloadUrl, "getChromeDownloadUrl");
var logDownloadUrl = /* @__PURE__ */ __name(({
  url: url2,
  logLevel,
  indent
}) => {
  Log.info({ indent, logLevel }, `Downloading from: ${url2}`);
}, "logDownloadUrl");
var getDownloadsCacheDir = /* @__PURE__ */ __name(() => {
  const cwd = process.cwd();
  let dir = cwd;
  for (; ; ) {
    try {
      if (fs6.statSync(path7.join(dir, "package.json")).isFile()) {
        break;
      }
    } catch (e) {
    }
    const parent = path7.dirname(dir);
    if (dir === parent) {
      dir = void 0;
      break;
    }
    dir = parent;
  }
  if (!dir) {
    return path7.resolve(cwd, ".remotion");
  }
  if (process.versions.pnp === "1") {
    return path7.resolve(dir, ".pnp/.remotion");
  }
  if (process.versions.pnp === "3") {
    return path7.resolve(dir, ".yarn/.remotion");
  }
  return path7.resolve(dir, "node_modules/.remotion");
}, "getDownloadsCacheDir");
var mkdirAsync = fs7.promises.mkdir;
var unlinkAsync = promisify(fs7.unlink.bind(fs7));
function existsAsync(filePath) {
  return new Promise((resolve22) => {
    fs7.access(filePath, (err) => {
      return resolve22(!err);
    });
  });
}
__name(existsAsync, "existsAsync");
var getPlatform = /* @__PURE__ */ __name(() => {
  const platform3 = os4.platform();
  switch (platform3) {
    case "darwin":
      return os4.arch() === "arm64" ? "mac-arm64" : "mac-x64";
    case "linux":
      return os4.arch() === "arm64" ? "linux-arm64" : "linux64";
    case "win32":
      return "win64";
    default:
      throw new Error("Unsupported platform: " + platform3);
  }
}, "getPlatform");
var getDownloadsFolder = /* @__PURE__ */ __name((chromeMode) => {
  const destination = chromeMode === "headless-shell" ? "chrome-headless-shell" : "chrome-for-testing";
  return path8.join(getDownloadsCacheDir(), destination);
}, "getDownloadsFolder");
var getVersionFilePath = /* @__PURE__ */ __name((chromeMode) => {
  const downloadsFolder = getDownloadsFolder(chromeMode);
  return path8.join(downloadsFolder, "VERSION");
}, "getVersionFilePath");
var getExpectedVersion = /* @__PURE__ */ __name((version, _chromeMode) => {
  if (version) {
    return version;
  }
  return TESTED_VERSION;
}, "getExpectedVersion");
var readVersionFile = /* @__PURE__ */ __name((chromeMode) => {
  const versionFilePath = getVersionFilePath(chromeMode);
  try {
    return fs7.readFileSync(versionFilePath, "utf-8").trim();
  } catch {
    return null;
  }
}, "readVersionFile");
var writeVersionFile = /* @__PURE__ */ __name((chromeMode, version) => {
  const versionFilePath = getVersionFilePath(chromeMode);
  fs7.writeFileSync(versionFilePath, version);
}, "writeVersionFile");
var downloadBrowser = /* @__PURE__ */ __name(async ({
  logLevel,
  indent,
  onProgress,
  version,
  chromeMode
}) => {
  const platform3 = getPlatform();
  const downloadURL = getChromeDownloadUrl({ platform: platform3, version, chromeMode });
  const fileName = downloadURL.split("/").pop();
  if (!fileName) {
    throw new Error(`A malformed download URL was found: ${downloadURL}.`);
  }
  const downloadsFolder = getDownloadsFolder(chromeMode);
  const archivePath = path8.join(downloadsFolder, fileName);
  const outputPath = getFolderPath(downloadsFolder, platform3);
  const expectedVersion = getExpectedVersion(version, chromeMode);
  if (await existsAsync(outputPath)) {
    const installedVersion = readVersionFile(chromeMode);
    if (installedVersion === expectedVersion) {
      return getRevisionInfo(chromeMode);
    }
    fs7.rmSync(outputPath, { recursive: true, force: true });
  }
  if (!await existsAsync(downloadsFolder)) {
    await mkdirAsync(downloadsFolder, {
      recursive: true
    });
  }
  if (os4.platform() !== "darwin" && os4.platform() !== "linux" && os4.arch() === "arm64") {
    throw new Error([
      "Chrome Headless Shell is not available for Windows for arm64 architecture."
    ].join(`
`));
  }
  logDownloadUrl({ url: downloadURL, logLevel, indent });
  try {
    await downloadFile({
      url: downloadURL,
      to: /* @__PURE__ */ __name(() => archivePath, "to"),
      onProgress: /* @__PURE__ */ __name((progress) => {
        if (progress.totalSize === null || progress.percent === null) {
          throw new Error("Expected totalSize and percent to be defined");
        }
        onProgress({
          downloadedBytes: progress.downloaded,
          totalSizeInBytes: progress.totalSize,
          percent: progress.percent,
          alreadyAvailable: false
        });
      }, "onProgress"),
      indent,
      logLevel,
      abortSignal: new AbortController().signal
    });
    await (0, import_extract_zip.default)(archivePath, { dir: outputPath });
    const possibleSubdirs = [
      "chrome-linux",
      "chrome-headless-shell-linux64",
      "chromium-headless-shell-amazon-linux2023-arm64",
      "chromium-headless-shell-amazon-linux2023-x64"
    ];
    for (const subdir of possibleSubdirs) {
      const chromeLinuxFolder = path8.join(outputPath, subdir);
      const chromePath = path8.join(chromeLinuxFolder, "chrome");
      if (fs7.existsSync(chromePath)) {
        const chromeHeadlessShellPath = path8.join(chromeLinuxFolder, "chrome-headless-shell");
        fs7.renameSync(chromePath, chromeHeadlessShellPath);
      }
      if (fs7.existsSync(chromeLinuxFolder)) {
        const targetFolder = path8.join(outputPath, "chrome-headless-shell-" + platform3);
        if (chromeLinuxFolder !== targetFolder) {
          fs7.renameSync(chromeLinuxFolder, targetFolder);
        }
      }
    }
  } catch (err) {
    return Promise.reject(err);
  } finally {
    if (await existsAsync(archivePath)) {
      await unlinkAsync(archivePath);
    }
  }
  writeVersionFile(chromeMode, expectedVersion);
  const revisionInfo = getRevisionInfo(chromeMode);
  makeFileExecutableIfItIsNot(revisionInfo.executablePath);
  return revisionInfo;
}, "downloadBrowser");
var getFolderPath = /* @__PURE__ */ __name((downloadsFolder, platform3) => {
  return path8.resolve(downloadsFolder, platform3);
}, "getFolderPath");
var getExecutablePath2 = /* @__PURE__ */ __name((chromeMode) => {
  const downloadsFolder = getDownloadsFolder(chromeMode);
  const platform3 = getPlatform();
  const folderPath = getFolderPath(downloadsFolder, platform3);
  if (chromeMode === "chrome-for-testing") {
    if (platform3 === "mac-arm64" || platform3 === "mac-x64") {
      return path8.join(folderPath, `chrome-${platform3}`, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    }
    if (platform3 === "win64") {
      return path8.join(folderPath, "chrome-win64", "chrome.exe");
    }
    if (platform3 === "linux64" || platform3 === "linux-arm64") {
      return path8.join(folderPath, "chrome-linux64", "chrome");
    }
    throw new Error("unsupported platform" + platform3);
  }
  if (chromeMode === "headless-shell") {
    return path8.join(folderPath, `chrome-headless-shell-${platform3}`, platform3 === "win64" ? "chrome-headless-shell.exe" : platform3 === "linux-arm64" || isAmazonLinux2023() ? "headless_shell" : "chrome-headless-shell");
  }
  throw new Error("unsupported chrome mode" + chromeMode);
}, "getExecutablePath2");
var getRevisionInfo = /* @__PURE__ */ __name((chromeMode) => {
  const executablePath = getExecutablePath2(chromeMode);
  const downloadsFolder = getDownloadsFolder(chromeMode);
  const platform3 = getPlatform();
  const folderPath = getFolderPath(downloadsFolder, platform3);
  const url2 = getChromeDownloadUrl({ platform: platform3, version: null, chromeMode });
  const local = fs7.existsSync(folderPath);
  return {
    executablePath,
    folderPath,
    local,
    url: url2
  };
}, "getRevisionInfo");
var currentEnsureBrowserOperation = Promise.resolve();
var internalEnsureBrowserUncapped = /* @__PURE__ */ __name(async ({
  indent,
  logLevel,
  browserExecutable,
  onBrowserDownload,
  chromeMode
}) => {
  const status = getBrowserStatus({ browserExecutable, chromeMode });
  if (status.type === "version-mismatch") {
    const versionInfo = status.actualVersion ? ` (installed: ${status.actualVersion})` : "";
    Log.info({ indent, logLevel }, `This version of Remotion uses Chrome version ${TESTED_VERSION}, but the installed one differs${versionInfo}. Re-downloading.`);
  }
  if (status.type === "no-browser" || status.type === "version-mismatch") {
    const { onProgress, version } = onBrowserDownload({ chromeMode });
    await downloadBrowser({ indent, logLevel, onProgress, version, chromeMode });
  }
  const newStatus = getBrowserStatus({ browserExecutable, chromeMode });
  return newStatus;
}, "internalEnsureBrowserUncapped");
var internalEnsureBrowser = /* @__PURE__ */ __name((options) => {
  currentEnsureBrowserOperation = currentEnsureBrowserOperation.then(() => internalEnsureBrowserUncapped(options));
  return currentEnsureBrowserOperation;
}, "internalEnsureBrowser");
var getBrowserStatus = /* @__PURE__ */ __name(({
  browserExecutable,
  chromeMode
}) => {
  if (browserExecutable) {
    if (!fs8.existsSync(browserExecutable)) {
      throw new Error(`"browserExecutable" was specified as '${browserExecutable}' but the path doesn't exist. Pass "null" for "browserExecutable" to download a browser automatically.`);
    }
    return { path: browserExecutable, type: "user-defined-path" };
  }
  const revision = getRevisionInfo(chromeMode);
  if (revision.local && fs8.existsSync(revision.executablePath)) {
    const actualVersion = readVersionFile(chromeMode);
    if (actualVersion === TESTED_VERSION) {
      return { path: revision.executablePath, type: "local-puppeteer-browser" };
    }
    return { type: "version-mismatch", actualVersion };
  }
  return { type: "no-browser" };
}, "getBrowserStatus");
var ensureBrowser = /* @__PURE__ */ __name((options) => {
  const indent = false;
  const logLevel = options?.logLevel ?? "info";
  return internalEnsureBrowser({
    browserExecutable: options?.browserExecutable ?? null,
    indent,
    logLevel: options?.logLevel ?? "info",
    onBrowserDownload: options?.onBrowserDownload ?? defaultBrowserDownloadProgress({
      api: "ensureBrowser()",
      indent: false,
      logLevel
    }),
    chromeMode: options?.chromeMode ?? "headless-shell"
  });
}, "ensureBrowser");
var getBrowserStatus2 = /* @__PURE__ */ __name(({
  browserExecutablePath,
  indent,
  logLevel,
  chromeMode
}) => {
  if (browserExecutablePath) {
    if (!fs9.existsSync(browserExecutablePath)) {
      Log.warn({ indent, logLevel }, `Browser executable was specified as '${browserExecutablePath}' but the path doesn't exist.`);
    }
    return { path: browserExecutablePath, type: "user-defined-path" };
  }
  const revision = getRevisionInfo(chromeMode);
  if (revision.local && fs9.existsSync(revision.executablePath)) {
    return { path: revision.executablePath, type: "local-puppeteer-browser" };
  }
  return { type: "no-browser" };
}, "getBrowserStatus2");
var getLocalBrowserExecutable = /* @__PURE__ */ __name(({
  preferredBrowserExecutable,
  logLevel,
  indent,
  chromeMode
}) => {
  const status = getBrowserStatus2({
    browserExecutablePath: preferredBrowserExecutable,
    indent,
    logLevel,
    chromeMode
  });
  if (status.type === "no-browser" || status.type === "version-mismatch") {
    throw new TypeError("No browser found for rendering frames! Please open a GitHub issue and describe how you reached this error: https://remotion.dev/issue");
  }
  return status.path;
}, "getLocalBrowserExecutable");
var nprocCount;
var getConcurrencyFromNProc = /* @__PURE__ */ __name(() => {
  if (nprocCount !== void 0) {
    return nprocCount;
  }
  try {
    const count = parseInt(execSync2("nproc", { stdio: "pipe" }).toString().trim(), 10);
    nprocCount = count;
    return count;
  } catch {
    return null;
  }
}, "getConcurrencyFromNProc");
var getNodeCpuCount = /* @__PURE__ */ __name(() => {
  if (typeof os5.availableParallelism === "function") {
    return os5.availableParallelism();
  }
  return os5.cpus().length;
}, "getNodeCpuCount");
var getCpuCount = /* @__PURE__ */ __name(() => {
  const node = getNodeCpuCount();
  const nproc = getConcurrencyFromNProc();
  if (nproc === null) {
    return node;
  }
  return Math.min(nproc, node);
}, "getCpuCount");
var getMaxMemoryFromCgroupV2 = /* @__PURE__ */ __name(() => {
  try {
    const data = readFileSync4("/sys/fs/cgroup/memory.max", "utf-8");
    if (data.trim() === "max") {
      return Infinity;
    }
    return parseInt(data, 10);
  } catch {
    return null;
  }
}, "getMaxMemoryFromCgroupV2");
var getAvailableMemoryFromCgroupV2 = /* @__PURE__ */ __name(() => {
  try {
    const data = readFileSync4("/sys/fs/cgroup/memory.current", "utf-8");
    return parseInt(data, 10);
  } catch {
    return null;
  }
}, "getAvailableMemoryFromCgroupV2");
var getMaxMemoryFromCgroupV1 = /* @__PURE__ */ __name(() => {
  try {
    const data = readFileSync4("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf-8");
    if (data.trim() === "max") {
      return Infinity;
    }
    return parseInt(data, 10);
  } catch {
    return null;
  }
}, "getMaxMemoryFromCgroupV1");
var getAvailableMemoryFromCgroupV1 = /* @__PURE__ */ __name(() => {
  try {
    const data = readFileSync4("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf-8");
    return parseInt(data, 10);
  } catch {
    return null;
  }
}, "getAvailableMemoryFromCgroupV1");
var getAvailableMemoryFromCgroup = /* @__PURE__ */ __name(() => {
  const maxMemoryV2 = getMaxMemoryFromCgroupV2();
  if (maxMemoryV2 !== null) {
    const availableMemoryV2 = getAvailableMemoryFromCgroupV2();
    if (availableMemoryV2 !== null) {
      return maxMemoryV2 - availableMemoryV2;
    }
  }
  const maxMemoryV1 = getMaxMemoryFromCgroupV1();
  if (maxMemoryV1 !== null) {
    const availableMemoryV1 = getAvailableMemoryFromCgroupV1();
    if (availableMemoryV1 !== null) {
      return maxMemoryV1 - availableMemoryV1;
    }
  }
  return null;
}, "getAvailableMemoryFromCgroup");
var getMaxLambdaMemory = /* @__PURE__ */ __name(() => {
  if (process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) {
    return parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE, 10) * 1024 * 1024;
  }
  return null;
}, "getMaxLambdaMemory");
var getFreeMemoryFromProcMeminfo = /* @__PURE__ */ __name((logLevel) => {
  if (!existsSync3("/proc/meminfo")) {
    return null;
  }
  try {
    const data = readFileSync5("/proc/meminfo", "utf-8");
    const lines = data.split(`
`);
    const memAvailableLine = lines.find((line) => line.startsWith("MemAvailable"));
    if (!memAvailableLine) {
      throw new Error("MemAvailable not found in /proc/meminfo");
    }
    const matches = memAvailableLine.match(/(\d+)\s+(\w+)/);
    if (!matches || matches.length !== 3) {
      throw new Error("Failed to parse MemAvailable value");
    }
    const value = parseInt(matches[1], 10);
    const unit = matches[2].toLowerCase();
    switch (unit) {
      case "kb":
        return value * 1024;
      case "mb":
        return value * 1024 * 1024;
      case "gb":
        return value * 1024 * 1024 * 1024;
      default:
        throw new Error(`Unknown unit: ${unit}`);
    }
  } catch (err) {
    Log.warn({ indent: false, logLevel }, "/proc/meminfo exists but failed to get memory info. Error:");
    Log.warn({ indent: false, logLevel }, err);
    return null;
  }
}, "getFreeMemoryFromProcMeminfo");
var getAvailableMemory = /* @__PURE__ */ __name((logLevel) => {
  const maxMemory = getMaxLambdaMemory();
  if (maxMemory !== null) {
    const nodeMemory = freemem();
    return Math.min(nodeMemory, maxMemory);
  }
  const cgroupMemory = getAvailableMemoryFromCgroup();
  if (cgroupMemory !== null) {
    const nodeMemory = freemem();
    const _procInfo = getFreeMemoryFromProcMeminfo(logLevel);
    if (cgroupMemory > nodeMemory * 1.25 && Number.isFinite(cgroupMemory)) {
      Log.warn({ indent: false, logLevel }, "Detected differing memory amounts:");
      Log.warn({ indent: false, logLevel }, `Memory reported by CGroup: ${(cgroupMemory / 1024 / 1024).toFixed(2)} MB`);
      if (_procInfo !== null) {
        Log.warn({ indent: false, logLevel }, `Memory reported by /proc/meminfo: ${(_procInfo / 1024 / 1024).toFixed(2)} MB`);
      }
      Log.warn({ indent: false, logLevel }, `Memory reported by Node: ${(nodeMemory / 1024 / 1024).toFixed(2)} MB`);
      Log.warn({ indent: false, logLevel }, "You might have inadvertenly set the --memory flag of `docker run` to a value that is higher than the global Docker memory limit.");
      Log.warn({ indent: false, logLevel }, "Using the lower amount of memory for calculation.");
    }
    return Math.min(nodeMemory, cgroupMemory);
  }
  const procInfo = getFreeMemoryFromProcMeminfo(logLevel);
  if (procInfo !== null) {
    return Math.min(freemem(), procInfo);
  }
  return freemem();
}, "getAvailableMemory");
var MEMORY_USAGE_PER_THREAD = 4e8;
var RESERVED_MEMORY = 2e9;
var getIdealVideoThreadsFlag = /* @__PURE__ */ __name((logLevel) => {
  const freeMemory = getAvailableMemory(logLevel);
  const cpus = getCpuCount();
  const maxRecommendedBasedOnCpus = cpus * 2 / 3;
  const maxRecommendedBasedOnMemory = (freeMemory - RESERVED_MEMORY) / MEMORY_USAGE_PER_THREAD;
  const maxRecommended = Math.min(maxRecommendedBasedOnCpus, maxRecommendedBasedOnMemory);
  return Math.max(1, Math.round(maxRecommended));
}, "getIdealVideoThreadsFlag");
var validOpenGlRenderers = [
  "swangle",
  "angle",
  "egl",
  "swiftshader",
  "vulkan",
  "angle-egl"
];
var DEFAULT_OPENGL_RENDERER = null;
var validateOpenGlRenderer = /* @__PURE__ */ __name((option) => {
  if (option === null) {
    return null;
  }
  if (!validOpenGlRenderers.includes(option)) {
    throw new TypeError(`${option} is not a valid GL backend. Accepted values: ${validOpenGlRenderers.join(", ")}`);
  }
  return option;
}, "validateOpenGlRenderer");
var featuresToEnable = /* @__PURE__ */ __name((option) => {
  const renderer = option ?? DEFAULT_OPENGL_RENDERER;
  const enableAlways = ["NetworkService", "NetworkServiceInProcess"];
  if (renderer === "vulkan") {
    return [...enableAlways, "Vulkan", "UseSkiaRenderer"];
  }
  if (renderer === "angle-egl") {
    return [...enableAlways, "VaapiVideoDecoder"];
  }
  return enableAlways;
}, "featuresToEnable");
var getOpenGlRenderer = /* @__PURE__ */ __name((option) => {
  const renderer = option ?? DEFAULT_OPENGL_RENDERER;
  validateOpenGlRenderer(renderer);
  if (renderer === "swangle") {
    return ["--use-gl=angle", "--use-angle=swiftshader"];
  }
  if (renderer === "angle-egl") {
    return ["--use-gl=angle", "--use-angle=gl-egl"];
  }
  if (renderer === "vulkan") {
    return [
      "--use-angle=vulkan",
      "--use-vulkan=native",
      "--disable-vulkan-fallback-to-gl-for-testing",
      "--disable-vulkan-surface",
      "--ignore-gpu-blocklist",
      "--enable-gpu"
    ];
  }
  if (renderer === null) {
    return [];
  }
  return [`--use-gl=${renderer}`];
}, "getOpenGlRenderer");
var internalOpenBrowser = /* @__PURE__ */ __name(async ({
  browser,
  browserExecutable,
  chromiumOptions,
  forceDeviceScaleFactor,
  indent,
  viewport,
  logLevel,
  onBrowserDownload,
  chromeMode
}) => {
  if (browser === "firefox") {
    throw new TypeError("Firefox supported is not yet turned on. Stay tuned for the future.");
  }
  Log.verbose({ indent, logLevel }, "Ensuring browser executable");
  await internalEnsureBrowser({
    browserExecutable,
    logLevel,
    indent,
    onBrowserDownload,
    chromeMode
  });
  Log.verbose({ indent, logLevel }, "Ensured browser is available.");
  const executablePath = getLocalBrowserExecutable({
    preferredBrowserExecutable: browserExecutable,
    logLevel,
    indent,
    chromeMode
  });
  const customGlRenderer = getOpenGlRenderer(chromiumOptions.gl ?? null);
  const enableMultiProcessOnLinux = chromiumOptions.enableMultiProcessOnLinux ?? true;
  Log.verbose({ indent, logLevel, tag: "openBrowser()" }, `Opening browser: gl = ${chromiumOptions.gl}, executable = ${executablePath}, enableMultiProcessOnLinux = ${enableMultiProcessOnLinux}`);
  if (chromiumOptions.userAgent) {
    Log.verbose({ indent, logLevel, tag: "openBrowser()" }, `Using custom user agent: ${chromiumOptions.userAgent}`);
  }
  const userDataDir = await fs10.promises.mkdtemp(path9.join(os6.tmpdir(), "puppeteer_dev_chrome_profile-"));
  const browserInstance = await launchChrome({
    executablePath,
    logLevel,
    indent,
    userDataDir,
    timeout: 25e3,
    args: [
      "about:blank",
      "--allow-pre-commit-input",
      "--disable-background-networking",
      `--enable-features=${featuresToEnable(chromiumOptions.gl).join(",")}`,
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-client-side-phishing-detection",
      "--disable-component-extensions-with-background-pages",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--no-proxy-server",
      "--proxy-server='direct://'",
      "--proxy-bypass-list=*",
      "--force-gpu-mem-available-mb=4096",
      "--disable-hang-monitor",
      "--disable-extensions",
      "--allow-chrome-scheme-url",
      "--disable-ipc-flooding-protection",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-renderer-backgrounding",
      "--disable-sync",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
      `--video-threads=${getIdealVideoThreadsFlag(logLevel)}`,
      "--enable-automation",
      "--password-store=basic",
      "--use-mock-keychain",
      "--enable-blink-features=IdleDetection",
      "--export-tagged-pdf",
      "--intensive-wake-up-throttling-policy=0",
      chromiumOptions.headless ?? true ? chromeMode === "chrome-for-testing" ? "--headless=new" : "--headless=old" : null,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      ...customGlRenderer,
      "--disable-background-media-suspend",
      process.platform === "linux" && chromiumOptions.gl !== "vulkan" && !enableMultiProcessOnLinux ? "--single-process" : null,
      "--allow-running-insecure-content",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process,Translate,BackForwardCache,AvoidUnnecessaryBeforeUnloadCheckSync,IntensiveWakeUpThrottling,LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults",
      "--disable-print-preview",
      "--disable-site-isolation-trials",
      "--disk-cache-size=268435456",
      "--hide-scrollbars",
      "--no-default-browser-check",
      "--no-pings",
      "--font-render-hinting=none",
      "--no-zygote",
      "--ignore-gpu-blocklist",
      "--enable-unsafe-webgpu",
      typeof forceDeviceScaleFactor === "undefined" ? null : `--force-device-scale-factor=${forceDeviceScaleFactor}`,
      chromiumOptions.ignoreCertificateErrors ? "--ignore-certificate-errors" : null,
      ...chromiumOptions?.disableWebSecurity ? ["--disable-web-security"] : [],
      chromiumOptions?.userAgent ? `--user-agent="${chromiumOptions.userAgent}"` : null,
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`
    ].filter(Boolean),
    defaultViewport: viewport ?? {
      height: 720,
      width: 1280,
      deviceScaleFactor: 1
    }
  });
  const pages = await browserInstance.pages();
  await pages[0]?.close();
  return browserInstance;
}, "internalOpenBrowser");
var openBrowser = /* @__PURE__ */ __name((browser, options) => {
  const { browserExecutable, chromiumOptions, forceDeviceScaleFactor } = options ?? {};
  const indent = false;
  const logLevel = options?.logLevel ?? (options?.shouldDumpIo ? "verbose" : "info");
  return internalOpenBrowser({
    browser,
    browserExecutable: browserExecutable ?? null,
    chromiumOptions: chromiumOptions ?? {},
    forceDeviceScaleFactor,
    indent,
    viewport: null,
    logLevel,
    onBrowserDownload: defaultBrowserDownloadProgress({
      indent,
      logLevel,
      api: "openBrowser()"
    }),
    chromeMode: options?.chromeMode ?? "headless-shell"
  });
}, "openBrowser");
var getPageAndCleanupFn = /* @__PURE__ */ __name(async ({
  passedInInstance,
  browserExecutable,
  chromiumOptions,
  forceDeviceScaleFactor,
  indent,
  logLevel,
  onBrowserDownload,
  chromeMode,
  pageIndex,
  onBrowserLog,
  onLog
}) => {
  if (passedInInstance) {
    const page = await passedInInstance.newPage({
      context: /* @__PURE__ */ __name(() => null, "context"),
      logLevel,
      indent,
      pageIndex,
      onBrowserLog,
      onLog
    });
    return {
      page,
      cleanupPage: /* @__PURE__ */ __name(() => {
        page.close().catch((err) => {
          if (!err.message.includes("Target closed")) {
            Log.error({ indent, logLevel }, "Was not able to close puppeteer page", err);
          }
        });
        return Promise.resolve();
      }, "cleanupPage")
    };
  }
  const browserInstance = await internalOpenBrowser({
    browser: DEFAULT_BROWSER,
    browserExecutable,
    chromiumOptions,
    forceDeviceScaleFactor,
    indent,
    viewport: null,
    logLevel,
    onBrowserDownload,
    chromeMode
  });
  const browserPage = await browserInstance.newPage({
    context: /* @__PURE__ */ __name(() => null, "context"),
    logLevel,
    indent,
    pageIndex,
    onBrowserLog,
    onLog
  });
  return {
    page: browserPage,
    cleanupPage: /* @__PURE__ */ __name(() => {
      browserInstance.close({ silent: true }).catch((err) => {
        if (!err.message.includes("Target closed")) {
          Log.error({ indent, logLevel }, "Was not able to close puppeteer page", err);
        }
      });
      return Promise.resolve();
    }, "cleanupPage")
  };
}, "getPageAndCleanupFn");
var DEFAULT_RENDER_FRAMES_OFFTHREAD_VIDEO_THREADS = 2;
var compressAsset = /* @__PURE__ */ __name((previousRenderAssets, newRenderAsset) => {
  if (newRenderAsset.src.length < 400) {
    return newRenderAsset;
  }
  const assetWithSameSrc = previousRenderAssets.find((a) => a.src === newRenderAsset.src);
  if (!assetWithSameSrc) {
    return newRenderAsset;
  }
  return {
    ...newRenderAsset,
    src: `same-as-${assetWithSameSrc.id}-${assetWithSameSrc.frame}`
  };
}, "compressAsset");
var isAssetCompressed = /* @__PURE__ */ __name((src) => {
  return src.startsWith("same-as");
}, "isAssetCompressed");
var mimeDb = {
  "application/1d-interleaved-parityfec": {
    source: "iana"
  },
  "application/3gpdash-qoe-report+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/3gpp-ims+xml": {
    source: "iana",
    compressible: true
  },
  "application/3gpphal+json": {
    source: "iana",
    compressible: true
  },
  "application/3gpphalforms+json": {
    source: "iana",
    compressible: true
  },
  "application/a2l": {
    source: "iana"
  },
  "application/ace+cbor": {
    source: "iana"
  },
  "application/ace+json": {
    source: "iana",
    compressible: true
  },
  "application/activemessage": {
    source: "iana"
  },
  "application/activity+json": {
    source: "iana",
    compressible: true
  },
  "application/aif+cbor": {
    source: "iana"
  },
  "application/aif+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-cdni+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-cdnifilter+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-costmap+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-costmapfilter+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-directory+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-endpointcost+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-endpointcostparams+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-endpointprop+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-endpointpropparams+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-error+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-networkmap+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-networkmapfilter+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-propmap+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-propmapparams+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-updatestreamcontrol+json": {
    source: "iana",
    compressible: true
  },
  "application/alto-updatestreamparams+json": {
    source: "iana",
    compressible: true
  },
  "application/aml": {
    source: "iana"
  },
  "application/andrew-inset": {
    source: "iana",
    extensions: ["ez"]
  },
  "application/applefile": {
    source: "iana"
  },
  "application/applixware": {
    source: "apache",
    extensions: ["aw"]
  },
  "application/at+jwt": {
    source: "iana"
  },
  "application/atf": {
    source: "iana"
  },
  "application/atfx": {
    source: "iana"
  },
  "application/atom+xml": {
    source: "iana",
    compressible: true,
    extensions: ["atom"]
  },
  "application/atomcat+xml": {
    source: "iana",
    compressible: true,
    extensions: ["atomcat"]
  },
  "application/atomdeleted+xml": {
    source: "iana",
    compressible: true,
    extensions: ["atomdeleted"]
  },
  "application/atomicmail": {
    source: "iana"
  },
  "application/atomsvc+xml": {
    source: "iana",
    compressible: true,
    extensions: ["atomsvc"]
  },
  "application/atsc-dwd+xml": {
    source: "iana",
    compressible: true,
    extensions: ["dwd"]
  },
  "application/atsc-dynamic-event-message": {
    source: "iana"
  },
  "application/atsc-held+xml": {
    source: "iana",
    compressible: true,
    extensions: ["held"]
  },
  "application/atsc-rdt+json": {
    source: "iana",
    compressible: true
  },
  "application/atsc-rsat+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rsat"]
  },
  "application/atxml": {
    source: "iana"
  },
  "application/auth-policy+xml": {
    source: "iana",
    compressible: true
  },
  "application/bacnet-xdd+zip": {
    source: "iana",
    compressible: false
  },
  "application/batch-smtp": {
    source: "iana"
  },
  "application/bdoc": {
    compressible: false,
    extensions: ["bdoc"]
  },
  "application/beep+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/calendar+json": {
    source: "iana",
    compressible: true
  },
  "application/calendar+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xcs"]
  },
  "application/call-completion": {
    source: "iana"
  },
  "application/cals-1840": {
    source: "iana"
  },
  "application/captive+json": {
    source: "iana",
    compressible: true
  },
  "application/cbor": {
    source: "iana"
  },
  "application/cbor-seq": {
    source: "iana"
  },
  "application/cccex": {
    source: "iana"
  },
  "application/ccmp+xml": {
    source: "iana",
    compressible: true
  },
  "application/ccxml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["ccxml"]
  },
  "application/cda+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/cdfx+xml": {
    source: "iana",
    compressible: true,
    extensions: ["cdfx"]
  },
  "application/cdmi-capability": {
    source: "iana",
    extensions: ["cdmia"]
  },
  "application/cdmi-container": {
    source: "iana",
    extensions: ["cdmic"]
  },
  "application/cdmi-domain": {
    source: "iana",
    extensions: ["cdmid"]
  },
  "application/cdmi-object": {
    source: "iana",
    extensions: ["cdmio"]
  },
  "application/cdmi-queue": {
    source: "iana",
    extensions: ["cdmiq"]
  },
  "application/cdni": {
    source: "iana"
  },
  "application/cea": {
    source: "iana"
  },
  "application/cea-2018+xml": {
    source: "iana",
    compressible: true
  },
  "application/cellml+xml": {
    source: "iana",
    compressible: true
  },
  "application/cfw": {
    source: "iana"
  },
  "application/city+json": {
    source: "iana",
    compressible: true
  },
  "application/clr": {
    source: "iana"
  },
  "application/clue+xml": {
    source: "iana",
    compressible: true
  },
  "application/clue_info+xml": {
    source: "iana",
    compressible: true
  },
  "application/cms": {
    source: "iana"
  },
  "application/cnrp+xml": {
    source: "iana",
    compressible: true
  },
  "application/coap-group+json": {
    source: "iana",
    compressible: true
  },
  "application/coap-payload": {
    source: "iana"
  },
  "application/commonground": {
    source: "iana"
  },
  "application/conference-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/cose": {
    source: "iana"
  },
  "application/cose-key": {
    source: "iana"
  },
  "application/cose-key-set": {
    source: "iana"
  },
  "application/cpl+xml": {
    source: "iana",
    compressible: true,
    extensions: ["cpl"]
  },
  "application/csrattrs": {
    source: "iana"
  },
  "application/csta+xml": {
    source: "iana",
    compressible: true
  },
  "application/cstadata+xml": {
    source: "iana",
    compressible: true
  },
  "application/csvm+json": {
    source: "iana",
    compressible: true
  },
  "application/cu-seeme": {
    source: "apache",
    extensions: ["cu"]
  },
  "application/cwl": {
    source: "iana",
    extensions: ["cwl"]
  },
  "application/cwl+json": {
    source: "iana",
    compressible: true
  },
  "application/cwt": {
    source: "iana"
  },
  "application/cybercash": {
    source: "iana"
  },
  "application/dart": {
    compressible: true
  },
  "application/dash+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mpd"]
  },
  "application/dash-patch+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mpp"]
  },
  "application/dashdelta": {
    source: "iana"
  },
  "application/davmount+xml": {
    source: "iana",
    compressible: true,
    extensions: ["davmount"]
  },
  "application/dca-rft": {
    source: "iana"
  },
  "application/dcd": {
    source: "iana"
  },
  "application/dec-dx": {
    source: "iana"
  },
  "application/dialog-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/dicom": {
    source: "iana"
  },
  "application/dicom+json": {
    source: "iana",
    compressible: true
  },
  "application/dicom+xml": {
    source: "iana",
    compressible: true
  },
  "application/dii": {
    source: "iana"
  },
  "application/dit": {
    source: "iana"
  },
  "application/dns": {
    source: "iana"
  },
  "application/dns+json": {
    source: "iana",
    compressible: true
  },
  "application/dns-message": {
    source: "iana"
  },
  "application/docbook+xml": {
    source: "apache",
    compressible: true,
    extensions: ["dbk"]
  },
  "application/dots+cbor": {
    source: "iana"
  },
  "application/dskpp+xml": {
    source: "iana",
    compressible: true
  },
  "application/dssc+der": {
    source: "iana",
    extensions: ["dssc"]
  },
  "application/dssc+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xdssc"]
  },
  "application/dvcs": {
    source: "iana"
  },
  "application/ecmascript": {
    source: "apache",
    compressible: true,
    extensions: ["ecma"]
  },
  "application/edi-consent": {
    source: "iana"
  },
  "application/edi-x12": {
    source: "iana",
    compressible: false
  },
  "application/edifact": {
    source: "iana",
    compressible: false
  },
  "application/efi": {
    source: "iana"
  },
  "application/elm+json": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/elm+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.cap+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/emergencycalldata.comment+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.control+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.deviceinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.ecall.msd": {
    source: "iana"
  },
  "application/emergencycalldata.providerinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.serviceinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.subscriberinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/emergencycalldata.veds+xml": {
    source: "iana",
    compressible: true
  },
  "application/emma+xml": {
    source: "iana",
    compressible: true,
    extensions: ["emma"]
  },
  "application/emotionml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["emotionml"]
  },
  "application/encaprtp": {
    source: "iana"
  },
  "application/epp+xml": {
    source: "iana",
    compressible: true
  },
  "application/epub+zip": {
    source: "iana",
    compressible: false,
    extensions: ["epub"]
  },
  "application/eshop": {
    source: "iana"
  },
  "application/exi": {
    source: "iana",
    extensions: ["exi"]
  },
  "application/expect-ct-report+json": {
    source: "iana",
    compressible: true
  },
  "application/express": {
    source: "iana",
    extensions: ["exp"]
  },
  "application/fastinfoset": {
    source: "iana"
  },
  "application/fastsoap": {
    source: "iana"
  },
  "application/fdf": {
    source: "iana",
    extensions: ["fdf"]
  },
  "application/fdt+xml": {
    source: "iana",
    compressible: true,
    extensions: ["fdt"]
  },
  "application/fhir+json": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/fhir+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/fido.trusted-apps+json": {
    compressible: true
  },
  "application/fits": {
    source: "iana"
  },
  "application/flexfec": {
    source: "iana"
  },
  "application/font-sfnt": {
    source: "iana"
  },
  "application/font-tdpfr": {
    source: "iana",
    extensions: ["pfr"]
  },
  "application/font-woff": {
    source: "iana",
    compressible: false
  },
  "application/framework-attributes+xml": {
    source: "iana",
    compressible: true
  },
  "application/geo+json": {
    source: "iana",
    compressible: true,
    extensions: ["geojson"]
  },
  "application/geo+json-seq": {
    source: "iana"
  },
  "application/geopackage+sqlite3": {
    source: "iana"
  },
  "application/geoxacml+xml": {
    source: "iana",
    compressible: true
  },
  "application/gltf-buffer": {
    source: "iana"
  },
  "application/gml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["gml"]
  },
  "application/gpx+xml": {
    source: "apache",
    compressible: true,
    extensions: ["gpx"]
  },
  "application/gxf": {
    source: "apache",
    extensions: ["gxf"]
  },
  "application/gzip": {
    source: "iana",
    compressible: false,
    extensions: ["gz"]
  },
  "application/h224": {
    source: "iana"
  },
  "application/held+xml": {
    source: "iana",
    compressible: true
  },
  "application/hjson": {
    extensions: ["hjson"]
  },
  "application/hl7v2+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/http": {
    source: "iana"
  },
  "application/hyperstudio": {
    source: "iana",
    extensions: ["stk"]
  },
  "application/ibe-key-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/ibe-pkg-reply+xml": {
    source: "iana",
    compressible: true
  },
  "application/ibe-pp-data": {
    source: "iana"
  },
  "application/iges": {
    source: "iana"
  },
  "application/im-iscomposing+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/index": {
    source: "iana"
  },
  "application/index.cmd": {
    source: "iana"
  },
  "application/index.obj": {
    source: "iana"
  },
  "application/index.response": {
    source: "iana"
  },
  "application/index.vnd": {
    source: "iana"
  },
  "application/inkml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["ink", "inkml"]
  },
  "application/iotp": {
    source: "iana"
  },
  "application/ipfix": {
    source: "iana",
    extensions: ["ipfix"]
  },
  "application/ipp": {
    source: "iana"
  },
  "application/isup": {
    source: "iana"
  },
  "application/its+xml": {
    source: "iana",
    compressible: true,
    extensions: ["its"]
  },
  "application/java-archive": {
    source: "apache",
    compressible: false,
    extensions: ["jar", "war", "ear"]
  },
  "application/java-serialized-object": {
    source: "apache",
    compressible: false,
    extensions: ["ser"]
  },
  "application/java-vm": {
    source: "apache",
    compressible: false,
    extensions: ["class"]
  },
  "application/javascript": {
    source: "apache",
    charset: "UTF-8",
    compressible: true,
    extensions: ["js"]
  },
  "application/jf2feed+json": {
    source: "iana",
    compressible: true
  },
  "application/jose": {
    source: "iana"
  },
  "application/jose+json": {
    source: "iana",
    compressible: true
  },
  "application/jrd+json": {
    source: "iana",
    compressible: true
  },
  "application/jscalendar+json": {
    source: "iana",
    compressible: true
  },
  "application/json": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["json", "map"]
  },
  "application/json-patch+json": {
    source: "iana",
    compressible: true
  },
  "application/json-seq": {
    source: "iana"
  },
  "application/json5": {
    extensions: ["json5"]
  },
  "application/jsonml+json": {
    source: "apache",
    compressible: true,
    extensions: ["jsonml"]
  },
  "application/jwk+json": {
    source: "iana",
    compressible: true
  },
  "application/jwk-set+json": {
    source: "iana",
    compressible: true
  },
  "application/jwt": {
    source: "iana"
  },
  "application/kpml-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/kpml-response+xml": {
    source: "iana",
    compressible: true
  },
  "application/ld+json": {
    source: "iana",
    compressible: true,
    extensions: ["jsonld"]
  },
  "application/lgr+xml": {
    source: "iana",
    compressible: true,
    extensions: ["lgr"]
  },
  "application/link-format": {
    source: "iana"
  },
  "application/linkset": {
    source: "iana"
  },
  "application/linkset+json": {
    source: "iana",
    compressible: true
  },
  "application/load-control+xml": {
    source: "iana",
    compressible: true
  },
  "application/lost+xml": {
    source: "iana",
    compressible: true,
    extensions: ["lostxml"]
  },
  "application/lostsync+xml": {
    source: "iana",
    compressible: true
  },
  "application/lpf+zip": {
    source: "iana",
    compressible: false
  },
  "application/lxf": {
    source: "iana"
  },
  "application/mac-binhex40": {
    source: "iana",
    extensions: ["hqx"]
  },
  "application/mac-compactpro": {
    source: "apache",
    extensions: ["cpt"]
  },
  "application/macwriteii": {
    source: "iana"
  },
  "application/mads+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mads"]
  },
  "application/manifest+json": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["webmanifest"]
  },
  "application/marc": {
    source: "iana",
    extensions: ["mrc"]
  },
  "application/marcxml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mrcx"]
  },
  "application/mathematica": {
    source: "iana",
    extensions: ["ma", "nb", "mb"]
  },
  "application/mathml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mathml"]
  },
  "application/mathml-content+xml": {
    source: "iana",
    compressible: true
  },
  "application/mathml-presentation+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-associated-procedure-description+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-deregister+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-envelope+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-msk+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-msk-response+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-protection-description+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-reception-report+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-register+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-register-response+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-schedule+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbms-user-service-description+xml": {
    source: "iana",
    compressible: true
  },
  "application/mbox": {
    source: "iana",
    extensions: ["mbox"]
  },
  "application/media-policy-dataset+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mpf"]
  },
  "application/media_control+xml": {
    source: "iana",
    compressible: true
  },
  "application/mediaservercontrol+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mscml"]
  },
  "application/merge-patch+json": {
    source: "iana",
    compressible: true
  },
  "application/metalink+xml": {
    source: "apache",
    compressible: true,
    extensions: ["metalink"]
  },
  "application/metalink4+xml": {
    source: "iana",
    compressible: true,
    extensions: ["meta4"]
  },
  "application/mets+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mets"]
  },
  "application/mf4": {
    source: "iana"
  },
  "application/mikey": {
    source: "iana"
  },
  "application/mipc": {
    source: "iana"
  },
  "application/missing-blocks+cbor-seq": {
    source: "iana"
  },
  "application/mmt-aei+xml": {
    source: "iana",
    compressible: true,
    extensions: ["maei"]
  },
  "application/mmt-usd+xml": {
    source: "iana",
    compressible: true,
    extensions: ["musd"]
  },
  "application/mods+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mods"]
  },
  "application/moss-keys": {
    source: "iana"
  },
  "application/moss-signature": {
    source: "iana"
  },
  "application/mosskey-data": {
    source: "iana"
  },
  "application/mosskey-request": {
    source: "iana"
  },
  "application/mp21": {
    source: "iana",
    extensions: ["m21", "mp21"]
  },
  "application/mp4": {
    source: "iana",
    extensions: ["mp4s", "m4p"]
  },
  "application/mpeg4-generic": {
    source: "iana"
  },
  "application/mpeg4-iod": {
    source: "iana"
  },
  "application/mpeg4-iod-xmt": {
    source: "iana"
  },
  "application/mrb-consumer+xml": {
    source: "iana",
    compressible: true
  },
  "application/mrb-publish+xml": {
    source: "iana",
    compressible: true
  },
  "application/msc-ivr+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/msc-mixer+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/msword": {
    source: "iana",
    compressible: false,
    extensions: ["doc", "dot"]
  },
  "application/mud+json": {
    source: "iana",
    compressible: true
  },
  "application/multipart-core": {
    source: "iana"
  },
  "application/mxf": {
    source: "iana",
    extensions: ["mxf"]
  },
  "application/n-quads": {
    source: "iana",
    extensions: ["nq"]
  },
  "application/n-triples": {
    source: "iana",
    extensions: ["nt"]
  },
  "application/nasdata": {
    source: "iana"
  },
  "application/news-checkgroups": {
    source: "iana",
    charset: "US-ASCII"
  },
  "application/news-groupinfo": {
    source: "iana",
    charset: "US-ASCII"
  },
  "application/news-transmission": {
    source: "iana"
  },
  "application/nlsml+xml": {
    source: "iana",
    compressible: true
  },
  "application/node": {
    source: "iana",
    extensions: ["cjs"]
  },
  "application/nss": {
    source: "iana"
  },
  "application/oauth-authz-req+jwt": {
    source: "iana"
  },
  "application/oblivious-dns-message": {
    source: "iana"
  },
  "application/ocsp-request": {
    source: "iana"
  },
  "application/ocsp-response": {
    source: "iana"
  },
  "application/octet-stream": {
    source: "iana",
    compressible: false,
    extensions: [
      "bin",
      "dms",
      "lrf",
      "mar",
      "so",
      "dist",
      "distz",
      "pkg",
      "bpk",
      "dump",
      "elc",
      "deploy",
      "exe",
      "dll",
      "deb",
      "dmg",
      "iso",
      "img",
      "msi",
      "msp",
      "msm",
      "buffer"
    ]
  },
  "application/oda": {
    source: "iana",
    extensions: ["oda"]
  },
  "application/odm+xml": {
    source: "iana",
    compressible: true
  },
  "application/odx": {
    source: "iana"
  },
  "application/oebps-package+xml": {
    source: "iana",
    compressible: true,
    extensions: ["opf"]
  },
  "application/ogg": {
    source: "iana",
    compressible: false,
    extensions: ["ogx"]
  },
  "application/omdoc+xml": {
    source: "apache",
    compressible: true,
    extensions: ["omdoc"]
  },
  "application/onenote": {
    source: "apache",
    extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"]
  },
  "application/opc-nodeset+xml": {
    source: "iana",
    compressible: true
  },
  "application/oscore": {
    source: "iana"
  },
  "application/oxps": {
    source: "iana",
    extensions: ["oxps"]
  },
  "application/p21": {
    source: "iana"
  },
  "application/p21+zip": {
    source: "iana",
    compressible: false
  },
  "application/p2p-overlay+xml": {
    source: "iana",
    compressible: true,
    extensions: ["relo"]
  },
  "application/parityfec": {
    source: "iana"
  },
  "application/passport": {
    source: "iana"
  },
  "application/patch-ops-error+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xer"]
  },
  "application/pdf": {
    source: "iana",
    compressible: false,
    extensions: ["pdf"]
  },
  "application/pdx": {
    source: "iana"
  },
  "application/pem-certificate-chain": {
    source: "iana"
  },
  "application/pgp-encrypted": {
    source: "iana",
    compressible: false,
    extensions: ["pgp"]
  },
  "application/pgp-keys": {
    source: "iana",
    extensions: ["asc"]
  },
  "application/pgp-signature": {
    source: "iana",
    extensions: ["sig", "asc"]
  },
  "application/pics-rules": {
    source: "apache",
    extensions: ["prf"]
  },
  "application/pidf+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/pidf-diff+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/pkcs10": {
    source: "iana",
    extensions: ["p10"]
  },
  "application/pkcs12": {
    source: "iana"
  },
  "application/pkcs7-mime": {
    source: "iana",
    extensions: ["p7m", "p7c"]
  },
  "application/pkcs7-signature": {
    source: "iana",
    extensions: ["p7s"]
  },
  "application/pkcs8": {
    source: "iana",
    extensions: ["p8"]
  },
  "application/pkcs8-encrypted": {
    source: "iana"
  },
  "application/pkix-attr-cert": {
    source: "iana",
    extensions: ["ac"]
  },
  "application/pkix-cert": {
    source: "iana",
    extensions: ["cer"]
  },
  "application/pkix-crl": {
    source: "iana",
    extensions: ["crl"]
  },
  "application/pkix-pkipath": {
    source: "iana",
    extensions: ["pkipath"]
  },
  "application/pkixcmp": {
    source: "iana",
    extensions: ["pki"]
  },
  "application/pls+xml": {
    source: "iana",
    compressible: true,
    extensions: ["pls"]
  },
  "application/poc-settings+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/postscript": {
    source: "iana",
    compressible: true,
    extensions: ["ai", "eps", "ps"]
  },
  "application/ppsp-tracker+json": {
    source: "iana",
    compressible: true
  },
  "application/problem+json": {
    source: "iana",
    compressible: true
  },
  "application/problem+xml": {
    source: "iana",
    compressible: true
  },
  "application/provenance+xml": {
    source: "iana",
    compressible: true,
    extensions: ["provx"]
  },
  "application/prs.alvestrand.titrax-sheet": {
    source: "iana"
  },
  "application/prs.cww": {
    source: "iana",
    extensions: ["cww"]
  },
  "application/prs.cyn": {
    source: "iana",
    charset: "7-BIT"
  },
  "application/prs.hpub+zip": {
    source: "iana",
    compressible: false
  },
  "application/prs.nprend": {
    source: "iana"
  },
  "application/prs.plucker": {
    source: "iana"
  },
  "application/prs.rdf-xml-crypt": {
    source: "iana"
  },
  "application/prs.xsf+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xsf"]
  },
  "application/pskc+xml": {
    source: "iana",
    compressible: true,
    extensions: ["pskcxml"]
  },
  "application/pvd+json": {
    source: "iana",
    compressible: true
  },
  "application/qsig": {
    source: "iana"
  },
  "application/raml+yaml": {
    compressible: true,
    extensions: ["raml"]
  },
  "application/raptorfec": {
    source: "iana"
  },
  "application/rdap+json": {
    source: "iana",
    compressible: true
  },
  "application/rdf+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rdf", "owl"]
  },
  "application/reginfo+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rif"]
  },
  "application/relax-ng-compact-syntax": {
    source: "iana",
    extensions: ["rnc"]
  },
  "application/remote-printing": {
    source: "iana"
  },
  "application/reputon+json": {
    source: "iana",
    compressible: true
  },
  "application/resource-lists+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rl"]
  },
  "application/resource-lists-diff+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rld"]
  },
  "application/rfc+xml": {
    source: "iana",
    compressible: true
  },
  "application/riscos": {
    source: "iana"
  },
  "application/rlmi+xml": {
    source: "iana",
    compressible: true
  },
  "application/rls-services+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rs"]
  },
  "application/route-apd+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rapd"]
  },
  "application/route-s-tsid+xml": {
    source: "iana",
    compressible: true,
    extensions: ["sls"]
  },
  "application/route-usd+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rusd"]
  },
  "application/rpki-ghostbusters": {
    source: "iana",
    extensions: ["gbr"]
  },
  "application/rpki-manifest": {
    source: "iana",
    extensions: ["mft"]
  },
  "application/rpki-publication": {
    source: "iana"
  },
  "application/rpki-roa": {
    source: "iana",
    extensions: ["roa"]
  },
  "application/rpki-updown": {
    source: "iana"
  },
  "application/rsd+xml": {
    source: "apache",
    compressible: true,
    extensions: ["rsd"]
  },
  "application/rss+xml": {
    source: "apache",
    compressible: true,
    extensions: ["rss"]
  },
  "application/rtf": {
    source: "iana",
    compressible: true,
    extensions: ["rtf"]
  },
  "application/rtploopback": {
    source: "iana"
  },
  "application/rtx": {
    source: "iana"
  },
  "application/samlassertion+xml": {
    source: "iana",
    compressible: true
  },
  "application/samlmetadata+xml": {
    source: "iana",
    compressible: true
  },
  "application/sarif+json": {
    source: "iana",
    compressible: true
  },
  "application/sarif-external-properties+json": {
    source: "iana",
    compressible: true
  },
  "application/sbe": {
    source: "iana"
  },
  "application/sbml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["sbml"]
  },
  "application/scaip+xml": {
    source: "iana",
    compressible: true
  },
  "application/scim+json": {
    source: "iana",
    compressible: true
  },
  "application/scvp-cv-request": {
    source: "iana",
    extensions: ["scq"]
  },
  "application/scvp-cv-response": {
    source: "iana",
    extensions: ["scs"]
  },
  "application/scvp-vp-request": {
    source: "iana",
    extensions: ["spq"]
  },
  "application/scvp-vp-response": {
    source: "iana",
    extensions: ["spp"]
  },
  "application/sdp": {
    source: "iana",
    extensions: ["sdp"]
  },
  "application/secevent+jwt": {
    source: "iana"
  },
  "application/senml+cbor": {
    source: "iana"
  },
  "application/senml+json": {
    source: "iana",
    compressible: true
  },
  "application/senml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["senmlx"]
  },
  "application/senml-etch+cbor": {
    source: "iana"
  },
  "application/senml-etch+json": {
    source: "iana",
    compressible: true
  },
  "application/senml-exi": {
    source: "iana"
  },
  "application/sensml+cbor": {
    source: "iana"
  },
  "application/sensml+json": {
    source: "iana",
    compressible: true
  },
  "application/sensml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["sensmlx"]
  },
  "application/sensml-exi": {
    source: "iana"
  },
  "application/sep+xml": {
    source: "iana",
    compressible: true
  },
  "application/sep-exi": {
    source: "iana"
  },
  "application/session-info": {
    source: "iana"
  },
  "application/set-payment": {
    source: "iana"
  },
  "application/set-payment-initiation": {
    source: "iana",
    extensions: ["setpay"]
  },
  "application/set-registration": {
    source: "iana"
  },
  "application/set-registration-initiation": {
    source: "iana",
    extensions: ["setreg"]
  },
  "application/sgml": {
    source: "iana"
  },
  "application/sgml-open-catalog": {
    source: "iana"
  },
  "application/shf+xml": {
    source: "iana",
    compressible: true,
    extensions: ["shf"]
  },
  "application/sieve": {
    source: "iana",
    extensions: ["siv", "sieve"]
  },
  "application/simple-filter+xml": {
    source: "iana",
    compressible: true
  },
  "application/simple-message-summary": {
    source: "iana"
  },
  "application/simplesymbolcontainer": {
    source: "iana"
  },
  "application/sipc": {
    source: "iana"
  },
  "application/slate": {
    source: "iana"
  },
  "application/smil": {
    source: "apache"
  },
  "application/smil+xml": {
    source: "iana",
    compressible: true,
    extensions: ["smi", "smil"]
  },
  "application/smpte336m": {
    source: "iana"
  },
  "application/soap+fastinfoset": {
    source: "iana"
  },
  "application/soap+xml": {
    source: "iana",
    compressible: true
  },
  "application/sparql-query": {
    source: "iana",
    extensions: ["rq"]
  },
  "application/sparql-results+xml": {
    source: "iana",
    compressible: true,
    extensions: ["srx"]
  },
  "application/spdx+json": {
    source: "iana",
    compressible: true
  },
  "application/spirits-event+xml": {
    source: "iana",
    compressible: true
  },
  "application/sql": {
    source: "iana"
  },
  "application/srgs": {
    source: "iana",
    extensions: ["gram"]
  },
  "application/srgs+xml": {
    source: "iana",
    compressible: true,
    extensions: ["grxml"]
  },
  "application/sru+xml": {
    source: "iana",
    compressible: true,
    extensions: ["sru"]
  },
  "application/ssdl+xml": {
    source: "apache",
    compressible: true,
    extensions: ["ssdl"]
  },
  "application/ssml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["ssml"]
  },
  "application/stix+json": {
    source: "iana",
    compressible: true
  },
  "application/swid+xml": {
    source: "iana",
    compressible: true,
    extensions: ["swidtag"]
  },
  "application/tamp-apex-update": {
    source: "iana"
  },
  "application/tamp-apex-update-confirm": {
    source: "iana"
  },
  "application/tamp-community-update": {
    source: "iana"
  },
  "application/tamp-community-update-confirm": {
    source: "iana"
  },
  "application/tamp-error": {
    source: "iana"
  },
  "application/tamp-sequence-adjust": {
    source: "iana"
  },
  "application/tamp-sequence-adjust-confirm": {
    source: "iana"
  },
  "application/tamp-status-query": {
    source: "iana"
  },
  "application/tamp-status-response": {
    source: "iana"
  },
  "application/tamp-update": {
    source: "iana"
  },
  "application/tamp-update-confirm": {
    source: "iana"
  },
  "application/tar": {
    compressible: true
  },
  "application/taxii+json": {
    source: "iana",
    compressible: true
  },
  "application/td+json": {
    source: "iana",
    compressible: true
  },
  "application/tei+xml": {
    source: "iana",
    compressible: true,
    extensions: ["tei", "teicorpus"]
  },
  "application/tetra_isi": {
    source: "iana"
  },
  "application/thraud+xml": {
    source: "iana",
    compressible: true,
    extensions: ["tfi"]
  },
  "application/timestamp-query": {
    source: "iana"
  },
  "application/timestamp-reply": {
    source: "iana"
  },
  "application/timestamped-data": {
    source: "iana",
    extensions: ["tsd"]
  },
  "application/tlsrpt+gzip": {
    source: "iana"
  },
  "application/tlsrpt+json": {
    source: "iana",
    compressible: true
  },
  "application/tnauthlist": {
    source: "iana"
  },
  "application/token-introspection+jwt": {
    source: "iana"
  },
  "application/toml": {
    compressible: true,
    extensions: ["toml"]
  },
  "application/trickle-ice-sdpfrag": {
    source: "iana"
  },
  "application/trig": {
    source: "iana",
    extensions: ["trig"]
  },
  "application/ttml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["ttml"]
  },
  "application/tve-trigger": {
    source: "iana"
  },
  "application/tzif": {
    source: "iana"
  },
  "application/tzif-leap": {
    source: "iana"
  },
  "application/ubjson": {
    compressible: false,
    extensions: ["ubj"]
  },
  "application/ulpfec": {
    source: "iana"
  },
  "application/urc-grpsheet+xml": {
    source: "iana",
    compressible: true
  },
  "application/urc-ressheet+xml": {
    source: "iana",
    compressible: true,
    extensions: ["rsheet"]
  },
  "application/urc-targetdesc+xml": {
    source: "iana",
    compressible: true,
    extensions: ["td"]
  },
  "application/urc-uisocketdesc+xml": {
    source: "iana",
    compressible: true
  },
  "application/vcard+json": {
    source: "iana",
    compressible: true
  },
  "application/vcard+xml": {
    source: "iana",
    compressible: true
  },
  "application/vemmi": {
    source: "iana"
  },
  "application/vividence.scriptfile": {
    source: "apache"
  },
  "application/vnd.1000minds.decision-model+xml": {
    source: "iana",
    compressible: true,
    extensions: ["1km"]
  },
  "application/vnd.3gpp-prose+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp-prose-pc3ch+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp-v2x-local-service-information": {
    source: "iana"
  },
  "application/vnd.3gpp.5gnas": {
    source: "iana"
  },
  "application/vnd.3gpp.access-transfer-events+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.bsf+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.gmop+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.gtpc": {
    source: "iana"
  },
  "application/vnd.3gpp.interworking-data": {
    source: "iana"
  },
  "application/vnd.3gpp.lpp": {
    source: "iana"
  },
  "application/vnd.3gpp.mc-signalling-ear": {
    source: "iana"
  },
  "application/vnd.3gpp.mcdata-affiliation-command+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-msgstore-ctrl-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-payload": {
    source: "iana"
  },
  "application/vnd.3gpp.mcdata-regroup+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-service-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-signalling": {
    source: "iana"
  },
  "application/vnd.3gpp.mcdata-ue-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcdata-user-profile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-affiliation-command+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-floor-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-location-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-service-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-signed+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-ue-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-ue-init-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcptt-user-profile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-location-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-service-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-transmission-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-ue-config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mcvideo-user-profile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.mid-call+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.ngap": {
    source: "iana"
  },
  "application/vnd.3gpp.pfcp": {
    source: "iana"
  },
  "application/vnd.3gpp.pic-bw-large": {
    source: "iana",
    extensions: ["plb"]
  },
  "application/vnd.3gpp.pic-bw-small": {
    source: "iana",
    extensions: ["psb"]
  },
  "application/vnd.3gpp.pic-bw-var": {
    source: "iana",
    extensions: ["pvb"]
  },
  "application/vnd.3gpp.s1ap": {
    source: "iana"
  },
  "application/vnd.3gpp.sms": {
    source: "iana"
  },
  "application/vnd.3gpp.sms+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.srvcc-ext+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.srvcc-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.state-and-event-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp.ussd+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp2.bcmcsinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.3gpp2.sms": {
    source: "iana"
  },
  "application/vnd.3gpp2.tcap": {
    source: "iana",
    extensions: ["tcap"]
  },
  "application/vnd.3lightssoftware.imagescal": {
    source: "iana"
  },
  "application/vnd.3m.post-it-notes": {
    source: "iana",
    extensions: ["pwn"]
  },
  "application/vnd.accpac.simply.aso": {
    source: "iana",
    extensions: ["aso"]
  },
  "application/vnd.accpac.simply.imp": {
    source: "iana",
    extensions: ["imp"]
  },
  "application/vnd.acucobol": {
    source: "iana",
    extensions: ["acu"]
  },
  "application/vnd.acucorp": {
    source: "iana",
    extensions: ["atc", "acutc"]
  },
  "application/vnd.adobe.air-application-installer-package+zip": {
    source: "apache",
    compressible: false,
    extensions: ["air"]
  },
  "application/vnd.adobe.flash.movie": {
    source: "iana"
  },
  "application/vnd.adobe.formscentral.fcdt": {
    source: "iana",
    extensions: ["fcdt"]
  },
  "application/vnd.adobe.fxp": {
    source: "iana",
    extensions: ["fxp", "fxpl"]
  },
  "application/vnd.adobe.partial-upload": {
    source: "iana"
  },
  "application/vnd.adobe.xdp+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xdp"]
  },
  "application/vnd.adobe.xfdf": {
    source: "apache",
    extensions: ["xfdf"]
  },
  "application/vnd.aether.imp": {
    source: "iana"
  },
  "application/vnd.afpc.afplinedata": {
    source: "iana"
  },
  "application/vnd.afpc.afplinedata-pagedef": {
    source: "iana"
  },
  "application/vnd.afpc.cmoca-cmresource": {
    source: "iana"
  },
  "application/vnd.afpc.foca-charset": {
    source: "iana"
  },
  "application/vnd.afpc.foca-codedfont": {
    source: "iana"
  },
  "application/vnd.afpc.foca-codepage": {
    source: "iana"
  },
  "application/vnd.afpc.modca": {
    source: "iana"
  },
  "application/vnd.afpc.modca-cmtable": {
    source: "iana"
  },
  "application/vnd.afpc.modca-formdef": {
    source: "iana"
  },
  "application/vnd.afpc.modca-mediummap": {
    source: "iana"
  },
  "application/vnd.afpc.modca-objectcontainer": {
    source: "iana"
  },
  "application/vnd.afpc.modca-overlay": {
    source: "iana"
  },
  "application/vnd.afpc.modca-pagesegment": {
    source: "iana"
  },
  "application/vnd.age": {
    source: "iana",
    extensions: ["age"]
  },
  "application/vnd.ah-barcode": {
    source: "apache"
  },
  "application/vnd.ahead.space": {
    source: "iana",
    extensions: ["ahead"]
  },
  "application/vnd.airzip.filesecure.azf": {
    source: "iana",
    extensions: ["azf"]
  },
  "application/vnd.airzip.filesecure.azs": {
    source: "iana",
    extensions: ["azs"]
  },
  "application/vnd.amadeus+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.amazon.ebook": {
    source: "apache",
    extensions: ["azw"]
  },
  "application/vnd.amazon.mobi8-ebook": {
    source: "iana"
  },
  "application/vnd.americandynamics.acc": {
    source: "iana",
    extensions: ["acc"]
  },
  "application/vnd.amiga.ami": {
    source: "iana",
    extensions: ["ami"]
  },
  "application/vnd.amundsen.maze+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.android.ota": {
    source: "iana"
  },
  "application/vnd.android.package-archive": {
    source: "apache",
    compressible: false,
    extensions: ["apk"]
  },
  "application/vnd.anki": {
    source: "iana"
  },
  "application/vnd.anser-web-certificate-issue-initiation": {
    source: "iana",
    extensions: ["cii"]
  },
  "application/vnd.anser-web-funds-transfer-initiation": {
    source: "apache",
    extensions: ["fti"]
  },
  "application/vnd.antix.game-component": {
    source: "iana",
    extensions: ["atx"]
  },
  "application/vnd.apache.arrow.file": {
    source: "iana"
  },
  "application/vnd.apache.arrow.stream": {
    source: "iana"
  },
  "application/vnd.apache.thrift.binary": {
    source: "iana"
  },
  "application/vnd.apache.thrift.compact": {
    source: "iana"
  },
  "application/vnd.apache.thrift.json": {
    source: "iana"
  },
  "application/vnd.api+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.aplextor.warrp+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.apothekende.reservation+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.apple.installer+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mpkg"]
  },
  "application/vnd.apple.keynote": {
    source: "iana",
    extensions: ["key"]
  },
  "application/vnd.apple.mpegurl": {
    source: "iana",
    extensions: ["m3u8"]
  },
  "application/vnd.apple.numbers": {
    source: "iana",
    extensions: ["numbers"]
  },
  "application/vnd.apple.pages": {
    source: "iana",
    extensions: ["pages"]
  },
  "application/vnd.apple.pkpass": {
    compressible: false,
    extensions: ["pkpass"]
  },
  "application/vnd.arastra.swi": {
    source: "apache"
  },
  "application/vnd.aristanetworks.swi": {
    source: "iana",
    extensions: ["swi"]
  },
  "application/vnd.artisan+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.artsquare": {
    source: "iana"
  },
  "application/vnd.astraea-software.iota": {
    source: "iana",
    extensions: ["iota"]
  },
  "application/vnd.audiograph": {
    source: "iana",
    extensions: ["aep"]
  },
  "application/vnd.autopackage": {
    source: "iana"
  },
  "application/vnd.avalon+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.avistar+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.balsamiq.bmml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["bmml"]
  },
  "application/vnd.balsamiq.bmpr": {
    source: "iana"
  },
  "application/vnd.banana-accounting": {
    source: "iana"
  },
  "application/vnd.bbf.usp.error": {
    source: "iana"
  },
  "application/vnd.bbf.usp.msg": {
    source: "iana"
  },
  "application/vnd.bbf.usp.msg+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.bekitzur-stech+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.belightsoft.lhzd+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.bint.med-content": {
    source: "iana"
  },
  "application/vnd.biopax.rdf+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.blink-idb-value-wrapper": {
    source: "iana"
  },
  "application/vnd.blueice.multipass": {
    source: "iana",
    extensions: ["mpm"]
  },
  "application/vnd.bluetooth.ep.oob": {
    source: "iana"
  },
  "application/vnd.bluetooth.le.oob": {
    source: "iana"
  },
  "application/vnd.bmi": {
    source: "iana",
    extensions: ["bmi"]
  },
  "application/vnd.bpf": {
    source: "iana"
  },
  "application/vnd.bpf3": {
    source: "iana"
  },
  "application/vnd.businessobjects": {
    source: "iana",
    extensions: ["rep"]
  },
  "application/vnd.byu.uapi+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cab-jscript": {
    source: "iana"
  },
  "application/vnd.canon-cpdl": {
    source: "iana"
  },
  "application/vnd.canon-lips": {
    source: "iana"
  },
  "application/vnd.capasystems-pg+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cendio.thinlinc.clientconf": {
    source: "iana"
  },
  "application/vnd.century-systems.tcp_stream": {
    source: "iana"
  },
  "application/vnd.chemdraw+xml": {
    source: "iana",
    compressible: true,
    extensions: ["cdxml"]
  },
  "application/vnd.chess-pgn": {
    source: "iana"
  },
  "application/vnd.chipnuts.karaoke-mmd": {
    source: "iana",
    extensions: ["mmd"]
  },
  "application/vnd.ciedi": {
    source: "iana"
  },
  "application/vnd.cinderella": {
    source: "iana",
    extensions: ["cdy"]
  },
  "application/vnd.cirpack.isdn-ext": {
    source: "iana"
  },
  "application/vnd.citationstyles.style+xml": {
    source: "iana",
    compressible: true,
    extensions: ["csl"]
  },
  "application/vnd.claymore": {
    source: "iana",
    extensions: ["cla"]
  },
  "application/vnd.cloanto.rp9": {
    source: "iana",
    extensions: ["rp9"]
  },
  "application/vnd.clonk.c4group": {
    source: "iana",
    extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"]
  },
  "application/vnd.cluetrust.cartomobile-config": {
    source: "iana",
    extensions: ["c11amc"]
  },
  "application/vnd.cluetrust.cartomobile-config-pkg": {
    source: "iana",
    extensions: ["c11amz"]
  },
  "application/vnd.coffeescript": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.document": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.document-template": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.presentation": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.presentation-template": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.spreadsheet": {
    source: "iana"
  },
  "application/vnd.collabio.xodocuments.spreadsheet-template": {
    source: "iana"
  },
  "application/vnd.collection+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.collection.doc+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.collection.next+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.comicbook+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.comicbook-rar": {
    source: "iana"
  },
  "application/vnd.commerce-battelle": {
    source: "iana"
  },
  "application/vnd.commonspace": {
    source: "iana",
    extensions: ["csp"]
  },
  "application/vnd.contact.cmsg": {
    source: "iana",
    extensions: ["cdbcmsg"]
  },
  "application/vnd.coreos.ignition+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cosmocaller": {
    source: "iana",
    extensions: ["cmc"]
  },
  "application/vnd.crick.clicker": {
    source: "iana",
    extensions: ["clkx"]
  },
  "application/vnd.crick.clicker.keyboard": {
    source: "iana",
    extensions: ["clkk"]
  },
  "application/vnd.crick.clicker.palette": {
    source: "iana",
    extensions: ["clkp"]
  },
  "application/vnd.crick.clicker.template": {
    source: "iana",
    extensions: ["clkt"]
  },
  "application/vnd.crick.clicker.wordbank": {
    source: "iana",
    extensions: ["clkw"]
  },
  "application/vnd.criticaltools.wbs+xml": {
    source: "iana",
    compressible: true,
    extensions: ["wbs"]
  },
  "application/vnd.cryptii.pipe+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.crypto-shade-file": {
    source: "iana"
  },
  "application/vnd.cryptomator.encrypted": {
    source: "iana"
  },
  "application/vnd.cryptomator.vault": {
    source: "iana"
  },
  "application/vnd.ctc-posml": {
    source: "iana",
    extensions: ["pml"]
  },
  "application/vnd.ctct.ws+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cups-pdf": {
    source: "iana"
  },
  "application/vnd.cups-postscript": {
    source: "iana"
  },
  "application/vnd.cups-ppd": {
    source: "iana",
    extensions: ["ppd"]
  },
  "application/vnd.cups-raster": {
    source: "iana"
  },
  "application/vnd.cups-raw": {
    source: "iana"
  },
  "application/vnd.curl": {
    source: "iana"
  },
  "application/vnd.curl.car": {
    source: "apache",
    extensions: ["car"]
  },
  "application/vnd.curl.pcurl": {
    source: "apache",
    extensions: ["pcurl"]
  },
  "application/vnd.cyan.dean.root+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cybank": {
    source: "iana"
  },
  "application/vnd.cyclonedx+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.cyclonedx+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.d2l.coursepackage1p0+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.d3m-dataset": {
    source: "iana"
  },
  "application/vnd.d3m-problem": {
    source: "iana"
  },
  "application/vnd.dart": {
    source: "iana",
    compressible: true,
    extensions: ["dart"]
  },
  "application/vnd.data-vision.rdz": {
    source: "iana",
    extensions: ["rdz"]
  },
  "application/vnd.datapackage+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dataresource+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dbf": {
    source: "iana",
    extensions: ["dbf"]
  },
  "application/vnd.debian.binary-package": {
    source: "iana"
  },
  "application/vnd.dece.data": {
    source: "iana",
    extensions: ["uvf", "uvvf", "uvd", "uvvd"]
  },
  "application/vnd.dece.ttml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["uvt", "uvvt"]
  },
  "application/vnd.dece.unspecified": {
    source: "iana",
    extensions: ["uvx", "uvvx"]
  },
  "application/vnd.dece.zip": {
    source: "iana",
    extensions: ["uvz", "uvvz"]
  },
  "application/vnd.denovo.fcselayout-link": {
    source: "iana",
    extensions: ["fe_launch"]
  },
  "application/vnd.desmume.movie": {
    source: "iana"
  },
  "application/vnd.dir-bi.plate-dl-nosuffix": {
    source: "iana"
  },
  "application/vnd.dm.delegation+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dna": {
    source: "iana",
    extensions: ["dna"]
  },
  "application/vnd.document+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dolby.mlp": {
    source: "apache",
    extensions: ["mlp"]
  },
  "application/vnd.dolby.mobile.1": {
    source: "iana"
  },
  "application/vnd.dolby.mobile.2": {
    source: "iana"
  },
  "application/vnd.doremir.scorecloud-binary-document": {
    source: "iana"
  },
  "application/vnd.dpgraph": {
    source: "iana",
    extensions: ["dpg"]
  },
  "application/vnd.dreamfactory": {
    source: "iana",
    extensions: ["dfac"]
  },
  "application/vnd.drive+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ds-keypoint": {
    source: "apache",
    extensions: ["kpxx"]
  },
  "application/vnd.dtg.local": {
    source: "iana"
  },
  "application/vnd.dtg.local.flash": {
    source: "iana"
  },
  "application/vnd.dtg.local.html": {
    source: "iana"
  },
  "application/vnd.dvb.ait": {
    source: "iana",
    extensions: ["ait"]
  },
  "application/vnd.dvb.dvbisl+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.dvbj": {
    source: "iana"
  },
  "application/vnd.dvb.esgcontainer": {
    source: "iana"
  },
  "application/vnd.dvb.ipdcdftnotifaccess": {
    source: "iana"
  },
  "application/vnd.dvb.ipdcesgaccess": {
    source: "iana"
  },
  "application/vnd.dvb.ipdcesgaccess2": {
    source: "iana"
  },
  "application/vnd.dvb.ipdcesgpdd": {
    source: "iana"
  },
  "application/vnd.dvb.ipdcroaming": {
    source: "iana"
  },
  "application/vnd.dvb.iptv.alfec-base": {
    source: "iana"
  },
  "application/vnd.dvb.iptv.alfec-enhancement": {
    source: "iana"
  },
  "application/vnd.dvb.notif-aggregate-root+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-container+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-generic+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-ia-msglist+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-ia-registration-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-ia-registration-response+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.notif-init+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.dvb.pfr": {
    source: "iana"
  },
  "application/vnd.dvb.service": {
    source: "iana",
    extensions: ["svc"]
  },
  "application/vnd.dxr": {
    source: "iana"
  },
  "application/vnd.dynageo": {
    source: "iana",
    extensions: ["geo"]
  },
  "application/vnd.dzr": {
    source: "iana"
  },
  "application/vnd.easykaraoke.cdgdownload": {
    source: "iana"
  },
  "application/vnd.ecdis-update": {
    source: "iana"
  },
  "application/vnd.ecip.rlp": {
    source: "iana"
  },
  "application/vnd.eclipse.ditto+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ecowin.chart": {
    source: "iana",
    extensions: ["mag"]
  },
  "application/vnd.ecowin.filerequest": {
    source: "iana"
  },
  "application/vnd.ecowin.fileupdate": {
    source: "iana"
  },
  "application/vnd.ecowin.series": {
    source: "iana"
  },
  "application/vnd.ecowin.seriesrequest": {
    source: "iana"
  },
  "application/vnd.ecowin.seriesupdate": {
    source: "iana"
  },
  "application/vnd.efi.img": {
    source: "iana"
  },
  "application/vnd.efi.iso": {
    source: "iana"
  },
  "application/vnd.emclient.accessrequest+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.enliven": {
    source: "iana",
    extensions: ["nml"]
  },
  "application/vnd.enphase.envoy": {
    source: "iana"
  },
  "application/vnd.eprints.data+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.epson.esf": {
    source: "iana",
    extensions: ["esf"]
  },
  "application/vnd.epson.msf": {
    source: "iana",
    extensions: ["msf"]
  },
  "application/vnd.epson.quickanime": {
    source: "iana",
    extensions: ["qam"]
  },
  "application/vnd.epson.salt": {
    source: "iana",
    extensions: ["slt"]
  },
  "application/vnd.epson.ssf": {
    source: "iana",
    extensions: ["ssf"]
  },
  "application/vnd.ericsson.quickcall": {
    source: "iana"
  },
  "application/vnd.espass-espass+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.eszigno3+xml": {
    source: "iana",
    compressible: true,
    extensions: ["es3", "et3"]
  },
  "application/vnd.etsi.aoc+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.asic-e+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.etsi.asic-s+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.etsi.cug+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvcommand+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvdiscovery+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvprofile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvsad-bc+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvsad-cod+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvsad-npvr+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvservice+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvsync+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.iptvueprofile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.mcid+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.mheg5": {
    source: "iana"
  },
  "application/vnd.etsi.overload-control-policy-dataset+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.pstn+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.sci+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.simservs+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.timestamp-token": {
    source: "iana"
  },
  "application/vnd.etsi.tsl+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.etsi.tsl.der": {
    source: "iana"
  },
  "application/vnd.eu.kasparian.car+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.eudora.data": {
    source: "iana"
  },
  "application/vnd.evolv.ecig.profile": {
    source: "iana"
  },
  "application/vnd.evolv.ecig.settings": {
    source: "iana"
  },
  "application/vnd.evolv.ecig.theme": {
    source: "iana"
  },
  "application/vnd.exstream-empower+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.exstream-package": {
    source: "iana"
  },
  "application/vnd.ezpix-album": {
    source: "iana",
    extensions: ["ez2"]
  },
  "application/vnd.ezpix-package": {
    source: "iana",
    extensions: ["ez3"]
  },
  "application/vnd.f-secure.mobile": {
    source: "iana"
  },
  "application/vnd.familysearch.gedcom+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.fastcopy-disk-image": {
    source: "iana"
  },
  "application/vnd.fdf": {
    source: "apache",
    extensions: ["fdf"]
  },
  "application/vnd.fdsn.mseed": {
    source: "iana",
    extensions: ["mseed"]
  },
  "application/vnd.fdsn.seed": {
    source: "iana",
    extensions: ["seed", "dataless"]
  },
  "application/vnd.ffsns": {
    source: "iana"
  },
  "application/vnd.ficlab.flb+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.filmit.zfc": {
    source: "iana"
  },
  "application/vnd.fints": {
    source: "iana"
  },
  "application/vnd.firemonkeys.cloudcell": {
    source: "iana"
  },
  "application/vnd.flographit": {
    source: "iana",
    extensions: ["gph"]
  },
  "application/vnd.fluxtime.clip": {
    source: "iana",
    extensions: ["ftc"]
  },
  "application/vnd.font-fontforge-sfd": {
    source: "iana"
  },
  "application/vnd.framemaker": {
    source: "iana",
    extensions: ["fm", "frame", "maker", "book"]
  },
  "application/vnd.frogans.fnc": {
    source: "apache",
    extensions: ["fnc"]
  },
  "application/vnd.frogans.ltf": {
    source: "apache",
    extensions: ["ltf"]
  },
  "application/vnd.fsc.weblaunch": {
    source: "iana",
    extensions: ["fsc"]
  },
  "application/vnd.fujifilm.fb.docuworks": {
    source: "iana"
  },
  "application/vnd.fujifilm.fb.docuworks.binder": {
    source: "iana"
  },
  "application/vnd.fujifilm.fb.docuworks.container": {
    source: "iana"
  },
  "application/vnd.fujifilm.fb.jfi+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.fujitsu.oasys": {
    source: "iana",
    extensions: ["oas"]
  },
  "application/vnd.fujitsu.oasys2": {
    source: "iana",
    extensions: ["oa2"]
  },
  "application/vnd.fujitsu.oasys3": {
    source: "iana",
    extensions: ["oa3"]
  },
  "application/vnd.fujitsu.oasysgp": {
    source: "iana",
    extensions: ["fg5"]
  },
  "application/vnd.fujitsu.oasysprs": {
    source: "iana",
    extensions: ["bh2"]
  },
  "application/vnd.fujixerox.art-ex": {
    source: "iana"
  },
  "application/vnd.fujixerox.art4": {
    source: "iana"
  },
  "application/vnd.fujixerox.ddd": {
    source: "iana",
    extensions: ["ddd"]
  },
  "application/vnd.fujixerox.docuworks": {
    source: "iana",
    extensions: ["xdw"]
  },
  "application/vnd.fujixerox.docuworks.binder": {
    source: "iana",
    extensions: ["xbd"]
  },
  "application/vnd.fujixerox.docuworks.container": {
    source: "iana"
  },
  "application/vnd.fujixerox.hbpl": {
    source: "iana"
  },
  "application/vnd.fut-misnet": {
    source: "iana"
  },
  "application/vnd.futoin+cbor": {
    source: "iana"
  },
  "application/vnd.futoin+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.fuzzysheet": {
    source: "iana",
    extensions: ["fzs"]
  },
  "application/vnd.genomatix.tuxedo": {
    source: "iana",
    extensions: ["txd"]
  },
  "application/vnd.genozip": {
    source: "iana"
  },
  "application/vnd.gentics.grd+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.geo+json": {
    source: "apache",
    compressible: true
  },
  "application/vnd.geocube+xml": {
    source: "apache",
    compressible: true
  },
  "application/vnd.geogebra.file": {
    source: "iana",
    extensions: ["ggb"]
  },
  "application/vnd.geogebra.slides": {
    source: "iana"
  },
  "application/vnd.geogebra.tool": {
    source: "iana",
    extensions: ["ggt"]
  },
  "application/vnd.geometry-explorer": {
    source: "iana",
    extensions: ["gex", "gre"]
  },
  "application/vnd.geonext": {
    source: "iana",
    extensions: ["gxt"]
  },
  "application/vnd.geoplan": {
    source: "iana",
    extensions: ["g2w"]
  },
  "application/vnd.geospace": {
    source: "iana",
    extensions: ["g3w"]
  },
  "application/vnd.gerber": {
    source: "iana"
  },
  "application/vnd.globalplatform.card-content-mgt": {
    source: "iana"
  },
  "application/vnd.globalplatform.card-content-mgt-response": {
    source: "iana"
  },
  "application/vnd.gmx": {
    source: "iana",
    extensions: ["gmx"]
  },
  "application/vnd.gnu.taler.exchange+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.gnu.taler.merchant+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.google-apps.document": {
    compressible: false,
    extensions: ["gdoc"]
  },
  "application/vnd.google-apps.presentation": {
    compressible: false,
    extensions: ["gslides"]
  },
  "application/vnd.google-apps.spreadsheet": {
    compressible: false,
    extensions: ["gsheet"]
  },
  "application/vnd.google-earth.kml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["kml"]
  },
  "application/vnd.google-earth.kmz": {
    source: "iana",
    compressible: false,
    extensions: ["kmz"]
  },
  "application/vnd.gov.sk.e-form+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.gov.sk.e-form+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.gov.sk.xmldatacontainer+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.grafeq": {
    source: "iana",
    extensions: ["gqf", "gqs"]
  },
  "application/vnd.gridmp": {
    source: "iana"
  },
  "application/vnd.groove-account": {
    source: "iana",
    extensions: ["gac"]
  },
  "application/vnd.groove-help": {
    source: "iana",
    extensions: ["ghf"]
  },
  "application/vnd.groove-identity-message": {
    source: "iana",
    extensions: ["gim"]
  },
  "application/vnd.groove-injector": {
    source: "iana",
    extensions: ["grv"]
  },
  "application/vnd.groove-tool-message": {
    source: "iana",
    extensions: ["gtm"]
  },
  "application/vnd.groove-tool-template": {
    source: "iana",
    extensions: ["tpl"]
  },
  "application/vnd.groove-vcard": {
    source: "iana",
    extensions: ["vcg"]
  },
  "application/vnd.hal+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hal+xml": {
    source: "iana",
    compressible: true,
    extensions: ["hal"]
  },
  "application/vnd.handheld-entertainment+xml": {
    source: "iana",
    compressible: true,
    extensions: ["zmm"]
  },
  "application/vnd.hbci": {
    source: "iana",
    extensions: ["hbci"]
  },
  "application/vnd.hc+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hcl-bireports": {
    source: "iana"
  },
  "application/vnd.hdt": {
    source: "iana"
  },
  "application/vnd.heroku+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hhe.lesson-player": {
    source: "iana",
    extensions: ["les"]
  },
  "application/vnd.hp-hpgl": {
    source: "iana",
    extensions: ["hpgl"]
  },
  "application/vnd.hp-hpid": {
    source: "iana",
    extensions: ["hpid"]
  },
  "application/vnd.hp-hps": {
    source: "iana",
    extensions: ["hps"]
  },
  "application/vnd.hp-jlyt": {
    source: "iana",
    extensions: ["jlt"]
  },
  "application/vnd.hp-pcl": {
    source: "iana",
    extensions: ["pcl"]
  },
  "application/vnd.hp-pclxl": {
    source: "iana",
    extensions: ["pclxl"]
  },
  "application/vnd.httphone": {
    source: "iana"
  },
  "application/vnd.hydrostatix.sof-data": {
    source: "iana",
    extensions: ["sfd-hdstx"]
  },
  "application/vnd.hyper+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hyper-item+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hyperdrive+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.hzn-3d-crossword": {
    source: "iana"
  },
  "application/vnd.ibm.afplinedata": {
    source: "apache"
  },
  "application/vnd.ibm.electronic-media": {
    source: "iana"
  },
  "application/vnd.ibm.minipay": {
    source: "iana",
    extensions: ["mpy"]
  },
  "application/vnd.ibm.modcap": {
    source: "apache",
    extensions: ["afp", "listafp", "list3820"]
  },
  "application/vnd.ibm.rights-management": {
    source: "iana",
    extensions: ["irm"]
  },
  "application/vnd.ibm.secure-container": {
    source: "iana",
    extensions: ["sc"]
  },
  "application/vnd.iccprofile": {
    source: "iana",
    extensions: ["icc", "icm"]
  },
  "application/vnd.ieee.1905": {
    source: "iana"
  },
  "application/vnd.igloader": {
    source: "iana",
    extensions: ["igl"]
  },
  "application/vnd.imagemeter.folder+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.imagemeter.image+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.immervision-ivp": {
    source: "iana",
    extensions: ["ivp"]
  },
  "application/vnd.immervision-ivu": {
    source: "iana",
    extensions: ["ivu"]
  },
  "application/vnd.ims.imsccv1p1": {
    source: "iana"
  },
  "application/vnd.ims.imsccv1p2": {
    source: "iana"
  },
  "application/vnd.ims.imsccv1p3": {
    source: "iana"
  },
  "application/vnd.ims.lis.v2.result+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ims.lti.v2.toolproxy+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ims.lti.v2.toolproxy.id+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ims.lti.v2.toolsettings+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ims.lti.v2.toolsettings.simple+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.informedcontrol.rms+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.informix-visionary": {
    source: "apache"
  },
  "application/vnd.infotech.project": {
    source: "iana"
  },
  "application/vnd.infotech.project+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.innopath.wamp.notification": {
    source: "iana"
  },
  "application/vnd.insors.igm": {
    source: "iana",
    extensions: ["igm"]
  },
  "application/vnd.intercon.formnet": {
    source: "iana",
    extensions: ["xpw", "xpx"]
  },
  "application/vnd.intergeo": {
    source: "iana",
    extensions: ["i2g"]
  },
  "application/vnd.intertrust.digibox": {
    source: "iana"
  },
  "application/vnd.intertrust.nncp": {
    source: "iana"
  },
  "application/vnd.intu.qbo": {
    source: "iana",
    extensions: ["qbo"]
  },
  "application/vnd.intu.qfx": {
    source: "iana",
    extensions: ["qfx"]
  },
  "application/vnd.ipld.car": {
    source: "iana"
  },
  "application/vnd.ipld.raw": {
    source: "iana"
  },
  "application/vnd.iptc.g2.catalogitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.conceptitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.knowledgeitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.newsitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.newsmessage+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.packageitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.iptc.g2.planningitem+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ipunplugged.rcprofile": {
    source: "iana",
    extensions: ["rcprofile"]
  },
  "application/vnd.irepository.package+xml": {
    source: "iana",
    compressible: true,
    extensions: ["irp"]
  },
  "application/vnd.is-xpr": {
    source: "iana",
    extensions: ["xpr"]
  },
  "application/vnd.isac.fcs": {
    source: "iana",
    extensions: ["fcs"]
  },
  "application/vnd.iso11783-10+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.jam": {
    source: "iana",
    extensions: ["jam"]
  },
  "application/vnd.japannet-directory-service": {
    source: "iana"
  },
  "application/vnd.japannet-jpnstore-wakeup": {
    source: "iana"
  },
  "application/vnd.japannet-payment-wakeup": {
    source: "iana"
  },
  "application/vnd.japannet-registration": {
    source: "iana"
  },
  "application/vnd.japannet-registration-wakeup": {
    source: "iana"
  },
  "application/vnd.japannet-setstore-wakeup": {
    source: "iana"
  },
  "application/vnd.japannet-verification": {
    source: "iana"
  },
  "application/vnd.japannet-verification-wakeup": {
    source: "iana"
  },
  "application/vnd.jcp.javame.midlet-rms": {
    source: "iana",
    extensions: ["rms"]
  },
  "application/vnd.jisp": {
    source: "iana",
    extensions: ["jisp"]
  },
  "application/vnd.joost.joda-archive": {
    source: "iana",
    extensions: ["joda"]
  },
  "application/vnd.jsk.isdn-ngn": {
    source: "iana"
  },
  "application/vnd.kahootz": {
    source: "iana",
    extensions: ["ktz", "ktr"]
  },
  "application/vnd.kde.karbon": {
    source: "iana",
    extensions: ["karbon"]
  },
  "application/vnd.kde.kchart": {
    source: "iana",
    extensions: ["chrt"]
  },
  "application/vnd.kde.kformula": {
    source: "iana",
    extensions: ["kfo"]
  },
  "application/vnd.kde.kivio": {
    source: "iana",
    extensions: ["flw"]
  },
  "application/vnd.kde.kontour": {
    source: "iana",
    extensions: ["kon"]
  },
  "application/vnd.kde.kpresenter": {
    source: "iana",
    extensions: ["kpr", "kpt"]
  },
  "application/vnd.kde.kspread": {
    source: "iana",
    extensions: ["ksp"]
  },
  "application/vnd.kde.kword": {
    source: "iana",
    extensions: ["kwd", "kwt"]
  },
  "application/vnd.kenameaapp": {
    source: "iana",
    extensions: ["htke"]
  },
  "application/vnd.kidspiration": {
    source: "iana",
    extensions: ["kia"]
  },
  "application/vnd.kinar": {
    source: "iana",
    extensions: ["kne", "knp"]
  },
  "application/vnd.koan": {
    source: "iana",
    extensions: ["skp", "skd", "skt", "skm"]
  },
  "application/vnd.kodak-descriptor": {
    source: "iana",
    extensions: ["sse"]
  },
  "application/vnd.las": {
    source: "iana"
  },
  "application/vnd.las.las+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.las.las+xml": {
    source: "iana",
    compressible: true,
    extensions: ["lasxml"]
  },
  "application/vnd.laszip": {
    source: "iana"
  },
  "application/vnd.leap+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.liberty-request+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.llamagraphics.life-balance.desktop": {
    source: "iana",
    extensions: ["lbd"]
  },
  "application/vnd.llamagraphics.life-balance.exchange+xml": {
    source: "iana",
    compressible: true,
    extensions: ["lbe"]
  },
  "application/vnd.logipipe.circuit+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.loom": {
    source: "iana"
  },
  "application/vnd.lotus-1-2-3": {
    source: "iana",
    extensions: ["123"]
  },
  "application/vnd.lotus-approach": {
    source: "iana",
    extensions: ["apr"]
  },
  "application/vnd.lotus-freelance": {
    source: "iana",
    extensions: ["pre"]
  },
  "application/vnd.lotus-notes": {
    source: "iana",
    extensions: ["nsf"]
  },
  "application/vnd.lotus-organizer": {
    source: "iana",
    extensions: ["org"]
  },
  "application/vnd.lotus-screencam": {
    source: "iana",
    extensions: ["scm"]
  },
  "application/vnd.lotus-wordpro": {
    source: "iana",
    extensions: ["lwp"]
  },
  "application/vnd.macports.portpkg": {
    source: "iana",
    extensions: ["portpkg"]
  },
  "application/vnd.mapbox-vector-tile": {
    source: "iana",
    extensions: ["mvt"]
  },
  "application/vnd.marlin.drm.actiontoken+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.marlin.drm.conftoken+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.marlin.drm.license+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.marlin.drm.mdcf": {
    source: "iana"
  },
  "application/vnd.mason+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.maxar.archive.3tz+zip": {
    source: "iana",
    compressible: false
  },
  "application/vnd.maxmind.maxmind-db": {
    source: "iana"
  },
  "application/vnd.mcd": {
    source: "iana",
    extensions: ["mcd"]
  },
  "application/vnd.medcalcdata": {
    source: "iana",
    extensions: ["mc1"]
  },
  "application/vnd.mediastation.cdkey": {
    source: "iana",
    extensions: ["cdkey"]
  },
  "application/vnd.meridian-slingshot": {
    source: "iana"
  },
  "application/vnd.mfer": {
    source: "iana",
    extensions: ["mwf"]
  },
  "application/vnd.mfmp": {
    source: "iana",
    extensions: ["mfm"]
  },
  "application/vnd.micro+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.micrografx.flo": {
    source: "iana",
    extensions: ["flo"]
  },
  "application/vnd.micrografx.igx": {
    source: "iana",
    extensions: ["igx"]
  },
  "application/vnd.microsoft.portable-executable": {
    source: "iana"
  },
  "application/vnd.microsoft.windows.thumbnail-cache": {
    source: "iana"
  },
  "application/vnd.miele+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.mif": {
    source: "iana",
    extensions: ["mif"]
  },
  "application/vnd.minisoft-hp3000-save": {
    source: "iana"
  },
  "application/vnd.mitsubishi.misty-guard.trustweb": {
    source: "iana"
  },
  "application/vnd.mobius.daf": {
    source: "iana",
    extensions: ["daf"]
  },
  "application/vnd.mobius.dis": {
    source: "iana",
    extensions: ["dis"]
  },
  "application/vnd.mobius.mbk": {
    source: "iana",
    extensions: ["mbk"]
  },
  "application/vnd.mobius.mqy": {
    source: "iana",
    extensions: ["mqy"]
  },
  "application/vnd.mobius.msl": {
    source: "iana",
    extensions: ["msl"]
  },
  "application/vnd.mobius.plc": {
    source: "iana",
    extensions: ["plc"]
  },
  "application/vnd.mobius.txf": {
    source: "iana",
    extensions: ["txf"]
  },
  "application/vnd.mophun.application": {
    source: "iana",
    extensions: ["mpn"]
  },
  "application/vnd.mophun.certificate": {
    source: "iana",
    extensions: ["mpc"]
  },
  "application/vnd.motorola.flexsuite": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.adsi": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.fis": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.gotap": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.kmr": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.ttc": {
    source: "iana"
  },
  "application/vnd.motorola.flexsuite.wem": {
    source: "iana"
  },
  "application/vnd.motorola.iprm": {
    source: "iana"
  },
  "application/vnd.mozilla.xul+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xul"]
  },
  "application/vnd.ms-3mfdocument": {
    source: "iana"
  },
  "application/vnd.ms-artgalry": {
    source: "iana",
    extensions: ["cil"]
  },
  "application/vnd.ms-asf": {
    source: "iana"
  },
  "application/vnd.ms-cab-compressed": {
    source: "iana",
    extensions: ["cab"]
  },
  "application/vnd.ms-color.iccprofile": {
    source: "apache"
  },
  "application/vnd.ms-excel": {
    source: "iana",
    compressible: false,
    extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"]
  },
  "application/vnd.ms-excel.addin.macroenabled.12": {
    source: "iana",
    extensions: ["xlam"]
  },
  "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
    source: "iana",
    extensions: ["xlsb"]
  },
  "application/vnd.ms-excel.sheet.macroenabled.12": {
    source: "iana",
    extensions: ["xlsm"]
  },
  "application/vnd.ms-excel.template.macroenabled.12": {
    source: "iana",
    extensions: ["xltm"]
  },
  "application/vnd.ms-fontobject": {
    source: "iana",
    compressible: true,
    extensions: ["eot"]
  },
  "application/vnd.ms-htmlhelp": {
    source: "iana",
    extensions: ["chm"]
  },
  "application/vnd.ms-ims": {
    source: "iana",
    extensions: ["ims"]
  },
  "application/vnd.ms-lrm": {
    source: "iana",
    extensions: ["lrm"]
  },
  "application/vnd.ms-office.activex+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ms-officetheme": {
    source: "iana",
    extensions: ["thmx"]
  },
  "application/vnd.ms-opentype": {
    source: "apache",
    compressible: true
  },
  "application/vnd.ms-outlook": {
    compressible: false,
    extensions: ["msg"]
  },
  "application/vnd.ms-package.obfuscated-opentype": {
    source: "apache"
  },
  "application/vnd.ms-pki.seccat": {
    source: "apache",
    extensions: ["cat"]
  },
  "application/vnd.ms-pki.stl": {
    source: "apache",
    extensions: ["stl"]
  },
  "application/vnd.ms-playready.initiator+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ms-powerpoint": {
    source: "iana",
    compressible: false,
    extensions: ["ppt", "pps", "pot"]
  },
  "application/vnd.ms-powerpoint.addin.macroenabled.12": {
    source: "iana",
    extensions: ["ppam"]
  },
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
    source: "iana",
    extensions: ["pptm"]
  },
  "application/vnd.ms-powerpoint.slide.macroenabled.12": {
    source: "iana",
    extensions: ["sldm"]
  },
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
    source: "iana",
    extensions: ["ppsm"]
  },
  "application/vnd.ms-powerpoint.template.macroenabled.12": {
    source: "iana",
    extensions: ["potm"]
  },
  "application/vnd.ms-printdevicecapabilities+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ms-printing.printticket+xml": {
    source: "apache",
    compressible: true
  },
  "application/vnd.ms-printschematicket+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ms-project": {
    source: "iana",
    extensions: ["mpp", "mpt"]
  },
  "application/vnd.ms-tnef": {
    source: "iana"
  },
  "application/vnd.ms-windows.devicepairing": {
    source: "iana"
  },
  "application/vnd.ms-windows.nwprinting.oob": {
    source: "iana"
  },
  "application/vnd.ms-windows.printerpairing": {
    source: "iana"
  },
  "application/vnd.ms-windows.wsd.oob": {
    source: "iana"
  },
  "application/vnd.ms-wmdrm.lic-chlg-req": {
    source: "iana"
  },
  "application/vnd.ms-wmdrm.lic-resp": {
    source: "iana"
  },
  "application/vnd.ms-wmdrm.meter-chlg-req": {
    source: "iana"
  },
  "application/vnd.ms-wmdrm.meter-resp": {
    source: "iana"
  },
  "application/vnd.ms-word.document.macroenabled.12": {
    source: "iana",
    extensions: ["docm"]
  },
  "application/vnd.ms-word.template.macroenabled.12": {
    source: "iana",
    extensions: ["dotm"]
  },
  "application/vnd.ms-works": {
    source: "iana",
    extensions: ["wps", "wks", "wcm", "wdb"]
  },
  "application/vnd.ms-wpl": {
    source: "iana",
    extensions: ["wpl"]
  },
  "application/vnd.ms-xpsdocument": {
    source: "iana",
    compressible: false,
    extensions: ["xps"]
  },
  "application/vnd.msa-disk-image": {
    source: "iana"
  },
  "application/vnd.mseq": {
    source: "iana",
    extensions: ["mseq"]
  },
  "application/vnd.msign": {
    source: "iana"
  },
  "application/vnd.multiad.creator": {
    source: "iana"
  },
  "application/vnd.multiad.creator.cif": {
    source: "iana"
  },
  "application/vnd.music-niff": {
    source: "iana"
  },
  "application/vnd.musician": {
    source: "iana",
    extensions: ["mus"]
  },
  "application/vnd.muvee.style": {
    source: "iana",
    extensions: ["msty"]
  },
  "application/vnd.mynfc": {
    source: "iana",
    extensions: ["taglet"]
  },
  "application/vnd.nacamar.ybrid+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.ncd.control": {
    source: "iana"
  },
  "application/vnd.ncd.reference": {
    source: "iana"
  },
  "application/vnd.nearst.inv+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nebumind.line": {
    source: "iana"
  },
  "application/vnd.nervana": {
    source: "iana"
  },
  "application/vnd.netfpx": {
    source: "iana"
  },
  "application/vnd.neurolanguage.nlu": {
    source: "iana",
    extensions: ["nlu"]
  },
  "application/vnd.nimn": {
    source: "iana"
  },
  "application/vnd.nintendo.nitro.rom": {
    source: "iana"
  },
  "application/vnd.nintendo.snes.rom": {
    source: "iana"
  },
  "application/vnd.nitf": {
    source: "iana",
    extensions: ["ntf", "nitf"]
  },
  "application/vnd.noblenet-directory": {
    source: "iana",
    extensions: ["nnd"]
  },
  "application/vnd.noblenet-sealer": {
    source: "iana",
    extensions: ["nns"]
  },
  "application/vnd.noblenet-web": {
    source: "iana",
    extensions: ["nnw"]
  },
  "application/vnd.nokia.catalogs": {
    source: "iana"
  },
  "application/vnd.nokia.conml+wbxml": {
    source: "iana"
  },
  "application/vnd.nokia.conml+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nokia.iptv.config+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nokia.isds-radio-presets": {
    source: "iana"
  },
  "application/vnd.nokia.landmark+wbxml": {
    source: "iana"
  },
  "application/vnd.nokia.landmark+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nokia.landmarkcollection+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nokia.n-gage.ac+xml": {
    source: "iana",
    compressible: true,
    extensions: ["ac"]
  },
  "application/vnd.nokia.n-gage.data": {
    source: "iana",
    extensions: ["ngdat"]
  },
  "application/vnd.nokia.n-gage.symbian.install": {
    source: "apache",
    extensions: ["n-gage"]
  },
  "application/vnd.nokia.ncd": {
    source: "iana"
  },
  "application/vnd.nokia.pcd+wbxml": {
    source: "iana"
  },
  "application/vnd.nokia.pcd+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.nokia.radio-preset": {
    source: "iana",
    extensions: ["rpst"]
  },
  "application/vnd.nokia.radio-presets": {
    source: "iana",
    extensions: ["rpss"]
  },
  "application/vnd.novadigm.edm": {
    source: "iana",
    extensions: ["edm"]
  },
  "application/vnd.novadigm.edx": {
    source: "iana",
    extensions: ["edx"]
  },
  "application/vnd.novadigm.ext": {
    source: "iana",
    extensions: ["ext"]
  },
  "application/vnd.ntt-local.content-share": {
    source: "iana"
  },
  "application/vnd.ntt-local.file-transfer": {
    source: "iana"
  },
  "application/vnd.ntt-local.ogw_remote-access": {
    source: "iana"
  },
  "application/vnd.ntt-local.sip-ta_remote": {
    source: "iana"
  },
  "application/vnd.ntt-local.sip-ta_tcp_stream": {
    source: "iana"
  },
  "application/vnd.oasis.opendocument.chart": {
    source: "iana",
    extensions: ["odc"]
  },
  "application/vnd.oasis.opendocument.chart-template": {
    source: "iana",
    extensions: ["otc"]
  },
  "application/vnd.oasis.opendocument.database": {
    source: "iana",
    extensions: ["odb"]
  },
  "application/vnd.oasis.opendocument.formula": {
    source: "iana",
    extensions: ["odf"]
  },
  "application/vnd.oasis.opendocument.formula-template": {
    source: "iana",
    extensions: ["odft"]
  },
  "application/vnd.oasis.opendocument.graphics": {
    source: "iana",
    compressible: false,
    extensions: ["odg"]
  },
  "application/vnd.oasis.opendocument.graphics-template": {
    source: "iana",
    extensions: ["otg"]
  },
  "application/vnd.oasis.opendocument.image": {
    source: "iana",
    extensions: ["odi"]
  },
  "application/vnd.oasis.opendocument.image-template": {
    source: "iana",
    extensions: ["oti"]
  },
  "application/vnd.oasis.opendocument.presentation": {
    source: "iana",
    compressible: false,
    extensions: ["odp"]
  },
  "application/vnd.oasis.opendocument.presentation-template": {
    source: "iana",
    extensions: ["otp"]
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    source: "iana",
    compressible: false,
    extensions: ["ods"]
  },
  "application/vnd.oasis.opendocument.spreadsheet-template": {
    source: "iana",
    extensions: ["ots"]
  },
  "application/vnd.oasis.opendocument.text": {
    source: "iana",
    compressible: false,
    extensions: ["odt"]
  },
  "application/vnd.oasis.opendocument.text-master": {
    source: "iana",
    extensions: ["odm"]
  },
  "application/vnd.oasis.opendocument.text-template": {
    source: "iana",
    extensions: ["ott"]
  },
  "application/vnd.oasis.opendocument.text-web": {
    source: "iana",
    extensions: ["oth"]
  },
  "application/vnd.obn": {
    source: "iana"
  },
  "application/vnd.ocf+cbor": {
    source: "iana"
  },
  "application/vnd.oci.image.manifest.v1+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oftn.l10n+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.contentaccessdownload+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.contentaccessstreaming+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.cspg-hexbinary": {
    source: "iana"
  },
  "application/vnd.oipf.dae.svg+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.dae.xhtml+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.mippvcontrolmessage+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.pae.gem": {
    source: "iana"
  },
  "application/vnd.oipf.spdiscovery+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.spdlist+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.ueprofile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oipf.userprofile+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.olpc-sugar": {
    source: "iana",
    extensions: ["xo"]
  },
  "application/vnd.oma-scws-config": {
    source: "iana"
  },
  "application/vnd.oma-scws-http-request": {
    source: "iana"
  },
  "application/vnd.oma-scws-http-response": {
    source: "iana"
  },
  "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.bcast.drm-trigger+xml": {
    source: "apache",
    compressible: true
  },
  "application/vnd.oma.bcast.imd+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.bcast.ltkm": {
    source: "iana"
  },
  "application/vnd.oma.bcast.notification+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.bcast.provisioningtrigger": {
    source: "iana"
  },
  "application/vnd.oma.bcast.sgboot": {
    source: "iana"
  },
  "application/vnd.oma.bcast.sgdd+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.bcast.sgdu": {
    source: "iana"
  },
  "application/vnd.oma.bcast.simple-symbol-container": {
    source: "iana"
  },
  "application/vnd.oma.bcast.smartcard-trigger+xml": {
    source: "apache",
    compressible: true
  },
  "application/vnd.oma.bcast.sprov+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.bcast.stkm": {
    source: "iana"
  },
  "application/vnd.oma.cab-address-book+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.cab-feature-handler+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.cab-pcc+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.cab-subs-invite+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.cab-user-prefs+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.dcd": {
    source: "iana"
  },
  "application/vnd.oma.dcdc": {
    source: "iana"
  },
  "application/vnd.oma.dd2+xml": {
    source: "iana",
    compressible: true,
    extensions: ["dd2"]
  },
  "application/vnd.oma.drm.risd+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.group-usage-list+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.lwm2m+cbor": {
    source: "iana"
  },
  "application/vnd.oma.lwm2m+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.lwm2m+tlv": {
    source: "iana"
  },
  "application/vnd.oma.pal+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.poc.detailed-progress-report+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.poc.final-report+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.poc.groups+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.poc.invocation-descriptor+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.poc.optimized-progress-report+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.push": {
    source: "iana"
  },
  "application/vnd.oma.scidm.messages+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oma.xcap-directory+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.omads-email+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/vnd.omads-file+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/vnd.omads-folder+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/vnd.omaloc-supl-init": {
    source: "iana"
  },
  "application/vnd.onepager": {
    source: "iana"
  },
  "application/vnd.onepagertamp": {
    source: "iana"
  },
  "application/vnd.onepagertamx": {
    source: "iana"
  },
  "application/vnd.onepagertat": {
    source: "iana"
  },
  "application/vnd.onepagertatp": {
    source: "iana"
  },
  "application/vnd.onepagertatx": {
    source: "iana"
  },
  "application/vnd.onvif.metadata": {
    source: "iana"
  },
  "application/vnd.openblox.game+xml": {
    source: "iana",
    compressible: true,
    extensions: ["obgx"]
  },
  "application/vnd.openblox.game-binary": {
    source: "iana"
  },
  "application/vnd.openeye.oeb": {
    source: "iana"
  },
  "application/vnd.openofficeorg.extension": {
    source: "apache",
    extensions: ["oxt"]
  },
  "application/vnd.openstreetmap.data+xml": {
    source: "iana",
    compressible: true,
    extensions: ["osm"]
  },
  "application/vnd.opentimestamps.ots": {
    source: "iana"
  },
  "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawing+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    source: "iana",
    compressible: false,
    extensions: ["pptx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide": {
    source: "iana",
    extensions: ["sldx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
    source: "iana",
    extensions: ["ppsx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template": {
    source: "iana",
    extensions: ["potx"]
  },
  "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    source: "iana",
    compressible: false,
    extensions: ["xlsx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
    source: "iana",
    extensions: ["xltx"]
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.theme+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.vmldrawing": {
    source: "iana"
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    source: "iana",
    compressible: false,
    extensions: ["docx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
    source: "iana",
    extensions: ["dotx"]
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-package.core-properties+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.openxmlformats-package.relationships+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oracle.resource+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.orange.indata": {
    source: "iana"
  },
  "application/vnd.osa.netdeploy": {
    source: "iana"
  },
  "application/vnd.osgeo.mapguide.package": {
    source: "iana",
    extensions: ["mgp"]
  },
  "application/vnd.osgi.bundle": {
    source: "iana"
  },
  "application/vnd.osgi.dp": {
    source: "iana",
    extensions: ["dp"]
  },
  "application/vnd.osgi.subsystem": {
    source: "iana",
    extensions: ["esa"]
  },
  "application/vnd.otps.ct-kip+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.oxli.countgraph": {
    source: "iana"
  },
  "application/vnd.pagerduty+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.palm": {
    source: "iana",
    extensions: ["pdb", "pqa", "oprc"]
  },
  "application/vnd.panoply": {
    source: "iana"
  },
  "application/vnd.paos.xml": {
    source: "iana"
  },
  "application/vnd.patentdive": {
    source: "iana"
  },
  "application/vnd.patientecommsdoc": {
    source: "iana"
  },
  "application/vnd.pawaafile": {
    source: "iana",
    extensions: ["paw"]
  },
  "application/vnd.pcos": {
    source: "iana"
  },
  "application/vnd.pg.format": {
    source: "iana",
    extensions: ["str"]
  },
  "application/vnd.pg.osasli": {
    source: "iana",
    extensions: ["ei6"]
  },
  "application/vnd.piaccess.application-licence": {
    source: "iana"
  },
  "application/vnd.picsel": {
    source: "iana",
    extensions: ["efif"]
  },
  "application/vnd.pmi.widget": {
    source: "iana",
    extensions: ["wg"]
  },
  "application/vnd.poc.group-advertisement+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.pocketlearn": {
    source: "iana",
    extensions: ["plf"]
  },
  "application/vnd.powerbuilder6": {
    source: "iana",
    extensions: ["pbd"]
  },
  "application/vnd.powerbuilder6-s": {
    source: "iana"
  },
  "application/vnd.powerbuilder7": {
    source: "iana"
  },
  "application/vnd.powerbuilder7-s": {
    source: "iana"
  },
  "application/vnd.powerbuilder75": {
    source: "iana"
  },
  "application/vnd.powerbuilder75-s": {
    source: "iana"
  },
  "application/vnd.preminet": {
    source: "iana"
  },
  "application/vnd.previewsystems.box": {
    source: "iana",
    extensions: ["box"]
  },
  "application/vnd.proteus.magazine": {
    source: "iana",
    extensions: ["mgz"]
  },
  "application/vnd.psfs": {
    source: "iana"
  },
  "application/vnd.publishare-delta-tree": {
    source: "iana",
    extensions: ["qps"]
  },
  "application/vnd.pvi.ptid1": {
    source: "iana",
    extensions: ["ptid"]
  },
  "application/vnd.pwg-multiplexed": {
    source: "iana"
  },
  "application/vnd.pwg-xhtml-print+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xhtm"]
  },
  "application/vnd.qualcomm.brew-app-res": {
    source: "iana"
  },
  "application/vnd.quarantainenet": {
    source: "iana"
  },
  "application/vnd.quark.quarkxpress": {
    source: "iana",
    extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"]
  },
  "application/vnd.quobject-quoxdocument": {
    source: "iana"
  },
  "application/vnd.radisys.moml+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-audit+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-audit-conf+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-audit-conn+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-audit-dialog+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-audit-stream+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-conf+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-base+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-fax-detect+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-group+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-speech+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.radisys.msml-dialog-transform+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.rainstor.data": {
    source: "iana"
  },
  "application/vnd.rapid": {
    source: "iana"
  },
  "application/vnd.rar": {
    source: "iana",
    extensions: ["rar"]
  },
  "application/vnd.realvnc.bed": {
    source: "iana",
    extensions: ["bed"]
  },
  "application/vnd.recordare.musicxml": {
    source: "iana",
    extensions: ["mxl"]
  },
  "application/vnd.recordare.musicxml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["musicxml"]
  },
  "application/vnd.renlearn.rlprint": {
    source: "iana"
  },
  "application/vnd.resilient.logic": {
    source: "iana"
  },
  "application/vnd.restful+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.rig.cryptonote": {
    source: "iana",
    extensions: ["cryptonote"]
  },
  "application/vnd.rim.cod": {
    source: "apache",
    extensions: ["cod"]
  },
  "application/vnd.rn-realmedia": {
    source: "apache",
    extensions: ["rm"]
  },
  "application/vnd.rn-realmedia-vbr": {
    source: "apache",
    extensions: ["rmvb"]
  },
  "application/vnd.route66.link66+xml": {
    source: "iana",
    compressible: true,
    extensions: ["link66"]
  },
  "application/vnd.rs-274x": {
    source: "iana"
  },
  "application/vnd.ruckus.download": {
    source: "iana"
  },
  "application/vnd.s3sms": {
    source: "iana"
  },
  "application/vnd.sailingtracker.track": {
    source: "iana",
    extensions: ["st"]
  },
  "application/vnd.sar": {
    source: "iana"
  },
  "application/vnd.sbm.cid": {
    source: "iana"
  },
  "application/vnd.sbm.mid2": {
    source: "iana"
  },
  "application/vnd.scribus": {
    source: "iana"
  },
  "application/vnd.sealed.3df": {
    source: "iana"
  },
  "application/vnd.sealed.csf": {
    source: "iana"
  },
  "application/vnd.sealed.doc": {
    source: "iana"
  },
  "application/vnd.sealed.eml": {
    source: "iana"
  },
  "application/vnd.sealed.mht": {
    source: "iana"
  },
  "application/vnd.sealed.net": {
    source: "iana"
  },
  "application/vnd.sealed.ppt": {
    source: "iana"
  },
  "application/vnd.sealed.tiff": {
    source: "iana"
  },
  "application/vnd.sealed.xls": {
    source: "iana"
  },
  "application/vnd.sealedmedia.softseal.html": {
    source: "iana"
  },
  "application/vnd.sealedmedia.softseal.pdf": {
    source: "iana"
  },
  "application/vnd.seemail": {
    source: "iana",
    extensions: ["see"]
  },
  "application/vnd.seis+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.sema": {
    source: "iana",
    extensions: ["sema"]
  },
  "application/vnd.semd": {
    source: "iana",
    extensions: ["semd"]
  },
  "application/vnd.semf": {
    source: "iana",
    extensions: ["semf"]
  },
  "application/vnd.shade-save-file": {
    source: "iana"
  },
  "application/vnd.shana.informed.formdata": {
    source: "iana",
    extensions: ["ifm"]
  },
  "application/vnd.shana.informed.formtemplate": {
    source: "iana",
    extensions: ["itp"]
  },
  "application/vnd.shana.informed.interchange": {
    source: "iana",
    extensions: ["iif"]
  },
  "application/vnd.shana.informed.package": {
    source: "iana",
    extensions: ["ipk"]
  },
  "application/vnd.shootproof+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.shopkick+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.shp": {
    source: "iana"
  },
  "application/vnd.shx": {
    source: "iana"
  },
  "application/vnd.sigrok.session": {
    source: "iana"
  },
  "application/vnd.simtech-mindmapper": {
    source: "iana",
    extensions: ["twd", "twds"]
  },
  "application/vnd.siren+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.smaf": {
    source: "iana",
    extensions: ["mmf"]
  },
  "application/vnd.smart.notebook": {
    source: "iana"
  },
  "application/vnd.smart.teacher": {
    source: "iana",
    extensions: ["teacher"]
  },
  "application/vnd.snesdev-page-table": {
    source: "iana"
  },
  "application/vnd.software602.filler.form+xml": {
    source: "iana",
    compressible: true,
    extensions: ["fo"]
  },
  "application/vnd.software602.filler.form-xml-zip": {
    source: "iana"
  },
  "application/vnd.solent.sdkm+xml": {
    source: "iana",
    compressible: true,
    extensions: ["sdkm", "sdkd"]
  },
  "application/vnd.spotfire.dxp": {
    source: "iana",
    extensions: ["dxp"]
  },
  "application/vnd.spotfire.sfs": {
    source: "iana",
    extensions: ["sfs"]
  },
  "application/vnd.sqlite3": {
    source: "iana"
  },
  "application/vnd.sss-cod": {
    source: "iana"
  },
  "application/vnd.sss-dtf": {
    source: "iana"
  },
  "application/vnd.sss-ntf": {
    source: "iana"
  },
  "application/vnd.stardivision.calc": {
    source: "apache",
    extensions: ["sdc"]
  },
  "application/vnd.stardivision.draw": {
    source: "apache",
    extensions: ["sda"]
  },
  "application/vnd.stardivision.impress": {
    source: "apache",
    extensions: ["sdd"]
  },
  "application/vnd.stardivision.math": {
    source: "apache",
    extensions: ["smf"]
  },
  "application/vnd.stardivision.writer": {
    source: "apache",
    extensions: ["sdw", "vor"]
  },
  "application/vnd.stardivision.writer-global": {
    source: "apache",
    extensions: ["sgl"]
  },
  "application/vnd.stepmania.package": {
    source: "iana",
    extensions: ["smzip"]
  },
  "application/vnd.stepmania.stepchart": {
    source: "iana",
    extensions: ["sm"]
  },
  "application/vnd.street-stream": {
    source: "iana"
  },
  "application/vnd.sun.wadl+xml": {
    source: "iana",
    compressible: true,
    extensions: ["wadl"]
  },
  "application/vnd.sun.xml.calc": {
    source: "apache",
    extensions: ["sxc"]
  },
  "application/vnd.sun.xml.calc.template": {
    source: "apache",
    extensions: ["stc"]
  },
  "application/vnd.sun.xml.draw": {
    source: "apache",
    extensions: ["sxd"]
  },
  "application/vnd.sun.xml.draw.template": {
    source: "apache",
    extensions: ["std"]
  },
  "application/vnd.sun.xml.impress": {
    source: "apache",
    extensions: ["sxi"]
  },
  "application/vnd.sun.xml.impress.template": {
    source: "apache",
    extensions: ["sti"]
  },
  "application/vnd.sun.xml.math": {
    source: "apache",
    extensions: ["sxm"]
  },
  "application/vnd.sun.xml.writer": {
    source: "apache",
    extensions: ["sxw"]
  },
  "application/vnd.sun.xml.writer.global": {
    source: "apache",
    extensions: ["sxg"]
  },
  "application/vnd.sun.xml.writer.template": {
    source: "apache",
    extensions: ["stw"]
  },
  "application/vnd.sus-calendar": {
    source: "iana",
    extensions: ["sus", "susp"]
  },
  "application/vnd.svd": {
    source: "iana",
    extensions: ["svd"]
  },
  "application/vnd.swiftview-ics": {
    source: "iana"
  },
  "application/vnd.sycle+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.syft+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.symbian.install": {
    source: "apache",
    extensions: ["sis", "sisx"]
  },
  "application/vnd.syncml+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["xsm"]
  },
  "application/vnd.syncml.dm+wbxml": {
    source: "iana",
    charset: "UTF-8",
    extensions: ["bdm"]
  },
  "application/vnd.syncml.dm+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["xdm"]
  },
  "application/vnd.syncml.dm.notification": {
    source: "iana"
  },
  "application/vnd.syncml.dmddf+wbxml": {
    source: "iana"
  },
  "application/vnd.syncml.dmddf+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["ddf"]
  },
  "application/vnd.syncml.dmtnds+wbxml": {
    source: "iana"
  },
  "application/vnd.syncml.dmtnds+xml": {
    source: "iana",
    charset: "UTF-8",
    compressible: true
  },
  "application/vnd.syncml.ds.notification": {
    source: "iana"
  },
  "application/vnd.tableschema+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.tao.intent-module-archive": {
    source: "iana",
    extensions: ["tao"]
  },
  "application/vnd.tcpdump.pcap": {
    source: "iana",
    extensions: ["pcap", "cap", "dmp"]
  },
  "application/vnd.think-cell.ppttc+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.tmd.mediaflex.api+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.tml": {
    source: "iana"
  },
  "application/vnd.tmobile-livetv": {
    source: "iana",
    extensions: ["tmo"]
  },
  "application/vnd.tri.onesource": {
    source: "iana"
  },
  "application/vnd.trid.tpt": {
    source: "iana",
    extensions: ["tpt"]
  },
  "application/vnd.triscape.mxs": {
    source: "iana",
    extensions: ["mxs"]
  },
  "application/vnd.trueapp": {
    source: "iana",
    extensions: ["tra"]
  },
  "application/vnd.truedoc": {
    source: "iana"
  },
  "application/vnd.ubisoft.webplayer": {
    source: "iana"
  },
  "application/vnd.ufdl": {
    source: "iana",
    extensions: ["ufd", "ufdl"]
  },
  "application/vnd.uiq.theme": {
    source: "iana",
    extensions: ["utz"]
  },
  "application/vnd.umajin": {
    source: "iana",
    extensions: ["umj"]
  },
  "application/vnd.unity": {
    source: "iana",
    extensions: ["unityweb"]
  },
  "application/vnd.uoml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["uoml", "uo"]
  },
  "application/vnd.uplanet.alert": {
    source: "iana"
  },
  "application/vnd.uplanet.alert-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.bearer-choice": {
    source: "iana"
  },
  "application/vnd.uplanet.bearer-choice-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.cacheop": {
    source: "iana"
  },
  "application/vnd.uplanet.cacheop-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.channel": {
    source: "iana"
  },
  "application/vnd.uplanet.channel-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.list": {
    source: "iana"
  },
  "application/vnd.uplanet.list-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.listcmd": {
    source: "iana"
  },
  "application/vnd.uplanet.listcmd-wbxml": {
    source: "iana"
  },
  "application/vnd.uplanet.signal": {
    source: "iana"
  },
  "application/vnd.uri-map": {
    source: "iana"
  },
  "application/vnd.valve.source.material": {
    source: "iana"
  },
  "application/vnd.vcx": {
    source: "iana",
    extensions: ["vcx"]
  },
  "application/vnd.vd-study": {
    source: "iana"
  },
  "application/vnd.vectorworks": {
    source: "iana"
  },
  "application/vnd.vel+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.verimatrix.vcas": {
    source: "iana"
  },
  "application/vnd.veritone.aion+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.veryant.thin": {
    source: "iana"
  },
  "application/vnd.ves.encrypted": {
    source: "iana"
  },
  "application/vnd.vidsoft.vidconference": {
    source: "iana"
  },
  "application/vnd.visio": {
    source: "iana",
    extensions: ["vsd", "vst", "vss", "vsw"]
  },
  "application/vnd.visionary": {
    source: "iana",
    extensions: ["vis"]
  },
  "application/vnd.vividence.scriptfile": {
    source: "iana"
  },
  "application/vnd.vsf": {
    source: "iana",
    extensions: ["vsf"]
  },
  "application/vnd.wap.sic": {
    source: "iana"
  },
  "application/vnd.wap.slc": {
    source: "iana"
  },
  "application/vnd.wap.wbxml": {
    source: "iana",
    charset: "UTF-8",
    extensions: ["wbxml"]
  },
  "application/vnd.wap.wmlc": {
    source: "iana",
    extensions: ["wmlc"]
  },
  "application/vnd.wap.wmlscriptc": {
    source: "iana",
    extensions: ["wmlsc"]
  },
  "application/vnd.webturbo": {
    source: "iana",
    extensions: ["wtb"]
  },
  "application/vnd.wfa.dpp": {
    source: "iana"
  },
  "application/vnd.wfa.p2p": {
    source: "iana"
  },
  "application/vnd.wfa.wsc": {
    source: "iana"
  },
  "application/vnd.windows.devicepairing": {
    source: "iana"
  },
  "application/vnd.wmc": {
    source: "iana"
  },
  "application/vnd.wmf.bootstrap": {
    source: "iana"
  },
  "application/vnd.wolfram.mathematica": {
    source: "iana"
  },
  "application/vnd.wolfram.mathematica.package": {
    source: "iana"
  },
  "application/vnd.wolfram.player": {
    source: "iana",
    extensions: ["nbp"]
  },
  "application/vnd.wordperfect": {
    source: "iana",
    extensions: ["wpd"]
  },
  "application/vnd.wqd": {
    source: "iana",
    extensions: ["wqd"]
  },
  "application/vnd.wrq-hp3000-labelled": {
    source: "iana"
  },
  "application/vnd.wt.stf": {
    source: "iana",
    extensions: ["stf"]
  },
  "application/vnd.wv.csp+wbxml": {
    source: "iana"
  },
  "application/vnd.wv.csp+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.wv.ssp+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.xacml+json": {
    source: "iana",
    compressible: true
  },
  "application/vnd.xara": {
    source: "iana",
    extensions: ["xar"]
  },
  "application/vnd.xfdl": {
    source: "iana",
    extensions: ["xfdl"]
  },
  "application/vnd.xfdl.webform": {
    source: "iana"
  },
  "application/vnd.xmi+xml": {
    source: "iana",
    compressible: true
  },
  "application/vnd.xmpie.cpkg": {
    source: "iana"
  },
  "application/vnd.xmpie.dpkg": {
    source: "iana"
  },
  "application/vnd.xmpie.plan": {
    source: "iana"
  },
  "application/vnd.xmpie.ppkg": {
    source: "iana"
  },
  "application/vnd.xmpie.xlim": {
    source: "iana"
  },
  "application/vnd.yamaha.hv-dic": {
    source: "iana",
    extensions: ["hvd"]
  },
  "application/vnd.yamaha.hv-script": {
    source: "iana",
    extensions: ["hvs"]
  },
  "application/vnd.yamaha.hv-voice": {
    source: "iana",
    extensions: ["hvp"]
  },
  "application/vnd.yamaha.openscoreformat": {
    source: "iana",
    extensions: ["osf"]
  },
  "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
    source: "iana",
    compressible: true,
    extensions: ["osfpvg"]
  },
  "application/vnd.yamaha.remote-setup": {
    source: "iana"
  },
  "application/vnd.yamaha.smaf-audio": {
    source: "iana",
    extensions: ["saf"]
  },
  "application/vnd.yamaha.smaf-phrase": {
    source: "iana",
    extensions: ["spf"]
  },
  "application/vnd.yamaha.through-ngn": {
    source: "iana"
  },
  "application/vnd.yamaha.tunnel-udpencap": {
    source: "iana"
  },
  "application/vnd.yaoweme": {
    source: "iana"
  },
  "application/vnd.yellowriver-custom-menu": {
    source: "iana",
    extensions: ["cmp"]
  },
  "application/vnd.zul": {
    source: "iana",
    extensions: ["zir", "zirz"]
  },
  "application/vnd.zzazz.deck+xml": {
    source: "iana",
    compressible: true,
    extensions: ["zaz"]
  },
  "application/voicexml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["vxml"]
  },
  "application/voucher-cms+json": {
    source: "iana",
    compressible: true
  },
  "application/vq-rtcpxr": {
    source: "iana"
  },
  "application/wasm": {
    source: "iana",
    compressible: true,
    extensions: ["wasm"]
  },
  "application/watcherinfo+xml": {
    source: "iana",
    compressible: true,
    extensions: ["wif"]
  },
  "application/webpush-options+json": {
    source: "iana",
    compressible: true
  },
  "application/whoispp-query": {
    source: "iana"
  },
  "application/whoispp-response": {
    source: "iana"
  },
  "application/widget": {
    source: "iana",
    extensions: ["wgt"]
  },
  "application/winhlp": {
    source: "apache",
    extensions: ["hlp"]
  },
  "application/wita": {
    source: "iana"
  },
  "application/wordperfect5.1": {
    source: "iana"
  },
  "application/wsdl+xml": {
    source: "iana",
    compressible: true,
    extensions: ["wsdl"]
  },
  "application/wspolicy+xml": {
    source: "iana",
    compressible: true,
    extensions: ["wspolicy"]
  },
  "application/x-7z-compressed": {
    source: "apache",
    compressible: false,
    extensions: ["7z"]
  },
  "application/x-abiword": {
    source: "apache",
    extensions: ["abw"]
  },
  "application/x-ace-compressed": {
    source: "apache",
    extensions: ["ace"]
  },
  "application/x-amf": {
    source: "apache"
  },
  "application/x-apple-diskimage": {
    source: "apache",
    extensions: ["dmg"]
  },
  "application/x-arj": {
    compressible: false,
    extensions: ["arj"]
  },
  "application/x-authorware-bin": {
    source: "apache",
    extensions: ["aab", "x32", "u32", "vox"]
  },
  "application/x-authorware-map": {
    source: "apache",
    extensions: ["aam"]
  },
  "application/x-authorware-seg": {
    source: "apache",
    extensions: ["aas"]
  },
  "application/x-bcpio": {
    source: "apache",
    extensions: ["bcpio"]
  },
  "application/x-bdoc": {
    compressible: false,
    extensions: ["bdoc"]
  },
  "application/x-bittorrent": {
    source: "apache",
    extensions: ["torrent"]
  },
  "application/x-blorb": {
    source: "apache",
    extensions: ["blb", "blorb"]
  },
  "application/x-bzip": {
    source: "apache",
    compressible: false,
    extensions: ["bz"]
  },
  "application/x-bzip2": {
    source: "apache",
    compressible: false,
    extensions: ["bz2", "boz"]
  },
  "application/x-cbr": {
    source: "apache",
    extensions: ["cbr", "cba", "cbt", "cbz", "cb7"]
  },
  "application/x-cdlink": {
    source: "apache",
    extensions: ["vcd"]
  },
  "application/x-cfs-compressed": {
    source: "apache",
    extensions: ["cfs"]
  },
  "application/x-chat": {
    source: "apache",
    extensions: ["chat"]
  },
  "application/x-chess-pgn": {
    source: "apache",
    extensions: ["pgn"]
  },
  "application/x-chrome-extension": {
    extensions: ["crx"]
  },
  "application/x-cocoa": {
    source: "nginx",
    extensions: ["cco"]
  },
  "application/x-compress": {
    source: "apache"
  },
  "application/x-conference": {
    source: "apache",
    extensions: ["nsc"]
  },
  "application/x-cpio": {
    source: "apache",
    extensions: ["cpio"]
  },
  "application/x-csh": {
    source: "apache",
    extensions: ["csh"]
  },
  "application/x-deb": {
    compressible: false
  },
  "application/x-debian-package": {
    source: "apache",
    extensions: ["deb", "udeb"]
  },
  "application/x-dgc-compressed": {
    source: "apache",
    extensions: ["dgc"]
  },
  "application/x-director": {
    source: "apache",
    extensions: ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"]
  },
  "application/x-doom": {
    source: "apache",
    extensions: ["wad"]
  },
  "application/x-dtbncx+xml": {
    source: "apache",
    compressible: true,
    extensions: ["ncx"]
  },
  "application/x-dtbook+xml": {
    source: "apache",
    compressible: true,
    extensions: ["dtb"]
  },
  "application/x-dtbresource+xml": {
    source: "apache",
    compressible: true,
    extensions: ["res"]
  },
  "application/x-dvi": {
    source: "apache",
    compressible: false,
    extensions: ["dvi"]
  },
  "application/x-envoy": {
    source: "apache",
    extensions: ["evy"]
  },
  "application/x-eva": {
    source: "apache",
    extensions: ["eva"]
  },
  "application/x-font-bdf": {
    source: "apache",
    extensions: ["bdf"]
  },
  "application/x-font-dos": {
    source: "apache"
  },
  "application/x-font-framemaker": {
    source: "apache"
  },
  "application/x-font-ghostscript": {
    source: "apache",
    extensions: ["gsf"]
  },
  "application/x-font-libgrx": {
    source: "apache"
  },
  "application/x-font-linux-psf": {
    source: "apache",
    extensions: ["psf"]
  },
  "application/x-font-pcf": {
    source: "apache",
    extensions: ["pcf"]
  },
  "application/x-font-snf": {
    source: "apache",
    extensions: ["snf"]
  },
  "application/x-font-speedo": {
    source: "apache"
  },
  "application/x-font-sunos-news": {
    source: "apache"
  },
  "application/x-font-type1": {
    source: "apache",
    extensions: ["pfa", "pfb", "pfm", "afm"]
  },
  "application/x-font-vfont": {
    source: "apache"
  },
  "application/x-freearc": {
    source: "apache",
    extensions: ["arc"]
  },
  "application/x-futuresplash": {
    source: "apache",
    extensions: ["spl"]
  },
  "application/x-gca-compressed": {
    source: "apache",
    extensions: ["gca"]
  },
  "application/x-glulx": {
    source: "apache",
    extensions: ["ulx"]
  },
  "application/x-gnumeric": {
    source: "apache",
    extensions: ["gnumeric"]
  },
  "application/x-gramps-xml": {
    source: "apache",
    extensions: ["gramps"]
  },
  "application/x-gtar": {
    source: "apache",
    extensions: ["gtar"]
  },
  "application/x-gzip": {
    source: "apache"
  },
  "application/x-hdf": {
    source: "apache",
    extensions: ["hdf"]
  },
  "application/x-httpd-php": {
    compressible: true,
    extensions: ["php"]
  },
  "application/x-install-instructions": {
    source: "apache",
    extensions: ["install"]
  },
  "application/x-iso9660-image": {
    source: "apache",
    extensions: ["iso"]
  },
  "application/x-iwork-keynote-sffkey": {
    extensions: ["key"]
  },
  "application/x-iwork-numbers-sffnumbers": {
    extensions: ["numbers"]
  },
  "application/x-iwork-pages-sffpages": {
    extensions: ["pages"]
  },
  "application/x-java-archive-diff": {
    source: "nginx",
    extensions: ["jardiff"]
  },
  "application/x-java-jnlp-file": {
    source: "apache",
    compressible: false,
    extensions: ["jnlp"]
  },
  "application/x-javascript": {
    compressible: true
  },
  "application/x-keepass2": {
    extensions: ["kdbx"]
  },
  "application/x-latex": {
    source: "apache",
    compressible: false,
    extensions: ["latex"]
  },
  "application/x-lua-bytecode": {
    extensions: ["luac"]
  },
  "application/x-lzh-compressed": {
    source: "apache",
    extensions: ["lzh", "lha"]
  },
  "application/x-makeself": {
    source: "nginx",
    extensions: ["run"]
  },
  "application/x-mie": {
    source: "apache",
    extensions: ["mie"]
  },
  "application/x-mobipocket-ebook": {
    source: "apache",
    extensions: ["prc", "mobi"]
  },
  "application/x-mpegurl": {
    compressible: false
  },
  "application/x-ms-application": {
    source: "apache",
    extensions: ["application"]
  },
  "application/x-ms-shortcut": {
    source: "apache",
    extensions: ["lnk"]
  },
  "application/x-ms-wmd": {
    source: "apache",
    extensions: ["wmd"]
  },
  "application/x-ms-wmz": {
    source: "apache",
    extensions: ["wmz"]
  },
  "application/x-ms-xbap": {
    source: "apache",
    extensions: ["xbap"]
  },
  "application/x-msaccess": {
    source: "apache",
    extensions: ["mdb"]
  },
  "application/x-msbinder": {
    source: "apache",
    extensions: ["obd"]
  },
  "application/x-mscardfile": {
    source: "apache",
    extensions: ["crd"]
  },
  "application/x-msclip": {
    source: "apache",
    extensions: ["clp"]
  },
  "application/x-msdos-program": {
    extensions: ["exe"]
  },
  "application/x-msdownload": {
    source: "apache",
    extensions: ["exe", "dll", "com", "bat", "msi"]
  },
  "application/x-msmediaview": {
    source: "apache",
    extensions: ["mvb", "m13", "m14"]
  },
  "application/x-msmetafile": {
    source: "apache",
    extensions: ["wmf", "wmz", "emf", "emz"]
  },
  "application/x-msmoney": {
    source: "apache",
    extensions: ["mny"]
  },
  "application/x-mspublisher": {
    source: "apache",
    extensions: ["pub"]
  },
  "application/x-msschedule": {
    source: "apache",
    extensions: ["scd"]
  },
  "application/x-msterminal": {
    source: "apache",
    extensions: ["trm"]
  },
  "application/x-mswrite": {
    source: "apache",
    extensions: ["wri"]
  },
  "application/x-netcdf": {
    source: "apache",
    extensions: ["nc", "cdf"]
  },
  "application/x-ns-proxy-autoconfig": {
    compressible: true,
    extensions: ["pac"]
  },
  "application/x-nzb": {
    source: "apache",
    extensions: ["nzb"]
  },
  "application/x-perl": {
    source: "nginx",
    extensions: ["pl", "pm"]
  },
  "application/x-pilot": {
    source: "nginx",
    extensions: ["prc", "pdb"]
  },
  "application/x-pkcs12": {
    source: "apache",
    compressible: false,
    extensions: ["p12", "pfx"]
  },
  "application/x-pkcs7-certificates": {
    source: "apache",
    extensions: ["p7b", "spc"]
  },
  "application/x-pkcs7-certreqresp": {
    source: "apache",
    extensions: ["p7r"]
  },
  "application/x-pki-message": {
    source: "iana"
  },
  "application/x-rar-compressed": {
    source: "apache",
    compressible: false,
    extensions: ["rar"]
  },
  "application/x-redhat-package-manager": {
    source: "nginx",
    extensions: ["rpm"]
  },
  "application/x-research-info-systems": {
    source: "apache",
    extensions: ["ris"]
  },
  "application/x-sea": {
    source: "nginx",
    extensions: ["sea"]
  },
  "application/x-sh": {
    source: "apache",
    compressible: true,
    extensions: ["sh"]
  },
  "application/x-shar": {
    source: "apache",
    extensions: ["shar"]
  },
  "application/x-shockwave-flash": {
    source: "apache",
    compressible: false,
    extensions: ["swf"]
  },
  "application/x-silverlight-app": {
    source: "apache",
    extensions: ["xap"]
  },
  "application/x-sql": {
    source: "apache",
    extensions: ["sql"]
  },
  "application/x-stuffit": {
    source: "apache",
    compressible: false,
    extensions: ["sit"]
  },
  "application/x-stuffitx": {
    source: "apache",
    extensions: ["sitx"]
  },
  "application/x-subrip": {
    source: "apache",
    extensions: ["srt"]
  },
  "application/x-sv4cpio": {
    source: "apache",
    extensions: ["sv4cpio"]
  },
  "application/x-sv4crc": {
    source: "apache",
    extensions: ["sv4crc"]
  },
  "application/x-t3vm-image": {
    source: "apache",
    extensions: ["t3"]
  },
  "application/x-tads": {
    source: "apache",
    extensions: ["gam"]
  },
  "application/x-tar": {
    source: "apache",
    compressible: true,
    extensions: ["tar"]
  },
  "application/x-tcl": {
    source: "apache",
    extensions: ["tcl", "tk"]
  },
  "application/x-tex": {
    source: "apache",
    extensions: ["tex"]
  },
  "application/x-tex-tfm": {
    source: "apache",
    extensions: ["tfm"]
  },
  "application/x-texinfo": {
    source: "apache",
    extensions: ["texinfo", "texi"]
  },
  "application/x-tgif": {
    source: "apache",
    extensions: ["obj"]
  },
  "application/x-ustar": {
    source: "apache",
    extensions: ["ustar"]
  },
  "application/x-virtualbox-hdd": {
    compressible: true,
    extensions: ["hdd"]
  },
  "application/x-virtualbox-ova": {
    compressible: true,
    extensions: ["ova"]
  },
  "application/x-virtualbox-ovf": {
    compressible: true,
    extensions: ["ovf"]
  },
  "application/x-virtualbox-vbox": {
    compressible: true,
    extensions: ["vbox"]
  },
  "application/x-virtualbox-vbox-extpack": {
    compressible: false,
    extensions: ["vbox-extpack"]
  },
  "application/x-virtualbox-vdi": {
    compressible: true,
    extensions: ["vdi"]
  },
  "application/x-virtualbox-vhd": {
    compressible: true,
    extensions: ["vhd"]
  },
  "application/x-virtualbox-vmdk": {
    compressible: true,
    extensions: ["vmdk"]
  },
  "application/x-wais-source": {
    source: "apache",
    extensions: ["src"]
  },
  "application/x-web-app-manifest+json": {
    compressible: true,
    extensions: ["webapp"]
  },
  "application/x-www-form-urlencoded": {
    source: "iana",
    compressible: true
  },
  "application/x-x509-ca-cert": {
    source: "iana",
    extensions: ["der", "crt", "pem"]
  },
  "application/x-x509-ca-ra-cert": {
    source: "iana"
  },
  "application/x-x509-next-ca-cert": {
    source: "iana"
  },
  "application/x-xfig": {
    source: "apache",
    extensions: ["fig"]
  },
  "application/x-xliff+xml": {
    source: "apache",
    compressible: true,
    extensions: ["xlf"]
  },
  "application/x-xpinstall": {
    source: "apache",
    compressible: false,
    extensions: ["xpi"]
  },
  "application/x-xz": {
    source: "apache",
    extensions: ["xz"]
  },
  "application/x-zmachine": {
    source: "apache",
    extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"]
  },
  "application/x400-bp": {
    source: "iana"
  },
  "application/xacml+xml": {
    source: "iana",
    compressible: true
  },
  "application/xaml+xml": {
    source: "apache",
    compressible: true,
    extensions: ["xaml"]
  },
  "application/xcap-att+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xav"]
  },
  "application/xcap-caps+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xca"]
  },
  "application/xcap-diff+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xdf"]
  },
  "application/xcap-el+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xel"]
  },
  "application/xcap-error+xml": {
    source: "iana",
    compressible: true
  },
  "application/xcap-ns+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xns"]
  },
  "application/xcon-conference-info+xml": {
    source: "iana",
    compressible: true
  },
  "application/xcon-conference-info-diff+xml": {
    source: "iana",
    compressible: true
  },
  "application/xenc+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xenc"]
  },
  "application/xfdf": {
    source: "iana",
    extensions: ["xfdf"]
  },
  "application/xhtml+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xhtml", "xht"]
  },
  "application/xhtml-voice+xml": {
    source: "apache",
    compressible: true
  },
  "application/xliff+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xlf"]
  },
  "application/xml": {
    source: "iana",
    compressible: true,
    extensions: ["xml", "xsl", "xsd", "rng"]
  },
  "application/xml-dtd": {
    source: "iana",
    compressible: true,
    extensions: ["dtd"]
  },
  "application/xml-external-parsed-entity": {
    source: "iana"
  },
  "application/xml-patch+xml": {
    source: "iana",
    compressible: true
  },
  "application/xmpp+xml": {
    source: "iana",
    compressible: true
  },
  "application/xop+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xop"]
  },
  "application/xproc+xml": {
    source: "apache",
    compressible: true,
    extensions: ["xpl"]
  },
  "application/xslt+xml": {
    source: "iana",
    compressible: true,
    extensions: ["xsl", "xslt"]
  },
  "application/xspf+xml": {
    source: "apache",
    compressible: true,
    extensions: ["xspf"]
  },
  "application/xv+xml": {
    source: "iana",
    compressible: true,
    extensions: ["mxml", "xhvml", "xvml", "xvm"]
  },
  "application/yang": {
    source: "iana",
    extensions: ["yang"]
  },
  "application/yang-data+cbor": {
    source: "iana"
  },
  "application/yang-data+json": {
    source: "iana",
    compressible: true
  },
  "application/yang-data+xml": {
    source: "iana",
    compressible: true
  },
  "application/yang-patch+json": {
    source: "iana",
    compressible: true
  },
  "application/yang-patch+xml": {
    source: "iana",
    compressible: true
  },
  "application/yin+xml": {
    source: "iana",
    compressible: true,
    extensions: ["yin"]
  },
  "application/zip": {
    source: "iana",
    compressible: false,
    extensions: ["zip"]
  },
  "application/zlib": {
    source: "iana"
  },
  "application/zstd": {
    source: "iana"
  },
  "audio/1d-interleaved-parityfec": {
    source: "iana"
  },
  "audio/32kadpcm": {
    source: "iana"
  },
  "audio/3gpp": {
    source: "iana",
    compressible: false,
    extensions: ["3gpp"]
  },
  "audio/3gpp2": {
    source: "iana"
  },
  "audio/aac": {
    source: "iana",
    extensions: ["adts", "aac"]
  },
  "audio/ac3": {
    source: "iana"
  },
  "audio/adpcm": {
    source: "apache",
    extensions: ["adp"]
  },
  "audio/amr": {
    source: "iana",
    extensions: ["amr"]
  },
  "audio/amr-wb": {
    source: "iana"
  },
  "audio/amr-wb+": {
    source: "iana"
  },
  "audio/aptx": {
    source: "iana"
  },
  "audio/asc": {
    source: "iana"
  },
  "audio/atrac-advanced-lossless": {
    source: "iana"
  },
  "audio/atrac-x": {
    source: "iana"
  },
  "audio/atrac3": {
    source: "iana"
  },
  "audio/basic": {
    source: "iana",
    compressible: false,
    extensions: ["au", "snd"]
  },
  "audio/bv16": {
    source: "iana"
  },
  "audio/bv32": {
    source: "iana"
  },
  "audio/clearmode": {
    source: "iana"
  },
  "audio/cn": {
    source: "iana"
  },
  "audio/dat12": {
    source: "iana"
  },
  "audio/dls": {
    source: "iana"
  },
  "audio/dsr-es201108": {
    source: "iana"
  },
  "audio/dsr-es202050": {
    source: "iana"
  },
  "audio/dsr-es202211": {
    source: "iana"
  },
  "audio/dsr-es202212": {
    source: "iana"
  },
  "audio/dv": {
    source: "iana"
  },
  "audio/dvi4": {
    source: "iana"
  },
  "audio/eac3": {
    source: "iana"
  },
  "audio/encaprtp": {
    source: "iana"
  },
  "audio/evrc": {
    source: "iana"
  },
  "audio/evrc-qcp": {
    source: "iana"
  },
  "audio/evrc0": {
    source: "iana"
  },
  "audio/evrc1": {
    source: "iana"
  },
  "audio/evrcb": {
    source: "iana"
  },
  "audio/evrcb0": {
    source: "iana"
  },
  "audio/evrcb1": {
    source: "iana"
  },
  "audio/evrcnw": {
    source: "iana"
  },
  "audio/evrcnw0": {
    source: "iana"
  },
  "audio/evrcnw1": {
    source: "iana"
  },
  "audio/evrcwb": {
    source: "iana"
  },
  "audio/evrcwb0": {
    source: "iana"
  },
  "audio/evrcwb1": {
    source: "iana"
  },
  "audio/evs": {
    source: "iana"
  },
  "audio/flexfec": {
    source: "iana"
  },
  "audio/fwdred": {
    source: "iana"
  },
  "audio/g711-0": {
    source: "iana"
  },
  "audio/g719": {
    source: "iana"
  },
  "audio/g722": {
    source: "iana"
  },
  "audio/g7221": {
    source: "iana"
  },
  "audio/g723": {
    source: "iana"
  },
  "audio/g726-16": {
    source: "iana"
  },
  "audio/g726-24": {
    source: "iana"
  },
  "audio/g726-32": {
    source: "iana"
  },
  "audio/g726-40": {
    source: "iana"
  },
  "audio/g728": {
    source: "iana"
  },
  "audio/g729": {
    source: "iana"
  },
  "audio/g7291": {
    source: "iana"
  },
  "audio/g729d": {
    source: "iana"
  },
  "audio/g729e": {
    source: "iana"
  },
  "audio/gsm": {
    source: "iana"
  },
  "audio/gsm-efr": {
    source: "iana"
  },
  "audio/gsm-hr-08": {
    source: "iana"
  },
  "audio/ilbc": {
    source: "iana"
  },
  "audio/ip-mr_v2.5": {
    source: "iana"
  },
  "audio/isac": {
    source: "apache"
  },
  "audio/l16": {
    source: "iana"
  },
  "audio/l20": {
    source: "iana"
  },
  "audio/l24": {
    source: "iana",
    compressible: false
  },
  "audio/l8": {
    source: "iana"
  },
  "audio/lpc": {
    source: "iana"
  },
  "audio/melp": {
    source: "iana"
  },
  "audio/melp1200": {
    source: "iana"
  },
  "audio/melp2400": {
    source: "iana"
  },
  "audio/melp600": {
    source: "iana"
  },
  "audio/mhas": {
    source: "iana"
  },
  "audio/midi": {
    source: "apache",
    extensions: ["mid", "midi", "kar", "rmi"]
  },
  "audio/mobile-xmf": {
    source: "iana",
    extensions: ["mxmf"]
  },
  "audio/mp3": {
    compressible: false,
    extensions: ["mp3"]
  },
  "audio/mp4": {
    source: "iana",
    compressible: false,
    extensions: ["m4a", "mp4a"]
  },
  "audio/mp4a-latm": {
    source: "iana"
  },
  "audio/mpa": {
    source: "iana"
  },
  "audio/mpa-robust": {
    source: "iana"
  },
  "audio/mpeg": {
    source: "iana",
    compressible: false,
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
  },
  "audio/mpeg4-generic": {
    source: "iana"
  },
  "audio/musepack": {
    source: "apache"
  },
  "audio/ogg": {
    source: "iana",
    compressible: false,
    extensions: ["oga", "ogg", "spx", "opus"]
  },
  "audio/opus": {
    source: "iana"
  },
  "audio/parityfec": {
    source: "iana"
  },
  "audio/pcma": {
    source: "iana"
  },
  "audio/pcma-wb": {
    source: "iana"
  },
  "audio/pcmu": {
    source: "iana"
  },
  "audio/pcmu-wb": {
    source: "iana"
  },
  "audio/prs.sid": {
    source: "iana"
  },
  "audio/qcelp": {
    source: "iana"
  },
  "audio/raptorfec": {
    source: "iana"
  },
  "audio/red": {
    source: "iana"
  },
  "audio/rtp-enc-aescm128": {
    source: "iana"
  },
  "audio/rtp-midi": {
    source: "iana"
  },
  "audio/rtploopback": {
    source: "iana"
  },
  "audio/rtx": {
    source: "iana"
  },
  "audio/s3m": {
    source: "apache",
    extensions: ["s3m"]
  },
  "audio/scip": {
    source: "iana"
  },
  "audio/silk": {
    source: "apache",
    extensions: ["sil"]
  },
  "audio/smv": {
    source: "iana"
  },
  "audio/smv-qcp": {
    source: "iana"
  },
  "audio/smv0": {
    source: "iana"
  },
  "audio/sofa": {
    source: "iana"
  },
  "audio/sp-midi": {
    source: "iana"
  },
  "audio/speex": {
    source: "iana"
  },
  "audio/t140c": {
    source: "iana"
  },
  "audio/t38": {
    source: "iana"
  },
  "audio/telephone-event": {
    source: "iana"
  },
  "audio/tetra_acelp": {
    source: "iana"
  },
  "audio/tetra_acelp_bb": {
    source: "iana"
  },
  "audio/tone": {
    source: "iana"
  },
  "audio/tsvcis": {
    source: "iana"
  },
  "audio/uemclip": {
    source: "iana"
  },
  "audio/ulpfec": {
    source: "iana"
  },
  "audio/usac": {
    source: "iana"
  },
  "audio/vdvi": {
    source: "iana"
  },
  "audio/vmr-wb": {
    source: "iana"
  },
  "audio/vnd.3gpp.iufp": {
    source: "iana"
  },
  "audio/vnd.4sb": {
    source: "iana"
  },
  "audio/vnd.audiokoz": {
    source: "iana"
  },
  "audio/vnd.celp": {
    source: "iana"
  },
  "audio/vnd.cisco.nse": {
    source: "iana"
  },
  "audio/vnd.cmles.radio-events": {
    source: "iana"
  },
  "audio/vnd.cns.anp1": {
    source: "iana"
  },
  "audio/vnd.cns.inf1": {
    source: "iana"
  },
  "audio/vnd.dece.audio": {
    source: "iana",
    extensions: ["uva", "uvva"]
  },
  "audio/vnd.digital-winds": {
    source: "iana",
    extensions: ["eol"]
  },
  "audio/vnd.dlna.adts": {
    source: "iana"
  },
  "audio/vnd.dolby.heaac.1": {
    source: "iana"
  },
  "audio/vnd.dolby.heaac.2": {
    source: "iana"
  },
  "audio/vnd.dolby.mlp": {
    source: "iana"
  },
  "audio/vnd.dolby.mps": {
    source: "iana"
  },
  "audio/vnd.dolby.pl2": {
    source: "iana"
  },
  "audio/vnd.dolby.pl2x": {
    source: "iana"
  },
  "audio/vnd.dolby.pl2z": {
    source: "iana"
  },
  "audio/vnd.dolby.pulse.1": {
    source: "iana"
  },
  "audio/vnd.dra": {
    source: "iana",
    extensions: ["dra"]
  },
  "audio/vnd.dts": {
    source: "iana",
    extensions: ["dts"]
  },
  "audio/vnd.dts.hd": {
    source: "iana",
    extensions: ["dtshd"]
  },
  "audio/vnd.dts.uhd": {
    source: "iana"
  },
  "audio/vnd.dvb.file": {
    source: "iana"
  },
  "audio/vnd.everad.plj": {
    source: "iana"
  },
  "audio/vnd.hns.audio": {
    source: "iana"
  },
  "audio/vnd.lucent.voice": {
    source: "iana",
    extensions: ["lvp"]
  },
  "audio/vnd.ms-playready.media.pya": {
    source: "iana",
    extensions: ["pya"]
  },
  "audio/vnd.nokia.mobile-xmf": {
    source: "iana"
  },
  "audio/vnd.nortel.vbk": {
    source: "iana"
  },
  "audio/vnd.nuera.ecelp4800": {
    source: "iana",
    extensions: ["ecelp4800"]
  },
  "audio/vnd.nuera.ecelp7470": {
    source: "iana",
    extensions: ["ecelp7470"]
  },
  "audio/vnd.nuera.ecelp9600": {
    source: "iana",
    extensions: ["ecelp9600"]
  },
  "audio/vnd.octel.sbc": {
    source: "iana"
  },
  "audio/vnd.presonus.multitrack": {
    source: "iana"
  },
  "audio/vnd.qcelp": {
    source: "apache"
  },
  "audio/vnd.rhetorex.32kadpcm": {
    source: "iana"
  },
  "audio/vnd.rip": {
    source: "iana",
    extensions: ["rip"]
  },
  "audio/vnd.rn-realaudio": {
    compressible: false
  },
  "audio/vnd.sealedmedia.softseal.mpeg": {
    source: "iana"
  },
  "audio/vnd.vmx.cvsd": {
    source: "iana"
  },
  "audio/vnd.wave": {
    compressible: false
  },
  "audio/vorbis": {
    source: "iana",
    compressible: false
  },
  "audio/vorbis-config": {
    source: "iana"
  },
  "audio/wav": {
    compressible: false,
    extensions: ["wav"]
  },
  "audio/wave": {
    compressible: false,
    extensions: ["wav"]
  },
  "audio/webm": {
    source: "apache",
    compressible: false,
    extensions: ["weba"]
  },
  "audio/x-aac": {
    source: "apache",
    compressible: false,
    extensions: ["aac"]
  },
  "audio/x-aiff": {
    source: "apache",
    extensions: ["aif", "aiff", "aifc"]
  },
  "audio/x-caf": {
    source: "apache",
    compressible: false,
    extensions: ["caf"]
  },
  "audio/x-flac": {
    source: "apache",
    extensions: ["flac"]
  },
  "audio/x-m4a": {
    source: "nginx",
    extensions: ["m4a"]
  },
  "audio/x-matroska": {
    source: "apache",
    extensions: ["mka"]
  },
  "audio/x-mpegurl": {
    source: "apache",
    extensions: ["m3u"]
  },
  "audio/x-ms-wax": {
    source: "apache",
    extensions: ["wax"]
  },
  "audio/x-ms-wma": {
    source: "apache",
    extensions: ["wma"]
  },
  "audio/x-pn-realaudio": {
    source: "apache",
    extensions: ["ram", "ra"]
  },
  "audio/x-pn-realaudio-plugin": {
    source: "apache",
    extensions: ["rmp"]
  },
  "audio/x-realaudio": {
    source: "nginx",
    extensions: ["ra"]
  },
  "audio/x-tta": {
    source: "apache"
  },
  "audio/x-wav": {
    source: "apache",
    extensions: ["wav"]
  },
  "audio/xm": {
    source: "apache",
    extensions: ["xm"]
  },
  "chemical/x-cdx": {
    source: "apache",
    extensions: ["cdx"]
  },
  "chemical/x-cif": {
    source: "apache",
    extensions: ["cif"]
  },
  "chemical/x-cmdf": {
    source: "apache",
    extensions: ["cmdf"]
  },
  "chemical/x-cml": {
    source: "apache",
    extensions: ["cml"]
  },
  "chemical/x-csml": {
    source: "apache",
    extensions: ["csml"]
  },
  "chemical/x-pdb": {
    source: "apache"
  },
  "chemical/x-xyz": {
    source: "apache",
    extensions: ["xyz"]
  },
  "font/collection": {
    source: "iana",
    extensions: ["ttc"]
  },
  "font/otf": {
    source: "iana",
    compressible: true,
    extensions: ["otf"]
  },
  "font/sfnt": {
    source: "iana"
  },
  "font/ttf": {
    source: "iana",
    compressible: true,
    extensions: ["ttf"]
  },
  "font/woff": {
    source: "iana",
    extensions: ["woff"]
  },
  "font/woff2": {
    source: "iana",
    extensions: ["woff2"]
  },
  "image/aces": {
    source: "iana",
    extensions: ["exr"]
  },
  "image/apng": {
    compressible: false,
    extensions: ["apng"]
  },
  "image/avci": {
    source: "iana",
    extensions: ["avci"]
  },
  "image/avcs": {
    source: "iana",
    extensions: ["avcs"]
  },
  "image/avif": {
    source: "iana",
    compressible: false,
    extensions: ["avif"]
  },
  "image/bmp": {
    source: "iana",
    compressible: true,
    extensions: ["bmp", "dib"]
  },
  "image/cgm": {
    source: "iana",
    extensions: ["cgm"]
  },
  "image/dicom-rle": {
    source: "iana",
    extensions: ["drle"]
  },
  "image/emf": {
    source: "iana",
    extensions: ["emf"]
  },
  "image/fits": {
    source: "iana",
    extensions: ["fits"]
  },
  "image/g3fax": {
    source: "iana",
    extensions: ["g3"]
  },
  "image/gif": {
    source: "iana",
    compressible: false,
    extensions: ["gif"]
  },
  "image/heic": {
    source: "iana",
    extensions: ["heic"]
  },
  "image/heic-sequence": {
    source: "iana",
    extensions: ["heics"]
  },
  "image/heif": {
    source: "iana",
    extensions: ["heif"]
  },
  "image/heif-sequence": {
    source: "iana",
    extensions: ["heifs"]
  },
  "image/hej2k": {
    source: "iana",
    extensions: ["hej2"]
  },
  "image/hsj2": {
    source: "iana",
    extensions: ["hsj2"]
  },
  "image/ief": {
    source: "iana",
    extensions: ["ief"]
  },
  "image/jls": {
    source: "iana",
    extensions: ["jls"]
  },
  "image/jp2": {
    source: "iana",
    compressible: false,
    extensions: ["jp2", "jpg2"]
  },
  "image/jpeg": {
    source: "iana",
    compressible: false,
    extensions: ["jpeg", "jpg", "jpe"]
  },
  "image/jph": {
    source: "iana",
    extensions: ["jph"]
  },
  "image/jphc": {
    source: "iana",
    extensions: ["jhc"]
  },
  "image/jpm": {
    source: "iana",
    compressible: false,
    extensions: ["jpm"]
  },
  "image/jpx": {
    source: "iana",
    compressible: false,
    extensions: ["jpx", "jpf"]
  },
  "image/jxr": {
    source: "iana",
    extensions: ["jxr"]
  },
  "image/jxra": {
    source: "iana",
    extensions: ["jxra"]
  },
  "image/jxrs": {
    source: "iana",
    extensions: ["jxrs"]
  },
  "image/jxs": {
    source: "iana",
    extensions: ["jxs"]
  },
  "image/jxsc": {
    source: "iana",
    extensions: ["jxsc"]
  },
  "image/jxsi": {
    source: "iana",
    extensions: ["jxsi"]
  },
  "image/jxss": {
    source: "iana",
    extensions: ["jxss"]
  },
  "image/ktx": {
    source: "iana",
    extensions: ["ktx"]
  },
  "image/ktx2": {
    source: "iana",
    extensions: ["ktx2"]
  },
  "image/naplps": {
    source: "iana"
  },
  "image/pjpeg": {
    compressible: false
  },
  "image/png": {
    source: "iana",
    compressible: false,
    extensions: ["png"]
  },
  "image/prs.btif": {
    source: "iana",
    extensions: ["btif", "btf"]
  },
  "image/prs.pti": {
    source: "iana",
    extensions: ["pti"]
  },
  "image/pwg-raster": {
    source: "iana"
  },
  "image/sgi": {
    source: "apache",
    extensions: ["sgi"]
  },
  "image/svg+xml": {
    source: "iana",
    compressible: true,
    extensions: ["svg", "svgz"]
  },
  "image/t38": {
    source: "iana",
    extensions: ["t38"]
  },
  "image/tiff": {
    source: "iana",
    compressible: false,
    extensions: ["tif", "tiff"]
  },
  "image/tiff-fx": {
    source: "iana",
    extensions: ["tfx"]
  },
  "image/vnd.adobe.photoshop": {
    source: "iana",
    compressible: true,
    extensions: ["psd"]
  },
  "image/vnd.airzip.accelerator.azv": {
    source: "iana",
    extensions: ["azv"]
  },
  "image/vnd.cns.inf2": {
    source: "iana"
  },
  "image/vnd.dece.graphic": {
    source: "iana",
    extensions: ["uvi", "uvvi", "uvg", "uvvg"]
  },
  "image/vnd.djvu": {
    source: "iana",
    extensions: ["djvu", "djv"]
  },
  "image/vnd.dvb.subtitle": {
    source: "iana",
    extensions: ["sub"]
  },
  "image/vnd.dwg": {
    source: "iana",
    extensions: ["dwg"]
  },
  "image/vnd.dxf": {
    source: "iana",
    extensions: ["dxf"]
  },
  "image/vnd.fastbidsheet": {
    source: "iana",
    extensions: ["fbs"]
  },
  "image/vnd.fpx": {
    source: "iana",
    extensions: ["fpx"]
  },
  "image/vnd.fst": {
    source: "iana",
    extensions: ["fst"]
  },
  "image/vnd.fujixerox.edmics-mmr": {
    source: "iana",
    extensions: ["mmr"]
  },
  "image/vnd.fujixerox.edmics-rlc": {
    source: "iana",
    extensions: ["rlc"]
  },
  "image/vnd.globalgraphics.pgb": {
    source: "iana"
  },
  "image/vnd.microsoft.icon": {
    source: "iana",
    compressible: true,
    extensions: ["ico"]
  },
  "image/vnd.mix": {
    source: "iana"
  },
  "image/vnd.mozilla.apng": {
    source: "iana",
    extensions: ["apng"]
  },
  "image/vnd.ms-dds": {
    compressible: true,
    extensions: ["dds"]
  },
  "image/vnd.ms-modi": {
    source: "iana",
    extensions: ["mdi"]
  },
  "image/vnd.ms-photo": {
    source: "apache",
    extensions: ["wdp"]
  },
  "image/vnd.net-fpx": {
    source: "iana",
    extensions: ["npx"]
  },
  "image/vnd.pco.b16": {
    source: "iana",
    extensions: ["b16"]
  },
  "image/vnd.radiance": {
    source: "iana"
  },
  "image/vnd.sealed.png": {
    source: "iana"
  },
  "image/vnd.sealedmedia.softseal.gif": {
    source: "iana"
  },
  "image/vnd.sealedmedia.softseal.jpg": {
    source: "iana"
  },
  "image/vnd.svf": {
    source: "iana"
  },
  "image/vnd.tencent.tap": {
    source: "iana",
    extensions: ["tap"]
  },
  "image/vnd.valve.source.texture": {
    source: "iana",
    extensions: ["vtf"]
  },
  "image/vnd.wap.wbmp": {
    source: "iana",
    extensions: ["wbmp"]
  },
  "image/vnd.xiff": {
    source: "iana",
    extensions: ["xif"]
  },
  "image/vnd.zbrush.pcx": {
    source: "iana",
    extensions: ["pcx"]
  },
  "image/webp": {
    source: "apache",
    extensions: ["webp"]
  },
  "image/wmf": {
    source: "iana",
    extensions: ["wmf"]
  },
  "image/x-3ds": {
    source: "apache",
    extensions: ["3ds"]
  },
  "image/x-cmu-raster": {
    source: "apache",
    extensions: ["ras"]
  },
  "image/x-cmx": {
    source: "apache",
    extensions: ["cmx"]
  },
  "image/x-freehand": {
    source: "apache",
    extensions: ["fh", "fhc", "fh4", "fh5", "fh7"]
  },
  "image/x-icon": {
    source: "apache",
    compressible: true,
    extensions: ["ico"]
  },
  "image/x-jng": {
    source: "nginx",
    extensions: ["jng"]
  },
  "image/x-mrsid-image": {
    source: "apache",
    extensions: ["sid"]
  },
  "image/x-ms-bmp": {
    source: "nginx",
    compressible: true,
    extensions: ["bmp"]
  },
  "image/x-pcx": {
    source: "apache",
    extensions: ["pcx"]
  },
  "image/x-pict": {
    source: "apache",
    extensions: ["pic", "pct"]
  },
  "image/x-portable-anymap": {
    source: "apache",
    extensions: ["pnm"]
  },
  "image/x-portable-bitmap": {
    source: "apache",
    extensions: ["pbm"]
  },
  "image/x-portable-graymap": {
    source: "apache",
    extensions: ["pgm"]
  },
  "image/x-portable-pixmap": {
    source: "apache",
    extensions: ["ppm"]
  },
  "image/x-rgb": {
    source: "apache",
    extensions: ["rgb"]
  },
  "image/x-tga": {
    source: "apache",
    extensions: ["tga"]
  },
  "image/x-xbitmap": {
    source: "apache",
    extensions: ["xbm"]
  },
  "image/x-xcf": {
    compressible: false
  },
  "image/x-xpixmap": {
    source: "apache",
    extensions: ["xpm"]
  },
  "image/x-xwindowdump": {
    source: "apache",
    extensions: ["xwd"]
  },
  "message/cpim": {
    source: "iana"
  },
  "message/delivery-status": {
    source: "iana"
  },
  "message/disposition-notification": {
    source: "iana",
    extensions: ["disposition-notification"]
  },
  "message/external-body": {
    source: "iana"
  },
  "message/feedback-report": {
    source: "iana"
  },
  "message/global": {
    source: "iana",
    extensions: ["u8msg"]
  },
  "message/global-delivery-status": {
    source: "iana",
    extensions: ["u8dsn"]
  },
  "message/global-disposition-notification": {
    source: "iana",
    extensions: ["u8mdn"]
  },
  "message/global-headers": {
    source: "iana",
    extensions: ["u8hdr"]
  },
  "message/http": {
    source: "iana",
    compressible: false
  },
  "message/imdn+xml": {
    source: "iana",
    compressible: true
  },
  "message/news": {
    source: "apache"
  },
  "message/partial": {
    source: "iana",
    compressible: false
  },
  "message/rfc822": {
    source: "iana",
    compressible: true,
    extensions: ["eml", "mime"]
  },
  "message/s-http": {
    source: "apache"
  },
  "message/sip": {
    source: "iana"
  },
  "message/sipfrag": {
    source: "iana"
  },
  "message/tracking-status": {
    source: "iana"
  },
  "message/vnd.si.simp": {
    source: "apache"
  },
  "message/vnd.wfa.wsc": {
    source: "iana",
    extensions: ["wsc"]
  },
  "model/3mf": {
    source: "iana",
    extensions: ["3mf"]
  },
  "model/e57": {
    source: "iana"
  },
  "model/gltf+json": {
    source: "iana",
    compressible: true,
    extensions: ["gltf"]
  },
  "model/gltf-binary": {
    source: "iana",
    compressible: true,
    extensions: ["glb"]
  },
  "model/iges": {
    source: "iana",
    compressible: false,
    extensions: ["igs", "iges"]
  },
  "model/mesh": {
    source: "iana",
    compressible: false,
    extensions: ["msh", "mesh", "silo"]
  },
  "model/mtl": {
    source: "iana",
    extensions: ["mtl"]
  },
  "model/obj": {
    source: "iana",
    extensions: ["obj"]
  },
  "model/prc": {
    source: "iana",
    extensions: ["prc"]
  },
  "model/step": {
    source: "iana"
  },
  "model/step+xml": {
    source: "iana",
    compressible: true,
    extensions: ["stpx"]
  },
  "model/step+zip": {
    source: "iana",
    compressible: false,
    extensions: ["stpz"]
  },
  "model/step-xml+zip": {
    source: "iana",
    compressible: false,
    extensions: ["stpxz"]
  },
  "model/stl": {
    source: "iana",
    extensions: ["stl"]
  },
  "model/u3d": {
    source: "iana",
    extensions: ["u3d"]
  },
  "model/vnd.collada+xml": {
    source: "iana",
    compressible: true,
    extensions: ["dae"]
  },
  "model/vnd.dwf": {
    source: "iana",
    extensions: ["dwf"]
  },
  "model/vnd.flatland.3dml": {
    source: "iana"
  },
  "model/vnd.gdl": {
    source: "iana",
    extensions: ["gdl"]
  },
  "model/vnd.gs-gdl": {
    source: "apache"
  },
  "model/vnd.gs.gdl": {
    source: "iana"
  },
  "model/vnd.gtw": {
    source: "iana",
    extensions: ["gtw"]
  },
  "model/vnd.moml+xml": {
    source: "iana",
    compressible: true
  },
  "model/vnd.mts": {
    source: "iana",
    extensions: ["mts"]
  },
  "model/vnd.opengex": {
    source: "iana",
    extensions: ["ogex"]
  },
  "model/vnd.parasolid.transmit.binary": {
    source: "iana",
    extensions: ["x_b"]
  },
  "model/vnd.parasolid.transmit.text": {
    source: "iana",
    extensions: ["x_t"]
  },
  "model/vnd.pytha.pyox": {
    source: "iana",
    extensions: ["pyo", "pyox"]
  },
  "model/vnd.rosette.annotated-data-model": {
    source: "iana"
  },
  "model/vnd.sap.vds": {
    source: "iana",
    extensions: ["vds"]
  },
  "model/vnd.usdz+zip": {
    source: "iana",
    compressible: false,
    extensions: ["usdz"]
  },
  "model/vnd.valve.source.compiled-map": {
    source: "iana",
    extensions: ["bsp"]
  },
  "model/vnd.vtu": {
    source: "iana",
    extensions: ["vtu"]
  },
  "model/vrml": {
    source: "iana",
    compressible: false,
    extensions: ["wrl", "vrml"]
  },
  "model/x3d+binary": {
    source: "apache",
    compressible: false,
    extensions: ["x3db", "x3dbz"]
  },
  "model/x3d+fastinfoset": {
    source: "iana",
    extensions: ["x3db"]
  },
  "model/x3d+vrml": {
    source: "apache",
    compressible: false,
    extensions: ["x3dv", "x3dvz"]
  },
  "model/x3d+xml": {
    source: "iana",
    compressible: true,
    extensions: ["x3d", "x3dz"]
  },
  "model/x3d-vrml": {
    source: "iana",
    extensions: ["x3dv"]
  },
  "multipart/alternative": {
    source: "iana",
    compressible: false
  },
  "multipart/appledouble": {
    source: "iana"
  },
  "multipart/byteranges": {
    source: "iana"
  },
  "multipart/digest": {
    source: "iana"
  },
  "multipart/encrypted": {
    source: "iana",
    compressible: false
  },
  "multipart/form-data": {
    source: "iana",
    compressible: false
  },
  "multipart/header-set": {
    source: "iana"
  },
  "multipart/mixed": {
    source: "iana"
  },
  "multipart/multilingual": {
    source: "iana"
  },
  "multipart/parallel": {
    source: "iana"
  },
  "multipart/related": {
    source: "iana",
    compressible: false
  },
  "multipart/report": {
    source: "iana"
  },
  "multipart/signed": {
    source: "iana",
    compressible: false
  },
  "multipart/vnd.bint.med-plus": {
    source: "iana"
  },
  "multipart/voice-message": {
    source: "iana"
  },
  "multipart/x-mixed-replace": {
    source: "iana"
  },
  "text/1d-interleaved-parityfec": {
    source: "iana"
  },
  "text/cache-manifest": {
    source: "iana",
    compressible: true,
    extensions: ["appcache", "manifest"]
  },
  "text/calendar": {
    source: "iana",
    extensions: ["ics", "ifb"]
  },
  "text/calender": {
    compressible: true
  },
  "text/cmd": {
    compressible: true
  },
  "text/coffeescript": {
    extensions: ["coffee", "litcoffee"]
  },
  "text/cql": {
    source: "iana"
  },
  "text/cql-expression": {
    source: "iana"
  },
  "text/cql-identifier": {
    source: "iana"
  },
  "text/css": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["css"]
  },
  "text/csv": {
    source: "iana",
    compressible: true,
    extensions: ["csv"]
  },
  "text/csv-schema": {
    source: "iana"
  },
  "text/directory": {
    source: "iana"
  },
  "text/dns": {
    source: "iana"
  },
  "text/ecmascript": {
    source: "apache"
  },
  "text/encaprtp": {
    source: "iana"
  },
  "text/enriched": {
    source: "iana"
  },
  "text/fhirpath": {
    source: "iana"
  },
  "text/flexfec": {
    source: "iana"
  },
  "text/fwdred": {
    source: "iana"
  },
  "text/gff3": {
    source: "iana"
  },
  "text/grammar-ref-list": {
    source: "iana"
  },
  "text/html": {
    source: "iana",
    compressible: true,
    extensions: ["html", "htm", "shtml"]
  },
  "text/jade": {
    extensions: ["jade"]
  },
  "text/javascript": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["js", "mjs"]
  },
  "text/jcr-cnd": {
    source: "iana"
  },
  "text/jsx": {
    compressible: true,
    extensions: ["jsx"]
  },
  "text/less": {
    compressible: true,
    extensions: ["less"]
  },
  "text/markdown": {
    source: "iana",
    compressible: true,
    extensions: ["md", "markdown"]
  },
  "text/mathml": {
    source: "nginx",
    extensions: ["mml"]
  },
  "text/mdx": {
    compressible: true,
    extensions: ["mdx"]
  },
  "text/mizar": {
    source: "iana"
  },
  "text/n3": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["n3"]
  },
  "text/parameters": {
    source: "iana",
    charset: "UTF-8"
  },
  "text/parityfec": {
    source: "iana"
  },
  "text/plain": {
    source: "iana",
    compressible: true,
    extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"]
  },
  "text/provenance-notation": {
    source: "iana",
    charset: "UTF-8"
  },
  "text/prs.fallenstein.rst": {
    source: "iana"
  },
  "text/prs.lines.tag": {
    source: "iana",
    extensions: ["dsc"]
  },
  "text/prs.prop.logic": {
    source: "iana"
  },
  "text/raptorfec": {
    source: "iana"
  },
  "text/red": {
    source: "iana"
  },
  "text/rfc822-headers": {
    source: "iana"
  },
  "text/richtext": {
    source: "iana",
    compressible: true,
    extensions: ["rtx"]
  },
  "text/rtf": {
    source: "iana",
    compressible: true,
    extensions: ["rtf"]
  },
  "text/rtp-enc-aescm128": {
    source: "iana"
  },
  "text/rtploopback": {
    source: "iana"
  },
  "text/rtx": {
    source: "iana"
  },
  "text/sgml": {
    source: "iana",
    extensions: ["sgml", "sgm"]
  },
  "text/shaclc": {
    source: "iana"
  },
  "text/shex": {
    source: "iana",
    extensions: ["shex"]
  },
  "text/slim": {
    extensions: ["slim", "slm"]
  },
  "text/spdx": {
    source: "iana",
    extensions: ["spdx"]
  },
  "text/strings": {
    source: "iana"
  },
  "text/stylus": {
    extensions: ["stylus", "styl"]
  },
  "text/t140": {
    source: "iana"
  },
  "text/tab-separated-values": {
    source: "iana",
    compressible: true,
    extensions: ["tsv"]
  },
  "text/troff": {
    source: "iana",
    extensions: ["t", "tr", "roff", "man", "me", "ms"]
  },
  "text/turtle": {
    source: "iana",
    charset: "UTF-8",
    extensions: ["ttl"]
  },
  "text/ulpfec": {
    source: "iana"
  },
  "text/uri-list": {
    source: "iana",
    compressible: true,
    extensions: ["uri", "uris", "urls"]
  },
  "text/vcard": {
    source: "iana",
    compressible: true,
    extensions: ["vcard"]
  },
  "text/vnd.a": {
    source: "iana"
  },
  "text/vnd.abc": {
    source: "iana"
  },
  "text/vnd.ascii-art": {
    source: "iana"
  },
  "text/vnd.curl": {
    source: "iana",
    extensions: ["curl"]
  },
  "text/vnd.curl.dcurl": {
    source: "apache",
    extensions: ["dcurl"]
  },
  "text/vnd.curl.mcurl": {
    source: "apache",
    extensions: ["mcurl"]
  },
  "text/vnd.curl.scurl": {
    source: "apache",
    extensions: ["scurl"]
  },
  "text/vnd.debian.copyright": {
    source: "iana",
    charset: "UTF-8"
  },
  "text/vnd.dmclientscript": {
    source: "iana"
  },
  "text/vnd.dvb.subtitle": {
    source: "iana",
    extensions: ["sub"]
  },
  "text/vnd.esmertec.theme-descriptor": {
    source: "iana",
    charset: "UTF-8"
  },
  "text/vnd.familysearch.gedcom": {
    source: "iana",
    extensions: ["ged"]
  },
  "text/vnd.ficlab.flt": {
    source: "iana"
  },
  "text/vnd.fly": {
    source: "iana",
    extensions: ["fly"]
  },
  "text/vnd.fmi.flexstor": {
    source: "iana",
    extensions: ["flx"]
  },
  "text/vnd.gml": {
    source: "iana"
  },
  "text/vnd.graphviz": {
    source: "iana",
    extensions: ["gv"]
  },
  "text/vnd.hans": {
    source: "iana"
  },
  "text/vnd.hgl": {
    source: "iana"
  },
  "text/vnd.in3d.3dml": {
    source: "iana",
    extensions: ["3dml"]
  },
  "text/vnd.in3d.spot": {
    source: "iana",
    extensions: ["spot"]
  },
  "text/vnd.iptc.newsml": {
    source: "iana"
  },
  "text/vnd.iptc.nitf": {
    source: "iana"
  },
  "text/vnd.latex-z": {
    source: "iana"
  },
  "text/vnd.motorola.reflex": {
    source: "iana"
  },
  "text/vnd.ms-mediapackage": {
    source: "iana"
  },
  "text/vnd.net2phone.commcenter.command": {
    source: "iana"
  },
  "text/vnd.radisys.msml-basic-layout": {
    source: "iana"
  },
  "text/vnd.senx.warpscript": {
    source: "iana"
  },
  "text/vnd.si.uricatalogue": {
    source: "apache"
  },
  "text/vnd.sosi": {
    source: "iana"
  },
  "text/vnd.sun.j2me.app-descriptor": {
    source: "iana",
    charset: "UTF-8",
    extensions: ["jad"]
  },
  "text/vnd.trolltech.linguist": {
    source: "iana",
    charset: "UTF-8"
  },
  "text/vnd.wap.si": {
    source: "iana"
  },
  "text/vnd.wap.sl": {
    source: "iana"
  },
  "text/vnd.wap.wml": {
    source: "iana",
    extensions: ["wml"]
  },
  "text/vnd.wap.wmlscript": {
    source: "iana",
    extensions: ["wmls"]
  },
  "text/vtt": {
    source: "iana",
    charset: "UTF-8",
    compressible: true,
    extensions: ["vtt"]
  },
  "text/x-asm": {
    source: "apache",
    extensions: ["s", "asm"]
  },
  "text/x-c": {
    source: "apache",
    extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"]
  },
  "text/x-component": {
    source: "nginx",
    extensions: ["htc"]
  },
  "text/x-fortran": {
    source: "apache",
    extensions: ["f", "for", "f77", "f90"]
  },
  "text/x-gwt-rpc": {
    compressible: true
  },
  "text/x-handlebars-template": {
    extensions: ["hbs"]
  },
  "text/x-java-source": {
    source: "apache",
    extensions: ["java"]
  },
  "text/x-jquery-tmpl": {
    compressible: true
  },
  "text/x-lua": {
    extensions: ["lua"]
  },
  "text/x-markdown": {
    compressible: true,
    extensions: ["mkd"]
  },
  "text/x-nfo": {
    source: "apache",
    extensions: ["nfo"]
  },
  "text/x-opml": {
    source: "apache",
    extensions: ["opml"]
  },
  "text/x-org": {
    compressible: true,
    extensions: ["org"]
  },
  "text/x-pascal": {
    source: "apache",
    extensions: ["p", "pas"]
  },
  "text/x-processing": {
    compressible: true,
    extensions: ["pde"]
  },
  "text/x-sass": {
    extensions: ["sass"]
  },
  "text/x-scss": {
    extensions: ["scss"]
  },
  "text/x-setext": {
    source: "apache",
    extensions: ["etx"]
  },
  "text/x-sfv": {
    source: "apache",
    extensions: ["sfv"]
  },
  "text/x-suse-ymp": {
    compressible: true,
    extensions: ["ymp"]
  },
  "text/x-uuencode": {
    source: "apache",
    extensions: ["uu"]
  },
  "text/x-vcalendar": {
    source: "apache",
    extensions: ["vcs"]
  },
  "text/x-vcard": {
    source: "apache",
    extensions: ["vcf"]
  },
  "text/xml": {
    source: "iana",
    compressible: true,
    extensions: ["xml"]
  },
  "text/xml-external-parsed-entity": {
    source: "iana"
  },
  "text/yaml": {
    compressible: true,
    extensions: ["yaml", "yml"]
  },
  "video/1d-interleaved-parityfec": {
    source: "iana"
  },
  "video/3gpp": {
    source: "iana",
    extensions: ["3gp", "3gpp"]
  },
  "video/3gpp-tt": {
    source: "iana"
  },
  "video/3gpp2": {
    source: "iana",
    extensions: ["3g2"]
  },
  "video/av1": {
    source: "iana"
  },
  "video/bmpeg": {
    source: "iana"
  },
  "video/bt656": {
    source: "iana"
  },
  "video/celb": {
    source: "iana"
  },
  "video/dv": {
    source: "iana"
  },
  "video/encaprtp": {
    source: "iana"
  },
  "video/ffv1": {
    source: "iana"
  },
  "video/flexfec": {
    source: "iana"
  },
  "video/h261": {
    source: "iana",
    extensions: ["h261"]
  },
  "video/h263": {
    source: "iana",
    extensions: ["h263"]
  },
  "video/h263-1998": {
    source: "iana"
  },
  "video/h263-2000": {
    source: "iana"
  },
  "video/h264": {
    source: "iana",
    extensions: ["h264"]
  },
  "video/h264-rcdo": {
    source: "iana"
  },
  "video/h264-svc": {
    source: "iana"
  },
  "video/h265": {
    source: "iana"
  },
  "video/iso.segment": {
    source: "iana",
    extensions: ["m4s"]
  },
  "video/jpeg": {
    source: "iana",
    extensions: ["jpgv"]
  },
  "video/jpeg2000": {
    source: "iana"
  },
  "video/jpm": {
    source: "apache",
    extensions: ["jpm", "jpgm"]
  },
  "video/jxsv": {
    source: "iana"
  },
  "video/mj2": {
    source: "iana",
    extensions: ["mj2", "mjp2"]
  },
  "video/mp1s": {
    source: "iana"
  },
  "video/mp2p": {
    source: "iana"
  },
  "video/mp2t": {
    source: "iana",
    extensions: ["ts"]
  },
  "video/mp4": {
    source: "iana",
    compressible: false,
    extensions: ["mp4", "mp4v", "mpg4"]
  },
  "video/mp4v-es": {
    source: "iana"
  },
  "video/mpeg": {
    source: "iana",
    compressible: false,
    extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
  },
  "video/mpeg4-generic": {
    source: "iana"
  },
  "video/mpv": {
    source: "iana"
  },
  "video/nv": {
    source: "iana"
  },
  "video/ogg": {
    source: "iana",
    compressible: false,
    extensions: ["ogv"]
  },
  "video/parityfec": {
    source: "iana"
  },
  "video/pointer": {
    source: "iana"
  },
  "video/quicktime": {
    source: "iana",
    compressible: false,
    extensions: ["qt", "mov"]
  },
  "video/raptorfec": {
    source: "iana"
  },
  "video/raw": {
    source: "iana"
  },
  "video/rtp-enc-aescm128": {
    source: "iana"
  },
  "video/rtploopback": {
    source: "iana"
  },
  "video/rtx": {
    source: "iana"
  },
  "video/scip": {
    source: "iana"
  },
  "video/smpte291": {
    source: "iana"
  },
  "video/smpte292m": {
    source: "iana"
  },
  "video/ulpfec": {
    source: "iana"
  },
  "video/vc1": {
    source: "iana"
  },
  "video/vc2": {
    source: "iana"
  },
  "video/vnd.cctv": {
    source: "iana"
  },
  "video/vnd.dece.hd": {
    source: "iana",
    extensions: ["uvh", "uvvh"]
  },
  "video/vnd.dece.mobile": {
    source: "iana",
    extensions: ["uvm", "uvvm"]
  },
  "video/vnd.dece.mp4": {
    source: "iana"
  },
  "video/vnd.dece.pd": {
    source: "iana",
    extensions: ["uvp", "uvvp"]
  },
  "video/vnd.dece.sd": {
    source: "iana",
    extensions: ["uvs", "uvvs"]
  },
  "video/vnd.dece.video": {
    source: "iana",
    extensions: ["uvv", "uvvv"]
  },
  "video/vnd.directv.mpeg": {
    source: "iana"
  },
  "video/vnd.directv.mpeg-tts": {
    source: "iana"
  },
  "video/vnd.dlna.mpeg-tts": {
    source: "iana"
  },
  "video/vnd.dvb.file": {
    source: "iana",
    extensions: ["dvb"]
  },
  "video/vnd.fvt": {
    source: "iana",
    extensions: ["fvt"]
  },
  "video/vnd.hns.video": {
    source: "iana"
  },
  "video/vnd.iptvforum.1dparityfec-1010": {
    source: "iana"
  },
  "video/vnd.iptvforum.1dparityfec-2005": {
    source: "iana"
  },
  "video/vnd.iptvforum.2dparityfec-1010": {
    source: "iana"
  },
  "video/vnd.iptvforum.2dparityfec-2005": {
    source: "iana"
  },
  "video/vnd.iptvforum.ttsavc": {
    source: "iana"
  },
  "video/vnd.iptvforum.ttsmpeg2": {
    source: "iana"
  },
  "video/vnd.motorola.video": {
    source: "iana"
  },
  "video/vnd.motorola.videop": {
    source: "iana"
  },
  "video/vnd.mpegurl": {
    source: "iana",
    extensions: ["mxu", "m4u"]
  },
  "video/vnd.ms-playready.media.pyv": {
    source: "iana",
    extensions: ["pyv"]
  },
  "video/vnd.nokia.interleaved-multimedia": {
    source: "iana"
  },
  "video/vnd.nokia.mp4vr": {
    source: "iana"
  },
  "video/vnd.nokia.videovoip": {
    source: "iana"
  },
  "video/vnd.objectvideo": {
    source: "iana"
  },
  "video/vnd.radgamettools.bink": {
    source: "iana"
  },
  "video/vnd.radgamettools.smacker": {
    source: "apache"
  },
  "video/vnd.sealed.mpeg1": {
    source: "iana"
  },
  "video/vnd.sealed.mpeg4": {
    source: "iana"
  },
  "video/vnd.sealed.swf": {
    source: "iana"
  },
  "video/vnd.sealedmedia.softseal.mov": {
    source: "iana"
  },
  "video/vnd.uvvu.mp4": {
    source: "iana",
    extensions: ["uvu", "uvvu"]
  },
  "video/vnd.vivo": {
    source: "iana",
    extensions: ["viv"]
  },
  "video/vnd.youtube.yt": {
    source: "iana"
  },
  "video/vp8": {
    source: "iana"
  },
  "video/vp9": {
    source: "iana"
  },
  "video/webm": {
    source: "apache",
    compressible: false,
    extensions: ["webm"]
  },
  "video/x-f4v": {
    source: "apache",
    extensions: ["f4v"]
  },
  "video/x-fli": {
    source: "apache",
    extensions: ["fli"]
  },
  "video/x-flv": {
    source: "apache",
    compressible: false,
    extensions: ["flv"]
  },
  "video/x-m4v": {
    source: "apache",
    extensions: ["m4v"]
  },
  "video/x-matroska": {
    source: "apache",
    compressible: false,
    extensions: ["mkv", "mk3d", "mks"]
  },
  "video/x-mng": {
    source: "apache",
    extensions: ["mng"]
  },
  "video/x-ms-asf": {
    source: "apache",
    extensions: ["asf", "asx"]
  },
  "video/x-ms-vob": {
    source: "apache",
    extensions: ["vob"]
  },
  "video/x-ms-wm": {
    source: "apache",
    extensions: ["wm"]
  },
  "video/x-ms-wmv": {
    source: "apache",
    compressible: false,
    extensions: ["wmv"]
  },
  "video/x-ms-wmx": {
    source: "apache",
    extensions: ["wmx"]
  },
  "video/x-ms-wvx": {
    source: "apache",
    extensions: ["wvx"]
  },
  "video/x-msvideo": {
    source: "apache",
    extensions: ["avi"]
  },
  "video/x-sgi-movie": {
    source: "apache",
    extensions: ["movie"]
  },
  "video/x-smv": {
    source: "apache",
    extensions: ["smv"]
  },
  "x-conference/x-cooltalk": {
    source: "apache",
    extensions: ["ice"]
  },
  "x-shader/x-fragment": {
    compressible: true
  },
  "x-shader/x-vertex": {
    compressible: true
  }
};
var extensions = {};
var types = {};
populateMaps(extensions, {});
var getExt = /* @__PURE__ */ __name((contentType) => {
  return mimeDb[contentType.toLowerCase()]?.extensions?.[0] ?? null;
}, "getExt");
function mimeLookup(path102) {
  if (!path102 || typeof path102 !== "string") {
    return false;
  }
  const ext = extname("." + path102).toLowerCase().substr(1);
  if (!ext) {
    return false;
  }
  return types[ext] || false;
}
__name(mimeLookup, "mimeLookup");
function populateMaps(exts, _types) {
  const preference = ["nginx", "apache", void 0, "iana"];
  Object.keys(mimeDb).forEach((type) => {
    const mime = mimeDb[type];
    const _exts = mime.extensions;
    if (!_exts?.length) {
      return;
    }
    exts[type] = _exts;
    for (let i = 0; i < _exts.length; i++) {
      const _ext = _exts[i];
      if (_types[_ext]) {
        const from = preference.indexOf(mimeDb[_types[_ext]].source);
        const to = preference.indexOf(mime.source);
        if (_types[_ext] !== "application/octet-stream" && (from > to || from === to && _types[_ext].substr(0, 12) === "application/")) {
          continue;
        }
      }
      types[_ext] = type;
    }
  });
}
__name(populateMaps, "populateMaps");
function mimeContentType(str) {
  if (!str || typeof str !== "string") {
    return false;
  }
  let mime = str.indexOf("/") === -1 ? mimeLookup(str) : str;
  if (!mime) {
    return false;
  }
  if (mime.indexOf("charset") === -1) {
    const _charset = charset(mime);
    if (_charset)
      mime += "; charset=" + _charset.toLowerCase();
  }
  return mime;
}
__name(mimeContentType, "mimeContentType");
var EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/;
var TEXT_TYPE_REGEXP = /^text\//i;
function charset(type) {
  if (!type || typeof type !== "string") {
    return false;
  }
  const match = EXTRACT_TYPE_REGEXP.exec(type);
  const mime = match && mimeDb[match[1].toLowerCase()];
  if (mime?.charset) {
    return mime.charset;
  }
  if (match && TEXT_TYPE_REGEXP.test(match[1])) {
    return "UTF-8";
  }
  return false;
}
__name(charset, "charset");
var pLimit = /* @__PURE__ */ __name((concurrency) => {
  const queue = [];
  let activeCount = 0;
  const next = /* @__PURE__ */ __name(() => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()?.();
    }
  }, "next");
  const run = /* @__PURE__ */ __name(async (fn, resolve22, ...args) => {
    activeCount++;
    const result = (async () => fn(...args))();
    resolve22(result);
    try {
      await result;
    } catch {
    }
    next();
  }, "run");
  const enqueue = /* @__PURE__ */ __name((fn, resolve22, ...args) => {
    queue.push(() => run(fn, resolve22, ...args));
    (async () => {
      await Promise.resolve();
      if (activeCount < concurrency && queue.length > 0) {
        queue.shift()?.();
      }
    })();
  }, "enqueue");
  const generator = /* @__PURE__ */ __name((fn, ...args) => new Promise((resolve22) => {
    enqueue(fn, resolve22, ...args);
  }), "generator");
  Object.defineProperties(generator, {
    activeCount: {
      get: /* @__PURE__ */ __name(() => activeCount, "get")
    },
    pendingCount: {
      get: /* @__PURE__ */ __name(() => queue.length, "get")
    },
    clearQueue: {
      value: /* @__PURE__ */ __name(() => {
        queue.length = 0;
      }, "value")
    }
  });
  return generator;
}, "pLimit");
var limit = pLimit(1);
var getAudioChannelsAndDurationWithoutCache = /* @__PURE__ */ __name(async ({
  src,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  audioStreamIndex
}) => {
  const args = [
    ["-v", "error"],
    ["-select_streams", audioStreamIndex ? `a:${audioStreamIndex}` : "a:0"],
    [
      "-show_entries",
      "stream=channels:stream=start_time:format=duration:format=format_name"
    ],
    ["-of", "default=nw=1"],
    [src]
  ].reduce((acc, val) => acc.concat(val), []).filter(Boolean);
  try {
    const task = await callFf({
      bin: "ffprobe",
      args,
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal
    });
    const channels = task.stdout.match(/channels=([0-9]+)/);
    const duration = task.stdout.match(/duration=([0-9.]+)/);
    const startTime = task.stdout.match(/start_time=([0-9.]+)/);
    const container = task.stdout.match(/format_name=([a-zA-Z0-9.]+)/);
    const isMP3 = container ? container[1] === "mp3" : false;
    const result = {
      channels: channels ? parseInt(channels[1], 10) : 0,
      duration: duration ? parseFloat(duration[1]) : null,
      startTime: startTime ? isMP3 ? 0 : parseFloat(startTime[1]) : null
    };
    return result;
  } catch (err) {
    if (err.message.includes("This file cannot be read by `ffprobe`. Is it a valid multimedia file?")) {
      throw new Error("This file cannot be read by `ffprobe`. Is it a valid multimedia file?");
    }
    throw err;
  }
}, "getAudioChannelsAndDurationWithoutCache");
async function getAudioChannelsAndDurationUnlimited({
  downloadMap,
  src,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  audioStreamIndex
}) {
  const cacheKey = audioStreamIndex ? `${src}-${audioStreamIndex}` : src;
  if (downloadMap.durationOfAssetCache[cacheKey]) {
    return downloadMap.durationOfAssetCache[cacheKey];
  }
  const result = await getAudioChannelsAndDurationWithoutCache({
    src,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal,
    audioStreamIndex
  });
  downloadMap.durationOfAssetCache[cacheKey] = result;
  return result;
}
__name(getAudioChannelsAndDurationUnlimited, "getAudioChannelsAndDurationUnlimited");
var getAudioChannelsAndDuration = /* @__PURE__ */ __name(({
  downloadMap,
  src,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  audioStreamIndex
}) => {
  return limit(() => getAudioChannelsAndDurationUnlimited({
    downloadMap,
    src,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal,
    audioStreamIndex
  }));
}, "getAudioChannelsAndDuration");
function isHighSurrogate(codePoint) {
  return codePoint >= 55296 && codePoint <= 56319;
}
__name(isHighSurrogate, "isHighSurrogate");
function isLowSurrogate(codePoint) {
  return codePoint >= 56320 && codePoint <= 57343;
}
__name(isLowSurrogate, "isLowSurrogate");
var getLength = Buffer.byteLength.bind(Buffer);
function truncateUtf8Bytes(string, byteLength) {
  if (typeof string !== "string") {
    throw new Error("Input must be string");
  }
  const charLength = string.length;
  let curByteLength = 0;
  let codePoint;
  let segment;
  for (let i = 0; i < charLength; i += 1) {
    codePoint = string.charCodeAt(i);
    segment = string[i];
    if (isHighSurrogate(codePoint) && isLowSurrogate(string.charCodeAt(i + 1))) {
      i += 1;
      segment += string[i];
    }
    curByteLength += getLength(segment);
    if (curByteLength === byteLength) {
      return string.slice(0, i + 1);
    }
    if (curByteLength > byteLength) {
      return string.slice(0, i - segment.length + 1);
    }
  }
  return string;
}
__name(truncateUtf8Bytes, "truncateUtf8Bytes");
var illegalRe = /[/?<>\\:*|"]/g;
var controlRe = /[\x00-\x1f\x80-\x9f]/g;
var reservedRe = /^\.+$/;
var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
var windowsTrailingRe = /[. ]+$/;
function sanitize(input, replacement) {
  if (typeof input !== "string") {
    throw new Error("Input must be string");
  }
  const sanitized = input.replace(illegalRe, replacement).replace(controlRe, replacement).replace(reservedRe, replacement).replace(windowsReservedRe, replacement).replace(windowsTrailingRe, replacement);
  return truncateUtf8Bytes(sanitized, 255);
}
__name(sanitize, "sanitize");
var sanitizeFilename = /* @__PURE__ */ __name((input) => {
  const replacement = "";
  const output = sanitize(input, replacement);
  if (replacement === "") {
    return output;
  }
  return sanitize(output, "");
}, "sanitizeFilename");
var pathSeparators = /[/\\]/;
var sanitizeFilePath = /* @__PURE__ */ __name((pathToSanitize) => {
  return pathToSanitize.split(pathSeparators).map((s) => sanitizeFilename(s)).join(path10.sep);
}, "sanitizeFilePath");
var waitForAssetToBeDownloaded = /* @__PURE__ */ __name(({
  src,
  downloadDir,
  downloadMap
}) => {
  if (downloadMap.hasBeenDownloadedMap[src]?.[downloadDir]) {
    return Promise.resolve(downloadMap.hasBeenDownloadedMap[src]?.[downloadDir]);
  }
  if (!downloadMap.listeners[src]) {
    downloadMap.listeners[src] = {};
  }
  if (!downloadMap.listeners[src][downloadDir]) {
    downloadMap.listeners[src][downloadDir] = [];
  }
  return new Promise((resolve22) => {
    downloadMap.listeners[src][downloadDir].push(() => {
      const srcMap = downloadMap.hasBeenDownloadedMap[src];
      if (!srcMap?.[downloadDir]) {
        throw new Error("Expected file for " + src + "to be available in " + downloadDir);
      }
      resolve22(srcMap[downloadDir]);
    });
  });
}, "waitForAssetToBeDownloaded");
var notifyAssetIsDownloaded = /* @__PURE__ */ __name(({
  src,
  downloadDir,
  to,
  downloadMap
}) => {
  if (!downloadMap.listeners[src]) {
    downloadMap.listeners[src] = {};
  }
  if (!downloadMap.listeners[src][downloadDir]) {
    downloadMap.listeners[src][downloadDir] = [];
  }
  if (!downloadMap.isDownloadingMap[src]) {
    downloadMap.isDownloadingMap[src] = {};
  }
  downloadMap.isDownloadingMap[src][downloadDir] = false;
  if (!downloadMap.hasBeenDownloadedMap[src]) {
    downloadMap.hasBeenDownloadedMap[src] = {};
  }
  downloadMap.hasBeenDownloadedMap[src][downloadDir] = to;
  downloadMap.listeners[src][downloadDir].forEach((fn) => fn());
}, "notifyAssetIsDownloaded");
var validateMimeType = /* @__PURE__ */ __name((mimeType, src) => {
  if (!mimeType.includes("/")) {
    const errMessage = [
      "A data URL was passed but did not have the correct format so that Remotion could convert it for the video to be rendered.",
      "The format of the data URL must be `data:[mime-type];[encoding],[data]`.",
      "The `mime-type` parameter must be a valid mime type.",
      "The data that was received is (truncated to 100 characters):",
      src.substr(0, 100)
    ].join(" ");
    throw new TypeError(errMessage);
  }
}, "validateMimeType");
function validateBufferEncoding(potentialEncoding, dataUrl) {
  const asserted = potentialEncoding;
  const validEncodings = [
    "ascii",
    "base64",
    "base64url",
    "binary",
    "hex",
    "latin1",
    "ucs-2",
    "ucs2",
    "utf-8",
    "utf16le",
    "utf8"
  ];
  if (!validEncodings.find((en) => asserted === en)) {
    const errMessage = [
      "A data URL was passed but did not have the correct format so that Remotion could convert it for the video to be rendered.",
      "The format of the data URL must be `data:[mime-type];[encoding],[data]`.",
      "The `encoding` parameter must be one of the following:",
      `${validEncodings.join(" ")}.`,
      "The data that was received is (truncated to 100 characters):",
      dataUrl.substr(0, 100)
    ].join(" ");
    throw new TypeError(errMessage);
  }
}
__name(validateBufferEncoding, "validateBufferEncoding");
var downloadAsset = /* @__PURE__ */ __name(async ({
  src,
  downloadMap,
  indent,
  logLevel,
  shouldAnalyzeAudioImmediately,
  binariesDirectory,
  cancelSignalForAudioAnalysis,
  audioStreamIndex
}) => {
  if (isAssetCompressed(src)) {
    return src;
  }
  const { downloadDir } = downloadMap;
  if (downloadMap.hasBeenDownloadedMap[src]?.[downloadDir]) {
    const claimedDownloadLocation = downloadMap.hasBeenDownloadedMap[src]?.[downloadDir];
    if (fs11.existsSync(claimedDownloadLocation)) {
      return claimedDownloadLocation;
    }
    downloadMap.hasBeenDownloadedMap[src][downloadDir] = null;
    if (!downloadMap.isDownloadingMap[src]) {
      downloadMap.isDownloadingMap[src] = {};
    }
    downloadMap.isDownloadingMap[src][downloadDir] = false;
  }
  if (downloadMap.isDownloadingMap[src]?.[downloadDir]) {
    return waitForAssetToBeDownloaded({ downloadMap, src, downloadDir });
  }
  if (!downloadMap.isDownloadingMap[src]) {
    downloadMap.isDownloadingMap[src] = {};
  }
  downloadMap.isDownloadingMap[src][downloadDir] = true;
  downloadMap.emitter.dispatchDownload(src);
  if (src.startsWith("data:")) {
    const [assetDetails, assetData] = src.substring("data:".length).split(",");
    if (!assetDetails.includes(";")) {
      const errMessage = [
        "A data URL was passed but did not have the correct format so that Remotion could convert it for the video to be rendered.",
        "The format of the data URL must be `data:[mime-type];[encoding],[data]`.",
        "The data that was received is (truncated to 100 characters):",
        src.substring(0, 100)
      ].join(" ");
      throw new TypeError(errMessage);
    }
    const [mimeType, encoding] = assetDetails.split(";");
    validateMimeType(mimeType, src);
    validateBufferEncoding(encoding, src);
    const output = getSanitizedFilenameForAssetUrl({
      contentDisposition: null,
      downloadDir,
      src,
      contentType: mimeType
    });
    ensureOutputDirectory(output);
    const buff = Buffer.from(assetData, encoding);
    await fs11.promises.writeFile(output, buff);
    notifyAssetIsDownloaded({ src, downloadMap, downloadDir, to: output });
    return output;
  }
  const { to } = await downloadFile({
    url: src,
    onProgress: /* @__PURE__ */ __name((progress) => {
      downloadMap.emitter.dispatchDownloadProgress(src, progress.percent, progress.downloaded, progress.totalSize);
    }, "onProgress"),
    to: /* @__PURE__ */ __name((contentDisposition, contentType) => getSanitizedFilenameForAssetUrl({
      contentDisposition,
      downloadDir,
      src,
      contentType
    }), "to"),
    indent,
    logLevel,
    abortSignal: downloadMap.cleanupController.signal
  });
  notifyAssetIsDownloaded({ src, downloadMap, downloadDir, to });
  if (shouldAnalyzeAudioImmediately) {
    await getAudioChannelsAndDuration({
      binariesDirectory,
      downloadMap,
      src: to,
      indent,
      logLevel,
      cancelSignal: cancelSignalForAudioAnalysis,
      audioStreamIndex
    });
  }
  return to;
}, "downloadAsset");
var markAllAssetsAsDownloaded = /* @__PURE__ */ __name((downloadMap) => {
  Object.keys(downloadMap.hasBeenDownloadedMap).forEach((key) => {
    delete downloadMap.hasBeenDownloadedMap[key];
  });
  Object.keys(downloadMap.isDownloadingMap).forEach((key) => {
    delete downloadMap.isDownloadingMap[key];
  });
}, "markAllAssetsAsDownloaded");
var getFilename = /* @__PURE__ */ __name(({
  contentDisposition,
  src,
  contentType
}) => {
  const filenameProbe = "filename=";
  if (contentDisposition?.includes(filenameProbe)) {
    const start = contentDisposition.indexOf(filenameProbe);
    const onlyFromFileName = contentDisposition.substring(start + filenameProbe.length);
    const hasSemi = onlyFromFileName.indexOf(";");
    if (hasSemi === -1) {
      return { pathname: onlyFromFileName.trim(), search: "" };
    }
    return {
      search: "",
      pathname: onlyFromFileName.substring(0, hasSemi).trim()
    };
  }
  const { pathname, search } = new URL(src);
  const ext = extname2(pathname);
  if (!ext && contentType) {
    const matchedExt = getExt(contentType);
    return {
      pathname: `${pathname}.${matchedExt}`,
      search
    };
  }
  return { pathname, search };
}, "getFilename");
var getSanitizedFilenameForAssetUrl = /* @__PURE__ */ __name(({
  src,
  downloadDir,
  contentDisposition,
  contentType
}) => {
  if (isAssetCompressed(src)) {
    return src;
  }
  const { pathname, search } = getFilename({
    contentDisposition,
    contentType,
    src
  });
  const split = pathname.split(".");
  const fileExtension = split.length > 1 && split[split.length - 1] ? `.${split[split.length - 1]}` : "";
  const hashedFileName = String(random(`${src}${pathname}${search}`)).replace("0.", "");
  const filename = hashedFileName + fileExtension;
  return path11.join(downloadDir, sanitizeFilePath(filename));
}, "getSanitizedFilenameForAssetUrl");
var downloadAndMapAssetsToFileUrl = /* @__PURE__ */ __name(async ({
  renderAsset,
  onDownload,
  downloadMap,
  logLevel,
  indent,
  binariesDirectory,
  cancelSignalForAudioAnalysis,
  shouldAnalyzeAudioImmediately
}) => {
  const cleanup = attachDownloadListenerToEmitter(downloadMap, onDownload);
  const newSrc = await downloadAsset({
    src: renderAsset.src,
    downloadMap,
    indent,
    logLevel,
    shouldAnalyzeAudioImmediately,
    binariesDirectory,
    cancelSignalForAudioAnalysis,
    audioStreamIndex: renderAsset.audioStreamIndex
  });
  cleanup();
  return {
    ...renderAsset,
    src: newSrc
  };
}, "downloadAndMapAssetsToFileUrl");
var attachDownloadListenerToEmitter = /* @__PURE__ */ __name((downloadMap, onDownload) => {
  const cleanup = [];
  if (!onDownload) {
    return () => {
      return;
    };
  }
  if (downloadMap.downloadListeners.includes(onDownload)) {
    return () => {
      return;
    };
  }
  downloadMap.downloadListeners.push(onDownload);
  cleanup.push(() => {
    downloadMap.downloadListeners = downloadMap.downloadListeners.filter((l) => l !== onDownload);
    return Promise.resolve();
  });
  const cleanupDownloadListener = downloadMap.emitter.addEventListener("download", ({ detail: { src: initialSrc } }) => {
    const progress = onDownload(initialSrc);
    const cleanupProgressListener = downloadMap.emitter.addEventListener("progress", ({ detail: { downloaded, percent, src: progressSrc, totalSize } }) => {
      if (initialSrc === progressSrc) {
        progress?.({ downloaded, percent, totalSize });
      }
    });
    cleanup.push(() => {
      cleanupProgressListener();
      return Promise.resolve();
    });
  });
  cleanup.push(() => {
    cleanupDownloadListener();
    return Promise.resolve();
  });
  return () => {
    cleanup.forEach((c) => c());
  };
}, "attachDownloadListenerToEmitter");
var makeNonce = /* @__PURE__ */ __name(() => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}, "makeNonce");
var serializeCommand = /* @__PURE__ */ __name((command, params) => {
  return {
    nonce: makeNonce(),
    payload: {
      type: command,
      params
    }
  };
}, "serializeCommand");
var startLongRunningCompositor = /* @__PURE__ */ __name(({
  maximumFrameCacheItemsInBytes,
  logLevel,
  indent,
  binariesDirectory,
  extraThreads
}) => {
  return startCompositor({
    type: "StartLongRunningProcess",
    payload: {
      concurrency: extraThreads,
      maximum_frame_cache_size_in_bytes: maximumFrameCacheItemsInBytes,
      verbose: isEqualOrBelowLogLevel(logLevel, "verbose")
    },
    logLevel,
    indent,
    binariesDirectory
  });
}, "startLongRunningCompositor");
var startCompositor = /* @__PURE__ */ __name(({
  type,
  payload,
  logLevel,
  indent,
  binariesDirectory = null
}) => {
  const bin = getExecutablePath({
    type: "compositor",
    indent,
    logLevel,
    binariesDirectory
  });
  makeFileExecutableIfItIsNot(bin);
  const fullCommand = serializeCommand(type, payload);
  const cwd = path12.dirname(bin);
  const child = spawn3(bin, [JSON.stringify(fullCommand)], {
    cwd,
    env: process.platform === "darwin" ? {
      DYLD_LIBRARY_PATH: cwd
    } : void 0
  });
  let stderrChunks = [];
  const waiters = /* @__PURE__ */ new Map();
  const onMessage = /* @__PURE__ */ __name((statusType, nonce, data) => {
    if (nonce === "0") {
      Log.verbose({ indent, logLevel, tag: "compositor" }, new TextDecoder("utf8").decode(data));
    } else if (waiters.has(nonce)) {
      if (statusType === "error") {
        try {
          const parsed = JSON.parse(new TextDecoder("utf8").decode(data));
          waiters.get(nonce).reject(new Error(`Compositor error: ${parsed.error}
${parsed.backtrace}`));
        } catch {
          waiters.get(nonce).reject(new Error(new TextDecoder("utf8").decode(data)));
        }
      } else {
        waiters.get(nonce).resolve(data);
      }
      waiters.delete(nonce);
    }
  }, "onMessage");
  const { onData, getOutputBuffer, clear } = makeStreamer(onMessage);
  let runningStatus = { type: "running" };
  child.stdout.on("data", onData);
  child.stderr.on("data", (data) => {
    stderrChunks.push(data);
  });
  let resolve22 = null;
  let reject = null;
  child.on("close", (code, signal) => {
    const waitersToKill = Array.from(waiters.values());
    if (code === 0) {
      runningStatus = { type: "quit-without-error", signal };
      resolve22?.();
      for (const waiter of waitersToKill) {
        waiter.reject(new Error(`Compositor quit${signal ? ` with signal ${signal}` : ""}`));
      }
      waiters.clear();
    } else {
      const errorMessage = Buffer.concat(stderrChunks).toString("utf-8") + new TextDecoder("utf-8").decode(getOutputBuffer());
      runningStatus = { type: "quit-with-error", error: errorMessage, signal };
      Log.verbose({ indent, logLevel }, `Compositor exited with code ${code} and signal ${signal}`);
      const error = code === null ? new Error(`Compositor exited with signal ${signal}`) : new Error(`Compositor exited with code ${code}: ${errorMessage}`);
      for (const waiter of waitersToKill) {
        waiter.reject(error);
      }
      waiters.clear();
      reject?.(error);
    }
    clear();
    stderrChunks = [];
  });
  const waitForDone = /* @__PURE__ */ __name(() => {
    return new Promise((res, rej) => {
      if (runningStatus.type === "quit-without-error") {
        rej(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}`));
        return;
      }
      if (runningStatus.type === "quit-with-error") {
        rej(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}: ${runningStatus.error}`));
        return;
      }
      resolve22 = res;
      reject = rej;
    });
  }, "waitForDone");
  const finishCommands = /* @__PURE__ */ __name(async () => {
    await Promise.resolve();
    if (runningStatus.type === "quit-with-error") {
      return Promise.reject(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}: ${runningStatus.error}`));
    }
    if (runningStatus.type === "quit-without-error") {
      return Promise.reject(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}`));
    }
    return new Promise((res, rej) => {
      child.stdin.write(`EOF
`, (e) => {
        if (e) {
          rej(e);
          return;
        }
        res();
      });
    });
  }, "finishCommands");
  const shutDownOrKill = /* @__PURE__ */ __name(() => {
    const shutDownCase = /* @__PURE__ */ __name(async () => {
      await finishCommands();
      await waitForDone();
    }, "shutDownCase");
    let timeout = null;
    const killCase = /* @__PURE__ */ __name(async () => {
      await new Promise((res) => {
        timeout = setTimeout(res, 5e3);
      });
      child.kill("SIGKILL");
    }, "killCase");
    return Promise.race([shutDownCase(), killCase()]).finally(() => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    });
  }, "shutDownOrKill");
  return {
    shutDownOrKill,
    waitForDone,
    finishCommands,
    executeCommand: /* @__PURE__ */ __name((command, params) => {
      return new Promise((_resolve, _reject) => {
        if (runningStatus.type === "quit-without-error") {
          _reject(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}`));
          return;
        }
        if (runningStatus.type === "quit-with-error") {
          _reject(new Error(`Compositor quit${runningStatus.signal ? ` with signal ${runningStatus.signal}` : ""}: ${runningStatus.error.trim()}`));
          return;
        }
        const nonce = makeNonce();
        const composed = {
          nonce,
          payload: {
            type: command,
            params
          }
        };
        child.stdin.write(JSON.stringify(composed) + `
`, (e) => {
          if (e) {
            _reject(e);
          }
        });
        waiters.set(nonce, {
          resolve: _resolve,
          reject: _reject
        });
      });
    }, "executeCommand"),
    pid: child.pid ?? null
  };
}, "startCompositor");
var validateOffthreadVideoCacheSizeInBytes = /* @__PURE__ */ __name((option) => {
  if (option === void 0 || option === null) {
    return;
  }
  if (typeof option !== "number") {
    throw new Error("Expected a number");
  }
  if (option < 0 || option === 0) {
    throw new Error("Expected a positive number");
  }
  if (Number.isNaN(option)) {
    throw new Error("Expected a number");
  }
  if (!Number.isFinite(option)) {
    throw new Error("Expected a finite number");
  }
  if (option % 1 !== 0) {
    throw new Error("Expected a whole number");
  }
}, "validateOffthreadVideoCacheSizeInBytes");
var extractUrlAndSourceFromUrl = /* @__PURE__ */ __name((url2) => {
  const parsed = new URL(url2, "http://localhost");
  const query = parsed.search;
  if (!query.trim()) {
    throw new Error("Expected query from " + url2);
  }
  const params = new URLSearchParams(query);
  const src = params.get("src");
  if (!src) {
    throw new Error("Did not pass `src` parameter");
  }
  const time = params.get("time");
  if (!time) {
    throw new Error("Did not get `time` parameter");
  }
  const transparent = params.get("transparent");
  const toneMapped = params.get("toneMapped");
  if (!toneMapped) {
    throw new Error("Did not get `toneMapped` parameter");
  }
  return {
    src,
    time: parseFloat(time),
    transparent: transparent === "true",
    toneMapped: toneMapped === "true"
  };
}, "extractUrlAndSourceFromUrl");
var REQUEST_CLOSED_TOKEN = "Request closed";
var startOffthreadVideoServer = /* @__PURE__ */ __name(({
  downloadMap,
  logLevel,
  indent,
  offthreadVideoCacheSizeInBytes,
  binariesDirectory,
  offthreadVideoThreads
}) => {
  validateOffthreadVideoCacheSizeInBytes(offthreadVideoCacheSizeInBytes);
  const compositor = startCompositor({
    type: "StartLongRunningProcess",
    payload: {
      concurrency: offthreadVideoThreads,
      maximum_frame_cache_size_in_bytes: offthreadVideoCacheSizeInBytes,
      verbose: isEqualOrBelowLogLevel(logLevel, "verbose")
    },
    logLevel,
    indent,
    binariesDirectory
  });
  return {
    close: /* @__PURE__ */ __name(() => {
      return compositor.shutDownOrKill();
    }, "close"),
    listener: /* @__PURE__ */ __name((req, response) => {
      if (!req.url) {
        throw new Error("Request came in without URL");
      }
      if (!req.url.startsWith("/proxy")) {
        response.writeHead(404);
        response.end();
        return;
      }
      const { src, time, transparent, toneMapped } = extractUrlAndSourceFromUrl(req.url);
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("cache-control", "no-cache, no-store, must-revalidate");
      if (req.method === "OPTIONS") {
        response.statusCode = 200;
        if (req.headers["access-control-request-private-network"]) {
          response.setHeader("Access-Control-Allow-Private-Network", "true");
        }
        response.end();
        return;
      }
      let closed = false;
      req.on("close", () => {
        closed = true;
      });
      let extractStart = Date.now();
      downloadAsset({
        src,
        downloadMap,
        indent,
        logLevel,
        binariesDirectory,
        cancelSignalForAudioAnalysis: void 0,
        shouldAnalyzeAudioImmediately: true,
        audioStreamIndex: void 0
      }).then((to) => {
        return new Promise((resolve22, reject) => {
          if (closed) {
            reject(Error(REQUEST_CLOSED_TOKEN));
            return;
          }
          extractStart = Date.now();
          compositor.executeCommand("ExtractFrame", {
            src: to,
            original_src: src,
            time,
            transparent,
            tone_mapped: toneMapped
          }).then(resolve22).catch(reject);
        });
      }).then((readable) => {
        return new Promise((resolve22, reject) => {
          if (closed) {
            reject(Error(REQUEST_CLOSED_TOKEN));
            return;
          }
          if (!readable) {
            reject(new Error("no readable from compositor"));
            return;
          }
          const extractEnd = Date.now();
          const timeToExtract = extractEnd - extractStart;
          if (timeToExtract > 1e3) {
            Log.verbose({ indent, logLevel }, `Took ${timeToExtract}ms to extract frame from ${src} at ${time}`);
          }
          const firstByte = readable.at(0);
          const secondByte = readable.at(1);
          const thirdByte = readable.at(2);
          const isPng = firstByte === 137 && secondByte === 80 && thirdByte === 78;
          const isBmp = firstByte === 66 && secondByte === 77;
          if (isPng) {
            response.setHeader("content-type", `image/png`);
            response.setHeader("content-length", readable.byteLength);
          } else if (isBmp) {
            response.setHeader("content-type", `image/bmp`);
            response.setHeader("content-length", readable.byteLength);
          } else {
            reject(new Error(`Unknown file type: ${firstByte} ${secondByte} ${thirdByte}`));
            return;
          }
          response.writeHead(200);
          response.write(readable, (err) => {
            response.end();
            if (err) {
              reject(err);
            } else {
              resolve22();
            }
          });
        });
      }).catch((err) => {
        Log.error({ indent, logLevel }, "Could not extract frame from compositor", err);
        if (response.headersSent) {
          Log.error({ indent, logLevel }, "Cannot propagate error message to client because headers have already been sent");
        } else {
          response.writeHead(500);
          response.write(JSON.stringify({ error: err.stack }));
        }
        response.end();
      });
    }, "listener"),
    compositor
  };
}, "startOffthreadVideoServer");
var OffthreadVideoServerEmitter = class {
  static {
    __name(this, "OffthreadVideoServerEmitter");
  }
  listeners = {
    progress: [],
    download: []
  };
  addEventListener(name, callback) {
    this.listeners[name].push(callback);
    return () => {
      this.removeEventListener(name, callback);
    };
  }
  removeEventListener(name, callback) {
    this.listeners[name] = this.listeners[name].filter((l) => l !== callback);
  }
  dispatchEvent(dispatchName, context) {
    this.listeners[dispatchName].forEach((callback) => {
      callback({ detail: context });
    });
  }
  dispatchDownloadProgress(src, percent, downloaded, totalSize) {
    this.dispatchEvent("progress", {
      downloaded,
      percent,
      totalSize,
      src
    });
  }
  dispatchDownload(src) {
    this.dispatchEvent("download", {
      src
    });
  }
};
var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
var randomHash = /* @__PURE__ */ __name(() => {
  return new Array(10).fill(1).map(() => {
    return alphabet[Math.floor(Math.random() * alphabet.length)];
  }).join("");
}, "randomHash");
var tmpDir = /* @__PURE__ */ __name((str) => {
  const newDir = path13.join(os7.tmpdir(), str + randomHash());
  if (fs12.existsSync(newDir)) {
    fs12.rmSync(newDir, {
      recursive: true,
      force: true
    });
  }
  mkdirSync(newDir);
  return newDir;
}, "tmpDir");
var applyToneFrequencyUsingFfmpeg = /* @__PURE__ */ __name(async ({
  input,
  output,
  toneFrequency,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  sampleRate
}) => {
  const filter = `asetrate=${sampleRate}*${toneFrequency},aresample=${sampleRate},atempo=1/${toneFrequency}`;
  const args = [
    "-hide_banner",
    "-i",
    input,
    ["-ac", "2"],
    "-filter:a",
    filter,
    ["-c:a", "pcm_s16le"],
    ["-ar", String(sampleRate)],
    "-y",
    output
  ].flat(2);
  Log.verbose({ indent, logLevel }, "Changing tone frequency using FFmpeg:", JSON.stringify(args.join(" ")), "Filter:", filter);
  const startTimestamp = Date.now();
  const task = callFf({
    bin: "ffmpeg",
    args,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
  await task;
  Log.verbose({ indent, logLevel }, "Changed tone frequency using FFmpeg", `${Date.now() - startTimestamp}ms`);
}, "applyToneFrequencyUsingFfmpeg");
var numberTo32BiIntLittleEndian = /* @__PURE__ */ __name((num) => {
  return new Uint8Array([
    num & 255,
    num >> 8 & 255,
    num >> 16 & 255,
    num >> 24 & 255
  ]);
}, "numberTo32BiIntLittleEndian");
var numberTo16BitLittleEndian = /* @__PURE__ */ __name((num) => {
  return new Uint8Array([num & 255, num >> 8 & 255]);
}, "numberTo16BitLittleEndian");
var correctFloatingPointError = /* @__PURE__ */ __name((value) => {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-5) {
    return rounded;
  }
  return value;
}, "correctFloatingPointError");
var BIT_DEPTH = 16;
var BYTES_PER_SAMPLE = BIT_DEPTH / 8;
var NUMBER_OF_CHANNELS = 2;
var makeInlineAudioMixing = /* @__PURE__ */ __name((dir, sampleRate) => {
  const folderToAdd = makeAndReturn(dir, "remotion-inline-audio-mixing");
  const openFiles = {};
  const writtenHeaders = {};
  const toneFrequencies = {};
  const cleanup = /* @__PURE__ */ __name(() => {
    for (const fd of Object.values(openFiles)) {
      try {
        fs13.closeSync(fd);
      } catch {
      }
    }
    deleteDirectory(folderToAdd);
  }, "cleanup");
  const getListOfAssets = /* @__PURE__ */ __name(() => {
    return Object.keys(openFiles);
  }, "getListOfAssets");
  const getFilePath = /* @__PURE__ */ __name((asset) => {
    return path14.join(folderToAdd, `${asset.id}.wav`);
  }, "getFilePath");
  const ensureAsset = /* @__PURE__ */ __name(({
    asset,
    fps,
    totalNumberOfFrames,
    trimLeftOffset,
    trimRightOffset
  }) => {
    const filePath = getFilePath(asset);
    if (!openFiles[filePath]) {
      openFiles[filePath] = fs13.openSync(filePath, "w");
    }
    if (writtenHeaders[filePath]) {
      return;
    }
    writtenHeaders[filePath] = true;
    const expectedDataSize = Math.round((totalNumberOfFrames / fps - trimLeftOffset + trimRightOffset) * NUMBER_OF_CHANNELS * sampleRate * BYTES_PER_SAMPLE);
    const expectedSize = 40 + expectedDataSize;
    const fd = openFiles[filePath];
    writeSync(fd, new Uint8Array([82, 73, 70, 70]), 0, 4, 0);
    writeSync(fd, new Uint8Array(numberTo32BiIntLittleEndian(expectedSize)), 0, 4, 4);
    writeSync(fd, new Uint8Array([87, 65, 86, 69]), 0, 4, 8);
    writeSync(fd, new Uint8Array([102, 109, 116, 32]), 0, 4, 12);
    writeSync(fd, new Uint8Array([BIT_DEPTH, 0, 0, 0]), 0, 4, 16);
    writeSync(fd, new Uint8Array([1, 0]), 0, 2, 20);
    writeSync(fd, new Uint8Array([NUMBER_OF_CHANNELS, 0]), 0, 2, 22);
    writeSync(fd, new Uint8Array(numberTo32BiIntLittleEndian(sampleRate)), 0, 4, 24);
    writeSync(fd, new Uint8Array(numberTo32BiIntLittleEndian(sampleRate * NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE)), 0, 4, 28);
    writeSync(fd, new Uint8Array(numberTo16BitLittleEndian(NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE)), 0, 2, 32);
    writeSync(fd, numberTo16BitLittleEndian(BIT_DEPTH), 0, 2, 34);
    writeSync(fd, new Uint8Array([100, 97, 116, 97]), 0, 4, 36);
    writeSync(fd, new Uint8Array(numberTo32BiIntLittleEndian(expectedDataSize)), 0, 4, 40);
  }, "ensureAsset");
  const finish = /* @__PURE__ */ __name(async ({
    binariesDirectory,
    indent,
    logLevel,
    cancelSignal,
    sampleRate: finishSampleRate
  }) => {
    for (const fd of Object.keys(openFiles)) {
      const frequency = toneFrequencies[fd];
      if (frequency !== 1) {
        const tmpFile = fd.replace(/.wav$/, "-tmp.wav");
        await applyToneFrequencyUsingFfmpeg({
          input: fd,
          output: tmpFile,
          toneFrequency: frequency,
          indent,
          logLevel,
          binariesDirectory,
          cancelSignal,
          sampleRate: finishSampleRate
        });
        fs13.renameSync(tmpFile, fd);
      }
    }
  }, "finish");
  const addAsset = /* @__PURE__ */ __name(({
    asset,
    fps,
    totalNumberOfFrames,
    firstFrame,
    trimLeftOffset,
    trimRightOffset
  }) => {
    ensureAsset({
      asset,
      fps,
      totalNumberOfFrames,
      trimLeftOffset,
      trimRightOffset
    });
    const filePath = getFilePath(asset);
    if (toneFrequencies[filePath] !== void 0 && toneFrequencies[filePath] !== asset.toneFrequency) {
      throw new Error(`toneFrequency must be the same across the entire audio, got ${asset.toneFrequency}, but before it was ${toneFrequencies[filePath]}`);
    }
    const fileDescriptor = openFiles[filePath];
    toneFrequencies[filePath] = asset.toneFrequency;
    let arr = new Int16Array(asset.audio);
    const isFirst = asset.frame === firstFrame;
    const isLast = asset.frame === totalNumberOfFrames + firstFrame - 1;
    const samplesToShaveFromStart = trimLeftOffset * sampleRate;
    const samplesToShaveFromEnd = trimRightOffset * sampleRate;
    if (isFirst) {
      arr = arr.slice(Math.floor(correctFloatingPointError(samplesToShaveFromStart)) * NUMBER_OF_CHANNELS);
    }
    if (isLast) {
      arr = arr.slice(0, arr.length + Math.ceil(correctFloatingPointError(samplesToShaveFromEnd)) * NUMBER_OF_CHANNELS);
    }
    const positionInSeconds = (asset.frame - firstFrame) / fps - (isFirst ? 0 : trimLeftOffset);
    const position = Math.floor(correctFloatingPointError(positionInSeconds * sampleRate)) * NUMBER_OF_CHANNELS * BYTES_PER_SAMPLE;
    writeSync(fileDescriptor, arr, 0, arr.byteLength, 44 + position);
  }, "addAsset");
  return {
    cleanup,
    addAsset,
    getListOfAssets,
    finish
  };
}, "makeInlineAudioMixing");
var makeAndReturn = /* @__PURE__ */ __name((dir, name) => {
  const p = path15.join(dir, name);
  mkdirSync2(p);
  return p;
}, "makeAndReturn");
var makeDownloadMap = /* @__PURE__ */ __name((sampleRate) => {
  const dir = tmpDir(`remotion-v${VERSION}-assets`);
  let prevented = false;
  return {
    isDownloadingMap: {},
    hasBeenDownloadedMap: {},
    listeners: {},
    durationOfAssetCache: {},
    id: String(Math.random()),
    assetDir: dir,
    downloadListeners: [],
    downloadDir: makeAndReturn(dir, "remotion-assets-dir"),
    complexFilter: makeAndReturn(dir, "remotion-complex-filter"),
    preEncode: makeAndReturn(dir, "pre-encode"),
    audioMixing: makeAndReturn(dir, "remotion-audio-mixing"),
    audioPreprocessing: makeAndReturn(dir, "remotion-audio-preprocessing"),
    stitchFrames: makeAndReturn(dir, "remotion-stitch-temp-dir"),
    compositingDir: makeAndReturn(dir, "remotion-compositing-temp-dir"),
    emitter: new OffthreadVideoServerEmitter(),
    preventCleanup: /* @__PURE__ */ __name(() => {
      prevented = true;
    }, "preventCleanup"),
    allowCleanup: /* @__PURE__ */ __name(() => {
      prevented = false;
    }, "allowCleanup"),
    isPreventedFromCleanup: /* @__PURE__ */ __name(() => {
      return prevented;
    }, "isPreventedFromCleanup"),
    inlineAudioMixing: makeInlineAudioMixing(dir, sampleRate),
    cleanupController: new AbortController()
  };
}, "makeDownloadMap");
var cleanDownloadMap = /* @__PURE__ */ __name((downloadMap) => {
  if (downloadMap.isPreventedFromCleanup()) {
    return;
  }
  downloadMap.cleanupController.abort();
  deleteDirectory(downloadMap.downloadDir);
  deleteDirectory(downloadMap.complexFilter);
  deleteDirectory(downloadMap.compositingDir);
  downloadMap.inlineAudioMixing.cleanup();
  deleteDirectory(downloadMap.assetDir);
}, "cleanDownloadMap");
var map = /* @__PURE__ */ __name((webpackBundleOrServeUrl, suffix) => {
  if (isServeUrl(webpackBundleOrServeUrl)) {
    const parsed = new URL(webpackBundleOrServeUrl);
    const idx = parsed.pathname.lastIndexOf("/");
    if (idx === -1) {
      return parsed.origin + "/" + suffix;
    }
    return parsed.origin + parsed.pathname.substring(0, idx + 1) + suffix;
  }
  const index = webpackBundleOrServeUrl.lastIndexOf(path16.sep);
  const url2 = webpackBundleOrServeUrl.substring(0, index + 1) + suffix;
  return url2;
}, "map");
var getBundleMapUrlFromServeUrl = /* @__PURE__ */ __name((serveUrl) => {
  return map(serveUrl, NoReactInternals.bundleMapName);
}, "getBundleMapUrlFromServeUrl");
var normalizeServeUrl = /* @__PURE__ */ __name((unnormalized) => {
  const hasQuery = unnormalized.includes("?");
  if (hasQuery) {
    return normalizeServeUrl(unnormalized.substr(0, unnormalized.indexOf("?")));
  }
  const endsInIndexHtml = unnormalized.endsWith("index.html");
  if (endsInIndexHtml) {
    return unnormalized;
  }
  if (unnormalized.endsWith("/")) {
    return `${unnormalized}index.html`;
  }
  return `${unnormalized}/index.html`;
}, "normalizeServeUrl");
var createLock = /* @__PURE__ */ __name(({ timeout }) => {
  let locks = [];
  const waiters = [];
  const lock2 = /* @__PURE__ */ __name(() => {
    const id = Math.random();
    locks.push(id);
    return id;
  }, "lock");
  const unlock2 = /* @__PURE__ */ __name((id) => {
    locks = locks.filter((l) => l !== id);
    resolveWaiters();
  }, "unlock");
  const resolveWaiters = /* @__PURE__ */ __name(() => {
    if (locks.length === 0) {
      waiters.forEach((w) => w());
    }
  }, "resolveWaiters");
  const waitForAllToBeDone2 = /* @__PURE__ */ __name(() => {
    const success = new Promise((resolve22) => {
      waiters.push(() => {
        resolve22();
      });
    });
    resolveWaiters();
    if (locks.length === 0) {
      return Promise.resolve();
    }
    if (timeout === null) {
      return success;
    }
    const timeoutFn = new Promise((resolve22) => {
      setTimeout(() => {
        return resolve22();
      }, timeout);
    });
    return Promise.race([success, timeoutFn]);
  }, "waitForAllToBeDone");
  return {
    lock: lock2,
    unlock: unlock2,
    waitForAllToBeDone: waitForAllToBeDone2
  };
}, "createLock");
var isPortAvailableOnHost = /* @__PURE__ */ __name(({
  portToTry,
  host
}) => {
  return new Promise((resolve22) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      resolve22("unavailable");
    });
    server.listen({ port: portToTry, host }, () => {
      server.close(() => {
        resolve22("available");
      });
    });
  });
}, "isPortAvailableOnHost");
var testPortAvailableOnMultipleHosts = /* @__PURE__ */ __name(async ({
  hosts,
  port
}) => {
  for (const host of hosts) {
    const result = await isPortAvailableOnHost({ portToTry: port, host });
    if (result === "unavailable") {
      return "unavailable";
    }
  }
  return "available";
}, "testPortAvailableOnMultipleHosts");
var getPort = /* @__PURE__ */ __name(async ({
  from,
  to,
  hostsToTest,
  onPortUnavailable
}) => {
  const ports = makeRange(from, to);
  for (const port of ports) {
    if (await testPortAvailableOnMultipleHosts({
      port,
      hosts: hostsToTest
    }) === "available") {
      return { port, didUsePort: false };
    }
    if (onPortUnavailable) {
      const action = await onPortUnavailable(port);
      if (action === "stop") {
        return { port, didUsePort: true };
      }
    }
  }
  throw new Error("No available ports found");
}, "getPort");
var portLocks = createLock({ timeout: 1e4 });
var getDesiredPort = /* @__PURE__ */ __name(async ({
  desiredPort,
  from,
  hostsToTry,
  to,
  onPortUnavailable
}) => {
  await portLocks.waitForAllToBeDone();
  const lockPortSelection = portLocks.lock();
  const unlockPort = /* @__PURE__ */ __name(() => portLocks.unlock(lockPortSelection), "unlockPort");
  if (typeof desiredPort !== "undefined" && await testPortAvailableOnMultipleHosts({
    port: desiredPort,
    hosts: hostsToTry
  }) === "available") {
    return { port: desiredPort, unlockPort, didUsePort: false };
  }
  if (typeof desiredPort !== "undefined" && onPortUnavailable) {
    const action = await onPortUnavailable(desiredPort);
    if (action === "stop") {
      return { port: desiredPort, unlockPort, didUsePort: true };
    }
  }
  const result = await getPort({
    from,
    to,
    hostsToTest: hostsToTry,
    onPortUnavailable
  });
  if (result.didUsePort) {
    return { port: result.port, unlockPort, didUsePort: true };
  }
  if (desiredPort && desiredPort !== result.port) {
    unlockPort();
    throw new Error(`You specified port ${desiredPort} to be used for the HTTP server, but it is not available. Choose a different port or remove the setting to let Remotion automatically select a free port.`);
  }
  return { port: result.port, unlockPort, didUsePort: false };
}, "getDesiredPort");
var makeRange = /* @__PURE__ */ __name((from, to) => {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new TypeError("`from` and `to` must be integer numbers");
  }
  if (from < 1024 || from > 65535) {
    throw new RangeError("`from` must be between 1024 and 65535");
  }
  if (to < 1024 || to > 65536) {
    throw new RangeError("`to` must be between 1024 and 65536");
  }
  if (to < from) {
    throw new RangeError("`to` must be greater than or equal to `from`");
  }
  return new Array(to - from + 1).fill(true).map((_, i) => {
    return i + from;
  });
}, "makeRange");
var cached = null;
var getPortConfig = /* @__PURE__ */ __name((preferIpv4) => {
  if (cached) {
    return cached;
  }
  const networkInterfaces = os8.networkInterfaces();
  const flattened = flattenNetworkInterfaces(networkInterfaces);
  const host = getHostToBind(flattened, preferIpv4);
  const hostsToTry = getHostsToTry(flattened);
  const response = { host, hostsToTry };
  cached = response;
  return response;
}, "getPortConfig");
var getHostToBind = /* @__PURE__ */ __name((flattened, preferIpv4) => {
  if (preferIpv4 || !isIpV6Supported(flattened)) {
    return "0.0.0.0";
  }
  return "::";
}, "getHostToBind");
var getHostsToTry = /* @__PURE__ */ __name((flattened) => {
  return [
    hasIPv6LoopbackAddress(flattened) ? "::1" : null,
    hasIpv4LoopbackAddress(flattened) ? "127.0.0.1" : null,
    isIpV6Supported(flattened) ? "::" : null,
    "0.0.0.0"
  ].filter(truthy);
}, "getHostsToTry");
var flattenNetworkInterfaces = /* @__PURE__ */ __name((networkInterfaces) => {
  const result = [];
  for (const iface in networkInterfaces) {
    for (const configuration of networkInterfaces[iface]) {
      result.push(configuration);
    }
  }
  return result;
}, "flattenNetworkInterfaces");
var isIpV6Supported = /* @__PURE__ */ __name((flattened) => {
  for (const configuration of flattened) {
    if (configuration.family === "IPv6" && !configuration.internal) {
      return true;
    }
  }
  return false;
}, "isIpV6Supported");
var hasIPv6LoopbackAddress = /* @__PURE__ */ __name((flattened) => {
  for (const configuration of flattened) {
    if (configuration.family === "IPv6" && configuration.internal && configuration.address === "::1") {
      return true;
    }
  }
  return false;
}, "hasIPv6LoopbackAddress");
var hasIpv4LoopbackAddress = /* @__PURE__ */ __name((flattened) => {
  for (const configuration of flattened) {
    if (configuration.family === "IPv4" && configuration.internal && configuration.address === "127.0.0.1") {
      return true;
    }
  }
  return false;
}, "hasIpv4LoopbackAddress");
var isPathInside = /* @__PURE__ */ __name(function(thePath, potentialParent) {
  thePath = stripTrailingSep(thePath);
  potentialParent = stripTrailingSep(potentialParent);
  if (process.platform === "win32") {
    thePath = thePath.toLowerCase();
    potentialParent = potentialParent.toLowerCase();
  }
  return thePath.lastIndexOf(potentialParent, 0) === 0 && (thePath[potentialParent.length] === path17.sep || thePath[potentialParent.length] === void 0);
}, "isPathInside");
function stripTrailingSep(thePath) {
  if (thePath[thePath.length - 1] === path17.sep) {
    return thePath.slice(0, -1);
  }
  return thePath;
}
__name(stripTrailingSep, "stripTrailingSep");
var rangeParser = /* @__PURE__ */ __name((size, str) => {
  if (typeof str !== "string") {
    throw new TypeError("argument str must be a string");
  }
  const index = str.indexOf("=");
  if (index === -1) {
    return -2;
  }
  const arr = str.slice(index + 1).split(",");
  const ranges = [];
  const type = str.slice(0, index);
  for (let i = 0; i < arr.length; i++) {
    const range = arr[i].split("-");
    let start = parseInt(range[0], 10);
    let end = parseInt(range[1], 10);
    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    } else if (isNaN(end)) {
      end = size - 1;
    }
    if (end > size - 1) {
      end = size - 1;
    }
    if (isNaN(start) || isNaN(end) || start > end || start < 0) {
      continue;
    }
    ranges.push({
      start,
      end
    });
  }
  if (ranges.length < 1) {
    return -1;
  }
  return { ranges, type };
}, "rangeParser");
var getHeaders = /* @__PURE__ */ __name((absolutePath, stats) => {
  const { base } = path18.parse(absolutePath);
  let defaultHeaders = {};
  if (stats) {
    defaultHeaders = {
      "Content-Length": String(stats.size),
      "Accept-Ranges": "bytes"
    };
    defaultHeaders["Last-Modified"] = stats.mtime.toUTCString();
    const _contentType = mimeContentType(base);
    if (_contentType) {
      defaultHeaders["Content-Type"] = _contentType;
    }
  }
  return defaultHeaders;
}, "getHeaders");
var getPossiblePaths = /* @__PURE__ */ __name((relativePath, extension) => [
  path18.join(relativePath, `index${extension}`),
  relativePath.endsWith("/") ? relativePath.replace(/\/$/g, extension) : relativePath + extension
].filter((item) => path18.basename(item) !== extension), "getPossiblePaths");
var findRelated = /* @__PURE__ */ __name(async (current, relativePath) => {
  const possible = getPossiblePaths(relativePath, ".html");
  let stats = null;
  for (let index = 0; index < possible.length; index++) {
    const related = possible[index];
    const absolutePath = path18.join(current, related);
    try {
      stats = await promises2.lstat(absolutePath);
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
        throw err;
      }
    }
    if (stats) {
      return {
        stats,
        absolutePath
      };
    }
  }
  return null;
}, "findRelated");
var sendError = /* @__PURE__ */ __name((absolutePath, response, spec) => {
  const { message, statusCode } = spec;
  const headers = getHeaders(absolutePath, null);
  response.writeHead(statusCode, {
    ...headers,
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify({ statusCode, message }));
}, "sendError");
var internalError = /* @__PURE__ */ __name((absolutePath, response) => {
  return sendError(absolutePath, response, {
    statusCode: 500,
    code: "internal_server_error",
    message: "A server error has occurred"
  });
}, "internalError");
var serveHandler = /* @__PURE__ */ __name(async (request, response, config) => {
  const cwd = process.cwd();
  const current = path18.resolve(cwd, config.public);
  let relativePath = null;
  try {
    const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
    relativePath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return sendError("/", response, {
      statusCode: 400,
      code: "bad_request",
      message: "Bad Request"
    });
  }
  let absolutePath = path18.join(current, relativePath);
  if (!isPathInside(absolutePath, current)) {
    return sendError(absolutePath, response, {
      statusCode: 400,
      code: "bad_request",
      message: "Bad Request"
    });
  }
  let stats = null;
  if (path18.extname(relativePath) !== "") {
    try {
      stats = await promises2.lstat(absolutePath);
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
        return internalError(absolutePath, response);
      }
    }
  }
  if (!stats) {
    try {
      const related = await findRelated(current, relativePath);
      if (related) {
        stats = related.stats;
        absolutePath = related.absolutePath;
      }
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
        return internalError(absolutePath, response);
      }
    }
    try {
      stats = await promises2.lstat(absolutePath);
    } catch (err) {
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
        return internalError(absolutePath, response);
      }
    }
  }
  if (stats?.isDirectory()) {
    const directory = null;
    const singleFile = null;
    if (directory) {
      const _contentType = "text/html; charset=utf-8";
      response.statusCode = 200;
      response.setHeader("Content-Type", _contentType);
      response.end("Is a directory");
      return;
    }
    if (!singleFile) {
      stats = null;
    }
  }
  const isSymLink = stats?.isSymbolicLink();
  if (!stats || isSymLink) {
    return sendError(absolutePath, response, {
      statusCode: 404,
      code: "not_found",
      message: "The requested path (" + absolutePath + ") could not be found"
    });
  }
  let streamOpts = null;
  if (request.headers.range && stats.size) {
    const range = rangeParser(stats.size, request.headers.range);
    if (typeof range === "object" && range.type === "bytes") {
      const { start, end } = range.ranges[0];
      streamOpts = {
        start,
        end
      };
      response.statusCode = 206;
    } else {
      response.statusCode = 416;
      response.setHeader("Content-Range", `bytes */${stats.size}`);
    }
  }
  let stream = null;
  try {
    stream = createReadStream(absolutePath, streamOpts ?? {});
  } catch {
    return internalError(absolutePath, response);
  }
  const headers = getHeaders(absolutePath, stats);
  if (streamOpts !== null) {
    headers["Content-Range"] = `bytes ${streamOpts.start}-${streamOpts.end}/${stats.size}`;
    headers["Content-Length"] = String(streamOpts.end - streamOpts.start + 1);
  }
  headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  response.writeHead(response.statusCode || 200, headers);
  stream.pipe(response);
}, "serveHandler");
var serveStatic = /* @__PURE__ */ __name(async (path192, options) => {
  const {
    listener: offthreadRequest,
    close: closeCompositor,
    compositor
  } = startOffthreadVideoServer({
    downloadMap: options.downloadMap,
    offthreadVideoThreads: options.offthreadVideoThreads,
    logLevel: options.logLevel,
    indent: options.indent,
    offthreadVideoCacheSizeInBytes: options.offthreadVideoCacheSizeInBytes,
    binariesDirectory: options.binariesDirectory
  });
  const connections = {};
  const server = http2.createServer((request, response) => {
    if (request.url?.startsWith("/proxy")) {
      return offthreadRequest(request, response);
    }
    if (path192 === null) {
      response.writeHead(404);
      response.end("Server only supports /proxy");
      return;
    }
    serveHandler(request, response, {
      public: path192
    }).catch(() => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end("Error serving file");
    });
  });
  server.on("connection", (conn) => {
    let key;
    try {
      key = conn.remoteAddress + ":" + conn.remotePort;
    } catch {
      key = ":";
    }
    connections[key] = conn;
    conn.on("close", () => {
      delete connections[key];
    });
  });
  let selectedPort = null;
  const maxTries = 10;
  const portConfig = getPortConfig(options.forceIPv4);
  for (let i = 0; i < maxTries; i++) {
    let unlock2 = /* @__PURE__ */ __name(() => {
    }, "unlock");
    try {
      selectedPort = await new Promise((resolve22, reject) => {
        getDesiredPort({
          desiredPort: options?.port ?? void 0,
          from: 3e3,
          to: 3100,
          hostsToTry: portConfig.hostsToTry
        }).then(({ port, unlockPort }) => {
          unlock2 = unlockPort;
          server.listen({ port, host: portConfig.host });
          server.on("listening", () => {
            resolve22(port);
            return unlock2();
          });
          server.on("error", (err) => {
            unlock2();
            reject(err);
          });
        }).catch((err) => {
          unlock2();
          return reject(err);
        });
      });
      const destroyConnections = /* @__PURE__ */ __name(function() {
        for (const key in connections)
          connections[key].destroy();
      }, "destroyConnections");
      const close = /* @__PURE__ */ __name(async () => {
        await Promise.all([
          new Promise((resolve22, reject) => {
            closeCompositor().catch((err) => {
              if (err.message.includes("Compositor quit")) {
                resolve22();
                return;
              }
              reject(err);
            }).finally(() => {
              resolve22();
            });
          }),
          new Promise((resolve22, reject) => {
            destroyConnections();
            server.close((err) => {
              if (err) {
                if (err.code === "ERR_SERVER_NOT_RUNNING") {
                  return resolve22();
                }
                reject(err);
              } else {
                resolve22();
              }
            });
          })
        ]);
      }, "close");
      return { port: selectedPort, close, compositor };
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      const codedError = err;
      if (codedError.code === "EADDRINUSE") {
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Tried ${maxTries} times to find a free port. Giving up.`);
}, "serveStatic");
var { lock, unlock, waitForAllToBeDone } = createLock({ timeout: 5e4 });
var registerErrorSymbolicationLock = lock;
var unlockErrorSymbolicationLock = unlock;
var waitForSymbolicationToBeDone = waitForAllToBeDone;
var prepareServer = /* @__PURE__ */ __name(async ({
  webpackConfigOrServeUrl,
  port,
  remotionRoot,
  offthreadVideoThreads,
  logLevel,
  indent,
  offthreadVideoCacheSizeInBytes,
  binariesDirectory,
  forceIPv4,
  sampleRate
}) => {
  const downloadMap = makeDownloadMap(sampleRate);
  Log.verbose({ indent, logLevel }, "Created directory for temporary files", downloadMap.assetDir);
  if (isServeUrl(webpackConfigOrServeUrl)) {
    const {
      port: offthreadPort,
      close: closeProxy,
      compositor: comp
    } = await serveStatic(null, {
      port,
      downloadMap,
      remotionRoot,
      offthreadVideoThreads,
      logLevel,
      indent,
      offthreadVideoCacheSizeInBytes,
      binariesDirectory,
      forceIPv4
    });
    const normalized = normalizeServeUrl(webpackConfigOrServeUrl);
    let remoteSourceMap = null;
    getSourceMapFromRemoteUrl(getBundleMapUrlFromServeUrl(normalized)).then((s) => {
      remoteSourceMap = s;
    }).catch((err) => {
      Log.verbose({ indent, logLevel }, "Could not fetch sourcemap for ", normalized, err);
    });
    return Promise.resolve({
      serveUrl: normalized,
      closeServer: /* @__PURE__ */ __name(() => {
        cleanDownloadMap(downloadMap);
        remoteSourceMap?.destroy();
        remoteSourceMap = null;
        return closeProxy();
      }, "closeServer"),
      offthreadPort,
      compositor: comp,
      sourceMap: /* @__PURE__ */ __name(() => remoteSourceMap, "sourceMap"),
      downloadMap
    });
  }
  const indexFile = path19.join(webpackConfigOrServeUrl, "index.html");
  const exists = existsSync4(indexFile);
  if (!exists) {
    throw new Error(`Tried to serve the Webpack bundle on a HTTP server, but the file ${indexFile} does not exist. Is this a valid path to a Webpack bundle?`);
  }
  let localSourceMap = null;
  getSourceMapFromLocalFile(path19.join(webpackConfigOrServeUrl, NoReactInternals.bundleName)).then((s) => {
    localSourceMap = s;
  }).catch((err) => {
    Log.verbose({ indent, logLevel }, "Could not fetch sourcemap for ", webpackConfigOrServeUrl, err);
  });
  const {
    port: serverPort,
    close,
    compositor
  } = await serveStatic(webpackConfigOrServeUrl, {
    port,
    downloadMap,
    remotionRoot,
    offthreadVideoThreads,
    logLevel,
    indent,
    offthreadVideoCacheSizeInBytes,
    binariesDirectory,
    forceIPv4
  });
  return Promise.resolve({
    closeServer: /* @__PURE__ */ __name(async (force) => {
      localSourceMap?.destroy();
      localSourceMap = null;
      cleanDownloadMap(downloadMap);
      if (!force) {
        await waitForSymbolicationToBeDone();
      }
      return close();
    }, "closeServer"),
    serveUrl: `http://localhost:${serverPort}`,
    offthreadPort: serverPort,
    compositor,
    sourceMap: /* @__PURE__ */ __name(() => localSourceMap, "sourceMap"),
    downloadMap
  });
}, "prepareServer");
var makeOrReuseServer = /* @__PURE__ */ __name(async (server, config, {
  onDownload
}) => {
  if (server) {
    const cleanupOnDownload = attachDownloadListenerToEmitter(server.downloadMap, onDownload);
    return {
      server,
      cleanupServer: /* @__PURE__ */ __name(() => {
        cleanupOnDownload();
        return Promise.resolve();
      }, "cleanupServer")
    };
  }
  const newServer = await prepareServer(config);
  const cleanupOnDownloadNew = attachDownloadListenerToEmitter(newServer.downloadMap, onDownload);
  return {
    server: newServer,
    cleanupServer: /* @__PURE__ */ __name((force) => {
      cleanupOnDownloadNew();
      return Promise.all([newServer.closeServer(force)]);
    }, "cleanupServer")
  };
}, "makeOrReuseServer");
var EVALUATION_SCRIPT_URL2 = "__puppeteer_evaluation_script__";
function valueFromRemoteObject2(remoteObject) {
  if (remoteObject.unserializableValue) {
    if (remoteObject.type === "bigint" && typeof BigInt !== "undefined")
      return BigInt(remoteObject.unserializableValue.replace("n", ""));
    switch (remoteObject.unserializableValue) {
      case "-0":
        return -0;
      case "NaN":
        return NaN;
      case "Infinity":
        return Infinity;
      case "-Infinity":
        return -Infinity;
      default:
        throw new Error("Unsupported unserializable value: " + remoteObject.unserializableValue);
    }
  }
  return remoteObject.value;
}
__name(valueFromRemoteObject2, "valueFromRemoteObject2");
function puppeteerEvaluateWithCatchAndTimeout({
  args,
  frame,
  page,
  pageFunction,
  timeoutInMilliseconds
}) {
  let timeout = null;
  return Promise.race([
    new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`Timed out evaluating page function "${pageFunction.toString()}"`));
      }, timeoutInMilliseconds);
    }),
    puppeteerEvaluateWithCatch({
      args,
      frame,
      page,
      pageFunction,
      timeoutInMilliseconds
    })
  ]).then((data) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    return data;
  });
}
__name(puppeteerEvaluateWithCatchAndTimeout, "puppeteerEvaluateWithCatchAndTimeout");
async function puppeteerEvaluateWithCatch({
  page,
  pageFunction,
  frame,
  args
}) {
  const contextId = (await page.mainFrame().executionContext())._contextId;
  const client = page._client();
  const suffix = `//# sourceURL=${EVALUATION_SCRIPT_URL2}`;
  if (typeof pageFunction !== "function")
    throw new Error(`Expected to get |string| or |function| as the first argument, but got "${pageFunction}" instead.`);
  let functionText = pageFunction.toString();
  try {
    new Function("(" + functionText + ")");
  } catch {
    if (functionText.startsWith("async "))
      functionText = "async function " + functionText.substring("async ".length);
    else
      functionText = "function " + functionText;
    try {
      new Function("(" + functionText + ")");
    } catch {
      throw new Error("Passed function is not well-serializable!");
    }
  }
  let callFunctionOnPromise;
  try {
    callFunctionOnPromise = client.send("Runtime.callFunctionOn", {
      functionDeclaration: functionText + `
` + suffix + `
`,
      executionContextId: contextId,
      arguments: args.map((a) => convertArgument(a)),
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith("Converting circular structure to JSON")) {
      error.message += " Are you passing a nested JSHandle?";
    }
    throw error;
  }
  try {
    const {
      value: { exceptionDetails, result: remoteObject },
      size
    } = await callFunctionOnPromise;
    if (exceptionDetails) {
      const err = new SymbolicateableError({
        stack: exceptionDetails.exception?.description,
        name: exceptionDetails.exception?.className,
        message: exceptionDetails.exception?.description?.split(`
`)[0],
        frame,
        stackFrame: parseStack((exceptionDetails.exception?.description).split(`
`)),
        chunk: null
      });
      page.close();
      throw err;
    }
    return { size, value: valueFromRemoteObject2(remoteObject) };
  } catch (error) {
    if (error?.originalMessage?.startsWith("Object couldn't be returned by value")) {
      throw new Error("Could not serialize the return value of the function. Did you pass non-serializable values to defaultProps?");
    }
    throw error;
  }
}
__name(puppeteerEvaluateWithCatch, "puppeteerEvaluateWithCatch");
function convertArgument(arg) {
  if (typeof arg === "number") {
    return { value: arg };
  }
  if (typeof arg === "string") {
    return { value: arg };
  }
  if (typeof arg === "boolean") {
    return { value: arg };
  }
  if (typeof arg === "bigint")
    return { unserializableValue: `${arg.toString()}n` };
  if (Object.is(arg, -0))
    return { unserializableValue: "-0" };
  if (Object.is(arg, Infinity))
    return { unserializableValue: "Infinity" };
  if (Object.is(arg, -Infinity))
    return { unserializableValue: "-Infinity" };
  if (Object.is(arg, NaN))
    return { unserializableValue: "NaN" };
  const objectHandle = arg && arg instanceof JSHandle ? arg : null;
  if (objectHandle) {
    if (objectHandle._disposed)
      throw new Error("JSHandle is disposed!");
    if (objectHandle._remoteObject.unserializableValue)
      return {
        unserializableValue: objectHandle._remoteObject.unserializableValue
      };
    if (!objectHandle._remoteObject.objectId)
      return { value: objectHandle._remoteObject.value };
    return { objectId: objectHandle._remoteObject.objectId };
  }
  return { value: arg };
}
__name(convertArgument, "convertArgument");
var cancelledToken = "cancelled";
var readyToken = "ready";
var waitForReady = /* @__PURE__ */ __name(({
  page,
  timeoutInMilliseconds,
  frame,
  indent,
  logLevel
}) => {
  const cleanups = [];
  const retrieveCancelledErrorAndReject = /* @__PURE__ */ __name(() => {
    return new Promise((_, reject) => {
      puppeteerEvaluateWithCatch({
        pageFunction: /* @__PURE__ */ __name(() => window.remotion_cancelledError, "pageFunction"),
        args: [],
        frame: null,
        page,
        timeoutInMilliseconds
      }).then(({ value: val }) => {
        if (typeof val !== "string") {
          reject(val);
          return;
        }
        reject(new SymbolicateableError({
          frame: null,
          stack: val,
          name: "CancelledError",
          message: val.split(`
`)[0],
          stackFrame: parseStack(val.split(`
`)),
          chunk: null
        }));
      }).catch((err) => {
        Log.verbose({ indent, logLevel }, "Could not get cancelled error", err);
        reject(new Error("Render was cancelled using cancelRender()"));
      });
    });
  }, "retrieveCancelledErrorAndReject");
  const waitForReadyProm = new Promise((resolve22, reject) => {
    const waitTask = page.mainFrame()._mainWorld.waitForFunction({
      browser: page.browser,
      timeout: timeoutInMilliseconds + 3e3,
      pageFunction: `window.remotion_renderReady === true ? "${readyToken}" : window.remotion_cancelledError !== undefined ? "${cancelledToken}" : false`,
      title: frame === null ? "the page to render the React component" : `the page to render the React component at frame ${frame}`
    });
    cleanups.push(() => {
      waitTask.terminate(new Error("cleanup"));
    });
    waitTask.promise.then((a) => {
      const token = a.toString();
      if (token === cancelledToken) {
        return retrieveCancelledErrorAndReject();
      }
      if (token === readyToken) {
        return resolve22(a);
      }
      reject(new Error("Unexpected token " + token));
    }).catch((err) => {
      if (err.message.includes("timeout") && err.message.includes("exceeded")) {
        puppeteerEvaluateWithCatchAndTimeout({
          pageFunction: /* @__PURE__ */ __name(() => {
            return Object.keys(window.remotion_delayRenderTimeouts).map((id, i) => {
              const { label } = window.remotion_delayRenderTimeouts[id];
              if (label === null) {
                return `${i + 1}. (no label)`;
              }
              return `"${i + 1}. ${label}"`;
            }).join(", ");
          }, "pageFunction"),
          args: [],
          frame,
          page,
          timeoutInMilliseconds: 5e3
        }).then((res) => {
          reject(new Error(`Timeout (${timeoutInMilliseconds}ms) exceeded rendering the component${frame ? " at frame " + frame : " initially"}. ${res.value ? `Open delayRender() handles: ${res.value}` : ""}. You can increase the timeout using the "timeoutInMilliseconds" / "--timeout" option of the function or command you used to trigger this render.`));
        }).catch((newErr) => {
          Log.warn({ indent, logLevel }, "Tried to get delayRender() handles for timeout, but could not do so because of", newErr);
          reject(err);
        });
      } else {
        reject(err);
      }
    });
  });
  const onDisposedPromise = new Promise((_, reject) => {
    const onDispose = /* @__PURE__ */ __name(() => {
      reject(new Error("Target closed (page disposed)"));
    }, "onDispose");
    page.on("disposed", onDispose);
    cleanups.push(() => {
      page.off("disposed", onDispose);
    });
  });
  const onClosedSilentPromise = new Promise((_, reject) => {
    const onClosedSilent = /* @__PURE__ */ __name(() => {
      reject(new Error("Target closed"));
    }, "onClosedSilent");
    page.browser.on("closed-silent", onClosedSilent);
    cleanups.push(() => {
      page.browser.off("closed-silent", onClosedSilent);
    });
  });
  return Promise.race([
    onDisposedPromise,
    onClosedSilentPromise,
    waitForReadyProm
  ]).finally(() => {
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  });
}, "waitForReady");
var seekToFrame = /* @__PURE__ */ __name(async ({
  frame,
  page,
  composition,
  timeoutInMilliseconds,
  logLevel,
  indent,
  attempt
}) => {
  await waitForReady({
    page,
    timeoutInMilliseconds,
    frame: null,
    indent,
    logLevel
  });
  await puppeteerEvaluateWithCatchAndTimeout({
    pageFunction: /* @__PURE__ */ __name((f, c, a) => {
      window.remotion_setFrame(f, c, a);
    }, "pageFunction"),
    args: [frame, composition, attempt],
    frame,
    page,
    timeoutInMilliseconds
  });
  await waitForReady({ page, timeoutInMilliseconds, frame, indent, logLevel });
  await page.evaluateHandle("document.fonts.ready");
}, "seekToFrame");
var gotoPageOrThrow = /* @__PURE__ */ __name(async (page, urlToVisit, actualTimeout) => {
  try {
    const pageRes = await page.goto({ url: urlToVisit, timeout: actualTimeout });
    if (pageRes === null) {
      return [null, new Error(`Visited "${urlToVisit}" but got no response.`)];
    }
    return [pageRes, null];
  } catch (err) {
    return [null, err];
  }
}, "gotoPageOrThrow");
var validatePuppeteerTimeout = /* @__PURE__ */ __name((timeoutInMilliseconds) => {
  if (timeoutInMilliseconds === null || timeoutInMilliseconds === void 0) {
    return;
  }
  if (typeof timeoutInMilliseconds !== "number") {
    throw new TypeError(`'timeoutInMilliseconds' should be a number, but is: ${JSON.stringify(timeoutInMilliseconds)}`);
  }
  if (timeoutInMilliseconds < 7e3 && true) {
    throw new TypeError(`'timeoutInMilliseconds' should be bigger or equal than 7000, but is ${timeoutInMilliseconds}`);
  }
  if (Number.isNaN(timeoutInMilliseconds)) {
    throw new TypeError(`'timeoutInMilliseconds' should not be NaN, but is ${timeoutInMilliseconds}`);
  }
  if (!Number.isFinite(timeoutInMilliseconds)) {
    throw new TypeError(`'timeoutInMilliseconds' should be finite, but is ${timeoutInMilliseconds}`);
  }
  if (timeoutInMilliseconds % 1 !== 0) {
    throw new TypeError(`'timeoutInMilliseconds' should be an integer, but is ${timeoutInMilliseconds}`);
  }
}, "validatePuppeteerTimeout");
var innerSetPropsAndEnv = /* @__PURE__ */ __name(async ({
  serializedInputPropsWithCustomSchema,
  envVariables,
  page,
  serveUrl,
  initialFrame,
  timeoutInMilliseconds,
  proxyPort,
  retriesRemaining,
  audioEnabled,
  videoEnabled,
  indent,
  logLevel,
  onServeUrlVisited,
  isMainTab,
  mediaCacheSizeInBytes,
  initialMemoryAvailable,
  darkMode,
  sampleRate
}) => {
  validatePuppeteerTimeout(timeoutInMilliseconds);
  const actualTimeout = timeoutInMilliseconds ?? DEFAULT_TIMEOUT;
  page.setDefaultTimeout(actualTimeout);
  page.setDefaultNavigationTimeout(actualTimeout);
  const urlToVisit = normalizeServeUrl(serveUrl);
  await page.evaluateOnNewDocument((timeout, mainTab, cacheSizeInBytes, initMemoryAvailable, sRate) => {
    window.remotion_puppeteerTimeout = timeout;
    window.remotion_isMainTab = mainTab;
    window.remotion_mediaCacheSizeInBytes = cacheSizeInBytes;
    window.remotion_initialMemoryAvailable = initMemoryAvailable;
    window.remotion_sampleRate = sRate;
    if (window.process === void 0) {
      window.process = {};
    }
    if (window.process.env === void 0) {
      window.process.env = {};
    }
    window.process.env.NODE_ENV = "production";
  }, actualTimeout, isMainTab, mediaCacheSizeInBytes, initialMemoryAvailable, sampleRate);
  await page.evaluateOnNewDocument('window.remotion_broadcastChannel = new BroadcastChannel("remotion-video-frame-extraction")');
  if (envVariables) {
    await page.evaluateOnNewDocument((input) => {
      window.remotion_envVariables = input;
    }, JSON.stringify(envVariables));
  }
  if (darkMode) {
    await page.setAutoDarkModeOverride();
  }
  await page.evaluateOnNewDocument((input, key, port, audEnabled, vidEnabled, level) => {
    window.remotion_inputProps = input;
    window.remotion_initialFrame = key;
    window.remotion_attempt = 1;
    window.remotion_proxyPort = port;
    window.remotion_audioEnabled = audEnabled;
    window.remotion_videoEnabled = vidEnabled;
    window.remotion_logLevel = level;
    window.alert = (message) => {
      if (message) {
        window.window.remotion_cancelledError = new Error(`alert("${message}") was called. It cannot be called in a headless browser.`).stack;
      } else {
        window.window.remotion_cancelledError = new Error("alert() was called. It cannot be called in a headless browser.").stack;
      }
    };
    window.confirm = (message) => {
      if (message) {
        window.remotion_cancelledError = new Error(`confirm("${message}") was called. It cannot be called in a headless browser.`).stack;
      } else {
        window.remotion_cancelledError = new Error("confirm() was called. It cannot be called in a headless browser.").stack;
      }
      return false;
    };
  }, serializedInputPropsWithCustomSchema, initialFrame, proxyPort, audioEnabled, videoEnabled, logLevel);
  const retry = /* @__PURE__ */ __name(async () => {
    await new Promise((resolve22) => {
      setTimeout(() => {
        resolve22();
      }, 2e3);
    });
    return innerSetPropsAndEnv({
      envVariables,
      initialFrame,
      serializedInputPropsWithCustomSchema,
      page,
      proxyPort,
      retriesRemaining: retriesRemaining - 1,
      serveUrl,
      timeoutInMilliseconds,
      audioEnabled,
      videoEnabled,
      indent,
      logLevel,
      onServeUrlVisited,
      isMainTab,
      mediaCacheSizeInBytes,
      initialMemoryAvailable,
      darkMode,
      sampleRate
    });
  }, "retry");
  const [pageRes, error] = await gotoPageOrThrow(page, urlToVisit, actualTimeout);
  if (error !== null) {
    if (error.message.includes("ECONNRESET") || error.message.includes("ERR_CONNECTION_TIMED_OUT")) {
      return retry();
    }
    throw error;
  }
  const status = pageRes.status();
  if (status >= 500 && status <= 504 && retriesRemaining > 0) {
    return retry();
  }
  if (!redirectStatusCodes.every((code) => code !== status)) {
    throw new Error(`Error while getting compositions: Tried to go to ${urlToVisit} but the status code was ${status} instead of 200. Does the site you specified exist?`);
  }
  onServeUrlVisited();
  const { value: isRemotionFn } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      return window.getStaticCompositions;
    }, "pageFunction"),
    args: [],
    frame: null,
    page,
    timeoutInMilliseconds: actualTimeout
  });
  if (typeof isRemotionFn === "undefined") {
    const { value: body } = await puppeteerEvaluateWithCatch({
      pageFunction: /* @__PURE__ */ __name(() => {
        return document.body.innerHTML;
      }, "pageFunction"),
      args: [],
      frame: null,
      page,
      timeoutInMilliseconds: actualTimeout
    });
    if (body.includes("We encountered an internal error.")) {
      return retry();
    }
    const errorMessage = [
      `Error while getting compositions: Tried to go to ${urlToVisit} and verify that it is a Remotion project by checking if window.getStaticCompositions is defined.`,
      "However, the function was undefined, which indicates that this is not a valid Remotion project. Please check the URL you passed.",
      "The page loaded contained the following markup:",
      body.substring(0, 500) + (body.length > 500 ? "..." : ""),
      "Does this look like a foreign page? If so, try to stop this server."
    ].join(`
`);
    throw new Error(errorMessage);
  }
  const { value: siteVersion } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      return window.siteVersion;
    }, "pageFunction"),
    args: [],
    frame: null,
    page,
    timeoutInMilliseconds: actualTimeout
  });
  const { value: remotionVersion } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      return window.remotion_version;
    }, "pageFunction"),
    args: [],
    frame: null,
    page,
    timeoutInMilliseconds: actualTimeout
  });
  const requiredVersion = "11";
  if (siteVersion !== requiredVersion) {
    throw new Error([
      `Incompatible site: When visiting ${urlToVisit}, a bundle was found, but one that is not compatible with this version of Remotion. Found version: ${siteVersion} - Required version: ${requiredVersion}. To resolve this error:`,
      "When using server-side rendering:",
      ` ▸ Use 'bundle()' with '@remotion/bundler' of version ${VERSION} to create a compatible bundle.`,
      "When using the Remotion Lambda:",
      " ▸ Use `npx remotion lambda sites create` to redeploy the site with the latest version.",
      " ℹ Use --site-name with the same name as before to overwrite your site.",
      " ▸ Use `deploySite()` if you are using the Node.JS APIs."
    ].join(`
`));
  }
  if (remotionVersion !== VERSION && true) {
    if (remotionVersion) {
      Log.warn({
        indent,
        logLevel
      }, [
        `The site was bundled with version ${remotionVersion} of @remotion/bundler, while @remotion/renderer is on version ${VERSION}. You may not have the newest bugfixes and features.`,
        `To resolve this warning:`,
        "▸ Use `npx remotion lambda sites create` to redeploy the site with the latest version.",
        "  ℹ Use --site-name with the same name as before to overwrite your site.",
        "▸ Use `deploySite()` if you are using the Node.JS APIs."
      ].join(`
`));
    } else {
      Log.warn({
        indent,
        logLevel
      }, `The site was bundled with an old version of Remotion, while @remotion/renderer is on version ${VERSION}. You may not have the newest bugfixes and features. Re-bundle the site to fix this issue.`);
    }
  }
}, "innerSetPropsAndEnv");
var setPropsAndEnv = /* @__PURE__ */ __name(async (params) => {
  let timeout = null;
  try {
    const result = await Promise.race([
      innerSetPropsAndEnv(params),
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error([
            `Timed out after ${params.timeoutInMilliseconds}ms while setting up the headless browser.`,
            "This could be because the you specified takes a long time to load (or network resources that it includes like fonts) or because the browser is not responding.",
            process.platform === "linux" ? "Make sure you have installed the Linux depdendencies: https://www.remotion.dev/docs/miscellaneous/linux-dependencies" : null
          ].filter(truthy).join(`
`)));
        }, params.timeoutInMilliseconds);
      })
    ]);
    return result;
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}, "setPropsAndEnv");
var alreadyPrintedCache = [];
var printUsefulErrorMessage = /* @__PURE__ */ __name((err, logLevel, indent) => {
  const errorStack = err.stack;
  if (errorStack && alreadyPrintedCache.includes(errorStack)) {
    return;
  }
  if (errorStack) {
    alreadyPrintedCache.push(errorStack);
    alreadyPrintedCache = alreadyPrintedCache.slice(-10);
  }
  if (err.message.includes("Could not play video with")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/media-playback-error");
  }
  if (err.message.includes("A delayRender()") && err.message.includes("was called but not cleared after")) {
    Log.info({ indent, logLevel });
    if (err.message.includes("/proxy")) {
      Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/troubleshooting/delay-render-proxy");
    }
    Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/timeout");
  }
  if (err.message.includes("Target closed")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/target-closed");
  }
  if (err.message.includes("Timed out evaluating")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/troubleshooting/timed-out-page-function");
  }
  if (err.message.includes("ENAMETOOLONG")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 Get help for this issue at https://remotion.dev/docs/enametoolong");
  }
  if (err.message.includes("Member must have value less than or equal to 3008")) {
    Log.warn({ indent, logLevel });
    Log.warn({ indent, logLevel }, "💡 This error indicates that you have a AWS account on the free or basic tier or have been limited by your organization.");
    Log.warn({ indent, logLevel }, "Often times this can be solved by adding a credit card, or if already done, by contacting AWS support.");
    Log.warn({
      indent,
      logLevel
    }, "Alternatively, you can decrease the memory size of your Lambda function to a value below 3008 MB. See: https://www.remotion.dev/docs/lambda/runtime#core-count--vcpus");
    Log.warn({ indent, logLevel }, "See also: https://repost.aws/questions/QUKruWYNDYTSmP17jCnIz6IQ/questions/QUKruWYNDYTSmP17jCnIz6IQ/unable-to-set-lambda-memory-over-3008mb");
  }
  if (err.stack?.includes("TooManyRequestsException: Rate Exceeded.") || err.message?.includes("ConcurrentInvocationLimitExceeded")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 This error indicates that your Lambda concurrency limit is too low. See: https://www.remotion.dev/docs/lambda/troubleshooting/rate-limit");
  }
  if (err.message.includes("Error creating WebGL context")) {
    Log.info({ indent, logLevel });
    Log.warn({
      indent,
      logLevel
    }, '💡 You might need to set the OpenGL renderer to "angle". Learn why at https://www.remotion.dev/docs/three');
    Log.warn({
      indent,
      logLevel
    }, "💡 Check how it's done at https://www.remotion.dev/docs/chromium-flags#--gl");
  }
  if (err.message.includes("The bucket does not allow ACLs")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 Fix for this issue: https://remotion.dev/docs/lambda/troubleshooting/bucket-disallows-acl");
  }
  if (err.message.includes("Minified React error #306")) {
    const componentName = err.message.match(/<\w+>/)?.[0];
    Log.info({ indent, logLevel }, [
      "💡 This error indicates that the component",
      componentName ? `(${componentName})` : null,
      "you are trying to render is not imported correctly."
    ].filter(truthy).join(" "));
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "   Check the root file and ensure that the component is not undefined.");
    Log.info({ indent, logLevel }, "   Oftentimes, this happens if the component is missing the `export` keyword");
    Log.info({ indent, logLevel }, "   or if the component was renamed and the import statement not properly adjusted.");
  }
  if (err.message.includes("GLIBC_")) {
    Log.info({ indent, logLevel }, "💡 Remotion requires at least Libc 2.35.");
    Log.info({ indent, logLevel }, "💡 Get help for this issue: https://github.com/remotion-dev/remotion/issues/2439");
  }
  if (err.message.includes("AVCaptureDeviceTypeContinuityCamera")) {
    Log.info({ indent, logLevel }, "💡 Remotion requires macOS 13 (Ventura) or later.");
    Log.info({ indent, logLevel }, "💡 Get help for this issue: https://github.com/remotion-dev/remotion/issues/7027");
  }
  if (err.message.includes("EBADF")) {
    Log.info({ indent, logLevel }, "💡 This error might be fixed by changing your Node version:");
    Log.info({ indent, logLevel }, "   https://github.com/remotion-dev/remotion/issues/2452");
  }
  if (err.message.includes("routines::unsupported")) {
    Log.info({ indent, logLevel }, "💡 This error might happen if using Cloud Run with credentials that have a newline at the end or are otherwise badly encoded.");
    Log.info({ indent, logLevel }, "   https://github.com/remotion-dev/remotion/issues/3864");
  }
  if (err.message.includes("Failed to fetch")) {
    Log.info({ indent, logLevel }, "💡 On Lambda, one reason this could happen is that Chrome is rejecting an asset to be loaded when it is running low on disk space.");
    Log.info({ indent, logLevel }, "Try increasing the disk size of your Lambda function.");
  }
  if (err.message.includes("Invalid value specified for cpu")) {
    Log.info({ indent, logLevel });
    Log.info({ indent, logLevel }, "💡 This error indicates that your GCP account does have a limit. Try setting `--maxInstances=5` / `maxInstances: 5` when deploying this service.");
    Log.info({
      indent,
      logLevel
    });
  }
}, "printUsefulErrorMessage");
var wrapWithErrorHandling = /* @__PURE__ */ __name((fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      const { indent } = args[0];
      const { logLevel } = args[0];
      printUsefulErrorMessage(err, logLevel, indent);
      throw err;
    }
  };
}, "wrapWithErrorHandling");
var innerGetCompositions = /* @__PURE__ */ __name(async ({
  envVariables,
  serializedInputPropsWithCustomSchema,
  page,
  proxyPort,
  serveUrl,
  timeoutInMilliseconds,
  indent,
  logLevel,
  mediaCacheSizeInBytes,
  darkMode
}) => {
  validatePuppeteerTimeout(timeoutInMilliseconds);
  await setPropsAndEnv({
    serializedInputPropsWithCustomSchema,
    envVariables,
    page,
    serveUrl,
    initialFrame: 0,
    timeoutInMilliseconds,
    proxyPort,
    retriesRemaining: 2,
    audioEnabled: false,
    videoEnabled: false,
    indent,
    logLevel,
    onServeUrlVisited: /* @__PURE__ */ __name(() => {
      return;
    }, "onServeUrlVisited"),
    isMainTab: true,
    mediaCacheSizeInBytes,
    initialMemoryAvailable: getAvailableMemory(logLevel),
    darkMode,
    sampleRate: 48e3
  });
  await puppeteerEvaluateWithCatch({
    page,
    pageFunction: /* @__PURE__ */ __name(() => {
      window.remotion_setBundleMode({
        type: "evaluation"
      });
    }, "pageFunction"),
    frame: null,
    args: [],
    timeoutInMilliseconds
  });
  await waitForReady({
    page,
    timeoutInMilliseconds,
    frame: null,
    indent,
    logLevel
  });
  const { value: result } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      return window.getStaticCompositions();
    }, "pageFunction"),
    frame: null,
    page,
    args: [],
    timeoutInMilliseconds
  });
  const res = result;
  return res.map((r) => {
    const {
      width,
      durationInFrames,
      fps,
      height,
      id,
      defaultCodec,
      defaultOutName,
      defaultVideoImageFormat,
      defaultPixelFormat,
      defaultProResProfile,
      defaultSampleRate
    } = r;
    return {
      id,
      width,
      height,
      fps,
      durationInFrames,
      props: NoReactInternals.deserializeJSONWithSpecialTypes(r.serializedResolvedPropsWithCustomSchema),
      defaultProps: NoReactInternals.deserializeJSONWithSpecialTypes(r.serializedDefaultPropsWithCustomSchema),
      defaultCodec,
      defaultOutName,
      defaultVideoImageFormat,
      defaultPixelFormat,
      defaultProResProfile,
      defaultSampleRate
    };
  });
}, "innerGetCompositions");
var internalGetCompositionsRaw = /* @__PURE__ */ __name(async ({
  browserExecutable,
  chromiumOptions,
  envVariables,
  indent,
  serializedInputPropsWithCustomSchema,
  onBrowserLog,
  port,
  puppeteerInstance,
  serveUrlOrWebpackUrl,
  server,
  timeoutInMilliseconds,
  logLevel,
  offthreadVideoCacheSizeInBytes,
  binariesDirectory,
  onBrowserDownload,
  chromeMode,
  offthreadVideoThreads,
  mediaCacheSizeInBytes,
  onLog
}) => {
  const { page, cleanupPage } = await getPageAndCleanupFn({
    passedInInstance: puppeteerInstance,
    browserExecutable,
    chromiumOptions,
    forceDeviceScaleFactor: void 0,
    indent,
    logLevel,
    onBrowserDownload,
    chromeMode,
    pageIndex: 0,
    onBrowserLog,
    onLog
  });
  const cleanup = [cleanupPage];
  return new Promise((resolve22, reject) => {
    const onError = /* @__PURE__ */ __name((err) => reject(err), "onError");
    cleanup.push(handleJavascriptException({
      page,
      frame: null,
      onError
    }));
    makeOrReuseServer(server, {
      webpackConfigOrServeUrl: serveUrlOrWebpackUrl,
      port,
      remotionRoot: findRemotionRoot(),
      offthreadVideoThreads: offthreadVideoThreads ?? DEFAULT_RENDER_FRAMES_OFFTHREAD_VIDEO_THREADS,
      logLevel,
      indent,
      offthreadVideoCacheSizeInBytes,
      binariesDirectory,
      forceIPv4: false,
      sampleRate: 48e3
    }, {
      onDownload: /* @__PURE__ */ __name(() => {
        return;
      }, "onDownload")
    }).then(({ server: { serveUrl, offthreadPort, sourceMap }, cleanupServer }) => {
      page.setBrowserSourceMapGetter(sourceMap);
      cleanup.push(() => {
        return cleanupServer(true);
      });
      return innerGetCompositions({
        envVariables,
        serializedInputPropsWithCustomSchema,
        page,
        proxyPort: offthreadPort,
        serveUrl,
        timeoutInMilliseconds,
        indent,
        logLevel,
        offthreadVideoCacheSizeInBytes,
        binariesDirectory,
        onBrowserDownload,
        chromeMode,
        offthreadVideoThreads,
        mediaCacheSizeInBytes,
        darkMode: chromiumOptions.darkMode ?? false
      });
    }).then((comp) => {
      return resolve22(comp);
    }).catch((err) => {
      reject(err);
    }).finally(() => {
      cleanup.forEach((c) => {
        c();
      });
    });
  });
}, "internalGetCompositionsRaw");
var internalGetCompositions = wrapWithErrorHandling(internalGetCompositionsRaw);
var getCompositions = /* @__PURE__ */ __name((serveUrlOrWebpackUrl, config) => {
  if (!serveUrlOrWebpackUrl) {
    throw new Error("No serve URL or webpack bundle directory was passed to getCompositions().");
  }
  const {
    browserExecutable,
    chromiumOptions,
    envVariables,
    inputProps,
    onBrowserLog,
    port,
    puppeteerInstance,
    timeoutInMilliseconds,
    logLevel: passedLogLevel,
    onBrowserDownload,
    binariesDirectory,
    offthreadVideoCacheSizeInBytes,
    chromeMode,
    offthreadVideoThreads,
    mediaCacheSizeInBytes
  } = config ?? {};
  const indent = false;
  const logLevel = passedLogLevel ?? "info";
  return internalGetCompositions({
    browserExecutable: browserExecutable ?? null,
    chromiumOptions: chromiumOptions ?? {},
    envVariables: envVariables ?? {},
    serializedInputPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      data: inputProps ?? {},
      indent: void 0,
      staticBase: null
    }).serializedString,
    indent,
    onBrowserLog: onBrowserLog ?? null,
    port: port ?? null,
    puppeteerInstance: puppeteerInstance ?? void 0,
    serveUrlOrWebpackUrl,
    server: void 0,
    timeoutInMilliseconds: timeoutInMilliseconds ?? DEFAULT_TIMEOUT,
    logLevel,
    offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
    binariesDirectory: binariesDirectory ?? null,
    onBrowserDownload: onBrowserDownload ?? defaultBrowserDownloadProgress({
      indent,
      logLevel,
      api: "getCompositions()"
    }),
    chromeMode: chromeMode ?? "headless-shell",
    offthreadVideoThreads: offthreadVideoThreads ?? null,
    mediaCacheSizeInBytes: mediaCacheSizeInBytes ?? null,
    onLog: defaultOnLog
  });
}, "getCompositions");
var resolveConcurrency = /* @__PURE__ */ __name((userPreference) => {
  const maxCpus = getCpuCount();
  if (userPreference === null) {
    return Math.round(Math.min(8, Math.max(1, maxCpus / 2)));
  }
  const min = 1;
  let rounded;
  if (typeof userPreference === "string") {
    const percentage = parseInt(userPreference.slice(0, -1), 10);
    rounded = Math.floor(percentage / 100 * maxCpus);
  } else {
    rounded = Math.floor(userPreference);
  }
  if (rounded > maxCpus) {
    throw new Error(`Maximum for --concurrency is ${maxCpus} (number of cores on this system)`);
  }
  if (rounded < min) {
    throw new Error(`Minimum for concurrency is ${min}.`);
  }
  return rounded;
}, "resolveConcurrency");
var getFramesToRender = /* @__PURE__ */ __name((frameRange, everyNthFrame) => {
  if (everyNthFrame === 0) {
    throw new Error("everyNthFrame cannot be 0");
  }
  return new Array(frameRange[1] - frameRange[0] + 1).fill(true).map((_, index) => {
    return index + frameRange[0];
  }).filter((index) => {
    return index % everyNthFrame === 0;
  });
}, "getFramesToRender");
var getFileExtensionFromCodec = /* @__PURE__ */ __name((codec, audioCodec) => {
  if (!validCodecs.includes(codec)) {
    throw new Error(`Codec must be one of the following: ${validCodecs.join(", ")}, but got ${codec}`);
  }
  const map22 = defaultFileExtensionMap[codec];
  if (audioCodec === null) {
    return map22.default;
  }
  const typedAudioCodec = audioCodec;
  if (!(typedAudioCodec in map22.forAudioCodec)) {
    throw new Error(`Audio codec ${typedAudioCodec} is not supported for codec ${codec}`);
  }
  return map22.forAudioCodec[audioCodec].default;
}, "getFileExtensionFromCodec");
var makeFileExtensionMap = /* @__PURE__ */ __name(() => {
  const map22 = {};
  Object.keys(defaultFileExtensionMap).forEach((_codec) => {
    const codec = _codec;
    const fileExtMap = defaultFileExtensionMap[codec];
    const audioCodecs = Object.keys(fileExtMap.forAudioCodec);
    const possibleExtensionsForAudioCodec = audioCodecs.map((audioCodec) => fileExtMap.forAudioCodec[audioCodec].possible);
    const allPossibleExtensions = [
      fileExtMap.default,
      ...possibleExtensionsForAudioCodec.flat(1)
    ];
    for (const extension of allPossibleExtensions) {
      if (!map22[extension]) {
        map22[extension] = [];
      }
      if (!map22[extension].includes(codec)) {
        map22[extension].push(codec);
      }
    }
  });
  return map22;
}, "makeFileExtensionMap");
var defaultCodecsForFileExtension = {
  "3gp": "aac",
  aac: "aac",
  gif: "gif",
  hevc: "h265",
  m4a: "aac",
  m4b: "aac",
  mkv: "h264-mkv",
  mov: "prores",
  mp3: "mp3",
  mp4: "h264",
  mpeg: "aac",
  mpg: "aac",
  mxf: "prores",
  wav: "wav",
  webm: "vp8",
  ts: "h264-ts"
};
var SLASH = 47;
var DOT = 46;
var assertPath = /* @__PURE__ */ __name((path202) => {
  const t = typeof path202;
  if (t !== "string") {
    throw new TypeError(`Expected a string, got a ${t}`);
  }
}, "assertPath");
var posixNormalize = /* @__PURE__ */ __name((path202, allowAboveRoot) => {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code;
  for (let i = 0; i <= path202.length; ++i) {
    if (i < path202.length) {
      code = path202.charCodeAt(i);
    } else if (code === SLASH) {
      break;
    } else {
      code = SLASH;
    }
    if (code === SLASH) {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== DOT || res.charCodeAt(res.length - 2) !== DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = "";
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) {
            res += "/..";
          } else {
            res = "..";
          }
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) {
          res += "/" + path202.slice(lastSlash + 1, i);
        } else {
          res = path202.slice(lastSlash + 1, i);
        }
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}, "posixNormalize");
var decode = /* @__PURE__ */ __name((s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}, "decode");
var pathNormalize = /* @__PURE__ */ __name((p) => {
  assertPath(p);
  let path202 = p;
  if (path202.length === 0) {
    return ".";
  }
  const isAbsolute = path202.charCodeAt(0) === SLASH;
  const trailingSeparator = path202.charCodeAt(path202.length - 1) === SLASH;
  path202 = decode(path202);
  path202 = posixNormalize(path202, !isAbsolute);
  if (path202.length === 0 && !isAbsolute) {
    path202 = ".";
  }
  if (path202.length > 0 && trailingSeparator) {
    path202 += "/";
  }
  if (isAbsolute) {
    return "/" + path202;
  }
  return path202;
}, "pathNormalize");
var getExtensionOfFilename = /* @__PURE__ */ __name((filename) => {
  if (filename === null) {
    return null;
  }
  const filenameArr = pathNormalize(filename).split(".");
  const hasExtension = filenameArr.length >= 2;
  const filenameArrLength = filenameArr.length;
  const extension = hasExtension ? filenameArr[filenameArrLength - 1] : null;
  return extension;
}, "getExtensionOfFilename");
var getRealFrameRange = /* @__PURE__ */ __name((durationInFrames, frameRange) => {
  if (frameRange === null) {
    return [0, durationInFrames - 1];
  }
  if (typeof frameRange === "number") {
    if (frameRange < 0 || frameRange >= durationInFrames) {
      throw new Error(`Frame number is out of range, must be between 0 and ${durationInFrames - 1} but got ${frameRange}`);
    }
    return [frameRange, frameRange];
  }
  const resolved = [
    frameRange[0],
    frameRange[1] === null ? durationInFrames - 1 : frameRange[1]
  ];
  if (resolved[0] < 0 || resolved[1] >= durationInFrames || resolved[0] > resolved[1]) {
    throw new Error(`The "durationInFrames" of the <Composition /> was evaluated to be ${durationInFrames}, but frame range ${resolved.join("-")} is not inbetween 0-${durationInFrames - 1}`);
  }
  return resolved;
}, "getRealFrameRange");
var validVideoImageFormats = ["png", "jpeg", "none"];
var validStillImageFormats = ["png", "jpeg", "pdf", "webp"];
var DEFAULT_VIDEO_IMAGE_FORMAT = "jpeg";
var DEFAULT_STILL_IMAGE_FORMAT = "png";
var validateSelectedPixelFormatAndImageFormatCombination = /* @__PURE__ */ __name((pixelFormat, videoImageFormat) => {
  if (videoImageFormat === "none") {
    return "none";
  }
  if (typeof pixelFormat === "undefined") {
    return "valid";
  }
  if (!validVideoImageFormats.includes(videoImageFormat)) {
    throw new TypeError(`Value ${videoImageFormat} is not valid as an image format.`);
  }
  if (pixelFormat !== "yuva420p" && pixelFormat !== "yuva444p10le") {
    return "valid";
  }
  if (videoImageFormat !== "png") {
    throw new TypeError(`Pixel format was set to '${pixelFormat}' but the image format is not PNG. To render transparent videos, you need to set PNG as the image format.`);
  }
  return "valid";
}, "validateSelectedPixelFormatAndImageFormatCombination");
var validateStillImageFormat = /* @__PURE__ */ __name((imageFormat) => {
  if (!validStillImageFormats.includes(imageFormat)) {
    throw new TypeError(String(`Image format should be one of: ${validStillImageFormats.map((v) => `"${v}"`).join(", ")}`));
  }
}, "validateStillImageFormat");
var DEFAULT_JPEG_QUALITY = 80;
var validateJpegQuality = /* @__PURE__ */ __name((q) => {
  if (typeof q !== "undefined" && typeof q !== "number") {
    throw new Error(`JPEG Quality option must be a number or undefined. Got ${typeof q} (${JSON.stringify(q)})`);
  }
  if (typeof q === "undefined") {
    return;
  }
  if (!Number.isFinite(q)) {
    throw new RangeError(`JPEG Quality must be a finite number, but is ${q}`);
  }
  if (Number.isNaN(q)) {
    throw new RangeError(`JPEG Quality is NaN, but must be a real number`);
  }
  if (q > 100 || q < 0) {
    throw new RangeError("JPEG Quality option must be between 0 and 100.");
  }
}, "validateJpegQuality");
var exports_perf = {};
__export(exports_perf, {
  stopPerfMeasure: /* @__PURE__ */ __name(() => stopPerfMeasure, "stopPerfMeasure"),
  startPerfMeasure: /* @__PURE__ */ __name(() => startPerfMeasure, "startPerfMeasure"),
  getPerf: /* @__PURE__ */ __name(() => getPerf, "getPerf")
});
var perf = {
  capture: [],
  "extract-frame": [],
  piping: []
};
var map2 = {};
var startPerfMeasure = /* @__PURE__ */ __name((marker) => {
  const id = Math.random();
  map2[id] = {
    id,
    marker,
    start: Date.now()
  };
  return id;
}, "startPerfMeasure");
var stopPerfMeasure = /* @__PURE__ */ __name((id) => {
  const now = Date.now();
  const diff = now - map2[id].start;
  perf[map2[id].marker].push(diff);
  delete map2[id];
}, "stopPerfMeasure");
var getPerf = /* @__PURE__ */ __name(() => {
  return [
    "Render performance:",
    ...Object.keys(perf).filter((p) => perf[p].length).map((p) => {
      return `  ${p} => ${Math.round(perf[p].reduce((a, b) => a + b, 0) / perf[p].length)}ms (n = ${perf[p].length})`;
    })
  ];
}, "getPerf");
var validPixelFormats = [
  "yuv420p",
  "yuva420p",
  "yuv422p",
  "yuv444p",
  "yuv420p10le",
  "yuv422p10le",
  "yuv444p10le",
  "yuva444p10le"
];
var DEFAULT_PIXEL_FORMAT = "yuv420p";
var validPixelFormatsForCodec = /* @__PURE__ */ __name((codec) => {
  if (codec === "vp8" || codec === "vp9") {
    return validPixelFormats;
  }
  return validPixelFormats.filter((format2) => format2 !== "yuva420p");
}, "validPixelFormatsForCodec");
var validateSelectedPixelFormatAndCodecCombination = /* @__PURE__ */ __name((pixelFormat, codec) => {
  if (typeof pixelFormat === "undefined") {
    return pixelFormat;
  }
  if (!validPixelFormats.includes(pixelFormat)) {
    throw new TypeError(`Value ${pixelFormat} is not valid as a pixel format.`);
  }
  if (pixelFormat !== "yuva420p") {
    return;
  }
  const validFormats = validPixelFormatsForCodec(codec);
  if (!validFormats.includes(pixelFormat)) {
    throw new TypeError(`Pixel format was set to 'yuva420p' but codec ${codec} does not support it. Valid pixel formats for codec ${codec} are: ${validFormats.join(", ")}.`);
  }
}, "validateSelectedPixelFormatAndCodecCombination");
var cycleBrowserTabs = /* @__PURE__ */ __name(({
  puppeteerInstance,
  concurrency,
  logLevel,
  indent
}) => {
  if (concurrency <= 1) {
    return {
      stopCycling: /* @__PURE__ */ __name(() => {
        return;
      }, "stopCycling")
    };
  }
  let interval = null;
  let i = 0;
  let stopped = false;
  const set = /* @__PURE__ */ __name(() => {
    interval = setTimeout(() => {
      puppeteerInstance.getBrowser().pages().then((pages) => {
        if (pages.length === 0) {
          return;
        }
        const currentPage = pages[i % pages.length];
        i++;
        if (!currentPage?.closed && !stopped && currentPage?.url() !== "about:blank") {
          return currentPage.bringToFront();
        }
      }).catch((err) => Log.error({ indent, logLevel }, err)).finally(() => {
        if (!stopped) {
          set();
        }
      });
    }, 200);
  }, "set");
  set();
  return {
    stopCycling: /* @__PURE__ */ __name(() => {
      if (!interval) {
        return;
      }
      stopped = true;
      return clearTimeout(interval);
    }, "stopCycling")
  };
}, "cycleBrowserTabs");
var DEFAULT = null;
var cliFlag = "separate-audio-to";
var separateAudioOption = {
  cliFlag,
  description: /* @__PURE__ */ __name(() => `If set, the audio will not be included in the main output but rendered as a separate file at the location you pass. It is recommended to use an absolute path. If a relative path is passed, it is relative to the Remotion Root.`, "description"),
  docLink: "https://remotion.dev/docs/renderer/render-media",
  getValue: /* @__PURE__ */ __name(({ commandLine }) => {
    if (commandLine[cliFlag]) {
      return {
        source: "cli",
        value: commandLine[cliFlag]
      };
    }
    return {
      source: "default",
      value: DEFAULT
    };
  }, "getValue"),
  name: "Separate audio to",
  setConfig: /* @__PURE__ */ __name(() => {
    throw new Error("Not implemented");
  }, "setConfig"),
  ssrName: "separateAudioTo",
  type: "string",
  id: cliFlag
};
var validAudioCodecs = ["pcm-16", "aac", "mp3", "opus"];
var supportedAudioCodecs = {
  h264: ["aac", "pcm-16", "mp3"],
  "h264-mkv": ["pcm-16", "mp3"],
  "h264-ts": ["pcm-16", "aac"],
  aac: ["aac", "pcm-16"],
  avi: [],
  gif: [],
  h265: ["aac", "pcm-16"],
  av1: ["aac", "opus", "pcm-16"],
  mp3: ["mp3", "pcm-16"],
  prores: ["aac", "pcm-16"],
  vp8: ["opus", "pcm-16"],
  vp9: ["opus", "pcm-16"],
  wav: ["pcm-16"]
};
var _satisfies = supportedAudioCodecs;
if (_satisfies) {
}
var mapAudioCodecToFfmpegAudioCodecName = /* @__PURE__ */ __name((audioCodec) => {
  if (audioCodec === "aac") {
    return "libfdk_aac";
  }
  if (audioCodec === "mp3") {
    return "libmp3lame";
  }
  if (audioCodec === "opus") {
    return "libopus";
  }
  if (audioCodec === "pcm-16") {
    return "pcm_s16le";
  }
  throw new Error("unknown audio codec: " + audioCodec);
}, "mapAudioCodecToFfmpegAudioCodecName");
var cliFlag2 = "audio-codec";
var ssrName = "audioCodec";
var defaultAudioCodecs = {
  "h264-mkv": {
    lossless: "pcm-16",
    compressed: "pcm-16"
  },
  "h264-ts": {
    lossless: "pcm-16",
    compressed: "aac"
  },
  aac: {
    lossless: "pcm-16",
    compressed: "aac"
  },
  gif: {
    lossless: null,
    compressed: null
  },
  h264: {
    lossless: "pcm-16",
    compressed: "aac"
  },
  h265: {
    lossless: "pcm-16",
    compressed: "aac"
  },
  av1: {
    lossless: "pcm-16",
    compressed: "aac"
  },
  mp3: {
    lossless: "pcm-16",
    compressed: "mp3"
  },
  prores: {
    lossless: "pcm-16",
    compressed: "pcm-16"
  },
  vp8: {
    lossless: "pcm-16",
    compressed: "opus"
  },
  vp9: {
    lossless: "pcm-16",
    compressed: "opus"
  },
  wav: {
    lossless: "pcm-16",
    compressed: "pcm-16"
  }
};
var extensionMap = {
  aac: "aac",
  mp3: "mp3",
  opus: "opus",
  "pcm-16": "wav"
};
var getExtensionFromAudioCodec = /* @__PURE__ */ __name((audioCodec) => {
  if (extensionMap[audioCodec]) {
    return extensionMap[audioCodec];
  }
  throw new Error(`Unsupported audio codec: ${audioCodec}`);
}, "getExtensionFromAudioCodec");
var resolveAudioCodec = /* @__PURE__ */ __name(({
  codec,
  setting,
  preferLossless,
  separateAudioTo
}) => {
  let derivedFromSeparateAudioToExtension = null;
  if (separateAudioTo) {
    const extension = separateAudioTo.split(".").pop();
    for (const [key, value] of Object.entries(extensionMap)) {
      if (value === extension) {
        derivedFromSeparateAudioToExtension = key;
        if (!supportedAudioCodecs[codec].includes(derivedFromSeparateAudioToExtension) && derivedFromSeparateAudioToExtension) {
          throw new Error(`The codec is ${codec} but the audio codec derived from --${separateAudioOption.cliFlag} is ${derivedFromSeparateAudioToExtension}. The only supported codecs are: ${supportedAudioCodecs[codec].join(", ")}`);
        }
      }
    }
  }
  if (preferLossless) {
    const selected = getDefaultAudioCodec({ codec, preferLossless });
    if (derivedFromSeparateAudioToExtension && selected !== derivedFromSeparateAudioToExtension) {
      throw new Error(`The audio codec derived from --${separateAudioOption.cliFlag} is ${derivedFromSeparateAudioToExtension}, but does not match the audio codec derived from the "Prefer lossless" option (${selected}). Remove any conflicting options.`);
    }
    return selected;
  }
  if (setting === null) {
    if (derivedFromSeparateAudioToExtension) {
      return derivedFromSeparateAudioToExtension;
    }
    return getDefaultAudioCodec({ codec, preferLossless });
  }
  if (derivedFromSeparateAudioToExtension !== setting && derivedFromSeparateAudioToExtension) {
    throw new Error(`The audio codec derived from --${separateAudioOption.cliFlag} is ${derivedFromSeparateAudioToExtension}, but does not match the audio codec derived from your ${audioCodecOption.name} setting (${setting}). Remove any conflicting options.`);
  }
  return setting;
}, "resolveAudioCodec");
var getDefaultAudioCodec = /* @__PURE__ */ __name(({
  codec,
  preferLossless
}) => {
  return defaultAudioCodecs[codec][preferLossless ? "lossless" : "compressed"];
}, "getDefaultAudioCodec");
var _audioCodec = null;
var audioCodecOption = {
  cliFlag: cliFlag2,
  setConfig: /* @__PURE__ */ __name((audioCodec) => {
    if (audioCodec === null) {
      _audioCodec = null;
      return;
    }
    if (!validAudioCodecs.includes(audioCodec)) {
      throw new Error(`Audio codec must be one of the following: ${validAudioCodecs.join(", ")}, but got ${audioCodec}`);
    }
    _audioCodec = audioCodec;
  }, "setConfig"),
  getValue: /* @__PURE__ */ __name(({ commandLine }) => {
    if (commandLine[cliFlag2]) {
      const codec = commandLine[cliFlag2];
      if (!validAudioCodecs.includes(commandLine[cliFlag2])) {
        throw new Error(`Audio codec must be one of the following: ${validAudioCodecs.join(", ")}, but got ${codec}`);
      }
      return {
        source: "cli",
        value: commandLine[cliFlag2]
      };
    }
    if (_audioCodec !== null) {
      return {
        source: "config",
        value: _audioCodec
      };
    }
    return {
      source: "default",
      value: null
    };
  }, "getValue"),
  description: /* @__PURE__ */ __name(() => `Set the format of the audio that is embedded in the video. Not all codec and audio codec combinations are supported and certain combinations require a certain file extension and container format. See the table in the docs to see possible combinations.`, "description"),
  docLink: "https://www.remotion.dev/docs/encoding/#audio-codec",
  name: "Audio Codec",
  ssrName,
  type: "aac",
  id: cliFlag2
};
var parseFfmpegProgress = /* @__PURE__ */ __name((input, fps) => {
  const match = input.match(/frame=(\s+)?([0-9]+)\s/);
  if (match) {
    return Number(match[2]);
  }
  const match2 = input.match(/time=(\d+):(\d+):(\d+).(\d+)\s/);
  if (match2) {
    const [, hours, minutes, seconds, hundreds] = match2;
    return Number(hundreds) / 100 * fps + Number(seconds) * fps + Number(minutes) * fps * 60 + Number(hours) * fps * 60 * 60;
  }
}, "parseFfmpegProgress");
var durationOf1Frame = /* @__PURE__ */ __name((sampleRate) => 1024 / sampleRate * 1e6, "durationOf1Frame");
var roundWithFix = /* @__PURE__ */ __name((targetTime) => {
  if (targetTime % 1 > 0.4999999) {
    return Math.ceil(targetTime);
  }
  return Math.floor(targetTime);
}, "roundWithFix");
var getClosestAlignedTime = /* @__PURE__ */ __name((targetTime, sampleRate) => {
  const dur = durationOf1Frame(sampleRate);
  const decimalFramesToTargetTime = targetTime * 1e6 / dur;
  const nearestFrameIndexForTargetTime = roundWithFix(decimalFramesToTargetTime);
  return nearestFrameIndexForTargetTime * dur / 1e6;
}, "getClosestAlignedTime");
var encodeAudio = /* @__PURE__ */ __name(async ({
  files,
  resolvedAudioCodec,
  audioBitrate,
  filelistDir,
  output,
  indent,
  logLevel,
  addRemotionMetadata,
  fps,
  binariesDirectory,
  cancelSignal,
  onProgress
}) => {
  const fileList = files.map((p) => `file '${p}'`).join(`
`);
  const fileListTxt = join3(filelistDir, "audio-files.txt");
  writeFileSync2(fileListTxt, fileList);
  const startCombining = Date.now();
  const command = [
    "-hide_banner",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    fileListTxt,
    "-c:a",
    mapAudioCodecToFfmpegAudioCodecName(resolvedAudioCodec),
    resolvedAudioCodec === "aac" ? "-cutoff" : null,
    resolvedAudioCodec === "aac" ? "18000" : null,
    "-b:a",
    audioBitrate ? audioBitrate : "320k",
    "-vn",
    addRemotionMetadata ? `-metadata` : null,
    addRemotionMetadata ? `comment=Made with Remotion ${VERSION}` : null,
    "-y",
    output
  ];
  Log.verbose({ indent, logLevel }, `Combining audio with re-encoding, command: ${command.join(" ")}`);
  try {
    const task = callFf({
      args: command,
      bin: "ffmpeg",
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal
    });
    task.stderr?.on("data", (data) => {
      const utf8 = data.toString("utf8");
      const parsed = parseFfmpegProgress(utf8, fps);
      if (parsed === void 0) {
        Log.verbose({ indent, logLevel }, utf8);
      } else {
        onProgress(parsed);
        Log.verbose({ indent, logLevel }, `Encoded ${parsed} audio frames`);
      }
    });
    await task;
    Log.verbose({ indent, logLevel }, `Encoded audio in ${Date.now() - startCombining}ms`);
    return output;
  } catch (e) {
    rmSync3(fileListTxt, { recursive: true });
    throw e;
  }
}, "encodeAudio");
var combineAudioSeamlessly = /* @__PURE__ */ __name(async ({
  files,
  filelistDir,
  indent,
  logLevel,
  output,
  chunkDurationInSeconds,
  addRemotionMetadata,
  fps,
  binariesDirectory,
  cancelSignal,
  onProgress,
  sampleRate
}) => {
  const startConcatenating = Date.now();
  const fileList = files.map((p, i) => {
    const isLast = i === files.length - 1;
    const targetStart = i * chunkDurationInSeconds;
    const endStart = (i + 1) * chunkDurationInSeconds;
    const startTime = getClosestAlignedTime(targetStart, sampleRate) * 1e6;
    const endTime = getClosestAlignedTime(endStart, sampleRate) * 1e6;
    const realDuration = endTime - startTime;
    let inpoint = 0;
    if (i > 0) {
      inpoint = durationOf1Frame(sampleRate) * 4;
    }
    const outpoint = (i === 0 ? durationOf1Frame(sampleRate) * 2 : inpoint) + realDuration - (isLast ? 0 : durationOf1Frame(sampleRate));
    return [`file '${p}'`, `inpoint ${inpoint}us`, `outpoint ${outpoint}us`].filter(truthy).join(`
`);
  }).join(`
`);
  const fileListTxt = join3(filelistDir, "audio-files.txt");
  writeFileSync2(fileListTxt, fileList);
  const command = [
    "-hide_banner",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    fileListTxt,
    "-c:a",
    "copy",
    "-vn",
    addRemotionMetadata ? `-metadata` : null,
    addRemotionMetadata ? `comment=Made with Remotion ${VERSION}` : null,
    "-y",
    output
  ];
  Log.verbose({ indent, logLevel }, `Combining AAC audio seamlessly, command: ${command.join(" ")}`);
  try {
    const task = callFf({
      args: command,
      bin: "ffmpeg",
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal
    });
    task.stderr?.on("data", (data) => {
      const utf8 = data.toString("utf8");
      const parsed = parseFfmpegProgress(utf8, fps);
      if (parsed !== void 0) {
        onProgress(parsed);
        Log.verbose({ indent, logLevel }, `Encoded ${parsed} audio frames`);
      }
    });
    await task;
    Log.verbose({ indent, logLevel }, `Combined audio seamlessly in ${Date.now() - startConcatenating}ms`);
    return output;
  } catch (e) {
    rmSync3(fileListTxt, { recursive: true });
    Log.error({ indent, logLevel }, e);
    throw e;
  }
}, "combineAudioSeamlessly");
var createCombinedAudio = /* @__PURE__ */ __name(({
  seamless,
  filelistDir,
  files,
  indent,
  logLevel,
  audioBitrate,
  resolvedAudioCodec,
  output,
  chunkDurationInSeconds,
  addRemotionMetadata,
  binariesDirectory,
  fps,
  cancelSignal,
  onProgress,
  sampleRate
}) => {
  if (seamless) {
    return combineAudioSeamlessly({
      filelistDir,
      files,
      indent,
      logLevel,
      output,
      chunkDurationInSeconds,
      addRemotionMetadata,
      binariesDirectory,
      fps,
      cancelSignal,
      onProgress,
      sampleRate
    });
  }
  return encodeAudio({
    filelistDir,
    files,
    resolvedAudioCodec,
    audioBitrate,
    output,
    indent,
    logLevel,
    addRemotionMetadata,
    binariesDirectory,
    fps,
    cancelSignal,
    onProgress
  });
}, "createCombinedAudio");
var getExtraFramesToCapture = /* @__PURE__ */ __name(({
  compositionStart,
  realFrameRange,
  fps,
  forSeamlessAacConcatenation,
  sampleRate
}) => {
  if (!forSeamlessAacConcatenation) {
    return {
      extraFramesToCaptureAssetsBackend: [],
      extraFramesToCaptureAssetsFrontend: [],
      chunkLengthInSeconds: (realFrameRange[1] - realFrameRange[0] + 1) / fps,
      trimLeftOffset: 0,
      trimRightOffset: 0
    };
  }
  const chunkStart = realFrameRange[0];
  if (chunkStart < compositionStart) {
    throw new Error("chunkStart may not be below compositionStart");
  }
  const realLeftEnd = chunkStart - compositionStart;
  if (realLeftEnd < 0) {
    throw new Error("chunkStat - compositionStart may not be below 0");
  }
  const realRightEnd = realLeftEnd + (realFrameRange[1] - realFrameRange[0] + 1);
  const aacAdjustedLeftEnd = Math.max(0, getClosestAlignedTime(realLeftEnd / fps, sampleRate) - 2 * (1024 / sampleRate));
  const aacAdjustedRightEnd = getClosestAlignedTime(realRightEnd / fps, sampleRate) + 2 * (1024 / sampleRate);
  const alignedStartFrameWithoutOffset = Math.floor(aacAdjustedLeftEnd * fps);
  const alignedStartFrame = alignedStartFrameWithoutOffset + compositionStart;
  const alignedEndFrame = Math.ceil(aacAdjustedRightEnd * fps) + compositionStart;
  const extraFramesToCaptureAudioOnlyFrontend = new Array(realFrameRange[0] - alignedStartFrame).fill(true).map((_, f) => f + alignedStartFrame);
  const extraFramesToCaptureAudioOnlyBackend = new Array(alignedEndFrame - realFrameRange[1] - 1).fill(true).map((_, f) => f + realFrameRange[1] + 1);
  const trimLeftOffset = (aacAdjustedLeftEnd * fps - alignedStartFrameWithoutOffset) / fps;
  const trimRightOffset = (aacAdjustedRightEnd * fps - Math.ceil(aacAdjustedRightEnd * fps)) / fps;
  const chunkLengthInSeconds = aacAdjustedRightEnd - aacAdjustedLeftEnd;
  return {
    extraFramesToCaptureAssetsFrontend: extraFramesToCaptureAudioOnlyFrontend,
    extraFramesToCaptureAssetsBackend: extraFramesToCaptureAudioOnlyBackend,
    chunkLengthInSeconds,
    trimLeftOffset,
    trimRightOffset
  };
}, "getExtraFramesToCapture");
var getFrameOutputFileNameFromPattern = /* @__PURE__ */ __name(({
  pattern,
  frame,
  ext
}) => {
  return pattern.replace(/\[frame\]/g, frame).replace(/\[ext\]/g, ext);
}, "getFrameOutputFileNameFromPattern");
var getFrameOutputFileName = /* @__PURE__ */ __name(({
  index,
  frame,
  imageFormat,
  countType,
  lastFrame,
  totalFrames,
  imageSequencePattern
}) => {
  const filePadLength = getFilePadLength({ lastFrame, countType, totalFrames });
  const frameStr = countType === "actual-frames" ? String(frame).padStart(filePadLength, "0") : String(index).padStart(filePadLength, "0");
  if (imageSequencePattern) {
    return getFrameOutputFileNameFromPattern({
      pattern: imageSequencePattern,
      frame: frameStr,
      ext: imageFormat
    });
  }
  const prefix = "element";
  if (countType === "actual-frames") {
    return `${prefix}-${frameStr}.${imageFormat}`;
  }
  if (countType === "from-zero") {
    return `${prefix}-${frameStr}.${imageFormat}`;
  }
  throw new TypeError("Unknown count type");
}, "getFrameOutputFileName");
var getFilePadLength = /* @__PURE__ */ __name(({
  lastFrame,
  totalFrames,
  countType
}) => {
  if (countType === "actual-frames") {
    return String(lastFrame).length;
  }
  if (countType === "from-zero") {
    return String(totalFrames - 1).length;
  }
  throw new Error("Unknown file type");
}, "getFilePadLength");
var makeCancelSignal = /* @__PURE__ */ __name(() => {
  const callbacks = [];
  let cancelled = false;
  return {
    cancelSignal: /* @__PURE__ */ __name((callback) => {
      callbacks.push(callback);
      if (cancelled) {
        callback();
      }
    }, "cancelSignal"),
    cancel: /* @__PURE__ */ __name(() => {
      if (cancelled) {
        return;
      }
      callbacks.forEach((cb) => {
        cb();
      });
      cancelled = true;
    }, "cancel")
  };
}, "makeCancelSignal");
var cancelErrorMessages = {
  renderMedia: "renderMedia() got cancelled",
  renderFrames: "renderFrames() got cancelled",
  renderStill: "renderStill() got cancelled",
  stitchFramesToVideo: "stitchFramesToVideo() got cancelled"
};
var isUserCancelledRender = /* @__PURE__ */ __name((err) => {
  if (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string") {
    return err.message.includes(cancelErrorMessages.renderMedia) || err.message.includes(cancelErrorMessages.renderFrames) || err.message.includes(cancelErrorMessages.renderStill) || err.message.includes(cancelErrorMessages.stitchFramesToVideo);
  }
  return false;
}, "isUserCancelledRender");
var makePage = /* @__PURE__ */ __name(async ({
  context,
  initialFrame,
  browserReplacer,
  logLevel,
  indent,
  pagesArray,
  onBrowserLog,
  scale,
  timeoutInMilliseconds,
  composition,
  proxyPort,
  serveUrl,
  muted,
  envVariables,
  serializedInputPropsWithCustomSchema,
  imageFormat,
  serializedResolvedPropsWithCustomSchema,
  pageIndex,
  isMainTab,
  mediaCacheSizeInBytes,
  onLog,
  darkMode,
  sampleRate
}) => {
  const page = await browserReplacer.getBrowser().newPage({ context, logLevel, indent, pageIndex, onBrowserLog, onLog });
  pagesArray.push(page);
  await page.setViewport({
    width: composition.width,
    height: composition.height,
    deviceScaleFactor: scale
  });
  await setPropsAndEnv({
    serializedInputPropsWithCustomSchema,
    envVariables,
    page,
    serveUrl,
    initialFrame,
    timeoutInMilliseconds,
    proxyPort,
    retriesRemaining: 2,
    audioEnabled: !muted,
    videoEnabled: imageFormat !== "none",
    indent,
    logLevel,
    onServeUrlVisited: /* @__PURE__ */ __name(() => {
      return;
    }, "onServeUrlVisited"),
    isMainTab,
    mediaCacheSizeInBytes,
    initialMemoryAvailable: getAvailableMemory(logLevel),
    darkMode,
    sampleRate
  });
  await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name((id, props, durationInFrames, fps, height, width, defaultCodec, defaultOutName, defaultVideoImageFormat, defaultPixelFormat, defaultProResProfile, defaultSampleRate) => {
      window.remotion_setBundleMode({
        type: "composition",
        compositionName: id,
        serializedResolvedPropsWithSchema: props,
        compositionDurationInFrames: durationInFrames,
        compositionFps: fps,
        compositionHeight: height,
        compositionWidth: width,
        compositionDefaultCodec: defaultCodec,
        compositionDefaultOutName: defaultOutName,
        compositionDefaultVideoImageFormat: defaultVideoImageFormat,
        compositionDefaultPixelFormat: defaultPixelFormat,
        compositionDefaultProResProfile: defaultProResProfile,
        compositionDefaultSampleRate: defaultSampleRate
      });
    }, "pageFunction"),
    args: [
      composition.id,
      serializedResolvedPropsWithCustomSchema,
      composition.durationInFrames,
      composition.fps,
      composition.height,
      composition.width,
      composition.defaultCodec,
      composition.defaultOutName,
      composition.defaultVideoImageFormat,
      composition.defaultPixelFormat,
      composition.defaultProResProfile,
      composition.defaultSampleRate
    ],
    frame: null,
    page,
    timeoutInMilliseconds
  });
  return page;
}, "makePage");
var renderPartitions = /* @__PURE__ */ __name(({
  frames,
  concurrency
}) => {
  const partitions = [];
  let start = 0;
  for (let i = 0; i < concurrency; i++) {
    const end = start + Math.ceil((frames.length - start) / (concurrency - i));
    partitions.push(frames.slice(start, end));
    start = end;
  }
  return {
    partitions,
    getNextFrame: /* @__PURE__ */ __name((pageIndex) => {
      if (partitions[pageIndex].length === 0) {
        const partitionLengths = partitions.map((p) => p.length);
        if (partitionLengths.every((p) => p === 0)) {
          throw new Error("No more frames to render");
        }
        let longestRemainingPartitionIndex = -1;
        for (let i = 0; i < partitions.length; i++) {
          if (longestRemainingPartitionIndex === -1) {
            longestRemainingPartitionIndex = i;
            continue;
          }
          if (partitions[i].length > partitions[longestRemainingPartitionIndex].length) {
            longestRemainingPartitionIndex = i;
          }
        }
        if (longestRemainingPartitionIndex === -1) {
          throw new Error("No more frames to render");
        }
        const slicePoint = Math.ceil(partitions[longestRemainingPartitionIndex].length / 2) - 1;
        partitions[pageIndex] = partitions[longestRemainingPartitionIndex].slice(slicePoint);
        partitions[longestRemainingPartitionIndex] = partitions[longestRemainingPartitionIndex].slice(0, slicePoint);
      }
      const value = partitions[pageIndex].shift();
      if (value === void 0) {
        throw new Error("No more frames to render");
      }
      return value;
    }, "getNextFrame")
  };
}, "renderPartitions");
var nextFrameToRenderState = /* @__PURE__ */ __name(({
  allFramesAndExtraFrames,
  concurrencyOrFramesToRender: _concurrency
}) => {
  const rendered = /* @__PURE__ */ new Map();
  return {
    getNextFrame: /* @__PURE__ */ __name((_pageIndex) => {
      const nextFrame = allFramesAndExtraFrames.find((frame) => {
        return !rendered.has(frame);
      });
      if (nextFrame === void 0) {
        throw new Error("No more frames to render");
      }
      rendered.set(nextFrame, true);
      return nextFrame;
    }, "getNextFrame"),
    returnFrame: /* @__PURE__ */ __name((frame) => {
      rendered.delete(frame);
    }, "returnFrame")
  };
}, "nextFrameToRenderState");
var partitionedNextFrameToRenderState = /* @__PURE__ */ __name(({
  allFramesAndExtraFrames,
  concurrencyOrFramesToRender: concurrency
}) => {
  const partitions = renderPartitions({
    frames: allFramesAndExtraFrames,
    concurrency
  });
  return {
    getNextFrame: /* @__PURE__ */ __name((pageIndex) => {
      return partitions.getNextFrame(pageIndex);
    }, "getNextFrame"),
    returnFrame: /* @__PURE__ */ __name(() => {
      throw new Error("retrying failed frames for partitioned rendering is not supported. Disable partitioned rendering.");
    }, "returnFrame")
  };
}, "partitionedNextFrameToRenderState");
var Pool = class {
  static {
    __name(this, "Pool");
  }
  resources;
  waiters;
  constructor(resources) {
    this.resources = resources;
    this.waiters = [];
  }
  acquire() {
    const resource = this.resources.shift();
    if (resource !== void 0) {
      return Promise.resolve(resource);
    }
    return new Promise((resolve22) => {
      this.waiters.push((freeResource) => {
        resolve22(freeResource);
      });
    });
  }
  release(resource) {
    const waiter = this.waiters.shift();
    if (waiter === void 0) {
      this.resources.push(resource);
    } else {
      waiter(resource);
    }
  }
};
var getRetriesLeftFromError = /* @__PURE__ */ __name((error) => {
  if (!error) {
    throw new Error("Expected stack");
  }
  const { stack } = error;
  if (!stack) {
    throw new Error("Expected stack: " + JSON.stringify(error));
  }
  const beforeIndex = stack.indexOf(NoReactInternals.DELAY_RENDER_ATTEMPT_TOKEN);
  if (beforeIndex === -1) {
    throw new Error("Expected to find attempt token in stack");
  }
  const afterIndex = stack.indexOf(NoReactInternals.DELAY_RENDER_RETRY_TOKEN);
  if (afterIndex === -1) {
    throw new Error("Expected to find retry token in stack");
  }
  const inbetween = stack.substring(beforeIndex + NoReactInternals.DELAY_RENDER_ATTEMPT_TOKEN.length, afterIndex);
  const parsed = Number(inbetween);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected to find a number in the stack ${stack}`);
  }
  return parsed;
}, "getRetriesLeftFromError");
var collectAssets = /* @__PURE__ */ __name(async ({
  frame,
  freePage,
  timeoutInMilliseconds
}) => {
  const { value } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      return window.remotion_collectAssets();
    }, "pageFunction"),
    args: [],
    frame,
    page: freePage,
    timeoutInMilliseconds
  });
  const fixedArtifacts = value.map((asset) => {
    if (asset.type !== "artifact") {
      return asset;
    }
    if (asset.contentType === "binary" || asset.contentType === "text") {
      if (typeof asset.content !== "string") {
        throw new Error(`Expected string content for artifact ${asset.id}, but got ${asset.content}`);
      }
      const stringOrUintArray = asset.contentType === "binary" ? new TextEncoder().encode(atob(asset.content)) : asset.content;
      return {
        ...asset,
        content: stringOrUintArray
      };
    }
    if (asset.contentType === "thumbnail") {
      return asset;
    }
    return asset;
  });
  return fixedArtifacts;
}, "collectAssets");
var onlyAudioAndVideoAssets = /* @__PURE__ */ __name((assets) => {
  return assets.filter((asset) => asset.type === "audio" || asset.type === "video");
}, "onlyAudioAndVideoAssets");
var onlyArtifact = /* @__PURE__ */ __name(({
  assets,
  frameBuffer
}) => {
  const artifacts = assets.filter((asset) => asset.type === "artifact");
  return artifacts.map((artifact) => {
    if (artifact.contentType === "binary" || artifact.contentType === "text") {
      return {
        frame: artifact.frame,
        content: artifact.content,
        filename: artifact.filename,
        downloadBehavior: artifact.downloadBehavior
      };
    }
    if (artifact.contentType === "thumbnail") {
      if (frameBuffer === null) {
        return null;
      }
      return {
        frame: artifact.frame,
        content: new Uint8Array(frameBuffer),
        filename: artifact.filename,
        downloadBehavior: artifact.downloadBehavior
      };
    }
    throw new Error("Unknown artifact type: " + artifact);
  }).filter(truthy);
}, "onlyArtifact");
var onlyInlineAudio = /* @__PURE__ */ __name((assets) => {
  return assets.filter((asset) => asset.type === "inline-audio");
}, "onlyInlineAudio");
var screenshotTask = /* @__PURE__ */ __name(async ({
  format: format2,
  height,
  omitBackground,
  page,
  width,
  path: path202,
  jpegQuality,
  scale
}) => {
  const client = page._client();
  const target = page.target();
  await client.send("Target.activateTarget", {
    targetId: target._targetId
  });
  if (omitBackground) {
    await client.send("Emulation.setDefaultBackgroundColorOverride", {
      color: { r: 0, g: 0, b: 0, a: 0 }
    });
  }
  const cap = startPerfMeasure("capture");
  try {
    let result;
    if (format2 === "pdf") {
      const res = await client.send("Page.printToPDF", {
        paperWidth: width / 96,
        paperHeight: height / 96,
        marginTop: 0,
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 0,
        scale: 1,
        printBackground: true
      });
      result = res.value;
    } else {
      const fromSurface = !process.env.DISABLE_FROM_SURFACE || height > 8192 || width > 8192;
      const scaleFactor = fromSurface ? 1 : scale;
      const { value } = await client.send("Page.captureScreenshot", {
        format: format2,
        quality: jpegQuality,
        clip: {
          x: 0,
          y: 0,
          height: height * scaleFactor,
          scale: 1,
          width: width * scaleFactor
        },
        captureBeyondViewport: true,
        optimizeForSpeed: true,
        fromSurface
      });
      result = value;
    }
    stopPerfMeasure(cap);
    if (omitBackground) {
      await client.send("Emulation.setDefaultBackgroundColorOverride");
    }
    const buffer = Buffer.from(result.data, "base64");
    if (path202) {
      await fs14.promises.writeFile(path202, buffer);
    }
    return buffer;
  } catch (err) {
    if (err.message.includes("Unable to capture screenshot")) {
      const errMessage = [
        "Could not take a screenshot because Google Chrome ran out of memory or disk space.",
        process?.env?.__RESERVED_IS_INSIDE_REMOTION_LAMBDA ? "Deploy a new Lambda function with more memory or disk space." : "Decrease the concurrency to use less RAM."
      ].join(" ");
      throw new Error(errMessage);
    }
    throw err;
  }
}, "screenshotTask");
var screenshot = /* @__PURE__ */ __name((options) => {
  if (options.jpegQuality) {
    assert2.ok(typeof options.jpegQuality === "number", "Expected options.quality to be a number but found " + typeof options.jpegQuality);
    assert2.ok(Number.isInteger(options.jpegQuality), "Expected options.quality to be an integer");
    assert2.ok(options.jpegQuality >= 0 && options.jpegQuality <= 100, "Expected options.quality to be between 0 and 100 (inclusive), got " + options.jpegQuality);
  }
  return options.page.screenshotTaskQueue.postTask(() => screenshotTask({
    page: options.page,
    format: options.type,
    height: options.height,
    width: options.width,
    omitBackground: options.omitBackground,
    path: options.path,
    jpegQuality: options.type === "jpeg" ? options.jpegQuality : void 0,
    scale: options.scale
  }));
}, "screenshot");
var takeFrame = /* @__PURE__ */ __name(async ({
  freePage,
  imageFormat,
  jpegQuality,
  width,
  height,
  output,
  scale,
  wantsBuffer,
  timeoutInMilliseconds
}) => {
  if (imageFormat === "none") {
    return null;
  }
  if (imageFormat === "png" || imageFormat === "pdf" || imageFormat === "webp") {
    await puppeteerEvaluateWithCatch({
      pageFunction: /* @__PURE__ */ __name(() => {
        document.body.style.background = "transparent";
      }, "pageFunction"),
      args: [],
      frame: null,
      page: freePage,
      timeoutInMilliseconds
    });
  } else {
    await puppeteerEvaluateWithCatch({
      pageFunction: /* @__PURE__ */ __name(() => {
        document.body.style.background = "black";
      }, "pageFunction"),
      args: [],
      frame: null,
      page: freePage,
      timeoutInMilliseconds
    });
  }
  const buf = await screenshot({
    page: freePage,
    omitBackground: imageFormat === "png" || imageFormat === "webp",
    path: (wantsBuffer ? void 0 : output) ?? void 0,
    type: imageFormat,
    jpegQuality,
    width,
    height,
    scale
  });
  return buf;
}, "takeFrame");
var renderFrameWithOptionToReject = /* @__PURE__ */ __name(async ({
  reject,
  width,
  height,
  compId,
  attempt,
  stoppedSignal,
  indent,
  logLevel,
  timeoutInMilliseconds,
  outputDir,
  onFrameBuffer,
  imageFormat,
  onError,
  lastFrame,
  jpegQuality,
  frameDir,
  scale,
  countType,
  assets,
  framesToRender,
  onArtifact,
  onDownload,
  downloadMap,
  binariesDirectory,
  cancelSignal,
  framesRenderedObj,
  onFrameUpdate,
  frame,
  page,
  imageSequencePattern,
  fps,
  trimLeftOffset,
  trimRightOffset,
  allFramesAndExtraFrames
}) => {
  const startTime = performance.now();
  const index = framesToRender.indexOf(frame);
  const assetsOnly = index === -1;
  if (stoppedSignal.stopped) {
    return Promise.reject(new Error("Render was stopped"));
  }
  const errorCallbackOnFrame = /* @__PURE__ */ __name((err) => {
    reject(err);
  }, "errorCallbackOnFrame");
  const cleanupPageError = handleJavascriptException({
    page,
    onError: errorCallbackOnFrame,
    frame
  });
  page.on("error", errorCallbackOnFrame);
  const startSeeking = Date.now();
  await seekToFrame({
    frame,
    page,
    composition: compId,
    timeoutInMilliseconds,
    indent,
    logLevel,
    attempt
  });
  const timeToSeek = Date.now() - startSeeking;
  if (timeToSeek > 1e3) {
    Log.verbose({ indent, logLevel }, `Seeking to frame ${frame} took ${timeToSeek}ms`);
  }
  if (!outputDir && !onFrameBuffer && imageFormat !== "none") {
    throw new Error("Called renderFrames() without specifying either `outputDir` or `onFrameBuffer`");
  }
  if (outputDir && onFrameBuffer && imageFormat !== "none") {
    throw new Error("Pass either `outputDir` or `onFrameBuffer` to renderFrames(), not both.");
  }
  const [buffer, collectedAssets] = await Promise.all([
    takeFrame({
      freePage: page,
      height,
      imageFormat: assetsOnly ? "none" : imageFormat,
      output: index === null ? null : path20.join(frameDir, getFrameOutputFileName({
        frame,
        imageFormat,
        index,
        countType,
        lastFrame,
        totalFrames: framesToRender.length,
        imageSequencePattern
      })),
      jpegQuality,
      width,
      scale,
      wantsBuffer: Boolean(onFrameBuffer),
      timeoutInMilliseconds
    }),
    collectAssets({
      frame,
      freePage: page,
      timeoutInMilliseconds
    })
  ]);
  if (onFrameBuffer && !assetsOnly) {
    if (!buffer) {
      throw new Error("unexpected null buffer");
    }
    onFrameBuffer(buffer, frame);
  }
  const onlyAvailableAssets = assets.filter(truthy);
  const previousAudioRenderAssets = onlyAvailableAssets.map((a) => a.audioAndVideoAssets).flat(2);
  const previousArtifactAssets = onlyAvailableAssets.map((a) => a.artifactAssets).flat(2);
  const audioAndVideoAssets = onlyAudioAndVideoAssets(collectedAssets);
  const artifactAssets = onlyArtifact({
    assets: collectedAssets,
    frameBuffer: buffer
  });
  for (const artifact of artifactAssets) {
    for (const previousArtifact of previousArtifactAssets) {
      if (artifact.filename === previousArtifact.filename) {
        return Promise.reject(new Error(`An artifact with output "${artifact.filename}" was already registered at frame ${previousArtifact.frame}, but now registered again at frame ${artifact.frame}. Artifacts must have unique names. https://remotion.dev/docs/artifacts`));
      }
    }
    onArtifact?.(artifact);
  }
  const compressedAssets = audioAndVideoAssets.map((asset) => {
    return compressAsset(previousAudioRenderAssets, asset);
  });
  const inlineAudioAssets = onlyInlineAudio(collectedAssets);
  assets.push({
    audioAndVideoAssets: compressedAssets,
    frame,
    artifactAssets: artifactAssets.map((a) => {
      return {
        frame: a.frame,
        filename: a.filename
      };
    }),
    inlineAudioAssets
  });
  for (const renderAsset of compressedAssets) {
    downloadAndMapAssetsToFileUrl({
      renderAsset,
      onDownload,
      downloadMap,
      indent,
      logLevel,
      binariesDirectory,
      cancelSignalForAudioAnalysis: cancelSignal,
      shouldAnalyzeAudioImmediately: true
    }).catch((err) => {
      const truncateWithEllipsis = renderAsset.src.substring(0, 1e3) + (renderAsset.src.length > 1e3 ? "..." : "");
      onError(new Error(`Error while downloading ${truncateWithEllipsis}: ${err.stack}`));
    });
  }
  for (const renderAsset of inlineAudioAssets) {
    downloadMap.inlineAudioMixing.addAsset({
      asset: renderAsset,
      fps,
      totalNumberOfFrames: allFramesAndExtraFrames.length,
      firstFrame: allFramesAndExtraFrames[0],
      trimLeftOffset,
      trimRightOffset
    });
  }
  cleanupPageError();
  page.off("error", errorCallbackOnFrame);
  if (!assetsOnly) {
    framesRenderedObj.count++;
    onFrameUpdate?.(framesRenderedObj.count, frame, performance.now() - startTime);
  }
}, "renderFrameWithOptionToReject");
var renderFrame = /* @__PURE__ */ __name(({
  attempt,
  binariesDirectory,
  cancelSignal,
  imageFormat,
  indent,
  logLevel,
  assets,
  countType,
  downloadMap,
  frameDir,
  framesToRender,
  jpegQuality,
  onArtifact,
  onDownload,
  scale,
  composition,
  onError,
  outputDir,
  stoppedSignal,
  timeoutInMilliseconds,
  lastFrame,
  onFrameBuffer,
  onFrameUpdate,
  framesRenderedObj,
  frame,
  page,
  imageSequencePattern,
  trimLeftOffset,
  trimRightOffset,
  allFramesAndExtraFrames
}) => {
  return new Promise((resolve22, reject) => {
    renderFrameWithOptionToReject({
      reject,
      width: composition.width,
      height: composition.height,
      compId: composition.id,
      attempt,
      indent,
      logLevel,
      stoppedSignal,
      timeoutInMilliseconds,
      imageFormat,
      onFrameBuffer,
      outputDir,
      assets,
      binariesDirectory,
      cancelSignal,
      countType,
      downloadMap,
      frameDir,
      framesToRender,
      jpegQuality,
      lastFrame,
      onArtifact,
      onDownload,
      onError,
      scale,
      framesRenderedObj,
      onFrameUpdate,
      frame,
      page,
      imageSequencePattern,
      fps: composition.fps,
      trimLeftOffset,
      trimRightOffset,
      allFramesAndExtraFrames
    }).then(() => {
      resolve22();
    }).catch((err) => {
      reject(err);
    });
  });
}, "renderFrame");
var renderFrameAndRetryTargetClose = /* @__PURE__ */ __name(async ({
  retriesLeft,
  attempt,
  assets,
  imageFormat,
  binariesDirectory,
  cancelSignal,
  composition,
  countType,
  downloadMap,
  frameDir,
  framesToRender,
  jpegQuality,
  onArtifact,
  onDownload,
  onError,
  outputDir,
  poolPromise,
  scale,
  stoppedSignal,
  timeoutInMilliseconds,
  indent,
  logLevel,
  makeBrowser,
  makeNewPage,
  browserReplacer,
  concurrencyOrFramesToRender,
  framesRenderedObj,
  lastFrame,
  onFrameBuffer,
  onFrameUpdate,
  nextFrameToRender,
  imageSequencePattern,
  trimLeftOffset,
  trimRightOffset,
  allFramesAndExtraFrames
}) => {
  const currentPool = await poolPromise;
  if (stoppedSignal.stopped) {
    return;
  }
  const freePage = await currentPool.acquire();
  const frame = nextFrameToRender.getNextFrame(freePage.pageIndex);
  try {
    await Promise.race([
      renderFrame({
        trimLeftOffset,
        trimRightOffset,
        allFramesAndExtraFrames,
        attempt,
        assets,
        binariesDirectory,
        cancelSignal,
        countType,
        downloadMap,
        frameDir,
        framesToRender,
        imageFormat,
        indent,
        jpegQuality,
        logLevel,
        onArtifact,
        onDownload,
        scale,
        composition,
        framesRenderedObj,
        lastFrame,
        onError,
        onFrameBuffer,
        onFrameUpdate,
        outputDir,
        stoppedSignal,
        timeoutInMilliseconds,
        nextFrameToRender,
        frame,
        page: freePage,
        imageSequencePattern
      }),
      new Promise((_, reject) => {
        cancelSignal?.(() => {
          reject(new Error(cancelErrorMessages.renderFrames));
        });
      })
    ]);
    currentPool.release(freePage);
  } catch (err) {
    const isTargetClosedError = isTargetClosedErr(err);
    const shouldRetryError = err.stack?.includes(NoReactInternals.DELAY_RENDER_RETRY_TOKEN);
    const flakyNetworkError = isFlakyNetworkError(err);
    if (isUserCancelledRender(err) && !shouldRetryError) {
      throw err;
    }
    if (!isTargetClosedError && !shouldRetryError && !flakyNetworkError) {
      throw err;
    }
    if (stoppedSignal.stopped) {
      return;
    }
    if (retriesLeft === 0) {
      Log.warn({
        indent,
        logLevel
      }, `The browser crashed ${attempt} times while rendering frame ${frame}. Not retrying anymore. Learn more about this error under https://www.remotion.dev/docs/target-closed`);
      throw err;
    }
    if (shouldRetryError) {
      const pool = await poolPromise;
      const newPage = await makeNewPage(frame, freePage.pageIndex);
      pool.release(newPage);
      Log.warn({ indent, logLevel }, `delayRender() timed out while rendering frame ${frame}: ${err.message}`);
      const actualRetriesLeft = getRetriesLeftFromError(err);
      nextFrameToRender.returnFrame(frame);
      return renderFrameAndRetryTargetClose({
        retriesLeft: actualRetriesLeft,
        attempt: attempt + 1,
        assets,
        imageFormat,
        binariesDirectory,
        cancelSignal,
        composition,
        countType,
        downloadMap,
        frameDir,
        framesToRender,
        indent,
        jpegQuality,
        logLevel,
        onArtifact,
        onDownload,
        onError,
        outputDir,
        poolPromise,
        scale,
        stoppedSignal,
        timeoutInMilliseconds,
        makeBrowser,
        makeNewPage,
        browserReplacer,
        concurrencyOrFramesToRender,
        framesRenderedObj,
        lastFrame,
        onFrameBuffer,
        onFrameUpdate,
        nextFrameToRender,
        imageSequencePattern,
        trimLeftOffset,
        trimRightOffset,
        allFramesAndExtraFrames
      });
    }
    Log.warn({ indent, logLevel }, `The browser crashed while rendering frame ${frame}, retrying ${retriesLeft} more times. Learn more about this error under https://www.remotion.dev/docs/target-closed`);
    await browserReplacer.replaceBrowser(makeBrowser, async () => {
      const pages = new Array(concurrencyOrFramesToRender).fill(true).map((_, i) => makeNewPage(frame, i));
      const puppeteerPages = await Promise.all(pages);
      const pool = await poolPromise;
      for (const newPage of puppeteerPages) {
        pool.release(newPage);
      }
    });
    nextFrameToRender.returnFrame(frame);
    await renderFrameAndRetryTargetClose({
      retriesLeft: retriesLeft - 1,
      attempt: attempt + 1,
      assets,
      binariesDirectory,
      cancelSignal,
      composition,
      countType,
      downloadMap,
      frameDir,
      framesToRender,
      imageFormat,
      indent,
      jpegQuality,
      logLevel,
      onArtifact,
      makeBrowser,
      onDownload,
      onError,
      outputDir,
      poolPromise,
      scale,
      stoppedSignal,
      timeoutInMilliseconds,
      browserReplacer,
      makeNewPage,
      concurrencyOrFramesToRender,
      framesRenderedObj,
      lastFrame,
      onFrameBuffer,
      onFrameUpdate,
      nextFrameToRender,
      imageSequencePattern,
      trimLeftOffset,
      trimRightOffset,
      allFramesAndExtraFrames
    });
  }
}, "renderFrameAndRetryTargetClose");
var handleBrowserCrash = /* @__PURE__ */ __name((instance, logLevel, indent) => {
  let _instance = instance;
  const waiters = [];
  let replacing = false;
  return {
    getBrowser: /* @__PURE__ */ __name(() => _instance, "getBrowser"),
    replaceBrowser: /* @__PURE__ */ __name(async (make, makeNewPages) => {
      if (replacing) {
        const waiter = new Promise((resolve22, reject) => {
          waiters.push({
            resolve: resolve22,
            reject
          });
        });
        return waiter;
      }
      try {
        replacing = true;
        await _instance.close({ silent: true }).then(() => {
          Log.info({ indent, logLevel }, "Killed previous browser and making new one");
        }).catch(() => {
        });
        const browser = await make();
        _instance = browser;
        await makeNewPages();
        waiters.forEach((w) => w.resolve(browser));
        Log.info({ indent, logLevel }, "Made new browser");
        return browser;
      } catch (err) {
        waiters.forEach((w) => w.reject(err));
        throw err;
      } finally {
        replacing = false;
      }
    }, "replaceBrowser")
  };
}, "handleBrowserCrash");
var validateFps = NoReactInternals.validateFps;
var validateDimension = NoReactInternals.validateDimension;
var validateDurationInFrames = NoReactInternals.validateDurationInFrames;
var validateScale = /* @__PURE__ */ __name((scale) => {
  if (typeof scale === "undefined") {
    return;
  }
  if (typeof scale !== "number") {
    throw new Error('Scale should be a number or undefined, but is "' + JSON.stringify(scale) + '"');
  }
  if (Number.isNaN(scale)) {
    throw new Error("`scale` should not be NaN, but is NaN");
  }
  if (!Number.isFinite(scale)) {
    throw new Error(`"scale" must be finite, but is ${scale}`);
  }
  if (scale <= 0) {
    throw new Error(`"scale" must be bigger than 0, but is ${scale}`);
  }
  if (scale > 16) {
    throw new Error(`"scale" must be smaller or equal than 16, but is ${scale}`);
  }
}, "validateScale");
var MAX_RETRIES_PER_FRAME = 1;
var innerRenderFrames = /* @__PURE__ */ __name(async ({
  onFrameUpdate,
  outputDir,
  onStart,
  serializedInputPropsWithCustomSchema,
  serializedResolvedPropsWithCustomSchema,
  jpegQuality,
  imageFormat,
  frameRange,
  onError,
  envVariables,
  onBrowserLog,
  onFrameBuffer,
  onDownload,
  pagesArray,
  serveUrl,
  composition,
  timeoutInMilliseconds,
  scale,
  resolvedConcurrency,
  everyNthFrame,
  proxyPort,
  cancelSignal,
  downloadMap,
  muted,
  makeBrowser,
  browserReplacer,
  sourceMapGetter,
  logLevel,
  indent,
  parallelEncodingEnabled,
  compositionStart,
  forSeamlessAacConcatenation,
  onArtifact,
  binariesDirectory,
  imageSequencePattern,
  mediaCacheSizeInBytes,
  onLog,
  darkMode,
  sampleRate
}) => {
  if (outputDir) {
    if (!fs15.existsSync(outputDir)) {
      fs15.mkdirSync(outputDir, {
        recursive: true
      });
    }
  }
  const downloadPromises = [];
  const realFrameRange = getRealFrameRange(composition.durationInFrames, frameRange);
  const {
    extraFramesToCaptureAssetsBackend,
    extraFramesToCaptureAssetsFrontend,
    chunkLengthInSeconds,
    trimLeftOffset,
    trimRightOffset
  } = getExtraFramesToCapture({
    fps: composition.fps,
    compositionStart,
    realFrameRange,
    forSeamlessAacConcatenation,
    sampleRate
  });
  const framesToRender = getFramesToRender(realFrameRange, everyNthFrame);
  const lastFrame = framesToRender[framesToRender.length - 1];
  const concurrencyOrFramesToRender = Math.min(framesToRender.length, resolvedConcurrency);
  const makeNewPage = /* @__PURE__ */ __name((frame, pageIndex) => {
    return makePage({
      context: sourceMapGetter,
      initialFrame: frame,
      browserReplacer,
      indent,
      logLevel,
      onBrowserLog,
      pagesArray,
      scale,
      composition,
      envVariables,
      imageFormat,
      muted,
      proxyPort,
      serializedInputPropsWithCustomSchema,
      serializedResolvedPropsWithCustomSchema,
      serveUrl,
      timeoutInMilliseconds,
      pageIndex,
      isMainTab: pageIndex === 0,
      mediaCacheSizeInBytes,
      onLog,
      darkMode,
      sampleRate
    });
  }, "makeNewPage");
  const getPool = /* @__PURE__ */ __name(async () => {
    const pages = new Array(concurrencyOrFramesToRender).fill(true).map((_, i) => makeNewPage(framesToRender[i], i));
    const puppeteerPages = await Promise.all(pages);
    const pool = new Pool(puppeteerPages);
    return pool;
  }, "getPool");
  const countType = everyNthFrame === 1 ? "actual-frames" : "from-zero";
  const filePadLength = getFilePadLength({
    lastFrame,
    totalFrames: framesToRender.length,
    countType
  });
  const framesRenderedObj = {
    count: 0
  };
  const poolPromise = getPool();
  onStart?.({
    frameCount: framesToRender.length,
    parallelEncoding: parallelEncodingEnabled,
    resolvedConcurrency
  });
  const assets = [];
  const stoppedSignal = { stopped: false };
  cancelSignal?.(() => {
    stoppedSignal.stopped = true;
  });
  const frameDir = outputDir ?? downloadMap.compositingDir;
  const allFramesAndExtraFrames = [
    ...extraFramesToCaptureAssetsFrontend,
    ...framesToRender,
    ...extraFramesToCaptureAssetsBackend
  ];
  const shouldUsePartitionedRendering = getShouldUsePartitionedRendering();
  if (shouldUsePartitionedRendering) {
    Log.info({ indent, logLevel }, "Experimental: Using partitioned rendering (https://github.com/remotion-dev/remotion/pull/4830)");
  }
  const nextFrameToRender = shouldUsePartitionedRendering ? partitionedNextFrameToRenderState({
    allFramesAndExtraFrames,
    concurrencyOrFramesToRender
  }) : nextFrameToRenderState({
    allFramesAndExtraFrames,
    concurrencyOrFramesToRender
  });
  const pattern = imageSequencePattern || `element-[frame].[ext]`;
  const imageSequenceName = pattern.replace(/\[frame\]/g, `%0${filePadLength}d`).replace(/\[ext\]/g, imageFormat);
  await Promise.all(allFramesAndExtraFrames.map(() => {
    return renderFrameAndRetryTargetClose({
      retriesLeft: MAX_RETRIES_PER_FRAME,
      attempt: 1,
      assets,
      binariesDirectory,
      cancelSignal,
      composition,
      countType,
      downloadMap,
      frameDir,
      framesToRender,
      imageFormat,
      indent,
      jpegQuality,
      logLevel,
      onArtifact,
      onDownload,
      onError,
      outputDir,
      poolPromise,
      scale,
      stoppedSignal,
      timeoutInMilliseconds,
      makeBrowser,
      browserReplacer,
      concurrencyOrFramesToRender,
      framesRenderedObj,
      lastFrame,
      makeNewPage,
      onFrameBuffer,
      onFrameUpdate,
      nextFrameToRender,
      imageSequencePattern: pattern,
      trimLeftOffset,
      trimRightOffset,
      allFramesAndExtraFrames
    });
  }));
  const firstFrameIndex = countType === "from-zero" ? 0 : framesToRender[0];
  await Promise.all(downloadPromises);
  return {
    assetsInfo: {
      assets: assets.sort((a, b) => {
        return a.frame - b.frame;
      }),
      imageSequenceName: path21.join(frameDir, imageSequenceName),
      firstFrameIndex,
      downloadMap,
      trimLeftOffset,
      trimRightOffset,
      chunkLengthInSeconds,
      forSeamlessAacConcatenation
    },
    frameCount: framesToRender.length
  };
}, "innerRenderFrames");
var internalRenderFramesRaw = /* @__PURE__ */ __name(({
  browserExecutable,
  cancelSignal,
  chromiumOptions,
  composition,
  concurrency,
  envVariables,
  everyNthFrame,
  frameRange,
  imageFormat,
  indent,
  jpegQuality,
  muted,
  onBrowserLog,
  onDownload,
  onFrameBuffer,
  onFrameUpdate,
  onStart,
  outputDir,
  port,
  puppeteerInstance,
  scale,
  server,
  timeoutInMilliseconds,
  logLevel,
  webpackBundleOrServeUrl,
  serializedInputPropsWithCustomSchema,
  serializedResolvedPropsWithCustomSchema,
  offthreadVideoCacheSizeInBytes,
  parallelEncodingEnabled,
  binariesDirectory,
  forSeamlessAacConcatenation,
  compositionStart,
  onBrowserDownload,
  onArtifact,
  chromeMode,
  offthreadVideoThreads,
  imageSequencePattern,
  mediaCacheSizeInBytes,
  onLog,
  sampleRate
}) => {
  validateDimension(composition.height, "height", "in the `config` object passed to `renderFrames()`");
  validateDimension(composition.width, "width", "in the `config` object passed to `renderFrames()`");
  validateFps(composition.fps, "in the `config` object of `renderFrames()`", false);
  validateDurationInFrames(composition.durationInFrames, {
    component: "in the `config` object passed to `renderFrames()`",
    allowFloats: false
  });
  validateJpegQuality(jpegQuality);
  validateScale(scale);
  const makeBrowser = /* @__PURE__ */ __name(() => internalOpenBrowser({
    browser: DEFAULT_BROWSER,
    browserExecutable,
    chromiumOptions,
    forceDeviceScaleFactor: scale,
    indent,
    viewport: null,
    logLevel,
    onBrowserDownload,
    chromeMode
  }), "makeBrowser");
  const browserInstance = puppeteerInstance ?? makeBrowser();
  const resolvedConcurrency = resolveConcurrency(concurrency);
  const openedPages = [];
  return new Promise((resolve22, reject) => {
    const cleanup = [];
    const onError = /* @__PURE__ */ __name((err) => {
      reject(err);
    }, "onError");
    Promise.race([
      new Promise((_, rej) => {
        cancelSignal?.(() => {
          rej(new Error(cancelErrorMessages.renderFrames));
        });
      }),
      Promise.all([
        makeOrReuseServer(server, {
          webpackConfigOrServeUrl: webpackBundleOrServeUrl,
          port,
          remotionRoot: findRemotionRoot(),
          offthreadVideoThreads: offthreadVideoThreads ?? DEFAULT_RENDER_FRAMES_OFFTHREAD_VIDEO_THREADS,
          logLevel,
          indent,
          offthreadVideoCacheSizeInBytes,
          binariesDirectory,
          forceIPv4: false,
          sampleRate
        }, {
          onDownload
        }),
        browserInstance
      ]).then(([{ server: openedServer, cleanupServer }, pInstance]) => {
        const { serveUrl, offthreadPort, sourceMap, downloadMap } = openedServer;
        const browserReplacer = handleBrowserCrash(pInstance, logLevel, indent);
        const cycle = cycleBrowserTabs({
          puppeteerInstance: browserReplacer,
          concurrency: resolvedConcurrency,
          logLevel,
          indent
        });
        cleanup.push(() => {
          cycle.stopCycling();
          return Promise.resolve();
        });
        cleanup.push(() => cleanupServer(false));
        return innerRenderFrames({
          onError,
          pagesArray: openedPages,
          serveUrl,
          composition,
          resolvedConcurrency,
          onDownload,
          proxyPort: offthreadPort,
          makeBrowser,
          browserReplacer,
          sourceMapGetter: sourceMap,
          downloadMap,
          cancelSignal,
          envVariables,
          everyNthFrame,
          frameRange,
          imageFormat,
          jpegQuality,
          muted,
          onBrowserLog,
          onFrameBuffer,
          onFrameUpdate,
          onStart,
          outputDir,
          scale,
          timeoutInMilliseconds,
          logLevel,
          indent,
          serializedInputPropsWithCustomSchema,
          serializedResolvedPropsWithCustomSchema,
          parallelEncodingEnabled,
          binariesDirectory,
          forSeamlessAacConcatenation,
          compositionStart,
          onBrowserDownload,
          onArtifact,
          chromeMode,
          offthreadVideoThreads,
          imageSequencePattern,
          mediaCacheSizeInBytes,
          onLog,
          darkMode: chromiumOptions.darkMode ?? false,
          sampleRate
        });
      })
    ]).then((res) => {
      server?.compositor.executeCommand("CloseAllVideos", {}).then(() => {
        Log.verbose({ indent, logLevel, tag: "compositor" }, "Freed memory from compositor");
      }).catch((err) => {
        Log.verbose({ indent, logLevel }, "Could not close compositor", err);
      });
      return resolve22(res);
    }).catch((err) => reject(err)).finally(() => {
      if (puppeteerInstance) {
        Promise.all(openedPages.map((p) => p.close())).catch((err) => {
          if (isTargetClosedErr(err)) {
            return;
          }
          Log.error({ indent, logLevel }, "Unable to close browser tab", err);
        });
      } else {
        Promise.resolve(browserInstance).then((instance) => {
          return instance.close({ silent: true });
        }).catch((err) => {
          if (!err?.message.includes("Target closed")) {
            Log.error({ indent, logLevel }, "Unable to close browser", err);
          }
        });
      }
      cleanup.forEach((c) => {
        c();
      });
    });
  });
}, "internalRenderFramesRaw");
var internalRenderFrames = wrapWithErrorHandling(internalRenderFramesRaw);
var renderFrames = /* @__PURE__ */ __name((options) => {
  const {
    composition,
    inputProps,
    onFrameUpdate,
    onStart,
    outputDir,
    serveUrl,
    browserExecutable,
    cancelSignal,
    chromiumOptions,
    concurrency,
    dumpBrowserLogs,
    envVariables,
    everyNthFrame,
    frameRange,
    imageFormat,
    jpegQuality,
    muted,
    onBrowserLog,
    onDownload,
    onFrameBuffer,
    port,
    puppeteerInstance,
    scale,
    timeoutInMilliseconds,
    verbose,
    quality,
    logLevel: passedLogLevel,
    offthreadVideoCacheSizeInBytes,
    binariesDirectory,
    onBrowserDownload,
    onArtifact,
    chromeMode,
    offthreadVideoThreads,
    imageSequencePattern,
    mediaCacheSizeInBytes,
    sampleRate
  } = options;
  if (!composition) {
    throw new Error("No `composition` option has been specified for renderFrames()");
  }
  if (typeof jpegQuality !== "undefined" && imageFormat !== "jpeg") {
    throw new Error("You can only pass the `quality` option if `imageFormat` is 'jpeg'.");
  }
  const logLevel = verbose || dumpBrowserLogs ? "verbose" : passedLogLevel ?? "info";
  const indent = false;
  if (quality) {
    Log.warn({ indent, logLevel }, "Passing `quality()` to `renderStill` is deprecated. Use `jpegQuality` instead.");
  }
  return internalRenderFrames({
    browserExecutable: browserExecutable ?? null,
    cancelSignal,
    chromiumOptions: chromiumOptions ?? {},
    composition,
    concurrency: concurrency ?? null,
    envVariables: envVariables ?? {},
    everyNthFrame: everyNthFrame ?? 1,
    frameRange: frameRange ?? null,
    imageFormat: imageFormat ?? "jpeg",
    indent,
    jpegQuality: jpegQuality ?? DEFAULT_JPEG_QUALITY,
    onDownload: onDownload ?? null,
    serializedInputPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: inputProps ?? {}
    }).serializedString,
    serializedResolvedPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: composition.props
    }).serializedString,
    puppeteerInstance,
    muted: muted ?? false,
    onBrowserLog: onBrowserLog ?? null,
    onFrameBuffer: onFrameBuffer ?? null,
    onFrameUpdate,
    onStart,
    outputDir,
    port: port ?? null,
    scale: scale ?? 1,
    logLevel,
    timeoutInMilliseconds: timeoutInMilliseconds ?? DEFAULT_TIMEOUT,
    webpackBundleOrServeUrl: serveUrl,
    server: void 0,
    offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
    parallelEncodingEnabled: false,
    binariesDirectory: binariesDirectory ?? null,
    compositionStart: 0,
    forSeamlessAacConcatenation: false,
    onBrowserDownload: onBrowserDownload ?? defaultBrowserDownloadProgress({ indent, logLevel, api: "renderFrames()" }),
    onArtifact: onArtifact ?? null,
    chromeMode: chromeMode ?? "headless-shell",
    offthreadVideoThreads: offthreadVideoThreads ?? null,
    imageSequencePattern: imageSequencePattern ?? null,
    mediaCacheSizeInBytes: mediaCacheSizeInBytes ?? null,
    onLog: defaultOnLog,
    sampleRate: sampleRate ?? composition.defaultSampleRate ?? 48e3
  });
}, "renderFrames");
var defaultCrfMap = {
  h264: 18,
  h265: 23,
  vp8: 9,
  vp9: 28,
  av1: 30,
  prores: null,
  gif: null,
  "h264-mkv": 18,
  "h264-ts": 18,
  aac: null,
  mp3: null,
  wav: null
};
var getDefaultCrfForCodec = /* @__PURE__ */ __name((codec) => {
  const val = defaultCrfMap[codec];
  if (val === void 0) {
    throw new TypeError(`Got unexpected codec "${codec}"`);
  }
  return val;
}, "getDefaultCrfForCodec");
var crfRanges = {
  h264: [1, 51],
  h265: [0, 51],
  vp8: [4, 63],
  vp9: [0, 63],
  av1: [0, 63],
  prores: [0, 0],
  gif: [0, 0],
  "h264-mkv": [1, 51],
  "h264-ts": [1, 51],
  aac: [0, 0],
  mp3: [0, 0],
  wav: [0, 0]
};
var getValidCrfRanges = /* @__PURE__ */ __name((codec) => {
  const val = crfRanges[codec];
  if (val === void 0) {
    throw new TypeError(`Got unexpected codec "${codec}"`);
  }
  return val;
}, "getValidCrfRanges");
var validateQualitySettings = /* @__PURE__ */ __name(({
  codec,
  crf,
  videoBitrate,
  encodingMaxRate,
  encodingBufferSize,
  hardwareAcceleration
}) => {
  if (crf && videoBitrate) {
    throw new Error('"crf" and "videoBitrate" can not both be set. Choose one of either.');
  }
  if (crf && hardwareAcceleration === "required") {
    throw new Error('"crf" option is not supported with hardware acceleration');
  }
  if (encodingMaxRate && !encodingBufferSize) {
    throw new Error('"encodingMaxRate" can not be set without also setting "encodingBufferSize".');
  }
  const bufSizeArray = encodingBufferSize ? ["-bufsize", encodingBufferSize] : [];
  const maxRateArray = encodingMaxRate ? ["-maxrate", encodingMaxRate] : [];
  if (videoBitrate) {
    if (codec === "prores") {
      console.warn("ProRes does not support videoBitrate. Ignoring.");
      return [];
    }
    if (isAudioCodec(codec)) {
      console.warn(`${codec} does not support videoBitrate. Ignoring.`);
      return [];
    }
    return ["-b:v", videoBitrate, ...bufSizeArray, ...maxRateArray];
  }
  if (crf === null || typeof crf === "undefined") {
    const actualCrf = getDefaultCrfForCodec(codec);
    if (actualCrf === null) {
      return [...bufSizeArray, ...maxRateArray];
    }
    return ["-crf", String(actualCrf), ...bufSizeArray, ...maxRateArray];
  }
  if (typeof crf !== "number") {
    throw new TypeError("Expected CRF to be a number, but is " + JSON.stringify(crf));
  }
  const range = getValidCrfRanges(codec);
  if (crf === 0 && (codec === "h264" || codec === "h264-mkv" || codec === "h264-ts")) {
    throw new TypeError("Setting the CRF to 0 with a H264 codec is not supported anymore because of it's inconsistencies between platforms. Videos with CRF 0 cannot be played on iOS/macOS. 0 is a extreme value with inefficient settings which you probably do not want. Set CRF to a higher value to fix this error.");
  }
  if (crf < range[0] || crf > range[1]) {
    if (range[0] === 0 && range[1] === 0) {
      throw new TypeError(`The "${codec}" codec does not support the --crf option.`);
    }
    throw new TypeError(`CRF must be between ${range[0]} and ${range[1]} for codec ${codec}. Passed: ${crf}`);
  }
  if (codec === "prores") {
    console.warn('ProRes does not support the "crf" option. Ignoring.');
    return [];
  }
  if (isAudioCodec(codec)) {
    console.warn(`${codec} does not support the "crf" option. Ignoring.`);
    return [];
  }
  return ["-crf", String(crf), ...bufSizeArray, ...maxRateArray];
}, "validateQualitySettings");
var support = {
  "h264-mkv": {
    audio: true,
    video: true
  },
  aac: {
    audio: true,
    video: false
  },
  gif: {
    video: true,
    audio: false
  },
  h264: {
    video: true,
    audio: true
  },
  "h264-ts": {
    video: true,
    audio: true
  },
  h265: {
    video: true,
    audio: true
  },
  av1: {
    video: true,
    audio: true
  },
  mp3: {
    audio: true,
    video: false
  },
  prores: {
    audio: true,
    video: true
  },
  vp8: {
    audio: true,
    video: true
  },
  vp9: {
    audio: true,
    video: true
  },
  wav: {
    audio: true,
    video: false
  }
};
var codecSupportsMedia = /* @__PURE__ */ __name((codec) => {
  return support[codec];
}, "codecSupportsMedia");
var ensureFramesInOrder = /* @__PURE__ */ __name((framesToRender) => {
  let [frameToStitch] = framesToRender;
  const finalFrame = framesToRender[framesToRender.length - 1];
  let waiters = [];
  const resolveWaiters = /* @__PURE__ */ __name(() => {
    for (const waiter of waiters.slice(0)) {
      if (frameToStitch === waiter.forFrame) {
        waiter.resolve();
        waiters = waiters.filter((w) => w.id !== waiter.id);
      }
    }
  }, "resolveWaiters");
  const waitForRightTimeOfFrameToBeInserted = /* @__PURE__ */ __name((frameToBe) => {
    return new Promise((resolve22) => {
      waiters.push({
        id: String(Math.random()),
        forFrame: frameToBe,
        resolve: resolve22
      });
      resolveWaiters();
    });
  }, "waitForRightTimeOfFrameToBeInserted");
  const setFrameToStitch = /* @__PURE__ */ __name((f) => {
    frameToStitch = f;
    resolveWaiters();
  }, "setFrameToStitch");
  const waitForFinish = /* @__PURE__ */ __name(async () => {
    await waitForRightTimeOfFrameToBeInserted(finalFrame + 1);
  }, "waitForFinish");
  return {
    waitForRightTimeOfFrameToBeInserted,
    setFrameToStitch,
    waitForFinish
  };
}, "ensureFramesInOrder");
var validV4ColorSpaces = ["default", "bt601", "bt709", "bt2020-ncl"];
var validV5ColorSpaces = ["bt601", "bt709", "bt2020-ncl"];
var validColorSpaces = NoReactInternals.ENABLE_V5_BREAKING_CHANGES ? validV5ColorSpaces : validV4ColorSpaces;
var DEFAULT_COLOR_SPACE = NoReactInternals.ENABLE_V5_BREAKING_CHANGES ? "bt709" : "default";
var x264PresetOptions = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
  "veryslow",
  "placebo"
];
var validateSelectedCodecAndPresetCombination = /* @__PURE__ */ __name(({
  codec,
  x264Preset
}) => {
  if (x264Preset !== null && codec !== "h264" && codec !== "h264-mkv" && codec !== "h264-ts") {
    throw new TypeError(`You have set a x264 preset but the codec is "${codec}". Set the codec to "h264" or remove the Preset profile.`);
  }
  if (x264Preset !== null && !x264PresetOptions.includes(x264Preset)) {
    throw new TypeError(`The Preset profile "${x264Preset}" is not valid. Valid options are ${x264PresetOptions.map((p) => `"${p}"`).join(", ")}`);
  }
}, "validateSelectedCodecAndPresetCombination");
var DEFAULT_OVERWRITE = true;
var hasSpecifiedUnsupportedHardwareQualifySettings = /* @__PURE__ */ __name(({
  encodingMaxRate,
  encodingBufferSize,
  crf
}) => {
  if (encodingBufferSize !== null) {
    return "encodingBufferSize";
  }
  if (encodingMaxRate !== null) {
    return "encodingMaxRate";
  }
  if (crf !== null && typeof crf !== "undefined") {
    return "crf";
  }
  return null;
}, "hasSpecifiedUnsupportedHardwareQualifySettings");
var getCodecName = /* @__PURE__ */ __name(({
  codec,
  encodingMaxRate,
  encodingBufferSize,
  crf,
  hardwareAcceleration,
  logLevel,
  indent
}) => {
  const preferredHwAcceleration = hardwareAcceleration === "required" || hardwareAcceleration === "if-possible";
  const unsupportedQualityOption = hasSpecifiedUnsupportedHardwareQualifySettings({
    encodingMaxRate,
    encodingBufferSize,
    crf
  });
  if (hardwareAcceleration === "required" && unsupportedQualityOption) {
    throw new Error(`When using hardware accelerated encoding, the option "${unsupportedQualityOption}" with hardware acceleration is not supported. Disable hardware accelerated encoding or use "if-possible" instead.`);
  }
  const warnAboutDisabledHardwareAcceleration = /* @__PURE__ */ __name(() => {
    if (hardwareAcceleration === "if-possible" && unsupportedQualityOption) {
      Log.warn({ indent, logLevel }, `${indent ? "" : `
`}Hardware accelerated encoding disabled - "${unsupportedQualityOption}" option is not supported with hardware acceleration`);
    }
  }, "warnAboutDisabledHardwareAcceleration");
  if (codec === "prores") {
    if (preferredHwAcceleration && process.platform === "darwin" && !unsupportedQualityOption) {
      return { encoderName: "prores_videotoolbox", hardwareAccelerated: true };
    }
    warnAboutDisabledHardwareAcceleration();
    return { encoderName: "prores_ks", hardwareAccelerated: false };
  }
  if (codec === "h264") {
    if (preferredHwAcceleration && process.platform === "darwin" && !unsupportedQualityOption) {
      return { encoderName: "h264_videotoolbox", hardwareAccelerated: true };
    }
    warnAboutDisabledHardwareAcceleration();
    return { encoderName: "libx264", hardwareAccelerated: false };
  }
  if (codec === "h265") {
    if (preferredHwAcceleration && process.platform === "darwin" && !unsupportedQualityOption) {
      return { encoderName: "hevc_videotoolbox", hardwareAccelerated: true };
    }
    warnAboutDisabledHardwareAcceleration();
    return { encoderName: "libx265", hardwareAccelerated: false };
  }
  if (codec === "vp8") {
    return { encoderName: "libvpx", hardwareAccelerated: false };
  }
  if (codec === "vp9") {
    return { encoderName: "libvpx-vp9", hardwareAccelerated: false };
  }
  if (codec === "av1") {
    Log.warn({ indent, logLevel }, "AV1 encoding is significantly slower than other codecs.");
    return { encoderName: "libaom-av1", hardwareAccelerated: false };
  }
  if (codec === "gif") {
    return { encoderName: "gif", hardwareAccelerated: false };
  }
  if (codec === "mp3") {
    return null;
  }
  if (codec === "aac") {
    return null;
  }
  if (codec === "wav") {
    return null;
  }
  if (codec === "h264-mkv") {
    return { encoderName: "libx264", hardwareAccelerated: false };
  }
  if (codec === "h264-ts") {
    return { encoderName: "libx264", hardwareAccelerated: false };
  }
  throw new Error(`Could not get codec for ${codec}`);
}, "getCodecName");
var firstEncodingStepOnly = /* @__PURE__ */ __name(({
  hasPreencoded,
  proResProfileName,
  pixelFormat,
  x264Preset,
  codec,
  crf,
  videoBitrate,
  encodingMaxRate,
  encodingBufferSize,
  hardwareAcceleration
}) => {
  if (hasPreencoded || codec === "gif") {
    return [];
  }
  return [
    proResProfileName ? ["-profile:v", proResProfileName] : null,
    ["-pix_fmt", pixelFormat],
    pixelFormat === "yuva420p" ? ["-auto-alt-ref", "0"] : null,
    x264Preset ? ["-preset", x264Preset] : null,
    ["-video_track_timescale", "90000"],
    validateQualitySettings({
      crf,
      videoBitrate,
      codec,
      encodingMaxRate,
      encodingBufferSize,
      hardwareAcceleration
    })
  ].filter(truthy);
}, "firstEncodingStepOnly");
var generateFfmpegArgs = /* @__PURE__ */ __name(({
  hasPreencoded,
  proResProfileName,
  pixelFormat,
  x264Preset,
  codec,
  crf,
  videoBitrate,
  encodingMaxRate,
  encodingBufferSize,
  colorSpace,
  hardwareAcceleration,
  indent,
  logLevel
}) => {
  const encoderSettings = getCodecName({
    codec,
    encodingMaxRate,
    encodingBufferSize,
    crf,
    hardwareAcceleration,
    indent,
    logLevel
  });
  if (encoderSettings === null) {
    throw new TypeError(`encoderSettings is null: ${JSON.stringify(codec)} (hwaccel = ${hardwareAcceleration})`);
  }
  const { encoderName, hardwareAccelerated } = encoderSettings;
  if (!hardwareAccelerated && hardwareAcceleration === "required") {
    throw new Error(`Codec ${codec} does not support hardware acceleration on ${process.platform}, but "hardwareAcceleration" is set to "required"`);
  }
  Log.verbose({ indent, logLevel, tag: "stitchFramesToVideo()" }, `Encoder: ${encoderName}, hardware accelerated: ${hardwareAccelerated}`);
  const resolvedColorSpace = codec === "gif" ? "bt601" : colorSpace ?? DEFAULT_COLOR_SPACE;
  const colorSpaceOptions = resolvedColorSpace === "bt709" ? [
    ["-colorspace:v", "bt709"],
    ["-color_primaries:v", "bt709"],
    ["-color_trc:v", "bt709"],
    ["-color_range", "tv"],
    hasPreencoded ? [] : ["-vf", "zscale=matrix=709:matrixin=709:range=limited"]
  ] : resolvedColorSpace === "bt2020-ncl" ? [
    ["-colorspace:v", "bt2020nc"],
    ["-color_primaries:v", "bt2020"],
    ["-color_trc:v", "arib-std-b67"],
    ["-color_range", "tv"],
    hasPreencoded ? [] : [
      "-vf",
      "zscale=matrix=2020_ncl:matrixin=2020_ncl:range=limited"
    ]
  ] : [];
  return [
    ["-c:v", hasPreencoded ? "copy" : encoderName],
    codec === "h264-ts" ? ["-f", "mpegts"] : null,
    ...colorSpaceOptions,
    ...firstEncodingStepOnly({
      codec,
      crf,
      hasPreencoded,
      pixelFormat,
      proResProfileName,
      videoBitrate,
      encodingMaxRate,
      encodingBufferSize,
      x264Preset,
      hardwareAcceleration
    })
  ].filter(truthy);
}, "generateFfmpegArgs");
var getProResProfileName = /* @__PURE__ */ __name((codec, proResProfile) => {
  if (codec !== "prores") {
    return null;
  }
  switch (proResProfile) {
    case "4444-xq":
      return "5";
    case "4444":
      return "4";
    case "hq":
      return "3";
    case "standard":
      return "2";
    case "light":
      return "1";
    case "proxy":
      return "0";
    default:
      return "3";
  }
}, "getProResProfileName");
var validateEvenDimensionsWithCodec = /* @__PURE__ */ __name(({
  width,
  height,
  codec,
  scale,
  wantsImageSequence,
  indent,
  logLevel
}) => {
  if (wantsImageSequence) {
    return {
      actualWidth: width,
      actualHeight: height
    };
  }
  if (codec !== "h264-mkv" && codec !== "h264" && codec !== "h265" && codec !== "av1" && codec !== "h264-ts") {
    return {
      actualWidth: width,
      actualHeight: height
    };
  }
  let heightEvenDimensions = height;
  while (Math.round(heightEvenDimensions * scale) % 2 !== 0) {
    heightEvenDimensions--;
  }
  let widthEvenDimensions = width;
  while (Math.round(widthEvenDimensions * scale) % 2 !== 0) {
    widthEvenDimensions--;
  }
  if (widthEvenDimensions !== width) {
    Log.verbose({ indent, logLevel }, `Rounding width to an even number from ${width} to ${widthEvenDimensions}`);
  }
  if (heightEvenDimensions !== height) {
    Log.verbose({ indent, logLevel }, `Rounding height to an even number from ${height} to ${heightEvenDimensions}`);
  }
  return {
    actualWidth: widthEvenDimensions,
    actualHeight: heightEvenDimensions
  };
}, "validateEvenDimensionsWithCodec");
var prespawnFfmpeg = /* @__PURE__ */ __name((options) => {
  validateDimension(options.height, "height", "passed to `stitchFramesToVideo()`");
  validateDimension(options.width, "width", "passed to `stitchFramesToVideo()`");
  const codec = options.codec ?? DEFAULT_CODEC;
  validateFps(options.fps, "in `stitchFramesToVideo()`", codec === "gif");
  validateEvenDimensionsWithCodec({
    width: options.width,
    height: options.height,
    codec,
    scale: 1,
    wantsImageSequence: false,
    indent: options.indent,
    logLevel: options.logLevel
  });
  const pixelFormat = options.pixelFormat ?? DEFAULT_PIXEL_FORMAT;
  const proResProfileName = getProResProfileName(codec, options.proResProfile);
  validateSelectedPixelFormatAndCodecCombination(pixelFormat, codec);
  const ffmpegArgs = [
    ["-r", options.fps],
    ...[
      ["-f", "image2pipe"],
      ["-s", `${options.width}x${options.height}`],
      ["-vcodec", options.imageFormat === "jpeg" ? "mjpeg" : "png"],
      ["-i", "-"]
    ],
    ...generateFfmpegArgs({
      hasPreencoded: false,
      proResProfileName,
      pixelFormat,
      x264Preset: options.x264Preset,
      codec,
      crf: options.crf,
      videoBitrate: options.videoBitrate,
      encodingMaxRate: options.encodingMaxRate,
      encodingBufferSize: options.encodingBufferSize,
      colorSpace: options.colorSpace,
      hardwareAcceleration: options.hardwareAcceleration,
      indent: options.indent,
      logLevel: options.logLevel
    }),
    "-y",
    options.outputLocation
  ];
  Log.verbose({
    indent: options.indent,
    logLevel: options.logLevel,
    tag: "prespawnFfmpeg()"
  }, "Generated FFMPEG command:");
  Log.verbose({
    indent: options.indent,
    logLevel: options.logLevel,
    tag: "prespawnFfmpeg()"
  }, ffmpegArgs.join(" "));
  const ffmpegString = ffmpegArgs.flat(2).filter(Boolean);
  const finalFfmpegString = options.ffmpegOverride ? options.ffmpegOverride({ type: "pre-stitcher", args: ffmpegString }) : ffmpegString;
  const task = callFf({
    bin: "ffmpeg",
    args: finalFfmpegString,
    indent: options.indent,
    logLevel: options.logLevel,
    binariesDirectory: options.binariesDirectory,
    cancelSignal: options.signal
  });
  let ffmpegOutput = "";
  task.stderr?.on("data", (data) => {
    const str = data.toString();
    ffmpegOutput += str;
    if (options.onProgress) {
      const parsed = parseFfmpegProgress(str, options.fps);
      if (parsed !== void 0) {
        options.onProgress(parsed);
      }
    }
  });
  let exitCode = {
    type: "running"
  };
  task.on("exit", (code, signal) => {
    if (typeof code === "number" && code > 0 || signal) {
      exitCode = {
        type: "quit-with-error",
        exitCode: code ?? 1,
        signal: signal ?? null,
        stderr: ffmpegOutput
      };
    } else {
      exitCode = {
        type: "quit-successfully",
        stderr: ffmpegOutput
      };
    }
  });
  return { task, getLogs: /* @__PURE__ */ __name(() => ffmpegOutput, "getLogs"), getExitStatus: /* @__PURE__ */ __name(() => exitCode, "getExitStatus") };
}, "prespawnFfmpeg");
var estimateMemoryUsageForPrestitcher = /* @__PURE__ */ __name(({
  width,
  height
}) => {
  const memoryUsageFor4K = 1e9;
  const memoryUsageOfPixel = memoryUsageFor4K / 1e6;
  return memoryUsageOfPixel * width * height;
}, "estimateMemoryUsageForPrestitcher");
var shouldUseParallelEncoding = /* @__PURE__ */ __name(({
  width,
  height,
  logLevel
}) => {
  const freeMemory = getAvailableMemory(logLevel);
  const estimatedUsage = estimateMemoryUsageForPrestitcher({
    height,
    width
  });
  const hasEnoughMemory = freeMemory - estimatedUsage > 2e9 && estimatedUsage / freeMemory < 0.5;
  return {
    hasEnoughMemory,
    freeMemory,
    estimatedUsage
  };
}, "shouldUseParallelEncoding");
var validateSelectedCodecAndProResCombination = /* @__PURE__ */ __name(({
  codec,
  proResProfile
}) => {
  if (typeof proResProfile !== "undefined" && codec !== "prores") {
    throw new TypeError(`You have set a ProRes profile but the codec is "${codec}". Set the codec to "prores" or remove the ProRes profile.`);
  }
  if (proResProfile !== void 0 && !NoReactInternals.proResProfileOptions.includes(proResProfile)) {
    throw new TypeError(`The ProRes profile "${proResProfile}" is not valid. Valid options are ${NoReactInternals.proResProfileOptions.map((p) => `"${p}"`).join(", ")}`);
  }
}, "validateSelectedCodecAndProResCombination");
var convertNumberOfGifLoopsToFfmpegSyntax = /* @__PURE__ */ __name((loops) => {
  if (loops === null) {
    return "0";
  }
  if (loops === 0) {
    return "-1";
  }
  return String(loops);
}, "convertNumberOfGifLoopsToFfmpegSyntax");
var resolveAssetSrc = /* @__PURE__ */ __name((src) => {
  if (!src.startsWith("file:")) {
    return src;
  }
  const { protocol } = new URL(src);
  if (protocol === "file:")
    return url.fileURLToPath(src);
  throw new TypeError(`Unexpected src ${src}`);
}, "resolveAssetSrc");
var flattenVolumeArray = /* @__PURE__ */ __name((volume) => {
  if (typeof volume === "number") {
    return volume;
  }
  if (volume.length === 0) {
    throw new TypeError("Volume array must have at least 1 number");
  }
  if (new Set(volume).size === 1) {
    return volume[0];
  }
  return volume;
}, "flattenVolumeArray");
var convertAssetToFlattenedVolume = /* @__PURE__ */ __name((asset) => {
  return {
    ...asset,
    volume: flattenVolumeArray(asset.volume)
  };
}, "convertAssetToFlattenedVolume");
var uncompressMediaAsset = /* @__PURE__ */ __name((allRenderAssets, assetToUncompress) => {
  const isCompressed = assetToUncompress.src.match(/same-as-(.*)-([0-9.]+)$/);
  if (!isCompressed) {
    return assetToUncompress;
  }
  const [, id, frame] = isCompressed;
  const assetToFill = allRenderAssets.find((a) => a.id === id && String(a.frame) === frame);
  if (!assetToFill) {
    console.log("List of assets:");
    console.log(allRenderAssets);
    throw new TypeError(`Cannot uncompress asset, asset list seems corrupt. Please file a bug in the Remotion repo with the debug information above.`);
  }
  return {
    ...assetToUncompress,
    src: assetToFill.src
  };
}, "uncompressMediaAsset");
var areEqual = /* @__PURE__ */ __name((a, b) => {
  return a.id === b.id;
}, "areEqual");
var findFrom = /* @__PURE__ */ __name((target, renderAsset) => {
  const index = target.findIndex((a) => areEqual(a, renderAsset));
  if (index === -1) {
    return false;
  }
  target.splice(index, 1);
  return true;
}, "findFrom");
var copyAndDeduplicateAssets = /* @__PURE__ */ __name((renderAssets) => {
  const onlyAudioAndVideo = onlyAudioAndVideoAssets(renderAssets);
  const deduplicated = [];
  for (const renderAsset of onlyAudioAndVideo) {
    if (!deduplicated.find((d) => d.id === renderAsset.id)) {
      deduplicated.push(renderAsset);
    }
  }
  return deduplicated;
}, "copyAndDeduplicateAssets");
var calculateAssetPositions = /* @__PURE__ */ __name((frames) => {
  const assets = [];
  const flattened = frames.flat(1);
  for (let frame = 0; frame < frames.length; frame++) {
    const prev = copyAndDeduplicateAssets(frames[frame - 1] ?? []);
    const current = copyAndDeduplicateAssets(frames[frame]);
    const next = copyAndDeduplicateAssets(frames[frame + 1] ?? []);
    for (const asset of current) {
      if (!findFrom(prev, asset)) {
        assets.push({
          src: resolveAssetSrc(uncompressMediaAsset(flattened, asset).src),
          type: asset.type,
          duration: null,
          id: asset.id,
          startInVideo: frame,
          trimLeft: asset.mediaFrame,
          volume: [],
          playbackRate: asset.playbackRate,
          toneFrequency: asset.toneFrequency,
          audioStartFrame: asset.audioStartFrame,
          audioStreamIndex: asset.audioStreamIndex
        });
      }
      const found = assets.find((a) => a.duration === null && areEqual(a, asset));
      if (!found)
        throw new Error("something wrong");
      if (!findFrom(next, asset)) {
        found.duration = frame - found.startInVideo + 1;
      }
      found.volume = [...found.volume, asset.volume];
    }
  }
  for (const asset of assets) {
    if (asset.duration === null) {
      throw new Error("duration is unexpectedly null");
    }
  }
  return assets.map((a) => convertAssetToFlattenedVolume(a));
}, "calculateAssetPositions");
var chunk = /* @__PURE__ */ __name((input, size) => {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0 ? [...arr, [item]] : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
}, "chunk");
var convertAssetsToFileUrls = /* @__PURE__ */ __name(async ({
  assets,
  onDownload,
  downloadMap,
  indent,
  logLevel,
  binariesDirectory
}) => {
  const chunks = chunk(assets, 1e3);
  const results = [];
  for (const ch of chunks) {
    const assetPromises = ch.map((frame) => {
      const frameAssetPromises = frame.audioAndVideoAssets.map((a) => {
        return downloadAndMapAssetsToFileUrl({
          renderAsset: a,
          onDownload,
          downloadMap,
          indent,
          logLevel,
          binariesDirectory,
          cancelSignalForAudioAnalysis: void 0,
          shouldAnalyzeAudioImmediately: true
        });
      });
      return Promise.all(frameAssetPromises);
    });
    const result = await Promise.all(assetPromises);
    results.push(result);
  }
  return results.flat(1);
}, "convertAssetsToFileUrls");
var compressAudio = /* @__PURE__ */ __name(async ({
  audioCodec,
  outName,
  binariesDirectory,
  indent,
  logLevel,
  audioBitrate,
  cancelSignal,
  inName,
  onProgress,
  chunkLengthInSeconds,
  fps
}) => {
  if (audioCodec === "pcm-16") {
    cpSync(inName, outName);
    return onProgress(1);
  }
  const args = [
    ["-hide_banner"],
    ["-i", inName],
    ["-c:a", mapAudioCodecToFfmpegAudioCodecName(audioCodec)],
    audioCodec === "aac" ? ["-f", "adts"] : null,
    audioCodec ? ["-b:a", audioBitrate || "320k"] : null,
    audioCodec === "aac" ? "-cutoff" : null,
    audioCodec === "aac" ? "18000" : null,
    ["-y", outName]
  ].filter(truthy).flat(2);
  const task = callFf({
    bin: "ffmpeg",
    args,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
  task.stderr?.on("data", (data) => {
    const utf8 = data.toString("utf8");
    const parsed = parseFfmpegProgress(utf8, fps);
    if (parsed !== void 0) {
      onProgress(parsed / (chunkLengthInSeconds * fps));
    }
  });
  await task;
}, "compressAudio");
var chunk2 = /* @__PURE__ */ __name((input, size) => {
  return input.reduce((arr, item, idx) => {
    return idx % size === 0 ? [...arr, [item]] : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]];
  }, []);
}, "chunk2");
var OUTPUT_FILTER_NAME = "outputaudio";
var createFfmpegMergeFilter = /* @__PURE__ */ __name(({
  inputs
}) => {
  const pads = inputs.map((input, index) => {
    const filters = [
      input.filter.pad_start ? input.filter.pad_start : null,
      input.filter.pad_end ? input.filter.pad_end : null,
      "acopy"
    ];
    return `[${index}:a]${filters.filter(truthy).join(",")}[padded${index}]`;
  });
  return [
    ...pads,
    `${new Array(inputs.length).fill(true).map((_, i) => {
      return `[padded${i}]`;
    }).join("")}amix=inputs=${inputs.length}:dropout_transition=0:normalize=0[${OUTPUT_FILTER_NAME}]`
  ].join(";");
}, "createFfmpegMergeFilter");
var makeFfmpegFilterFile = /* @__PURE__ */ __name((complexFilter, downloadMap) => {
  if (complexFilter.filter === null) {
    return {
      file: null,
      cleanup: /* @__PURE__ */ __name(() => {
        return;
      }, "cleanup")
    };
  }
  return makeFfmpegFilterFileStr(complexFilter.filter, downloadMap);
}, "makeFfmpegFilterFile");
var makeFfmpegFilterFileStr = /* @__PURE__ */ __name(async (complexFilter, downloadMap) => {
  const random2 = Math.random().toString().replace(".", "");
  const filterFile = path22.join(downloadMap.complexFilter, "complex-filter-" + random2 + ".txt");
  if (!existsSync5(downloadMap.complexFilter)) {
    fs16.mkdirSync(downloadMap.complexFilter, { recursive: true });
  }
  await fs16.promises.writeFile(filterFile, complexFilter);
  return {
    file: filterFile,
    cleanup: /* @__PURE__ */ __name(() => {
      fs16.unlinkSync(filterFile);
    }, "cleanup")
  };
}, "makeFfmpegFilterFileStr");
var createFfmpegComplexFilter = /* @__PURE__ */ __name(async ({
  filters,
  downloadMap
}) => {
  if (filters.length === 0) {
    return {
      complexFilterFlag: null,
      cleanup: /* @__PURE__ */ __name(() => {
        return;
      }, "cleanup"),
      complexFilter: null
    };
  }
  const complexFilter = createFfmpegMergeFilter({
    inputs: filters
  });
  const { file, cleanup } = await makeFfmpegFilterFileStr(complexFilter, downloadMap);
  return {
    complexFilterFlag: ["-filter_complex_script", file],
    cleanup,
    complexFilter
  };
}, "createFfmpegComplexFilter");
var createSilentAudio = /* @__PURE__ */ __name(async ({
  outName,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  chunkLengthInSeconds,
  sampleRate
}) => {
  await callFf({
    bin: "ffmpeg",
    args: [
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${sampleRate}`,
      "-c:a",
      "pcm_s16le",
      "-t",
      String(chunkLengthInSeconds),
      "-ar",
      String(sampleRate),
      outName
    ],
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
}, "createSilentAudio");
var mergeAudioTrackUnlimited = /* @__PURE__ */ __name(async ({
  outName,
  files,
  downloadMap,
  remotionRoot,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  onProgress,
  fps,
  chunkLengthInSeconds,
  sampleRate
}) => {
  if (files.length === 0) {
    await createSilentAudio({
      outName,
      chunkLengthInSeconds,
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal,
      sampleRate
    });
    onProgress(1);
    return;
  }
  if (files.length >= 32) {
    const chunked = chunk2(files, 10);
    const tempPath = tmpDir("remotion-large-audio-mixing");
    try {
      const partialProgress = new Array(chunked.length).fill(0);
      let finalProgress = 0;
      const callProgress = /* @__PURE__ */ __name(() => {
        const totalProgress = partialProgress.reduce((a, b) => a + b, 0) / chunked.length;
        const combinedProgress = totalProgress * 0.8 + finalProgress * 0.2;
        onProgress(combinedProgress);
      }, "callProgress");
      const chunkNames = await Promise.all(chunked.map(async (chunkFiles, i) => {
        const chunkOutname = path23.join(tempPath, `chunk-${i}.wav`);
        await mergeAudioTrack({
          files: chunkFiles,
          chunkLengthInSeconds,
          outName: chunkOutname,
          downloadMap,
          remotionRoot,
          indent,
          logLevel,
          binariesDirectory,
          cancelSignal,
          onProgress: /* @__PURE__ */ __name((progress) => {
            partialProgress[i] = progress;
            callProgress();
          }, "onProgress"),
          fps,
          sampleRate
        });
        return chunkOutname;
      }));
      await mergeAudioTrack({
        files: chunkNames.map((c) => ({
          filter: {
            pad_end: null,
            pad_start: null
          },
          outName: c
        })),
        outName,
        downloadMap,
        remotionRoot,
        indent,
        logLevel,
        binariesDirectory,
        cancelSignal,
        onProgress: /* @__PURE__ */ __name((progress) => {
          finalProgress = progress;
          callProgress();
        }, "onProgress"),
        fps,
        chunkLengthInSeconds,
        sampleRate
      });
      return;
    } finally {
      deleteDirectory(tempPath);
    }
  }
  const {
    complexFilterFlag: mergeFilter,
    cleanup,
    complexFilter
  } = await createFfmpegComplexFilter({
    filters: files,
    downloadMap
  });
  const args = [
    ["-hide_banner"],
    ...files.map((f) => ["-i", f.outName]),
    mergeFilter,
    ["-c:a", "pcm_s16le"],
    ["-map", `[${OUTPUT_FILTER_NAME}]`],
    ["-y", outName]
  ].filter(truthy).flat(2);
  Log.verbose({ indent, logLevel }, `Merging audio tracks`, "Command:", `ffmpeg ${args.join(" ")}`, "Complex filter script:", complexFilter);
  const task = callFf({
    bin: "ffmpeg",
    args,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
  task.stderr?.on("data", (data) => {
    const utf8 = data.toString("utf8");
    const parsed = parseFfmpegProgress(utf8, fps);
    if (parsed !== void 0) {
      onProgress(parsed / (chunkLengthInSeconds * fps));
    }
  });
  await task;
  onProgress(1);
  cleanup();
}, "mergeAudioTrackUnlimited");
var limit2 = pLimit(3);
var mergeAudioTrack = /* @__PURE__ */ __name((options) => {
  return limit2(mergeAudioTrackUnlimited, options);
}, "mergeAudioTrack");
var calculateATempo = /* @__PURE__ */ __name((playbackRate) => {
  if (playbackRate === 1) {
    return null;
  }
  if (playbackRate >= 0.5 && playbackRate <= 2) {
    return `atempo=${playbackRate.toFixed(5)}`;
  }
  return `${calculateATempo(Math.sqrt(playbackRate))},${calculateATempo(Math.sqrt(playbackRate))}`;
}, "calculateATempo");
var MAX_FFMPEG_STACK_DEPTH = 98;
var roundVolumeToAvoidStackOverflow = /* @__PURE__ */ __name((volume) => {
  return Number((Math.round(volume * (MAX_FFMPEG_STACK_DEPTH - 1)) / (MAX_FFMPEG_STACK_DEPTH - 1)).toFixed(3));
}, "roundVolumeToAvoidStackOverflow");
var FFMPEG_TIME_VARIABLE = "t";
var ffmpegIfOrElse = /* @__PURE__ */ __name((condition, then, elseDo) => {
  return `if(${condition},${then},${elseDo})`;
}, "ffmpegIfOrElse");
var ffmpegIsOneOfFrames = /* @__PURE__ */ __name(({
  frames,
  trimLeft,
  fps
}) => {
  const consecutiveArrays = [];
  for (let i = 0; i < frames.length; i++) {
    const previousFrame = frames[i - 1];
    const frame = frames[i];
    if (previousFrame === void 0 || frame !== previousFrame + 1) {
      consecutiveArrays.push([]);
    }
    consecutiveArrays[consecutiveArrays.length - 1].push(frame);
  }
  return consecutiveArrays.map((f) => {
    const firstFrame = f[0];
    const lastFrame = f[f.length - 1];
    const before = (firstFrame - 0.5) / fps;
    const after = (lastFrame + 0.5) / fps;
    return `between(${FFMPEG_TIME_VARIABLE},${(before + trimLeft).toFixed(4)},${(after + trimLeft).toFixed(4)})`;
  }).join("+");
}, "ffmpegIsOneOfFrames");
var ffmpegBuildVolumeExpression = /* @__PURE__ */ __name(({
  arr,
  delay,
  fps
}) => {
  if (arr.length === 0) {
    throw new Error("Volume array expression should never have length 0");
  }
  if (arr.length === 1) {
    return String(arr[0][0]);
  }
  const [first, ...rest] = arr;
  const [volume, frames] = first;
  return ffmpegIfOrElse(ffmpegIsOneOfFrames({ frames, trimLeft: delay, fps }), String(volume), ffmpegBuildVolumeExpression({ arr: rest, delay, fps }));
}, "ffmpegBuildVolumeExpression");
var ffmpegVolumeExpression = /* @__PURE__ */ __name(({
  volume,
  fps,
  trimLeft
}) => {
  if (typeof volume === "number") {
    return {
      eval: "once",
      value: String(volume)
    };
  }
  if ([...new Set(volume)].length === 1) {
    return ffmpegVolumeExpression({
      volume: volume[0],
      fps,
      trimLeft
    });
  }
  const paddedVolume = [...volume, volume[volume.length - 1]];
  const volumeMap = {};
  paddedVolume.forEach((baseVolume, frame) => {
    const actualVolume = roundVolumeToAvoidStackOverflow(baseVolume);
    if (!volumeMap[actualVolume]) {
      volumeMap[actualVolume] = [];
    }
    volumeMap[actualVolume].push(frame);
  });
  const volumeArray = Object.keys(volumeMap).map((key) => [Number(key), volumeMap[key]]).sort((a, b) => a[1].length - b[1].length);
  const expression = ffmpegBuildVolumeExpression({
    arr: volumeArray,
    delay: trimLeft,
    fps
  });
  return {
    eval: "frame",
    value: `'${expression}'`
  };
}, "ffmpegVolumeExpression");
var getActualTrimLeft = /* @__PURE__ */ __name(({
  fps,
  trimLeftOffset,
  seamless,
  assetDuration,
  audioStartFrame,
  trimLeft,
  playbackRate
}) => {
  const sinceStart = trimLeft - audioStartFrame;
  if (!seamless) {
    return {
      trimLeft: audioStartFrame / fps + sinceStart / fps * playbackRate + trimLeftOffset,
      maxTrim: assetDuration
    };
  }
  if (seamless) {
    return {
      trimLeft: audioStartFrame / fps / playbackRate + sinceStart / fps + trimLeftOffset,
      maxTrim: assetDuration ? assetDuration / playbackRate : null
    };
  }
  throw new Error("This should never happen");
}, "getActualTrimLeft");
var cleanUpFloatingPointError = /* @__PURE__ */ __name((value) => {
  if (value % 1 < 1e-7) {
    return Math.floor(value);
  }
  if (value % 1 > 0.9999999) {
    return Math.ceil(value);
  }
  return value;
}, "cleanUpFloatingPointError");
var stringifyTrim = /* @__PURE__ */ __name((trim) => {
  const value = cleanUpFloatingPointError(trim * 1e6);
  const asString = `${value}us`;
  if (asString.includes("e-")) {
    return "0us";
  }
  return asString;
}, "stringifyTrim");
var trimAndSetTempo = /* @__PURE__ */ __name(({
  assetDuration,
  asset,
  trimLeftOffset,
  trimRightOffset,
  fps,
  indent,
  logLevel
}) => {
  const { trimLeft, maxTrim } = getActualTrimLeft({
    trimLeft: asset.trimLeft,
    fps,
    trimLeftOffset,
    seamless: true,
    assetDuration,
    audioStartFrame: asset.audioStartFrame,
    playbackRate: asset.playbackRate
  });
  const trimRight = trimLeft + asset.duration / fps - trimLeftOffset + trimRightOffset;
  let trimRightOrAssetDuration = maxTrim ? Math.min(trimRight, maxTrim) : trimRight;
  if (trimRightOrAssetDuration < trimLeft) {
    Log.warn({ indent, logLevel }, "trimRightOrAssetDuration < trimLeft: " + JSON.stringify({
      trimRight,
      trimLeft,
      assetDuration,
      assetTrimLeft: asset.trimLeft
    }));
    trimRightOrAssetDuration = trimLeft;
  }
  return {
    filter: [
      calculateATempo(asset.playbackRate),
      `atrim=${stringifyTrim(trimLeft)}:${stringifyTrim(trimRightOrAssetDuration)}`
    ],
    actualTrimLeft: trimLeft,
    audibleDuration: trimRightOrAssetDuration - trimLeft
  };
}, "trimAndSetTempo");
var stringifyFfmpegFilter = /* @__PURE__ */ __name(({
  channels,
  volume,
  fps,
  assetDuration,
  chunkLengthInSeconds,
  forSeamlessAacConcatenation,
  trimLeftOffset,
  trimRightOffset,
  asset,
  indent,
  logLevel,
  presentationTimeOffsetInSeconds,
  sampleRate
}) => {
  if (channels === 0) {
    return null;
  }
  const { toneFrequency, startInVideo } = asset;
  const startInVideoSeconds = startInVideo / fps;
  const { trimLeft, maxTrim } = getActualTrimLeft({
    trimLeft: asset.trimLeft,
    fps,
    trimLeftOffset,
    seamless: forSeamlessAacConcatenation,
    assetDuration,
    audioStartFrame: asset.audioStartFrame,
    playbackRate: asset.playbackRate
  });
  if (maxTrim && trimLeft >= maxTrim) {
    return null;
  }
  if (toneFrequency !== null && (toneFrequency <= 0 || toneFrequency > 2)) {
    throw new Error("toneFrequency must be a positive number between 0.01 and 2");
  }
  const {
    actualTrimLeft,
    audibleDuration,
    filter: trimAndTempoFilter
  } = trimAndSetTempo({
    assetDuration,
    trimLeftOffset,
    trimRightOffset,
    asset,
    fps,
    indent,
    logLevel
  });
  const volumeFilter = ffmpegVolumeExpression({
    volume,
    fps,
    trimLeft: actualTrimLeft
  });
  const padAtEnd = chunkLengthInSeconds - audibleDuration - startInVideoSeconds;
  const padStart = startInVideoSeconds + (asset.trimLeft === 0 ? presentationTimeOffsetInSeconds : 0);
  return {
    filter: "[0:a]" + [
      `aformat=sample_fmts=s16:sample_rates=${sampleRate}`,
      ...trimAndTempoFilter,
      volumeFilter.value === "1" ? null : `volume=${volumeFilter.value}:eval=${volumeFilter.eval}`,
      toneFrequency && toneFrequency !== 1 ? `asetrate=${sampleRate}*${toneFrequency},aresample=${sampleRate},atempo=1/${toneFrequency}` : null
    ].filter(truthy).join(",") + `[a0]`,
    pad_end: padAtEnd > 1e-7 ? "apad=pad_len=" + Math.round(padAtEnd * sampleRate) : null,
    pad_start: padStart === 0 ? null : `adelay=${new Array(channels + 1).fill((padStart * 1e3).toFixed(0)).join("|")}`,
    actualTrimLeft
  };
}, "stringifyFfmpegFilter");
var preprocessAudioTrackUnlimited = /* @__PURE__ */ __name(async ({
  outName,
  asset,
  fps,
  downloadMap,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  onProgress,
  chunkLengthInSeconds,
  trimLeftOffset,
  trimRightOffset,
  forSeamlessAacConcatenation,
  audioStreamIndex,
  sampleRate
}) => {
  const { channels, duration, startTime } = await getAudioChannelsAndDuration({
    downloadMap,
    src: resolveAssetSrc(asset.src),
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal,
    audioStreamIndex
  });
  const filter = stringifyFfmpegFilter({
    asset,
    fps,
    channels,
    assetDuration: duration,
    chunkLengthInSeconds,
    trimLeftOffset,
    trimRightOffset,
    forSeamlessAacConcatenation,
    volume: flattenVolumeArray(asset.volume),
    indent,
    logLevel,
    presentationTimeOffsetInSeconds: startTime ?? 0,
    sampleRate
  });
  if (filter === null) {
    return null;
  }
  const { cleanup, file } = await makeFfmpegFilterFile(filter, downloadMap);
  const args = [
    ["-hide_banner"],
    ["-i", resolveAssetSrc(asset.src)],
    audioStreamIndex ? ["-map", `0:a:${audioStreamIndex}`] : [],
    ["-ac", "2"],
    file ? ["-filter_script:a", file] : null,
    ["-c:a", "pcm_s16le"],
    ["-ar", String(sampleRate)],
    ["-y", outName]
  ].flat(2).filter(truthy);
  Log.verbose({ indent, logLevel }, "Preprocessing audio track:", JSON.stringify(args.join(" ")), "Filter:", filter.filter);
  const startTimestamp = Date.now();
  const task = callFf({
    bin: "ffmpeg",
    args,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
  task.stderr?.on("data", (data) => {
    const utf8 = data.toString("utf8");
    const parsed = parseFfmpegProgress(utf8, fps);
    if (parsed !== void 0) {
      onProgress((parsed - filter.actualTrimLeft * fps) / (chunkLengthInSeconds * fps));
    }
  });
  await task;
  Log.verbose({ indent, logLevel }, "Preprocessed audio track", `${Date.now() - startTimestamp}ms`);
  cleanup();
  return { outName, filter };
}, "preprocessAudioTrackUnlimited");
var limit3 = pLimit(2);
var preprocessAudioTrack = /* @__PURE__ */ __name((options) => {
  return limit3(preprocessAudioTrackUnlimited, options);
}, "preprocessAudioTrack");
var createAudio = /* @__PURE__ */ __name(async ({
  assets,
  onDownload,
  fps,
  logLevel,
  onProgress,
  downloadMap,
  remotionRoot,
  indent,
  binariesDirectory,
  audioBitrate,
  audioCodec,
  cancelSignal,
  chunkLengthInSeconds,
  trimLeftOffset,
  trimRightOffset,
  forSeamlessAacConcatenation,
  sampleRate
}) => {
  const fileUrlAssets = await convertAssetsToFileUrls({
    assets,
    onDownload: onDownload ?? (() => () => {
      return;
    }),
    downloadMap,
    indent,
    logLevel,
    binariesDirectory
  });
  markAllAssetsAsDownloaded(downloadMap);
  const assetPositions = calculateAssetPositions(fileUrlAssets);
  Log.verbose({ indent, logLevel, tag: "audio" }, "asset positions", JSON.stringify(assetPositions));
  const preprocessProgress = new Array(assetPositions.length).fill(0);
  let mergeProgress = 0;
  let compressProgress = 0;
  const updateProgress = /* @__PURE__ */ __name(() => {
    const preprocessProgressSum = preprocessProgress.length === 0 ? 1 : preprocessProgress.reduce((a, b) => a + b, 0) / assetPositions.length;
    const totalProgress = preprocessProgressSum * 0.7 + mergeProgress * 0.1 + compressProgress * 0.2;
    onProgress(totalProgress);
  }, "updateProgress");
  const audioTracks = await Promise.all(assetPositions.map(async (asset, index) => {
    const filterFile = path24.join(downloadMap.audioMixing, `${index}.wav`);
    const result = await preprocessAudioTrack({
      outName: filterFile,
      asset,
      fps,
      downloadMap,
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal,
      onProgress: /* @__PURE__ */ __name((progress) => {
        preprocessProgress[index] = progress;
        updateProgress();
      }, "onProgress"),
      chunkLengthInSeconds,
      trimLeftOffset,
      trimRightOffset,
      forSeamlessAacConcatenation,
      audioStreamIndex: asset.audioStreamIndex,
      sampleRate
    });
    preprocessProgress[index] = 1;
    updateProgress();
    return result;
  }));
  await downloadMap.inlineAudioMixing.finish({
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal,
    sampleRate
  });
  const inlinedAudio = downloadMap.inlineAudioMixing.getListOfAssets();
  const preprocessed = [
    ...audioTracks.filter(truthy),
    ...inlinedAudio.map((asset) => ({
      outName: asset,
      filter: {
        filter: null,
        pad_start: null,
        pad_end: null
      }
    }))
  ];
  const merged = path24.join(downloadMap.audioPreprocessing, "merged.wav");
  const extension = getExtensionFromAudioCodec(audioCodec);
  const outName = path24.join(downloadMap.audioPreprocessing, `audio.${extension}`);
  await mergeAudioTrack({
    files: preprocessed,
    outName: merged,
    downloadMap,
    remotionRoot,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal,
    fps,
    onProgress: /* @__PURE__ */ __name((progress) => {
      mergeProgress = progress;
      updateProgress();
    }, "onProgress"),
    chunkLengthInSeconds,
    sampleRate
  });
  await compressAudio({
    audioBitrate,
    audioCodec,
    binariesDirectory,
    indent,
    logLevel,
    inName: merged,
    outName,
    cancelSignal,
    chunkLengthInSeconds,
    fps,
    onProgress: /* @__PURE__ */ __name((progress) => {
      compressProgress = progress;
      updateProgress();
    }, "onProgress")
  });
  deleteDirectory(merged);
  deleteDirectory(downloadMap.audioMixing);
  preprocessed.forEach((p) => {
    deleteDirectory(p.outName);
  });
  return outName;
}, "createAudio");
var makeMetadataArgs = /* @__PURE__ */ __name((metadata) => {
  const defaultComment = `Made with Remotion ${VERSION}`;
  const newMetadata = {
    comment: defaultComment
  };
  Object.keys(metadata).forEach((key) => {
    const lowercaseKey = key.toLowerCase();
    if (lowercaseKey === "comment") {
      newMetadata[lowercaseKey] = `${defaultComment}; ${metadata[key]}`;
    } else {
      newMetadata[lowercaseKey] = metadata[key];
    }
  });
  const metadataArgs = Object.entries(newMetadata).map(([key, value]) => ["-metadata", `${key}=${value}`]);
  return metadataArgs.flat(1);
}, "makeMetadataArgs");
var getShouldRenderAudio = /* @__PURE__ */ __name(({
  codec,
  assetsInfo,
  enforceAudioTrack,
  muted
}) => {
  if (muted) {
    return "no";
  }
  if (!codecSupportsMedia(codec).audio) {
    return "no";
  }
  if (enforceAudioTrack) {
    return "yes";
  }
  if (assetsInfo === null) {
    return "maybe";
  }
  return assetsInfo.assets.flat(1).length > 0 ? "yes" : "no";
}, "getShouldRenderAudio");
var validateBitrate = /* @__PURE__ */ __name((bitrate, name) => {
  if (bitrate === null || typeof bitrate === "undefined") {
    return;
  }
  if (typeof bitrate === "number") {
    throw new TypeError(`"${name}" must be a string ending in "K" or "M". Got a number: ${bitrate}`);
  }
  if (typeof bitrate !== "string") {
    throw new TypeError(`"${name}" must be a string or null, but got ${JSON.stringify(bitrate)}`);
  }
  if (!bitrate.endsWith("K") && !bitrate.endsWith("k") && !bitrate.endsWith("M")) {
    throw new TypeError(`"${name}" must end in "K", "k" or "M", but got ${JSON.stringify(bitrate)}`);
  }
}, "validateBitrate");
var innerStitchFramesToVideo = /* @__PURE__ */ __name(async ({
  assetsInfo,
  audioBitrate,
  audioCodec: audioCodecSetting,
  cancelSignal,
  codec,
  crf,
  enforceAudioTrack,
  ffmpegOverride,
  force,
  fps,
  height,
  indent,
  muted,
  onDownload,
  outputLocation,
  pixelFormat,
  preEncodedFileLocation,
  preferLossless,
  proResProfile,
  logLevel,
  videoBitrate,
  maxRate,
  bufferSize,
  width,
  numberOfGifLoops,
  onProgress,
  x264Preset,
  colorSpace,
  binariesDirectory,
  separateAudioTo,
  metadata,
  hardwareAcceleration,
  sampleRate
}, remotionRoot) => {
  validateDimension(height, "height", "passed to `stitchFramesToVideo()`");
  validateDimension(width, "width", "passed to `stitchFramesToVideo()`");
  validateEvenDimensionsWithCodec({
    width,
    height,
    codec,
    scale: 1,
    wantsImageSequence: false,
    indent,
    logLevel
  });
  validateSelectedCodecAndProResCombination({
    codec,
    proResProfile
  });
  validateBitrate(audioBitrate, "audioBitrate");
  validateBitrate(videoBitrate, "videoBitrate");
  validateBitrate(maxRate, "maxRate");
  validateBitrate(bufferSize, "bufferSize");
  validateFps(fps, "in `stitchFramesToVideo()`", false);
  assetsInfo.downloadMap.preventCleanup();
  const proResProfileName = getProResProfileName(codec, proResProfile);
  const mediaSupport = codecSupportsMedia(codec);
  const renderAudioEvaluation = getShouldRenderAudio({
    assetsInfo,
    codec,
    enforceAudioTrack,
    muted
  });
  if (renderAudioEvaluation === "maybe") {
    throw new Error("Remotion is not sure whether to render audio. Please report this in the Remotion repo.");
  }
  const shouldRenderAudio = renderAudioEvaluation === "yes";
  const shouldRenderVideo = mediaSupport.video;
  if (!shouldRenderAudio && !shouldRenderVideo) {
    throw new Error("The output format has neither audio nor video. This can happen if you are rendering an audio codec and the output file has no audio or the muted flag was passed.");
  }
  const resolvedAudioCodec = resolveAudioCodec({
    codec,
    preferLossless,
    setting: audioCodecSetting,
    separateAudioTo
  });
  const tempFile = outputLocation ? null : path25.join(assetsInfo.downloadMap.stitchFrames, `out.${getFileExtensionFromCodec(codec, resolvedAudioCodec)}`);
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "audioCodec", resolvedAudioCodec);
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "pixelFormat", pixelFormat);
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "codec", codec);
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "shouldRenderAudio", shouldRenderAudio);
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "shouldRenderVideo", shouldRenderVideo);
  validateQualitySettings({
    crf,
    codec,
    videoBitrate,
    encodingMaxRate: maxRate,
    encodingBufferSize: bufferSize,
    hardwareAcceleration
  });
  validateSelectedPixelFormatAndCodecCombination(pixelFormat, codec);
  const updateProgress = /* @__PURE__ */ __name((muxProgress) => {
    onProgress?.(muxProgress);
  }, "updateProgress");
  const audio = shouldRenderAudio && resolvedAudioCodec ? await createAudio({
    assets: assetsInfo.assets,
    onDownload,
    fps,
    chunkLengthInSeconds: assetsInfo.chunkLengthInSeconds,
    logLevel,
    onProgress: /* @__PURE__ */ __name((progress) => {
      Log.verbose({
        indent,
        logLevel,
        tag: "audio"
      }, `Encoding progress: ${Math.round(progress * 100)}%`);
    }, "onProgress"),
    downloadMap: assetsInfo.downloadMap,
    remotionRoot,
    indent,
    binariesDirectory,
    audioBitrate,
    audioCodec: resolvedAudioCodec,
    cancelSignal: cancelSignal ?? void 0,
    trimLeftOffset: assetsInfo.trimLeftOffset,
    trimRightOffset: assetsInfo.trimRightOffset,
    forSeamlessAacConcatenation: assetsInfo.forSeamlessAacConcatenation,
    sampleRate
  }) : null;
  if (mediaSupport.audio && !mediaSupport.video) {
    if (!resolvedAudioCodec) {
      throw new TypeError("exporting audio but has no audio codec name. Report this in the Remotion repo.");
    }
    if (!audio) {
      throw new TypeError("exporting audio but has no audio file. Report this in the Remotion repo.");
    }
    if (separateAudioTo) {
      throw new Error("`separateAudioTo` was set, but this render was audio-only. This option is meant to be used for video renders.");
    }
    cpSync2(audio, outputLocation ?? tempFile);
    onProgress?.(Math.round(assetsInfo.chunkLengthInSeconds * fps));
    deleteDirectory(path25.dirname(audio));
    const file = await new Promise((resolve22, reject) => {
      if (tempFile) {
        promises3.readFile(tempFile).then((f) => {
          return resolve22(f);
        }).catch((e) => reject(e));
      } else {
        resolve22(null);
      }
    });
    deleteDirectory(assetsInfo.downloadMap.stitchFrames);
    assetsInfo.downloadMap.allowCleanup();
    return Promise.resolve(file);
  }
  const ffmpegArgs = [
    ...preEncodedFileLocation ? [["-i", preEncodedFileLocation]] : [
      ["-r", String(fps)],
      ["-f", "image2"],
      ["-s", `${width}x${height}`],
      ["-start_number", String(assetsInfo.firstFrameIndex)],
      ["-i", assetsInfo.imageSequenceName],
      codec === "gif" ? ["-filter_complex", "split[v],palettegen,[v]paletteuse"] : null
    ],
    audio && !separateAudioTo ? ["-i", audio, "-c:a", "copy"] : ["-an"],
    numberOfGifLoops === null ? null : ["-loop", convertNumberOfGifLoopsToFfmpegSyntax(numberOfGifLoops)],
    ...generateFfmpegArgs({
      codec,
      crf,
      videoBitrate,
      encodingMaxRate: maxRate,
      encodingBufferSize: bufferSize,
      hasPreencoded: Boolean(preEncodedFileLocation),
      proResProfileName,
      pixelFormat,
      x264Preset,
      colorSpace,
      hardwareAcceleration,
      indent,
      logLevel
    }),
    codec === "h264" ? ["-movflags", "faststart"] : null,
    ["-map_metadata", "-1"],
    ...makeMetadataArgs(metadata ?? {}),
    force ? "-y" : null,
    outputLocation ?? tempFile
  ];
  const ffmpegString = ffmpegArgs.flat(2).filter(Boolean);
  const finalFfmpegString = ffmpegOverride ? ffmpegOverride({ type: "stitcher", args: ffmpegString }) : ffmpegString;
  Log.verbose({
    indent: indent ?? false,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, "Generated final FFmpeg command:");
  Log.verbose({
    indent,
    logLevel,
    tag: "stitchFramesToVideo()"
  }, finalFfmpegString.join(" "));
  const task = callFfNative({
    bin: "ffmpeg",
    args: finalFfmpegString,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal: cancelSignal ?? void 0
  });
  let ffmpegStderr = "";
  let isFinished = false;
  task.stderr?.on("data", (data) => {
    const str = data.toString();
    ffmpegStderr += str;
    if (onProgress) {
      const parsed = parseFfmpegProgress(str, fps);
      if (parsed !== void 0) {
        if (parsed === assetsInfo.assets.length) {
          if (isFinished) {
            task.stdin?.write("q");
          } else {
            isFinished = true;
          }
        }
        updateProgress(parsed);
      }
    }
  });
  if (separateAudioTo) {
    if (!audio) {
      throw new Error(`\`separateAudioTo\` was set to ${JSON.stringify(separateAudioTo)}, but this render included no audio`);
    }
    const finalDestination = path25.resolve(remotionRoot, separateAudioTo);
    cpSync2(audio, finalDestination);
    rmSync4(audio);
  }
  const result = await new Promise((resolve22, reject) => {
    task.once("close", (code, signal) => {
      if (code === 0) {
        if (tempFile === null) {
          cleanDownloadMap(assetsInfo.downloadMap);
          return resolve22(null);
        }
        promises3.readFile(tempFile).then((f) => {
          resolve22(f);
        }).catch((e) => {
          reject(e);
        }).finally(() => {
          cleanDownloadMap(assetsInfo.downloadMap);
        });
      } else {
        reject(new Error(`FFmpeg quit with code ${code} ${signal ? `(${signal})` : ""} The FFmpeg output was ${ffmpegStderr}`));
      }
    });
  });
  assetsInfo.downloadMap.allowCleanup();
  return result;
}, "innerStitchFramesToVideo");
var internalStitchFramesToVideo = /* @__PURE__ */ __name((options) => {
  const remotionRoot = findRemotionRoot();
  const task = innerStitchFramesToVideo(options, remotionRoot);
  return Promise.race([
    task,
    new Promise((_resolve, reject) => {
      options.cancelSignal?.(() => {
        reject(new Error(cancelErrorMessages.stitchFramesToVideo));
      });
    })
  ]);
}, "internalStitchFramesToVideo");
var stitchFramesToVideo = /* @__PURE__ */ __name(({
  assetsInfo,
  force,
  fps,
  height,
  width,
  audioBitrate,
  audioCodec,
  cancelSignal,
  codec,
  crf,
  enforceAudioTrack,
  ffmpegOverride,
  muted,
  numberOfGifLoops,
  onDownload,
  onProgress,
  outputLocation,
  pixelFormat,
  proResProfile,
  verbose,
  videoBitrate,
  maxRate,
  bufferSize,
  x264Preset,
  colorSpace,
  binariesDirectory,
  separateAudioTo,
  metadata,
  hardwareAcceleration,
  sampleRate
}) => {
  return internalStitchFramesToVideo({
    assetsInfo,
    audioBitrate: audioBitrate ?? null,
    maxRate: maxRate ?? null,
    bufferSize: bufferSize ?? null,
    audioCodec: audioCodec ?? null,
    cancelSignal: cancelSignal ?? null,
    codec: codec ?? DEFAULT_CODEC,
    crf: crf ?? null,
    enforceAudioTrack: enforceAudioTrack ?? false,
    ffmpegOverride: ffmpegOverride ?? null,
    force: force ?? true,
    fps,
    height,
    indent: false,
    muted: muted ?? false,
    numberOfGifLoops: numberOfGifLoops ?? null,
    onDownload: onDownload ?? void 0,
    onProgress,
    outputLocation: outputLocation ?? null,
    pixelFormat: pixelFormat ?? DEFAULT_PIXEL_FORMAT,
    proResProfile,
    logLevel: verbose ? "verbose" : "info",
    videoBitrate: videoBitrate ?? null,
    width,
    preEncodedFileLocation: null,
    preferLossless: false,
    x264Preset: x264Preset ?? null,
    colorSpace: colorSpace ?? DEFAULT_COLOR_SPACE,
    binariesDirectory: binariesDirectory ?? null,
    metadata: metadata ?? null,
    separateAudioTo: separateAudioTo ?? null,
    hardwareAcceleration: hardwareAcceleration ?? "disable",
    sampleRate: sampleRate ?? 48e3
  });
}, "stitchFramesToVideo");
var succeedOrCancel = /* @__PURE__ */ __name(({
  happyPath,
  cancelSignal,
  cancelMessage
}) => {
  if (!cancelSignal) {
    return happyPath;
  }
  let resolveCancel = /* @__PURE__ */ __name(() => {
    return;
  }, "resolveCancel");
  const cancelProm = new Promise((_resolve, reject) => {
    cancelSignal?.(() => {
      resolveCancel = _resolve;
      reject(new Error(cancelMessage));
    });
  });
  return Promise.race([
    happyPath.then((result) => {
      process.nextTick(() => resolveCancel?.(void 0));
      return result;
    }),
    cancelProm
  ]);
}, "succeedOrCancel");
var validateEveryNthFrame = /* @__PURE__ */ __name((everyNthFrame) => {
  if (typeof everyNthFrame === "undefined") {
    throw new TypeError(`Argument missing for parameter "everyNthFrame"`);
  }
  if (typeof everyNthFrame !== "number") {
    throw new TypeError(`Argument passed to "everyNthFrame" is not a number: ${everyNthFrame}`);
  }
  if (everyNthFrame < 1) {
    throw new RangeError(`The value for "everyNthFrame" cannot be below 1, but is ${everyNthFrame}`);
  }
  if (!Number.isFinite(everyNthFrame)) {
    throw new RangeError(`"everyNthFrame" ${everyNthFrame} is not finite`);
  }
  if (everyNthFrame % 1 !== 0) {
    throw new RangeError(`Argument for everyNthFrame must be an integer, but got ${everyNthFrame}`);
  }
  if (everyNthFrame === 1) {
    return everyNthFrame;
  }
}, "validateEveryNthFrame");
var validateFfmpegOverride = /* @__PURE__ */ __name((ffmpegArgsHook) => {
  if (typeof ffmpegArgsHook === "undefined") {
    return;
  }
  if (ffmpegArgsHook && typeof ffmpegArgsHook !== "function") {
    throw new TypeError(`Argument passed for "ffmpegArgsHook" is not a function: ${ffmpegArgsHook}`);
  }
}, "validateFfmpegOverride");
var validateNumberOfGifLoops = /* @__PURE__ */ __name((numberOfGifLoops, codec) => {
  if (typeof numberOfGifLoops === "undefined" || numberOfGifLoops === null) {
    return;
  }
  if (typeof numberOfGifLoops !== "number") {
    throw new TypeError(`Argument passed to "numberOfGifLoops" is not a number: ${numberOfGifLoops}`);
  }
  if (numberOfGifLoops < 0) {
    throw new RangeError(`The value for "numberOfGifLoops" cannot be below 0, but is ${numberOfGifLoops}`);
  }
  if (!Number.isFinite(numberOfGifLoops)) {
    throw new RangeError(`"numberOfGifLoops" ${numberOfGifLoops} is not finite`);
  }
  if (numberOfGifLoops % 1 !== 0) {
    throw new RangeError(`Argument for numberOfGifLoops must be an integer, but got ${numberOfGifLoops}`);
  }
  if (codec !== "gif") {
    throw new Error(`"numberOfGifLoops" can only be set if "codec" is set to "gif". The codec is "${codec}"`);
  }
}, "validateNumberOfGifLoops");
var validateOutputFilename = /* @__PURE__ */ __name(({
  codec,
  audioCodecSetting,
  extension,
  preferLossless,
  separateAudioTo
}) => {
  if (!defaultFileExtensionMap[codec]) {
    throw new TypeError(`The codec "${codec}" is not supported. Supported codecs are: ${Object.keys(defaultFileExtensionMap).join(", ")}`);
  }
  const map3 = defaultFileExtensionMap[codec];
  const resolvedAudioCodec = resolveAudioCodec({
    codec,
    preferLossless,
    setting: audioCodecSetting,
    separateAudioTo
  });
  if (resolvedAudioCodec === null) {
    if (extension !== map3.default) {
      throw new TypeError(`When using the ${codec} codec, the output filename must end in .${map3.default}.`);
    }
    return;
  }
  if (!(resolvedAudioCodec in map3.forAudioCodec)) {
    throw new Error(`Audio codec ${resolvedAudioCodec} is not supported for codec ${codec}`);
  }
  const acceptableExtensions = map3.forAudioCodec[resolvedAudioCodec].possible;
  if (!acceptableExtensions.includes(extension) && !separateAudioTo) {
    throw new TypeError(`When using the ${codec} codec with the ${resolvedAudioCodec} audio codec, the output filename must end in one of the following: ${acceptableExtensions.join(", ")}.`);
  }
}, "validateOutputFilename");
var SLOWEST_FRAME_COUNT = 10;
var MAX_RECENT_FRAME_TIMINGS = 150;
var internalRenderMediaRaw = /* @__PURE__ */ __name(({
  proResProfile,
  x264Preset,
  crf,
  composition: compositionWithPossibleUnevenDimensions,
  serializedInputPropsWithCustomSchema,
  pixelFormat: userPixelFormat,
  codec,
  envVariables,
  frameRange,
  puppeteerInstance,
  outputLocation,
  onProgress,
  overwrite,
  onDownload,
  onBrowserLog,
  onStart,
  timeoutInMilliseconds,
  chromiumOptions,
  scale,
  browserExecutable,
  port,
  cancelSignal,
  muted,
  enforceAudioTrack,
  ffmpegOverride,
  audioBitrate,
  videoBitrate,
  encodingMaxRate,
  encodingBufferSize,
  audioCodec,
  concurrency,
  disallowParallelEncoding,
  everyNthFrame,
  imageFormat: provisionalImageFormat,
  indent,
  jpegQuality,
  numberOfGifLoops,
  onCtrlCExit,
  preferLossless,
  serveUrl,
  server: reusedServer,
  logLevel,
  serializedResolvedPropsWithCustomSchema,
  offthreadVideoCacheSizeInBytes,
  colorSpace,
  repro,
  binariesDirectory,
  separateAudioTo,
  forSeamlessAacConcatenation,
  compositionStart,
  onBrowserDownload,
  onArtifact,
  metadata,
  hardwareAcceleration,
  chromeMode,
  offthreadVideoThreads,
  mediaCacheSizeInBytes,
  onLog,
  licenseKey,
  isProduction,
  sampleRate
}) => {
  const pixelFormat = userPixelFormat ?? compositionWithPossibleUnevenDimensions.defaultPixelFormat ?? DEFAULT_PIXEL_FORMAT;
  if (repro) {
    enableRepro({
      serveUrl,
      compositionName: compositionWithPossibleUnevenDimensions.id,
      serializedInputPropsWithCustomSchema,
      serializedResolvedPropsWithCustomSchema
    });
  } else {
    disableRepro();
  }
  validateJpegQuality(jpegQuality);
  validateQualitySettings({
    crf,
    codec,
    videoBitrate,
    encodingMaxRate,
    encodingBufferSize,
    hardwareAcceleration
  });
  validateBitrate(audioBitrate, "audioBitrate");
  validateBitrate(videoBitrate, "videoBitrate");
  validateBitrate(encodingMaxRate, "encodingMaxRate");
  validateBitrate(encodingBufferSize, "encodingBufferSize");
  validateSelectedCodecAndProResCombination({
    codec,
    proResProfile
  });
  validateSelectedCodecAndPresetCombination({
    codec,
    x264Preset
  });
  validateSelectedPixelFormatAndCodecCombination(pixelFormat, codec);
  if (outputLocation) {
    validateOutputFilename({
      codec,
      audioCodecSetting: audioCodec,
      extension: getExtensionOfFilename(outputLocation),
      preferLossless,
      separateAudioTo
    });
  }
  const absoluteOutputLocation = outputLocation ? path26.resolve(process.cwd(), outputLocation) : null;
  validateScale(scale);
  validateFfmpegOverride(ffmpegOverride);
  validateEveryNthFrame(everyNthFrame);
  validateNumberOfGifLoops(numberOfGifLoops, codec);
  let stitchStage = "encoding";
  let stitcherFfmpeg;
  let preStitcher = null;
  let encodedFrames = 0;
  let muxedFrames = 0;
  let renderedFrames = 0;
  let renderedDoneIn = null;
  let encodedDoneIn = null;
  let cancelled = false;
  let renderEstimatedTime = 0;
  const recentFrameTimings = [];
  const renderStart = Date.now();
  const { estimatedUsage, freeMemory, hasEnoughMemory } = shouldUseParallelEncoding({
    height: compositionWithPossibleUnevenDimensions.height,
    width: compositionWithPossibleUnevenDimensions.width,
    logLevel
  });
  const parallelEncoding = !disallowParallelEncoding && hasEnoughMemory && canUseParallelEncoding(codec);
  Log.verbose({
    indent,
    logLevel,
    tag: "renderMedia()"
  }, "Free memory:", freeMemory, "Estimated usage parallel encoding", estimatedUsage);
  const resolvedConcurrency = resolveConcurrency(concurrency);
  Log.verbose({
    indent,
    logLevel,
    tag: "renderMedia()"
  }, "Using concurrency:", resolvedConcurrency);
  Log.verbose({
    indent,
    logLevel,
    tag: "renderMedia()"
  }, "delayRender() timeout:", timeoutInMilliseconds);
  Log.verbose({
    indent,
    logLevel,
    tag: "renderMedia()"
  }, "Codec supports parallel rendering:", canUseParallelEncoding(codec));
  if (disallowParallelEncoding) {
    Log.verbose({
      indent,
      logLevel,
      tag: "renderMedia()"
    }, "User disallowed parallel encoding.");
  }
  if (parallelEncoding) {
    Log.verbose({
      indent,
      logLevel,
      tag: "renderMedia()"
    }, "Parallel encoding is enabled.");
  } else {
    Log.verbose({
      indent,
      logLevel,
      tag: "renderMedia()"
    }, "Parallel encoding is disabled.");
  }
  const imageFormat = isAudioCodec(codec) ? "none" : provisionalImageFormat ?? compositionWithPossibleUnevenDimensions.defaultVideoImageFormat ?? DEFAULT_VIDEO_IMAGE_FORMAT;
  validateSelectedPixelFormatAndImageFormatCombination(pixelFormat, imageFormat);
  const workingDir = fs17.mkdtempSync(path26.join(os9.tmpdir(), "react-motion-render"));
  const preEncodedFileLocation = parallelEncoding ? path26.join(workingDir, "pre-encode." + getFileExtensionFromCodec(codec, audioCodec)) : null;
  if (onCtrlCExit && workingDir) {
    onCtrlCExit(`Delete ${workingDir}`, () => deleteDirectory(workingDir));
  }
  const { actualWidth: widthEvenDimensions, actualHeight: heightEvenDimensions } = validateEvenDimensionsWithCodec({
    codec,
    height: compositionWithPossibleUnevenDimensions.height,
    scale,
    width: compositionWithPossibleUnevenDimensions.width,
    wantsImageSequence: false,
    indent,
    logLevel
  });
  const actualWidth = widthEvenDimensions * scale;
  const actualHeight = heightEvenDimensions * scale;
  const composition = {
    ...compositionWithPossibleUnevenDimensions,
    height: heightEvenDimensions,
    width: widthEvenDimensions
  };
  const realFrameRange = getRealFrameRange(composition.durationInFrames, frameRange);
  const totalFramesToRender = getFramesToRender(realFrameRange, everyNthFrame).length;
  Log.verbose({ indent, logLevel, tag: "renderMedia()" }, `Rendering frames ${realFrameRange.join("-")}`);
  const callUpdate = /* @__PURE__ */ __name(() => {
    const encoded = Math.round(0.8 * encodedFrames + 0.2 * muxedFrames);
    onProgress?.({
      encodedDoneIn,
      encodedFrames: encoded,
      renderedDoneIn,
      renderedFrames,
      renderEstimatedTime,
      stitchStage,
      progress: Math.round((70 * renderedFrames + 30 * encoded) / totalFramesToRender) / 100
    });
  }, "callUpdate");
  const cancelRenderFrames = makeCancelSignal();
  const cancelPrestitcher = makeCancelSignal();
  const cancelStitcher = makeCancelSignal();
  cancelSignal?.(() => {
    cancelRenderFrames.cancel();
  });
  const { waitForRightTimeOfFrameToBeInserted, setFrameToStitch, waitForFinish } = ensureFramesInOrder(realFrameRange);
  const fps = composition.fps / everyNthFrame;
  validateFps(fps, 'in "renderMedia()"', codec === "gif");
  const createPrestitcherIfNecessary = /* @__PURE__ */ __name(() => {
    if (preEncodedFileLocation) {
      preStitcher = prespawnFfmpeg({
        width: actualWidth,
        height: actualHeight,
        fps,
        outputLocation: preEncodedFileLocation,
        pixelFormat,
        codec,
        proResProfile,
        crf,
        onProgress: /* @__PURE__ */ __name((frame) => {
          encodedFrames = frame;
          callUpdate();
        }, "onProgress"),
        logLevel,
        imageFormat,
        signal: cancelPrestitcher.cancelSignal,
        ffmpegOverride: ffmpegOverride ?? (({ args }) => args),
        videoBitrate,
        encodingMaxRate,
        encodingBufferSize,
        indent,
        x264Preset: x264Preset ?? null,
        colorSpace,
        binariesDirectory,
        hardwareAcceleration
      });
      stitcherFfmpeg = preStitcher.task;
    }
  }, "createPrestitcherIfNecessary");
  const waitForPrestitcherIfNecessary = /* @__PURE__ */ __name(async () => {
    if (stitcherFfmpeg) {
      await waitForFinish();
      stitcherFfmpeg?.stdin?.end();
      try {
        await stitcherFfmpeg;
      } catch {
        throw new Error(preStitcher?.getLogs());
      }
    }
    return { usesParallelEncoding: Boolean(stitcherFfmpeg) };
  }, "waitForPrestitcherIfNecessary");
  const mediaSupport = codecSupportsMedia(codec);
  const disableAudio = !mediaSupport.audio || muted;
  const slowestFrames = [];
  let maxTime = 0;
  let minTime = 0;
  const recordFrameTime = /* @__PURE__ */ __name((frameIndex, time) => {
    const frameTime = { frame: frameIndex, time };
    if (time < minTime && slowestFrames.length === SLOWEST_FRAME_COUNT) {
      return;
    }
    if (time > maxTime) {
      slowestFrames.unshift(frameTime);
      maxTime = time;
    } else {
      const index = slowestFrames.findIndex(({ time: indexTime }) => indexTime < time);
      slowestFrames.splice(index, 0, frameTime);
    }
    if (slowestFrames.length > SLOWEST_FRAME_COUNT) {
      slowestFrames.pop();
    }
    minTime = slowestFrames[slowestFrames.length - 1]?.time ?? minTime;
  }, "recordFrameTime");
  let cleanupServerFn = /* @__PURE__ */ __name(() => Promise.resolve(void 0), "cleanupServerFn");
  const happyPath = new Promise((resolve22, reject) => {
    Promise.resolve(createPrestitcherIfNecessary()).then(() => {
      return makeOrReuseServer(reusedServer, {
        offthreadVideoThreads: offthreadVideoThreads ?? DEFAULT_RENDER_FRAMES_OFFTHREAD_VIDEO_THREADS,
        indent,
        port,
        remotionRoot: findRemotionRoot(),
        logLevel,
        webpackConfigOrServeUrl: serveUrl,
        offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
        binariesDirectory,
        forceIPv4: false,
        sampleRate
      }, {
        onDownload
      });
    }).then(({ server, cleanupServer }) => {
      cleanupServerFn = cleanupServer;
      let timeOfLastFrame = Date.now();
      const renderFramesProc = internalRenderFrames({
        composition,
        onFrameUpdate: /* @__PURE__ */ __name((frame, frameIndex) => {
          renderedFrames = frame;
          const now = Date.now();
          const timeToRenderInMilliseconds = now - timeOfLastFrame;
          timeOfLastFrame = now;
          recentFrameTimings.push(timeToRenderInMilliseconds);
          if (recentFrameTimings.length > MAX_RECENT_FRAME_TIMINGS) {
            recentFrameTimings.shift();
          }
          const recentTimingsSum = recentFrameTimings.reduce((sum, time) => sum + time, 0);
          const newAverage = recentTimingsSum / recentFrameTimings.length;
          const remainingFrames = totalFramesToRender - renderedFrames;
          renderEstimatedTime = Math.round(remainingFrames * newAverage);
          callUpdate();
          recordFrameTime(frameIndex, timeToRenderInMilliseconds);
        }, "onFrameUpdate"),
        concurrency,
        outputDir: parallelEncoding ? null : workingDir,
        onStart: /* @__PURE__ */ __name((data) => {
          renderedFrames = 0;
          callUpdate();
          onStart?.(data);
        }, "onStart"),
        serializedInputPropsWithCustomSchema,
        envVariables,
        imageFormat,
        jpegQuality,
        frameRange,
        puppeteerInstance,
        everyNthFrame,
        onFrameBuffer: parallelEncoding ? async (buffer, frame) => {
          await waitForRightTimeOfFrameToBeInserted(frame);
          if (cancelled) {
            return;
          }
          const id = startPerfMeasure("piping");
          const exitStatus = preStitcher?.getExitStatus();
          if (exitStatus?.type === "quit-successfully") {
            throw new Error(`FFmpeg already quit while trying to pipe frame ${frame} to it. Stderr: ${exitStatus.stderr}`);
          }
          if (exitStatus?.type === "quit-with-error") {
            throw new Error(`FFmpeg quit with code ${exitStatus.exitCode}${exitStatus.signal ? ` (signal ${exitStatus.signal})` : ""} while piping frame ${frame}. Stderr: ${exitStatus.stderr}`);
          }
          stitcherFfmpeg?.stdin?.write(buffer);
          stopPerfMeasure(id);
          setFrameToStitch(Math.min(realFrameRange[1] + 1, frame + everyNthFrame));
        } : null,
        webpackBundleOrServeUrl: serveUrl,
        onBrowserLog,
        onDownload,
        timeoutInMilliseconds,
        chromiumOptions,
        scale,
        browserExecutable,
        port,
        cancelSignal: cancelRenderFrames.cancelSignal,
        muted: disableAudio,
        logLevel,
        indent,
        server,
        serializedResolvedPropsWithCustomSchema,
        offthreadVideoCacheSizeInBytes,
        offthreadVideoThreads,
        parallelEncodingEnabled: parallelEncoding,
        binariesDirectory,
        compositionStart,
        forSeamlessAacConcatenation,
        onBrowserDownload,
        onArtifact,
        chromeMode,
        imageSequencePattern: null,
        mediaCacheSizeInBytes,
        onLog,
        sampleRate
      });
      return renderFramesProc;
    }).then((renderFramesReturn) => {
      return Promise.all([
        renderFramesReturn,
        waitForPrestitcherIfNecessary()
      ]);
    }).then(([{ assetsInfo }]) => {
      renderedDoneIn = Date.now() - renderStart;
      Log.verbose({ indent, logLevel }, "Rendering frames done in", renderedDoneIn + "ms");
      if (absoluteOutputLocation) {
        ensureOutputDirectory(absoluteOutputLocation);
      }
      const stitchStart = Date.now();
      return internalStitchFramesToVideo({
        width: Math.round(actualWidth),
        height: Math.round(actualHeight),
        fps,
        outputLocation: absoluteOutputLocation,
        preEncodedFileLocation,
        preferLossless,
        indent,
        force: overwrite,
        pixelFormat,
        codec,
        proResProfile,
        crf,
        assetsInfo,
        onProgress: /* @__PURE__ */ __name((frame) => {
          if (preEncodedFileLocation) {
            stitchStage = "muxing";
            muxedFrames = Math.min(frame, totalFramesToRender);
          } else {
            muxedFrames = Math.min(frame, totalFramesToRender);
            encodedFrames = Math.min(frame, totalFramesToRender);
          }
          if (encodedFrames === totalFramesToRender) {
            encodedDoneIn = Date.now() - stitchStart;
          }
          if (frame > 0) {
            callUpdate();
          }
        }, "onProgress"),
        onDownload,
        numberOfGifLoops,
        logLevel,
        cancelSignal: cancelStitcher.cancelSignal,
        muted: disableAudio,
        enforceAudioTrack,
        ffmpegOverride: ffmpegOverride ?? null,
        audioBitrate,
        videoBitrate,
        bufferSize: encodingBufferSize,
        maxRate: encodingMaxRate,
        audioCodec,
        x264Preset: x264Preset ?? null,
        colorSpace,
        binariesDirectory,
        separateAudioTo,
        metadata,
        hardwareAcceleration,
        sampleRate
      });
    }).then((buffer) => {
      Log.verbose({ indent, logLevel }, "Stitching done in", encodedDoneIn + "ms");
      slowestFrames.sort((a, b) => b.time - a.time);
      const result = {
        buffer,
        slowestFrames,
        contentType: mimeLookup("file." + getFileExtensionFromCodec(codec, audioCodec)) || "application/octet-stream"
      };
      const sendTelemetryAndResolve = /* @__PURE__ */ __name(() => {
        if (licenseKey === null) {
          resolve22(result);
          return;
        }
        LicensingInternals.internalRegisterUsageEvent({
          event: "cloud-render",
          host: null,
          succeeded: true,
          licenseKey: licenseKey ?? null,
          isProduction: isProduction ?? true,
          isStill: false
        }).then(() => {
          Log.verbose({ indent, logLevel }, "Usage event sent successfully");
        }).catch((err) => {
          Log.error({ indent, logLevel }, "Failed to send usage event");
          Log.error({ indent: true, logLevel }, err);
        }).finally(() => {
          resolve22(result);
        });
      }, "sendTelemetryAndResolve");
      if (isReproEnabled()) {
        getReproWriter().onRenderSucceed({ indent, logLevel, output: absoluteOutputLocation }).then(() => {
          sendTelemetryAndResolve();
        }).catch((err) => {
          Log.error({ indent, logLevel }, "Could not create reproduction", err);
          sendTelemetryAndResolve();
        });
      } else {
        sendTelemetryAndResolve();
      }
    }).catch((err) => {
      cancelled = true;
      cancelRenderFrames.cancel();
      cancelStitcher.cancel();
      cancelPrestitcher.cancel();
      if (stitcherFfmpeg !== void 0 && stitcherFfmpeg.exitCode === null) {
        const promise = new Promise((res) => {
          setTimeout(() => {
            res();
          }, 2e3);
          stitcherFfmpeg.on("close", res);
        });
        try {
          stitcherFfmpeg.kill();
        } catch {
        }
        return promise.then(() => {
          reject(err);
        });
      }
      reject(err);
    }).finally(() => {
      if (preEncodedFileLocation !== null && fs17.existsSync(preEncodedFileLocation)) {
        deleteDirectory(path26.dirname(preEncodedFileLocation));
      }
      if (workingDir && fs17.existsSync(workingDir)) {
        deleteDirectory(workingDir);
      }
      cleanupServerFn?.(false).catch((err) => {
        Log.error({ indent, logLevel }, "Could not cleanup: ", err);
      });
    });
  });
  return succeedOrCancel({
    happyPath,
    cancelSignal,
    cancelMessage: cancelErrorMessages.renderMedia
  });
}, "internalRenderMediaRaw");
var internalRenderMedia = wrapWithErrorHandling(internalRenderMediaRaw);
var renderMedia = /* @__PURE__ */ __name(({
  proResProfile,
  x264Preset,
  crf,
  composition,
  inputProps,
  pixelFormat,
  codec,
  envVariables,
  frameRange,
  puppeteerInstance,
  outputLocation,
  onProgress,
  overwrite,
  onDownload,
  onBrowserLog,
  onStart,
  timeoutInMilliseconds,
  chromiumOptions,
  scale,
  browserExecutable,
  port,
  cancelSignal,
  muted,
  enforceAudioTrack,
  ffmpegOverride,
  audioBitrate,
  videoBitrate,
  encodingMaxRate,
  encodingBufferSize,
  audioCodec,
  jpegQuality,
  concurrency,
  serveUrl,
  disallowParallelEncoding,
  everyNthFrame,
  imageFormat,
  numberOfGifLoops,
  dumpBrowserLogs,
  preferLossless,
  verbose,
  quality,
  logLevel: passedLogLevel,
  offthreadVideoCacheSizeInBytes,
  colorSpace,
  repro,
  binariesDirectory,
  separateAudioTo,
  forSeamlessAacConcatenation,
  onBrowserDownload,
  onArtifact,
  metadata,
  hardwareAcceleration,
  chromeMode,
  offthreadVideoThreads,
  compositionStart,
  mediaCacheSizeInBytes,
  isProduction,
  sampleRate,
  ...apiKeyOrLicenseKey
}) => {
  const indent = false;
  const logLevel = verbose || dumpBrowserLogs ? "verbose" : passedLogLevel ?? "info";
  if (quality !== void 0) {
    Log.warn({ indent, logLevel }, `The "quality" option has been renamed. Please use "jpegQuality" instead.`);
  }
  const licenseKey = "licenseKey" in apiKeyOrLicenseKey ? apiKeyOrLicenseKey.licenseKey : null;
  const apiKey = "apiKey" in apiKeyOrLicenseKey ? apiKeyOrLicenseKey.apiKey : null;
  return internalRenderMedia({
    proResProfile: proResProfile ?? void 0,
    x264Preset: x264Preset ?? null,
    codec,
    composition,
    serveUrl,
    audioBitrate: audioBitrate ?? null,
    audioCodec: audioCodec ?? null,
    browserExecutable: browserExecutable ?? null,
    cancelSignal,
    chromiumOptions: chromiumOptions ?? {},
    concurrency: concurrency ?? null,
    crf: crf ?? null,
    disallowParallelEncoding: disallowParallelEncoding ?? false,
    enforceAudioTrack: enforceAudioTrack ?? false,
    envVariables: envVariables ?? {},
    everyNthFrame: everyNthFrame ?? 1,
    ffmpegOverride: ffmpegOverride ?? void 0,
    frameRange: frameRange ?? null,
    imageFormat: imageFormat ?? null,
    serializedInputPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: inputProps ?? {}
    }).serializedString,
    jpegQuality: jpegQuality ?? quality ?? DEFAULT_JPEG_QUALITY,
    muted: muted ?? false,
    numberOfGifLoops: numberOfGifLoops ?? null,
    onBrowserLog: onBrowserLog ?? null,
    onDownload: onDownload ?? (() => {
      return;
    }),
    onProgress: onProgress ?? (() => {
      return;
    }),
    onStart: onStart ?? (() => {
      return;
    }),
    outputLocation: outputLocation ?? null,
    overwrite: overwrite ?? DEFAULT_OVERWRITE,
    pixelFormat: pixelFormat ?? null,
    port: port ?? null,
    puppeteerInstance: puppeteerInstance ?? void 0,
    scale: scale ?? 1,
    timeoutInMilliseconds: timeoutInMilliseconds ?? DEFAULT_TIMEOUT,
    videoBitrate: videoBitrate ?? null,
    encodingMaxRate: encodingMaxRate ?? null,
    encodingBufferSize: encodingBufferSize ?? null,
    logLevel,
    preferLossless: preferLossless ?? false,
    indent,
    onCtrlCExit: /* @__PURE__ */ __name(() => {
      return;
    }, "onCtrlCExit"),
    server: void 0,
    serializedResolvedPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: composition.props ?? {}
    }).serializedString,
    offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
    offthreadVideoThreads: offthreadVideoThreads ?? null,
    colorSpace: colorSpace ?? DEFAULT_COLOR_SPACE,
    repro: repro ?? false,
    binariesDirectory: binariesDirectory ?? null,
    separateAudioTo: separateAudioTo ?? null,
    forSeamlessAacConcatenation: forSeamlessAacConcatenation ?? false,
    onBrowserDownload: onBrowserDownload ?? defaultBrowserDownloadProgress({
      indent,
      logLevel,
      api: "renderMedia()"
    }),
    onArtifact: onArtifact ?? null,
    metadata: metadata ?? null,
    compositionStart: compositionStart ?? 0,
    hardwareAcceleration: hardwareAcceleration ?? "disable",
    chromeMode: chromeMode ?? "headless-shell",
    mediaCacheSizeInBytes: mediaCacheSizeInBytes ?? null,
    licenseKey: licenseKey ?? apiKey ?? null,
    onLog: defaultOnLog,
    isProduction: isProduction ?? null,
    sampleRate: sampleRate ?? composition.defaultSampleRate ?? 48e3
  });
}, "renderMedia");
var innerRenderStill = /* @__PURE__ */ __name(async ({
  composition,
  imageFormat = DEFAULT_STILL_IMAGE_FORMAT,
  serveUrl,
  puppeteerInstance,
  onError,
  serializedInputPropsWithCustomSchema,
  envVariables,
  output,
  frame = 0,
  overwrite,
  browserExecutable,
  timeoutInMilliseconds,
  chromiumOptions,
  scale,
  proxyPort,
  cancelSignal,
  jpegQuality,
  onBrowserLog,
  sourceMapGetter,
  logLevel,
  indent,
  serializedResolvedPropsWithCustomSchema,
  onBrowserDownload,
  onArtifact,
  chromeMode,
  mediaCacheSizeInBytes,
  onLog
}) => {
  validateDimension(composition.height, "height", "in the `config` object passed to `renderStill()`");
  validateDimension(composition.width, "width", "in the `config` object passed to `renderStill()`");
  validateFps(composition.fps, "in the `config` object of `renderStill()`", false);
  validateDurationInFrames(composition.durationInFrames, {
    component: "in the `config` object passed to `renderStill()`",
    allowFloats: false
  });
  validateStillImageFormat(imageFormat);
  NoReactInternals.validateFrame({
    frame,
    durationInFrames: composition.durationInFrames,
    allowFloats: false
  });
  const stillFrame = convertToPositiveFrameIndex({
    durationInFrames: composition.durationInFrames,
    frame
  });
  validatePuppeteerTimeout(timeoutInMilliseconds);
  validateScale(scale);
  output = typeof output === "string" ? path27.resolve(process.cwd(), output) : null;
  validateJpegQuality(jpegQuality);
  if (output) {
    if (fs18.existsSync(output)) {
      if (!overwrite) {
        throw new Error(`Cannot render still - "overwrite" option was set to false, but the output destination ${output} already exists.`);
      }
      const stat = statSync2(output);
      if (!stat.isFile()) {
        throw new Error(`The output location ${output} already exists, but is not a file, but something else (e.g. folder). Cannot save to it.`);
      }
    }
    ensureOutputDirectory(output);
  }
  const browserInstance = puppeteerInstance ?? await internalOpenBrowser({
    browser: DEFAULT_BROWSER,
    browserExecutable,
    chromiumOptions,
    forceDeviceScaleFactor: scale,
    indent,
    viewport: null,
    logLevel,
    onBrowserDownload,
    chromeMode
  });
  const page = await browserInstance.newPage({
    context: sourceMapGetter,
    logLevel,
    indent,
    pageIndex: 0,
    onBrowserLog,
    onLog
  });
  await page.setViewport({
    width: composition.width,
    height: composition.height,
    deviceScaleFactor: scale
  });
  const errorCallback = /* @__PURE__ */ __name((err) => {
    onError(err);
    cleanup();
  }, "errorCallback");
  const cleanUpJSException = handleJavascriptException({
    page,
    onError: errorCallback,
    frame: null
  });
  const cleanup = /* @__PURE__ */ __name(async () => {
    cleanUpJSException();
    if (puppeteerInstance) {
      await page.close();
    } else {
      browserInstance.close({ silent: true }).catch((err) => {
        Log.error({ indent, logLevel }, "Unable to close browser", err);
      });
    }
  }, "cleanup");
  cancelSignal?.(() => {
    cleanup();
  });
  await setPropsAndEnv({
    serializedInputPropsWithCustomSchema,
    envVariables,
    page,
    serveUrl,
    initialFrame: stillFrame,
    timeoutInMilliseconds,
    proxyPort,
    retriesRemaining: 2,
    audioEnabled: false,
    videoEnabled: true,
    indent,
    logLevel,
    onServeUrlVisited: /* @__PURE__ */ __name(() => {
      return;
    }, "onServeUrlVisited"),
    isMainTab: true,
    mediaCacheSizeInBytes,
    initialMemoryAvailable: getAvailableMemory(logLevel),
    darkMode: chromiumOptions.darkMode ?? false,
    sampleRate: 48e3
  });
  await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name((id, props, durationInFrames, fps, height, width, defaultCodec, defaultOutName, defaultVideoImageFormat, defaultPixelFormat, defaultProResProfile, defaultSampleRate) => {
      window.remotion_setBundleMode({
        type: "composition",
        compositionName: id,
        serializedResolvedPropsWithSchema: props,
        compositionDurationInFrames: durationInFrames,
        compositionFps: fps,
        compositionHeight: height,
        compositionWidth: width,
        compositionDefaultCodec: defaultCodec,
        compositionDefaultOutName: defaultOutName,
        compositionDefaultVideoImageFormat: defaultVideoImageFormat,
        compositionDefaultPixelFormat: defaultPixelFormat,
        compositionDefaultProResProfile: defaultProResProfile,
        compositionDefaultSampleRate: defaultSampleRate
      });
    }, "pageFunction"),
    args: [
      composition.id,
      serializedResolvedPropsWithCustomSchema,
      composition.durationInFrames,
      composition.fps,
      composition.height,
      composition.width,
      composition.defaultCodec,
      composition.defaultOutName,
      composition.defaultVideoImageFormat,
      composition.defaultPixelFormat,
      composition.defaultProResProfile,
      composition.defaultSampleRate
    ],
    frame: null,
    page,
    timeoutInMilliseconds
  });
  await seekToFrame({
    frame: stillFrame,
    page,
    composition: composition.id,
    timeoutInMilliseconds,
    indent,
    logLevel,
    attempt: 0
  });
  const [buffer, collectedAssets] = await Promise.all([
    takeFrame({
      freePage: page,
      height: composition.height,
      width: composition.width,
      imageFormat,
      scale,
      output,
      jpegQuality,
      wantsBuffer: !output,
      timeoutInMilliseconds
    }),
    collectAssets({
      frame,
      freePage: page,
      timeoutInMilliseconds
    })
  ]);
  const artifactAssets = onlyArtifact({
    assets: collectedAssets,
    frameBuffer: buffer
  });
  const previousArtifactAssets = [];
  for (const artifact of artifactAssets) {
    for (const previousArtifact of previousArtifactAssets) {
      if (artifact.filename === previousArtifact.filename) {
        throw new Error(`An artifact with output "${artifact.filename}" was already registered at frame ${previousArtifact.frame}, but now registered again at frame ${artifact.frame}. Artifacts must have unique names. https://remotion.dev/docs/artifacts`);
      }
    }
    previousArtifactAssets.push(artifact);
    onArtifact?.(artifact);
  }
  await cleanup();
  return {
    buffer: output ? null : buffer,
    contentType: mimeLookup("file." + imageFormat) || "application/octet-stream"
  };
}, "innerRenderStill");
var internalRenderStillRaw = /* @__PURE__ */ __name((options) => {
  const cleanup = [];
  const happyPath = new Promise((resolve22, reject) => {
    const onError = /* @__PURE__ */ __name((err) => reject(err), "onError");
    makeOrReuseServer(options.server, {
      webpackConfigOrServeUrl: options.serveUrl,
      port: options.port,
      remotionRoot: findRemotionRoot(),
      offthreadVideoThreads: options.offthreadVideoThreads ?? 2,
      logLevel: options.logLevel,
      indent: options.indent,
      offthreadVideoCacheSizeInBytes: options.offthreadVideoCacheSizeInBytes,
      binariesDirectory: options.binariesDirectory,
      forceIPv4: false,
      sampleRate: 48e3
    }, {
      onDownload: options.onDownload
    }).then(({ server, cleanupServer }) => {
      cleanup.push(() => cleanupServer(false));
      const { serveUrl, offthreadPort, sourceMap: sourceMapGetter } = server;
      return innerRenderStill({
        ...options,
        serveUrl,
        onError,
        proxyPort: offthreadPort,
        sourceMapGetter
      });
    }).then((res) => {
      if (options.licenseKey === null) {
        resolve22(res);
        return;
      }
      LicensingInternals.internalRegisterUsageEvent({
        licenseKey: options.licenseKey,
        event: "cloud-render",
        host: null,
        succeeded: true,
        isStill: true,
        isProduction: options.isProduction ?? true
      }).then(() => {
        Log.verbose(options, "Usage event sent successfully");
      }).catch((err) => {
        Log.error(options, "Failed to send usage event");
        Log.error(options, err);
      }).finally(() => {
        resolve22(res);
      });
    }).catch((err) => reject(err)).finally(() => {
      cleanup.forEach((c) => {
        c().catch((err) => {
          Log.error(options, "Cleanup error:", err);
        });
      });
    });
  });
  return Promise.race([
    happyPath,
    new Promise((_resolve, reject) => {
      options.cancelSignal?.(() => {
        reject(new Error(cancelErrorMessages.renderStill));
      });
    })
  ]);
}, "internalRenderStillRaw");
var internalRenderStill = wrapWithErrorHandling(internalRenderStillRaw);
var renderStill = /* @__PURE__ */ __name((options) => {
  const {
    composition,
    serveUrl,
    browserExecutable,
    cancelSignal,
    chromiumOptions,
    dumpBrowserLogs,
    envVariables,
    frame,
    imageFormat,
    inputProps,
    jpegQuality,
    onBrowserLog,
    onDownload,
    output,
    overwrite,
    port,
    puppeteerInstance,
    scale,
    timeoutInMilliseconds,
    verbose,
    quality,
    offthreadVideoCacheSizeInBytes,
    logLevel: passedLogLevel,
    binariesDirectory,
    onBrowserDownload,
    onArtifact,
    chromeMode,
    offthreadVideoThreads,
    mediaCacheSizeInBytes,
    apiKey,
    licenseKey,
    isProduction
  } = options;
  if (typeof jpegQuality !== "undefined" && imageFormat !== "jpeg") {
    throw new Error("You can only pass the `quality` option if `imageFormat` is 'jpeg'.");
  }
  const indent = false;
  const logLevel = passedLogLevel ?? (verbose || dumpBrowserLogs ? "verbose" : "info");
  if (quality) {
    Log.warn({ indent, logLevel }, "Passing `quality()` to `renderStill` is deprecated. Use `jpegQuality` instead.");
  }
  return internalRenderStill({
    composition,
    browserExecutable: browserExecutable ?? null,
    cancelSignal: cancelSignal ?? null,
    chromiumOptions: chromiumOptions ?? {},
    envVariables: envVariables ?? {},
    frame: frame ?? 0,
    imageFormat: imageFormat ?? DEFAULT_STILL_IMAGE_FORMAT,
    indent,
    serializedInputPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      staticBase: null,
      indent: void 0,
      data: inputProps ?? {}
    }).serializedString,
    jpegQuality: jpegQuality ?? quality ?? DEFAULT_JPEG_QUALITY,
    onBrowserLog: onBrowserLog ?? null,
    onDownload: onDownload ?? null,
    output: output ?? null,
    overwrite: overwrite ?? DEFAULT_OVERWRITE,
    port: port ?? null,
    puppeteerInstance: puppeteerInstance ?? null,
    scale: scale ?? 1,
    server: void 0,
    serveUrl,
    timeoutInMilliseconds: timeoutInMilliseconds ?? DEFAULT_TIMEOUT,
    logLevel,
    serializedResolvedPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: composition.props ?? {}
    }).serializedString,
    offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
    binariesDirectory: binariesDirectory ?? null,
    onBrowserDownload: onBrowserDownload ?? defaultBrowserDownloadProgress({
      indent,
      logLevel,
      api: "renderStill()"
    }),
    onArtifact: onArtifact ?? null,
    chromeMode: chromeMode ?? "headless-shell",
    offthreadVideoThreads: offthreadVideoThreads ?? null,
    mediaCacheSizeInBytes: mediaCacheSizeInBytes ?? null,
    licenseKey: licenseKey ?? apiKey ?? null,
    onLog: defaultOnLog,
    isProduction: isProduction ?? null
  });
}, "renderStill");
var innerSelectComposition = /* @__PURE__ */ __name(async ({
  page,
  serializedInputPropsWithCustomSchema,
  envVariables,
  serveUrl,
  timeoutInMilliseconds,
  port,
  id,
  indent,
  logLevel,
  onServeUrlVisited,
  mediaCacheSizeInBytes,
  chromiumOptions
}) => {
  validatePuppeteerTimeout(timeoutInMilliseconds);
  await setPropsAndEnv({
    serializedInputPropsWithCustomSchema,
    envVariables,
    page,
    serveUrl,
    initialFrame: 0,
    timeoutInMilliseconds,
    proxyPort: port,
    retriesRemaining: 2,
    audioEnabled: false,
    videoEnabled: false,
    indent,
    logLevel,
    onServeUrlVisited,
    isMainTab: true,
    mediaCacheSizeInBytes,
    initialMemoryAvailable: getAvailableMemory(logLevel),
    darkMode: chromiumOptions.darkMode ?? false,
    sampleRate: 48e3
  });
  await puppeteerEvaluateWithCatch({
    page,
    pageFunction: /* @__PURE__ */ __name(() => {
      window.remotion_setBundleMode({
        type: "evaluation"
      });
    }, "pageFunction"),
    frame: null,
    args: [],
    timeoutInMilliseconds
  });
  await waitForReady({
    page,
    timeoutInMilliseconds,
    frame: null,
    logLevel,
    indent
  });
  Log.verbose({
    indent,
    tag: "selectComposition()",
    logLevel
  }, "Running calculateMetadata()...");
  const time = Date.now();
  const { value: result, size } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name((_id) => {
      return window.remotion_calculateComposition(_id);
    }, "pageFunction"),
    frame: null,
    page,
    args: [id],
    timeoutInMilliseconds
  });
  Log.verbose({
    indent,
    tag: "selectComposition()",
    logLevel
  }, `calculateMetadata() took ${Date.now() - time}ms`);
  const res = result;
  const {
    width,
    durationInFrames,
    fps,
    height,
    defaultCodec,
    defaultOutName,
    defaultVideoImageFormat,
    defaultPixelFormat,
    defaultProResProfile,
    defaultSampleRate
  } = res;
  return {
    metadata: {
      id,
      width,
      height,
      fps,
      durationInFrames,
      props: NoReactInternals.deserializeJSONWithSpecialTypes(res.serializedResolvedPropsWithCustomSchema),
      defaultProps: NoReactInternals.deserializeJSONWithSpecialTypes(res.serializedDefaultPropsWithCustomSchema),
      defaultCodec,
      defaultOutName,
      defaultVideoImageFormat,
      defaultPixelFormat,
      defaultProResProfile,
      defaultSampleRate
    },
    propsSize: size
  };
}, "innerSelectComposition");
var internalSelectCompositionRaw = /* @__PURE__ */ __name(async (options) => {
  const cleanup = [];
  const {
    puppeteerInstance,
    browserExecutable,
    chromiumOptions,
    serveUrl: serveUrlOrWebpackUrl,
    logLevel,
    indent,
    port,
    envVariables,
    id,
    serializedInputPropsWithCustomSchema,
    onBrowserLog,
    server,
    timeoutInMilliseconds,
    offthreadVideoCacheSizeInBytes,
    binariesDirectory,
    onBrowserDownload,
    onServeUrlVisited,
    chromeMode,
    mediaCacheSizeInBytes
  } = options;
  const [{ page, cleanupPage }, serverUsed] = await Promise.all([
    getPageAndCleanupFn({
      passedInInstance: puppeteerInstance,
      browserExecutable,
      chromiumOptions,
      forceDeviceScaleFactor: void 0,
      indent,
      logLevel,
      onBrowserDownload,
      chromeMode,
      pageIndex: 0,
      onBrowserLog,
      onLog: RenderInternals.defaultOnLog
    }),
    makeOrReuseServer(options.server, {
      webpackConfigOrServeUrl: serveUrlOrWebpackUrl,
      port,
      remotionRoot: findRemotionRoot(),
      offthreadVideoThreads: 0,
      logLevel,
      indent,
      offthreadVideoCacheSizeInBytes,
      binariesDirectory,
      forceIPv4: false,
      sampleRate: 48e3
    }, {
      onDownload: /* @__PURE__ */ __name(() => {
        return;
      }, "onDownload")
    }).then((result) => {
      cleanup.push(() => result.cleanupServer(true));
      return result;
    })
  ]);
  cleanup.push(() => cleanupPage());
  return new Promise((resolve22, reject) => {
    const onError = /* @__PURE__ */ __name((err) => reject(err), "onError");
    cleanup.push(handleJavascriptException({
      page,
      frame: null,
      onError
    }));
    page.setBrowserSourceMapGetter(serverUsed.server.sourceMap);
    innerSelectComposition({
      serveUrl: serverUsed.server.serveUrl,
      page,
      port: serverUsed.server.offthreadPort,
      browserExecutable,
      chromiumOptions,
      envVariables,
      id,
      serializedInputPropsWithCustomSchema,
      timeoutInMilliseconds,
      logLevel,
      indent,
      puppeteerInstance,
      server,
      offthreadVideoCacheSizeInBytes,
      binariesDirectory,
      onBrowserDownload,
      onServeUrlVisited,
      chromeMode,
      mediaCacheSizeInBytes
    }).then((data) => {
      return resolve22(data);
    }).catch((err) => {
      reject(err);
    }).finally(() => {
      cleanup.forEach((c) => {
        c().catch((err) => {
          Log.error({ indent, logLevel }, "Cleanup error:", err);
        });
      });
    });
  });
}, "internalSelectCompositionRaw");
var internalSelectComposition = wrapWithErrorHandling(internalSelectCompositionRaw);
var selectComposition = /* @__PURE__ */ __name(async (options) => {
  const {
    id,
    serveUrl,
    browserExecutable,
    chromiumOptions,
    envVariables,
    inputProps,
    onBrowserLog,
    port,
    puppeteerInstance,
    timeoutInMilliseconds,
    verbose,
    logLevel: passedLogLevel,
    offthreadVideoCacheSizeInBytes,
    binariesDirectory,
    onBrowserDownload,
    chromeMode,
    offthreadVideoThreads,
    mediaCacheSizeInBytes
  } = options;
  const indent = false;
  const logLevel = passedLogLevel ?? (verbose ? "verbose" : "info");
  const data = await internalSelectComposition({
    id,
    serveUrl,
    browserExecutable: browserExecutable ?? null,
    chromiumOptions: chromiumOptions ?? {},
    envVariables: envVariables ?? {},
    serializedInputPropsWithCustomSchema: NoReactInternals.serializeJSONWithSpecialTypes({
      indent: void 0,
      staticBase: null,
      data: inputProps ?? {}
    }).serializedString,
    onBrowserLog: onBrowserLog ?? null,
    port: port ?? null,
    puppeteerInstance,
    timeoutInMilliseconds: timeoutInMilliseconds ?? DEFAULT_TIMEOUT,
    logLevel,
    indent,
    server: void 0,
    offthreadVideoCacheSizeInBytes: offthreadVideoCacheSizeInBytes ?? null,
    binariesDirectory: binariesDirectory ?? null,
    onBrowserDownload: onBrowserDownload ?? defaultBrowserDownloadProgress({
      indent,
      logLevel,
      api: "selectComposition()"
    }),
    onServeUrlVisited: /* @__PURE__ */ __name(() => {
      return;
    }, "onServeUrlVisited"),
    chromeMode: chromeMode ?? "headless-shell",
    offthreadVideoThreads: offthreadVideoThreads ?? null,
    mediaCacheSizeInBytes: mediaCacheSizeInBytes ?? null
  });
  return data.metadata;
}, "selectComposition");
var getChromiumGpuInformation = /* @__PURE__ */ __name(async ({
  browserExecutable,
  indent,
  logLevel,
  chromiumOptions,
  timeoutInMilliseconds,
  onBrowserDownload,
  chromeMode,
  onLog
}) => {
  const { page, cleanupPage: cleanup } = await getPageAndCleanupFn({
    passedInInstance: void 0,
    browserExecutable,
    chromiumOptions,
    forceDeviceScaleFactor: void 0,
    indent,
    logLevel,
    onBrowserDownload,
    chromeMode,
    pageIndex: 0,
    onBrowserLog: null,
    onLog
  });
  await page.goto({ url: "chrome://gpu", timeout: 12e3 });
  const { value } = await puppeteerEvaluateWithCatch({
    pageFunction: /* @__PURE__ */ __name(() => {
      const statuses = [];
      const items = document.querySelector("info-view")?.shadowRoot?.querySelector("ul")?.querySelectorAll("li");
      [].forEach.call(items, (item) => {
        const [feature, status] = item.innerText.split(": ");
        statuses.push({
          feature,
          status
        });
      });
      return statuses;
    }, "pageFunction"),
    frame: null,
    args: [],
    page,
    timeoutInMilliseconds
  });
  cleanup();
  return value;
}, "getChromiumGpuInformation");
var validateConcurrency = /* @__PURE__ */ __name(({
  setting,
  value,
  checkIfValidForCurrentMachine
}) => {
  if (typeof value === "undefined") {
    return;
  }
  if (value === null) {
    return;
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(setting + " must a number or a string but is " + value);
  }
  if (typeof value === "number") {
    if (value % 1 !== 0) {
      throw new Error(setting + " must be an integer, but is " + value);
    }
    if (checkIfValidForCurrentMachine) {
      if (value < getMinConcurrency()) {
        throw new Error(`${setting} must be at least ${getMinConcurrency()}, but is ${JSON.stringify(value)}`);
      }
      if (value > getMaxConcurrency()) {
        throw new Error(`${setting} is set higher than the amount of CPU cores available. Available CPU cores: ${getMaxConcurrency()}, value set: ${value}`);
      }
    }
  } else if (!/^\d+(\.\d+)?%$/.test(value)) {
    throw new Error(`${setting} must be a number or percentage, but is ${JSON.stringify(value)}`);
  }
}, "validateConcurrency");
var getMaxConcurrency = /* @__PURE__ */ __name(() => {
  return getCpuCount();
}, "getMaxConcurrency");
var getMinConcurrency = /* @__PURE__ */ __name(() => 1, "getMinConcurrency");
var canConcatAudioSeamlessly = /* @__PURE__ */ __name((audioCodec, chunkDurationInFrames) => {
  if (chunkDurationInFrames <= 4) {
    return false;
  }
  return audioCodec === "aac";
}, "canConcatAudioSeamlessly");
var canConcatVideoSeamlessly = /* @__PURE__ */ __name((codec) => {
  return codec === "h264";
}, "canConcatVideoSeamlessly");
var combineVideoStreams = /* @__PURE__ */ __name(async ({
  fps,
  codec,
  filelistDir,
  numberOfGifLoops,
  output,
  indent,
  logLevel,
  onProgress,
  files,
  addRemotionMetadata,
  binariesDirectory,
  cancelSignal
}) => {
  const fileList = files.map((p) => `file '${p}'`).join(`
`);
  const fileListTxt = join4(filelistDir, "video-files.txt");
  writeFileSync3(fileListTxt, fileList);
  const encoder = codec === "gif" ? "gif" : "copy";
  const command = [
    "-hide_banner",
    "-r",
    String(fps),
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    fileListTxt,
    numberOfGifLoops === null ? null : "-loop",
    numberOfGifLoops === null ? null : convertNumberOfGifLoopsToFfmpegSyntax(numberOfGifLoops),
    codec === "gif" ? "-filter_complex" : null,
    codec === "gif" ? "split[v],palettegen,[v]paletteuse" : null,
    "-an",
    "-c:v",
    encoder,
    codec === "h265" ? "-tag:v" : null,
    codec === "h265" ? "hvc1" : null,
    addRemotionMetadata ? `-metadata` : null,
    addRemotionMetadata ? `comment=Made with Remotion ${VERSION}` : null,
    "-y",
    output
  ].filter(truthy);
  const doesReencode = encoder !== "copy";
  const startTime = Date.now();
  Log.verbose({ indent, logLevel }, `Combining video ${doesReencode ? "with reencoding" : "without reencoding"}, command: ${command.join(" ")}`);
  try {
    const task = callFf({
      args: command,
      bin: "ffmpeg",
      indent,
      logLevel,
      binariesDirectory,
      cancelSignal
    });
    task.stderr?.on("data", (data) => {
      const parsed = parseFfmpegProgress(data.toString("utf8"), fps);
      if (parsed === void 0) {
        Log.verbose({ indent, logLevel }, data.toString("utf8"));
      } else {
        Log.verbose({ indent, logLevel }, `Encoded ${parsed} video frames`);
        onProgress(parsed);
      }
    });
    await task;
    Log.verbose({ indent, logLevel }, `Finished combining video in ${Date.now() - startTime}ms`);
    return output;
  } catch (e) {
    rmSync5(fileListTxt, { recursive: true });
    throw e;
  }
}, "combineVideoStreams");
var combineVideoStreamsSeamlessly = /* @__PURE__ */ __name(({ files }) => {
  const fileList = `concat:${files.join("|")}`;
  return fileList;
}, "combineVideoStreamsSeamlessly");
var muxVideoAndAudio = /* @__PURE__ */ __name(async ({
  videoOutput,
  audioOutput,
  output,
  indent,
  logLevel,
  onProgress,
  binariesDirectory,
  fps,
  cancelSignal,
  addFaststart,
  metadata,
  numberOfGifLoops
}) => {
  const startTime = Date.now();
  Log.verbose({ indent, logLevel }, "Muxing video and audio together");
  const command = [
    "-hide_banner",
    videoOutput ? "-i" : null,
    videoOutput,
    audioOutput ? "-i" : null,
    audioOutput,
    videoOutput ? "-c:v" : null,
    videoOutput ? "copy" : null,
    audioOutput ? "-c:a" : null,
    audioOutput ? "copy" : null,
    videoOutput ? "-r" : null,
    videoOutput ? String(fps) : null,
    numberOfGifLoops === null ? null : "-loop",
    numberOfGifLoops === null ? null : convertNumberOfGifLoopsToFfmpegSyntax(numberOfGifLoops),
    addFaststart ? "-movflags" : null,
    addFaststart ? "faststart" : null,
    ...makeMetadataArgs(metadata ?? {}),
    "-y",
    output
  ].filter(truthy);
  Log.verbose({ indent, logLevel }, "Combining command: ", command);
  const task = callFf({
    bin: "ffmpeg",
    args: command,
    indent,
    logLevel,
    binariesDirectory,
    cancelSignal
  });
  task.stderr?.on("data", (data) => {
    const utf8 = data.toString("utf8");
    const parsed = parseFfmpegProgress(utf8, fps);
    if (parsed === void 0) {
      if (!utf8.includes("Estimating duration from bitrate, this may be inaccurate")) {
        Log.verbose({ indent, logLevel }, utf8);
      }
    } else {
      Log.verbose({ indent, logLevel }, `Combined ${parsed} frames`);
      onProgress(parsed);
    }
  });
  await task;
  Log.verbose({ indent, logLevel }, `Muxing done in ${Date.now() - startTime}ms`);
}, "muxVideoAndAudio");
var codecSupportsFastStart = {
  "h264-mkv": false,
  "h264-ts": false,
  h264: true,
  h265: true,
  av1: true,
  aac: false,
  gif: false,
  mp3: false,
  prores: false,
  vp8: false,
  vp9: false,
  wav: false
};
var REMOTION_FILELIST_TOKEN = "remotion-filelist";
var internalCombineChunks = /* @__PURE__ */ __name(async ({
  outputLocation: output,
  onProgress,
  codec,
  fps,
  numberOfGifLoops,
  audioBitrate,
  indent,
  logLevel,
  binariesDirectory,
  cancelSignal,
  metadata,
  audioFiles,
  videoFiles,
  framesPerChunk,
  audioCodec,
  preferLossless,
  everyNthFrame,
  frameRange,
  compositionDurationInFrames,
  sampleRate
}) => {
  validateNumberOfGifLoops(numberOfGifLoops, codec);
  const filelistDir = tmpDir(REMOTION_FILELIST_TOKEN);
  const shouldCreateVideo = !isAudioCodec(codec);
  const resolvedAudioCodec = resolveAudioCodec({
    setting: audioCodec,
    codec,
    preferLossless,
    separateAudioTo: null
  });
  const shouldCreateAudio = resolvedAudioCodec !== null && audioFiles.length > 0;
  const seamlessVideo = canConcatVideoSeamlessly(codec);
  const seamlessAudio = canConcatAudioSeamlessly(resolvedAudioCodec, framesPerChunk);
  const realFrameRange = getRealFrameRange(compositionDurationInFrames, frameRange);
  const numberOfFrames = getFramesToRender(realFrameRange, everyNthFrame).length;
  const videoOutput = shouldCreateVideo ? join5(filelistDir, `video.${getFileExtensionFromCodec(codec, resolvedAudioCodec)}`) : null;
  const audioOutput = shouldCreateAudio ? join5(filelistDir, `audio.${getExtensionFromAudioCodec(resolvedAudioCodec)}`) : null;
  const chunkDurationInSeconds = framesPerChunk / fps;
  let concatenatedAudio = 0;
  let concatenatedVideo = 0;
  let muxing = 0;
  const updateProgress = /* @__PURE__ */ __name(() => {
    const totalFrames = (shouldCreateAudio ? numberOfFrames : 0) + (shouldCreateVideo ? numberOfFrames : 0) + numberOfFrames;
    const actualProgress = concatenatedAudio + concatenatedVideo + muxing;
    onProgress({
      frames: actualProgress / totalFrames * numberOfFrames,
      totalProgress: actualProgress / totalFrames
    });
  }, "updateProgress");
  Log.verbose({ indent, logLevel }, `Combining chunks, audio = ${shouldCreateAudio === false ? "no" : seamlessAudio ? "seamlessly" : "normally"}, video = ${shouldCreateVideo === false ? "no" : seamlessVideo ? "seamlessly" : "normally"}`);
  await Promise.all([
    shouldCreateAudio && audioOutput ? createCombinedAudio({
      audioBitrate,
      filelistDir,
      files: audioFiles,
      indent,
      logLevel,
      output: audioOutput,
      resolvedAudioCodec,
      seamless: seamlessAudio,
      chunkDurationInSeconds,
      addRemotionMetadata: !shouldCreateVideo,
      binariesDirectory,
      fps,
      cancelSignal,
      onProgress: /* @__PURE__ */ __name((frames) => {
        concatenatedAudio = frames;
        updateProgress();
      }, "onProgress"),
      sampleRate
    }) : null,
    shouldCreateVideo && !seamlessVideo && videoOutput ? combineVideoStreams({
      codec,
      filelistDir,
      fps,
      indent,
      logLevel,
      numberOfGifLoops,
      output: videoOutput,
      files: videoFiles,
      addRemotionMetadata: !shouldCreateAudio,
      binariesDirectory,
      cancelSignal,
      onProgress: /* @__PURE__ */ __name((frames) => {
        concatenatedVideo = frames;
        updateProgress();
      }, "onProgress")
    }) : null
  ].filter(truthy));
  try {
    await muxVideoAndAudio({
      audioOutput,
      indent,
      logLevel,
      onProgress: /* @__PURE__ */ __name((frames) => {
        muxing = frames;
        updateProgress();
      }, "onProgress"),
      output,
      videoOutput: seamlessVideo ? combineVideoStreamsSeamlessly({ files: videoFiles }) : videoOutput,
      binariesDirectory,
      fps,
      cancelSignal,
      addFaststart: codecSupportsFastStart[codec],
      metadata,
      numberOfGifLoops
    });
    onProgress({ totalProgress: 1, frames: numberOfFrames });
    rmSync6(filelistDir, { recursive: true });
  } catch (err) {
    rmSync6(filelistDir, { recursive: true });
    throw err;
  }
}, "internalCombineChunks");
var combineChunks = /* @__PURE__ */ __name((options) => {
  return internalCombineChunks({
    audioBitrate: options.audioBitrate ?? null,
    numberOfGifLoops: options.numberOfGifLoops ?? null,
    indent: false,
    logLevel: options.logLevel ?? "info",
    binariesDirectory: options.binariesDirectory ?? null,
    cancelSignal: options.cancelSignal,
    metadata: options.metadata ?? null,
    audioCodec: options.audioCodec ?? null,
    preferLossless: options.preferLossless,
    audioFiles: options.audioFiles,
    codec: options.codec,
    fps: options.fps,
    framesPerChunk: options.framesPerChunk,
    outputLocation: options.outputLocation,
    onProgress: options.onProgress ?? (() => {
    }),
    videoFiles: options.videoFiles,
    everyNthFrame: options.everyNthFrame ?? 1,
    frameRange: options.frameRange ?? null,
    compositionDurationInFrames: options.compositionDurationInFrames,
    sampleRate: options.sampleRate ?? 48e3
  });
}, "combineChunks");
var extractAudio = /* @__PURE__ */ __name(async (options) => {
  const compositor = startLongRunningCompositor({
    maximumFrameCacheItemsInBytes: null,
    logLevel: options?.logLevel ?? "info",
    indent: false,
    binariesDirectory: options.binariesDirectory ?? null,
    extraThreads: 0
  });
  await compositor.executeCommand("ExtractAudio", {
    input_path: options.videoSource,
    output_path: options.audioOutput
  });
  await compositor.finishCommands();
  await compositor.waitForDone();
}, "extractAudio");
var getSilentParts = /* @__PURE__ */ __name(async ({
  src,
  noiseThresholdInDecibels: passedNoiseThresholdInDecibels,
  minDurationInSeconds: passedMinDuration,
  logLevel,
  binariesDirectory
}) => {
  const compositor = startLongRunningCompositor({
    maximumFrameCacheItemsInBytes: null,
    logLevel: logLevel ?? "info",
    indent: false,
    binariesDirectory: binariesDirectory ?? null,
    extraThreads: 0
  });
  const minDurationInSeconds = passedMinDuration ?? 1;
  if (typeof minDurationInSeconds !== "number") {
    throw new Error(`minDurationInSeconds must be a number, but was ${minDurationInSeconds}`);
  }
  if (minDurationInSeconds <= 0) {
    throw new Error(`minDurationInSeconds must be greater than 0, but was ${minDurationInSeconds}`);
  }
  const noiseThresholdInDecibels = passedNoiseThresholdInDecibels ?? -20;
  if (typeof noiseThresholdInDecibels !== "number") {
    throw new Error(`noiseThresholdInDecibels must be a number, but was ${noiseThresholdInDecibels}`);
  }
  if (noiseThresholdInDecibels >= 30) {
    throw new Error(`noiseThresholdInDecibels must be less than 30, but was ${noiseThresholdInDecibels}`);
  }
  const res = await compositor.executeCommand("GetSilences", {
    src,
    minDurationInSeconds,
    noiseThresholdInDecibels
  });
  const response = JSON.parse(new TextDecoder("utf-8").decode(res));
  await compositor.finishCommands();
  await compositor.waitForDone();
  const { silentParts, durationInSeconds } = response;
  return {
    silentParts,
    audibleParts: getAudibleParts({ silentParts, durationInSeconds }),
    durationInSeconds
  };
}, "getSilentParts");
var getAudibleParts = /* @__PURE__ */ __name(({
  silentParts,
  durationInSeconds
}) => {
  const audibleParts = [];
  let lastEnd = 0;
  for (const silentPart of silentParts) {
    if (silentPart.startInSeconds - lastEnd > 0) {
      audibleParts.push({
        startInSeconds: lastEnd,
        endInSeconds: silentPart.startInSeconds
      });
    }
    lastEnd = silentPart.endInSeconds;
  }
  if (durationInSeconds - lastEnd > 0) {
    audibleParts.push({
      startInSeconds: lastEnd,
      endInSeconds: durationInSeconds
    });
  }
  return audibleParts;
}, "getAudibleParts");
var getVideoMetadata = /* @__PURE__ */ __name(async (videoSource, options) => {
  const compositor = startLongRunningCompositor({
    maximumFrameCacheItemsInBytes: null,
    logLevel: options?.logLevel ?? "info",
    indent: false,
    binariesDirectory: options?.binariesDirectory ?? null,
    extraThreads: 0
  });
  const metadataResponse = await compositor.executeCommand("GetVideoMetadata", {
    src: resolve2(process.cwd(), videoSource)
  });
  await compositor.finishCommands();
  await compositor.waitForDone();
  return JSON.parse(new TextDecoder("utf-8").decode(metadataResponse));
}, "getVideoMetadata");
var RenderInternals = {
  resolveConcurrency,
  serveStatic,
  validateEvenDimensionsWithCodec,
  getFileExtensionFromCodec,
  tmpDir,
  deleteDirectory,
  isServeUrl,
  ensureOutputDirectory,
  getRealFrameRange,
  validatePuppeteerTimeout,
  downloadFile,
  parseStack,
  symbolicateError,
  SymbolicateableError,
  getFramesToRender,
  getExtensionOfFilename,
  getDesiredPort,
  isPathInside,
  execa: import_execa.default,
  registerErrorSymbolicationLock,
  unlockErrorSymbolicationLock,
  canUseParallelEncoding,
  mimeContentType,
  mimeLookup,
  validateConcurrency,
  validPixelFormats,
  DEFAULT_BROWSER,
  validateFrameRange,
  DEFAULT_OPENGL_RENDERER,
  validateOpenGlRenderer,
  validCodecs,
  DEFAULT_PIXEL_FORMAT,
  validateJpegQuality,
  DEFAULT_TIMEOUT,
  DEFAULT_CODEC,
  logLevels,
  isEqualOrBelowLogLevel,
  isValidLogLevel,
  perf: exports_perf,
  convertToPositiveFrameIndex,
  findRemotionRoot,
  validateBitrate,
  getMinConcurrency,
  getMaxConcurrency,
  getDefaultAudioCodec,
  defaultFileExtensionMap,
  supportedAudioCodecs,
  makeFileExtensionMap,
  defaultCodecsForFileExtension,
  getExecutablePath,
  callFf,
  validStillImageFormats,
  validVideoImageFormats,
  DEFAULT_STILL_IMAGE_FORMAT,
  DEFAULT_VIDEO_IMAGE_FORMAT,
  DEFAULT_JPEG_QUALITY,
  chalk,
  Log,
  INDENT_TOKEN,
  isColorSupported,
  HeadlessBrowser,
  prepareServer,
  makeOrReuseServer,
  internalRenderStill,
  internalOpenBrowser,
  internalSelectComposition,
  internalGetCompositions,
  internalRenderFrames,
  internalRenderMedia,
  validOpenGlRenderers,
  isIpV6Supported,
  getChromiumGpuInformation,
  getPortConfig,
  makeDownloadMap,
  getExtensionFromAudioCodec,
  makeFileExecutableIfItIsNot,
  resolveAudioCodec,
  getShouldRenderAudio,
  codecSupportsMedia,
  toMegabytes,
  internalEnsureBrowser,
  printUsefulErrorMessage,
  DEFAULT_RENDER_FRAMES_OFFTHREAD_VIDEO_THREADS,
  canConcatVideoSeamlessly,
  canConcatAudioSeamlessly,
  internalCombineChunks,
  defaultOnLog
};
checkRuntimeVersion("info", false);
export {
  ErrorWithStackFrame,
  RenderInternals,
  combineChunks,
  ensureBrowser,
  extractAudio,
  getCompositions,
  getSilentParts,
  getVideoMetadata,
  makeCancelSignal,
  openBrowser,
  renderFrames,
  renderMedia,
  renderStill,
  selectComposition,
  stitchFramesToVideo,
  validateOutputFilename,
  validateSelectedPixelFormatAndImageFormatCombination
};
/*! Bundled license information:

@remotion/renderer/dist/esm/index.mjs:
  (*!
   * range-parser
   * Copyright(c) 2012-2014 TJ Holowaychuk
   * Copyright(c) 2015-2016 Douglas Christopher Wilson
   * MIT Licensed
   *)
*/
//# sourceMappingURL=esm-5QTOPBTQ.mjs.map
