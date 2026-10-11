import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, emailAllowed, isOn, KINDS, PREF, EMAIL_DAILY_CAP, type NotifKind } from '../../lib/rx/notify-rules';

test('everything is on until a member turns it off', () => {
  assert.equal(isOn(null, PREF.circle), true);
  assert.equal(isOn({}, PREF.circle), true);
  assert.equal(isOn({ [PREF.circle]: false }, PREF.circle), false);
});

test('reactions never email', () => {
  assert.equal(KINDS.post_reaction.emailPref, null);
  assert.deepEqual(decide('post_reaction', null), { inApp: true, email: false });
});

test('comments and shares email by default', () => {
  assert.equal(decide('post_comment', null).email, true);
  assert.equal(decide('post_share', null).email, true);
  assert.equal(decide('comment_reply', null).email, true);
});

test('turning the in-app switch off silences email too', () => {
  const d = decide('vote_won', { [PREF.circle]: false });
  assert.deepEqual(d, { inApp: false, email: false });
});

test('the email switch alone turns email off but keeps in-app', () => {
  const d = decide('vote_opened', { [PREF.emailCircle]: false });
  assert.deepEqual(d, { inApp: true, email: false });
});

test('busy events that should not email', () => {
  for (const k of ['circle_new_member', 'vote_cast', 'post_reaction'] as NotifKind[]) assert.equal(decide(k, null).email, false, k);
});

test('email limits', () => {
  assert.equal(emailAllowed({ sentLast24h: 0, minutesSinceSameThing: null }), true);
  assert.equal(emailAllowed({ sentLast24h: EMAIL_DAILY_CAP, minutesSinceSameThing: null }), false);
  assert.equal(emailAllowed({ sentLast24h: 1, minutesSinceSameThing: 3 }), false);
  assert.equal(emailAllowed({ sentLast24h: 1, minutesSinceSameThing: 45 }), true);
});

test('repeat-prone kinds fold together, one-off kinds do not', () => {
  assert.equal(KINDS.post_reaction.coalesce, true);
  assert.equal(KINDS.post_comment.coalesce, true);
  assert.equal(KINDS.vote_won.coalesce, false);
});
