// ═══════════════════════════════════════════════════════════════════════════
// Personal Brand Researcher — Posi Ajiboye Samuel
//
// PURPOSE:
//   Researches recent global cybersecurity developments and builds a
//   content brief for the personal brand writer to execute.
//
// CONTENT MIX (hard-wired per brief):
//   70% — Penetration Testing & Offensive Security
//   30% — GRC (Governance, Risk, Compliance)
//
// STRATEGIC GOAL:
//   Help Posi establish authority in cybersecurity, attract recruiters,
//   and secure a well-paying role within 2 months.
//
// SCHEDULE:
//   Runs 3× per week — Mon/Wed/Fri at 06:00 WAT (05:00 UTC)
//   Each run produces one brief → triggers the writer immediately
//
// RESEARCH APPROACH:
//   Uses Claude's web search tool to find:
//   - CVEs and breach news from the past 7 days
//   - Pentest technique or tool trending on GitHub/Twitter/security forums
//   - GRC regulation or compliance development (global)
//   - Recruiter / hiring manager conversations about cybersecurity skills
// ═══════════════════════════════════════════════════════════════════════════

import { schedules, tasks, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Content pillars for personal brand ───────────────────────────────────
// 70/30 split wired into pillar selection
const PENTEST_PILLARS = [
  "penetration_testing",
  "offensive_security",
  "vulnerability_research",
  "red_team",
  "exploit_technique",
] as const;

const GRC_PILLARS = [
  "governance_risk_compliance",
  "security_frameworks",
  "compliance_regulation",
] as const;

type PentestPillar = typeof PENTEST_PILLARS[number];
type GRCPillar     = typeof GRC_PILLARS[number];
type CyberPillar   = PentestPillar | GRCPillar;

// ── Pillar context — used in research prompts ─────────────────────────────
const PILLAR_RESEARCH_CONTEXT: Record<CyberPillar, string> = {
  penetration_testing:
    "Web application pentesting, network pentesting, OWASP Top 10, Burp Suite, Metasploit, SQLi, XSS, "
    + "IDOR, authentication bypass, CVE exploitation, bug bounty findings, real pentest methodology",

  offensive_security:
    "Red team operations, adversary simulation, C2 frameworks (Cobalt Strike, Havoc, Sliver), "
    + "AV/EDR evasion, living off the land (LOTL), lateral movement techniques, privilege escalation, "
    + "post-exploitation, MITRE ATT&CK TTPs",

  vulnerability_research:
    "New CVEs published this week, zero-days in the wild, PoC exploit releases, "
    + "vulnerability severity scoring (CVSS), patch management failures, "
    + "real-world exploitation of recently disclosed vulnerabilities",

  red_team:
    "Red team vs blue team dynamics, assumed breach exercises, purple team collaboration, "
    + "physical security testing, social engineering, phishing simulation, "
    + "red team reporting and client communication",

  exploit_technique:
    "Specific technical technique trending in security research — buffer overflows, "
    + "race conditions, deserialization, SSRF, XXE, JWT vulnerabilities, "
    + "supply chain attacks, dependency confusion",

  governance_risk_compliance:
    "GRC frameworks (ISO 27001, NIST CSF, SOC 2, PCI DSS), risk assessment methodology, "
    + "security policy development, audit preparation, third-party risk management, "
    + "security program building, CISO priorities",

  security_frameworks:
    "NIST, CIS Controls, ISO 27001/27002, MITRE ATT&CK as a defensive framework, "
    + "Zero Trust architecture adoption, cloud security frameworks (CSA CCM), "
    + "security maturity models, framework implementation in real organisations",

  compliance_regulation:
    "New regulations affecting cybersecurity — DORA, NIS2, SEC cybersecurity rules, "
    + "HIPAA enforcement, GDPR security requirements, FedRAMP, "
    + "emerging global cyber laws, compliance deadline news",
};

// ── Post intent contexts — job-seeking angle ──────────────────────────────
const INTENT_CONTEXT = {
  authority:
    "Makes cybersecurity professionals and hiring managers think: "
    + "'This person clearly knows their craft at a practitioner level.' "
    + "Demonstrates deep technical knowledge without being inaccessible.",

  career_signal:
    "Shows Posi is actively practising, learning, and growing in cybersecurity. "
    + "Signals to recruiters and hiring managers that he is in the market "
    + "and worth reaching out to — from a position of demonstrated expertise, not desperation.",

  inbound_magnet:
    "Creates content so specific and useful that hiring managers DM Posi "
    + "before he applies. The post positions him as a rare practitioner "
    + "with both technical depth and communication clarity.",
};

// ── Determine this run's pillar using 70/30 split ─────────────────────────
function selectPillar(runIndex: number): CyberPillar {
  // Every 10 runs: 7 pentest, 3 GRC
  const cyclePos = runIndex % 10;
  if (cyclePos < 7) {
    return PENTEST_PILLARS[runIndex % PENTEST_PILLARS.length];
  }
  return GRC_PILLARS[runIndex % GRC_PILLARS.length];
}

// ── Research: find recent cybersecurity developments ─────────────────────
async function researchCybersecurity(
  pillar: CyberPillar,
  weekNumber: number
): Promise<{
  recentNews:    { headline: string; detail: string; source?: string }[];
  trendingTools: string[];
  hotTopics:     string[];
  jobMarket:     string;
  research:      string;
}> {
  const pillarCtx = PILLAR_RESEARCH_CONTEXT[pillar];

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1400,
    tools:      [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role:    "user",
      content:
        `You are a senior cybersecurity researcher building content briefs for a practitioner's personal brand.\n\n`
        + `Research focus: ${pillarCtx}\n\n`
        + `Find RECENT (last 7-14 days) developments — NOT generic facts:\n`
        + `1. A specific CVE, breach, or security incident published this week\n`
        + `2. A technique, tool, or methodology trending in the security community right now\n`
        + `3. A hiring or salary trend for cybersecurity professionals this month\n`
        + `4. A regulatory or compliance development relevant to ${pillar.replace(/_/g, " ")}\n\n`
        + `Return ONLY this JSON, no markdown:\n`
        + `{\n`
        + `  "recentNews": [\n`
        + `    {"headline": "specific recent headline", "detail": "2 sentences with specifics", "source": "source name"}\n`
        + `  ],\n`
        + `  "trendingTools": ["specific tool or technique name trending now"],\n`
        + `  "hotTopics": ["what security professionals are debating this week"],\n`
        + `  "jobMarket": "1 sentence on cybersecurity hiring trends this month — specific salary range or demand stat if available",\n`
        + `  "research": "4-5 sentences — specific recent context, named CVEs, tools, or developments"\n`
        + `}`,
    }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n").trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      recentNews:    parsed.recentNews    || [],
      trendingTools: parsed.trendingTools || [],
      hotTopics:     parsed.hotTopics     || [],
      jobMarket:     parsed.jobMarket     || "",
      research:      parsed.research      || text.slice(0, 600),
    };
  } catch {
    return {
      recentNews:    [],
      trendingTools: [],
      hotTopics:     [],
      jobMarket:     "",
      research:      text.slice(0, 600),
    };
  }
}

// ── Brief builder ─────────────────────────────────────────────────────────
async function buildPersonalBrief(params: {
  pillar:        CyberPillar;
  recentNews:    { headline: string; detail: string; source?: string }[];
  trendingTools: string[];
  hotTopics:     string[];
  jobMarket:     string;
  research:      string;
  topicOverride: string;
  recentTopics:  string[];
  intent:        keyof typeof INTENT_CONTEXT;
}): Promise<any> {

  const avoidBlock = params.recentTopics.length > 0
    ? `\nDO NOT REPEAT — recently covered topics:\n`
      + params.recentTopics.map(t => `- "${t}"`).join("\n")
      + `\nChoose a FRESH angle.\n`
    : "";

  const newsBlock = params.recentNews.slice(0, 2)
    .map(n => `- ${n.headline}: ${n.detail}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role:    "user",
      content:
        `You are building a content brief for Posi Ajiboye Samuel — a cybersecurity practitioner\n`
        + `building his personal brand to secure a well-paying cybersecurity role within 2 months.\n\n`
        + `POSI'S PROFILE:\n`
        + `- Security Analyst background\n`
        + `- CompTIA Security+, Google Cybersecurity Professional, ISACA member\n`
        + `- Specialisation: Penetration Testing + GRC\n`
        + `- Building authority on LinkedIn and Twitter\n\n`
        + `CONTENT FOCUS: ${pillar_label(params.pillar)}\n`
        + `POST INTENT: ${INTENT_CONTEXT[params.intent]}\n\n`
        + `RECENT DEVELOPMENTS TO DRAW FROM:\n`
        + newsBlock + "\n"
        + `Trending: ${params.trendingTools.join(", ")}\n`
        + `Hot debates: ${params.hotTopics.join(", ")}\n`
        + `Job market context: ${params.jobMarket}\n`
        + `Research: ${params.research.slice(0, 500)}\n`
        + avoidBlock
        + `\nRULES:\n`
        + `1. Topic must reference a SPECIFIC recent development — not generic advice\n`
        + `2. Content must demonstrate Posi actually works in this field\n`
        + `3. Zero fluff. Practitioner voice. Direct and specific.\n`
        + `4. Must serve the job-seeking goal: make recruiters want to reach out\n\n`
        + `Return ONLY valid JSON:\n`
        + `{\n`
        + `  "chosenTopic": "punchy specific title max 12 words — references a real recent development",\n`
        + `  "angle": "the specific practitioner insight that makes this post worth reading",\n`
        + `  "pillar": "${params.pillar}",\n`
        + `  "intent": "${params.intent}",\n`
        + `  "hook_linkedin": "scroll-stopping first line for LinkedIn — specific, no generic openers",\n`
        + `  "hook_twitter": "first tweet of the thread — specific, intriguing",\n`
        + `  "keyPoints": ["specific technical or GRC point 1", "point 2", "point 3"],\n`
        + `  "practitionerInsight": "the thing only someone who actually does this work would know",\n`
        + `  "careerAngle": "how this post signals to a hiring manager that Posi is worth recruiting",\n`
        + `  "recentReference": "the specific CVE/breach/tool/regulation this is anchored in",\n`
        + `  "callToAction": "subtle CTA — not 'hire me', but a question or invitation that creates engagement"\n`
        + `}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (params.topicOverride.trim()) parsed.chosenTopic = params.topicOverride.trim();
    return parsed;
  } catch {
    return {
      chosenTopic:        params.topicOverride || `${pillar_label(params.pillar)} — week ${new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`,
      angle:              "Practitioner perspective on a recent development",
      pillar:             params.pillar,
      intent:             params.intent,
      hook_linkedin:      "Most security professionals miss this completely.",
      hook_twitter:       "A recent development in cybersecurity that nobody is talking about clearly:",
      keyPoints:          ["Specificity over generality", "Practitioner credibility", "Actionable insight"],
      practitionerInsight:"Only someone doing this work daily would notice this pattern.",
      careerAngle:        "Demonstrates hands-on expertise to hiring managers.",
      recentReference:    params.recentNews[0]?.headline || "Recent cybersecurity development",
      callToAction:       "What has your experience been with this?",
    };
  }
}

function pillar_label(p: CyberPillar): string {
  return p.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Core run logic ────────────────────────────────────────────────────────
async function runPersonalBrandResearch(params: {
  pillar?:        CyberPillar;
  topicOverride?: string;
  intent?:        keyof typeof INTENT_CONTEXT;
  triggeredBy?:   string;
}) {
  const now        = new Date();
  const weekNumber = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  );

  // Determine run index for 70/30 split
  const { count: runCount } = await supabase
    .from("personal_brand_briefs")
    .select("*", { count: "exact", head: true });
  const runIndex = runCount || 0;

  const pillar: CyberPillar = params.pillar ?? selectPillar(runIndex);
  const intent: keyof typeof INTENT_CONTEXT =
    params.intent ?? (runIndex % 3 === 0 ? "inbound_magnet" : runIndex % 3 === 1 ? "career_signal" : "authority");

  console.log(`[PB-Researcher] Run #${runIndex} — pillar: ${pillar} — intent: ${intent}`);

  // Load recent topics to avoid repetition
  let recentTopics: string[] = [];
  try {
    const { data } = await supabase
      .from("personal_brand_briefs")
      .select("topic")
      .order("created_at", { ascending: false })
      .limit(15);
    recentTopics = (data || []).map((r: any) => r.topic).filter(Boolean);
  } catch (e) {
    console.warn("[PB-Researcher] Could not load recent topics:", e);
  }

  // Research
  const { recentNews, trendingTools, hotTopics, jobMarket, research } =
    await researchCybersecurity(pillar, weekNumber);

  // Build brief
  const brief = await buildPersonalBrief({
    pillar, recentNews, trendingTools, hotTopics, jobMarket, research,
    topicOverride: params.topicOverride || "",
    recentTopics, intent,
  });

  console.log(`[PB-Researcher] Brief: "${brief.chosenTopic}"`);

  // Save brief
  let savedBriefId: string | null = null;
  try {
    const { data, error } = await supabase
      .from("personal_brand_briefs")
      .insert({
        week_number:     weekNumber,
        pillar,
        intent,
        topic:           brief.chosenTopic,
        angle:           brief.angle,
        brief_data:      brief,
        research_raw:    research,
        recent_news_raw: recentNews,
        trending_tools:  trendingTools,
        job_market_note: jobMarket,
        status:          "ready",
        created_at:      now.toISOString(),
      })
      .select("id").single();
    if (error) console.error("[PB-Researcher] Supabase error:", error.message);
    else savedBriefId = data?.id || null;
  } catch (e: any) {
    console.error("[PB-Researcher] Brief save failed (non-fatal):", e.message);
  }

  // Trigger the writer
  const writerHandle = await tasks.trigger("personal-brand-writer", {
    topic:               brief.chosenTopic,
    pillar,
    intent,
    weekNumber,
    briefId:             savedBriefId,
    hook_linkedin:       brief.hook_linkedin,
    hook_twitter:        brief.hook_twitter,
    keyPoints:           brief.keyPoints,
    practitionerInsight: brief.practitionerInsight,
    careerAngle:         brief.careerAngle,
    recentReference:     brief.recentReference,
    callToAction:        brief.callToAction,
    triggeredBy:         params.triggeredBy ?? `pb-researcher:run-${runIndex}`,
  });

  return {
    success:           true,
    runIndex,
    pillar,
    intent,
    topic:             brief.chosenTopic,
    briefId:           savedBriefId,
    writerRunId:       writerHandle.id,
    researchFound:     recentNews.length,
    contentMixNote:    runIndex % 10 < 7 ? "70% pentest run" : "30% GRC run",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════

// Manual trigger — from the admin UI "Generate Posts" button
export const personalBrandResearcherManual = task({
  id:          "personal-brand-researcher-manual",
  maxDuration: 90,
  run: async (payload: {
    topic?:  string;
    pillar?: CyberPillar;
    intent?: keyof typeof INTENT_CONTEXT;
  }) => {
    console.log("[PB-Researcher] Manual trigger:", payload);
    return runPersonalBrandResearch({
      pillar:        payload.pillar,
      topicOverride: payload.topic,
      intent:        payload.intent,
      triggeredBy:   "manual",
    });
  },
});

// Scheduled: Mon/Wed/Fri 05:00 UTC (06:00 WAT)
// 3 posts/week = ~12/month — enough for consistent LinkedIn + Twitter presence
export const personalBrandResearcherScheduled = schedules.task({
  id:   "personal-brand-researcher-scheduled",
  cron: "0 5 * * 1,3,5",
  maxDuration: 90,
  run: async () => {
    console.log("[PB-Researcher] Scheduled run — Mon/Wed/Fri");
    return runPersonalBrandResearch({ triggeredBy: "schedule" });
  },
});
