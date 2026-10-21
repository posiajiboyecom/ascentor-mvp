// Pure checks for the admin API guard: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AREA_KEYS, DEFAULT_ROLES, RANK, can, levelOf, legacyAreaFor, type Level } from '../../lib/admin/areas';

const ROOT = path.resolve(process.cwd(), 'app/api/admin');
const LEVELS: Level[] = ['view', 'edit', 'full'];
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : [];
  });
}

/** One row per exported handler: the area and level written in its guardApi call. */
function guards(file: string) {
  const src = fs.readFileSync(file, 'utf8');
  const out: { method: string; area?: string; level?: string }[] = [];
  for (const m of METHODS) {
    const at = src.indexOf(`export async function ${m}(`);
    if (at < 0) continue;
    const next = src.slice(at + 10).search(/export async function /);
    const body = src.slice(at, next < 0 ? undefined : at + 10 + next);
    const g = body.match(/guardApi\('([a-z]+)',\s*'([a-z]+)'/);
    out.push({ method: m, area: g?.[1], level: g?.[2] });
  }
  return out;
}

const table = routeFiles(ROOT).flatMap((f) => guards(f).map((g) => ({ route: path.relative(ROOT, path.dirname(f)).replace(/\\/g, '/'), ...g })));
const find = (m: string, route: string) => table.find((r) => r.method === m && r.route === route)!;

test('there are admin routes to check', () => assert.ok(table.length >= 37));

test('every handler under app/api/admin calls guardApi with a real area and level', () => {
  for (const r of table) {
    assert.ok(r.area && r.level, `${r.method} /api/admin/${r.route} has no guardApi call`);
    assert.ok(AREA_KEYS.includes(r.area!), `${r.route}: unknown area ${r.area}`);
    assert.ok(LEVELS.includes(r.level as Level), `${r.route}: unknown level ${r.level}`);
  }
});

test('reads are view or more, writes edit or more, deletes and exports full', () => {
  for (const r of table) {
    if (r.method === 'DELETE') assert.equal(r.level, 'full', `DELETE ${r.route}`);
    if (r.method === 'PATCH' || r.method === 'PUT') assert.notEqual(r.level, 'view', `${r.method} ${r.route}`);
  }
  assert.equal(find('GET', 'chats/export').level, 'full');
  assert.equal(find('GET', 'export').level, 'full');
  assert.equal(find('POST', 'knowledge/ingest-text').level, 'edit');
  assert.equal(find('POST', 'knowledge/ingest-text').area, 'knowledge');
  assert.equal(find('DELETE', 'coaching-sessions').area, 'chats');
  assert.equal(find('POST', 'permissions').area, 'team');
});

test('level comparison', () => {
  assert.ok(RANK.none < RANK.view && RANK.view < RANK.edit && RANK.edit < RANK.full);
  assert.ok(can('full', 'edit') && can('edit', 'edit') && can('view', 'view'));
  assert.ok(!can('view', 'edit') && !can('none', 'view') && !can('edit', 'full'));
});

test('default roles: finance is kept out of conversations and knowledge, moderator out of full exports', () => {
  const role = (id: string) => DEFAULT_ROLES.find((r) => r.id === id)!;
  assert.equal(can(levelOf(role('finance'), 'chats'), 'view'), false);
  assert.equal(can(levelOf(role('finance'), 'knowledge'), 'edit'), false);
  assert.equal(can(levelOf(role('moderator'), 'knowledge'), 'edit'), true);
  assert.equal(can(levelOf(role('moderator'), 'chats'), 'full'), false);
  assert.equal(can(levelOf(role('admin'), 'anything'), 'full'), true);
});

test('legacy pages map to an area', () => {
  assert.equal(legacyAreaFor('/admin/chats'), 'chats');
  assert.equal(legacyAreaFor('/admin/payments/x'), 'payments');
  assert.equal(legacyAreaFor('/admin/community'), 'chats');
  assert.equal(legacyAreaFor('/admin/community-events'), 'meetups');
  assert.equal(legacyAreaFor('/admin/c/payments'), null);
  assert.equal(legacyAreaFor('/admin'), null);
});
