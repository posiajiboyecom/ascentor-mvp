import test from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, nameOf, refusedSender, guardRecipient } from '../../lib/nodemailer';
import { MAILBOX_EMAIL, FROM_DEFAULT, REPLY_TO, SUPPORT_EMAIL, PUBLIC_EMAIL, adminNotifyEmail, fromAs } from '../../lib/contact';

test('the address shown to visitors is the public inbox, never the private mailbox', () => {
  // a.samuel@ is reserved for serious business mail; visitors write to the Gmail inbox.
  assert.equal(PUBLIC_EMAIL, 'joinascentor@gmail.com');
  assert.equal(SUPPORT_EMAIL, PUBLIC_EMAIL);
  assert.equal(SUPPORT_EMAIL.includes(MAILBOX_EMAIL), false);
});

test('every default sending/alert address is the real mailbox, never an alias', () => {
  assert.equal(MAILBOX_EMAIL, 'a.samuel@joinascentor.com');
  for (const v of [FROM_DEFAULT, REPLY_TO, adminNotifyEmail()]) {
    assert.equal(v.includes(MAILBOX_EMAIL), true, v);
    assert.equal(/contact@|hello@/i.test(v), false, v);
  }
  assert.equal(FROM_DEFAULT, 'Ascentor <a.samuel@joinascentor.com>');
});

test('fromAs keeps the From address and changes only the display name', () => {
  assert.equal(fromAs('Ascentor Partners'), 'Ascentor Partners <a.samuel@joinascentor.com>');
  assert.equal(fromAs('Bad <x@evil.com> Name'), 'Bad x@evil.com Name <a.samuel@joinascentor.com>');
  assert.equal(fromAs('   '), 'Ascentor <a.samuel@joinascentor.com>');
});

test('ADMIN_NOTIFY_EMAIL wins, then the older per-feature value, then the mailbox', () => {
  const saved = process.env.ADMIN_NOTIFY_EMAIL;
  try {
    delete process.env.ADMIN_NOTIFY_EMAIL;
    assert.equal(adminNotifyEmail(undefined, ' '), MAILBOX_EMAIL);
    assert.equal(adminNotifyEmail(undefined, 'old@example.com'), 'old@example.com');
    process.env.ADMIN_NOTIFY_EMAIL = 'team@example.com';
    assert.equal(adminNotifyEmail('old@example.com'), 'team@example.com');
  } finally { if (saved === undefined) delete process.env.ADMIN_NOTIFY_EMAIL; else process.env.ADMIN_NOTIFY_EMAIL = saved; }
});

test('mail addressed to the unproven contact@ alias is redirected to the team inbox', () => {
  const saved = { a: process.env.MAIL_ALLOW_ALIASES, n: process.env.ADMIN_NOTIFY_EMAIL };
  const warn = console.warn; console.warn = () => {};
  try {
    delete process.env.MAIL_ALLOW_ALIASES; delete process.env.ADMIN_NOTIFY_EMAIL;
    assert.equal(guardRecipient('contact@joinascentor.com'), MAILBOX_EMAIL);
    assert.equal(guardRecipient('Team <Contact@JoinAscentor.com>'), MAILBOX_EMAIL);
    assert.equal(guardRecipient('member@example.com'), 'member@example.com');
    process.env.MAIL_ALLOW_ALIASES = 'true';
    assert.equal(guardRecipient('contact@joinascentor.com'), 'contact@joinascentor.com');
  } finally {
    console.warn = warn;
    if (saved.a === undefined) delete process.env.MAIL_ALLOW_ALIASES; else process.env.MAIL_ALLOW_ALIASES = saved.a;
    if (saved.n === undefined) delete process.env.ADMIN_NOTIFY_EMAIL; else process.env.ADMIN_NOTIFY_EMAIL = saved.n;
  }
});

test('reads the address and the display name out of a From line', () => {
  assert.equal(addressOf('Ascentor <Hello@JoinAscentor.com>'), 'hello@joinascentor.com');
  assert.equal(addressOf('plain@x.com'), 'plain@x.com');
  assert.equal(nameOf('Ascentor Summit <summit@joinascentor.com>'), 'Ascentor Summit');
  assert.equal(nameOf('plain@x.com'), 'Ascentor');
});

test('a refused sender is recognised, other failures are not', () => {
  assert.equal(refusedSender({ responseCode: 553, response: '553 Sender address rejected: not owned by user' }), true);
  assert.equal(refusedSender({ responseCode: 550, response: '550 5.7.1 Sender mismatch' }), true);
  assert.equal(refusedSender({ responseCode: 550, response: '550 mailbox unavailable for recipient' }), false);
  assert.equal(refusedSender({ responseCode: 421, response: '421 try again later' }), false);
  assert.equal(refusedSender(new Error('connect ETIMEDOUT')), false);
  assert.equal(refusedSender(null), false);
});
