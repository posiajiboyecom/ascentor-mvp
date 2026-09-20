// Ad-hoc database access through Prisma. Not part of the Next.js app or its build.
//
//   npx tsx scripts/db.ts "select count(*) from summit_registrations"
//
// Read-only by default. Pass --write to allow statements that change data.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const sql = args.filter(a => a !== '--write').join(' ').trim();
  if (!sql) throw new Error('Usage: npx tsx scripts/db.ts "<sql>" [--write]');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env.local');

  const isRead = /^\s*(select|with|show|explain)\b/i.test(sql);
  if (!isRead && !write) throw new Error('Refusing to run a non-SELECT statement without --write');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (isRead) {
      const rows = await prisma.$queryRawUnsafe(sql);
      console.log(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    } else {
      const n = await prisma.$executeRawUnsafe(sql);
      console.log(`OK, ${n} row(s) affected`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
