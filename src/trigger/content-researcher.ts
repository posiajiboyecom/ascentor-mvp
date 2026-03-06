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

import { schedules, tasks, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AudiencePreset =
  | 'young_professional'   // 21-28, entry/mid-level, hustle-culture aware, social-media native
  | 'mid_career'           // 29-38, manager/senior IC, balancing ambition + stability
  | 'executive'            // 39-50, C-suite/director, strategy & legacy focused
  | 'general';             // balanced mix (original default)

export const AUDIENCE_META: Record<AudiencePreset, {
  label: string;
  ageRange: string;
  researchContext: string;   // injected into the researcher prompt
  writerVoice: string;       // injected into every writer prompt
  fallbackPersona: string;   // used in the brief fallback
}> = {
  young_professional: {
    label: 'Young Professional (21–28)',
    ageRange: '21–28',
    researchContext:
      'Focus on early-career African professionals aged 21–28: first jobs, salary negotiations, ' +
      'side hustles, LinkedIn growth, imposter syndrome, navigating corporate culture as a Gen Z hire, ' +
      'remote work and tech skills.',
    writerVoice:
      'Tone: conversational, energetic, and direct — like a smart older sibling texting advice. ' +
      'Use short punchy sentences. Embrace Gen Z/millennial phrasing where it feels natural ' +
      '(e.g. "lowkey", "no cap", "it hits different") but never force it. ' +
      'Avoid corporate jargon. Lead with relatable pain points. Use "you" heavily.',
    fallbackPersona: 'Ambitious African professional aged 21–28, navigating their first years in the workforce',
  },
  mid_career: {
    label: 'Mid-Career (29–38)',
    ageRange: '29–38',
    researchContext:
      'Focus on African professionals aged 29–38: moving into management, seeking promotions, ' +
      'building teams, work-life balance, salary growth, career pivots, and executive presence.',
    writerVoice:
      'Tone: warm, peer-to-peer, and practical — like a trusted colleague sharing hard-won lessons. ' +
      'Mix storytelling with actionable frameworks. Confident but not preachy. ' +
      'Acknowledge trade-offs and complexity. Moderate length is fine.',
    fallbackPersona: 'Driven African professional aged 29–38, building toward a leadership role',
  },
  executive: {
    label: 'Executive / Senior (39–50)',
    ageRange: '39–50',
    researchContext:
      'Focus on senior African professionals and executives aged 39–50: organisational leadership, ' +
      'board dynamics, legacy building, DEI at the top, cross-border business, and mentoring the next generation.',
    writerVoice:
      'Tone: authoritative, reflective, and strategic — like a respected peer at a leadership summit. ' +
      'Use data and case studies. Acknowledge systemic context. Slightly longer, more nuanced content is appropriate.',
    fallbackPersona: 'Senior African executive aged 39–50, focused on legacy and organisational impact',
  },
  general: {
    label: 'General (all ages)',
    ageRange: '22–45',
    researchContext:
      'Focus on African professionals across age groups: early career through senior leadership, ' +
      'covering universal themes like career growth, leadership, AI tools, and community.',
    writerVoice:
      'Tone: warm, inspiring, and practical — accessible to professionals at any stage. ' +
      'Balance aspiration with actionable advice.',
    fallbackPersona: 'Ambitious African professional aged 22–45',
  },
};

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
async function researchAndDiscover(pillar: Pillar, weekNumber: number, audience: AudiencePreset): Promise<{
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
  research: string;
}> {
  const audienceMeta = AUDIENCE_META[audience];
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role: "user",
      content:
        `You are a research assistant for Ascentor, an AI coaching platform for African professionals.\n\n` +
        `Audience: ${audienceMeta.label} — ${audienceMeta.researchContext}\n\n` +
        `Search the web and return a JSON object covering this week's "${PILLAR_CONTEXT[pillar]}" landscape ` +
        `for professionals in Nigeria, Ghana, Kenya, and South Africa, specifically relevant to this audience.\n\n` +
        `Return ONLY this JSON structure, no markdown:\n` +
        `{\n` +
        `  "trends": ["top trend 1", "top trend 2", "top trend 3"],\n` +
        `  "news": [{"title": "headline", "snippet": "one sentence"}],\n` +
        `  "summary": "2 sentence overview of what is hot this week for this age group",\n` +
        `  "research": "3-4 sentences of key insights, stats, and real African examples relevant to ${audienceMeta.ageRange}-year-olds"\n` +
        `}`,
    }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  // Extract JSON even if Claude wraps it in prose
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;
  try {
    const parsed = JSON.parse(jsonStr);
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
  audience: AudiencePreset;
}) {
  const audienceMeta = AUDIENCE_META[params.audience];
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content:
        `Content strategist for Ascentor (AI coaching, African professionals).\n` +
        `Audience: ${audienceMeta.label} — ${audienceMeta.ageRange} year olds.\n` +
        `Pillar: ${params.pillar} | Week: ${params.weekNumber}\n` +
        `Trends: ${params.trends.slice(0, 3).join(", ") || "General " + params.pillar}\n` +
        `Summary: ${params.summary}\n` +
        `Research: ${params.research.substring(0, 600)}\n\n` +
        `Return ONLY valid JSON:\n` +
        `{"chosenTopic":"punchy title max 12 words","angle":"our unique take for this age group","pillar":"${params.pillar}",` +
        `"targetAudience":"specific persona for ${audienceMeta.ageRange}-year-olds","keyMessages":["msg1","msg2","msg3"],` +
        `"hooks":["linkedin hook","twitter hook","email subject"],` +
        `"dataPoints":["stat with source"],"seoKeywords":["primary","secondary","long-tail"],` +
        `"urgencyReason":"why publish now"}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;
  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn("[Researcher] Brief parse failed — using fallback");
    const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      chosenTopic:    `African ${params.pillar} insights — ${month}`,
      angle:          "Practical frameworks rooted in African context",
      pillar:         params.pillar,
      targetAudience: audienceMeta.fallbackPersona,
      keyMessages:    ["Lead with authenticity", "Build systems not habits", "Community accelerates growth"],
      hooks:          ["What no one tells you about leadership in Africa", "The mistake costing African professionals promotions", "Why you need a different playbook"],
      dataPoints:     ["Africa has the world's youngest workforce — 60% under 25"],
      seoKeywords:    [`African ${params.pillar}`, `${params.pillar} Africa`, "professional development Nigeria"],
      urgencyReason:  "Weekly cadence builds audience trust and SEO authority",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED CORE — used by both the manual task and the schedule
// ═══════════════════════════════════════════════════════════
async function runResearch(params: {
  pillar?: Pillar;
  topicOverride?: string;
  audience?: AudiencePreset;
  triggeredBy?: string;
}) {
  const now = new Date();
  const weekNumber = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  );

  const pillar: Pillar = params.pillar ?? PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
  const audience: AudiencePreset = params.audience ?? 'general';
  console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar} — audience: ${audience}${params.topicOverride ? ` — topic override: "${params.topicOverride}"` : ""}`);

  const { trends, news, summary, research } = await researchAndDiscover(pillar, weekNumber, audience);
  const brief = await buildBrief({ pillar, weekNumber, trends, news, summary, research, audience });

  if (params.topicOverride?.trim()) {
    brief.chosenTopic = params.topicOverride.trim();
  }

  console.log(`[Researcher] Brief: "${brief.chosenTopic}"`);

  let savedBriefId: string | null = null;
  try {
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({
        week_number:  weekNumber,
        pillar,
        topic:        brief.chosenTopic,
        angle:        brief.angle,
        brief_data:   { ...brief, audience },
        trends_raw:   trends,
        news_raw:     news,
        research_raw: research,
        status:       "ready",
        created_at:   now.toISOString(),
      })
      .select("id")
      .single();
    if (error) console.error("[Researcher] Supabase error:", error.message);
    else savedBriefId = savedBrief?.id || null;
  } catch (err: any) {
    console.error("[Researcher] Supabase insert failed (non-fatal):", err.message);
  }

  const triggeredBy = params.triggeredBy ?? `researcher-agent:week-${weekNumber}`;
  const writerHandle = await tasks.trigger("content-writer-agent", {
    topic:       brief.chosenTopic,
    pillar,
    week:        weekNumber,
    audience,
    triggeredBy,
    briefId:     savedBriefId,
    hooks:       brief.hooks,
    keyMessages: brief.keyMessages,
    dataPoints:  brief.dataPoints,
  });

  console.log(`[Researcher] Content Writer triggered — run: ${writerHandle.id}`);

  return {
    success:            true,
    week:               weekNumber,
    pillar,
    audience,
    topic:              brief.chosenTopic,
    trendsFound:        trends.length,
    briefId:            savedBriefId,
    contentWriterRunId: writerHandle.id,
  };
}

// ═══════════════════════════════════════════════════════════
// MANUAL TASK — trigger from admin panel with custom topic/pillar
// ═══════════════════════════════════════════════════════════
export const contentResearcherManual = task({
  id: "content-researcher-manual",
  maxDuration: 60,
  run: async (payload: {
    topic?: string;
    pillar?: Pillar;
    audience?: AudiencePreset;
  }) => {
    console.log("[Researcher] Manual trigger:", payload);
    return runResearch({
      pillar:        payload.pillar,
      topicOverride: payload.topic,
      audience:      payload.audience,
      triggeredBy:   "manual",
    });
  },
});

// ═══════════════════════════════════════════════════════════
// SCHEDULED TASK — runs every Monday automatically
// ═══════════════════════════════════════════════════════════
export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Every Monday 05:00 UTC = 06:00 WAT
  maxDuration: 60,    // Free tier safe. Two fast Haiku calls = ~10-15s total.
  run: async () => {
    console.log("[Researcher] Starting weekly research...");
    return runResearch({ triggeredBy: "schedule" });
  },
});
