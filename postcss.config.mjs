// postcss.config.mjs
// Required for Tailwind v4. Without this file, `@tailwindcss/postcss`
// never runs, and every Tailwind utility class in the app (flex,
// rounded-xl, bg-[...], lg:, etc.) is silently ignored by the browser —
// which is exactly the "unstyled HTML" symptom this fixes.

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
