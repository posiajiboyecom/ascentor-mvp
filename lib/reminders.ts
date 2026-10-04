// lib/reminders.ts
// Scheduled member reminders, shared by the cron endpoint
// (/api/cron/reminders) and the secret-protected push routes.
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { notify, NotifyTemplates } from '@/lib/notify';

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Today's calendar date in Lagos as YYYY-MM-DD (due_date is a date column). */
function todayInLagos(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Reminds members of commitments due today that are not yet done. */
export async function sendCommitmentReminders(): Promise<number> {
  const { data: commitments } = await service
    .from('user_commitments')
    .select('user_id, commitment_text')
    .eq('completed', false)
    .eq('due_date', todayInLagos());

  if (!commitments?.length) return 0;
  await Promise.allSettled(
    commitments.map((c) => notify(c.user_id, NotifyTemplates.sageCommitmentDue(c.commitment_text))),
  );
  return commitments.length;
}

/** Reminds the attendees of one expert session. */
export async function sendSessionReminder(sessionId: string): Promise<number | null> {
  const { data: session } = await service
    .from('expert_sessions')
    .select('title, expert_name, session_date')
    .eq('id', sessionId)
    .single();
  if (!session) return null;

  const { data: registrations } = await service
    .from('session_registrations')
    .select('user_id')
    .eq('session_id', sessionId);
  if (!registrations?.length) return 0;

  const hoursAway = Math.max(1, Math.round((new Date(session.session_date).getTime() - Date.now()) / 3_600_000));
  const payload = NotifyTemplates.expertSessionReminder(session.title, session.expert_name, '/experts', hoursAway);
  await Promise.allSettled(registrations.map((r) => notify(r.user_id, payload)));
  return registrations.length;
}

/**
 * Reminds attendees of every published session starting in the next 24 hours.
 * Run once a day: consecutive 24h windows tile, so each session is announced once.
 */
export async function sendUpcomingSessionReminders(): Promise<{ sessions: number; notified: number }> {
  const now = new Date();
  const { data: sessions } = await service
    .from('expert_sessions')
    .select('id')
    .eq('is_published', true)
    .gte('session_date', now.toISOString())
    .lt('session_date', new Date(now.getTime() + 24 * 3_600_000).toISOString());

  let notified = 0;
  for (const s of sessions ?? []) {
    notified += (await sendSessionReminder(s.id)) ?? 0;
  }
  return { sessions: sessions?.length ?? 0, notified };
}
