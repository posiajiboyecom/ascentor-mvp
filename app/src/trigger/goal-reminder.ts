import { schedules } from "@trigger.dev/sdk/v3";
import { sendEmail } from "@/lib/nodemailer";
import { createClient } from "@supabase/supabase-js";
import { goalReminderEmail } from "./emails/email-templates";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dailyGoalReminder = schedules.task({
  id: "daily-goal-reminder",
  cron: "0 8 * * *",
  run: async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email");

    if (!profiles || profiles.length === 0) return { sent: 0 };

    const { data: sessions } = await supabase
      .from("coaching_sessions")
      .select("user_id, created_at, goals")
      .order("created_at", { ascending: false });

    const userLastSession: Record<string, { date: string; goals: string[] }> = {};
    for (const s of sessions || []) {
      if (!userLastSession[s.user_id]) {
        userLastSession[s.user_id] = { date: s.created_at, goals: s.goals || [] };
      }
    }

    let sent = 0;

    for (const profile of profiles) {
      if (!profile.email) continue;
      const lastSession = userLastSession[profile.id];
      if (!lastSession) continue;

      const daysSince = Math.floor(
        (Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < 3 || daysSince > 14) continue;

      const goals = lastSession.goals.length > 0
        ? lastSession.goals
        : ["Continue developing your leadership skills"];

      const template = goalReminderEmail(profile.full_name || "there", goals, daysSince);

      try {
        await sendEmail({
          to: profile.email,
          subject: template.subject,
          html: template.html,
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send reminder to ${profile.email}:`, err);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Goal reminders sent: ${sent}`);
    return { success: true, sent, checked: profiles.length };
  },
});
