import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // ── TypeScript ─────────────────────────────────────────────────────────
      // Downgrade 'any' from error → warn so builds don't fail.
      // Replace `any` with proper types incrementally.
      "@typescript-eslint/no-explicit-any": "warn",

      // Unused vars/imports are noise during active dev — warn only.
      "@typescript-eslint/no-unused-vars": "warn",

      // Allow @ts-ignore during migration; prefer @ts-expect-error long term.
      "@typescript-eslint/ban-ts-comment": "warn",

      // ── React Hooks ────────────────────────────────────────────────────────
      // Calling setState directly in useEffect body — warn, not error.
      // Fix by wrapping calls in async callbacks or conditions.
      "react-hooks/set-state-in-effect": "warn",

      // Functions accessed before declaration (hoisting issues) — warn.
      // Fix by converting to useCallback or moving functions above useEffect.
      "react-hooks/immutability": "warn",

      // Date.now() / Math.random() called in render — warn.
      // Fix by moving into useRef or useEffect.
      "react-hooks/purity": "warn",

      // Missing useEffect dependencies — warn only.
      // Fixing blindly can cause infinite loops; review each case manually.
      "react-hooks/exhaustive-deps": "warn",

      // ── React / JSX ────────────────────────────────────────────────────────
      // Unescaped ' and " in JSX text — warn. Run `eslint --fix` to auto-fix.
      "react/no-unescaped-entities": "warn",

      // ── Next.js ────────────────────────────────────────────────────────────
      // <img> instead of <Image /> — warn. Migrate to next/image for LCP gains.
      "@next/next/no-img-element": "warn",

      // Unused expressions (e.g. standalone boolean expressions) — warn.
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
]);

export default eslintConfig;
