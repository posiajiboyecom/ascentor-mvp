// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — FREE TIER EDITION v4
// ═══════════════════════════════════════════════════════════
import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Robust JSON extractor ──────────────────────────────────
function extractJSON(raw: string): any {
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(text); } catch { /* continue */ }

  const firstBrace   = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start =
    firstBrace === -1   ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket);

  if (start !== -1) {
    const closer = text[start] === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      try { return JSON.parse(text.slice(start, lastClose + 1)); } catch { /* continue */ }
    }
  }
  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 120)}`);
}

// System prompt forces raw JSON — no markdown fences ever
const SYSTEM =
  "You are a JSON API. Respond with ONLY a valid raw JSON object. " +
  "Never use markdown code fences (no triple backticks). " +
  "Never add any text before or after the JSON. " +
  "Your entire response must begin with { and end with }.";

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 120,
  run: async (payload: {
    topic: string;
    pillar: "leadership" | "career" | "ai" | "coaching" | "community";
    week?: number;
    triggeredBy?: string;
    briefId?: string | null;
    hooks?: string[];
    keyMessages?: string[];
    dataPoints?: string[];
  }) => {
    const {
      topic, pillar, week = 1,
      hooks = [], keyMessages = [], dataPoints = [],
    } = payload;

    if (payload.briefId) {
      logger.info(`[Content Writer] Received brief — briefId: ${payload.briefId}`);
    }
    logger.info(`[Content Writer] Starting — topic: "${topic}" | pillar: ${pillar}`);

    const keyMsgBlock = keyMessages.length > 0
      ? `Key messages:\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}` : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points:\n${dataPoints.map(d => `- ${d}`).join("\n")}` : "";
    const hookBlock = hooks.length > 0
      ? `Proven hooks (use one as opener):\n${hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : "";

    logger.info("[Content Writer] Firing all 4 Claude calls in parallel...");

    const [blogSettled, linkedinSettled, twitterSettled, newsletterSettled] =
      await Promise.allSettled([

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write a compelling blog post for Ascentor (AI leadership coaching for African professionals).
Topic: "${topic}"
${keyMsgBlock}
${dataBlock}
600-800 words. Strong headline, 3-4 subheadings, CTA at end. Personal tone. African business context.
Return exactly: { "title": "...", "content": "full markdown", "meta_description": "160 char", "cta": "..." }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write LinkedIn content for Ascentor (AI coaching for African professionals).
Topic: "${topic}"
${hookBlock}
${dataBlock}
Write 5 posts (4-1-1 rule: 4 value, 1 social proof). Each: 150-300 words, strong hook first line.
Return exactly: { "posts": [ { "type": "value", "hook": "first line", "content": "full post" } ] }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write Twitter/X threads for Ascentor (AI leadership coaching for Africa).
Topic: "${topic}"
${hookBlock}
Write 3 threads, each 5-7 tweets. Punchy openers, soft CTA at end.
Return exactly: { "threads": [ { "opener": "hook", "tweets": ["t1","t2","t3","t4","t5"], "cta": "cta tweet" } ] }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write a newsletter for "The African Leader" (Ascentor weekly email).
Topic: "${topic}"
400-600 words. Personal, warm, mentor-letter style. No corporate speak.
Structure: Hook, Insight, Practical takeaway, Soft CTA to try Ascentor.
${dataBlock}
${hooks.length > 2 ? `Subject inspiration: ${hooks[2]}` : ""}
Return exactly: { "subject": "...", "preview_text": "90 chars max", "body": "full markdown" }`,
          }],
        }),
      ]);

    // ── Extract with safe fallbacks ───────────────────────
    let blog: any = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        blog = extractJSON(raw);
        logger.info(`[Content Writer] Blog ok — "${blog.title}"`);
      } catch (e) { logger.error(`[Content Writer] Blog parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Blog API error: ${blogSettled.reason}`); }

    let linkedinPosts: any[] = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        linkedinPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
        logger.info(`[Content Writer] LinkedIn ok — ${linkedinPosts.length} posts`);
      } catch (e) { logger.error(`[Content Writer] LinkedIn parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] LinkedIn API error: ${linkedinSettled.reason}`); }

    let twitterThreads: any[] = [];
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        const parsed = extractJSON(raw);
        twitterThreads = Array.isArray(parsed.threads) ? parsed.threads : [];
        logger.info(`[Content Writer] Twitter ok — ${twitterThreads.length} threads`);
      } catch (e) { logger.error(`[Content Writer] Twitter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Twitter API error: ${twitterSettled.reason}`); }

    let newsletter: any = { subject: `Newsletter: ${topic}`, preview_text: "", body: "" };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Content Writer] Newsletter ok — "${newsletter.subject}"`);
      } catch (e) { logger.error(`[Content Writer] Newsletter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Newsletter API error: ${newsletterSettled.reason}`); }

    // ── Build rows — ONLY columns confirmed to exist in table
    // Confirmed columns: id (auto), pillar, type, title, platform,
    //                    week, status, content_data, created_at (auto)
    // NOT in table: triggered_by, scheduled_for
    const items = [
      {
        pillar, week, status: "draft", platform: "Website",
        type: "Blog Post",
        title: (blog.title || topic).substring(0, 255),
        content_data: blog,
      },
      ...linkedinPosts.map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "LinkedIn",
        type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p,
      })),
      ...twitterThreads.map((t: any, i: number) => ({
        pillar, week, status: "draft", platform: "Twitter/X",
        type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 50)}...`,
        content_data: t,
      })),
      {
        pillar, week, status: "draft", platform: "Email",
        type: "Email Newsletter",
        title: (newsletter.subject || `Newsletter: ${topic}`).substring(0, 255),
        content_data: newsletter,
      },
    ];

    // ── Insert one-by-one ─────────────────────────────────
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase
        .from("content_calendar")
        .insert(item);

      if (error) {
        logger.error(`[Content Writer] Insert failed for "${item.title}": ${JSON.stringify(error)}`);
      } else {
        insertedCount++;
      }
    }

    logger.info(`[Content Writer] Saved ${insertedCount}/${items.length} rows`);

    const summary = {
      topic, pillar, week,
      generated: { blog: 1, linkedin_posts: linkedinPosts.length, twitter_threads: twitterThreads.length, newsletter: 1 },
      total_items: items.length,
      inserted: insertedCount,
    };
    logger.info("[Content Writer] Done:", summary);
    return summary;
  },
});
