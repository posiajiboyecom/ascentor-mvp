// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher
// Runs every Monday at 06:00 WAT (05:00 UTC).
// Pipeline:
//   1. SerpAPI  → Google Trends: top trending topics in Africa
//   2. SerpAPI  → Google Search: African leadership/career news
//   3. Perplexity → deep research on the best topic found
//   4. Claude   → synthesise into a structured content brief
//   5. Supabase → save brief + auto-trigger Content Writer agent
//
// Required env vars:
//   PERPLEXITY_API_KEY  — https://www.perplexity.ai/settings/api
//   SERPAPI_KEY         — https://serpapi.com/dashboard (100 free/mo)
// ═══════════════════════════════════════════════════════════

import { schedules, tasks } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Pillar rotation — cycles through content pillars weekly ──
const PILLAR_ROTATION = [
  "leadership",
  "career",
  "ai",
  "coaching",
  "community",
] as const;

type Pillar = typeof PILLAR_ROTATION[number];

// ── SerpAPI: fetch Google Trends for Africa ───────────────────
async function fetchGoogleTrends(): Promise<string[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn("[Researcher] SERPAPI_KEY not set — skipping Google Trends");
    return [];
  }

  try {
    // Trending searches in Nigeria/Africa region
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=NG&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`SerpAPI trends: ${res.status}`);
    const data = await res.json();

    const trends: string[] = (data.trending_searches || [])
      .slice(0, 10)
      .map((t: any) => t.query || t.title || "")
      .filter(Boolean);

    console.log(`[Researcher] Google Trends fetched: ${trends.length} topics`);
    return trends;
  } catch (err) {
    console.error("[Researcher] Google Trends error:", err);
    return [];
  }
}

// ── SerpAPI: Google Search for African leadership/career news ─
async function fetchRecentNews(query: string): Promise<{ title: string; snippet: string; link: string }[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://serpapi.com/search.json?engine=google&q=${encoded}&tbm=nws&num=5&gl=ng&hl=en&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`SerpAPI news: ${res.status}`);
    const data = await res.json();

    const results = (data.news_results || []).slice(0, 5).map((r: any) => ({
      title:   r.title   || "",
      snippet: r.snippet || "",
      link:    r.link    || "",
    }));

    console.log(`[Researcher] News results: ${results.length} articles for "${query}"`);
    return results;
  } catch (err) {
    console.error("[Researcher] Google News error:", err);
    return [];
  }
}

// ── Perplexity: deep research on a specific topic ─────────────
async function perplexityResearch(topic: string): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn("[Researcher] PERPLEXITY_API_KEY not set — skipping deep research");
    return "";
  }

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a research assistant specialising in African business, leadership, and career development. " +
              "Provide detailed, accurate, up-to-date research with specific facts, statistics, and examples. " +
              "Focus on the African context — Nigeria, Ghana, Kenya, South Africa, and the broader continent.",
          },
          {
            role: "user",
            content:
              `Research this topic thoroughly for a content team writing for ambitious African professionals: "${topic}"\n\n` +
              "Include:\n" +
              "1. Why this topic is trending or important right now\n" +
              "2. Key statistics or data points (with sources)\n" +
              "3. Real examples from African business/leadership context\n" +
              "4. Common misconceptions or pain points for professionals\n" +
              "5. Angles that would resonate with ambitious Africans aged 22–45\n\n" +
              "Be specific and cite real events, companies, or leaders where relevant.",
          },
        ],
        max_tokens: 1200,
        temperature: 0.2,
        search_recency_filter: "week",
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Perplexity API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log(`[Researcher] Perplexity research: ${content.length} chars`);
    return content;
  } catch (err) {
    console.error("[Researcher] Perplexity error:", err);
    return "";
  }
}

// ── Claude: pick the best topic + build structured brief ──────
async function buildContentBrief(params: {
  trends: string[];
  news: { title: string; snippet: string }[];
  perplexityResearch: string;
  pillar: Pillar;
  weekNumber: number;
}): Promise<{
  chosenTopic: string;
  angle: string;
  pillar: Pillar;
  targetAudience: string;
  keyMessages: string[];
  hooks: string[];
  dataPoints: string[];
  competitorGaps: string[];
  contentFormats: string[];
  seoKeywords: string[];
  estimatedEngagement: string;
  urgencyReason: string;
}> {
  const prompt = `You are a senior content strategist for Ascentor — an AI leadership coaching platform for ambitious African professionals (students to C-suite, aged 22–45, in Nigeria, Ghana, Kenya, South Africa and across the continent).

This week's content pillar: **${params.pillar}**
Week number: ${params.weekNumber}

## Current Google Trends (Nigeria):
${params.trends.length > 0 ? params.trends.join(", ") : "No trend data available"}

## Recent News Headlines:
${params.news.map(n => `- ${n.title}: ${n.snippet}`).join("\n") || "No news data available"}

## Deep Research:
${params.perplexityResearch || "No Perplexity data available — use your knowledge of current African business context"}

---

Your job: Choose the ONE best topic to write about this week that:
1. Fits the ${params.pillar} pillar
2. Is timely/trending for African professionals
3. Has real substance (not generic "work harder" advice)
4. Will drive shares + signups for Ascentor

Return ONLY valid JSON (no markdown, no explanation):
{
  "chosenTopic": "Specific, punchy topic title (max 12 words)",
  "angle": "The unique angle — what makes our take different from generic content",
  "pillar": "${params.pillar}",
  "targetAudience": "Specific persona this week (e.g. 'Mid-level managers at Nigerian fintechs')",
  "keyMessages": ["message 1", "message 2", "message 3"],
  "hooks": ["LinkedIn hook option 1", "Twitter hook option 1", "Email subject line option 1"],
  "dataPoints": ["Specific stat or fact to anchor the content", "Another data point"],
  "competitorGaps": ["What generic content misses that we'll include"],
  "contentFormats": ["Blog Post", "LinkedIn Post", "Twitter Thread", "Newsletter"],
  "seoKeywords": ["primary keyword", "secondary keyword", "long-tail keyword"],
  "estimatedEngagement": "Why this topic will resonate this week",
  "urgencyReason": "Why publish this NOW vs later"
}`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content[0].type === "text" ? res.content[0].text : "";

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    console.error("[Researcher] Failed to parse Claude brief:", text.substring(0, 200));
    // Fallback brief
    return {
      chosenTopic:         `African Leadership in ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`,
      angle:               "Practical frameworks from African context",
      pillar:              params.pillar,
      targetAudience:      "Ambitious African professionals aged 25–40",
      keyMessages:         ["Lead with authenticity", "Build systems not habits", "Community accelerates growth"],
      hooks:               ["What no one tells you about leadership in Africa", "The leadership mistake costing African professionals promotions", "Why African leaders need a different playbook"],
      dataPoints:          ["Africa has the world's youngest workforce — 60% under 25"],
      competitorGaps:      ["Western frameworks don't account for African organisational culture"],
      contentFormats:      ["Blog Post", "LinkedIn Post", "Twitter Thread", "Newsletter"],
      seoKeywords:         ["African leadership", "career growth Africa", "professional development Nigeria"],
      estimatedEngagement: "Leadership content consistently drives 2-3x engagement vs other pillars",
      urgencyReason:       "Weekly cadence — consistent publishing builds audience trust",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN TASK
// ═══════════════════════════════════════════════════════════
export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  // Every Monday at 05:00 UTC (06:00 WAT)
  cron: "0 5 * * 1",
  maxDuration: 120,
  run: async (payload) => {
    console.log("[Researcher] Starting weekly content research...");

    const now = new Date();

    // Determine which pillar to focus on this week (rotate weekly)
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
    );
    const pillar = PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
    console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar}`);

    // ── Step 1: Fetch Google Trends ──────────────────────────
    const trends = await fetchGoogleTrends();

    // ── Step 2: Fetch recent news on key pillar queries ──────
    const pillarQueries: Record<Pillar, string> = {
      leadership: "African leadership business 2025",
      career:     "career growth professionals Africa 2025",
      ai:         "AI artificial intelligence Africa jobs 2025",
      coaching:   "executive coaching mentorship Africa 2025",
      community:  "African professional community networking 2025",
    };

    const news = await fetchRecentNews(pillarQueries[pillar]);

    // ── Step 3: Perplexity deep research on best trend ───────
    // Pick the most relevant trend or use pillar query as fallback
    const researchQuery = trends.find(t =>
      t.toLowerCase().includes("business") ||
      t.toLowerCase().includes("career") ||
      t.toLowerCase().includes("work") ||
      t.toLowerCase().includes("leader")
    ) || pillarQueries[pillar];

    const deepResearch = await perplexityResearch(researchQuery);

    // ── Step 4: Claude builds the content brief ──────────────
    const brief = await buildContentBrief({ trends, news, perplexityResearch: deepResearch, pillar, weekNumber });

    console.log(`[Researcher] Brief built — topic: "${brief.chosenTopic}"`);

    // ── Step 5: Save research brief to Supabase ──────────────
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({
        week_number:    weekNumber,
        pillar,
        topic:          brief.chosenTopic,
        angle:          brief.angle,
        brief_data:     brief,
        trends_raw:     trends,
        news_raw:       news,
        research_raw:   deepResearch,
        status:         "ready",
        created_at:     now.toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Researcher] Supabase save error:", error);
      // Don't throw — still trigger content writer with the brief data
    }

    // ── Step 6: Auto-trigger Content Writer agent ────────────
    const contentWriterHandle = await tasks.trigger("content-writer-agent", {
      topic:       brief.chosenTopic,
      pillar,
      week:        weekNumber,
      triggeredBy: `researcher-agent:week-${weekNumber}`,
      briefId:     savedBrief?.id || null,
      hooks:       brief.hooks,
      keyMessages: brief.keyMessages,
      dataPoints:  brief.dataPoints,
    });

    console.log(`[Researcher] Content Writer triggered — run: ${contentWriterHandle.id}`);

    return {
      success:         true,
      week:            weekNumber,
      pillar,
      topic:           brief.chosenTopic,
      angle:           brief.angle,
      trendsFound:     trends.length,
      newsFound:       news.length,
      hasDeepResearch: deepResearch.length > 0,
      briefId:         savedBrief?.id || null,
      contentWriterRunId: contentWriterHandle.id,
    };
  },
});
