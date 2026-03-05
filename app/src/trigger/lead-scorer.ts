// ═══════════════════════════════════════════════════════════
// Agent 5: Lead Scorer
// Runs daily. Scores every free user 1–100 based on behaviour.
// At 70+ score, inserts an upgrade prompt notification.
// Score factors: sessions, session length, login frequency,
// days since signup, goal completions, referrals.
// ═══════════════════════════════════════════════════════════
import { schedules } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function calcLeadScore(data: {
  totalSessions: number;
  sessionsLast7d: number;
  avgSessionLength: number; // messages per session
  daysSinceSignup: number;
  daysSinceLastSession: number;
  referralCount: number;
  hasGoals: boolean;
}): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  // Sessions (max 30 pts) — core engagement signal
  breakdown.sessions = Math.min(data.totalSessions * 5, 30);

  // Recency (max 25 pts) — recent sessions score highest
  if (data.daysSinceLastSession <= 1) breakdown.recency = 25;
  else if (data.daysSinceLastSession <= 3) breakdown.recency = 20;
  else if (data.daysSinceLastSession <= 7) breakdown.recency = 12;
  else if (data.daysSinceLastSession <= 14) breakdown.recency = 5;
  else breakdown.recency = 0;

  // Depth (max 20 pts) — longer sessions = deeper engagement
  breakdown.depth = Math.min(Math.floor(data.avgSessionLength / 4) * 5, 20);

  // Momentum (max 15 pts) — sessions this week
  breakdown.momentum = Math.min(data.sessionsLast7d * 5, 15);

  // Goals set (5 pts) — intent signal
  breakdown.goals = data.hasGoals ? 5 : 0;

  // Referrals (5 pts) — advocacy signal
  breakdown.referrals = Math.min(data.referralCount * 2, 5);

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, breakdown };
}

export const leadScorerAgent = schedules.task({
  id: "lead-scorer-agent",
  // Run at 2am UTC daily — low traffic window
  cron: "0 2 * * *",
  run: async () => {
    console.log("[Lead Scorer] Starting daily scoring run...");

    // Get all free users
    const { data: freeUsers } = await supabase
      .from("profiles")
      .select("id, created_at, referral_count")
      .in("subscription_status", ["inactive", "cancelled"])
      .not("email", "is", null);

    if (!freeUsers || freeUsers.length === 0) {
      console.log("[Lead Scorer] No free users found");
      return { scored: 0 };
    }

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86400000).toISOString();
    let scored = 0;
    let upgradeTriggers = 0;

    for (const user of freeUsers) {
      try {
        // Get all sessions for this user
        const { data: allSessions } = await supabase
          .from("coaching_sessions")
          .select("id, created_at, messages, goals")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const sessions = allSessions || [];
        const recentSessions = sessions.filter(s => s.created_at >= weekAgo);
        const lastSession = sessions[0];
        const daysSinceLastSession = lastSession
          ? Math.floor((now - new Date(lastSession.created_at).getTime()) / 86400000)
          : 999;

        const avgSessionLength = sessions.length > 0
          ? sessions.reduce((acc, s) => acc + (s.messages?.length || 0), 0) / sessions.length
          : 0;

        const hasGoals = sessions.some(s => s.goals && s.goals.length > 0);
        const daysSinceSignup = Math.floor(
          (now - new Date(user.created_at).getTime()) / 86400000
        );

        const { score, breakdown } = calcLeadScore({
          totalSessions:       sessions.length,
          sessionsLast7d:      recentSessions.length,
          avgSessionLength,
          daysSinceSignup,
          daysSinceLastSession,
          referralCount:       user.referral_count || 0,
          hasGoals,
        });

        // Save score to profiles table
        await supabase
          .from("profiles")
          .update({
            lead_score:           score,
            lead_score_breakdown: breakdown,
            lead_scored_at:       new Date().toISOString(),
          })
          .eq("id", user.id);

        scored++;

        // At 70+ score → send upgrade prompt notification (once per 7 days)
        if (score >= 70) {
          const { data: recentNotif } = await supabase
            .from("notifications")
            .select("id, created_at")
            .eq("user_id", user.id)
            .eq("type", "upgrade_prompt")
            .gte("created_at", weekAgo)
            .single();

          if (!recentNotif) {
            await supabase.from("notifications").insert({
              user_id: user.id,
              type: "upgrade_prompt",
              title: "You're on a roll 🔥",
              message: `You've had ${sessions.length} coaching sessions. Unlock unlimited access and take your leadership to the next level.`,
              link: "/checkout",
            });
            upgradeTriggers++;
          }
        }
      } catch (err) {
        console.error(`[Lead Scorer] Error scoring user ${user.id}:`, err);
      }
    }

    console.log(`[Lead Scorer] Done — scored: ${scored}, upgrade triggers: ${upgradeTriggers}`);
    return { success: true, scored, upgradeTriggers, total: freeUsers.length };
  },
});
