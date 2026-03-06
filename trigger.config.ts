import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zwrdqutfrrdneuwbjvxi",
  maxDuration: 120,
  dirs: ["./src/trigger"],

  // ── CRITICAL: declare every env var your tasks need ───────
  // Without this, Trigger.dev cloud runs tasks with undefined
  // env vars — causing silent Supabase auth failures (PGRST204)
  // and missing API calls. This was the root cause of all
  // "Saved 0/N rows" failures.
  build: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      ANTHROPIC_API_KEY:         process.env.ANTHROPIC_API_KEY         ?? "",
      SERPAPI_API_KEY:           process.env.SERPAPI_API_KEY           ?? "",
      PERPLEXITY_API_KEY:        process.env.PERPLEXITY_API_KEY        ?? "",
      RESEND_API_KEY:            process.env.RESEND_API_KEY            ?? "",
      MAILERLITE_API_KEY:        process.env.MAILERLITE_API_KEY        ?? "",
      FOUNDER_EMAIL:             process.env.FOUNDER_EMAIL             ?? "",
    },
  },

  // No global retries — free tier, tasks handle their own fallbacks
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
});
