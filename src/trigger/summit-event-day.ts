// Summit morning (19 Nov 2026, 07:00 WAT): sends the "it's today" email to every registrant. Each call to the app's
// /api/cron/summit-event-day sends for about 48 seconds at a steady pace and says how many are still waiting, so this task
// keeps calling until everyone has it. Safe to repeat: the app records who has been sent it. Needs CRON_SECRET (same as Vercel).
import { schedules } from '@trigger.dev/sdk/v3';

const SITE = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://joinascentor.com').replace(/\/$/, '');

export const summitEventDay = schedules.task({
  id: 'summit-event-day',
  cron: '0 6 19 11 *', // 06:00 UTC = 07:00 WAT on 19 November
  maxDuration: 3600,
  run: async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('CRON_SECRET is not set in Trigger.dev environment variables.');
    const runs: { remaining: number; sent: number; failed: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`${SITE}/api/cron/summit-event-day`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(75_000) });
      const body = (await res.json().catch(() => ({}))) as { ran?: boolean; remaining?: number; sentVirtual?: number; sentPhysical?: number; failed?: number; error?: string };
      if (!res.ok) throw new Error(`summit-event-day returned ${res.status}: ${body.error ?? ''}`);
      runs.push({ remaining: body.remaining ?? 0, sent: (body.sentVirtual ?? 0) + (body.sentPhysical ?? 0), failed: body.failed ?? 0 });
      if (!body.ran || !body.remaining) break;
    }
    return { calls: runs.length, sent: runs.reduce((s, r) => s + r.sent, 0), failed: runs.reduce((s, r) => s + r.failed, 0), remaining: runs.at(-1)?.remaining ?? 0 };
  },
});
