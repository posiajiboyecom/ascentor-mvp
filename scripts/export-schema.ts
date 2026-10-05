// scripts/export-schema.ts
// Reads the LIVE database (read-only SELECTs against the catalogs) and writes an
// idempotent baseline migration, so a fresh Supabase project can be built from the
// repository. No data is read or written; only structure.
//
//   npx tsx scripts/export-schema.ts            writes database/migrations/00000000_baseline.sql
//
// Every statement is written to be safe to run on a database that already has the
// object: CREATE ... IF NOT EXISTS, guarded constraints, DROP POLICY/TRIGGER IF EXISTS.
import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

config({ path: '.env.local' });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const q = async <T = any>(sql: string): Promise<T[]> => {
  try {
    return (await prisma.$queryRawUnsafe(sql)) as T[];
  } catch (e) {
    console.error('query failed:', sql.split(/\s+/).join(' ').slice(0, 200));
    throw e;
  }
};
const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const out: string[] = [];
  const section = (title: string) => out.push('', `-- ${'='.repeat(74)}`, `-- ${title}`, `-- ${'='.repeat(74)}`, '');

  out.push(
    '-- ============================================================================',
    '-- 00000000_baseline.sql',
    `-- Baseline of the live "public" schema, exported ${new Date().toISOString().slice(0, 10)} by scripts/export-schema.ts.`,
    '-- Structure only: tables, types, sequences, constraints, indexes, functions, triggers,',
    '-- views, Row Level Security and policies. No data.',
    '--',
    '-- SECURITY NOTE: this is a faithful snapshot, so it includes the over-permissive policies that',
    '-- exist in production. Apply 20261005_lock_down_open_policies.sql immediately after it.',
    '--',
    '-- Idempotent: safe on a database that already has these objects. Apply this FIRST on a',
    '-- fresh project, then the dated migrations in order (they are all idempotent too).',
    '-- Regenerate with: npx tsx scripts/export-schema.ts',
    '-- ============================================================================',
    '',
    'SET check_function_bodies = false;',
  );

  // ── extensions ──────────────────────────────────────────────────────────────
  section('Extensions');
  const ext = await q<{ extname: string }>(`select extname::text as extname from pg_extension where extname not in ('plpgsql') order by 1`);
  const SAFE_EXT = new Set(['vector', 'pgcrypto', 'uuid-ossp', 'pg_trgm', 'citext', 'unaccent']);
  for (const e of ext) {
    if (SAFE_EXT.has(e.extname)) out.push(`CREATE EXTENSION IF NOT EXISTS ${ident(e.extname)};`);
    else out.push(`-- ${e.extname}: managed by Supabase, enable from the dashboard if needed`);
  }

  // ── enum types ──────────────────────────────────────────────────────────────
  section('Enum types');
  const enums = await q<{ name: string; labels: string[] }>(`
    select t.typname::text as name, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
    from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' group by t.typname order by 1`);
  for (const e of enums) {
    out.push(`DO $$ BEGIN CREATE TYPE public.${ident(e.name)} AS ENUM (${e.labels.map(lit).join(', ')}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }

  // ── sequences ───────────────────────────────────────────────────────────────
  section('Sequences');
  const seqs = await q<{ name: string }>(`
    select c.relname::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'i') order by 1`);
  seqs.forEach((s) => out.push(`CREATE SEQUENCE IF NOT EXISTS public.${ident(s.name)};`));

  // ── tables ──────────────────────────────────────────────────────────────────
  section('Tables');
  const tables = await q<{ name: string }>(`
    select c.relname::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') order by 1`);
  const cols = await q<{ t: string; col: string; type: string; notnull: boolean; def: string | null; identity: string; generated: string }>(`
    select c.relname as t, a.attname as col, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as notnull,
           pg_get_expr(d.adbin, d.adrelid) as def, a.attidentity::text as identity, a.attgenerated::text as generated
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`);
  for (const t of tables) {
    const mine = cols.filter((c) => c.t === t.name);
    const defs = mine.map((c) => {
      let line = `  ${ident(c.col)} ${c.type}`;
      if (c.identity === 'a') line += ' GENERATED ALWAYS AS IDENTITY';
      else if (c.identity === 'd') line += ' GENERATED BY DEFAULT AS IDENTITY';
      else if (c.generated === 's' && c.def) line += ` GENERATED ALWAYS AS (${c.def}) STORED`;
      else if (c.def) line += ` DEFAULT ${c.def}`;
      if (c.notnull && c.identity === '') line += ' NOT NULL';
      return line;
    });
    out.push(`CREATE TABLE IF NOT EXISTS public.${ident(t.name)} (`, defs.join(',\n'), ');', '');
  }

  // Columns added later in the table's life: guarantee presence on pre-existing tables.
  section('Column presence (for databases that already have older versions of these tables)');
  for (const c of cols) {
    let line = `ALTER TABLE public.${ident(c.t)} ADD COLUMN IF NOT EXISTS ${ident(c.col)} ${c.type}`;
    if (c.generated === '' && c.identity === '' && c.def) line += ` DEFAULT ${c.def}`;
    out.push(line + ';');
  }

  // ── constraints ─────────────────────────────────────────────────────────────
  const cons = await q<{ t: string; name: string; type: string; def: string }>(`
    select c.relname as t, k.conname as name, k.contype::text as type, pg_get_constraintdef(k.oid) as def
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and k.contype in ('p','u','c','f') order by case k.contype when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end, c.relname, k.conname`);
  section('Primary keys, unique and check constraints');
  for (const k of cons.filter((x) => x.type !== 'f')) {
    out.push(`DO $$ BEGIN ALTER TABLE public.${ident(k.t)} ADD CONSTRAINT ${ident(k.name)} ${k.def}; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $$;`);
  }
  section('Foreign keys');
  for (const k of cons.filter((x) => x.type === 'f')) {
    out.push(`DO $$ BEGIN ALTER TABLE public.${ident(k.t)} ADD CONSTRAINT ${ident(k.name)} ${k.def}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  }

  // ── indexes ─────────────────────────────────────────────────────────────────
  section('Indexes');
  const idx = await q<{ def: string }>(`
    select pg_get_indexdef(i.indexrelid) as def
    from pg_index i join pg_class c on c.oid = i.indrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not i.indisprimary
      and not exists (select 1 from pg_constraint k where k.conindid = i.indexrelid)
    order by 1`);
  idx.forEach((i) => out.push(i.def.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ') + ';'));

  // ── functions ───────────────────────────────────────────────────────────────
  section('Functions');
  const fns = await q<{ def: string }>(`
    select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f','p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by p.proname`);
  fns.forEach((f) => out.push(f.def.trimEnd() + ';', ''));

  // ── views ───────────────────────────────────────────────────────────────────
  const views = await q<{ name: string; def: string }>(`
    select c.relname as name, pg_get_viewdef(c.oid, true) as def from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v' order by 1`);
  if (views.length) {
    section('Views');
    views.forEach((v) => out.push(`CREATE OR REPLACE VIEW public.${ident(v.name)} AS ${v.def.trimEnd().replace(/;$/, '')};`, ''));
  }

  // ── triggers ────────────────────────────────────────────────────────────────
  // Includes the triggers on auth.users (profile creation / email sync), which live outside
  // the public schema but call public functions.
  section('Triggers');
  const trg = await q<{ s: string; t: string; name: string; def: string }>(`
    select n.nspname::text as s, c.relname::text as t, tg.tgname::text as name, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where not tg.tgisinternal and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users')) order by 1, 2, 3`);
  trg.forEach((t) => out.push(`DROP TRIGGER IF EXISTS ${ident(t.name)} ON ${t.s}.${ident(t.t)};`, t.def + ';'));

  // ── RLS ─────────────────────────────────────────────────────────────────────
  section('Row Level Security');
  const rls = await q<{ name: string }>(`
    select c.relname::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity order by 1`);
  rls.forEach((r) => out.push(`ALTER TABLE public.${ident(r.name)} ENABLE ROW LEVEL SECURITY;`));
  const pol = await q<{ t: string; name: string; permissive: string; roles: string[]; cmd: string; qual: string | null; wc: string | null }>(`
    select tablename::text as t, policyname::text as name, permissive::text as permissive, array_to_string(roles, ',') as roles, cmd::text as cmd, qual, with_check as wc
    from pg_policies where schemaname = 'public' order by tablename, policyname`);
  section('Policies');
  for (const p of pol) {
    const roles = (Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(',')).filter(Boolean).join(', ') || 'PUBLIC';
    out.push(
      `DROP POLICY IF EXISTS ${ident(p.name)} ON public.${ident(p.t)};`,
      `CREATE POLICY ${ident(p.name)} ON public.${ident(p.t)} AS ${p.permissive} FOR ${p.cmd} TO ${roles}` +
        (p.qual ? ` USING (${p.qual})` : '') + (p.wc ? ` WITH CHECK (${p.wc})` : '') + ';',
    );
  }

  const file = path.resolve(__dirname, '../database/migrations/00000000_baseline.sql');
  fs.writeFileSync(file, out.join('\n') + '\n');
  console.log(`tables ${tables.length}, columns ${cols.length}, constraints ${cons.length}, indexes ${idx.length}, functions ${fns.length}, triggers ${trg.length}, policies ${pol.length}, rls tables ${rls.length}`);
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
