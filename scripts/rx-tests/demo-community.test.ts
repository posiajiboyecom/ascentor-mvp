import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEMO_POSTS } from '../../lib/rx/demo-community';
import { cleanHtml, htmlToText } from '../../lib/rx/richtext';

const migration = fs.readFileSync('database/migrations/20261010_community_circles.sql', 'utf8');

test('every demo post uses a real category, a real type and clean html', () => {
  for (const d of DEMO_POSTS) {
    assert.ok(migration.includes(`'${d.category}'`), `category "${d.category}" is not in the migration`);
    assert.ok(['Question', 'Win', 'Reflection', 'Resource'].includes(d.type), d.type);
    assert.equal(cleanHtml(d.html), d.html, `html for "${d.category}" changes when cleaned`);
    assert.ok(d.text.length > 20);
    assert.ok(htmlToText(d.html).length > 10);
  }
});

test('the demo feed has variety and recent activity', () => {
  assert.ok(DEMO_POSTS.length >= 8);
  assert.ok(new Set(DEMO_POSTS.map((d) => d.category)).size >= 6);
  assert.ok(DEMO_POSTS.some((d) => d.comments.some((c) => c.reply)), 'at least one threaded reply');
  assert.ok(Math.min(...DEMO_POSTS.map((d) => d.hoursAgo)) < 12, 'something posted in the last 12 hours');
});
