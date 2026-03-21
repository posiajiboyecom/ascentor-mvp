// ═══════════════════════════════════════════════════════════════════════════
// Guardsmann Job Alert — Scheduled Task
//
// Runs 3× daily: 07:00, 13:00, 18:00 WAT (06:00, 12:00, 17:00 UTC)
// Morning, lunch, end-of-day — catches jobs posted across all time zones.
//
// What it does:
//   1. Searches for fresh GRC jobs (last 6 hours only — between runs)
//   2. If fresh jobs found → sends push notification to Posi's phone
//   3. Saves run log to Supabase for dashboard stats
// ═══════════════════════════════════════════════════════════════════════════

import { schedules, task } from '@trigger.dev/sdk/v3';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/push';

const claude   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPosiUserId(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('profiles').select('id').eq('role', 'admin').limit(1).single();
    return data?.id || null;
  } catch { return null; }
}

async function searchFreshJobs(): Promise<{ count: number; jobs: any[]; roles: string[] }> {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const hour  = new Date().getUTCHours();
  const runId = hour < 8 ? 'morning' : hour < 14 ? 'midday' : 'evening';

  const prompt = `Today is ${today}. This is a ${runId} GRC job alert scan for a professional in Nigeria.

Search for GRC/compliance/risk jobs posted in the LAST 6 HOURS ONLY:
- site:linkedin.com/jobs — "GRC Analyst" OR "Compliance Analyst" OR "Risk Analyst" remote "hours ago" entry level
- site:greenhouse.io — GRC compliance risk posted today
- site:lever.co — compliance risk analyst posted today

STRICT: Only jobs showing "X hours ago" where X is 6 or fewer. Skip anything older.
Include both: global remote roles AND multinational companies in Nigeria/Africa.

Return JSON:
{"found":number,"jobs":[{"title":"string","company":"string","salary":"string|null","url":"string|null","postedAt":"string","hoursOld":number}]}
If nothing found: {"found":0,"jobs":[]}`;

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1200,
    tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    const jobs   = (parsed.jobs || []).filter((j: any) => (j.hoursOld ?? 99) <= 6);
    const roles  = [...new Set(jobs.map((j: any) => j.title as string))] as string[];
    return { count: jobs.length, jobs, roles };
  } catch {
    return { count: 0, jobs: [], roles: [] };
  }
}

async function runJobAlert() {
  console.log('[guardsmann-alert] Scanning for fresh GRC jobs…');

  const userId = await getPosiUserId();
  if (!userId) { console.error('[guardsmann-alert] Admin user not found'); return { pushed: false }; }

  const { count, jobs, roles } = await searchFreshJobs();
  console.log(`[guardsmann-alert] Found ${count} fresh jobs`);

  if (count === 0) {
    console.log('[guardsmann-alert] Nothing fresh — no push sent');
    return { pushed: false, count: 0 };
  }

  const topJob = jobs[0];
  const title  = count === 1
    ? `⚡ ${topJob.title} at ${topJob.company}`
    : `⚡ ${count} fresh GRC jobs — last 6 hours`;
  const body   = count === 1
    ? `${topJob.salary ? topJob.salary + ' · ' : ''}Posted ${topJob.postedAt} — apply now`
    : roles.slice(0, 3).join(' · ') + ' — apply before the queue fills';

  const sent = await sendPushToUser(supabase, userId, {
    title, body,
    url:  topJob?.url || '/guardsmann/jobs',
    icon: '/icon/icon-192.png',
    tag:  'guardsmann-jobs',
  });

  // Log run
  try {
    await supabase.from('guardsmann_alert_log').insert({
      run_at: new Date().toISOString(), jobs_found: count,
      pushed: sent, top_job: topJob || null, roles_found: roles,
    });
  } catch { /* table may not exist yet — non-fatal */ }

  console.log(`[guardsmann-alert] Push sent: ${sent} — ${count} jobs`);
  return { pushed: sent, count, roles, topJob };
}

// 3× daily: 06:00, 12:00, 17:00 UTC (07:00, 13:00, 18:00 WAT)
export const guardsmannJobAlertScheduled = schedules.task({
  id: 'guardsmann-job-alert', cron: '0 6,12,17 * * *', maxDuration: 90, run: runJobAlert,
});

// Manual trigger for testing
export const guardsmannJobAlertManual = task({
  id: 'guardsmann-job-alert-manual', maxDuration: 90, run: runJobAlert,
});
