// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer
// Triggered manually or after Research Agent completes.
// Uses Claude to write: 1 blog post, 5 LinkedIn posts,
// 3 Twitter threads, 1 newsletter segment.
// Saves all output to content_calendar in Supabase.
//
// RATE LIMIT FIXES:
//   1. claudeWithRetry() wraps every API call with exponential backoff
//   2. 2s delay between each of the 4 Claude calls to avoid burst
//   3. Input payloads (hooks, keyMessages, dataPoints) are truncated
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
  params: Anthropic.MessageCreateParamsNonStreaming,
  retries = 3
): Promise<Anthropic.Message> {
  for (let i = 0; i < retries; i++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.error?.type === "rate_limit_error";
      if (is429 && i < retries - 1) {
        const wait = Math.pow(2, i + 1) * 1500; // 3s → 6s → 12s
        console.warn(`[Content Writer] Rate limited. Retrying in ${wait}ms (attempt ${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error("claudeWithRetry: exhausted retries");
}

// ── Small delay helper to pace sequential calls ───────────────
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Truncate helper to cap injected context tokens ───────────
const truncate = (str: string, maxChars: number) =>
  str.length > maxChars ? str.slice(0, maxChars) + "…" : str;

export const contentWriterAgent = task({
  id: "content-writer-agent",
  retry: { maxAttempts: 2 },
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
      topic,
      pillar,
      week = 1,
      triggeredBy = "manual",
      hooks = [],
      keyMessages = [],
      dataPoints = [],
    } = payload;

    if (payload.briefId) {
      console.log(`[Content Writer] Received brief from Researcher — briefId: ${payload.briefId}`);
    }
    console.log(`[Content Writer] Starting — topic: "${topic}" | pillar: ${pillar} | from: ${triggeredBy}`);

    // Truncate injected context to keep input tokens in check
    const safeHooks        = hooks.slice(0, 3).map((h) => truncate(h, 120));
    const safeKeyMessages  = keyMessages.slice(0, 3).map((m) => truncate(m, 120));
    const safeDataPoints   = dataPoints.slice(0, 3).map((d) => truncate(d, 150));

    const hooksBlock        = safeHooks.length > 0
      ? `Use one of these proven hooks as the opening line:\n${safeHooks.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "";
    const messagesBlock     = safeKeyMessages.length > 0
      ? `Key messages to weave in:\n${safeKeyMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
      : "";
    const dataBlock         = safeDataPoints.length > 0
      ? `Data points to include:\n${safeDataPoints.map((d) => `- ${d}`).join("\n")}`
      : "";

    // ── 1. Blog Post ──────────────────────────────────────────
    console.log("[Content Writer] Writing blog post...");
    const blogRes = await claudeWithRetry({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You are a content writer for Ascentor, an AI leadership coaching platform for African professionals.

Write a compelling blog post on this topic: "${topic}"

${messagesBlock}
${dataBlock}

The post should:
- Target ambitious African professionals (students to C-suite)
- Be 600–800 words
- Have a strong headline, 3–4 subheadings, and a CTA at the end
- Feel personal and authoritative, not generic
- Reference African business context where relevant

Return ONLY valid JSON:
{
  "title": "Post headline",
  "content": "Full blog post in markdown",
  "meta_description": "160 char SEO description",
  "cta": "Call-to-action sentence"
}`,
      }],
    });

    let blog: any = {};
    try {
      const blogText = blogRes.content[0].type === "text" ? blogRes.content[0].text : "";
      blog = JSON.parse(blogText.replace(/```json|```/g, "").trim());
    } catch {
      blog = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    }

    // ── Pause before next call ─────────────────────────────────
    await pause(2000);

    // ── 2. LinkedIn Posts (5) ─────────────────────────────────
    console.log("[Content Writer] Writing LinkedIn posts...");
    const linkedinRes = await claudeWithRetry({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You write LinkedIn content for Ascentor — an AI coaching platform for African professionals.

Topic: "${topic}"

${hooksBlock}
${dataBlock}

Write 5 LinkedIn posts following the 4-1-1 rule:
- 4 pure value posts (no selling)
- 1 social proof post (community/member success)
- Each post: 150–300 words, strong hook first line, line breaks for readability

Return ONLY valid JSON:
{
  "posts": [
    { "type": "value", "hook": "First line hook", "content": "Full post text" }
  ]
}`,
      }],
    });

    let linkedin: any = { posts: [] };
    try {
      const liText = linkedinRes.content[0].type === "text" ? linkedinRes.content[0].text : "";
      linkedin = JSON.parse(liText.replace(/```json|```/g, "").trim());
    } catch {
      linkedin = { posts: [] };
    }

    // ── Pause before next call ─────────────────────────────────
    await pause(2000);

    // ── 3. Twitter/X Threads (3) ─────────────────────────────
    console.log("[Content Writer] Writing Twitter threads...");
    const twitterRes = await claudeWithRetry({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You write viral Twitter/X threads for Ascentor — AI leadership coaching for Africa.

Topic: "${topic}"

${hooksBlock}

Write 3 Twitter threads, each 5–7 tweets.
Make thread openers punchy and curiosity-driven.
End each thread with a soft CTA.

Return ONLY valid JSON:
{
  "threads": [
    {
      "opener": "First tweet (hook)",
      "tweets": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"],
      "cta": "Last tweet CTA"
    }
  ]
}`,
      }],
    });

    let twitter: any = { threads: [] };
    try {
      const twText = twitterRes.content[0].type === "text" ? twitterRes.content[0].text : "";
      twitter = JSON.parse(twText.replace(/```json|```/g, "").trim());
    } catch {
      twitter = { threads: [] };
    }

    // ── Pause before next call ─────────────────────────────────
    await pause(2000);

    // ── 4. Newsletter segment ─────────────────────────────────
    console.log("[Content Writer] Writing newsletter segment...");
    const newsletterRes = await claudeWithRetry({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Write a newsletter segment for "The African Leader" — Ascentor's weekly email.

Topic: "${topic}"
Length: 400–600 words
Style: Personal, warm, like a letter from a mentor. No corporate speak.
Structure: Hook → Insight → Practical takeaway → Soft CTA to try Ascentor

${dataBlock}
${safeHooks.length > 2 ? `Subject line inspiration: ${safeHooks[2]}` : ""}

Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "preview_text": "Email preview text (90 chars)",
  "body": "Full newsletter body in markdown"
}`,
      }],
    });

    let newsletter: any = {};
    try {
      const nlText = newsletterRes.content[0].type === "text" ? newsletterRes.content[0].text : "";
      newsletter = JSON.parse(nlText.replace(/```json|```/g, "").trim());
    } catch {
      newsletter = { subject: topic, preview_text: "", body: "" };
    }

    // ── 5. Save all to Supabase content_calendar ──────────────
    const now = new Date().toISOString();
    const items = [
      { pillar, type: "Blog Post",       title: blog.title || topic,                            platform: "Website",  week, status: "draft", content_data: blog },
      ...(linkedin.posts || []).map((p: any, i: number) => ({
        pillar, type: "LinkedIn Post",   title: `${p.hook?.substring(0, 60) || `LinkedIn ${i + 1}`}...`,
        platform: "LinkedIn",  week, status: "draft", content_data: p,
      })),
      ...(twitter.threads || []).map((t: any, i: number) => ({
        pillar, type: "Twitter Thread",  title: `Thread: ${t.opener?.substring(0, 50) || `Thread ${i + 1}`}...`,
        platform: "Twitter/X", week, status: "draft", content_data: t,
      })),
      { pillar, type: "Email Newsletter", title: newsletter.subject || `Newsletter: ${topic}`, platform: "Email",    week, status: "draft", content_data: newsletter },
    ];

    const { error: insertError } = await supabase
      .from("content_calendar")
      .insert(items.map((item) => ({ ...item, created_at: now, triggered_by: triggeredBy })));

    if (insertError) console.error("[Content Writer] Supabase insert error:", insertError);

    const summary = {
      topic,
      pillar,
      week,
      generated: {
        blog:             1,
        linkedin_posts:   linkedin.posts?.length || 0,
        twitter_threads:  twitter.threads?.length || 0,
        newsletter:       1,
      },
      total_items: items.length,
    };

    console.log("[Content Writer] Done:", summary);
    return summary;
  },
});
