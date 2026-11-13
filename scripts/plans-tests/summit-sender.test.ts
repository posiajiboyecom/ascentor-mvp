// Who Summit emails come from. A tiny in-process mail server stands in for Hostinger: it records the envelope sender, the From and
// Reply-To headers and the recipient of each message, and can be told to refuse any sender other than the mailbox (a real
// "sender not allowed" refusal, 553) or to fail the login (535).
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

type Mode = { sender: 'any' | 'mailbox-only'; auth: 'ok' | 'fail' };
const mode: Mode = { sender: 'any', auth: 'ok' };
const seen: { envFrom: string; from: string; replyTo: string; to: string; subject: string; raw: string }[] = [];
let attempts = 0;
const MAILBOX = 'a.samuel@joinascentor.com';

const server = net.createServer((sock) => {
  sock.setEncoding('utf8');
  let buf = '', inData = false, data = '', envFrom = '', rcpt = '', step: null | 'user' | 'pass' = null;
  const send = (s: string) => sock.write(s + '\r\n');
  send('220 test ESMTP');
  sock.on('data', (chunk: string) => {
    buf += chunk;
    for (;;) {
      if (inData) {
        data += buf; buf = '';
        const end = data.indexOf('\r\n.\r\n'); if (end < 0) return;
        const head = data.slice(0, end).replace(/\r\n[ \t]+/g, ' ');
        const h = (n: string) => (head.match(new RegExp(`^${n}:\\s*(.+)$`, 'im')) || [, ''])[1].trim();
        seen.push({ envFrom, from: h('From'), replyTo: h('Reply-To'), to: rcpt, subject: h('Subject'), raw: data.slice(0, end) });
        data = ''; inData = false; send('250 2.0.0 queued'); buf = ''; continue;
      }
      const i = buf.indexOf('\r\n'); if (i < 0) return;
      const line = buf.slice(0, i); buf = buf.slice(i + 2); const up = line.toUpperCase();
      if (step === 'user') { step = 'pass'; send('334 UGFzc3dvcmQ6'); continue; }
      if (step === 'pass') { step = null; send(mode.auth === 'fail' ? '535 5.7.8 authentication failed' : '235 2.7.0 ok'); continue; }
      if (up.startsWith('EHLO')) sock.write('250-test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
      else if (up.startsWith('AUTH PLAIN')) send(mode.auth === 'fail' ? '535 5.7.8 authentication failed' : '235 2.7.0 ok');
      else if (up.startsWith('AUTH LOGIN')) { step = 'user'; send('334 VXNlcm5hbWU6'); }
      else if (up.startsWith('MAIL FROM')) {
        attempts++; envFrom = (line.match(/<([^>]*)>/) || [, ''])[1].toLowerCase();
        if (mode.sender === 'mailbox-only' && envFrom !== MAILBOX) send('553 5.7.1 Sender address rejected: not owned by user');
        else send('250 ok');
      }
      else if (up.startsWith('RCPT TO')) { rcpt = (line.match(/<([^>]+)>/) || [, ''])[1].toLowerCase(); send('250 ok'); }
      else if (up === 'DATA') { inData = true; data = ''; send('354 go'); }
      else if (up === 'QUIT') { send('221 bye'); sock.end(); return; }
      else send('250 ok');
    }
  });
  sock.on('error', () => {});
});

let mod: typeof import('../../lib/summitEmails');
let nm: typeof import('../../lib/nodemailer');
let contact: typeof import('../../lib/contact');

test('setup: local mail server, env', async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'x', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_SECURE: 'false', SMTP_USER: MAILBOX, SMTP_PASS: 'x', MAIL_RETRY_DELAY_MS: '1' });
  delete process.env.SUMMIT_MAIL_FROM; delete process.env.MAIL_FROM; delete process.env.EMAIL_FROM; delete process.env.NEXT_PUBLIC_SUMMIT_EMAIL; delete process.env.MAIL_REPLY_TO;
  contact = await import('../../lib/contact'); nm = await import('../../lib/nodemailer'); mod = await import('../../lib/summitEmails');
});

test('the Summit sender defaults to summit@joinascentor.com with a display name; MAIL_FROM stays for everything else', () => {
  assert.equal(contact.SUMMIT_FROM, 'The Elevation Summit <summit@joinascentor.com>');
  assert.equal(contact.SUMMIT_REPLY_TO, 'summit@joinascentor.com');
  assert.equal(contact.FROM_DEFAULT, 'Ascentor <a.samuel@joinascentor.com>');
  assert.equal(/@joinascentor\.com>$/.test(contact.SUMMIT_FROM), true, 'must stay on joinascentor.com for SPF/DKIM alignment');
});

const ticket = { email: 'guest@example.com', fullName: 'Test Guest', whatsapp: '', organisation: '', attendanceType: 'onsite' as const, amountPaid: 0, currency: 'NGN', registrationId: '00000000-0000-0000-0000-000000000001', reference: 'T-1' };

test('each registrant-facing path is sent From summit@ with Reply-To summit@', async () => {
  seen.length = 0; mode.sender = 'any';
  await mod.sendPaymentReminderEmail('guest@example.com', 'Test Guest', 'virtual');
  await mod.sendStreamAccessEmail('guest@example.com', 'Test Guest');
  await mod.sendEventDayVirtualEmail('guest@example.com', 'Test Guest');
  await mod.sendEventDayPhysicalEmail('guest@example.com', 'Test Guest', '00000000-0000-0000-0000-000000000001');
  await mod.sendPaymentConfirmedEmail(ticket);
  await mod.sendComplimentaryTicketEmail(ticket);
  await mod.sendDonationReceiptEmail({ full_name: 'Test Guest', email: 'guest@example.com', amount: 5000, currency: 'NGN', reference: 'D-1' });
  assert.equal(seen.length, 7);
  for (const m of seen) {
    assert.equal(m.envFrom, 'summit@joinascentor.com', m.subject);
    assert.match(m.from, /The Elevation Summit/); assert.match(m.from, /summit@joinascentor\.com/);
    assert.equal(String(m.replyTo).replace(/.*<|>.*/g, ''), 'summit@joinascentor.com', JSON.stringify(m));
    assert.equal(m.to, 'guest@example.com');
  }
});

test('ticket emails show a scannable entry QR in the body that the door scanner accepts', async () => {
  // @ts-expect-error pngjs ships without type declarations (test-only use)
  const { PNG } = await import('pngjs');
  const jsQR = (await import('jsqr')).default;
  const { registrationIdFromScan } = await import('../../lib/summitCheckin');
  for (const send of [mod.sendPaymentConfirmedEmail, mod.sendComplimentaryTicketEmail]) {
    seen.length = 0; mode.sender = 'any';
    await send(ticket);
    assert.equal(seen.length, 1);
    const raw = seen[0].raw.replace(/=\r\n/g, '');
    assert.match(raw, /src=3D"cid:entry-qr"|src="cid:entry-qr"/, 'the HTML shows the QR inline');
    const part = raw.split(/\r\n--/).find((x) => /Content-ID:\s*<entry-qr>/i.test(x));
    assert.ok(part, 'the QR is attached with Content-ID entry-qr');
    assert.match(part!, /Content-Type:\s*image\/png/i);
    const b64 = part!.split(/\r\n\r\n/)[1].replace(/\s+/g, '');
    const png = PNG.sync.read(Buffer.from(b64, 'base64'));
    const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.ok(code, 'the image decodes as a QR code');
    assert.equal(registrationIdFromScan(code!.data), ticket.registrationId, 'and the scanner reads it as this registration');
    assert.match(raw, /Elevation-Summit-2026-Ticket\.pdf/, 'the PDF ticket is still attached');
  }
});

test('team alerts about Summit activity stay on the normal Ascentor address', async () => {
  seen.length = 0;
  await mod.sendAdminPaymentNotification({ fullName: 'Test Guest', email: 'guest@example.com', phone: '', attendanceType: 'onsite', organisation: '', amountPaid: 0, reference: 'T-1' } as never);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].envFrom, 'a.samuel@joinascentor.com');
  assert.doesNotMatch(seen[0].from, /summit@/);
  assert.equal(/contact@|hello@/i.test(seen[0].to), false);
});

test('fallback: the server refuses summit@ as a sender (553) -> one retry as the mailbox, Reply-To stays summit@', async () => {
  seen.length = 0; attempts = 0; mode.sender = 'mailbox-only';
  const warn = console.warn; console.warn = () => {};
  try { await mod.sendStreamAccessEmail('guest@example.com', 'Test Guest'); } finally { console.warn = warn; }
  assert.equal(attempts, 2, 'exactly one retry');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].envFrom, 'a.samuel@joinascentor.com');
  assert.match(seen[0].from, /a\.samuel@joinascentor\.com/);
  assert.equal(seen[0].replyTo.replace(/.*<|>.*/g, ''), 'summit@joinascentor.com');
  assert.equal(nm.refusedSender({ responseCode: 553, response: '553 5.7.1 Sender address rejected: not owned by user' }), true);
});

test('contact@ is still excluded: mail addressed to it goes to the team inbox, never to contact@', async () => {
  seen.length = 0; mode.sender = 'any'; mode.auth = 'ok';
  delete process.env.MAIL_ALLOW_ALIASES;
  const warn = console.warn; console.warn = () => {};
  try { await nm.sendEmail({ to: 'contact@joinascentor.com', subject: 'x', html: '<p>x</p>' }); } finally { console.warn = warn; }
  assert.equal(seen.length, 1);
  assert.notEqual(seen[0].to, 'contact@joinascentor.com');
  assert.equal(seen[0].to, 'a.samuel@joinascentor.com');
});

// Last on purpose: a login failure starts the mailer's 2 minute cool-down for this process.
test('a 535 login failure is NOT treated as a sender refusal: no retry as the mailbox, the failure is reported as a login problem', async () => {
  seen.length = 0; attempts = 0; mode.sender = 'any'; mode.auth = 'fail';
  const err = console.error; console.error = () => {};
  let thrown: unknown;
  try { await mod.sendStreamAccessEmail('guest@example.com', 'Test Guest'); } catch (e) { thrown = e; } finally { console.error = err; }
  assert.ok(thrown, 'the send fails');
  assert.equal(seen.length, 0);
  assert.equal(nm.classifyEmailError(thrown), 'auth');
  assert.equal(nm.refusedSender({ responseCode: 535, response: '535 5.7.8 authentication failed' }), false);
  mode.auth = 'ok';
});

test('teardown', () => { server.close(); });
