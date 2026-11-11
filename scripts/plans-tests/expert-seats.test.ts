// Expert sessions: Pinnacle members get first claim on the last seats.
//   npm run test:plans
import test from 'node:test';
import assert from 'node:assert/strict';
import { heldSeats, seatProblem } from '../../lib/expert-seats';

const now = new Date('2026-11-11T12:00:00Z');
const far = new Date('2026-11-20T12:00:00Z');
const soon = new Date('2026-11-12T12:00:00Z');

test('20% of seats are held, at least one, only for sessions of 5 or more', () => {
  assert.equal(heldSeats(4), 0);
  assert.equal(heldSeats(5), 1);
  assert.equal(heldSeats(20), 4);
  assert.equal(heldSeats(null), 0);
});

test('held seats: Pinnacle can take them, others wait until 48 hours before', () => {
  assert.equal(seatProblem({ capacity: 20, taken: 15, isPinnacle: false, startsAt: far, now }), null);
  assert.match(seatProblem({ capacity: 20, taken: 16, isPinnacle: false, startsAt: far, now }) ?? '', /held for Pinnacle/);
  assert.equal(seatProblem({ capacity: 20, taken: 16, isPinnacle: true, startsAt: far, now }), null);
  assert.equal(seatProblem({ capacity: 20, taken: 16, isPinnacle: false, startsAt: soon, now }), null);
  assert.match(seatProblem({ capacity: 20, taken: 20, isPinnacle: true, startsAt: far, now }) ?? '', /full/);
  assert.equal(seatProblem({ capacity: null, taken: 999, isPinnacle: false, startsAt: far, now }), null);
});
