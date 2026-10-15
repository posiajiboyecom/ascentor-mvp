import test from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, nameOf, refusedSender } from '../../lib/nodemailer';
import { CONTACT_EMAIL, FROM_DEFAULT, HELLO_EMAIL } from '../../lib/contact';

test('the default sender is on the joinascentor.com domain', () => {
  assert.equal(HELLO_EMAIL.endsWith('@joinascentor.com'), true);
  assert.equal(CONTACT_EMAIL.endsWith('@joinascentor.com'), true);
  assert.equal(FROM_DEFAULT, `Ascentor <${HELLO_EMAIL}>`);
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
