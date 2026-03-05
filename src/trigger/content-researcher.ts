// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher
// Runs every Monday at 06:00 WAT (05:00 UTC).
// Pipeline:
//   1. Claude web_search → trending topics + news for Africa
//   2. Claude web_search → deep research on the best topic
//   3. Claude            → synthesise into structured content brief
//   4. Supabase          → save brief
//   5. Auto-trigger Content Writer agent
//
// RATE LIMIT FIXES:
//   1. claudeWithRetry() wraps every API call with exponential backoff
//   2. deepResearch output is truncated to 3,000 chars before injection
//      into buildContentBrief (was unbounded — could spike 5k+ input tokens)
//   3. pause() between web-search calls to spread token usage over time
// ═══════════════════════════════════════════════════════════

import { schedules, tasks } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PILLAR_ROTATION = [
  "leadership",
  "career",
  "ai",
  "coaching",
  "community",
] as const;

type Pillar = typeof PILLAR_ROTATION[number];

// ── Small delay helper ────────────────────────────────────────
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
        console.warn(`[Researcher] Rate limited. Retrying in ${wait}ms (attempt ${i + 1}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
  throw new Error("claudeWithRetry: exhausted retries");
}

// ── Helper: call Claude with web search and extract all text ──
async function claudeWebSearch(prompt: string, maxTokens = 2000): Promise<string> {
  const response = await claudeWithRetry({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}

// ── Step 1: Discover what is trending this week ───────────────
async function discoverTrends(pillar: Pillar): Promise<{
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
}> {
  const pillarContext: Record<Pillar, string> = {
    leadership: "African leadership, management styles, executive development",
    career:     "career growth, job market, salaries, promotions in Africa",
    ai:         "AI tools, tech jobs, automation impact in Africa",
    coaching:   "executive coaching, mentorship, personal development in Africa",
    community:  "professional networking, peer learning, alumni communities in Africa",
  };

  const raw = await claudeWebSearch(
    `Search the web for what is trending RIGHT NOW this week in "${pillarContext[pillar]}" — ` +
    `specifically in Nigeria, Ghana, Kenya, and South Africa. ` +
    `Also find top news stories and any viral LinkedIn or Twitter conversations about this topic among African professionals.\n\n` +
    `Return ONLY a JSON object in this exact format (no markdown, no explanation):\n` +
    `{\n` +
    `  "trends": ["trending topic 1", "trending topic 2", "trending topic 3"],\n` +
    `  "news": [\n` +
    `    { "title": "headline", "snippet": "one sentence summary" }\n` +
    `  ],\n` +
    `  "summary": "2-3 sentence overview of what is hot this week for African professionals in this space"\n` +
    `}`
  );

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    console.log(`[Researcher] Trends found: ${parsed.trends?.length || 0}, news: ${parsed.news?.length || 0}`);
    return {
      trends:  parsed.trends  || [],
      news:    parsed.news    || [],
      summary: parsed.summary || raw,
    };
  } catch {
    console.warn("[Researcher] Trends response was prose — using as summary");
    return { trends: [], news: [], summary: raw };
  }
}

// ── Step 2: Deep research on the chosen topic ─────────────────
async function deepResearch(topic: string, pillar: Pillar): Promise<string> {
  const raw = await claudeWebSearch(
    `You are a research assistant for Ascentor, an AI coaching platform for ambitious African professionals.\n\n` +
    `Do deep web research on this topic: "${topic}"\n\n` +
    `Find and synthesise:\n` +
    `1. Why this is important or trending for African professionals RIGHT NOW — cite specific recent events\n` +
    `2. Key statistics and data points with sources (African data preferred)\n` +
    `3. Real examples from African companies, leaders, or professionals\n` +
    `4. The biggest pain points or misconceptions professionals have about this\n` +
    `5. The freshest angles or contrarian takes circulating this week\n\n` +
    `Be specific. Name real companies, people, and events. Prioritise African sources and context.`,
    2000 // reduced from 2500
  );

  console.log(`[Researcher] Deep research: ${raw.length} chars`);
  return raw;
}

// ── Step 3: Build the final content brief ─────────────────────
async function buildContentBrief(params: {
  pillar: Pillar;
  weekNumber: number;
  trendSummary: string;
  trends: string[];
  news: { title: string; snippet: string }[];
  research: string;
}): Promise<{
  chosenTopic:         string;
  angle:               string;
  pillar:              Pillar;
  targetAudience:      string;
  keyMessages:         string[];
  hooks:               string[];
  dataPoints:          string[];
  competitorGaps:      string[];
  contentFormats:      string[];
  seoKeywords:         string[];
  estimatedEngagement: string;
  urgencyReason:       string;
}> {
  // ── FIX: truncate deep research before injection ─────────────
  // The raw research string can be 4,000–8,000 chars (~1,500–3,000 tokens).
  // Capping at 3,000 chars keeps the full prompt under ~1,500 input tokens.
  const truncatedResearch = params.research.length > 3000
    ? params.research.slice(0, 3000) + "\n[…truncated for brevity]"
    : params.research;

  // Also cap news to 5 items to keep the prompt lean
  const topNews = params.news.slice(0, 5);

  const prompt =
    `You are a senior content strategist for Ascentor — an AI leadership coaching platform ` +
    `for ambitious African professionals (students to C-suite, aged 22-45, ` +
    `Nigeria, Ghana, Kenya, South Africa).\n\n` +
    `This week's content pillar: ${params.pillar}\n` +
    `Week number: ${params.weekNumber}\n\n` +
    `=== TREND SUMMARY ===\n${params.trendSummary}\n\n` +
    `=== TRENDING TOPICS ===\n${params.trends.join(", ") || "None captured"}\n\n` +
    `=== NEWS HEADLINES ===\n` +
    `${topNews.map((n) => `- ${n.title}: ${n.snippet}`).join("\n") || "None captured"}\n\n` +
    `=== DEEP RESEARCH (summarised) ===\n${truncatedResearch}\n\n` +
    `---\n` +
    `Choose the ONE best topic to write about this week that:\n` +
    `1. Fits the ${params.pillar} pillar\n` +
    `2. Is timely for African professionals right now\n` +
    `3. Has real substance — not generic advice\n` +
    `4. Will drive shares and signups for Ascentor\n\n` +
    `Return ONLY valid JSON, no markdown:\n` +
    `{\n` +
    `  "chosenTopic": "Specific punchy topic title (max 12 words)",\n` +
    `  "angle": "What makes our take different from generic content on this topic",\n` +
    `  "pillar": "${params.pillar}",\n` +
    `  "targetAudience": "Specific persona e.g. Mid-level managers at Nigerian fintechs",\n` +
    `  "keyMessages": ["message 1", "message 2", "message 3"],\n` +
    `  "hooks": ["LinkedIn hook", "Twitter hook", "Email subject line"],\n` +
    `  "dataPoints": ["Specific stat or fact with source", "Another data point"],\n` +
    `  "competitorGaps": ["What generic content misses that we will cover"],\n` +
    `  "contentFormats": ["Blog Post", "LinkedIn Post", "Twitter Thread", "Newsletter"],\n` +
    `  "seoKeywords": ["primary keyword", "secondary keyword", "long-tail keyword"],\n` +
    `  "estimatedEngagement": "Why this will resonate this week",\n` +
    `  "urgencyReason": "Why publish this now vs later"\n` +
    `}`;

  const res = await claudeWithRetry({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0].type === "text" ? res.content[0].text : "";

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    console.error("[Researcher] Failed to parse brief JSON:", text.substring(0, 200));
    return {
      chosenTopic:         `African ${params.pillar} insights ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
      angle:               "Practical frameworks rooted in African context",
      pillar:              params.pillar,
      targetAudience:      "Ambitious African professionals aged 25-40",
      keyMessages:         ["Lead with authenticity", "Build systems not just habits", "Community accelerates growth"],
      hooks:               ["What no one tells you about leadership in Africa", "The mistake costing African professionals promotions", "Why African professionals need a different playbook"],
      dataPoints:          ["Africa has the world's youngest workforce — 60% under 25"],
      competitorGaps:      ["Western frameworks ignore African organisational culture"],
      contentFormats:      ["Blog Post", "LinkedIn Post", "Twitter Thread", "Newsletter"],
      seoKeywords:         [`African ${params.pillar}`, `${params.pillar} Africa`, "professional development Nigeria"],
      estimatedEngagement: "Consistently high-performing content pillar for our audience",
      urgencyReason:       "Weekly publishing cadence builds audience trust and SEO authority",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN TASK
// ═══════════════════════════════════════════════════════════
export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Every Monday 05:00 UTC = 06:00 WAT
  maxDuration: 180,
  run: async () => {
    console.log("[Researcher] Starting weekly research...");

    const now = new Date();
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
    );
    const pillar = PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
    console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar}`);

    // Step 1 — Trends + news discovery
    const { trends, news, summary: trendSummary } = await discoverTrends(pillar);

    // ── Pause before second web-search call ───────────────
    await pause(3000);

    // Step 2 — Deep research on the strongest trend
    const pillarFallback: Record<Pillar, string> = {
      leadership: "African leadership trends 2025",
      career:     "career growth Africa professionals 2025",
      ai:         "AI impact African jobs and workforce 2025",
      coaching:   "executive coaching Africa 2025",
      community:  "African professional networking 2025",
    };
    const researchTopic = trends[0] || pillarFallback[pillar];
    const research = await deepResearch(researchTopic, pillar);

    // ── Pause before synthesis call ───────────────────────
    await pause(3000);

    // Step 3 — Synthesise the content brief (research is truncated inside)
    const brief = await buildContentBrief({ pillar, weekNumber, trendSummary, trends, news, research });
    console.log(`[Researcher] Brief: "${brief.chosenTopic}"`);

    // Step 4 — Save to Supabase
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({
        week_number:  weekNumber,
        pillar,
        topic:        brief.chosenTopic,
        angle:        brief.angle,
        brief_data:   brief,
        trends_raw:   trends,
        news_raw:     news,
        research_raw: research,
        status:       "ready",
        created_at:   now.toISOString(),
      })
      .select("id")
      .single();

    if (error) console.error("[Researcher] Supabase error:", error);

    // Step 5 — Auto-trigger Content Writer
    const writerHandle = await tasks.trigger("content-writer-agent", {
      topic:       brief.chosenTopic,
      pillar,
      week:        weekNumber,
      triggeredBy: `researcher-agent:week-${weekNumber}`,
      briefId:     savedBrief?.id || null,
      hooks:       brief.hooks,
      keyMessages: brief.keyMessages,
      dataPoints:  brief.dataPoints,
    });

    console.log(`[Researcher] Content Writer triggered — run: ${writerHandle.id}`);

    return {
      success:            true,
      week:               weekNumber,
      pillar,
      topic:              brief.chosenTopic,
      trendsFound:        trends.length,
      newsFound:          news.length,
      briefId:            savedBrief?.id || null,
      contentWriterRunId: writerHandle.id,
    };
  },
});
