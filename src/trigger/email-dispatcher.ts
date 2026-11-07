// Email system dispatcher. Sends queued campaign messages from the Hostinger mailbox at the pace and daily cap set in
// Admin → Email → Settings. Runs every 5 minutes, and once more right away whenever a campaign is started.
// Deploy with `npm run trigger:deploy`. Without it, sending still happens from the daily cron and from the admin
// Email screen while it is open, just more slowly.
import { schedules, task } from '@trigger.dev/sdk/v3';
import { dispatch } from '@/lib/email/system';

const BUDGET_MS = 4 * 60_000; // inside the 5-minute task limit, so runs don't overlap

export const emailDispatcher = schedules.task({
  id: 'email-dispatcher',
  cron: '*/5 * * * *',
  maxDuration: 290,
  run: async () => dispatch({ budgetMs: BUDGET_MS, owner: 'trigger-scheduled' }),
});

export const emailDispatcherNow = task({
  id: 'email-dispatcher-now',
  maxDuration: 290,
  retry: { maxAttempts: 1 },
  run: async () => dispatch({ budgetMs: BUDGET_MS, owner: 'trigger-now' }),
});
