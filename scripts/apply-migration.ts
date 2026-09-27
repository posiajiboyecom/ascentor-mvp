// One-off helper: apply a raw .sql migration file through the same Prisma
// connection scripts/db.ts uses. Not part of the Next.js app or its build.
//
//   npx tsx scripts/apply-migration.ts database/migrations/<file>.sql --write
//
// Read-only check by default (just prints the SQL); pass --write to execute.
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const file = args.find((a) => a !== '--write');
  if (!file) throw new Error('Usage: npx tsx scripts/apply-migration.ts <file.sql> [--write]');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env.local');

  const sql = readFileSync(file, 'utf8');
  if (!write) {
    console.log(`Dry run. Would execute:\n${sql}`);
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log(`Migration applied: ${file}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
