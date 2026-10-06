// scripts/dry-run-migration.ts
// Runs a migration file and an optional probe INSIDE ONE TRANSACTION THAT IS ALWAYS ROLLED BACK,
// printing the probe result. Proves a migration works against the real database without changing it.
//
//   npx tsx scripts/dry-run-migration.ts database/migrations/<file>.sql [--probe path/to/probe.sql]
import fs from 'node:fs';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

class Rollback extends Error {}

function split(sql: string): string[] {
  const out: string[] = [];
  let buf = '', tag: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const rest = sql.slice(i);
    if (tag === null) {
      const m = rest.match(/^\$[A-Za-z_]*\$/);
      if (m) { tag = m[0]; buf += tag; i += tag.length - 1; continue; }
      if (rest.startsWith('--')) { const nl = sql.indexOf('\n', i); const end = nl === -1 ? sql.length : nl; buf += sql.slice(i, end); i = end - 1; continue; }
      if (sql[i] === ';') { if (buf.replace(/--[^\n]*/g, '').trim()) out.push(buf.trim()); buf = ''; continue; }
    } else if (rest.startsWith(tag)) { buf += tag; i += tag.length - 1; tag = null; continue; }
    buf += sql[i];
  }
  if (buf.replace(/--[^\n]*/g, '').trim()) out.push(buf.trim());
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--probe') + 1]);
  const probeFile = args.includes('--probe') ? args[args.indexOf('--probe') + 1] : undefined;
  if (!file) throw new Error('Usage: npx tsx scripts/dry-run-migration.ts <file.sql> [--probe probe.sql]');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.$transaction(async (tx) => {
      for (const st of split(fs.readFileSync(file, 'utf8'))) await tx.$executeRawUnsafe(st);
      console.log(`migration statements ran without error (${file})`);
      if (probeFile) {
        for (const st of split(fs.readFileSync(probeFile, 'utf8'))) {
          if (/^\s*select/i.test(st)) console.log('probe result:', JSON.stringify(await tx.$queryRawUnsafe(st), (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 1));
          else await tx.$executeRawUnsafe(st);
        }
      }
      throw new Rollback();
    }, { timeout: 60_000, maxWait: 30_000 });
  } catch (e) {
    if (e instanceof Rollback) console.log('rolled back: the database was not changed');
    else console.log('FAILED:', (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
