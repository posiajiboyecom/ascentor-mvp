import { schedules } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { goalReminderEmail } from "./emails/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dailyGoalReminder = schedules.task({
  id: "daily-goal-reminder",
  // 9am WAT (8am UTC) every day
  cron: "0 8 * * *",
  run: async () => {
    // Find users who haven't had a coaching session in 3+ days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get all users with their last session date
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email");

    if (!profiles || profiles.length === 0) return { sent: 0 };

    // Get latest session per user
    const { data: sessions } = await supabase
      .from("coaching_sessions")
      .select("user_id, created_at, goals")
      .order("created_at", { ascending: false });

    // Build map of latest session per user
    const userLastSession: Record<string, { date: string; goals: string[] }> = {};
    for (const s of sessions || []) {
      if (!userLastSession[s.user_id]) {
        userLastSession[s.user_id] = {
          date: s.created_at,
          goals: s.goals || [],
        };
      }
    }

    let sent = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;

      const lastSession = userLastSession[profile.id];

      // Skip if never had a session (welcome email handles onboarding)
      if (!lastSession) continue;

      const lastDate = new Date(lastSession.date);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only nudge if 3-14 days inactive (don't spam long-gone users)
      if (daysSince < 3 || daysSince > 14) continue;

      const goals = lastSession.goals.length > 0
        ? lastSession.goals
        : ["Continue developing your leadership skills"];

      const template = goalReminderEmail(
        profile.full_name || "there",
        goals,
        daysSince
      );

      try {
        await resend.emails.send({
          from: "Ascentor <onboarding@resend.dev>",
          to: profile.email,
          subject: template.subject,
          html: template.html,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send reminder to ${profile.email}:`, err);
      }

      // Rate limit: small delay between sends
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Goal reminders sent: ${sent}`);
    return { success: true, sent, checked: profiles.length };
  },
});
