import {
  goalReminderEmail
} from "../../../../chunk-XMG42UWX.mjs";
import {
  sendPushToUser
} from "../../../../chunk-B2ELQ2YB.mjs";
import "../../../../chunk-7KMAXNMD.mjs";
import "../../../../chunk-Q3S2BM77.mjs";
import {
  Resend
} from "../../../../chunk-4NS42XCJ.mjs";
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

// src/trigger/goal-reminder.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var dailyGoalReminder = schedules_exports.task({
  id: "daily-goal-reminder",
  // 9am WAT (8am UTC) every day
  cron: "0 8 * * *",
  run: /* @__PURE__ */ __name(async () => {
    const threeDaysAgo = /* @__PURE__ */ new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    if (!profiles || profiles.length === 0) return { sent: 0 };
    const { data: sessions } = await supabase.from("coaching_sessions").select("user_id, created_at, goals").order("created_at", { ascending: false });
    const userLastSession = {};
    for (const s of sessions || []) {
      if (!userLastSession[s.user_id]) {
        userLastSession[s.user_id] = {
          date: s.created_at,
          goals: s.goals || []
        };
      }
    }
    let sent = 0;
    for (const profile of profiles) {
      if (!profile.email) continue;
      const lastSession = userLastSession[profile.id];
      if (!lastSession) continue;
      const lastDate = new Date(lastSession.date);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1e3 * 60 * 60 * 24));
      if (daysSince < 3 || daysSince > 14) continue;
      const goals = lastSession.goals.length > 0 ? lastSession.goals : ["Continue developing your leadership skills"];
      const template = goalReminderEmail(
        profile.full_name || "there",
        goals,
        daysSince
      );
      try {
        await resend.emails.send({
          from: "Ascentor <hello@ascentorbi.com>",
          to: profile.email,
          subject: template.subject,
          html: template.html
        });
        sent++;
      } catch (err) {
        console.error(`Failed to send reminder to ${profile.email}:`, err);
      }
      try {
        const dayText = daysSince === 1 ? "yesterday" : `${daysSince} days ago`;
        await sendPushToUser(supabase, profile.id, {
          title: "Your coach is waiting 🌱",
          body: `Last session was ${dayText}. 5 minutes with Sage keeps momentum going.`,
          url: "/coach",
          tag: "goal-reminder",
          icon: "/icons/icon-192.png"
        });
      } catch {
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`Goal reminders sent: ${sent}`);
    return { success: true, sent, checked: profiles.length };
  }, "run")
});
export {
  dailyGoalReminder
};
//# sourceMappingURL=goal-reminder.mjs.map
