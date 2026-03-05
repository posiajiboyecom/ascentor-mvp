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

export const contentWriterAgent = task({
  id: "content-writer-agent",
  retry: { maxAttempts: 2 },
  run: async (payload: {
    topic: string;
    pillar: "leadership" | "career" | "ai" | "coaching" | "community";
    week?: number;
    triggeredBy?: string;
  }) => {
    const { topic, pillar, week = 1, triggeredBy = "manual" } = payload;

    console.log(`[Content Writer] Starting for topic: "${topic}" | pillar: ${pillar}`);

    // ── 1. Blog Post ──────────────────────────────────────
    const blogRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You are a content writer for Ascentor, an AI leadership coaching platform for African professionals.

Write a compelling blog post on this topic: "${topic}"

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
    } catch { blog = { title: topic, content: "Draft pending review", meta_description: "", cta: "" }; }

    // ── 2. LinkedIn Posts (5) ─────────────────────────────
    const linkedinRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You write LinkedIn content for Ascentor — an AI coaching platform for African professionals.

Topic: "${topic}"

Write 5 LinkedIn posts following the 4-1-1 rule:
- 4 pure value posts (no selling)
- 1 social proof post (community/member success)
- Each post: 150–300 words, strong hook first line, line breaks for readability

Return ONLY valid JSON:
{
  "posts": [
    { "type": "value", "hook": "First line hook", "content": "Full post text" },
    ...
  ]
}`,
      }],
    });

    let linkedin: any = { posts: [] };
    try {
      const liText = linkedinRes.content[0].type === "text" ? linkedinRes.content[0].text : "";
      linkedin = JSON.parse(liText.replace(/```json|```/g, "").trim());
    } catch { linkedin = { posts: [] }; }

    // ── 3. Twitter/X Threads (3) ─────────────────────────
    const twitterRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You write viral Twitter/X threads for Ascentor — AI leadership coaching for Africa.

Topic: "${topic}"

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
    } catch { twitter = { threads: [] }; }

    // ── 4. Newsletter segment ─────────────────────────────
    const newsletterRes = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Write a newsletter segment for "The African Leader" — Ascentor's weekly email.

Topic: "${topic}"
Length: 400–600 words
Style: Personal, warm, like a letter from a mentor. No corporate speak.
Structure: Hook → Insight → Practical takeaway → Soft CTA to try Ascentor

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
    } catch { newsletter = { subject: topic, preview_text: "", body: "" }; }

    // ── 5. Save all to Supabase content_calendar ──────────
    const now = new Date().toISOString();
    const items = [
      { pillar, type: "Blog Post",           title: blog.title || topic,                   platform: "Website",   week, status: "draft", content_data: blog },
      ...(linkedin.posts || []).map((p: any, i: number) => ({
        pillar, type: "LinkedIn Post", title: `${p.hook?.substring(0, 60) || `LinkedIn ${i+1}`}...`,
        platform: "LinkedIn", week, status: "draft", content_data: p,
      })),
      ...(twitter.threads || []).map((t: any, i: number) => ({
        pillar, type: "Twitter Thread", title: `Thread: ${t.opener?.substring(0, 50) || `Thread ${i+1}`}...`,
        platform: "Twitter/X", week, status: "draft", content_data: t,
      })),
      { pillar, type: "Email Newsletter", title: newsletter.subject || `Newsletter: ${topic}`, platform: "Email", week, status: "draft", content_data: newsletter },
    ];

    const { error: insertError } = await supabase
      .from("content_calendar")
      .insert(items.map(item => ({
        ...item,
        created_at: now,
        triggered_by: triggeredBy,
      })));

    if (insertError) console.error("[Content Writer] Supabase insert error:", insertError);

    const summary = {
      topic,
      pillar,
      week,
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
