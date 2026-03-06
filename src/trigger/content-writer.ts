// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer — FREE TIER EDITION v5
// Root cause of Blog/LinkedIn parse failures:
//   The model writes markdown with literal newlines inside JSON
//   string values, making the JSON invalid. Fix: use JSON5-style
//   repair to escape control chars before parsing, AND tell the
//   model to use \n instead of real newlines in string fields.
// ═══════════════════════════════════════════════════════════
import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { type AudiencePreset, AUDIENCE_META } from "./content-researcher";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Robust JSON extractor ──────────────────────────────────
// Handles: markdown fences, literal newlines inside string values,
// truncated responses, and outermost-brace extraction.
function extractJSON(raw: string): any {
  // 1. Strip markdown fences
  let text = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // 2. Direct parse (works if model behaved)
  try { return JSON.parse(text); } catch { /* continue */ }

  // 3. Fix literal newlines/tabs inside JSON string values then retry.
  //    Walks char-by-char: inside a string, replace bare \n \r \t with \\n \\r \\t
  function repairJSON(s: string): string {
    let result = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { result += ch; escape = false; continue; }
      if (ch === "\\") { escape = true; result += ch; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString) {
        if      (ch === "\n") { result += "\\n";  continue; }
        else if (ch === "\r") { result += "\\r";  continue; }
        else if (ch === "\t") { result += "\\t";  continue; }
      }
      result += ch;
    }
    return result;
  }

  try { return JSON.parse(repairJSON(text)); } catch { /* continue */ }

  // 4. Find outermost { } or [ ] and retry both raw and repaired
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
      const slice = text.slice(start, lastClose + 1);
      try { return JSON.parse(slice); } catch { /* continue */ }
      try { return JSON.parse(repairJSON(slice)); } catch { /* continue */ }
    }
  }

  // 5. Truncation recovery: response was cut mid-stream.
  //    Find the last complete object in an array and close it off.
  //    e.g. { "posts": [ {...}, {...}, {  <-- truncated here
  //    Strategy: find the last well-formed } before truncation, close the array + object.
  const arrayStart = text.indexOf("[");
  if (arrayStart !== -1) {
    // Walk backwards from end to find the last complete item boundary
    const lastCompleteClose = (() => {
      let depth = 0;
      let lastGoodClose = -1;
      for (let i = arrayStart; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") {
          depth--;
          if (depth === 0) lastGoodClose = i;
        }
      }
      return lastGoodClose;
    })();

    if (lastCompleteClose > arrayStart) {
      // Reconstruct: take everything up to last complete item, close array + object
      const truncated = text.slice(0, lastCompleteClose + 1);
      // Find key name before the array to wrap correctly: e.g. "posts" or "threads"
      const keyMatch = text.slice(0, arrayStart).match(/"(\w+)"\s*:\s*\[?\s*$/);
      const recovered = keyMatch
        ? `{ "${keyMatch[1]}": [${truncated.slice(truncated.indexOf("[") + 1)}] }`
        : `{ "items": [${truncated.slice(truncated.indexOf("[") + 1)}] }`;
      try { return JSON.parse(recovered); } catch { /* continue */ }
      try { return JSON.parse(repairJSON(recovered)); } catch { /* continue */ }
    }
  }

  throw new Error(`Could not parse JSON. Raw: ${raw.slice(0, 120)}`);
}

// System prompt — hard constraint on JSON format
const SYSTEM =
  "You are a JSON API. Respond with ONLY a valid raw JSON object. " +
  "Never use markdown code fences. Never add text before or after the JSON. " +
  "Your response must begin with { and end with }. " +
  "CRITICAL: Inside JSON string values, represent newlines as the two characters \\n (backslash + n), " +
  "never as actual line breaks. All string values must be on one line.";

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
    audience?: AudiencePreset;
  }) => {
    const {
      topic, pillar, week = 1,
      hooks = [], keyMessages = [], dataPoints = [],
      audience = 'general',
    } = payload;

    const audienceMeta = AUDIENCE_META[audience];
    const voiceBlock = `Audience: ${audienceMeta.label} (${audienceMeta.ageRange} year olds).\n${audienceMeta.writerVoice}`;

    if (payload.briefId) logger.info(`[Content Writer] briefId: ${payload.briefId}`);
    logger.info(`[Content Writer] Starting — "${topic}" | ${pillar}`);

    const keyMsgBlock = keyMessages.length > 0
      ? `Key messages:\n${keyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}` : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points:\n${dataPoints.map(d => `- ${d}`).join("\n")}` : "";
    const hookBlock = hooks.length > 0
      ? `Hooks (use one as opener):\n${hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : "";

    logger.info("[Content Writer] Firing all 4 Claude calls in parallel...");

    const [blogSettled, linkedinSettled, twitterSettled, newsletterSettled] =
      await Promise.allSettled([

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write a blog post for Ascentor (AI leadership coaching for African professionals).
${voiceBlock}
Topic: "${topic}"
${keyMsgBlock}
${dataBlock}
600-800 words. Strong headline, 3-4 subheadings, CTA at end. African business context.
Use \\n for line breaks inside the content string.
Return: { "title": "...", "content": "markdown with \\n line breaks", "meta_description": "160 char", "cta": "..." }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3000,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write LinkedIn posts for Ascentor (AI coaching for African professionals).
${voiceBlock}
Topic: "${topic}"
${hookBlock}
${dataBlock}
3 posts (2 value, 1 social proof). 150-200 words each. Use \\n for line breaks.
Return: { "posts": [ { "type": "value", "hook": "first line", "content": "post with \\n breaks" } ] }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write Twitter/X threads for Ascentor (AI leadership coaching for Africa).
${voiceBlock}
Topic: "${topic}"
${hookBlock}
2 threads, 5 tweets each. Punchy openers, soft CTA at end.
Return: { "threads": [ { "opener": "hook", "tweets": ["t1","t2","t3","t4","t5"], "cta": "cta" } ] }`,
          }],
        }),

        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          system: SYSTEM,
          messages: [{
            role: "user",
            content: `Write a newsletter for "The African Leader" (Ascentor weekly email).
${voiceBlock}
Topic: "${topic}"
400-600 words. Warm mentor-letter style. Structure: Hook, Insight, Takeaway, Soft CTA.
${dataBlock}
${hooks.length > 2 ? `Subject inspiration: ${hooks[2]}` : ""}
Use \\n for line breaks inside the body string.
Return: { "subject": "...", "preview_text": "90 chars max", "body": "markdown with \\n breaks" }`,
          }],
        }),
      ]);

    // ── Extract with fallbacks ────────────────────────────
    let blog: any = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    if (blogSettled.status === "fulfilled") {
      try {
        const raw = blogSettled.value.content[0].type === "text" ? blogSettled.value.content[0].text : "";
        logger.info(`[Content Writer] Blog raw (first 300): ${raw.slice(0, 300)}`);
        blog = extractJSON(raw);
        logger.info(`[Content Writer] Blog ok — "${blog.title}"`);
      } catch (e) { logger.error(`[Content Writer] Blog parse failed: ${e}`); }
    } else { logger.error(`[Content Writer] Blog API error: ${blogSettled.reason}`); }

    let linkedinPosts: any[] = [];
    if (linkedinSettled.status === "fulfilled") {
      try {
        const raw = linkedinSettled.value.content[0].type === "text" ? linkedinSettled.value.content[0].text : "";
        logger.info(`[Content Writer] LinkedIn raw (first 300): ${raw.slice(0, 300)}`);
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

    // ── Build rows — only real table columns ──────────────
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
        logger.error(`[Content Writer] Insert failed "${item.title}": ${JSON.stringify(error)}`);
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
