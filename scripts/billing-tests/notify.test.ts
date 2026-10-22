import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, plainFailureReason, type BillingNotifyEvent } from '../../lib/billing/notify';

const EVENTS: BillingNotifyEvent[] = [
  'card_added', 'card_removed', 'card_default_changed', 'payment_succeeded', 'payment_failed',
  'trial_started', 'trial_ending', 'grace_started', 'lapsed', 'reactivated', 'group_warning', 'credit_earned',
];
const DATA = {
  brand: 'visa', last4: '4081', amountKobo: 300_000, planName: 'Seeker, monthly',
  nextChargeAt: '2026-12-08T10:00:00Z', trialEndsAt: '2026-11-08T10:00:00Z', graceEndsAt: '2026-11-15T10:00:00Z',
  reason: 'Insufficient Funds', creditKobo: 60_000, balanceKobo: 120_000, activeCount: 2, renewalDate: '2026-12-08T10:00:00Z', soloPriceKobo: 300_000,
};

test('every event builds html, text and a subject with no em dashes', () => {
  for (const ev of EVENTS) {
    const e = buildEmail(ev, DATA, 'someone@example.com');
    assert.ok(e.subject.length > 3, ev);
    assert.ok(e.html.includes('<!DOCTYPE html>'), ev);
    assert.ok(e.html.includes('/settings/billing'), ev);
    assert.ok(e.text.includes('/settings/billing'), ev);
    for (const s of [e.subject, e.html, e.text, e.title, e.body]) {
      assert.ok(!s.includes(String.fromCharCode(0x2014)) && !s.includes('&' + 'mdash;'), `${ev} has an em dash`);
    }
  }
});

test('card emails show brand and last4 only', () => {
  const e = buildEmail('card_added', { ...DATA, exp_month: '12', authorization_code: 'AUTH_secret123' } as never, 'a@example.com');
  assert.ok(e.body.includes('Visa ending 4081'));
  assert.ok(!e.html.includes('AUTH_secret123'));
  assert.ok(!e.text.includes('AUTH_secret123'));
});

test('payment_succeeded carries amount, plan and next date', () => {
  const e = buildEmail('payment_succeeded', DATA);
  assert.ok(e.subject.includes('₦3,000'));
  assert.ok(e.text.includes('Seeker, monthly'));
  assert.ok(e.text.includes('8 December 2026'));
});

test('payment_failed explains the reason in plain words and shows the grace end', () => {
  const e = buildEmail('payment_failed', DATA);
  assert.ok(e.body.includes('not enough funds'));
  assert.ok(e.body.includes('15 November 2026'));
  assert.equal(e.label, 'Update your card');
});

test('failure reasons', () => {
  assert.match(plainFailureReason('Insufficient Funds'), /not enough funds/);
  assert.match(plainFailureReason('Do not honor'), /declined/);
  assert.match(plainFailureReason('Card expired'), /expired/);
  assert.match(plainFailureReason(undefined), /could not be completed/);
});

test('user text is escaped in html', () => {
  const e = buildEmail('payment_succeeded', { ...DATA, planName: '<script>alert(1)</script>' });
  assert.ok(!e.html.includes('<script>alert(1)</script>'));
});
