// scripts/apply-migration.ts
// Applies one SQL migration file to the database in DATABASE_URL, inside a single transaction
// (all or nothing). WRITES to the database: it refuses to run without --yes.
//
//   npx tsx scripts/apply-migration.ts database/migrations/<file>.sql --yes
import fs from 'node:fs';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: npx tsx scripts/apply-migration.ts <file.sql> --yes');
  if (!args.includes('--yes')) throw new Error('Refusing to write without --yes');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set in .env.local');

  const sql = fs.readFileSync(file, 'utf8');
  // Split into top-level statements. DO $tag$ ... $tag$ blocks contain semicolons, so respect dollar quoting.
  const statements: string[] = [];
  let buf = '', tag: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const rest = sql.slice(i);
    if (tag === null) {
      const m = rest.match(/^\$[A-Za-z_]*\$/);
      if (m) { tag = m[0]; buf += tag; i += tag.length - 1; continue; }
      if (rest.startsWith('--')) { const nl = sql.indexOf('\n', i); const end = nl === -1 ? sql.length : nl; buf += sql.slice(i, end); i = end - 1; continue; }
      if (sql[i] === ';') { if (buf.replace(/--[^\n]*/g, '').trim()) statements.push(buf.trim()); buf = ''; continue; }
    } else if (rest.startsWith(tag)) { buf += tag; i += tag.length - 1; tag = null; continue; }
    buf += sql[i];
  }
  if (buf.replace(/--[^\n]*/g, '').trim()) statements.push(buf.trim());

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.$transaction(async (tx) => {
      for (const [i, st] of statements.entries()) {
        await tx.$executeRawUnsafe(st);
        console.log(`ok ${i + 1}/${statements.length}: ${st.split('\n').find((l) => l.trim() && !l.trim().startsWith('--'))?.trim().slice(0, 80)}`);
      }
    }, { timeout: 60_000 });
    console.log(`applied ${file} (${statements.length} statements)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
