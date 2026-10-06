#!/usr/bin/env node
// scripts/dev-guard.js  (runs automatically before `npm run dev`)
// `.env.local` in this repository holds PRODUCTION credentials. Next.js lets
// `.env.development.local` override it in dev, so local work must have that file
// (pointing at a separate Supabase project) or it would read and write production data.
//
// To deliberately run against production anyway:   ALLOW_PROD_DB=1 npm run dev
const fs = require('fs');

if (process.env.ALLOW_PROD_DB === '1') {
  console.warn('\n[dev-guard] ALLOW_PROD_DB=1: running against the database in .env.local. Be careful.\n');
  process.exit(0);
}
if (!fs.existsSync('.env.development.local')) {
  console.error(`
[dev-guard] Refusing to start: .env.development.local does not exist.

  .env.local holds production credentials, so "npm run dev" would use the production database.
  Point local development at a separate Supabase project:

    1. Create a free project at https://supabase.com (a fresh one, not the production project).
    2. Copy .env.development.local.example to .env.development.local and fill in that project's keys.
    3. npm run db:setup-fresh     (builds the schema and storage buckets in the fresh project)
    4. npm run db:seed-fresh      (creates test users and sample data)
    5. npm run dev

  (Full steps: README, "Local development".)
`);
  process.exit(1);
}
