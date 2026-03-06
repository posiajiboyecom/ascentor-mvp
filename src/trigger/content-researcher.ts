// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher — FREE TIER EDITION
//
// Free tier constraints:
//   - No wait.for() (requires paid Trigger.dev)
//   - maxDuration must be low (free tier = 30s compute limit)
//   - Must not exceed Anthropic 30k input tokens/min (Sonnet)
//
// Solution:
//   - ONE single Claude call does trends + research together
//   - Haiku model (higher rate limits, cheaper, faster)
//   - No retries with sleeps — fail fast and let Trigger retry the task
//   - Brief synthesis is a second fast call (no web search, tiny prompt)
//   - Total compute time: ~10-15s — well within free tier limits
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

const PILLAR_CONTEXT: Record<Pillar, string> = {
  leadership: "African leadership, management, executive development",
  career:     "career growth, job market, salaries, promotions in Africa",
  ai:         "AI tools, tech jobs, automation impact in Africa",
  coaching:   "executive coaching, mentorship, personal development in Africa",
  community:  "professional networking, peer learning, communities in Africa",
};

// ── ONE combined web search call: trends + research together ──
// This is the key architectural change. Instead of 2 separate web
// search calls (which double the token usage and risk rate limits),
// we ask Claude to do everything in a single pass.
async function researchAndDiscover(pillar: Pillar, weekNumber: number): Promise<{
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
  research: string;
}> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role: "user",
      content:
        `You are a research assistant for Ascentor, an AI coaching platform for African professionals.\n\n` +
        `Search the web and return a JSON object covering this week's "${PILLAR_CONTEXT[pillar]}" landscape ` +
        `for professionals in Nigeria, Ghana, Kenya, and South Africa.\n\n` +
        `Return ONLY this JSON structure, no markdown:\n` +
        `{\n` +
        `  "trends": ["top trend 1", "top trend 2", "top trend 3"],\n` +
        `  "news": [{"title": "headline", "snippet": "one sentence"}],\n` +
        `  "summary": "2 sentence overview of what is hot this week",\n` +
        `  "research": "3-4 sentences of key insights, stats, and real African examples for the top trend"\n` +
        `}`,
    }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    console.log(`[Researcher] Trends: ${parsed.trends?.length || 0}, news: ${parsed.news?.length || 0}`);
    return {
      trends:   parsed.trends   || [],
      news:     parsed.news     || [],
      summary:  parsed.summary  || "",
      research: parsed.research || text,
    };
  } catch {
    console.warn("[Researcher] Parse failed — using text as research");
    return {
      trends:   [],
      news:     [],
      summary:  text.substring(0, 200),
      research: text.substring(0, 500),
    };
  }
}

// ── Brief synthesis — no web search, tiny prompt, fast ───────
async function buildBrief(params: {
  pillar: Pillar;
  weekNumber: number;
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
  research: string;
}) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content:
        `Content strategist for Ascentor (AI coaching, African professionals 22-45).\n` +
        `Pillar: ${params.pillar} | Week: ${params.weekNumber}\n` +
        `Trends: ${params.trends.slice(0, 3).join(", ") || "General " + params.pillar}\n` +
        `Summary: ${params.summary}\n` +
        `Research: ${params.research.substring(0, 600)}\n\n` +
        `Return ONLY valid JSON:\n` +
        `{"chosenTopic":"punchy title max 12 words","angle":"our unique take","pillar":"${params.pillar}",` +
        `"targetAudience":"specific persona","keyMessages":["msg1","msg2","msg3"],` +
        `"hooks":["linkedin hook","twitter hook","email subject"],` +
        `"dataPoints":["stat with source"],"seoKeywords":["primary","secondary","long-tail"],` +
        `"urgencyReason":"why publish now"}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    console.warn("[Researcher] Brief parse failed — using fallback");
    const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      chosenTopic:    `African ${params.pillar} insights — ${month}`,
      angle:          "Practical frameworks rooted in African context",
      pillar:         params.pillar,
      targetAudience: "Ambitious African professionals aged 25-40",
      keyMessages:    ["Lead with authenticity", "Build systems not habits", "Community accelerates growth"],
      hooks:          ["What no one tells you about leadership in Africa", "The mistake costing African professionals promotions", "Why you need a different playbook"],
      dataPoints:     ["Africa has the world's youngest workforce — 60% under 25"],
      seoKeywords:    [`African ${params.pillar}`, `${params.pillar} Africa`, "professional development Nigeria"],
      urgencyReason:  "Weekly cadence builds audience trust and SEO authority",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN TASK
// ═══════════════════════════════════════════════════════════
export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Every Monday 05:00 UTC = 06:00 WAT
  maxDuration: 60,    // Free tier safe. Two fast Haiku calls = ~10-15s total.
  run: async () => {
    console.log("[Researcher] Starting weekly research...");

    const now = new Date();
    const weekNumber = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
    );
    const pillar = PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
    console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar}`);

    // ONE web search call — trends + research in a single pass
    const { trends, news, summary, research } = await researchAndDiscover(pillar, weekNumber);

    // Fast synthesis call — no web search, no rate limit risk
    const brief = await buildBrief({ pillar, weekNumber, trends, news, summary, research });
    console.log(`[Researcher] Brief: "${brief.chosenTopic}"`);

    // Save to Supabase
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

    // Trigger Content Writer
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
      briefId:            savedBrief?.id || null,
      contentWriterRunId: writerHandle.id,
    };
  },
});
