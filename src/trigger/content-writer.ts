// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer
// Triggered manually or after Research Agent completes.
// Uses Claude to write: 1 blog post, 5 LinkedIn posts,
// 3 Twitter threads, 1 newsletter segment.
// Saves all output to content_calendar in Supabase.
// ═══════════════════════════════════════════════════════════
import { task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIN_DELAY_MS = 8_000; // 8 s between calls

// ── Rate-limit-safe Claude caller ────────────────────────────
async function claudeWithRetry(
  fn: () => Promise<Anthropic.Message>,
  label: string,
  maxAttempts = 4
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.error?.type === "rate_limit_error";
      if (is429 && attempt < maxAttempts) {
        const retryAfter = err?.headers?.["retry-after"];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(15_000 * Math.pow(2, attempt - 1), 120_000);
        console.warn(`[${label}] Rate limited (attempt ${attempt}/${maxAttempts}). Waiting ${waitMs / 1000}s…`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[${label}] Exhausted ${maxAttempts} attempts`);
}

async function claudeChat(prompt: string, maxTokens: number, label: string): Promise<string> {
  const res = await claudeWithRetry(
    () => anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
    label
  );
  const block = res.content[0];
  return block.type === "text" ? block.text : "";
}

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 300,
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
    const { topic, pillar, week = 1, triggeredBy = "manual", hooks = [], keyMessages = [], dataPoints = [] } = payload;

    if (payload.briefId) {
      console.log(`[Content Writer] Received brief from Researcher — briefId: ${payload.briefId}`);
    }
    console.log(`[Content Writer] Starting — topic: "${topic}" | pillar: ${pillar} | from: ${triggeredBy}`);

    const keyMsgsBlock = keyMessages.length > 0
      ? `Key messages to weave in:\n${keyMessages.map((m, i) => `${i+1}. ${m}`).join("\n")}`
      : "";
    const dataBlock = dataPoints.length > 0
      ? `Data points to include:\n${dataPoints.map(d => `- ${d}`).join("\n")}`
      : "";
    const hooksBlock = hooks.length > 0
      ? `Use one of these proven hooks as the opening line for your best post:\n${hooks.map((h, i) => `${i+1}. ${h}`).join("\n")}`
      : "";

    // ── 1. Blog Post ──────────────────────────────────────
    const blogText = await claudeChat(
      `You are a content writer for Ascentor, an AI leadership coaching platform for African professionals.\n\n` +
      `Write a compelling blog post on this topic: "${topic}"\n\n` +
      `${keyMsgsBlock}\n${dataBlock}\n\n` +
      `The post should:\n` +
      `- Target ambitious African professionals (students to C-suite)\n` +
      `- Be 600–800 words\n` +
      `- Have a strong headline, 3–4 subheadings, and a CTA at the end\n` +
      `- Feel personal and authoritative, not generic\n` +
      `- Reference African business context where relevant\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "title": "Post headline",\n  "content": "Full blog post in markdown",\n  "meta_description": "160 char SEO description",\n  "cta": "Call-to-action sentence"\n}`,
      1500,
      "blog"
    );

    let blog: any = { title: topic, content: "Draft pending review", meta_description: "", cta: "" };
    try { blog = JSON.parse(blogText.replace(/```json|```/g, "").trim()); } catch {}

    // ── 2. LinkedIn Posts (5) ─────────────────────────────
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS));

    const liText = await claudeChat(
      `You write LinkedIn content for Ascentor — an AI coaching platform for African professionals.\n\n` +
      `Topic: "${topic}"\n\n` +
      `${hooksBlock}\n${dataBlock}\n\n` +
      `Write 5 LinkedIn posts following the 4-1-1 rule:\n` +
      `- 4 pure value posts (no selling)\n` +
      `- 1 social proof post (community/member success)\n` +
      `- Each post: 150–300 words, strong hook first line, line breaks for readability\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "posts": [\n    { "type": "value", "hook": "First line hook", "content": "Full post text" }\n  ]\n}`,
      1200,
      "linkedin"
    );

    let linkedin: any = { posts: [] };
    try { linkedin = JSON.parse(liText.replace(/```json|```/g, "").trim()); } catch {}

    // ── 3. Twitter/X Threads (3) ─────────────────────────
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS));

    const twText = await claudeChat(
      `You write viral Twitter/X threads for Ascentor — AI leadership coaching for Africa.\n\n` +
      `Topic: "${topic}"\n\n` +
      `${hooksBlock}\n\n` +
      `Write 3 Twitter threads, each 5–7 tweets.\n` +
      `Make thread openers punchy and curiosity-driven.\n` +
      `End each thread with a soft CTA.\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "threads": [\n    {\n      "opener": "First tweet (hook)",\n      "tweets": ["tweet 1", "tweet 2", "tweet 3", "tweet 4", "tweet 5"],\n      "cta": "Last tweet CTA"\n    }\n  ]\n}`,
      1000,
      "twitter"
    );

    let twitter: any = { threads: [] };
    try { twitter = JSON.parse(twText.replace(/```json|```/g, "").trim()); } catch {}

    // ── 4. Newsletter segment ─────────────────────────────
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS));

    const nlText = await claudeChat(
      `Write a newsletter segment for "The African Leader" — Ascentor's weekly email.\n\n` +
      `Topic: "${topic}"\n` +
      `Length: 400–600 words\n` +
      `Style: Personal, warm, like a letter from a mentor. No corporate speak.\n` +
      `Structure: Hook → Insight → Practical takeaway → Soft CTA to try Ascentor\n\n` +
      `${dataBlock}\n` +
      `${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}` : ""}\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "subject": "Email subject line",\n  "preview_text": "Email preview text (90 chars)",\n  "body": "Full newsletter body in markdown"\n}`,
      800,
      "newsletter"
    );

    let newsletter: any = { subject: topic, preview_text: "", body: "" };
    try { newsletter = JSON.parse(nlText.replace(/```json|```/g, "").trim()); } catch {}

    // ── 5. Save all to Supabase content_calendar ──────────
    const now = new Date().toISOString();
    const items = [
      { pillar, type: "Blog Post",       title: blog.title || topic,                                platform: "Website",   week, status: "draft", content_data: blog },
      ...(linkedin.posts || []).map((p: any, i: number) => ({
        pillar, type: "LinkedIn Post",   title: `${p.hook?.substring(0, 60) || `LinkedIn ${i+1}`}...`, platform: "LinkedIn",  week, status: "draft", content_data: p,
      })),
      ...(twitter.threads || []).map((t: any, i: number) => ({
        pillar, type: "Twitter Thread",  title: `Thread: ${t.opener?.substring(0, 50) || `Thread ${i+1}`}...`, platform: "Twitter/X", week, status: "draft", content_data: t,
      })),
      { pillar, type: "Email Newsletter", title: newsletter.subject || `Newsletter: ${topic}`,      platform: "Email",     week, status: "draft", content_data: newsletter },
    ];

    const { error: insertError } = await supabase
      .from("content_calendar")
      .insert(items.map(item => ({ ...item, created_at: now, triggered_by: triggeredBy })));

    if (insertError) console.error("[Content Writer] Supabase insert error:", insertError);

    const summary = {
      topic, pillar, week,
      generated: {
        blog: 1,
        linkedin_posts: linkedin.posts?.length || 0,
        twitter_threads: twitter.threads?.length || 0,
        newsletter: 1,
      },
      total_items: items.length,
    };

    console.log("[Content Writer] Done:", summary);
    return summary;
  },
});
