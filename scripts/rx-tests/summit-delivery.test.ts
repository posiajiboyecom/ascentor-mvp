import test from 'node:test';
import assert from 'node:assert/strict';
import { countDelivery, csvCell, deliveryCsv, deriveStatus, filterDelivery, kindFromCode, owed, plainError, progressText, toDeliveryRow, type DeliveryRegRow } from '../../lib/summitDeliveryCore';

const base: DeliveryRegRow = { id: '1', full_name: 'Ada Obi', email: 'ada@example.com', confirmation_email_sent_at: null, confirmation_email_status: null, confirmation_email_attempts: 0, confirmation_email_error_code: null, confirmation_email_last_attempt_at: null };
const mk = (o: Partial<DeliveryRegRow>) => ({ ...base, ...o });

test('status: sent wins, then in-progress, then failed, otherwise not sent', () => {
  assert.equal(deriveStatus(mk({ confirmation_email_sent_at: '2026-10-26T10:00:00Z', confirmation_email_status: 'failed' })), 'sent');
  assert.equal(deriveStatus(mk({ confirmation_email_status: 'sending' })), 'unknown');
  assert.equal(deriveStatus(mk({ confirmation_email_status: 'failed', confirmation_email_error_code: 'EAUTH' })), 'failed');
  assert.equal(deriveStatus(mk({ confirmation_email_error_code: '550' })), 'failed');
  assert.equal(deriveStatus(base), 'unsent');
  // legacy rows: sent before attempts were tracked
  assert.equal(deriveStatus(mk({ confirmation_email_sent_at: '2026-10-20T10:00:00Z', confirmation_email_status: null })), 'sent');
});

test('error codes become plain words, never raw codes alone', () => {
  assert.equal(kindFromCode('EAUTH'), 'auth');
  assert.equal(kindFromCode('535'), 'auth');
  assert.equal(kindFromCode('ETIMEDOUT'), 'connection');
  assert.equal(kindFromCode('550'), 'rejected');
  assert.equal(kindFromCode(''), 'unknown');
  assert.match(plainError('EAUTH'), /login/);
  assert.match(plainError('550'), /address may not exist/);
  assert.equal(plainError(null), '');
});

test('counts, tabs and search', () => {
  const rows = [
    toDeliveryRow(mk({ id: 'a', confirmation_email_sent_at: '2026-10-26T10:00:00Z' })),
    toDeliveryRow(mk({ id: 'b', full_name: 'Bola Ade', email: 'bola@example.com' })),
    toDeliveryRow(mk({ id: 'c', confirmation_email_status: 'failed', confirmation_email_error_code: 'EAUTH', confirmation_email_attempts: 2 })),
    toDeliveryRow(mk({ id: 'd', confirmation_email_status: 'sending' })),
  ];
  const c = countDelivery(rows);
  assert.deepEqual(c, { total: 4, sent: 1, unsent: 1, failed: 1, unknown: 1 });
  assert.equal(owed(c), 3);
  assert.deepEqual(filterDelivery(rows, 'sent', '').map((r) => r.id), ['a']);
  assert.deepEqual(filterDelivery(rows, 'unsent', '').map((r) => r.id), ['b', 'd']);
  assert.deepEqual(filterDelivery(rows, 'failed', '').map((r) => r.id), ['c']);
  assert.deepEqual(filterDelivery(rows, 'all', ' BOLA@ ').map((r) => r.id), ['b']);
  assert.equal(rows[2].attempts, 2);
  assert.equal(rows[2].error.includes('login'), true);
});

test('csv quotes cells and defuses spreadsheet formulas', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+234 801'), "'+234 801");
  assert.equal(csvCell(null), '');
  const csv = deliveryCsv([toDeliveryRow(mk({ full_name: '=cmd', confirmation_email_status: 'failed', confirmation_email_error_code: '535' }))]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'Name,Email,Status,Attempts,Last attempt (UTC),Sent at (UTC),Last error');
  assert.equal(lines[1].startsWith("'=cmd,ada@example.com,Failed,0"), true);
});

test('progress text reads like "38 of 43 sent"', () => {
  assert.equal(progressText(38, 43, 0), '38 of 43 sent');
  assert.equal(progressText(38, 43, 2), '38 of 43 sent, 2 failed');
});
