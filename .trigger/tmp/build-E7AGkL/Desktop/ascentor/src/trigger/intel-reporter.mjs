import {
  Anthropic
} from "../../../../chunk-V4ZTZ3EU.mjs";
import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  schedules_exports
} from "../../../../chunk-ZHF6YW46.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/intel-reporter.ts
init_esm();
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
async function fetchPlatformData() {
  const now = /* @__PURE__ */ new Date();
  const d7 = new Date(now.getTime() - 7 * 864e5).toISOString();
  const d14 = new Date(now.getTime() - 14 * 864e5).toISOString();
  const d30 = new Date(now.getTime() - 30 * 864e5).toISOString();
  const d60 = new Date(now.getTime() - 60 * 864e5).toISOString();
  const [
    totalUsersRes,
    new7Res,
    new30Res,
    prev7Res,
    prev30Res,
    onboardedRes,
    waitlistRes,
    newsletterRes,
    paidRes,
    revenueAllRes,
    revenue7Res,
    revenue30Res,
    planRes,
    promoRes,
    sessions7Res,
    sessions30Res,
    uniqueCoach7Res,
    tokenRes,
    courseRes,
    progressRes,
    posts7Res,
    membersRes,
    expertReg7Res,
    profilesRes,
    leadRes,
    hotLeadRes,
    auditRes,
    deletionRes,
    mentorRes,
    contentRes,
    socialRes,
    referralRes,
    referralConvRes,
    cohortsRes,
    cohortMembersRes
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d14).lt("created_at", d7),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d60).lt("created_at", d30),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
    supabase.from("waitlist_entries").select("id", { count: "exact", head: true }),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).in("subscription_status", ["active", "trialing"]),
    supabase.from("payments").select("amount").eq("status", "success"),
    supabase.from("payments").select("amount").eq("status", "success").gte("created_at", d7),
    supabase.from("payments").select("amount").eq("status", "success").gte("created_at", d30),
    supabase.from("profiles").select("subscription_plan").in("subscription_status", ["active", "trialing"]),
    supabase.from("promo_codes").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("coaching_sessions").select("user_id").gte("created_at", d7),
    supabase.from("coaching_sessions").select("token_usage").not("token_usage", "is", null),
    supabase.from("user_progress").select("id", { count: "exact", head: true }).eq("completed", true).gte("updated_at", d7),
    supabase.from("user_progress").select("id", { count: "exact", head: true }),
    supabase.from("cohort_posts").select("id", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("cohort_members").select("id", { count: "exact", head: true }),
    supabase.from("session_registrations").select("id", { count: "exact", head: true }).gte("registered_at", d7),
    supabase.from("profiles").select("industry, biggest_challenge, goal_role, time_commitment").eq("onboarding_completed", true),
    supabase.from("profiles").select("lead_score").not("lead_score", "is", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("lead_score", 70).in("subscription_status", ["inactive", "cancelled"]),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("mentor_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("content_calendar").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("social_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("referrals").select("id", { count: "exact", head: true }),
    supabase.from("referrals").select("id", { count: "exact", head: true }).in("status", ["subscribed", "rewarded"]),
    supabase.from("cohorts").select("id, member_count"),
    supabase.from("cohort_members").select("id", { count: "exact", head: true })
  ]);
  const planBreakdown = {};
  (planRes.data || []).forEach((r) => {
    planBreakdown[r.subscription_plan] = (planBreakdown[r.subscription_plan] || 0) + 1;
  });
  const totalRevenue = (revenueAllRes.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const rev7 = (revenue7Res.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const rev30 = (revenue30Res.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const uniqueCoaches = new Set((uniqueCoach7Res.data || []).map((r) => r.user_id)).size;
  const totalTokens = (tokenRes.data || []).reduce((s, r) => s + (Number(r.token_usage) || 0), 0);
  const industryBd = {};
  const challengeBd = {};
  const goalRoleBd = {};
  const timeBd = {};
  (profilesRes.data || []).forEach((p) => {
    if (p.industry) industryBd[p.industry] = (industryBd[p.industry] || 0) + 1;
    if (p.biggest_challenge) challengeBd[p.biggest_challenge] = (challengeBd[p.biggest_challenge] || 0) + 1;
    if (p.goal_role) goalRoleBd[p.goal_role] = (goalRoleBd[p.goal_role] || 0) + 1;
    if (p.time_commitment) timeBd[p.time_commitment] = (timeBd[p.time_commitment] || 0) + 1;
  });
  const scores = (leadRes.data || []).map((r) => Number(r.lead_score));
  const avgLeadScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const cohortList = cohortsRes.data || [];
  const avgCohortSize = cohortList.length > 0 ? Math.round(cohortList.reduce((s, c) => s + (c.member_count || 0), 0) / cohortList.length) : 0;
  const totalUsers = totalUsersRes.count || 0;
  const onboarded = onboardedRes.count || 0;
  const paidCount = paidRes.count || 0;
  return {
    total_users: totalUsers,
    new_7d: new7Res.count || 0,
    new_30d: new30Res.count || 0,
    prev_7d: prev7Res.count || 0,
    prev_30d: prev30Res.count || 0,
    onboarded,
    onboard_rate: Math.round(onboarded / Math.max(totalUsers, 1) * 100),
    waitlist: waitlistRes.count || 0,
    newsletter_subs: newsletterRes.count || 0,
    paid_users: paidCount,
    free_users: totalUsers - paidCount,
    conversion_rate: Math.round(paidCount / Math.max(totalUsers, 1) * 100),
    total_revenue: totalRevenue,
    revenue_7d: rev7,
    revenue_30d: rev30,
    plan_breakdown: planBreakdown,
    active_promos: promoRes.count || 0,
    coaching_sessions_7d: sessions7Res.count || 0,
    coaching_sessions_30d: sessions30Res.count || 0,
    unique_coaches_7d: uniqueCoaches,
    avg_sessions_per_user: uniqueCoaches > 0 ? Math.round((sessions7Res.count || 0) / uniqueCoaches * 10) / 10 : 0,
    total_coaching_tokens: totalTokens,
    course_completions_7d: courseRes.count || 0,
    total_progress_records: progressRes.count || 0,
    community_posts_7d: posts7Res.count || 0,
    community_members: membersRes.count || 0,
    expert_registrations_7d: expertReg7Res.count || 0,
    industry_breakdown: industryBd,
    challenge_breakdown: challengeBd,
    goal_role_breakdown: goalRoleBd,
    time_commitment_breakdown: timeBd,
    avg_lead_score: avgLeadScore,
    hot_leads: hotLeadRes.count || 0,
    audit_logs_7d: auditRes.count || 0,
    deletion_requests: deletionRes.count || 0,
    mentor_applications_pending: mentorRes.count || 0,
    content_calendar_items: contentRes.count || 0,
    social_queue_pending: socialRes.count || 0,
    referral_total: referralRes.count || 0,
    referral_converted: referralConvRes.count || 0,
    total_cohorts: cohortList.length,
    avg_cohort_size: avgCohortSize,
    total_cohort_members: cohortMembersRes.count || 0
  };
}
__name(fetchPlatformData, "fetchPlatformData");
function buildPrompt(data) {
  return `You are the AI business intelligence engine for Ascentor — an AI-powered leadership development platform.

Analyse this real-time platform snapshot and generate a sharp, actionable business intelligence report.

PLATFORM DATA SNAPSHOT:
${JSON.stringify({
    growth: {
      total_users: data.total_users,
      new_signups_7d: data.new_7d,
      new_signups_30d: data.new_30d,
      prev_period_7d: data.prev_7d,
      onboarding_completion_rate: `${data.onboard_rate}%`,
      waitlist: data.waitlist,
      newsletter_subscribers: data.newsletter_subs,
      signup_trend: data.prev_7d > 0 ? `${Math.round((data.new_7d - data.prev_7d) / data.prev_7d * 100)}% vs last week` : "no prior data"
    },
    revenue: {
      paid_users: data.paid_users,
      free_users: data.free_users,
      conversion_rate: `${data.conversion_rate}%`,
      total_revenue_ngn: data.total_revenue,
      revenue_last_7d: data.revenue_7d,
      revenue_last_30d: data.revenue_30d,
      plan_distribution: data.plan_breakdown,
      active_promo_codes: data.active_promos
    },
    engagement: {
      coaching_sessions_7d: data.coaching_sessions_7d,
      coaching_sessions_30d: data.coaching_sessions_30d,
      unique_active_users_7d: data.unique_coaches_7d,
      avg_sessions_per_active_user: data.avg_sessions_per_user,
      total_ai_tokens_used: data.total_coaching_tokens,
      course_completions_7d: data.course_completions_7d,
      community_posts_7d: data.community_posts_7d,
      total_community_members: data.community_members,
      expert_session_registrations_7d: data.expert_registrations_7d
    },
    user_profiles: {
      top_industries: Object.entries(data.industry_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5),
      top_challenges: Object.entries(data.challenge_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5),
      top_goal_roles: Object.entries(data.goal_role_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5),
      time_commitment_split: data.time_commitment_breakdown,
      avg_lead_score: data.avg_lead_score,
      hot_unconverted_leads: data.hot_leads
    },
    community: {
      total_cohorts: data.total_cohorts,
      total_cohort_members: data.total_cohort_members,
      avg_cohort_size: data.avg_cohort_size
    },
    operations: {
      audit_events_7d: data.audit_logs_7d,
      pending_deletion_requests: data.deletion_requests,
      mentor_applications_pending: data.mentor_applications_pending,
      content_drafts_unpublished: data.content_calendar_items,
      social_posts_queued: data.social_queue_pending,
      referral_total: data.referral_total,
      referral_conversion: data.referral_converted
    }
  }, null, 2)}

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "generated_at": "<ISO timestamp>",
  "headline": "<1 punchy sentence — the single most important thing happening on this platform right now>",
  "top_priority": "<The ONE thing the founder should focus on this week and why, max 2 sentences>",
  "insights": [
    {
      "id": "<unique_slug>",
      "domain": "<Growth|Revenue|Engagement|Product|Users|Operations>",
      "severity": "<critical|warning|opportunity|healthy>",
      "title": "<sharp 5-8 word insight title>",
      "body": "<2-3 sentences explaining what the data says and why it matters>",
      "action": "<concrete 1-sentence action the founder should take>"
    }
  ],
  "community_recs": [
    {
      "name": "<community name>",
      "rationale": "<1 sentence based on user profile data>",
      "estimated_size": <number>,
      "category": "<Technology|Finance|Leadership|Entrepreneurship|Consulting|Career Growth|Executive|Diversity>"
    }
  ]
}

Rules:
- Generate 6-10 insights covering all domains
- Be specific — reference actual numbers
- community_recs: 2-4 recommendations
- Think like a $100M SaaS founder advising on their metrics`;
}
__name(buildPrompt, "buildPrompt");
var intelReporterAgent = schedules_exports.task({
  id: "intel-reporter-agent",
  // 7am UTC daily
  cron: "0 7 * * *",
  run: /* @__PURE__ */ __name(async () => {
    const startTime = Date.now();
    console.log("[Intel Reporter] Starting daily platform analysis...");
    const rawData = await fetchPlatformData();
    console.log(`[Intel Reporter] Data fetched. Total users: ${rawData.total_users}`);
    const prompt = buildPrompt(rawData);
    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      // Haiku is 15x cheaper, fully capable for this structured task
      max_tokens: 2e3,
      messages: [{ role: "user", content: prompt }]
    });
    const text = claudeRes.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const aiReport = JSON.parse(clean);
    const inputTokens = claudeRes.usage.input_tokens;
    const outputTokens = claudeRes.usage.output_tokens;
    const costUsd = inputTokens / 1e6 * 0.8 + outputTokens / 1e6 * 4;
    const tokenCost = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Math.round(costUsd * 1e5) / 1e5
      // 5 decimal places
    };
    const durationMs = Date.now() - startTime;
    const { error } = await supabase.from("platform_snapshots").insert({
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      generated_by: "scheduled",
      raw_data: rawData,
      ai_report: aiReport,
      token_cost: tokenCost,
      duration_ms: durationMs
    });
    if (error) {
      console.error("[Intel Reporter] Failed to save snapshot:", error.message);
      throw error;
    }
    const { data: old } = await supabase.from("platform_snapshots").select("id, generated_at").order("generated_at", { ascending: false }).range(30, 1e3);
    if (old && old.length > 0) {
      const oldIds = old.map((r) => r.id);
      await supabase.from("platform_snapshots").delete().in("id", oldIds);
      console.log(`[Intel Reporter] Pruned ${oldIds.length} old snapshots.`);
    }
    console.log(`[Intel Reporter] Done in ${durationMs}ms. Cost: $${costUsd.toFixed(5)}. Tokens: ${inputTokens}in/${outputTokens}out`);
    return {
      success: true,
      duration_ms: durationMs,
      token_cost: tokenCost,
      total_users: rawData.total_users
    };
  }, "run")
});
export {
  intelReporterAgent
};
//# sourceMappingURL=intel-reporter.mjs.map
