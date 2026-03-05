// ═══════════════════════════════════════════════════════════
// Agent 3: Social Scheduler
// Triggered manually from admin OR after Content Writer.
// Takes approved content from content_calendar and queues
// it in social_queue with optimal posting times.
//
// RATE LIMIT FIX:
//   claudeWithRetry() wraps the summary call with exponential
//   backoff so a transient 429 doesn't fail the whole task.
// ═══════════════════════════════════════════════════════════

import { task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Rate-limit-safe wrapper with exponential backoff ─────────
async function claudeWithRetry(
  params: Parameters<typeof anthropic.messages.create>[0],
  retries = 3
): Promise<Anthropic.Message> {
  for (let i = 0; i < retries; i++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.error?.type === "rate_limit_error";
      if (is429 && i < retries - 1) {
        const wait = Math.pow(2, i + 1) * 1500; // 3s → 6s → 12s
        console.warn(`[Social Scheduler] Rate limited. Retrying in ${wait}ms (attempt ${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error("claudeWithRetry: exhausted retries");
}

// ── Optimal WAT posting times per platform ────────────────
const POSTING_SCHEDULE: Record<string, { day: number; hour: number; minute: number }[]> = {
  "LinkedIn": [
    { day: 1, hour: 8,  minute: 0  },
    { day: 2, hour: 12, minute: 0  },
    { day: 3, hour: 8,  minute: 30 },
    { day: 4, hour: 17, minute: 0  },
    { day: 5, hour: 9,  minute: 0  },
  ],
  "Twitter/X": [
    { day: 1, hour: 9,  minute: 0  },
    { day: 1, hour: 19, minute: 0  },
    { day: 2, hour: 13, minute: 0  },
    { day: 3, hour: 9,  minute: 0  },
    { day: 3, hour: 20, minute: 0  },
    { day: 4, hour: 13, minute: 0  },
    { day: 5, hour: 10, minute: 0  },
  ],
  "Email": [
    { day: 5, hour: 7, minute: 0 },
  ],
  "Website": [
    { day: 1, hour: 10, minute: 0 },
  ],
};

function getNextSlot(from: Date, day: number, hour: number, minute: number): Date {
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
    week?: number;
    pillar?: string;
    triggeredBy?: string;
    autoApprove?: boolean;
  }) => {
    const {
      week,
      pillar,
      triggeredBy = "manual",
      autoApprove = false,
    } = payload;

    console.log(`[Social Scheduler] Starting — week: ${week || "all"} | pillar: ${pillar || "all"}`);

    // ── 1. Fetch approved/draft content from content_calendar ─
    let query = supabase
      .from("content_calendar")
      .select("*")
      .in("status", autoApprove ? ["draft", "scheduled"] : ["scheduled"])
      .order("week")
      .order("created_at");

    if (week)   query = query.eq("week", week);
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
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: existingQueue } = await supabase
      .from("social_queue")
      .select("platform, scheduled_for")
      .gte("scheduled_for", weekStart.toISOString())
      .lt("scheduled_for",  weekEnd.toISOString());

    const usedSlots = new Set(
      (existingQueue || []).map(
        (q) => `${q.platform}:${new Date(q.scheduled_for).toISOString()}`
      )
    );

    // ── 3. Assign optimal time slots ─────────────────────────
    const now = new Date();
    const queueItems: any[] = [];
    const slotCounters: Record<string, number> = {};

    for (const item of contentItems) {
      const platform = item.platform || "LinkedIn";
      const slots    = POSTING_SCHEDULE[platform] || POSTING_SCHEDULE["LinkedIn"];
      const idx      = slotCounters[platform] || 0;
      slotCounters[platform] = idx + 1;

      const slot = slots[idx % slots.length];
      let scheduledFor = getNextSlot(now, slot.day, slot.hour, slot.minute);

      let slotKey  = `${platform}:${scheduledFor.toISOString()}`;
      let attempts = 0;
      while (usedSlots.has(slotKey) && attempts < 10) {
        scheduledFor = new Date(scheduledFor.getTime() + 7 * 86400000);
        slotKey      = `${platform}:${scheduledFor.toISOString()}`;
        attempts++;
      }
      usedSlots.add(slotKey);

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
        content:             postText,
        pillar:              item.pillar,
        scheduled_for:       scheduledFor.toISOString(),
        status:              "queued",
        content_calendar_id: item.id,
        created_at:          now.toISOString(),
      });
    }

    // ── 4. Insert into social_queue ──────────────────────────
    const { error: insertError } = await supabase.from("social_queue").insert(queueItems);
    if (insertError) throw new Error(`Failed to insert queue: ${insertError.message}`);

    // ── 5. Mark content_calendar items as scheduled ──────────
    const ids = contentItems.map((i) => i.id);
    await supabase.from("content_calendar").update({ status: "scheduled" }).in("id", ids);

    // ── 6. Claude summary — wrapped with retry ────────────────
    const scheduleText = queueItems
      .map(
        (q) =>
          `${q.platform} — ${new Date(q.scheduled_for).toLocaleDateString("en-GB", {
            weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          })}: ${q.content.substring(0, 80)}...`
      )
      .join("\n");

    const summaryRes = await claudeWithRetry({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role:    "user",
        content: `Here is this week's social media schedule for Ascentor:\n\n${scheduleText}\n\nWrite a 2-sentence summary of this week's content strategy for the founder. Be specific about the mix and timing.`,
      }],
    });

    const strategySummary =
      summaryRes.content[0].type === "text" ? summaryRes.content[0].text : "";

    console.log(`[Social Scheduler] Queued ${queueItems.length} posts`);

    return {
      success:         true,
      scheduled:       queueItems.length,
      platforms:       [...new Set(queueItems.map((q) => q.platform))],
      firstPost:       queueItems[0]?.scheduled_for       || null,
      lastPost:        queueItems[queueItems.length - 1]?.scheduled_for || null,
      strategySummary,
      triggeredBy,
    };
  },
});
