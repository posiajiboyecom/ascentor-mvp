import {
  __commonJS,
  __esm,
  __export,
  __name,
  __require,
  init_esm
} from "./chunk-UQUWQY52.mjs";

// node_modules/remotion/dist/esm/no-react.mjs
var no_react_exports = {};
__export(no_react_exports, {
  NoReactInternals: () => NoReactInternals,
  interpolate: () => interpolate,
  random: () => random
});
function interpolateFunction(input, inputRange, outputRange, options) {
  const { extrapolateLeft, extrapolateRight, easing } = options;
  let result = input;
  const [inputMin, inputMax] = inputRange;
  const [outputMin, outputMax] = outputRange;
  if (result < inputMin) {
    if (extrapolateLeft === "identity") {
      return result;
    }
    if (extrapolateLeft === "clamp") {
      result = inputMin;
    } else if (extrapolateLeft === "wrap") {
      const range = inputMax - inputMin;
      result = ((result - inputMin) % range + range) % range + inputMin;
    } else if (extrapolateLeft === "extend") {
    }
  }
  if (result > inputMax) {
    if (extrapolateRight === "identity") {
      return result;
    }
    if (extrapolateRight === "clamp") {
      result = inputMax;
    } else if (extrapolateRight === "wrap") {
      const range = inputMax - inputMin;
      result = ((result - inputMin) % range + range) % range + inputMin;
    } else if (extrapolateRight === "extend") {
    }
  }
  if (outputMin === outputMax) {
    return outputMin;
  }
  result = (result - inputMin) / (inputMax - inputMin);
  result = easing(result);
  result = result * (outputMax - outputMin) + outputMin;
  return result;
}
function findRange(input, inputRange) {
  let i;
  for (i = 1; i < inputRange.length - 1; ++i) {
    if (inputRange[i] >= input) {
      break;
    }
  }
  return i - 1;
}
function checkValidInputRange(arr) {
  for (let i = 1; i < arr.length; ++i) {
    if (!(arr[i] > arr[i - 1])) {
      throw new Error(`inputRange must be strictly monotonically increasing but got [${arr.join(",")}]`);
    }
  }
}
function checkInfiniteRange(name, arr) {
  if (arr.length < 2) {
    throw new Error(name + " must have at least 2 elements");
  }
  for (const element of arr) {
    if (typeof element !== "number") {
      throw new Error(`${name} must contain only numbers`);
    }
    if (!Number.isFinite(element)) {
      throw new Error(`${name} must contain only finite numbers, but got [${arr.join(",")}]`);
    }
  }
}
function interpolate(input, inputRange, outputRange, options) {
  if (typeof input === "undefined") {
    throw new Error("input can not be undefined");
  }
  if (typeof inputRange === "undefined") {
    throw new Error("inputRange can not be undefined");
  }
  if (typeof outputRange === "undefined") {
    throw new Error("outputRange can not be undefined");
  }
  if (inputRange.length !== outputRange.length) {
    throw new Error("inputRange (" + inputRange.length + ") and outputRange (" + outputRange.length + ") must have the same length");
  }
  checkInfiniteRange("inputRange", inputRange);
  checkInfiniteRange("outputRange", outputRange);
  checkValidInputRange(inputRange);
  const easing = options?.easing ?? ((num) => num);
  let extrapolateLeft = "extend";
  if (options?.extrapolateLeft !== void 0) {
    extrapolateLeft = options.extrapolateLeft;
  }
  let extrapolateRight = "extend";
  if (options?.extrapolateRight !== void 0) {
    extrapolateRight = options.extrapolateRight;
  }
  if (typeof input !== "number") {
    throw new TypeError("Cannot interpolate an input which is not a number");
  }
  const range = findRange(input, inputRange);
  return interpolateFunction(input, [inputRange[range], inputRange[range + 1]], [outputRange[range], outputRange[range + 1]], {
    easing,
    extrapolateLeft,
    extrapolateRight
  });
}
function mulberry32(a) {
  let t = a + 1831565813;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function hashCode(str) {
  let i = 0;
  let chr = 0;
  let hash = 0;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}
function truthy(value) {
  return Boolean(value);
}
function call(...args) {
  return "\\(\\s*(" + args.join(")\\s*,\\s*(") + ")\\s*\\)";
}
function modernColorCall(name) {
  return new RegExp(name + "\\(\\s*(" + MODERN_VALUE + ")\\s+(" + MODERN_VALUE + ")\\s+(" + MODERN_VALUE + ")(?:\\s*\\/\\s*(" + MODERN_VALUE + "))?\\s*\\)");
}
function getMatchers() {
  const cachedMatchers = {
    rgb: void 0,
    rgba: void 0,
    hsl: void 0,
    hsla: void 0,
    hex3: void 0,
    hex4: void 0,
    hex5: void 0,
    hex6: void 0,
    hex8: void 0,
    oklch: void 0,
    oklab: void 0,
    lab: void 0,
    lch: void 0,
    hwb: void 0
  };
  if (cachedMatchers.rgb === void 0) {
    cachedMatchers.rgb = new RegExp("rgb" + call(NUMBER, NUMBER, NUMBER));
    cachedMatchers.rgba = new RegExp("rgba" + call(NUMBER, NUMBER, NUMBER, NUMBER));
    cachedMatchers.hsl = new RegExp("hsl" + call(NUMBER, PERCENTAGE, PERCENTAGE));
    cachedMatchers.hsla = new RegExp("hsla" + call(NUMBER, PERCENTAGE, PERCENTAGE, NUMBER));
    cachedMatchers.hex3 = /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/;
    cachedMatchers.hex4 = /^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/;
    cachedMatchers.hex6 = /^#([0-9a-fA-F]{6})$/;
    cachedMatchers.hex8 = /^#([0-9a-fA-F]{8})$/;
    cachedMatchers.oklch = modernColorCall("oklch");
    cachedMatchers.oklab = modernColorCall("oklab");
    cachedMatchers.lab = modernColorCall("lab");
    cachedMatchers.lch = modernColorCall("lch");
    cachedMatchers.hwb = modernColorCall("hwb");
  }
  return cachedMatchers;
}
function hue2rgb(p, q, t) {
  if (t < 0) {
    t += 1;
  }
  if (t > 1) {
    t -= 1;
  }
  if (t < 1 / 6) {
    return p + (q - p) * 6 * t;
  }
  if (t < 1 / 2) {
    return q;
  }
  if (t < 2 / 3) {
    return p + (q - p) * (2 / 3 - t) * 6;
  }
  return p;
}
function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return Math.round(r * 255) << 24 | Math.round(g * 255) << 16 | Math.round(b * 255) << 8;
}
function parse255(str) {
  const int = Number.parseInt(str, 10);
  if (int < 0) {
    return 0;
  }
  if (int > 255) {
    return 255;
  }
  return int;
}
function parse360(str) {
  const int = Number.parseFloat(str);
  return (int % 360 + 360) % 360 / 360;
}
function parse1(str) {
  const num = Number.parseFloat(str);
  if (num < 0) {
    return 0;
  }
  if (num > 1) {
    return 255;
  }
  return Math.round(num * 255);
}
function parsePercentage(str) {
  const int = Number.parseFloat(str);
  if (int < 0) {
    return 0;
  }
  if (int > 100) {
    return 1;
  }
  return int / 100;
}
function parseModernComponent(str, percentScale) {
  if (str === "none")
    return 0;
  if (str.endsWith("%")) {
    return Number.parseFloat(str) / 100 * percentScale;
  }
  return Number.parseFloat(str);
}
function parseHueAngle(str) {
  if (str === "none")
    return 0;
  if (str.endsWith("rad")) {
    return Number.parseFloat(str) * 180 / Math.PI;
  }
  if (str.endsWith("grad"))
    return Number.parseFloat(str) * 0.9;
  if (str.endsWith("turn"))
    return Number.parseFloat(str) * 360;
  return Number.parseFloat(str);
}
function parseModernAlpha(str) {
  if (str === void 0 || str === "none")
    return 1;
  if (str.endsWith("%")) {
    return Math.max(0, Math.min(1, Number.parseFloat(str) / 100));
  }
  return Math.max(0, Math.min(1, Number.parseFloat(str)));
}
function linearToSrgb(c) {
  if (c <= 31308e-7)
    return 12.92 * c;
  return 1.055 * c ** (1 / 2.4) - 0.055;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function rgbFloatToInt(r, g, b, alpha) {
  const ri = Math.round(clamp01(r) * 255);
  const gi = Math.round(clamp01(g) * 255);
  const bi = Math.round(clamp01(b) * 255);
  const ai = Math.round(clamp01(alpha) * 255);
  return (ri << 24 | gi << 16 | bi << 8 | ai) >>> 0;
}
function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [linearToSrgb(rLin), linearToSrgb(gLin), linearToSrgb(bLin)];
}
function labToSrgb(L, a, b) {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const Xn = 0.95047;
  const Yn = 1;
  const Zn = 1.08883;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;
  const xr = fx3 > epsilon ? fx3 : (116 * fx - 16) / kappa;
  const yr = L > kappa * epsilon ? ((L + 16) / 116) ** 3 : L / kappa;
  const zr = fz3 > epsilon ? fz3 : (116 * fz - 16) / kappa;
  const X = xr * Xn;
  const Y = yr * Yn;
  const Z = zr * Zn;
  const rLin = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gLin = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  const bLin = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return [linearToSrgb(rLin), linearToSrgb(gLin), linearToSrgb(bLin)];
}
function hwbToSrgb(h, w, bk) {
  if (w + bk >= 1) {
    const gray = w / (w + bk);
    return [gray, gray, gray];
  }
  const q = 1;
  const p = 0;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const bl = hue2rgb(p, q, h - 1 / 3);
  const factor = 1 - w - bk;
  return [r * factor + w, g * factor + w, bl * factor + w];
}
function normalizeColor(color) {
  const matchers = getMatchers();
  let match;
  if (matchers.hex6) {
    if (match = matchers.hex6.exec(color)) {
      return Number.parseInt(match[1] + "ff", 16) >>> 0;
    }
  }
  if (colorNames[color] !== void 0) {
    return colorNames[color];
  }
  if (matchers.rgb) {
    if (match = matchers.rgb.exec(color)) {
      return (parse255(match[1]) << 24 | parse255(match[2]) << 16 | parse255(match[3]) << 8 | 255) >>> 0;
    }
  }
  if (matchers.rgba) {
    if (match = matchers.rgba.exec(color)) {
      return (parse255(match[1]) << 24 | parse255(match[2]) << 16 | parse255(match[3]) << 8 | parse1(match[4])) >>> 0;
    }
  }
  if (matchers.hex3) {
    if (match = matchers.hex3.exec(color)) {
      return Number.parseInt(match[1] + match[1] + match[2] + match[2] + match[3] + match[3] + "ff", 16) >>> 0;
    }
  }
  if (matchers.hex8) {
    if (match = matchers.hex8.exec(color)) {
      return Number.parseInt(match[1], 16) >>> 0;
    }
  }
  if (matchers.hex4) {
    if (match = matchers.hex4.exec(color)) {
      return Number.parseInt(match[1] + match[1] + match[2] + match[2] + match[3] + match[3] + match[4] + match[4], 16) >>> 0;
    }
  }
  if (matchers.hsl) {
    if (match = matchers.hsl.exec(color)) {
      return (hslToRgb(parse360(match[1]), parsePercentage(match[2]), parsePercentage(match[3])) | 255) >>> 0;
    }
  }
  if (matchers.hsla) {
    if (match = matchers.hsla.exec(color)) {
      return (hslToRgb(parse360(match[1]), parsePercentage(match[2]), parsePercentage(match[3])) | parse1(match[4])) >>> 0;
    }
  }
  if (matchers.oklch) {
    if (match = matchers.oklch.exec(color)) {
      const L = parseModernComponent(match[1], 1);
      const C = parseModernComponent(match[2], 0.4);
      const H = parseHueAngle(match[3]);
      const alpha = parseModernAlpha(match[4]);
      const hRad = H * Math.PI / 180;
      const [r, g, b] = oklabToSrgb(L, C * Math.cos(hRad), C * Math.sin(hRad));
      return rgbFloatToInt(r, g, b, alpha);
    }
  }
  if (matchers.oklab) {
    if (match = matchers.oklab.exec(color)) {
      const L = parseModernComponent(match[1], 1);
      const a = parseModernComponent(match[2], 0.4);
      const b = parseModernComponent(match[3], 0.4);
      const alpha = parseModernAlpha(match[4]);
      const [r, g, bl] = oklabToSrgb(L, a, b);
      return rgbFloatToInt(r, g, bl, alpha);
    }
  }
  if (matchers.lab) {
    if (match = matchers.lab.exec(color)) {
      const L = parseModernComponent(match[1], 100);
      const a = parseModernComponent(match[2], 125);
      const b = parseModernComponent(match[3], 125);
      const alpha = parseModernAlpha(match[4]);
      const [r, g, bl] = labToSrgb(L, a, b);
      return rgbFloatToInt(r, g, bl, alpha);
    }
  }
  if (matchers.lch) {
    if (match = matchers.lch.exec(color)) {
      const L = parseModernComponent(match[1], 100);
      const C = parseModernComponent(match[2], 150);
      const H = parseHueAngle(match[3]);
      const alpha = parseModernAlpha(match[4]);
      const hRad = H * Math.PI / 180;
      const [r, g, bl] = labToSrgb(L, C * Math.cos(hRad), C * Math.sin(hRad));
      return rgbFloatToInt(r, g, bl, alpha);
    }
  }
  if (matchers.hwb) {
    if (match = matchers.hwb.exec(color)) {
      const H = parseHueAngle(match[1]);
      const W = parseModernComponent(match[2], 1);
      const B = parseModernComponent(match[3], 1);
      const alpha = parseModernAlpha(match[4]);
      const [r, g, bl] = hwbToSrgb(H / 360, W, B);
      return rgbFloatToInt(r, g, bl, alpha);
    }
  }
  throw new Error(`invalid color string ${color} provided`);
}
function processColor(color) {
  const normalizedColor = normalizeColor(color);
  return (normalizedColor << 24 | normalizedColor >>> 8) >>> 0;
}
function validateCodec(defaultCodec, location, name) {
  if (typeof defaultCodec === "undefined") {
    return;
  }
  if (typeof defaultCodec !== "string") {
    throw new TypeError(`The "${name}" prop ${location} must be a string, but you passed a value of type ${typeof defaultCodec}.`);
  }
  if (!validCodecs.includes(defaultCodec)) {
    throw new Error(`The "${name}" prop ${location} must be one of ${validCodecs.join(", ")}, but you passed ${defaultCodec}.`);
  }
}
function validateDimension(amount, nameOfProp, location) {
  if (typeof amount !== "number") {
    throw new Error(`The "${nameOfProp}" prop ${location} must be a number, but you passed a value of type ${typeof amount}`);
  }
  if (isNaN(amount)) {
    throw new TypeError(`The "${nameOfProp}" prop ${location} must not be NaN, but is NaN.`);
  }
  if (!Number.isFinite(amount)) {
    throw new TypeError(`The "${nameOfProp}" prop ${location} must be finite, but is ${amount}.`);
  }
  if (amount % 1 !== 0) {
    throw new TypeError(`The "${nameOfProp}" prop ${location} must be an integer, but is ${amount}.`);
  }
  if (amount <= 0) {
    throw new TypeError(`The "${nameOfProp}" prop ${location} must be positive, but got ${amount}.`);
  }
}
function validateDurationInFrames(durationInFrames, options) {
  const { allowFloats, component } = options;
  if (typeof durationInFrames === "undefined") {
    throw new Error(`The "durationInFrames" prop ${component} is missing.`);
  }
  if (typeof durationInFrames !== "number") {
    throw new Error(`The "durationInFrames" prop ${component} must be a number, but you passed a value of type ${typeof durationInFrames}`);
  }
  if (durationInFrames <= 0) {
    throw new TypeError(`The "durationInFrames" prop ${component} must be positive, but got ${durationInFrames}.`);
  }
  if (!allowFloats && durationInFrames % 1 !== 0) {
    throw new TypeError(`The "durationInFrames" prop ${component} must be an integer, but got ${durationInFrames}.`);
  }
  if (!Number.isFinite(durationInFrames)) {
    throw new TypeError(`The "durationInFrames" prop ${component} must be finite, but got ${durationInFrames}.`);
  }
}
function validateFps(fps, location, isGif) {
  if (typeof fps !== "number") {
    throw new Error(`"fps" must be a number, but you passed a value of type ${typeof fps} ${location}`);
  }
  if (!Number.isFinite(fps)) {
    throw new Error(`"fps" must be a finite, but you passed ${fps} ${location}`);
  }
  if (isNaN(fps)) {
    throw new Error(`"fps" must not be NaN, but got ${fps} ${location}`);
  }
  if (fps <= 0) {
    throw new TypeError(`"fps" must be positive, but got ${fps} ${location}`);
  }
  if (isGif && fps > 50) {
    throw new TypeError(`The FPS for a GIF cannot be higher than 50. Use the --every-nth-frame option to lower the FPS: https://remotion.dev/docs/render-as-gif`);
  }
}
var random, DELAY_RENDER_CALLSTACK_TOKEN, DELAY_RENDER_RETRIES_LEFT, DELAY_RENDER_RETRY_TOKEN, DELAY_RENDER_CLEAR_TOKEN, DATE_TOKEN, FILE_TOKEN, serializeJSONWithSpecialTypes, deserializeJSONWithSpecialTypes, NUMBER, PERCENTAGE, MODERN_VALUE, colorNames, proResProfileOptions, ENABLE_V5_BREAKING_CHANGES, validateFrame, validCodecs, validateDefaultAndInputProps, getExpectedMediaFrameUncorrected, getAbsoluteSrc, getOffthreadVideoSource, NoReactInternals;
var init_no_react = __esm({
  "node_modules/remotion/dist/esm/no-react.mjs"() {
    init_esm();
    __name(interpolateFunction, "interpolateFunction");
    __name(findRange, "findRange");
    __name(checkValidInputRange, "checkValidInputRange");
    __name(checkInfiniteRange, "checkInfiniteRange");
    __name(interpolate, "interpolate");
    __name(mulberry32, "mulberry32");
    __name(hashCode, "hashCode");
    random = /* @__PURE__ */ __name((seed, dummy) => {
      if (dummy !== void 0) {
        throw new TypeError("random() takes only one argument");
      }
      if (seed === null) {
        return Math.random();
      }
      if (typeof seed === "string") {
        return mulberry32(hashCode(seed));
      }
      if (typeof seed === "number") {
        return mulberry32(seed * 1e10);
      }
      throw new Error("random() argument must be a number or a string");
    }, "random");
    __name(truthy, "truthy");
    if (typeof window !== "undefined") {
      window.remotion_renderReady = false;
      if (!window.remotion_delayRenderTimeouts) {
        window.remotion_delayRenderTimeouts = {};
      }
      window.remotion_delayRenderHandles = [];
    }
    DELAY_RENDER_CALLSTACK_TOKEN = "The delayRender was called:";
    DELAY_RENDER_RETRIES_LEFT = "Retries left: ";
    DELAY_RENDER_RETRY_TOKEN = "- Rendering the frame will be retried.";
    DELAY_RENDER_CLEAR_TOKEN = "handle was cleared after";
    DATE_TOKEN = "remotion-date:";
    FILE_TOKEN = "remotion-file:";
    serializeJSONWithSpecialTypes = /* @__PURE__ */ __name(({
      data,
      indent,
      staticBase
    }) => {
      let customDateUsed = false;
      let customFileUsed = false;
      let mapUsed = false;
      let setUsed = false;
      try {
        const serializedString = JSON.stringify(data, function(key, value) {
          const item = this[key];
          if (item instanceof Date) {
            customDateUsed = true;
            return `${DATE_TOKEN}${item.toISOString()}`;
          }
          if (item instanceof Map) {
            mapUsed = true;
            return value;
          }
          if (item instanceof Set) {
            setUsed = true;
            return value;
          }
          if (typeof item === "string" && staticBase !== null && item.startsWith(staticBase)) {
            customFileUsed = true;
            return `${FILE_TOKEN}${item.replace(staticBase + "/", "")}`;
          }
          return value;
        }, indent);
        return { serializedString, customDateUsed, customFileUsed, mapUsed, setUsed };
      } catch (err) {
        throw new Error("Could not serialize the passed input props to JSON: " + err.message);
      }
    }, "serializeJSONWithSpecialTypes");
    deserializeJSONWithSpecialTypes = /* @__PURE__ */ __name((data) => {
      return JSON.parse(data, (_, value) => {
        if (typeof value === "string" && value.startsWith(DATE_TOKEN)) {
          return new Date(value.replace(DATE_TOKEN, ""));
        }
        if (typeof value === "string" && value.startsWith(FILE_TOKEN)) {
          return `${window.remotion_staticBase}/${value.replace(FILE_TOKEN, "")}`;
        }
        return value;
      });
    }, "deserializeJSONWithSpecialTypes");
    NUMBER = "[-+]?\\d*\\.?\\d+";
    PERCENTAGE = NUMBER + "%";
    __name(call, "call");
    MODERN_VALUE = "(?:none|[-+]?\\d*\\.?\\d+(?:%|deg|rad|grad|turn)?)";
    __name(modernColorCall, "modernColorCall");
    __name(getMatchers, "getMatchers");
    __name(hue2rgb, "hue2rgb");
    __name(hslToRgb, "hslToRgb");
    __name(parse255, "parse255");
    __name(parse360, "parse360");
    __name(parse1, "parse1");
    __name(parsePercentage, "parsePercentage");
    __name(parseModernComponent, "parseModernComponent");
    __name(parseHueAngle, "parseHueAngle");
    __name(parseModernAlpha, "parseModernAlpha");
    __name(linearToSrgb, "linearToSrgb");
    __name(clamp01, "clamp01");
    __name(rgbFloatToInt, "rgbFloatToInt");
    __name(oklabToSrgb, "oklabToSrgb");
    __name(labToSrgb, "labToSrgb");
    __name(hwbToSrgb, "hwbToSrgb");
    colorNames = {
      transparent: 0,
      aliceblue: 4042850303,
      antiquewhite: 4209760255,
      aqua: 16777215,
      aquamarine: 2147472639,
      azure: 4043309055,
      beige: 4126530815,
      bisque: 4293182719,
      black: 255,
      blanchedalmond: 4293643775,
      blue: 65535,
      blueviolet: 2318131967,
      brown: 2771004159,
      burlywood: 3736635391,
      burntsienna: 3934150143,
      cadetblue: 1604231423,
      chartreuse: 2147418367,
      chocolate: 3530104575,
      coral: 4286533887,
      cornflowerblue: 1687547391,
      cornsilk: 4294499583,
      crimson: 3692313855,
      cyan: 16777215,
      darkblue: 35839,
      darkcyan: 9145343,
      darkgoldenrod: 3095792639,
      darkgray: 2846468607,
      darkgreen: 6553855,
      darkgrey: 2846468607,
      darkkhaki: 3182914559,
      darkmagenta: 2332068863,
      darkolivegreen: 1433087999,
      darkorange: 4287365375,
      darkorchid: 2570243327,
      darkred: 2332033279,
      darksalmon: 3918953215,
      darkseagreen: 2411499519,
      darkslateblue: 1211993087,
      darkslategray: 793726975,
      darkslategrey: 793726975,
      darkturquoise: 13554175,
      darkviolet: 2483082239,
      deeppink: 4279538687,
      deepskyblue: 12582911,
      dimgray: 1768516095,
      dimgrey: 1768516095,
      dodgerblue: 512819199,
      firebrick: 2988581631,
      floralwhite: 4294635775,
      forestgreen: 579543807,
      fuchsia: 4278255615,
      gainsboro: 3705462015,
      ghostwhite: 4177068031,
      gold: 4292280575,
      goldenrod: 3668254975,
      gray: 2155905279,
      green: 8388863,
      greenyellow: 2919182335,
      grey: 2155905279,
      honeydew: 4043305215,
      hotpink: 4285117695,
      indianred: 3445382399,
      indigo: 1258324735,
      ivory: 4294963455,
      khaki: 4041641215,
      lavender: 3873897215,
      lavenderblush: 4293981695,
      lawngreen: 2096890111,
      lemonchiffon: 4294626815,
      lightblue: 2916673279,
      lightcoral: 4034953471,
      lightcyan: 3774873599,
      lightgoldenrodyellow: 4210742015,
      lightgray: 3553874943,
      lightgreen: 2431553791,
      lightgrey: 3553874943,
      lightpink: 4290167295,
      lightsalmon: 4288707327,
      lightseagreen: 548580095,
      lightskyblue: 2278488831,
      lightslategray: 2005441023,
      lightslategrey: 2005441023,
      lightsteelblue: 2965692159,
      lightyellow: 4294959359,
      lime: 16711935,
      limegreen: 852308735,
      linen: 4210091775,
      magenta: 4278255615,
      maroon: 2147483903,
      mediumaquamarine: 1724754687,
      mediumblue: 52735,
      mediumorchid: 3126187007,
      mediumpurple: 2473647103,
      mediumseagreen: 1018393087,
      mediumslateblue: 2070474495,
      mediumspringgreen: 16423679,
      mediumturquoise: 1221709055,
      mediumvioletred: 3340076543,
      midnightblue: 421097727,
      mintcream: 4127193855,
      mistyrose: 4293190143,
      moccasin: 4293178879,
      navajowhite: 4292783615,
      navy: 33023,
      oldlace: 4260751103,
      olive: 2155872511,
      olivedrab: 1804477439,
      orange: 4289003775,
      orangered: 4282712319,
      orchid: 3664828159,
      palegoldenrod: 4008225535,
      palegreen: 2566625535,
      paleturquoise: 2951671551,
      palevioletred: 3681588223,
      papayawhip: 4293907967,
      peachpuff: 4292524543,
      peru: 3448061951,
      pink: 4290825215,
      plum: 3718307327,
      powderblue: 2967529215,
      purple: 2147516671,
      rebeccapurple: 1714657791,
      red: 4278190335,
      rosybrown: 3163525119,
      royalblue: 1097458175,
      saddlebrown: 2336560127,
      salmon: 4202722047,
      sandybrown: 4104413439,
      seagreen: 780883967,
      seashell: 4294307583,
      sienna: 2689740287,
      silver: 3233857791,
      skyblue: 2278484991,
      slateblue: 1784335871,
      slategray: 1887473919,
      slategrey: 1887473919,
      snow: 4294638335,
      springgreen: 16744447,
      steelblue: 1182971135,
      tan: 3535047935,
      teal: 8421631,
      thistle: 3636451583,
      tomato: 4284696575,
      turquoise: 1088475391,
      violet: 4001558271,
      wheat: 4125012991,
      white: 4294967295,
      whitesmoke: 4126537215,
      yellow: 4294902015,
      yellowgreen: 2597139199
    };
    __name(normalizeColor, "normalizeColor");
    __name(processColor, "processColor");
    proResProfileOptions = [
      "4444-xq",
      "4444",
      "hq",
      "standard",
      "light",
      "proxy"
    ];
    ENABLE_V5_BREAKING_CHANGES = false;
    validateFrame = /* @__PURE__ */ __name(({
      allowFloats,
      durationInFrames,
      frame
    }) => {
      if (typeof frame === "undefined") {
        throw new TypeError(`Argument missing for parameter "frame"`);
      }
      if (typeof frame !== "number") {
        throw new TypeError(`Argument passed for "frame" is not a number: ${frame}`);
      }
      if (!Number.isFinite(frame)) {
        throw new RangeError(`Frame ${frame} is not finite`);
      }
      if (frame % 1 !== 0 && !allowFloats) {
        throw new RangeError(`Argument for frame must be an integer, but got ${frame}`);
      }
      if (frame < 0 && frame < -durationInFrames) {
        throw new RangeError(`Cannot use frame ${frame}: Duration of composition is ${durationInFrames}, therefore the lowest frame that can be rendered is ${-durationInFrames}`);
      }
      if (frame > durationInFrames - 1) {
        throw new RangeError(`Cannot use frame ${frame}: Duration of composition is ${durationInFrames}, therefore the highest frame that can be rendered is ${durationInFrames - 1}`);
      }
    }, "validateFrame");
    validCodecs = [
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
    __name(validateCodec, "validateCodec");
    validateDefaultAndInputProps = /* @__PURE__ */ __name((defaultProps, name, compositionId) => {
      if (!defaultProps) {
        return;
      }
      if (typeof defaultProps !== "object") {
        throw new Error(`"${name}" must be an object, but you passed a value of type ${typeof defaultProps}`);
      }
      if (Array.isArray(defaultProps)) {
        throw new Error(`"${name}" must be an object, an array was passed ${compositionId ? `for composition "${compositionId}"` : ""}`);
      }
    }, "validateDefaultAndInputProps");
    __name(validateDimension, "validateDimension");
    __name(validateDurationInFrames, "validateDurationInFrames");
    __name(validateFps, "validateFps");
    getExpectedMediaFrameUncorrected = /* @__PURE__ */ __name(({
      frame,
      playbackRate,
      startFrom
    }) => {
      return interpolate(frame, [-1, startFrom, startFrom + 1], [-1, startFrom, startFrom + playbackRate]);
    }, "getExpectedMediaFrameUncorrected");
    getAbsoluteSrc = /* @__PURE__ */ __name((relativeSrc) => {
      if (typeof window === "undefined") {
        return relativeSrc;
      }
      if (relativeSrc.startsWith("http://") || relativeSrc.startsWith("https://") || relativeSrc.startsWith("file://") || relativeSrc.startsWith("blob:") || relativeSrc.startsWith("data:")) {
        return relativeSrc;
      }
      return new URL(relativeSrc, window.origin).href;
    }, "getAbsoluteSrc");
    getOffthreadVideoSource = /* @__PURE__ */ __name(({
      src,
      transparent,
      currentTime,
      toneMapped
    }) => {
      return `http://localhost:${window.remotion_proxyPort}/proxy?src=${encodeURIComponent(getAbsoluteSrc(src))}&time=${encodeURIComponent(Math.max(0, currentTime))}&transparent=${String(transparent)}&toneMapped=${String(toneMapped)}`;
    }, "getOffthreadVideoSource");
    NoReactInternals = {
      processColor,
      truthy,
      validateFps,
      validateDimension,
      validateDurationInFrames,
      validateDefaultAndInputProps,
      validateFrame,
      serializeJSONWithSpecialTypes,
      bundleName: "bundle.js",
      bundleMapName: "bundle.js.map",
      deserializeJSONWithSpecialTypes,
      DELAY_RENDER_CALLSTACK_TOKEN,
      DELAY_RENDER_RETRY_TOKEN,
      DELAY_RENDER_CLEAR_TOKEN,
      DELAY_RENDER_ATTEMPT_TOKEN: DELAY_RENDER_RETRIES_LEFT,
      getOffthreadVideoSource,
      getExpectedMediaFrameUncorrected,
      ENABLE_V5_BREAKING_CHANGES,
      MIN_NODE_VERSION: ENABLE_V5_BREAKING_CHANGES ? 18 : 16,
      MIN_BUN_VERSION: ENABLE_V5_BREAKING_CHANGES ? "1.1.3" : "1.0.3",
      colorNames,
      DATE_TOKEN,
      FILE_TOKEN,
      validateCodec,
      proResProfileOptions
    };
  }
});

// node_modules/react/cjs/react-jsx-runtime.production.js
var require_react_jsx_runtime_production = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.production.js"(exports) {
    "use strict";
    init_esm();
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    function jsxProd(type, config, maybeKey) {
      var key = null;
      void 0 !== maybeKey && (key = "" + maybeKey);
      void 0 !== config.key && (key = "" + config.key);
      if ("key" in config) {
        maybeKey = {};
        for (var propName in config)
          "key" !== propName && (maybeKey[propName] = config[propName]);
      } else maybeKey = config;
      config = maybeKey.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== config ? config : null,
        props: maybeKey
      };
    }
    __name(jsxProd, "jsxProd");
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsx = jsxProd;
    exports.jsxs = jsxProd;
  }
});

// node_modules/react/cjs/react.production.js
var require_react_production = __commonJS({
  "node_modules/react/cjs/react.production.js"(exports) {
    "use strict";
    init_esm();
    var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
    var REACT_PORTAL_TYPE = Symbol.for("react.portal");
    var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
    var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
    var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
    var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
    var REACT_CONTEXT_TYPE = Symbol.for("react.context");
    var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
    var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
    var REACT_MEMO_TYPE = Symbol.for("react.memo");
    var REACT_LAZY_TYPE = Symbol.for("react.lazy");
    var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
    var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
    function getIteratorFn(maybeIterable) {
      if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
      maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
      return "function" === typeof maybeIterable ? maybeIterable : null;
    }
    __name(getIteratorFn, "getIteratorFn");
    var ReactNoopUpdateQueue = {
      isMounted: /* @__PURE__ */ __name(function() {
        return false;
      }, "isMounted"),
      enqueueForceUpdate: /* @__PURE__ */ __name(function() {
      }, "enqueueForceUpdate"),
      enqueueReplaceState: /* @__PURE__ */ __name(function() {
      }, "enqueueReplaceState"),
      enqueueSetState: /* @__PURE__ */ __name(function() {
      }, "enqueueSetState")
    };
    var assign = Object.assign;
    var emptyObject = {};
    function Component(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    __name(Component, "Component");
    Component.prototype.isReactComponent = {};
    Component.prototype.setState = function(partialState, callback) {
      if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
        throw Error(
          "takes an object of state variables to update or a function which returns an object of state variables."
        );
      this.updater.enqueueSetState(this, partialState, callback, "setState");
    };
    Component.prototype.forceUpdate = function(callback) {
      this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
    };
    function ComponentDummy() {
    }
    __name(ComponentDummy, "ComponentDummy");
    ComponentDummy.prototype = Component.prototype;
    function PureComponent(props, context, updater) {
      this.props = props;
      this.context = context;
      this.refs = emptyObject;
      this.updater = updater || ReactNoopUpdateQueue;
    }
    __name(PureComponent, "PureComponent");
    var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
    pureComponentPrototype.constructor = PureComponent;
    assign(pureComponentPrototype, Component.prototype);
    pureComponentPrototype.isPureReactComponent = true;
    var isArrayImpl = Array.isArray;
    function noop() {
    }
    __name(noop, "noop");
    var ReactSharedInternals = { H: null, A: null, T: null, S: null };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function ReactElement(type, key, props) {
      var refProp = props.ref;
      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type,
        key,
        ref: void 0 !== refProp ? refProp : null,
        props
      };
    }
    __name(ReactElement, "ReactElement");
    function cloneAndReplaceKey(oldElement, newKey) {
      return ReactElement(oldElement.type, newKey, oldElement.props);
    }
    __name(cloneAndReplaceKey, "cloneAndReplaceKey");
    function isValidElement(object) {
      return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    __name(isValidElement, "isValidElement");
    function escape(key) {
      var escaperLookup = { "=": "=0", ":": "=2" };
      return "$" + key.replace(/[=:]/g, function(match) {
        return escaperLookup[match];
      });
    }
    __name(escape, "escape");
    var userProvidedKeyEscapeRegex = /\/+/g;
    function getElementKey(element, index) {
      return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
    }
    __name(getElementKey, "getElementKey");
    function resolveThenable(thenable) {
      switch (thenable.status) {
        case "fulfilled":
          return thenable.value;
        case "rejected":
          throw thenable.reason;
        default:
          switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
            function(fulfilledValue) {
              "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
            },
            function(error) {
              "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
            }
          )), thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
          }
      }
      throw thenable;
    }
    __name(resolveThenable, "resolveThenable");
    function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
      var type = typeof children;
      if ("undefined" === type || "boolean" === type) children = null;
      var invokeCallback = false;
      if (null === children) invokeCallback = true;
      else
        switch (type) {
          case "bigint":
          case "string":
          case "number":
            invokeCallback = true;
            break;
          case "object":
            switch (children.$$typeof) {
              case REACT_ELEMENT_TYPE:
              case REACT_PORTAL_TYPE:
                invokeCallback = true;
                break;
              case REACT_LAZY_TYPE:
                return invokeCallback = children._init, mapIntoArray(
                  invokeCallback(children._payload),
                  array,
                  escapedPrefix,
                  nameSoFar,
                  callback
                );
            }
        }
      if (invokeCallback)
        return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
          return c;
        })) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(
          callback,
          escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(
            userProvidedKeyEscapeRegex,
            "$&/"
          ) + "/") + invokeCallback
        )), array.push(callback)), 1;
      invokeCallback = 0;
      var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
      if (isArrayImpl(children))
        for (var i = 0; i < children.length; i++)
          nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if (i = getIteratorFn(children), "function" === typeof i)
        for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
          nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
            nameSoFar,
            array,
            escapedPrefix,
            type,
            callback
          );
      else if ("object" === type) {
        if ("function" === typeof children.then)
          return mapIntoArray(
            resolveThenable(children),
            array,
            escapedPrefix,
            nameSoFar,
            callback
          );
        array = String(children);
        throw Error(
          "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
        );
      }
      return invokeCallback;
    }
    __name(mapIntoArray, "mapIntoArray");
    function mapChildren(children, func, context) {
      if (null == children) return children;
      var result = [], count = 0;
      mapIntoArray(children, result, "", "", function(child) {
        return func.call(context, child, count++);
      });
      return result;
    }
    __name(mapChildren, "mapChildren");
    function lazyInitializer(payload) {
      if (-1 === payload._status) {
        var ctor = payload._result;
        ctor = ctor();
        ctor.then(
          function(moduleObject) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 1, payload._result = moduleObject;
          },
          function(error) {
            if (0 === payload._status || -1 === payload._status)
              payload._status = 2, payload._result = error;
          }
        );
        -1 === payload._status && (payload._status = 0, payload._result = ctor);
      }
      if (1 === payload._status) return payload._result.default;
      throw payload._result;
    }
    __name(lazyInitializer, "lazyInitializer");
    var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
      if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
        var event = new window.ErrorEvent("error", {
          bubbles: true,
          cancelable: true,
          message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
          error
        });
        if (!window.dispatchEvent(event)) return;
      } else if ("object" === typeof process && "function" === typeof process.emit) {
        process.emit("uncaughtException", error);
        return;
      }
      console.error(error);
    };
    var Children = {
      map: mapChildren,
      forEach: /* @__PURE__ */ __name(function(children, forEachFunc, forEachContext) {
        mapChildren(
          children,
          function() {
            forEachFunc.apply(this, arguments);
          },
          forEachContext
        );
      }, "forEach"),
      count: /* @__PURE__ */ __name(function(children) {
        var n = 0;
        mapChildren(children, function() {
          n++;
        });
        return n;
      }, "count"),
      toArray: /* @__PURE__ */ __name(function(children) {
        return mapChildren(children, function(child) {
          return child;
        }) || [];
      }, "toArray"),
      only: /* @__PURE__ */ __name(function(children) {
        if (!isValidElement(children))
          throw Error(
            "React.Children.only expected to receive a single React element child."
          );
        return children;
      }, "only")
    };
    exports.Activity = REACT_ACTIVITY_TYPE;
    exports.Children = Children;
    exports.Component = Component;
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.Profiler = REACT_PROFILER_TYPE;
    exports.PureComponent = PureComponent;
    exports.StrictMode = REACT_STRICT_MODE_TYPE;
    exports.Suspense = REACT_SUSPENSE_TYPE;
    exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
    exports.__COMPILER_RUNTIME = {
      __proto__: null,
      c: /* @__PURE__ */ __name(function(size) {
        return ReactSharedInternals.H.useMemoCache(size);
      }, "c")
    };
    exports.cache = function(fn) {
      return function() {
        return fn.apply(null, arguments);
      };
    };
    exports.cacheSignal = function() {
      return null;
    };
    exports.cloneElement = function(element, config, children) {
      if (null === element || void 0 === element)
        throw Error(
          "The argument must be a React element, but you passed " + element + "."
        );
      var props = assign({}, element.props), key = element.key;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
      var propName = arguments.length - 2;
      if (1 === propName) props.children = children;
      else if (1 < propName) {
        for (var childArray = Array(propName), i = 0; i < propName; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      return ReactElement(element.type, key, props);
    };
    exports.createContext = function(defaultValue) {
      defaultValue = {
        $$typeof: REACT_CONTEXT_TYPE,
        _currentValue: defaultValue,
        _currentValue2: defaultValue,
        _threadCount: 0,
        Provider: null,
        Consumer: null
      };
      defaultValue.Provider = defaultValue;
      defaultValue.Consumer = {
        $$typeof: REACT_CONSUMER_TYPE,
        _context: defaultValue
      };
      return defaultValue;
    };
    exports.createElement = function(type, config, children) {
      var propName, props = {}, key = null;
      if (null != config)
        for (propName in void 0 !== config.key && (key = "" + config.key), config)
          hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
      var childrenLength = arguments.length - 2;
      if (1 === childrenLength) props.children = children;
      else if (1 < childrenLength) {
        for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++)
          childArray[i] = arguments[i + 2];
        props.children = childArray;
      }
      if (type && type.defaultProps)
        for (propName in childrenLength = type.defaultProps, childrenLength)
          void 0 === props[propName] && (props[propName] = childrenLength[propName]);
      return ReactElement(type, key, props);
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(render) {
      return { $$typeof: REACT_FORWARD_REF_TYPE, render };
    };
    exports.isValidElement = isValidElement;
    exports.lazy = function(ctor) {
      return {
        $$typeof: REACT_LAZY_TYPE,
        _payload: { _status: -1, _result: ctor },
        _init: lazyInitializer
      };
    };
    exports.memo = function(type, compare) {
      return {
        $$typeof: REACT_MEMO_TYPE,
        type,
        compare: void 0 === compare ? null : compare
      };
    };
    exports.startTransition = function(scope) {
      var prevTransition = ReactSharedInternals.T, currentTransition = {};
      ReactSharedInternals.T = currentTransition;
      try {
        var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
        null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
        "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
      } catch (error) {
        reportGlobalError(error);
      } finally {
        null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
      }
    };
    exports.unstable_useCacheRefresh = function() {
      return ReactSharedInternals.H.useCacheRefresh();
    };
    exports.use = function(usable) {
      return ReactSharedInternals.H.use(usable);
    };
    exports.useActionState = function(action, initialState, permalink) {
      return ReactSharedInternals.H.useActionState(action, initialState, permalink);
    };
    exports.useCallback = function(callback, deps) {
      return ReactSharedInternals.H.useCallback(callback, deps);
    };
    exports.useContext = function(Context) {
      return ReactSharedInternals.H.useContext(Context);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(value, initialValue) {
      return ReactSharedInternals.H.useDeferredValue(value, initialValue);
    };
    exports.useEffect = function(create, deps) {
      return ReactSharedInternals.H.useEffect(create, deps);
    };
    exports.useEffectEvent = function(callback) {
      return ReactSharedInternals.H.useEffectEvent(callback);
    };
    exports.useId = function() {
      return ReactSharedInternals.H.useId();
    };
    exports.useImperativeHandle = function(ref, create, deps) {
      return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
    };
    exports.useInsertionEffect = function(create, deps) {
      return ReactSharedInternals.H.useInsertionEffect(create, deps);
    };
    exports.useLayoutEffect = function(create, deps) {
      return ReactSharedInternals.H.useLayoutEffect(create, deps);
    };
    exports.useMemo = function(create, deps) {
      return ReactSharedInternals.H.useMemo(create, deps);
    };
    exports.useOptimistic = function(passthrough, reducer) {
      return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
    };
    exports.useReducer = function(reducer, initialArg, init) {
      return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
    };
    exports.useRef = function(initialValue) {
      return ReactSharedInternals.H.useRef(initialValue);
    };
    exports.useState = function(initialState) {
      return ReactSharedInternals.H.useState(initialState);
    };
    exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
      return ReactSharedInternals.H.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
      );
    };
    exports.useTransition = function() {
      return ReactSharedInternals.H.useTransition();
    };
    exports.version = "19.2.3";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    init_esm();
    "production" !== process.env.NODE_ENV && function() {
      function defineDeprecationWarning(methodName, info) {
        Object.defineProperty(Component.prototype, methodName, {
          get: /* @__PURE__ */ __name(function() {
            console.warn(
              "%s(...) is deprecated in plain JavaScript React classes. %s",
              info[0],
              info[1]
            );
          }, "get")
        });
      }
      __name(defineDeprecationWarning, "defineDeprecationWarning");
      function getIteratorFn(maybeIterable) {
        if (null === maybeIterable || "object" !== typeof maybeIterable)
          return null;
        maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
        return "function" === typeof maybeIterable ? maybeIterable : null;
      }
      __name(getIteratorFn, "getIteratorFn");
      function warnNoop(publicInstance, callerName) {
        publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
        var warningKey = publicInstance + "." + callerName;
        didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
          "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
          callerName,
          publicInstance
        ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
      }
      __name(warnNoop, "warnNoop");
      function Component(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      __name(Component, "Component");
      function ComponentDummy() {
      }
      __name(ComponentDummy, "ComponentDummy");
      function PureComponent(props, context, updater) {
        this.props = props;
        this.context = context;
        this.refs = emptyObject;
        this.updater = updater || ReactNoopUpdateQueue;
      }
      __name(PureComponent, "PureComponent");
      function noop() {
      }
      __name(noop, "noop");
      function testStringCoercion(value) {
        return "" + value;
      }
      __name(testStringCoercion, "testStringCoercion");
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      __name(checkKeyStringCoercion, "checkKeyStringCoercion");
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      __name(getComponentNameFromType, "getComponentNameFromType");
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      __name(getTaskName, "getTaskName");
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      __name(getOwner, "getOwner");
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      __name(UnknownOwner, "UnknownOwner");
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      __name(hasValidKey, "hasValidKey");
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        __name(warnAboutAccessingKey, "warnAboutAccessingKey");
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      __name(elementRefGetterWithDeprecationWarning, "elementRefGetterWithDeprecationWarning");
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      __name(ReactElement, "ReactElement");
      function cloneAndReplaceKey(oldElement, newKey) {
        newKey = ReactElement(
          oldElement.type,
          newKey,
          oldElement.props,
          oldElement._owner,
          oldElement._debugStack,
          oldElement._debugTask
        );
        oldElement._store && (newKey._store.validated = oldElement._store.validated);
        return newKey;
      }
      __name(cloneAndReplaceKey, "cloneAndReplaceKey");
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      __name(validateChildKeys, "validateChildKeys");
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      __name(isValidElement, "isValidElement");
      function escape(key) {
        var escaperLookup = { "=": "=0", ":": "=2" };
        return "$" + key.replace(/[=:]/g, function(match) {
          return escaperLookup[match];
        });
      }
      __name(escape, "escape");
      function getElementKey(element, index) {
        return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
      }
      __name(getElementKey, "getElementKey");
      function resolveThenable(thenable) {
        switch (thenable.status) {
          case "fulfilled":
            return thenable.value;
          case "rejected":
            throw thenable.reason;
          default:
            switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
              function(fulfilledValue) {
                "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
              },
              function(error) {
                "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            )), thenable.status) {
              case "fulfilled":
                return thenable.value;
              case "rejected":
                throw thenable.reason;
            }
        }
        throw thenable;
      }
      __name(resolveThenable, "resolveThenable");
      function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
        var type = typeof children;
        if ("undefined" === type || "boolean" === type) children = null;
        var invokeCallback = false;
        if (null === children) invokeCallback = true;
        else
          switch (type) {
            case "bigint":
            case "string":
            case "number":
              invokeCallback = true;
              break;
            case "object":
              switch (children.$$typeof) {
                case REACT_ELEMENT_TYPE:
                case REACT_PORTAL_TYPE:
                  invokeCallback = true;
                  break;
                case REACT_LAZY_TYPE:
                  return invokeCallback = children._init, mapIntoArray(
                    invokeCallback(children._payload),
                    array,
                    escapedPrefix,
                    nameSoFar,
                    callback
                  );
              }
          }
        if (invokeCallback) {
          invokeCallback = children;
          callback = callback(invokeCallback);
          var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
          isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
            return c;
          })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
            callback,
            escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
              userProvidedKeyEscapeRegex,
              "$&/"
            ) + "/") + childKey
          ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
          return 1;
        }
        invokeCallback = 0;
        childKey = "" === nameSoFar ? "." : nameSoFar + ":";
        if (isArrayImpl(children))
          for (var i = 0; i < children.length; i++)
            nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if (i = getIteratorFn(children), "function" === typeof i)
          for (i === children.entries && (didWarnAboutMaps || console.warn(
            "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
          ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
            nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
              nameSoFar,
              array,
              escapedPrefix,
              type,
              callback
            );
        else if ("object" === type) {
          if ("function" === typeof children.then)
            return mapIntoArray(
              resolveThenable(children),
              array,
              escapedPrefix,
              nameSoFar,
              callback
            );
          array = String(children);
          throw Error(
            "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
          );
        }
        return invokeCallback;
      }
      __name(mapIntoArray, "mapIntoArray");
      function mapChildren(children, func, context) {
        if (null == children) return children;
        var result = [], count = 0;
        mapIntoArray(children, result, "", "", function(child) {
          return func.call(context, child, count++);
        });
        return result;
      }
      __name(mapChildren, "mapChildren");
      function lazyInitializer(payload) {
        if (-1 === payload._status) {
          var ioInfo = payload._ioInfo;
          null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
          ioInfo = payload._result;
          var thenable = ioInfo();
          thenable.then(
            function(moduleObject) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 1;
                payload._result = moduleObject;
                var _ioInfo = payload._ioInfo;
                null != _ioInfo && (_ioInfo.end = performance.now());
                void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
              }
            },
            function(error) {
              if (0 === payload._status || -1 === payload._status) {
                payload._status = 2;
                payload._result = error;
                var _ioInfo2 = payload._ioInfo;
                null != _ioInfo2 && (_ioInfo2.end = performance.now());
                void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
              }
            }
          );
          ioInfo = payload._ioInfo;
          if (null != ioInfo) {
            ioInfo.value = thenable;
            var displayName = thenable.displayName;
            "string" === typeof displayName && (ioInfo.name = displayName);
          }
          -1 === payload._status && (payload._status = 0, payload._result = thenable);
        }
        if (1 === payload._status)
          return ioInfo = payload._result, void 0 === ioInfo && console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
            ioInfo
          ), "default" in ioInfo || console.error(
            "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
            ioInfo
          ), ioInfo.default;
        throw payload._result;
      }
      __name(lazyInitializer, "lazyInitializer");
      function resolveDispatcher() {
        var dispatcher = ReactSharedInternals.H;
        null === dispatcher && console.error(
          "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
        );
        return dispatcher;
      }
      __name(resolveDispatcher, "resolveDispatcher");
      function releaseAsyncTransition() {
        ReactSharedInternals.asyncTransitions--;
      }
      __name(releaseAsyncTransition, "releaseAsyncTransition");
      function enqueueTask(task) {
        if (null === enqueueTaskImpl)
          try {
            var requireString = ("require" + Math.random()).slice(0, 7);
            enqueueTaskImpl = (module && module[requireString]).call(
              module,
              "timers"
            ).setImmediate;
          } catch (_err) {
            enqueueTaskImpl = /* @__PURE__ */ __name(function(callback) {
              false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
              ));
              var channel = new MessageChannel();
              channel.port1.onmessage = callback;
              channel.port2.postMessage(void 0);
            }, "enqueueTaskImpl");
          }
        return enqueueTaskImpl(task);
      }
      __name(enqueueTask, "enqueueTask");
      function aggregateErrors(errors) {
        return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
      }
      __name(aggregateErrors, "aggregateErrors");
      function popActScope(prevActQueue, prevActScopeDepth) {
        prevActScopeDepth !== actScopeDepth - 1 && console.error(
          "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
        );
        actScopeDepth = prevActScopeDepth;
      }
      __name(popActScope, "popActScope");
      function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
        var queue = ReactSharedInternals.actQueue;
        if (null !== queue)
          if (0 !== queue.length)
            try {
              flushActQueue(queue);
              enqueueTask(function() {
                return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
              });
              return;
            } catch (error) {
              ReactSharedInternals.thrownErrors.push(error);
            }
          else ReactSharedInternals.actQueue = null;
        0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
      }
      __name(recursivelyFlushAsyncActWork, "recursivelyFlushAsyncActWork");
      function flushActQueue(queue) {
        if (!isFlushing) {
          isFlushing = true;
          var i = 0;
          try {
            for (; i < queue.length; i++) {
              var callback = queue[i];
              do {
                ReactSharedInternals.didUsePromise = false;
                var continuation = callback(false);
                if (null !== continuation) {
                  if (ReactSharedInternals.didUsePromise) {
                    queue[i] = callback;
                    queue.splice(0, i);
                    return;
                  }
                  callback = continuation;
                } else break;
              } while (1);
            }
            queue.length = 0;
          } catch (error) {
            queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
          } finally {
            isFlushing = false;
          }
        }
      }
      __name(flushActQueue, "flushActQueue");
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
        isMounted: /* @__PURE__ */ __name(function() {
          return false;
        }, "isMounted"),
        enqueueForceUpdate: /* @__PURE__ */ __name(function(publicInstance) {
          warnNoop(publicInstance, "forceUpdate");
        }, "enqueueForceUpdate"),
        enqueueReplaceState: /* @__PURE__ */ __name(function(publicInstance) {
          warnNoop(publicInstance, "replaceState");
        }, "enqueueReplaceState"),
        enqueueSetState: /* @__PURE__ */ __name(function(publicInstance) {
          warnNoop(publicInstance, "setState");
        }, "enqueueSetState")
      }, assign = Object.assign, emptyObject = {};
      Object.freeze(emptyObject);
      Component.prototype.isReactComponent = {};
      Component.prototype.setState = function(partialState, callback) {
        if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
          throw Error(
            "takes an object of state variables to update or a function which returns an object of state variables."
          );
        this.updater.enqueueSetState(this, partialState, callback, "setState");
      };
      Component.prototype.forceUpdate = function(callback) {
        this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
      };
      var deprecatedAPIs = {
        isMounted: [
          "isMounted",
          "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
        ],
        replaceState: [
          "replaceState",
          "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
        ]
      };
      for (fnName in deprecatedAPIs)
        deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
      ComponentDummy.prototype = Component.prototype;
      deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
      deprecatedAPIs.constructor = PureComponent;
      assign(deprecatedAPIs, Component.prototype);
      deprecatedAPIs.isPureReactComponent = true;
      var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
        H: null,
        A: null,
        T: null,
        S: null,
        actQueue: null,
        asyncTransitions: 0,
        isBatchingLegacy: false,
        didScheduleLegacyUpdate: false,
        didUsePromise: false,
        thrownErrors: [],
        getCurrentStack: null,
        recentlyCreatedOwnerStacks: 0
      }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      deprecatedAPIs = {
        react_stack_bottom_frame: /* @__PURE__ */ __name(function(callStackForError) {
          return callStackForError();
        }, "react_stack_bottom_frame")
      };
      var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
        deprecatedAPIs,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
        if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
          var event = new window.ErrorEvent("error", {
            bubbles: true,
            cancelable: true,
            message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
            error
          });
          if (!window.dispatchEvent(event)) return;
        } else if ("object" === typeof process && "function" === typeof process.emit) {
          process.emit("uncaughtException", error);
          return;
        }
        console.error(error);
      }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
        queueMicrotask(function() {
          return queueMicrotask(callback);
        });
      } : enqueueTask;
      deprecatedAPIs = Object.freeze({
        __proto__: null,
        c: /* @__PURE__ */ __name(function(size) {
          return resolveDispatcher().useMemoCache(size);
        }, "c")
      });
      var fnName = {
        map: mapChildren,
        forEach: /* @__PURE__ */ __name(function(children, forEachFunc, forEachContext) {
          mapChildren(
            children,
            function() {
              forEachFunc.apply(this, arguments);
            },
            forEachContext
          );
        }, "forEach"),
        count: /* @__PURE__ */ __name(function(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }, "count"),
        toArray: /* @__PURE__ */ __name(function(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }, "toArray"),
        only: /* @__PURE__ */ __name(function(children) {
          if (!isValidElement(children))
            throw Error(
              "React.Children.only expected to receive a single React element child."
            );
          return children;
        }, "only")
      };
      exports.Activity = REACT_ACTIVITY_TYPE;
      exports.Children = fnName;
      exports.Component = Component;
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.Profiler = REACT_PROFILER_TYPE;
      exports.PureComponent = PureComponent;
      exports.StrictMode = REACT_STRICT_MODE_TYPE;
      exports.Suspense = REACT_SUSPENSE_TYPE;
      exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
      exports.__COMPILER_RUNTIME = deprecatedAPIs;
      exports.act = function(callback) {
        var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
        actScopeDepth++;
        var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
        try {
          var result = callback();
        } catch (error) {
          ReactSharedInternals.thrownErrors.push(error);
        }
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        if (null !== result && "object" === typeof result && "function" === typeof result.then) {
          var thenable = result;
          queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
            ));
          });
          return {
            then: /* @__PURE__ */ __name(function(resolve, reject) {
              didAwaitActCall = true;
              thenable.then(
                function(returnValue) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  if (0 === prevActScopeDepth) {
                    try {
                      flushActQueue(queue), enqueueTask(function() {
                        return recursivelyFlushAsyncActWork(
                          returnValue,
                          resolve,
                          reject
                        );
                      });
                    } catch (error$0) {
                      ReactSharedInternals.thrownErrors.push(error$0);
                    }
                    if (0 < ReactSharedInternals.thrownErrors.length) {
                      var _thrownError = aggregateErrors(
                        ReactSharedInternals.thrownErrors
                      );
                      ReactSharedInternals.thrownErrors.length = 0;
                      reject(_thrownError);
                    }
                  } else resolve(returnValue);
                },
                function(error) {
                  popActScope(prevActQueue, prevActScopeDepth);
                  0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                    ReactSharedInternals.thrownErrors
                  ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                }
              );
            }, "then")
          };
        }
        var returnValue$jscomp$0 = result;
        popActScope(prevActQueue, prevActScopeDepth);
        0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
          didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
            "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
          ));
        }), ReactSharedInternals.actQueue = null);
        if (0 < ReactSharedInternals.thrownErrors.length)
          throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
        return {
          then: /* @__PURE__ */ __name(function(resolve, reject) {
            didAwaitActCall = true;
            0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
              return recursivelyFlushAsyncActWork(
                returnValue$jscomp$0,
                resolve,
                reject
              );
            })) : resolve(returnValue$jscomp$0);
          }, "then")
        };
      };
      exports.cache = function(fn) {
        return function() {
          return fn.apply(null, arguments);
        };
      };
      exports.cacheSignal = function() {
        return null;
      };
      exports.captureOwnerStack = function() {
        var getCurrentStack = ReactSharedInternals.getCurrentStack;
        return null === getCurrentStack ? null : getCurrentStack();
      };
      exports.cloneElement = function(element, config, children) {
        if (null === element || void 0 === element)
          throw Error(
            "The argument must be a React element, but you passed " + element + "."
          );
        var props = assign({}, element.props), key = element.key, owner = element._owner;
        if (null != config) {
          var JSCompiler_inline_result;
          a: {
            if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
              config,
              "ref"
            ).get) && JSCompiler_inline_result.isReactWarning) {
              JSCompiler_inline_result = false;
              break a;
            }
            JSCompiler_inline_result = void 0 !== config.ref;
          }
          JSCompiler_inline_result && (owner = getOwner());
          hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
          for (propName in config)
            !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
        }
        var propName = arguments.length - 2;
        if (1 === propName) props.children = children;
        else if (1 < propName) {
          JSCompiler_inline_result = Array(propName);
          for (var i = 0; i < propName; i++)
            JSCompiler_inline_result[i] = arguments[i + 2];
          props.children = JSCompiler_inline_result;
        }
        props = ReactElement(
          element.type,
          key,
          props,
          owner,
          element._debugStack,
          element._debugTask
        );
        for (key = 2; key < arguments.length; key++)
          validateChildKeys(arguments[key]);
        return props;
      };
      exports.createContext = function(defaultValue) {
        defaultValue = {
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: defaultValue,
          _currentValue2: defaultValue,
          _threadCount: 0,
          Provider: null,
          Consumer: null
        };
        defaultValue.Provider = defaultValue;
        defaultValue.Consumer = {
          $$typeof: REACT_CONSUMER_TYPE,
          _context: defaultValue
        };
        defaultValue._currentRenderer = null;
        defaultValue._currentRenderer2 = null;
        return defaultValue;
      };
      exports.createElement = function(type, config, children) {
        for (var i = 2; i < arguments.length; i++)
          validateChildKeys(arguments[i]);
        i = {};
        var key = null;
        if (null != config)
          for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
            "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
          )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
            hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
        var childrenLength = arguments.length - 2;
        if (1 === childrenLength) i.children = children;
        else if (1 < childrenLength) {
          for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
            childArray[_i] = arguments[_i + 2];
          Object.freeze && Object.freeze(childArray);
          i.children = childArray;
        }
        if (type && type.defaultProps)
          for (propName in childrenLength = type.defaultProps, childrenLength)
            void 0 === i[propName] && (i[propName] = childrenLength[propName]);
        key && defineKeyPropWarningGetter(
          i,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return ReactElement(
          type,
          key,
          i,
          getOwner(),
          propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.createRef = function() {
        var refObject = { current: null };
        Object.seal(refObject);
        return refObject;
      };
      exports.forwardRef = function(render) {
        null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
          "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
        ) : "function" !== typeof render ? console.error(
          "forwardRef requires a render function but was given %s.",
          null === render ? "null" : typeof render
        ) : 0 !== render.length && 2 !== render.length && console.error(
          "forwardRef render functions accept exactly two parameters: props and ref. %s",
          1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
        );
        null != render && null != render.defaultProps && console.error(
          "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
        );
        var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
        Object.defineProperty(elementType, "displayName", {
          enumerable: false,
          configurable: true,
          get: /* @__PURE__ */ __name(function() {
            return ownName;
          }, "get"),
          set: /* @__PURE__ */ __name(function(name) {
            ownName = name;
            render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
          }, "set")
        });
        return elementType;
      };
      exports.isValidElement = isValidElement;
      exports.lazy = function(ctor) {
        ctor = { _status: -1, _result: ctor };
        var lazyType = {
          $$typeof: REACT_LAZY_TYPE,
          _payload: ctor,
          _init: lazyInitializer
        }, ioInfo = {
          name: "lazy",
          start: -1,
          end: -1,
          value: null,
          owner: null,
          debugStack: Error("react-stack-top-frame"),
          debugTask: console.createTask ? console.createTask("lazy()") : null
        };
        ctor._ioInfo = ioInfo;
        lazyType._debugInfo = [{ awaited: ioInfo }];
        return lazyType;
      };
      exports.memo = function(type, compare) {
        null == type && console.error(
          "memo: The first argument must be a component. Instead received: %s",
          null === type ? "null" : typeof type
        );
        compare = {
          $$typeof: REACT_MEMO_TYPE,
          type,
          compare: void 0 === compare ? null : compare
        };
        var ownName;
        Object.defineProperty(compare, "displayName", {
          enumerable: false,
          configurable: true,
          get: /* @__PURE__ */ __name(function() {
            return ownName;
          }, "get"),
          set: /* @__PURE__ */ __name(function(name) {
            ownName = name;
            type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
          }, "set")
        });
        return compare;
      };
      exports.startTransition = function(scope) {
        var prevTransition = ReactSharedInternals.T, currentTransition = {};
        currentTransition._updatedFibers = /* @__PURE__ */ new Set();
        ReactSharedInternals.T = currentTransition;
        try {
          var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
          null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
          "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
        } catch (error) {
          reportGlobalError(error);
        } finally {
          null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
            "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
          )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
            "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
          ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
        }
      };
      exports.unstable_useCacheRefresh = function() {
        return resolveDispatcher().useCacheRefresh();
      };
      exports.use = function(usable) {
        return resolveDispatcher().use(usable);
      };
      exports.useActionState = function(action, initialState, permalink) {
        return resolveDispatcher().useActionState(
          action,
          initialState,
          permalink
        );
      };
      exports.useCallback = function(callback, deps) {
        return resolveDispatcher().useCallback(callback, deps);
      };
      exports.useContext = function(Context) {
        var dispatcher = resolveDispatcher();
        Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
          "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
        );
        return dispatcher.useContext(Context);
      };
      exports.useDebugValue = function(value, formatterFn) {
        return resolveDispatcher().useDebugValue(value, formatterFn);
      };
      exports.useDeferredValue = function(value, initialValue) {
        return resolveDispatcher().useDeferredValue(value, initialValue);
      };
      exports.useEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useEffect(create, deps);
      };
      exports.useEffectEvent = function(callback) {
        return resolveDispatcher().useEffectEvent(callback);
      };
      exports.useId = function() {
        return resolveDispatcher().useId();
      };
      exports.useImperativeHandle = function(ref, create, deps) {
        return resolveDispatcher().useImperativeHandle(ref, create, deps);
      };
      exports.useInsertionEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useInsertionEffect(create, deps);
      };
      exports.useLayoutEffect = function(create, deps) {
        null == create && console.warn(
          "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
        );
        return resolveDispatcher().useLayoutEffect(create, deps);
      };
      exports.useMemo = function(create, deps) {
        return resolveDispatcher().useMemo(create, deps);
      };
      exports.useOptimistic = function(passthrough, reducer) {
        return resolveDispatcher().useOptimistic(passthrough, reducer);
      };
      exports.useReducer = function(reducer, initialArg, init) {
        return resolveDispatcher().useReducer(reducer, initialArg, init);
      };
      exports.useRef = function(initialValue) {
        return resolveDispatcher().useRef(initialValue);
      };
      exports.useState = function(initialState) {
        return resolveDispatcher().useState(initialState);
      };
      exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
        return resolveDispatcher().useSyncExternalStore(
          subscribe,
          getSnapshot,
          getServerSnapshot
        );
      };
      exports.useTransition = function() {
        return resolveDispatcher().useTransition();
      };
      exports.version = "19.2.3";
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    }();
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production();
    } else {
      module.exports = require_react_development();
    }
  }
});

// node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS({
  "node_modules/react/cjs/react-jsx-runtime.development.js"(exports) {
    "use strict";
    init_esm();
    "production" !== process.env.NODE_ENV && function() {
      function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type)
          return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
            return "Fragment";
          case REACT_PROFILER_TYPE:
            return "Profiler";
          case REACT_STRICT_MODE_TYPE:
            return "StrictMode";
          case REACT_SUSPENSE_TYPE:
            return "Suspense";
          case REACT_SUSPENSE_LIST_TYPE:
            return "SuspenseList";
          case REACT_ACTIVITY_TYPE:
            return "Activity";
        }
        if ("object" === typeof type)
          switch ("number" === typeof type.tag && console.error(
            "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
          ), type.$$typeof) {
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_CONTEXT_TYPE:
              return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
              return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
              var innerType = type.render;
              type = type.displayName;
              type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
              return type;
            case REACT_MEMO_TYPE:
              return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
              innerType = type._payload;
              type = type._init;
              try {
                return getComponentNameFromType(type(innerType));
              } catch (x) {
              }
          }
        return null;
      }
      __name(getComponentNameFromType, "getComponentNameFromType");
      function testStringCoercion(value) {
        return "" + value;
      }
      __name(testStringCoercion, "testStringCoercion");
      function checkKeyStringCoercion(value) {
        try {
          testStringCoercion(value);
          var JSCompiler_inline_result = false;
        } catch (e) {
          JSCompiler_inline_result = true;
        }
        if (JSCompiler_inline_result) {
          JSCompiler_inline_result = console;
          var JSCompiler_temp_const = JSCompiler_inline_result.error;
          var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
          JSCompiler_temp_const.call(
            JSCompiler_inline_result,
            "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
            JSCompiler_inline_result$jscomp$0
          );
          return testStringCoercion(value);
        }
      }
      __name(checkKeyStringCoercion, "checkKeyStringCoercion");
      function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
          return "<...>";
        try {
          var name = getComponentNameFromType(type);
          return name ? "<" + name + ">" : "<...>";
        } catch (x) {
          return "<...>";
        }
      }
      __name(getTaskName, "getTaskName");
      function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
      }
      __name(getOwner, "getOwner");
      function UnknownOwner() {
        return Error("react-stack-top-frame");
      }
      __name(UnknownOwner, "UnknownOwner");
      function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
          var getter = Object.getOwnPropertyDescriptor(config, "key").get;
          if (getter && getter.isReactWarning) return false;
        }
        return void 0 !== config.key;
      }
      __name(hasValidKey, "hasValidKey");
      function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
          specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
            "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
            displayName
          ));
        }
        __name(warnAboutAccessingKey, "warnAboutAccessingKey");
        warnAboutAccessingKey.isReactWarning = true;
        Object.defineProperty(props, "key", {
          get: warnAboutAccessingKey,
          configurable: true
        });
      }
      __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
      function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
          "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
        ));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
      }
      __name(elementRefGetterWithDeprecationWarning, "elementRefGetterWithDeprecationWarning");
      function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
          $$typeof: REACT_ELEMENT_TYPE,
          type,
          key,
          props,
          _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
          enumerable: false,
          get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: null
        });
        Object.defineProperty(type, "_debugStack", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
          configurable: false,
          enumerable: false,
          writable: true,
          value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
      }
      __name(ReactElement, "ReactElement");
      function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children)
          if (isStaticChildren)
            if (isArrayImpl(children)) {
              for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)
                validateChildKeys(children[isStaticChildren]);
              Object.freeze && Object.freeze(children);
            } else
              console.error(
                "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
              );
          else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
          children = getComponentNameFromType(type);
          var keys = Object.keys(config).filter(function(k) {
            return "key" !== k;
          });
          isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
          didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error(
            'A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />',
            isStaticChildren,
            children,
            keys,
            children
          ), didWarnAboutKeySpread[children + isStaticChildren] = true);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
          maybeKey = {};
          for (var propName in config)
            "key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(
          maybeKey,
          "function" === typeof type ? type.displayName || type.name || "Unknown" : type
        );
        return ReactElement(
          type,
          children,
          maybeKey,
          getOwner(),
          debugStack,
          debugTask
        );
      }
      __name(jsxDEVImpl, "jsxDEVImpl");
      function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
      }
      __name(validateChildKeys, "validateChildKeys");
      function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
      }
      __name(isValidElement, "isValidElement");
      var React = require_react(), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
      };
      React = {
        react_stack_bottom_frame: /* @__PURE__ */ __name(function(callStackForError) {
          return callStackForError();
        }, "react_stack_bottom_frame")
      };
      var specialPropKeyWarningShown;
      var didWarnAboutElementRef = {};
      var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(
        React,
        UnknownOwner
      )();
      var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
      var didWarnAboutKeySpread = {};
      exports.Fragment = REACT_FRAGMENT_TYPE;
      exports.jsx = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          false,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
      exports.jsxs = function(type, config, maybeKey) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        return jsxDEVImpl(
          type,
          config,
          maybeKey,
          true,
          trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
          trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask
        );
      };
    }();
  }
});

// node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_jsx_runtime_production();
    } else {
      module.exports = require_react_jsx_runtime_development();
    }
  }
});

// node_modules/remotion/dist/esm/version.mjs
var version_exports = {};
__export(version_exports, {
  VERSION: () => VERSION
});
var VERSION;
var init_version = __esm({
  "node_modules/remotion/dist/esm/version.mjs"() {
    init_esm();
    VERSION = "4.0.448";
  }
});

// node_modules/merge-stream/index.js
var require_merge_stream = __commonJS({
  "node_modules/merge-stream/index.js"(exports, module) {
    "use strict";
    init_esm();
    var { PassThrough } = __require("stream");
    module.exports = function() {
      var sources = [];
      var output = new PassThrough({ objectMode: true });
      output.setMaxListeners(0);
      output.add = add;
      output.isEmpty = isEmpty;
      output.on("unpipe", remove);
      Array.prototype.slice.call(arguments).forEach(add);
      return output;
      function add(source) {
        if (Array.isArray(source)) {
          source.forEach(add);
          return this;
        }
        sources.push(source);
        source.once("end", remove.bind(null, source));
        source.once("error", output.emit.bind(output, "error"));
        source.pipe(output, { end: false });
        return this;
      }
      __name(add, "add");
      function isEmpty() {
        return sources.length == 0;
      }
      __name(isEmpty, "isEmpty");
      function remove(source) {
        sources = sources.filter(function(it) {
          return it !== source;
        });
        if (!sources.length && output.readable) {
          output.end();
        }
      }
      __name(remove, "remove");
    };
  }
});

export {
  random,
  NoReactInternals,
  no_react_exports,
  init_no_react,
  require_merge_stream,
  require_react,
  require_jsx_runtime,
  VERSION,
  version_exports,
  init_version
};
/*! Bundled license information:

react/cjs/react-jsx-runtime.production.js:
  (**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.production.js:
  (**
   * @license React
   * react.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.development.js:
  (**
   * @license React
   * react-jsx-runtime.development.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=chunk-JSNTL3OG.mjs.map
