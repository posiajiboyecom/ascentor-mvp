// ═══════════════════════════════════════════════════════════
// Agent 7: Analytics Reporter
// Runs every Monday at 7am UTC.
// Pulls weekly growth data from Supabase, generates a
// founder summary email using Claude, sends via Resend.
// ═══════════════════════════════════════════════════════════
import { schedules } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const analyticsReporterAgent = schedules.task({
  id: "analytics-reporter-agent",
  // Every Monday at 7am UTC
  cron: "0 7 * * 1",
  run: async () => {
    console.log("[Analytics Reporter] Generating weekly report...");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();

    // ── Pull this week's metrics ──────────────────────────
    const [
      totalUsers,
      newThisWeek,
      newLastWeek,
      paidUsers,
      sessionsThisWeek,
      sessionsLastWeek,
      newsletterSubs,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
      supabase.from("profiles").select("id", { count: "exact", head: true }).in("subscription_status", ["active", "trialing"]),
      supabase.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
      supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);

    const thisWeekSignups = newThisWeek.count || 0;
    const lastWeekSignups = newLastWeek.count || 0;
    const signupChange = lastWeekSignups > 0
      ? Math.round(((thisWeekSignups - lastWeekSignups) / lastWeekSignups) * 100)
      : 0;

    const thisWeekSessions = sessionsThisWeek.count || 0;
    const lastWeekSessions = sessionsLastWeek.count || 0;
    const sessionChange = lastWeekSessions > 0
      ? Math.round(((thisWeekSessions - lastWeekSessions) / lastWeekSessions) * 100)
      : 0;

    // WACU — unique users who coached this week
    const { data: wacuData } = await supabase
      .from("coaching_sessions")
      .select("user_id")
      .gte("created_at", weekAgo);
    const wacu = new Set((wacuData || []).map((r: any) => r.user_id)).size;

    // Top lead scores this week
    const { data: hotLeads } = await supabase
      .from("profiles")
      .select("full_name, lead_score, subscription_status")
      .gte("lead_score", 70)
      .in("subscription_status", ["inactive", "cancelled"])
      .order("lead_score", { ascending: false })
      .limit(5);

    const metrics = {
      total_users:     totalUsers.count || 0,
      new_signups:     thisWeekSignups,
      signup_change:   signupChange,
      paid_users:      paidUsers.count || 0,
      mrr_estimate:    (paidUsers.count || 0) * 15,
      sessions_week:   thisWeekSessions,
      session_change:  sessionChange,
      wacu,
      newsletter_subs: newsletterSubs.count || 0,
      hot_leads:       hotLeads?.length || 0,
    };

    // ── Ask Claude to write a compelling founder summary ──
    const claudeRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 450,
      messages: [{
        role: "user",
        content: `You are writing a weekly business report email for the founder of Ascentor — an AI mentorship platform for African professionals.

Here are this week's metrics:
${JSON.stringify(metrics, null, 2)}

Week ending: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}

Write a brief, honest, energising founder report. Include:
1. What went well this week (based on metrics)
2. What needs attention
3. One specific action to take this week
4. A one-line motivational close

Keep it under 300 words. Founder-to-founder tone. No corporate fluff.
Return plain text only (no JSON, no markdown headers).`,
      }],
    });

    const narrative = claudeRes.content[0].type === "text"
      ? claudeRes.content[0].text
      : "Weekly metrics collected. Review your dashboard for full details.";

    // ── Build and send the email ──────────────────────────
    const changeArrow = (n: number) => n > 0 ? `↑${n}%` : n < 0 ? `↓${Math.abs(n)}%` : "—";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Weekly Report</title></head>
<body style="margin:0;padding:0;background:#0C0B08;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0B08;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#141310;border-radius:16px;border:1px solid #2E2A22;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#0C0B08;padding:24px 32px;border-bottom:1px solid #2E2A22;">
          <p style="margin:0;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#E8A020;font-family:monospace;">
            ASCENTOR WEEKLY · ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:#FEF9EC;font-family:Georgia,serif;line-height:1.2;">
            Weekly Founder Report
          </h1>
        </td></tr>

        <!-- KPI Grid -->
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0 0 14px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#4A4438;font-family:monospace;">KEY METRICS</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${[
                { label: "Total Users",    value: metrics.total_users.toLocaleString(),      sub: `+${metrics.new_signups} this week ${changeArrow(metrics.signup_change)}` },
                { label: "Paid / MRR",     value: `${metrics.paid_users} / $${metrics.mrr_estimate}`, sub: "Est. monthly revenue" },
                { label: "WACU",           value: metrics.wacu.toString(),                  sub: "Active coached users" },
                { label: "Sessions",       value: metrics.sessions_week.toString(),          sub: `vs last week ${changeArrow(metrics.session_change)}` },
              ].map(m => `
                <td style="width:25%;padding:0 6px 14px 0;vertical-align:top;">
                  <div style="background:#1E1C17;border-radius:10px;padding:12px;">
                    <p style="margin:0 0 4px;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#4A4438;font-family:monospace;">${m.label}</p>
                    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#E8A020;font-family:Georgia,serif;line-height:1;">${m.value}</p>
                    <p style="margin:0;font-size:10px;color:#7A7260;font-family:monospace;">${m.sub}</p>
                  </div>
                </td>
              `).join("")}
            </tr>
            <tr>
              ${[
                { label: "Newsletter",     value: metrics.newsletter_subs.toLocaleString(), sub: "Active subscribers" },
                { label: "Hot Leads",      value: metrics.hot_leads.toString(),             sub: "Score 70+ not yet paid" },
              ].map(m => `
                <td style="width:25%;padding:0 6px 14px 0;vertical-align:top;">
                  <div style="background:#1E1C17;border-radius:10px;padding:12px;">
                    <p style="margin:0 0 4px;font-size:9px;letter-spacing:0.1em;text-transform:uppercase;color:#4A4438;font-family:monospace;">${m.label}</p>
                    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#E8A020;font-family:Georgia,serif;line-height:1;">${m.value}</p>
                    <p style="margin:0;font-size:10px;color:#7A7260;font-family:monospace;">${m.sub}</p>
                  </div>
                </td>
              `).join("")}
            </tr>
          </table>
        </td></tr>

        <!-- Claude narrative -->
        <tr><td style="padding:0 32px 28px;">
          <div style="background:#1A1815;border-radius:12px;border-left:3px solid #E8A020;padding:20px 24px;">
            <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#E8A020;font-family:monospace;">FOUNDER BRIEF · AI GENERATED</p>
            <p style="margin:0;font-size:14px;color:#D4CFC3;line-height:1.8;white-space:pre-wrap;font-family:'Helvetica Neue',Arial,sans-serif;">${narrative}</p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 32px;border-top:1px solid #2E2A22;text-align:center;">
          <p style="margin:0;font-size:11px;color:#4A4438;font-family:monospace;">
            Ascentor Master Admin · <a href="${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_URL}/admin/master" style="color:#E8A020;text-decoration:none;">Open Dashboard</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const founderEmail = process.env.FOUNDER_EMAIL || process.env.FOUNDER_EMAIL || "hello@ascentorbi.com";

    await resend.emails.send({
      from: "Ascentor Reports <hello@ascentorbi.com>",
      to: founderEmail,
      subject: `📊 Week of ${now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${metrics.new_signups} new signups · ${metrics.wacu} WACU · $${metrics.mrr_estimate} MRR`,
      html,
    });

    console.log(`[Analytics Reporter] Report sent to ${founderEmail}`);
    return { success: true, metrics, reportSentTo: founderEmail };
  },
});
