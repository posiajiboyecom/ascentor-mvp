import test from 'node:test';
import assert from 'node:assert/strict';
import { circleState, daysLeft } from '../../lib/rx/circle-state';

const base = { members: 5, started: false, round: null, mentorPhase: null } as const;
const now = new Date('2026-10-12T10:00:00Z');

test('before 6 members, it says how many more are needed', () => {
  const s = circleState({ ...base });
  assert.equal(s.headline, '5 of 8 joined, meetings start at 6');
  assert.match(s.detail ?? '', /1 more member to go/);
  assert.equal(s.steps[0].status, 'current');
});

test('a full-enough Circle with no vote is ready for a mentor vote', () => {
  const s = circleState({ ...base, members: 6, started: true, nextCallLabel: 'Thu 7:00 PM' });
  assert.equal(s.headline, 'Ready to choose a mentor');
  assert.equal(s.action?.label, 'Start the vote');
  assert.match(s.detail ?? '', /Next call Thu 7:00 PM/);
  assert.equal(s.steps.find((x) => x.key === 'vote')?.status, 'current');
});

test('an open vote shows days left and whether you voted', () => {
  const closes = new Date(now.getTime() + 4 * 86400000).toISOString();
  const s = circleState({ ...base, members: 6, started: true, round: 'open', roundClosesAt: closes, votesCast: 3, iVoted: false, now });
  assert.equal(s.headline, 'Vote open, closes in 4 days');
  assert.match(s.detail ?? '', /3 of 6 have voted\. Your vote is still needed/);
  assert.equal(s.action?.label, 'Vote now');
  const mine = circleState({ ...base, members: 6, started: true, round: 'open', roundClosesAt: closes, votesCast: 4, iVoted: true, now });
  assert.equal(mine.action?.label, 'See the vote');
});

test('a tie waits for the facilitator', () => {
  assert.equal(circleState({ ...base, members: 7, started: true, round: 'tie' }).headline, 'The vote is tied');
});

test('mentor phases read in order', () => {
  const m = { ...base, members: 8, started: true, mentorName: 'Adaeze' };
  assert.equal(circleState({ ...m, mentorPhase: 'requested' }).headline, 'Waiting for Adaeze to say yes');
  assert.match(circleState({ ...m, mentorPhase: 'scheduling' }).headline, /Adaeze said yes/);
  const live = circleState({ ...m, mentorPhase: 'active', nextSessionLabel: 'Thu 15 Oct, 7:00 PM' });
  assert.equal(live.headline, 'Your mentor is Adaeze');
  assert.match(live.detail ?? '', /Next session Thu 15 Oct, 7:00 PM/);
  assert.equal(live.steps.find((x) => x.key === 'times')?.status, 'done');
});

test('days left never goes negative', () => {
  assert.equal(daysLeft('2026-10-01T00:00:00Z', now), 0);
  assert.equal(daysLeft(null, now), null);
});
