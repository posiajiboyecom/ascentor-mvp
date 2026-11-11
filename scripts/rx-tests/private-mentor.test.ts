// Pinnacle private mentor sessions: booking, month and cancel rules.
//   npm run test:rx
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../../lib/rx/private-mentor-rules';

const now = new Date('2026-11-11T12:00:00Z');
const h = (n: number) => new Date(now.getTime() + n * 3600000);
const agenda = 'Choosing between two job offers.';

test('month key is the UTC calendar month', () => {
  assert.equal(R.monthKey('2026-11-30T23:30:00Z'), '2026-11');
  assert.equal(R.monthKey('2026-12-01T00:00:00Z'), '2026-12');
});

test('book at least 48 hours ahead and at most 60 days ahead', () => {
  assert.match(R.bookingProblem({ slotStartsAt: h(47), liveSessionStarts: [], agenda, now }) ?? '', /2 days away/);
  assert.equal(R.bookingProblem({ slotStartsAt: h(49), liveSessionStarts: [], agenda, now }), null);
  assert.match(R.bookingProblem({ slotStartsAt: h(61 * 24), liveSessionStarts: [], agenda, now }) ?? '', /60 days/);
});

test('one live session per month; another month is fine', () => {
  const booked = [new Date('2026-11-20T10:00:00Z')];
  assert.match(R.bookingProblem({ slotStartsAt: new Date('2026-11-25T10:00:00Z'), liveSessionStarts: booked, agenda, now }) ?? '', /already have/);
  assert.equal(R.bookingProblem({ slotStartsAt: new Date('2026-12-03T10:00:00Z'), liveSessionStarts: booked, agenda, now }), null);
  assert.equal(R.usedThisMonth(booked, now), true);
  assert.equal(R.usedThisMonth([], now), false);
});

test('an agenda is required and capped', () => {
  assert.match(R.bookingProblem({ slotStartsAt: h(72), liveSessionStarts: [], agenda: 'hi', now }) ?? '', /Write what/);
  assert.match(R.bookingProblem({ slotStartsAt: h(72), liveSessionStarts: [], agenda: 'x'.repeat(R.AGENDA_MAX + 1), now }) ?? '', /under/);
});

test('member changes close 24 hours before; the mentor can cancel until the start', () => {
  assert.equal(R.memberCanChange(h(25), now), true);
  assert.equal(R.memberCanChange(h(23), now), false);
  assert.equal(R.mentorCanCancel(h(1), now), true);
  assert.equal(R.mentorCanCancel(h(-1), now), false);
});
