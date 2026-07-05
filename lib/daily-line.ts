// lib/daily-line.ts
// One line for the top of Today's Page. Deterministic by day-of-year
// so every user sees the same line on the same day (shared ritual),
// and it doesn't change on refresh.
//
// Lines are original Ascentor charges written for the six dimensions,
// plus short public-domain scripture (WEB translation). Do NOT add
// copyrighted quotes from books here — write in the spirit of the
// mentor council instead, or attribute ideas without quoting.

export interface DailyLine {
  text: string;
  dimension:
    | 'Mind'
    | 'Character'
    | 'Work'
    | 'Relationships'
    | 'Community'
    | 'Legacy'
    | 'Purpose';
  attribution?: string; // shown small, only for scripture
}

const LINES: DailyLine[] = [
  { text: 'Purpose is not found; it is uncovered by the work you refuse to skip.', dimension: 'Purpose' },
  { text: 'A man\u2019s gift makes room for him, and brings him before great men.', dimension: 'Work', attribution: 'Proverbs 18:16' },
  { text: 'Character is what you repair in private so it holds in public.', dimension: 'Character' },
  { text: 'Guard your mind like a gate: everything you build passes through it.', dimension: 'Mind' },
  { text: 'The people you keep are the future you choose.', dimension: 'Relationships' },
  { text: 'Legacy is decided in decades and built in mornings.', dimension: 'Legacy' },
  { text: 'Where there is no vision, the people perish.', dimension: 'Purpose', attribution: 'Proverbs 29:18' },
  { text: 'Do the next faithful thing. Then do it again tomorrow.', dimension: 'Character' },
  { text: 'Your work is a sermon someone will hear before they hear your words.', dimension: 'Work' },
  { text: 'A community is a covenant kept by ordinary people on ordinary days.', dimension: 'Community' },
  { text: 'Iron sharpens iron; so a man sharpens his friend\u2019s countenance.', dimension: 'Relationships', attribution: 'Proverbs 27:17' },
  { text: 'The mind you feed today is the counsel you receive tomorrow.', dimension: 'Mind' },
  { text: 'Small promises, kept relentlessly, become a reputation.', dimension: 'Character' },
  { text: 'Build what outlasts applause.', dimension: 'Legacy' },
  { text: 'Whatever your hand finds to do, do it with your might.', dimension: 'Work', attribution: 'Ecclesiastes 9:10' },
  { text: 'You cannot lead people you have not learned to love.', dimension: 'Community' },
  { text: 'Clarity is a discipline before it is a gift.', dimension: 'Mind' },
  { text: 'The plans of the diligent surely lead to profit.', dimension: 'Work', attribution: 'Proverbs 21:5' },
  { text: 'A life of purpose is a long obedience in the same direction.', dimension: 'Purpose' },
  { text: 'What you tolerate in yourself, you will one day teach.', dimension: 'Character' },
  { text: 'Legacy asks one question daily: who is better because you showed up?', dimension: 'Legacy' },
];

export function getDailyLine(date: Date = new Date()): DailyLine {
  // Day-of-year in Africa/Lagos so the line turns over at local midnight.
  const lagos = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // YYYY-MM-DD
  const [y, m, d] = lagos.split('-').map(Number);
  const start = Date.UTC(y, 0, 1);
  const today = Date.UTC(y, m - 1, d);
  const dayOfYear = Math.floor((today - start) / 86_400_000);
  return LINES[dayOfYear % LINES.length];
}

export function getLagosDateParts(date: Date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    weekday: String(parts.weekday || ''),
    day: String(parts.day || ''),
    month: String(parts.month || ''),
    year: String(parts.year || ''),
  };
}
