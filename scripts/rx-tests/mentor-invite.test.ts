import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveStatus, hashInviteToken, looksLikeInviteToken, mentorInviteEmailContent, mentorInviteExpiry, mentorInviteLink,
  MENTOR_INVITE_TTL_DAYS, newInviteToken, splitList,
} from '../../lib/mentor-invite-core';

test('mentor links are personal, hashed and point at the mentor join page', () => {
  const t = newInviteToken();
  assert.ok(looksLikeInviteToken(t));
  assert.equal(hashInviteToken(t).length, 64);
  assert.notEqual(hashInviteToken(t), t);
  assert.equal(mentorInviteLink(t, 'https://joinascentor.com/'), `https://joinascentor.com/mentor/join/${t}`);
});

test('mentor links last 7 days and then read as expired', () => {
  const from = new Date('2026-11-24T10:00:00Z');
  const exp = mentorInviteExpiry(from);
  assert.equal(MENTOR_INVITE_TTL_DAYS, 7);
  assert.equal(exp.getTime() - from.getTime(), 7 * 864e5);
  assert.equal(effectiveStatus('sent', exp, new Date(exp.getTime() - 1)), 'sent');
  assert.equal(effectiveStatus('sent', exp, new Date(exp.getTime() + 1)), 'expired');
});

test('expertise and languages become a short, clean list', () => {
  assert.deepEqual(splitList(' Career change, leadership ,Leadership,\nStarting a business,, '), ['Career change', 'leadership', 'Starting a business']);
  assert.equal(splitList('a,b,c,d,e,f,g,h,i,j').length, 8);
  assert.deepEqual(splitList(''), []);
});

test('the invite email greets by first name and states the expiry', () => {
  const c = mentorInviteEmailContent({ inviterName: 'Posi', link: 'https://x/mentor/join/abc', expires: new Date('2026-12-01T12:00:00Z'), recipientName: 'Ada Obi' });
  assert.equal(c.hello, 'Hello Ada,');
  assert.match(c.body, /1 December 2026/);
  assert.match(c.text, /https:\/\/x\/mentor\/join\/abc/);
});
