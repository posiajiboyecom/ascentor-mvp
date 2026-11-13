#!/usr/bin/env node
// scripts/dev-guard.js  (runs automatically before `npm run dev`)
// Reminder only, never blocks: local development uses the Supabase project in .env.local,
// so sign-ups, goals, messages and other test data are written to the real project.
// Nothing here deploys anything: production code only changes when `main` changes, and
// `main` receives no commits until after the Elevation Summit.
console.log(`
[dev] Local run: the gate is off. Data you create goes to the Supabase project in .env.local.
      Use throwaway accounts and delete them afterwards. Email, Paystack and MailerLite keys
      in .env.local are live: do not trigger bulk sends or payments from here.
`);
