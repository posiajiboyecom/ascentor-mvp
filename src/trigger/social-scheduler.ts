// ═══════════════════════════════════════════════════════════
// Agent 3: Social Scheduler
// Triggered manually from admin OR after Content Writer.
// Takes approved content from content_calendar and queues
// it in social_queue with optimal posting times.
//
// Phase 1 (now):  Supabase social_queue — admin copies/approves
// Phase 2 (later): Buffer API — auto-post when integrated
//
// No extra API keys needed. Uses Claude to pick optimal times.
// ═══════════════════════════════════════════════════════════

import { task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Optimal WAT posting times per platform ────────────────
// Based on African professional audience engagement research
const POSTING_SCHEDULE: Record<string, { day: number; hour: number; minute: number }[]> = {
  "LinkedIn": [
    { day: 1, hour: 8,  minute: 0  }, // Monday 8am
    { day: 2, hour: 12, minute: 0  }, // Tuesday 12pm
    { day: 3, hour: 8,  minute: 30 }, // Wednesday 8:30am
    { day: 4, hour: 17, minute: 0  }, // Thursday 5pm
    { day: 5, hour: 9,  minute: 0  }, // Friday 9am
  ],
  "Twitter/X": [
    { day: 1, hour: 9,  minute: 0  }, // Monday 9am
    { day: 1, hour: 19, minute: 0  }, // Monday 7pm
    { day: 2, hour: 13, minute: 0  }, // Tuesday 1pm
    { day: 3, hour: 9,  minute: 0  }, // Wednesday 9am
    { day: 3, hour: 20, minute: 0  }, // Wednesday 8pm
    { day: 4, hour: 13, minute: 0  }, // Thursday 1pm
    { day: 5, hour: 10, minute: 0  }, // Friday 10am
  ],
  "Email": [
    { day: 5, hour: 7,  minute: 0  }, // Friday 7am — newsletter day
  ],
  "Website": [
    { day: 1, hour: 10, minute: 0  }, // Monday 10am — blog publish
  ],
};

// Get next occurrence of a day/time from a given start date
function getNextSlot(
  from: Date,
  day: number, // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number,
  minute: number
): Date {
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  const diff = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 && d <= from ? 7 : diff));
  return d;
}

export const socialSchedulerAgent = task({
  id: "social-scheduler-agent",
  retry: { maxAttempts: 2 },
  run: async (payload: {
    week?: number;          // Schedule content for a specific week
    pillar?: string;        // Filter by pillar
    triggeredBy?: string;
    autoApprove?: boolean;  // If true, schedule all draft content without review
  }) => {
    const {
      week,
      pillar,
      triggeredBy = "manual",
      autoApprove = false,
    } = payload;

    console.log(`[Social Scheduler] Starting — week: ${week || 'all'} | pillar: ${pillar || 'all'}`);

    // ── 1. Fetch approved/draft content from content_calendar ─
    let query = supabase
      .from("content_calendar")
      .select("*")
      .in("status", autoApprove ? ["draft", "scheduled"] : ["scheduled"])
      .order("week")
      .order("created_at");

    if (week) query = query.eq("week", week);
    if (pillar) query = query.eq("pillar", pillar);

    const { data: contentItems, error: fetchError } = await query;

    if (fetchError) throw new Error(`Failed to fetch content: ${fetchError.message}`);
    if (!contentItems || contentItems.length === 0) {
      console.log("[Social Scheduler] No content to schedule");
      return { success: true, scheduled: 0, message: "No approved content found. Set content status to 'scheduled' in the Content Calendar first." };
    }

    console.log(`[Social Scheduler] Found ${contentItems.length} items to schedule`);

    // ── 2. Check what's already in social_queue this week ────
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: existingQueue } = await supabase
      .from("social_queue")
      .select("platform, scheduled_for")
      .gte("scheduled_for", weekStart.toISOString())
      .lt("scheduled_for", weekEnd.toISOString());

    // Track used slots to avoid double-booking
    const usedSlots = new Set(
      (existingQueue || []).map(q =>
        `${q.platform}:${new Date(q.scheduled_for).toISOString()}`
      )
    );

    // ── 3. Assign optimal time slots to each content item ────
    const now = new Date();
    const queueItems: any[] = [];
    const slotCounters: Record<string, number> = {};

    for (const item of contentItems) {
      const platform = item.platform || "LinkedIn";
      const slots = POSTING_SCHEDULE[platform] || POSTING_SCHEDULE["LinkedIn"];
      const idx = slotCounters[platform] || 0;
      slotCounters[platform] = idx + 1;

      // Pick the next available slot for this platform
      const slot = slots[idx % slots.length];
      let scheduledFor = getNextSlot(now, slot.day, slot.hour, slot.minute);

      // If slot is taken, push 1 week forward
      let slotKey = `${platform}:${scheduledFor.toISOString()}`;
      let attempts = 0;
      while (usedSlots.has(slotKey) && attempts < 10) {
        scheduledFor = new Date(scheduledFor.getTime() + 7 * 86400000);
        slotKey = `${platform}:${scheduledFor.toISOString()}`;
        attempts++;
      }
      usedSlots.add(slotKey);

      // Extract post-ready text from content_data
      const cd = item.content_data as any;
      let postText = "";

      if (item.type === "Blog Post") {
        postText = cd?.title
          ? `${cd.title}\n\n${(cd.content || "").substring(0, 200)}...\n\nRead more → ${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_URL}/blog`
          : item.title;
      } else if (item.type === "LinkedIn Post") {
        postText = cd?.content || cd?.hook || item.title;
      } else if (item.type === "Twitter Thread") {
        postText = [cd?.opener, ...(cd?.tweets || []).slice(0, 2), cd?.cta]
          .filter(Boolean).join("\n\n");
      } else if (item.type === "Email Newsletter") {
        postText = `📬 "${cd?.subject || item.title}" — sent to subscribers`;
      } else {
        postText = item.title;
      }

      queueItems.push({
        platform,
        content:      postText,
        pillar:       item.pillar,
        scheduled_for: scheduledFor.toISOString(),
        status:       "queued",
        content_calendar_id: item.id,
        created_at:   now.toISOString(),
      });
    }

    // ── 4. Insert into social_queue ──────────────────────────
    const { error: insertError } = await supabase
      .from("social_queue")
      .insert(queueItems);

    if (insertError) throw new Error(`Failed to insert queue: ${insertError.message}`);

    // ── 5. Mark content_calendar items as scheduled ──────────
    const ids = contentItems.map(i => i.id);
    await supabase
      .from("content_calendar")
      .update({ status: "scheduled" })
      .in("id", ids);

    // ── 6. Claude summary of the week's schedule ─────────────
    const scheduleText = queueItems
      .map(q => `${q.platform} — ${new Date(q.scheduled_for).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: ${q.content.substring(0, 80)}...`)
      .join("\n");

    const summaryRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Here is this week's social media schedule for Ascentor:\n\n${scheduleText}\n\nWrite a 2-sentence summary of this week's content strategy for the founder. Be specific about the mix and timing.`,
      }],
    });

    const strategySummary = summaryRes.content[0].type === "text"
      ? summaryRes.content[0].text : "";

    console.log(`[Social Scheduler] Queued ${queueItems.length} posts`);

    return {
      success:         true,
      scheduled:       queueItems.length,
      platforms:       [...new Set(queueItems.map(q => q.platform))],
      firstPost:       queueItems[0]?.scheduled_for || null,
      lastPost:        queueItems[queueItems.length - 1]?.scheduled_for || null,
      strategySummary,
      triggeredBy,
    };
  },
});
