// lib/rx/constants.ts
// Shared taxonomy and copy for the reimagined member app. Imported by both server and client code.

export type Dimension = 'Mind' | 'Character' | 'Vocation' | 'Relationships' | 'Community' | 'Legacy';
export const DIMENSIONS: Dimension[] = ['Mind', 'Character', 'Vocation', 'Relationships', 'Community', 'Legacy'];

/** Interests, grouped as onboarding shows them. Finance is part of Vocation. */
export const INTEREST_GROUPS: { dim: string; desc: string; items: string[] }[] = [
  { dim: 'Mind',          desc: 'How you think, focus and recover.',                 items: ['Focus', 'Learning how to learn', 'Resilience', 'Critical thinking'] },
  { dim: 'Character',     desc: 'Who you are when no one is watching.',              items: ['Discipline', 'Integrity', 'Courage', 'Humility'] },
  { dim: 'Vocation',      desc: 'The work you are building.',                        items: ['AI engineering', 'Cybersecurity', 'Entrepreneurship', 'Design', 'Writing'] },
  { dim: 'Finance',       desc: 'Part of Vocation: money for you and your work.',    items: ['Personal finance', 'Budgeting and saving', 'Small business finance', 'Business growth'] },
  { dim: 'Relationships', desc: 'The people closest to you.',                        items: ['Communication', 'Family', 'Friendship', 'Conflict'] },
  { dim: 'Community',     desc: 'How you show up for others.',                       items: ['Volunteering', 'Civic life', 'Teamwork'] },
  { dim: 'Legacy',        desc: 'What outlives you.',                                items: ['Mentoring others', 'Giving', 'Building something lasting'] },
];

/** Which dimension an interest (or "Finance") belongs to. */
export function dimensionOf(label: string): Dimension | null {
  if (label === 'Finance') return 'Vocation';
  if ((DIMENSIONS as string[]).includes(label)) return label as Dimension;
  for (const g of INTEREST_GROUPS) if (g.items.includes(label)) return (g.dim === 'Finance' ? 'Vocation' : g.dim) as Dimension;
  return null;
}

export const ALL_INTERESTS: string[] = INTEREST_GROUPS.flatMap((g) => g.items);

export const POST_TYPES = ['Question', 'Win', 'Reflection', 'Resource'] as const;
export type PostType = (typeof POST_TYPES)[number];

// ── onboarding ───────────────────────────────────────────────────────────────
export type ObStep =
  | 'welcome' | 'notify' | 'interests' | 'purpose' | 'goal' | 'serve'
  | 'slots' | 'timezone' | 'language' | 'survey' | 'stage' | 'forming';

export const OB_ORDER: ObStep[] = ['welcome', 'notify', 'interests', 'purpose', 'goal', 'serve', 'slots', 'timezone', 'language', 'survey', 'stage', 'forming'];

/** Which of the six progress segments a step belongs to. */
export const OB_SEG: Partial<Record<ObStep, number>> = {
  notify: 0, interests: 1, purpose: 2, goal: 3, serve: 3, slots: 4, timezone: 4, language: 4, survey: 5,
};

export const OB_SAGE: Partial<Record<ObStep, string>> = {
  notify: 'I’ll only nudge you when it helps.',
  interests: 'Pick what you want to grow.',
  purpose: 'No wrong answers here.',
  goal: 'Think 90 days, not forever.',
  serve: 'Goals that serve someone stick.',
  slots: 'This helps us find your Circle a time.',
  timezone: 'So every time you see is yours.',
  language: 'Pick what feels natural.',
  survey: 'Your first instinct is fine.',
};

export const OB_NEXT = ['Reminders', 'Interests', 'Where you are', 'Goals', 'Times and language', 'Baseline'];

export const REASSURE = {
  purpose: ['An honest place to start.', 'Plenty of people start here.', 'Some clarity is enough to begin.', 'Good. We’ll help you put it to work.', 'Then let’s turn it into practice.'],
  effort:  ['Small is fine. Practices stay short.', 'A little each week adds up.', 'A steady middle. That works.', 'Good. We’ll still start small.', 'Great. We’ll pace you so it lasts.'],
};

export const SLOT_OPTIONS = ['Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays'];
export const LEAD_OPTIONS = ['No', '1 to 2', '3 to 10', 'More than 10'];
export const PROJ_OPTIONS = ['No', 'Under 6 months', '6 to 12 months', 'Over a year'];
export const LANGUAGES = ['English', 'Nigerian Pidgin', 'Yoruba', 'Igbo', 'Hausa'];
export const WHO_SUGGEST = ['My family', 'My future team', 'My community', 'People starting out'];

export const SURVEY_QUESTIONS = [
  'I feel the things I do each day are worthwhile.',
  'I know what I want my life to stand for.',
  'When I see a problem, I act without being asked.',
  'I have people who help me grow.',
];
export const AGREE = ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'];

export type Stage = 'Seeking' | 'Building' | 'Leading';

/** Starting point, derived from onboarding answers. The member never picks it. */
export function deriveStage(p: { purpose?: number | null; lead?: string | null; project?: string | null }): Stage {
  const leads = !!p.lead && p.lead !== 'No';
  const runs = p.project === '6 to 12 months' || p.project === 'Over a year';
  if (leads || runs) return 'Leading';
  if ((p.purpose ?? 0) >= 3) return 'Building';
  return 'Seeking';
}

export const STAGE_COPY: Record<Stage, string> = {
  Seeking:  'You’re looking for direction, and that is a real place to start. The next twelve weeks turn curiosity into small practices you keep.',
  Building: 'You already have a direction. The next twelve weeks turn it into habits you keep.',
  Leading:  'You already carry others with you. The next twelve weeks make your own practice as steady as your example.',
};

// ── Sage ─────────────────────────────────────────────────────────────────────
export const SAGE_TOPICS: { key: string; label: string }[] = [
  { key: 'plan',    label: 'Plan my week' },
  { key: 'lesson',  label: 'Lesson to practice' },
  { key: 'missed',  label: 'Missed day' },
  { key: 'reframe', label: 'Hard day' },
  { key: 'report',  label: 'Circle report' },
  { key: 'silent',  label: '5 quiet days' },
  { key: 'crisis',  label: 'Hard topics' },
];

export const CRISIS_PATTERN =
  /\b(kill myself|end my life|suicid|don'?t want to (live|be here)|no point (in|to) (any|living|life)|hurt myself|self[- ]harm|want to die|better off dead|can'?t go on|don'?t see the point of any of this)\b/i;

// ── circles ──────────────────────────────────────────────────────────────────
export const CIRCLE_MIN_TO_START = 6;
export const CIRCLE_MAX = 8;
export const CYCLE_WEEKS = 12;
export const MEETING_AGENDA: [string, string][] = [
  ['Arrive and check in', '5 min'],
  ['Wins and misses', '20 min'],
  ['Focus topic', '20 min'],
  ['Next if-thens, in pairs', '10 min'],
  ['Close', '5 min'],
];

/** Focus topic of each cycle week. */
export const CIRCLE_FOCUS: string[] = [
  'Why we’re here: sharing our goals',
  'Choosing what to practise',
  'Small promises, kept',
  'When the plan meets a hard week',
  'Keeping promises when work is heavy',
  'Asking for help well',
  'Halfway: what is working',
  'People who help us grow',
  'Serving someone beyond ourselves',
  'Staying steady when it gets quiet',
  'What we will carry forward',
  'Review and a new cycle',
];

// ── announcements ────────────────────────────────────────────────────────────
export const AUDIENCES = ['All members', 'By stage', 'By city', 'By Circle', 'By language'] as const;
export const AUDIENCE_HINT: Record<string, string> = {
  'By stage': 'For example: Building',
  'By city': 'For example: Lagos',
  'By Circle': 'For example: Circle 14',
  'By language': 'For example: Yoruba',
};

// ── mentorship ───────────────────────────────────────────────────────────────
export const MENTOR_FREQUENCY = ['Weekly', 'Every two weeks', 'Monthly'];
export const MENTOR_FORMAT = ['Video', 'Voice', 'In person'];
export const MENTOR_TIMES = ['Weekday evenings', 'Saturday mornings'];

// ── settings ─────────────────────────────────────────────────────────────────
export const NOTIF_TYPES = ['Practice reminders', 'Circle meetings', 'Messages', 'Mentor sessions', 'Community prompts'];
export const DM_POLICIES: { value: string; label: string }[] = [
  { value: 'circle_and_requests', label: 'My Circle, and requests from others' },
  { value: 'circle_and_mentor',   label: 'My Circle and mentor only' },
  { value: 'none',                label: 'No one new' },
];
