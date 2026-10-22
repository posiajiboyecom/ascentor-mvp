// Pure checks for the Leader plan rule and invite helpers: no network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_TTL_DAYS, canResend, canRevoke, effectiveStatus, emailsMatch, hashInviteToken, inviteEmailContent, inviteExpiry,
  inviteLink, leaderEligible, looksLikeInviteToken, newInviteToken,
} from '../../lib/leader-invite-core';

test('eligibility: marked, Leading stage, or already on the plan', () => {
  assert.equal(leaderEligible({ isMarkedLeader: true }), true);
  assert.equal(leaderEligible({ stage: 'Leading' }), true);
  assert.equal(leaderEligible({ plan: 'leader' }), true);
  assert.equal(leaderEligible({ plan: 'climber' }), true);
});

test('eligibility: everyone else is out', () => {
  assert.equal(leaderEligible({}), false);
  assert.equal(leaderEligible({ isMarkedLeader: false, stage: 'Building', plan: 'builder' }), false);
  assert.equal(leaderEligible({ stage: 'Seeking', plan: 'explorer' }), false);
  assert.equal(leaderEligible({ isMarkedLeader: null, stage: null, plan: null }), false);
});

test('tokens are 32 random bytes, hashed with SHA-256', () => {
  const a = newInviteToken(); const b = newInviteToken();
  assert.notEqual(a, b);
  assert.ok(looksLikeInviteToken(a));
  assert.ok(!looksLikeInviteToken('short'));
  const h = hashInviteToken(a);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(h, hashInviteToken(a));
  assert.notEqual(h, hashInviteToken(b));
  assert.ok(!h.includes(a));
});

test('expiry is 14 days and expired invites are detected', () => {
  assert.equal(INVITE_TTL_DAYS, 14);
  const t0 = new Date('2026-10-25T10:00:00Z');
  assert.equal(inviteExpiry(t0).toISOString(), '2026-11-08T10:00:00.000Z');
  assert.equal(effectiveStatus('sent', inviteExpiry(t0), t0), 'sent');
  assert.equal(effectiveStatus('sent', inviteExpiry(t0), new Date('2026-11-08T10:00:01Z')), 'expired');
  assert.equal(effectiveStatus('used', t0, new Date('2027-01-01')), 'used');
  assert.equal(effectiveStatus('revoked', inviteExpiry(t0), t0), 'revoked');
});

test('resend and revoke rules', () => {
  assert.deepEqual((['sent', 'expired', 'used', 'revoked'] as const).map(canResend), [true, true, false, false]);
  assert.deepEqual((['sent', 'expired', 'used', 'revoked'] as const).map(canRevoke), [true, false, false, false]);
});

test('emails compare case-insensitively', () => {
  assert.equal(emailsMatch(' Ada@Example.com ', 'ada@example.COM'), true);
  assert.equal(emailsMatch('ada@example.com', 'bob@example.com'), false);
  assert.equal(emailsMatch('', ''), false);
  assert.equal(emailsMatch(null, 'a@b.co'), false);
});

test('invite email: copy, link and no em dashes', () => {
  const link = inviteLink('T'.repeat(43), 'https://joinascentor.com/');
  assert.equal(link, `https://joinascentor.com/leader-invite/${'T'.repeat(43)}`);
  const c = inviteEmailContent({ inviterName: 'Posi', link, expires: new Date('2026-11-08T10:00:00Z'), recipientName: 'Ada Obi', price: 'NGN 40,000' });
  assert.equal(c.subject, 'You are invited to lead with Ascentor');
  assert.ok(c.text.includes(link));
  assert.ok(c.text.startsWith('Hello Ada,'));
  assert.ok(c.body.includes('NGN 40,000') && c.body.includes('8 November 2026'));
  assert.ok(!new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(c.subject + c.body + c.text));
  console.log('preview:', c.text.replace(/leader-invite\/\S+/, 'leader-invite/<token>'));
});
