// ═══════════════════════════════════════════════════════════
// Agent 2: Content Writer
// Triggered automatically after Research Agent completes.
//
// Architecture: Blog-first content repurposing
//   1. Write full blog post (1200–1500 words) — the primary asset
//   2. Derive all social posts FROM the blog (not independently)
//      - 5 LinkedIn posts (key insights extracted from blog)
//      - 3 Twitter/X threads (key arguments from blog)
//      - 1 Newsletter segment (blog summary + CTA)
//
// Fix notes:
//   - Added maxDuration: 300 (5 min) — 4 sequential Claude calls
//     need ~60-90s compute; default timeout was killing the task
//   - Increased max_tokens on blog to 2500 to fit full 1200-word post
//   - Social posts now receive blog content as context so they
//     are coherent extensions of the blog, not disconnected pieces
//   - Robust JSON extraction handles markdown fences and trailing text
// ═══════════════════════════════════════════════════════════
import { task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Safely extract and parse the first JSON object from any Claude response
function extractJSON(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in response");
  return JSON.parse(jsonMatch[0]);
}

export const contentWriterAgent = task({
  id: "content-writer-agent",
  maxDuration: 300, // 5 minutes — needed for 4 sequential Claude calls (~60-90s total compute)
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

    // ── STEP 1: Full Blog Post (primary asset) ────────────
    // This is the source of truth. All social content will be
    // derived from this post to ensure coherence and consistency.
    console.log("[Content Writer] Writing blog post...");
    const blogRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500, // Enough for 1200-1500 word post + JSON wrapper
      messages: [{
        role: "user",
        content: `You are a senior content writer for Ascentor, an AI leadership coaching platform for African professionals.

Write a full, authoritative blog post on: "${topic}"

${keyMessages.length > 0 ? `Core messages to weave throughout:\n${keyMessages.map((m, i) => `${i+1}. ${m}`).join('\n')}\n` : ''}
${dataPoints.length > 0 ? `Real data points to anchor the post:\n${dataPoints.map(d => `- ${d}`).join('\n')}\n` : ''}

Requirements:
- 1200–1500 words (this is the full article, not a summary)
- Target audience: ambitious African professionals aged 25-45 (managers to C-suite)
- Tone: authoritative but warm, like a respected mentor writing to a peer
- Structure: compelling headline → relatable opening story/hook → 3-4 subheadings with substantive insights → practical actionable takeaways → strong closing CTA
- Ground every claim in African business reality (Nigeria, Kenya, Ghana, South Africa)
- No generic "hustle culture" clichés — Ascentor is premium and nuanced

Return ONLY valid JSON with no text before or after:
{
  "title": "Compelling SEO-optimised headline (max 70 chars)",
  "content": "Full blog post in markdown — must be 1200-1500 words",
  "meta_description": "SEO meta description (max 160 chars)",
  "excerpt": "2-sentence teaser for blog listings",
  "cta": "Closing call-to-action sentence linking to Ascentor"
}`,
      }],
    });

    let blog: any = { title: topic, content: "", meta_description: "", excerpt: "", cta: "" };
    try {
      const blogText = blogRes.content[0].type === "text" ? blogRes.content[0].text : "";
      blog = extractJSON(blogText);
      console.log(`[Content Writer] Blog written — title: "${blog.title}", length: ${blog.content?.length || 0} chars`);
    } catch (e: any) {
      console.error("[Content Writer] Blog JSON parse failed:", e.message);
      // Save raw text so we don't lose the content
      const rawText = blogRes.content[0].type === "text" ? blogRes.content[0].text : "";
      blog = { title: topic, content: rawText, meta_description: "", excerpt: "", cta: "" };
    }

    // ── STEP 2: LinkedIn Posts derived from the blog ──────
    // Pass the blog content so LinkedIn posts are coherent
    // extensions of the article, not independently generated pieces.
    console.log("[Content Writer] Writing LinkedIn posts...");
    const linkedinRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `You write LinkedIn content for Ascentor — an AI coaching platform for African professionals.

This week's blog post has just been published:
TITLE: ${blog.title}
CONTENT SUMMARY: ${(blog.content || "").substring(0, 800)}...

${hooks.length > 0 ? `Proven hooks to adapt (use as inspiration, not copy-paste):\n${hooks.map((h, i) => `${i+1}. ${h}`).join('\n')}\n` : ''}

Now write 5 LinkedIn posts that promote and expand on the blog. Follow the 4-1-1 rule:
- Post 1-4: Pure value (extract a key insight, framework, or story from the blog — no selling)
- Post 5: Social proof angle (how an African professional applied this kind of thinking)

Each post: 150-250 words, strong hook as first line, short punchy paragraphs, 3-5 relevant hashtags.

Return ONLY valid JSON:
{
  "posts": [
    { "type": "value", "hook": "First line hook", "content": "Full post text including hashtags" },
    { "type": "value", "hook": "...", "content": "..." },
    { "type": "value", "hook": "...", "content": "..." },
    { "type": "value", "hook": "...", "content": "..." },
    { "type": "social_proof", "hook": "...", "content": "..." }
  ]
}`,
      }],
    });

    let linkedin: any = { posts: [] };
    try {
      const liText = linkedinRes.content[0].type === "text" ? linkedinRes.content[0].text : "";
      linkedin = extractJSON(liText);
      console.log(`[Content Writer] LinkedIn: ${linkedin.posts?.length || 0} posts`);
    } catch (e: any) {
      console.error("[Content Writer] LinkedIn JSON parse failed:", e.message);
    }

    // ── STEP 3: Twitter/X Threads derived from the blog ──
    console.log("[Content Writer] Writing Twitter threads...");
    const twitterRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You write viral Twitter/X threads for Ascentor — AI leadership coaching for Africa.

Source blog post: "${blog.title}"
Key insight to expand: ${(blog.content || "").substring(0, 500)}...

Write 3 Twitter threads, each with 5-7 tweets. Each thread should take ONE argument or insight from the blog and go deeper on it.

Rules:
- Thread opener: punchy, curiosity-driven, stands alone as a great tweet
- Middle tweets: each adds a distinct insight (not padding)
- Final tweet: soft CTA to read the full article on Ascentor
- Max 280 chars per tweet

Return ONLY valid JSON:
{
  "threads": [
    {
      "opener": "First tweet (hook, max 280 chars)",
      "tweets": ["tweet 2", "tweet 3", "tweet 4", "tweet 5"],
      "cta": "Final CTA tweet"
    }
  ]
}`,
      }],
    });

    let twitter: any = { threads: [] };
    try {
      const twText = twitterRes.content[0].type === "text" ? twitterRes.content[0].text : "";
      twitter = extractJSON(twText);
      console.log(`[Content Writer] Twitter: ${twitter.threads?.length || 0} threads`);
    } catch (e: any) {
      console.error("[Content Writer] Twitter JSON parse failed:", e.message);
    }

    // ── STEP 4: Newsletter derived from the blog ──────────
    console.log("[Content Writer] Writing newsletter...");
    const newsletterRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `Write the weekly "The African Leader" newsletter edition based on this week's blog post.

Blog title: "${blog.title}"
Blog excerpt: ${blog.excerpt || (blog.content || "").substring(0, 300)}

${dataPoints.length > 0 ? `Key data points to anchor the insight:\n${dataPoints.map(d => `- ${d}`).join('\n')}\n` : ''}
${hooks.length > 2 ? `Subject line inspiration: ${hooks[2]}\n` : ''}

The newsletter should:
- 400-500 words
- Feel like a personal letter from a mentor, not a corporate email
- Structure: Warm personal opening → the core insight (from blog) → one practical takeaway readers can use TODAY → soft CTA to try Ascentor's AI coach
- End with a first-name sign-off ("— Gregory" or similar)

Return ONLY valid JSON:
{
  "subject": "Email subject line (max 60 chars, no clickbait)",
  "preview_text": "Email preview text (max 90 chars)",
  "body": "Full newsletter in markdown (400-500 words)"
}`,
      }],
    });

    let newsletter: any = { subject: topic, preview_text: "", body: "" };
    try {
      const nlText = newsletterRes.content[0].type === "text" ? newsletterRes.content[0].text : "";
      newsletter = extractJSON(nlText);
      console.log(`[Content Writer] Newsletter written — subject: "${newsletter.subject}"`);
    } catch (e: any) {
      console.error("[Content Writer] Newsletter JSON parse failed:", e.message);
    }

    // ── STEP 5: Save all to Supabase content_calendar ─────
    const now = new Date().toISOString();
    const items = [
      {
        pillar, type: "Blog Post",
        title: blog.title || topic,
        platform: "Website", week, status: "draft",
        content_data: blog,
      },
      ...(linkedin.posts || []).map((p: any, i: number) => ({
        pillar, type: "LinkedIn Post",
        title: `${(p.hook || `LinkedIn post ${i + 1}`).substring(0, 80)}`,
        platform: "LinkedIn", week, status: "draft",
        content_data: p,
      })),
      ...(twitter.threads || []).map((t: any, i: number) => ({
        pillar, type: "Twitter Thread",
        title: `Thread: ${(t.opener || `Thread ${i + 1}`).substring(0, 60)}`,
        platform: "Twitter/X", week, status: "draft",
        content_data: t,
      })),
      {
        pillar, type: "Email Newsletter",
        title: newsletter.subject || `Newsletter: ${topic}`,
        platform: "Email", week, status: "draft",
        content_data: newsletter,
      },
    ];

    const { error: insertError } = await supabase
      .from("content_calendar")
      .insert(items.map(item => ({
        ...item,
        created_at: now,
        triggered_by: triggeredBy,
        brief_id: payload.briefId || null,
      })));

    if (insertError) {
      console.error("[Content Writer] Supabase insert error:", insertError.message);
    } else {
      console.log(`[Content Writer] Saved ${items.length} items to content_calendar`);
    }

    const summary = {
      topic,
      pillar,
      week,
      briefId: payload.briefId,
      generated: {
        blog: 1,
        linkedin_posts: linkedin.posts?.length || 0,
        twitter_threads: twitter.threads?.length || 0,
        newsletter: 1,
      },
      total_items: items.length,
      blog_title: blog.title,
    };

    console.log("[Content Writer] Complete:", summary);
    return summary;
  },
});
