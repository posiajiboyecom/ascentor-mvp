import test from 'node:test';
import assert from 'node:assert/strict';
import { nestComments, type CommentView } from '../../lib/rx/feed-types';

const c = (id: string, parentId: string | null): CommentView => ({ id, userId: 'u', name: 'N', avatarUrl: null, body: id, time: '', mine: false, parentId, replies: [] });

test('top-level comments stay top-level', () => {
  const t = nestComments([c('a', null), c('b', null)]);
  assert.deepEqual(t.map((x) => x.id), ['a', 'b']);
});

test('replies nest under their comment', () => {
  const t = nestComments([c('a', null), c('r1', 'a'), c('b', null)]);
  assert.equal(t[0].replies[0].id, 'r1');
  assert.equal(t.length, 2);
});

test('a reply to a reply stays one level deep', () => {
  const t = nestComments([c('a', null), c('r1', 'a'), c('r2', 'r1')]);
  assert.deepEqual(t[0].replies.map((x) => x.id), ['r1', 'r2']);
  assert.equal(t[0].replies[0].replies.length, 0);
});

test('a reply whose parent is gone is shown at top level', () => {
  const t = nestComments([c('orphan', 'missing')]);
  assert.equal(t.length, 1);
});
