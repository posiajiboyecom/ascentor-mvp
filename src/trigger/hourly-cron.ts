// Calls the app's hourly job every hour. Vercel's plan only allows daily cron jobs, so without this /api/cron/hourly would
// run once a day. That job sends morning practice nudges and the Monday summary in each member's own time zone, finishes long
// broadcasts, settles Circles that have been forming for 48 hours, and sends mentor agendas 48 hours before each session.
// Needs CRON_SECRET in this project's Trigger.dev environment variables (the same value as in Vercel).
import { schedules } from '@trigger.dev/sdk/v3';

const SITE = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://joinascentor.com').replace(/\/$/, '');

export const hourlyCron = schedules.task({
  id: 'hourly-cron',
  cron: '7 * * * *', // a few minutes past each hour
  maxDuration: 120,
  run: async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error('CRON_SECRET is not set in Trigger.dev environment variables.');
    const res = await fetch(`${SITE}/api/cron/hourly`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(90_000) });
    const body = await res.text();
    if (!res.ok && res.status !== 207) throw new Error(`hourly cron returned ${res.status}: ${body.slice(0, 300)}`);
    return { status: res.status, body: body.slice(0, 2000) };
  },
});
