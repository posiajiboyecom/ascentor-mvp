import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, isDigestMoment, isMorningNudge, type DigestInput } from '../../lib/rx/digest';

const base: DigestInput = { firstName: 'Tunde', lastWeek: { kept: 3, checkedIn: 5 }, lessonTitle: 'Small promises, kept', lessonWeek: 2, circleLines: [], newComments: 0, unread: 0, practiceSetThisWeek: true };

test('reports last week as kept of checked-in, with no streak or score', () => {
  const d = buildDigest(base);
  assert.equal(d.title, 'Your week, Tunde');
  assert.match(d.lines[0], /kept your practice 3 of 5 days/);
  assert.doesNotMatch(d.lines.join(' '), /streak|rank|score|%|behind/i);
});

test('a week with no check-ins is kind, not scolding', () => {
  const d = buildDigest({ ...base, lastWeek: { kept: 0, checkedIn: 0 } });
  assert.match(d.lines[0], /fresh start/);
});

test('nudges to set the plan only when it is not set', () => {
  assert.equal(buildDigest(base).lines.some((l) => /plan yet/.test(l)), false);
  assert.equal(buildDigest({ ...base, practiceSetThisWeek: false }).lines.some((l) => /plan yet/.test(l)), true);
});

test('includes the lesson, up to three Circle lines, comments and unread', () => {
  const d = buildDigest({ ...base, circleLines: ['a', 'b', 'c', 'd'], newComments: 2, unread: 1 });
  assert.ok(d.lines.some((l) => l.includes('Small promises, kept') && l.includes('week 2 of 12')));
  assert.equal(d.lines.filter((l) => ['a', 'b', 'c', 'd'].includes(l)).length, 3);
  assert.ok(d.lines.includes('2 new comments on your posts this week.'));
  assert.ok(d.lines.includes('1 notification waiting for you.'));
});

test('a brand new member with nothing yet still gets a readable note', () => {
  const d = buildDigest({ ...base, lastWeek: null, lessonTitle: null, lessonWeek: null, practiceSetThisWeek: false });
  assert.ok(d.body.length > 0);
});

test('the digest moment is Monday 8 o\'clock in the member\'s own time zone', () => {
  // Monday 2026-10-12 07:10 UTC is 08:10 in Lagos (UTC+1) and 03:10 in New York (UTC-4, daylight time).
  const t = new Date('2026-10-12T07:10:00Z');
  assert.equal(isDigestMoment('Africa/Lagos', t), true);
  assert.equal(isDigestMoment('America/New_York', t), false);
  assert.equal(isDigestMoment('Africa/Lagos', new Date('2026-10-13T07:10:00Z')), false); // Tuesday
  assert.equal(isDigestMoment('Not/AZone', t), false);
});

test('the morning nudge is the local 8 o\'clock hour', () => {
  assert.equal(isMorningNudge('Africa/Lagos', new Date('2026-10-12T07:30:00Z')), true);
  assert.equal(isMorningNudge('Africa/Lagos', new Date('2026-10-12T09:30:00Z')), false);
});

test('the evening nudge is the local 7 in the evening, and the hours are independent per time zone', async () => {
  const { isEveningNudge, isLocalHour } = await import('../../lib/rx/digest');
  assert.equal(isEveningNudge('Africa/Lagos', new Date('2026-10-12T18:20:00Z')), true);   // 19:20 in Lagos
  assert.equal(isEveningNudge('Africa/Lagos', new Date('2026-10-12T07:20:00Z')), false);
  assert.equal(isLocalHour('Asia/Kolkata', 8, new Date('2026-10-12T02:45:00Z')), true);   // 08:15 in India (UTC+5:30)
});
