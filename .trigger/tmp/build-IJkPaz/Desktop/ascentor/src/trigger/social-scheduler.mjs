import {
  createClient,
  dist_exports
} from "../../../../chunk-IFXSHHCG.mjs";
import {
  task
} from "../../../../chunk-MN3LL5E3.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/social-scheduler.ts
init_esm();
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var POSTING_SCHEDULE = {
  "LinkedIn": [
    { day: 1, hour: 8, minute: 0 },
    // Monday 8am
    { day: 2, hour: 12, minute: 0 },
    // Tuesday 12pm
    { day: 3, hour: 8, minute: 30 },
    // Wednesday 8:30am
    { day: 4, hour: 17, minute: 0 },
    // Thursday 5pm
    { day: 5, hour: 9, minute: 0 }
    // Friday 9am
  ],
  "Twitter/X": [
    { day: 1, hour: 9, minute: 0 },
    // Monday 9am
    { day: 1, hour: 19, minute: 0 },
    // Monday 7pm
    { day: 2, hour: 13, minute: 0 },
    // Tuesday 1pm
    { day: 3, hour: 9, minute: 0 },
    // Wednesday 9am
    { day: 3, hour: 20, minute: 0 },
    // Wednesday 8pm
    { day: 4, hour: 13, minute: 0 },
    // Thursday 1pm
    { day: 5, hour: 10, minute: 0 }
    // Friday 10am
  ],
  "Email": [
    { day: 5, hour: 7, minute: 0 }
    // Friday 7am — newsletter day
  ],
  "Website": [
    { day: 1, hour: 10, minute: 0 }
    // Monday 10am — blog publish
  ]
};
function getNextSlot(from, day, hour, minute) {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  const diff = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 && d <= from ? 7 : diff));
  return d;
}
__name(getNextSlot, "getNextSlot");
var socialSchedulerAgent = task({
  id: "social-scheduler-agent",
  retry: { maxAttempts: 2 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const {
      week,
      pillar,
      triggeredBy = "manual",
      autoApprove = false
    } = payload;
    console.log(`[Social Scheduler] Starting — week: ${week || "all"} | pillar: ${pillar || "all"}`);
    let query = supabase.from("content_calendar").select("*").in("status", autoApprove ? ["draft", "scheduled"] : ["scheduled"]).order("week").order("created_at");
    if (week) query = query.eq("week", week);
    if (pillar) query = query.eq("pillar", pillar);
    const { data: contentItems, error: fetchError } = await query;
    if (fetchError) throw new Error(`Failed to fetch content: ${fetchError.message}`);
    if (!contentItems || contentItems.length === 0) {
      console.log("[Social Scheduler] No content to schedule");
      return { success: true, scheduled: 0, message: "No approved content found. Set content status to 'scheduled' in the Content Calendar first." };
    }
    console.log(`[Social Scheduler] Found ${contentItems.length} items to schedule`);
    const weekStart = /* @__PURE__ */ new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const { data: existingQueue } = await supabase.from("social_queue").select("platform, scheduled_for").gte("scheduled_for", weekStart.toISOString()).lt("scheduled_for", weekEnd.toISOString());
    const usedSlots = new Set(
      (existingQueue || []).map(
        (q) => `${q.platform}:${new Date(q.scheduled_for).toISOString()}`
      )
    );
    const now = /* @__PURE__ */ new Date();
    const queueItems = [];
    const slotCounters = {};
    for (const item of contentItems) {
      const platform = item.platform || "LinkedIn";
      const slots = POSTING_SCHEDULE[platform] || POSTING_SCHEDULE["LinkedIn"];
      const idx = slotCounters[platform] || 0;
      slotCounters[platform] = idx + 1;
      const slot = slots[idx % slots.length];
      let scheduledFor = getNextSlot(now, slot.day, slot.hour, slot.minute);
      let slotKey = `${platform}:${scheduledFor.toISOString()}`;
      let attempts = 0;
      while (usedSlots.has(slotKey) && attempts < 10) {
        scheduledFor = new Date(scheduledFor.getTime() + 7 * 864e5);
        slotKey = `${platform}:${scheduledFor.toISOString()}`;
        attempts++;
      }
      usedSlots.add(slotKey);
      const cd = item.content_data;
      let postText = "";
      if (item.type === "Blog Post") {
        postText = cd?.title ? `${cd.title}

${(cd.content || "").substring(0, 200)}...

Read more → ${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_URL}/blog` : item.title;
      } else if (item.type === "LinkedIn Post") {
        postText = cd?.content || cd?.hook || item.title;
      } else if (item.type === "Twitter Thread") {
        postText = [cd?.opener, ...(cd?.tweets || []).slice(0, 2), cd?.cta].filter(Boolean).join("\n\n");
      } else if (item.type === "Email Newsletter") {
        postText = `📬 "${cd?.subject || item.title}" — sent to subscribers`;
      } else {
        postText = item.title;
      }
      queueItems.push({
        platform,
        content: postText,
        pillar: item.pillar,
        scheduled_for: scheduledFor.toISOString(),
        status: "queued",
        content_calendar_id: item.id,
        created_at: now.toISOString()
      });
    }
    const { error: insertError } = await supabase.from("social_queue").insert(queueItems);
    if (insertError) throw new Error(`Failed to insert queue: ${insertError.message}`);
    const ids = contentItems.map((i) => i.id);
    await supabase.from("content_calendar").update({ status: "scheduled" }).in("id", ids);
    const platforms = [...new Set(queueItems.map((q) => q.platform))];
    const firstDate = new Date(queueItems[0]?.scheduled_for).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const lastDate = new Date(queueItems[queueItems.length - 1]?.scheduled_for).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const strategySummary = `${queueItems.length} posts queued across ${platforms.join(", ")} — ${firstDate} to ${lastDate}.`;
    console.log(`[Social Scheduler] Queued ${queueItems.length} posts`);
    return {
      success: true,
      scheduled: queueItems.length,
      platforms: [...new Set(queueItems.map((q) => q.platform))],
      firstPost: queueItems[0]?.scheduled_for || null,
      lastPost: queueItems[queueItems.length - 1]?.scheduled_for || null,
      strategySummary,
      triggeredBy
    };
  }, "run")
});
export {
  socialSchedulerAgent
};
//# sourceMappingURL=social-scheduler.mjs.map
