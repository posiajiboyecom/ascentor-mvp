// lib/rx/circle-state.ts
// Says in plain words where a Circle stands, and what a member can do next. Pure, so it is tested without a database.

import { CIRCLE_MAX, CIRCLE_MIN_TO_START } from './constants';

export type MentorPhase = 'requested' | 'scheduling' | 'active' | 'paused' | null;
export type RoundPhase = 'open' | 'tie' | null;

export interface CircleStateInput {
  members: number;
  started: boolean;                 // the 90-day cycle has begun
  round: RoundPhase;
  roundClosesAt?: string | null;
  votesCast?: number;
  iVoted?: boolean;
  mentorPhase: MentorPhase;
  mentorName?: string | null;
  nextSessionLabel?: string | null; // for example "Thu 15 Oct, 7:00 PM"
  nextCallLabel?: string | null;
  /** False until the member has taken the confidentiality pledge (the chat opens after it). Defaults to true. */
  pledged?: boolean;
  now?: Date;
}

export type StepKey = 'fill' | 'start' | 'vote' | 'mentor' | 'times' | 'sessions';
export interface Step { key: StepKey; label: string; status: 'done' | 'current' | 'upcoming' }

export interface CircleState {
  headline: string;
  detail: string | null;
  /** Where to send a member who wants to act on it. */
  action: { label: string; to: 'circle' | 'sessions' } | null;
  steps: Step[];
}

export function daysLeft(closesAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!closesAt) return null;
  const ms = new Date(closesAt).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function circleState(i: CircleStateInput): CircleState {
  const ready = i.members >= CIRCLE_MIN_TO_START && i.started;
  const mentorLive = i.mentorPhase === 'active' || i.mentorPhase === 'paused';
  const afterMentorAsk = i.mentorPhase !== null;

  const status = (done: boolean, current: boolean): Step['status'] => (done ? 'done' : current ? 'current' : 'upcoming');
  const steps: Step[] = [
    { key: 'fill', label: `Circle fills to ${CIRCLE_MIN_TO_START} members`, status: status(ready, !ready) },
    { key: 'start', label: 'Weekly calls and the 90-day cycle begin', status: status(ready, false) },
    { key: 'vote', label: 'Choose a mentor together', status: status(afterMentorAsk, ready && !afterMentorAsk) },
    { key: 'mentor', label: 'Your mentor says yes', status: status(i.mentorPhase === 'scheduling' || mentorLive, i.mentorPhase === 'requested') },
    { key: 'times', label: 'Pick session times', status: status(mentorLive, i.mentorPhase === 'scheduling') },
    { key: 'sessions', label: 'Mentor sessions every two weeks', status: status(false, mentorLive) },
  ];
  // The call line only reads once the Circle has started.
  const call = ready && i.nextCallLabel ? `Next call ${i.nextCallLabel}.` : null;

  if (!ready) {
    const left = CIRCLE_MIN_TO_START - i.members;
    return {
      headline: `${i.members} of ${CIRCLE_MAX} joined, meetings start at ${CIRCLE_MIN_TO_START}`,
      detail: left > 0
        ? `${plural(left, 'more member', 'more members')} to go. ${i.pledged === false ? 'Take the Circle pledge to open the chat and say hello while you wait.' : 'Say hello in the chat while you wait.'}`
        : 'Meetings are about to begin.',
      action: { label: i.pledged === false ? 'Take the pledge' : 'Open the chat', to: 'circle' }, steps,
    };
  }
  if (i.round === 'open') {
    const d = daysLeft(i.roundClosesAt, i.now);
    return {
      headline: d === null ? 'Vote open' : d === 0 ? 'Vote open, closes today' : `Vote open, closes in ${plural(d, 'day', 'days')}`,
      detail: `${i.votesCast ?? 0} of ${i.members} have voted. ${i.iVoted ? 'Your vote is in.' : 'Your vote is still needed.'}${call ? ` ${call}` : ''}`,
      action: { label: i.iVoted ? 'See the vote' : 'Vote now', to: 'sessions' }, steps,
    };
  }
  if (i.round === 'tie') {
    return { headline: 'The vote is tied', detail: `Your facilitator makes the final choice within two days.${call ? ` ${call}` : ''}`, action: { label: 'See the vote', to: 'sessions' }, steps };
  }
  if (i.mentorPhase === 'requested') {
    return { headline: `Waiting for ${i.mentorName ?? 'your mentor'} to say yes`, detail: `Most mentors reply within two days.${call ? ` ${call}` : ''}`, action: { label: 'See details', to: 'sessions' }, steps };
  }
  if (i.mentorPhase === 'scheduling') {
    return { headline: `${i.mentorName ?? 'Your mentor'} said yes. Pick times that suit you`, detail: `Mark the times you can attend. A time works when 6 or more can come.${call ? ` ${call}` : ''}`, action: { label: 'Pick times', to: 'sessions' }, steps };
  }
  if (mentorLive) {
    return {
      headline: `Your mentor is ${i.mentorName ?? 'chosen'}`,
      detail: i.mentorPhase === 'paused' ? 'Sessions are paused.' : `${i.nextSessionLabel ? `Next session ${i.nextSessionLabel}.` : 'Your next session is being booked.'}${call ? ` ${call}` : ''}`,
      action: { label: 'Open sessions', to: 'sessions' }, steps,
    };
  }
  return { headline: 'Ready to choose a mentor', detail: `Your Circle is full enough to begin. We recommend up to three mentors and you vote together.${call ? ` ${call}` : ''}`, action: { label: 'Start the vote', to: 'sessions' }, steps };
}
