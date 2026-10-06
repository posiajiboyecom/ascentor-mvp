// scripts/setup-fresh-db.ts
// Builds a FRESH Supabase project for local development from the repository: the baseline
// schema, the later migrations, and the storage buckets the app uses. Run once per fresh project.
//
//   npm run db:setup-fresh
//
// Target: DATABASE_URL in .env.development.local (the fresh project's connection string).
// Safety: refuses to run if that points at the same project as .env.local (production).
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { config, parse } from 'dotenv';

config({ path: '.env.development.local' });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in .env.development.local');
  process.exit(1);
}

/** Supabase project ref (20 lowercase characters) found in a connection string or API URL. */
const refOf = (v?: string) => (v ?? '').match(/[a-z]{20}/)?.[0];
const prod = fs.existsSync('.env.local') ? parse(fs.readFileSync('.env.local')) : {};
const prodRefs = [refOf(prod.DATABASE_URL), refOf(prod.NEXT_PUBLIC_SUPABASE_URL)].filter(Boolean);
const targetRef = refOf(url);
if (targetRef && prodRefs.includes(targetRef)) {
  console.error(`Refusing to run: DATABASE_URL in .env.development.local is the PRODUCTION project (${targetRef}).`);
  process.exit(1);
}
console.log('target host:', new URL(url).hostname);

const MIGRATIONS = [
  '00000000_baseline.sql',
  '20261004_auth_hardening.sql',
  '20261005_member_features.sql',
  '20261005_lock_down_open_policies.sql',
];

const BUCKETS: { id: string; public: boolean }[] = [
  { id: 'avatars', public: true },
  { id: 'content-media', public: true },
  { id: 'product-images', public: true },
  { id: 'partner-assets', public: true },
  { id: 'resumes', public: false },
  { id: 'community-voice', public: true },
  { id: 'knowledge-pdfs', public: false },
];

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(path.resolve(__dirname, '../database/migrations', file), 'utf8');
      process.stdout.write(`applying ${file} ... `);
      await client.query(sql);
      console.log('ok');
    }

    console.log('creating storage buckets and development storage policies');
    for (const b of BUCKETS) {
      await client.query(
        `insert into storage.buckets (id, name, public) values ($1, $1, $2)
         on conflict (id) do update set public = excluded.public`,
        [b.id, b.public],
      );
    }
    // Development project only: signed-in users can upload and manage objects in these buckets,
    // public buckets are readable by everyone. Production policies are set in the dashboard.
    await client.query(`
      drop policy if exists "dev read" on storage.objects;
      drop policy if exists "dev write" on storage.objects;
      create policy "dev read" on storage.objects for select using (
        bucket_id in ('avatars','content-media','product-images','partner-assets','community-voice') or auth.role() = 'authenticated');
      create policy "dev write" on storage.objects for all to authenticated using (
        bucket_id in ('avatars','content-media','product-images','partner-assets','community-voice','resumes','knowledge-pdfs'))
        with check (bucket_id in ('avatars','content-media','product-images','partner-assets','community-voice','resumes','knowledge-pdfs'));
    `);

    const { rows } = await client.query(`select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`);
    console.log(`done: ${rows[0].n} tables in the fresh project`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
