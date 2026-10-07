// lib/rx/dates.ts
// Date helpers for the reimagined app. A member's "today" and "this week" follow their own time zone.

export const DEFAULT_TZ = 'Africa/Lagos';

function validTz(tz?: string | null): string {
  if (!tz) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

/** YYYY-MM-DD for `d` in the given time zone. */
export function localISODate(tz?: string | null, d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: validTz(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / 86400000);
}

/** Monday of the week containing `iso`. */
export function mondayOfISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

/** 1..12 once the cycle has started, otherwise null. Capped at 12. */
export function cycleWeek(cycleStart: string | null | undefined, today: string): number | null {
  if (!cycleStart) return null;
  const w = Math.floor(diffDays(today, cycleStart) / 7) + 1;
  if (w < 1) return 1;
  return Math.min(12, w);
}

export function longDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Thu 15 Oct, 7:00 PM" in the viewer's zone. */
export function whenLabel(ts: string | Date, tz?: string | null): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const z = validTz(tz);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: z });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: z });
  return `${day}, ${time}`;
}

export function relTime(ts: string | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'Now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 172800) return 'Yesterday';
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} days`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Next occurrence (UTC instant) of weekday `dow` (0 Sun..6 Sat) at HH:MM in time zone `tz`, strictly after `from`. */
export function nextWeekdayAt(dow: number, hhmm: string, tz?: string | null, from: Date = new Date()): Date {
  const z = validTz(tz);
  const today = localISODate(z, from);
  const todayDow = new Date(today + 'T00:00:00Z').getUTCDay();
  for (let add = 0; add <= 7; add++) {
    if ((todayDow + add) % 7 !== dow) continue;
    const iso = addDays(today, add);
    const inst = zonedTimeToUtc(iso, hhmm, z);
    if (inst.getTime() > from.getTime()) return inst;
  }
  return zonedTimeToUtc(addDays(today, 7), hhmm, z);
}

/** Converts a wall-clock time in `tz` to a UTC instant. */
export function zonedTimeToUtc(iso: string, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const guess = new Date(`${iso}T${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(guess).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

/** Short offset label such as "GMT+1". */
export function tzOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const v = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return v === 'GMT' ? 'GMT+0' : v;
  } catch { return ''; }
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarTone(seed: string | null | undefined): string {
  let h = 0;
  for (const c of seed ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `rx-av${h % 8}`;
}
