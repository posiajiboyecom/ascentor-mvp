// scripts/seed-demo.ts
// Creates (or removes) the demo Circles used for testing. Writes to the database named in .env.local, so run it on purpose.
//
//   npx tsx scripts/seed-demo.ts            create the demo Circles, mentors and members
//   npx tsx scripts/seed-demo.ts --reset    remove all demo data
//   npx tsx scripts/seed-demo.ts --again    remove, then create fresh
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { demoExists, resetDemo, seedDemo } from '../lib/rx/demo-seed';

config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const args = process.argv.slice(2);

  if (args.includes('--reset') || args.includes('--again')) {
    const r = await resetDemo(admin);
    console.log(`removed ${r.circles} demo Circles and ${r.users} demo members`);
    if (args.includes('--reset')) return;
  } else if (await demoExists(admin)) {
    console.log('Demo Circles already exist. Use --again to rebuild them or --reset to remove them.');
    return;
  }

  const r = await seedDemo(admin, (m) => console.log(' ', m));
  console.log(`created ${r.circles.length} demo Circles:`);
  for (const c of r.circles) console.log(`  ${c.interest}  ${c.id}`);
  console.log('Open /circle as an admin to find them under "Find a Circle". Open /admin/demo to drive the votes and calls.');
}

main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : e); process.exit(1); });
