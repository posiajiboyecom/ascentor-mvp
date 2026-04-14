import {
  sendPushToUser
} from "../../../../chunk-B2ELQ2YB.mjs";
import "../../../../chunk-7KMAXNMD.mjs";
import "../../../../chunk-Q3S2BM77.mjs";
import {
  Anthropic
} from "../../../../chunk-V4ZTZ3EU.mjs";
import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  schedules_exports,
  task
} from "../../../../chunk-ZHF6YW46.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/guardsmann-job-alert.ts
init_esm();
var claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function getPosiUserId() {
  try {
    const { data } = await supabase.from("profiles").select("id").eq("role", "admin").limit(1).single();
    return data?.id || null;
  } catch {
    return null;
  }
}
__name(getPosiUserId, "getPosiUserId");
async function searchFreshJobs() {
  const today = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const hour = (/* @__PURE__ */ new Date()).getUTCHours();
  const runId = hour < 8 ? "morning" : hour < 14 ? "midday" : "evening";
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
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: prompt }]
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
    const jobs = (parsed.jobs || []).filter((j) => (j.hoursOld ?? 99) <= 6);
    const roles = [...new Set(jobs.map((j) => j.title))];
    return { count: jobs.length, jobs, roles };
  } catch {
    return { count: 0, jobs: [], roles: [] };
  }
}
__name(searchFreshJobs, "searchFreshJobs");
async function runJobAlert() {
  console.log("[guardsmann-alert] Scanning for fresh GRC jobs…");
  const userId = await getPosiUserId();
  if (!userId) {
    console.error("[guardsmann-alert] Admin user not found");
    return { pushed: false };
  }
  const { count, jobs, roles } = await searchFreshJobs();
  console.log(`[guardsmann-alert] Found ${count} fresh jobs`);
  if (count === 0) {
    console.log("[guardsmann-alert] Nothing fresh — no push sent");
    return { pushed: false, count: 0 };
  }
  const topJob = jobs[0];
  const title = count === 1 ? `⚡ ${topJob.title} at ${topJob.company}` : `⚡ ${count} fresh GRC jobs — last 6 hours`;
  const body = count === 1 ? `${topJob.salary ? topJob.salary + " · " : ""}Posted ${topJob.postedAt} — apply now` : roles.slice(0, 3).join(" · ") + " — apply before the queue fills";
  const sent = await sendPushToUser(supabase, userId, {
    title,
    body,
    url: topJob?.url || "/guardsmann/jobs",
    icon: "/icon/icon-192.png",
    tag: "guardsmann-jobs"
  });
  try {
    await supabase.from("guardsmann_alert_log").insert({
      run_at: (/* @__PURE__ */ new Date()).toISOString(),
      jobs_found: count,
      pushed: sent,
      top_job: topJob || null,
      roles_found: roles
    });
  } catch {
  }
  console.log(`[guardsmann-alert] Push sent: ${sent} — ${count} jobs`);
  return { pushed: sent, count, roles, topJob };
}
__name(runJobAlert, "runJobAlert");
var guardsmannJobAlertScheduled = schedules_exports.task({
  id: "guardsmann-job-alert",
  cron: "0 6,12,17 * * *",
  maxDuration: 90,
  run: runJobAlert
});
var guardsmannJobAlertManual = task({
  id: "guardsmann-job-alert-manual",
  maxDuration: 90,
  run: runJobAlert
});
export {
  guardsmannJobAlertManual,
  guardsmannJobAlertScheduled
};
//# sourceMappingURL=guardsmann-job-alert.mjs.map
