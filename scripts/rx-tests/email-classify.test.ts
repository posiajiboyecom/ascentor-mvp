import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEmailError } from '../../lib/nodemailer';

test('classifies the Hostinger 535 login refusal as auth', () => {
  assert.equal(classifyEmailError({ code: 'EAUTH', responseCode: 535, response: '535 5.7.8 Authentication failed' }), 'auth');
});
test('classifies a refused From address as sender', () => {
  assert.equal(classifyEmailError({ responseCode: 553, response: '553 Sender address not owned by user' }), 'sender');
});
test('classifies network failures as connection', () => {
  assert.equal(classifyEmailError({ code: 'ETIMEDOUT', message: 'Connection timeout' }), 'connection');
});
test('anything else is unknown', () => {
  assert.equal(classifyEmailError(new Error('boom')), 'unknown');
});
