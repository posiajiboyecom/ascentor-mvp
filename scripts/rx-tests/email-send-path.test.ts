import test from 'node:test';
import assert from 'node:assert/strict';
import { refusedSender, classifyEmailError, isAuthFailure, sendEmail, __testHooks } from '../../lib/nodemailer';

const authErr = Object.assign(new Error('Invalid login: 535 5.7.8 authentication failed'), { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' });
const senderErr = Object.assign(new Error('553 5.7.1 Sender address rejected: not owned by user'), { code: 'EENVELOPE', responseCode: 553 });
const opts = { to: 'a@example.com', subject: 's', html: '<p>x</p>', from: 'Ascentor <summit@joinascentor.com>' };

function fake(failWith: unknown[]) {
  const calls: { from: string; replyTo?: string }[] = [];
  const m = { sendMail: async (o: { from: string; replyTo?: string }) => { calls.push(o); const e = failWith[calls.length - 1]; if (e) throw e; return {}; } };
  return { m: m as never, calls };
}
const setup = (f: ReturnType<typeof fake>) => { process.env.SMTP_USER = 'box@joinascentor.com'; process.env.SMTP_PASS = 'x'; __testHooks({ mailer: f.m, retryDelayMs: 1, reset: true }); };

test('a 535 login failure is an auth problem, never a refused sender', () => {
  assert.equal(isAuthFailure(authErr), true);
  assert.equal(refusedSender(authErr), false);
  assert.equal(classifyEmailError(authErr), 'auth');
  assert.equal(classifyEmailError(senderErr), 'sender');
});

test('auth failure: one attempt only, no retry as the mailbox', async () => {
  const f = fake([authErr, authErr]); setup(f);
  await assert.rejects(sendEmail(opts));
  assert.equal(f.calls.length, 1);
});

test('after a login failure the next send does not reach the server at all (cooldown)', async () => {
  const f = fake([authErr]); setup(f);
  await assert.rejects(sendEmail(opts));
  await assert.rejects(sendEmail(opts));
  assert.equal(f.calls.length, 1);
});

test('a genuine sender refusal retries once as the mailbox, with reply-to kept, then stops', async () => {
  const f = fake([senderErr]); setup(f);
  await sendEmail(opts);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[1].from, /box@joinascentor\.com/);
  assert.equal(f.calls[1].replyTo, 'summit@joinascentor.com');
  const g = fake([senderErr, senderErr, senderErr]); setup(g);
  await assert.rejects(sendEmail(opts));
  assert.equal(g.calls.length, 2); // hard cap
});
