// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — FREE TIER EDITION
//
// Free tier constraints respected:
//   - NO retry: { maxAttempts } — retries burn compute, task
//     already succeeds; failed rows are logged, not thrown.
//   - All 4 Claude calls run in parallel (Promise.allSettled)
//     so total wall-clock time is ~15-25s instead of ~60-90s.
//   - max_tokens bumped to avoid truncated JSON (was root cause
//     of LinkedIn parse failures).
//   - Robust extractJSON() handles fenced or partial responses.
//   - Rows inserted one-by-one so a bad row can't kill the batch.
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
// Handles: raw JSON, ```json fences, truncated responses
function extractJSON(raw: string): any {
  // Strip markdown fences
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Try direct parse
  try { return JSON.parse(text); } catch { /* continue */ }

  // Find outermost { } or [ ] and extract
  const firstBrace   = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const start =
    firstBrace === -1   ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket);

  if (start !== -1) {
    const opener = text[start];
    const closer = opener === "{" ? "}" : "]";
    const lastClose = text.lastIndexOf(closer);
    if (lastClose > start) {
      try { return JSON.parse(text.slice(start, lastClose + 1)); } catch { /* continue */ }
    }
  }

  throw new Error(`Could not parse JSON. Raw start: ${raw.slice(0, 120)}`);
}

export const contentWriterAgent = task({
  id: "content-writer-agent",
  // NO retry — saves compute on free tier. Each Claude call has
  // its own try/catch with a safe fallback so the task won't throw.
  maxDuration: 120, // 2-minute ceiling; parallel calls finish in ~20s
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
      topic, pillar, week = 1, triggeredBy = "manual",
      hooks = [], keyMessages = [], dataPoints = [],
    } = payload;

    if (payload.briefId) {
      logger.info(`[Content Writer] Received brief — briefId: ${payload.briefId}`);
    }
    logger.info(`[Content Writer] Starting — topic: "${topic}" | pillar: ${pillar} | from: ${triggeredBy}`);

    // ── Build shared context strings once ─────────────────
    const keyMsgBlock = keyMessages.length > 0
      ? `Key messages to weave in:\n${keyMessages.map((m, i) => `${i+1}. ${m}`).join("\n")}` : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points to include:\n${dataPoints.map(d => `- ${d}`).join("\n")}` : "";
    const hookBlock = hooks.length > 0
      ? `Proven hooks (use one as your opener):\n${hooks.map((h, i) => `${i+1}. ${h}`).join("\n")}` : "";
    const JSON_REMINDER = `IMPORTANT: Return ONLY a raw JSON object. No markdown fences, no preamble. Start with { and end with }.`;

    // ── Fire all 4 Claude calls in PARALLEL ───────────────
    // Cuts wall-clock time from ~90s down to ~20s on free tier.
    logger.info("[Content Writer] Firing all 4 Claude calls in parallel...");

    const [blogSettled, linkedinSettled, twitterSettled, newsletterSettled] =
      await Promise.allSettled([

        // 1. Blog Post
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `You are a content writer for Ascentor, an AI leadership coaching platform for African professionals.

Write a compelling blog post on: "${topic}"
${keyMsgBlock}
${dataBlock}

Requirements:
- Target ambitious African professionals (students to C-suite)
- 600–800 words
- Strong headline, 3–4 subheadings, CTA at the end
- Personal and authoritative tone
- Reference African business context where relevant

${JSON_REMINDER}
{ "title": "...", "content": "Full post in markdown", "meta_description": "160 char SEO desc", "cta": "CTA sentence" }`,
          }],
        }),

        // 2. LinkedIn Posts (5)
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: `You write LinkedIn content for Ascentor — AI coaching for African professionals.

Topic: "${topic}"
${hookBlock}
${dataBlock}

Write 5 LinkedIn posts (4-1-1 rule: 4 value, 1 social proof).
Each: 150–300 words, strong hook first line, line breaks for readability.

${JSON_REMINDER}
{ "posts": [ { "type": "value", "hook": "First line", "content": "Full post" } ] }`,
          }],
        }),

        // 3. Twitter/X Threads (3)
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `You write viral Twitter/X threads for Ascentor — AI leadership coaching for Africa.

Topic: "${topic}"
${hookBlock}

Write 3 threads, each 5–7 tweets. Punchy openers, soft CTA at end.

${JSON_REMINDER}
{ "threads": [ { "opener": "Hook tweet", "tweets": ["t1","t2","t3","t4","t5"], "cta": "CTA tweet" } ] }`,
          }],
        }),

        // 4. Newsletter segment
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `Write a newsletter segment for "The African Leader" — Ascentor's weekly email.

Topic: "${topic}"
400–600 words. Personal, warm, mentor-letter style. No corporate speak.
Structure: Hook → Insight → Practical takeaway → Soft CTA to try Ascentor
${dataBlock}
${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}` : ""}

${JSON_REMINDER}
{ "subject": "...", "preview_text": "90 char preview", "body": "Full body in markdown" }`,
          }],
        }),
      ]);

    // ── Extract results with safe fallbacks ───────────────
    let blog: any = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        blog = extractJSON(raw);
        logger.info(`[Content Writer] Blog ✓ — "${blog.title}"`);
      } catch (e) { logger.error(`[Content Writer] Blog parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Blog API call failed: ${blogSettled.reason}`); }

    let linkedin: any = { posts: [] };
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        linkedin = extractJSON(raw);
        logger.info(`[Content Writer] LinkedIn ✓ — ${linkedin.posts?.length || 0} posts`);
      } catch (e) { logger.error(`[Content Writer] LinkedIn parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] LinkedIn API call failed: ${linkedinSettled.reason}`); }

    let twitter: any = { threads: [] };
    if (twitterSettled.status === "fulfilled") {
      try {
        const raw = twitterSettled.value.content[0].type === "text" ? twitterSettled.value.content[0].text : "";
        twitter = extractJSON(raw);
        logger.info(`[Content Writer] Twitter ✓ — ${twitter.threads?.length || 0} threads`);
      } catch (e) { logger.error(`[Content Writer] Twitter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Twitter API call failed: ${twitterSettled.reason}`); }

    let newsletter: any = { subject: `Newsletter: ${topic}`, preview_text: "", body: "" };
    if (newsletterSettled.status === "fulfilled") {
      try {
        const raw = newsletterSettled.value.content[0].type === "text" ? newsletterSettled.value.content[0].text : "";
        newsletter = extractJSON(raw);
        logger.info(`[Content Writer] Newsletter ✓ — "${newsletter.subject}"`);
      } catch (e) { logger.error(`[Content Writer] Newsletter parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Newsletter API call failed: ${newsletterSettled.reason}`); }

    // ── Build insert rows ─────────────────────────────────
    const now = new Date().toISOString();
    const items = [
      {
        pillar, week, status: "draft", platform: "Website",
        type: "Blog Post",
        title: (blog.title || topic).substring(0, 255),
        content_data: blog,
      },
      ...(linkedin.posts || []).map((p: any, i: number) => ({
        pillar, week, status: "draft", platform: "LinkedIn",
        type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn ${i + 1}`).substring(0, 60)}...`,
        content_data: p,
      })),
      ...(twitter.threads || []).map((t: any, i: number) => ({
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

    // ── Insert one-by-one so a bad row can't kill the batch ──
    let insertedCount = 0;
    for (const item of items) {
      const { error } = await supabase
        .from("content_calendar")
        .insert({ ...item, created_at: now, triggered_by: triggeredBy });

      if (error) {
        logger.error(`[Content Writer] Insert failed for "${item.title}": ${JSON.stringify(error)}`);
      } else {
        insertedCount++;
      }
    }

    logger.info(`[Content Writer] Saved ${insertedCount}/${items.length} rows to content_calendar`);

    const summary = {
      topic, pillar, week,
      generated: {
        blog: 1,
        linkedin_posts: linkedin.posts?.length || 0,
        twitter_threads: twitter.threads?.length || 0,
        newsletter: 1,
      },
      total_items: items.length,
      inserted: insertedCount,
    };

    logger.info("[Content Writer] Done:", summary);
    return summary;
  },
});
