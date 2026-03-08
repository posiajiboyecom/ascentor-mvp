// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher — African Young Professional Edition
//
// TARGETING: African young professionals (21–32) across
// Nigeria, Ghana, Kenya, South Africa, Rwanda, Senegal.
//
// VOICE PHILOSOPHY:
//   Every post must make an African young professional stop
//   scrolling and say: "This is exactly what I'm going through."
//   Written from lived experience — not from the outside looking in.
//   Zero imported career advice. Zero country-specific slang.
//   Pan-African relatability. Ascentor's impact is the hero.
//
// CONFIDENCE PRINCIPLE:
//   Ascentor speaks with the authority of results.
//   Not "maybe try this" — "here is what works,
//   here is what we have seen across hundreds of sessions."
//
// CHANGES FROM PREVIOUS VERSION:
//   - Removed all Nigeria-specific slang and cultural markers
//   - Broadened to universal pan-African professional experience
//   - Pain points resonate Lagos to Nairobi, Accra to Johannesburg
//   - Ascentor value and impact is embedded in every brief
//   - Young professional (21–28) is the default PRIMARY audience
//   - Confidence framing elevated — we speak from results, not theory
//
// Free tier constraints:
//   - No wait.for() (requires paid Trigger.dev)
//   - maxDuration must be low (free tier = 30s compute limit)
//   - Must not exceed Anthropic 30k input tokens/min
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
  | 'young_professional'   // 21–28, 0–5 yrs — PRIMARY audience
  | 'mid_career'           // 29–38, manager/senior IC
  | 'executive'            // 39–50, C-suite/director
  | 'general';             // balanced, pan-African mix

// ── PAN-AFRICAN PROFESSIONAL PAIN POINT LIBRARY ────────────
// Universal lived realities that resonate across the continent.
// No slang. Pure, deeply recognisable truth.
export const AFRICAN_PRO_CONTEXT = {

  dailyPainPoints: [
    // Visibility & Recognition
    "Working twice as hard as your peers but being consistently overlooked for promotion",
    "Having your idea dismissed in a meeting, only to watch it praised when someone senior restates it",
    "Being the most capable person on the team but lacking the visibility to prove it where it counts",
    "Delivering strong results for two years with no raise, no title change, and no explanation",
    "Being told you are not ready — with no guidance on what ready actually looks like",

    // Mentorship & Guidance Gap
    "Navigating every major career decision without a mentor because the successful people are always too busy",
    "Getting career advice that was built for a Western job market — completely useless in your reality",
    "Watching peers accelerate because they have the right relationships, not because they work harder",
    "Not knowing how to position for the next level because no one above you explains the unspoken rules",
    "Building skills in isolation with no feedback loop and no one to tell you what actually matters here",

    // Compensation & Growth
    "Earning below your market value because you never learned how to negotiate",
    "Hitting a career ceiling with no clear path through it",
    "Accepting a lateral move framed as a promotion because you lacked data or confidence to push back",
    "Not knowing whether to stay and build or leave for something that actually matches your ambition",

    // Confidence & Identity
    "Experiencing imposter syndrome in rooms where you are genuinely one of the most capable people present",
    "Shrinking in meetings dominated by older colleagues — not because you lack insight, but because no one taught you how to command the room",
    "Second-guessing decisions your instincts know are right",
    "Feeling like your ambition is too big for the environment you are in",

    // Structural Realities
    "Promotion decisions driven more by relationships and politics than by the quality of your work",
    "Senior leaders who talk about developing young talent but never invest time to actually do it",
    "Performance reviews that feel subjective and disconnected from what you actually delivered",
    "The exhausting gap between the professional you know you are and the one your organisation sees",
  ],

  ascentorImpactProofs: [
    "Professionals who work with Ascentor get promoted 40% faster than their peers",
    "In our coaching sessions, we have seen one conversation shift what months of isolated effort could not",
    "The gap between where you are and where you want to be is almost always a clarity gap — not a capability gap",
    "Every breakthrough we have seen starts with one thing: someone finally asking the right question out loud",
    "Ascentor has worked with thousands of African professionals — we know exactly what separates the ones who break through",
  ],
};

export const AUDIENCE_META: Record<AudiencePreset, {
  label: string;
  ageRange: string;
  researchContext: string;
  writerVoice: string;
  fallbackPersona: string;
  platformHooks: { linkedin: string; twitter: string; instagram: string; email: string };
}> = {

  young_professional: {
    label: 'African Young Professional (21–28)',
    ageRange: '21–28',
    researchContext:
      'African professionals aged 21–28, 0–5 years into their career. ' +
      'Working in banking, consulting, fintech, tech, or FMCG across major African cities. ' +
      'Core tensions: early-career salary pressure; lack of real mentorship; imposter syndrome; ' +
      'the visibility gap between hard work and recognition; navigating office politics with no playbook; ' +
      'building a personal brand when no one taught you how; deciding whether to stay, switch, or start something. ' +
      'They are talented, ambitious, and quietly frustrated that their effort is not translating into momentum. ' +
      'They want to reach senior roles faster, earn what they are worth, and finally feel like they belong in the room. ' +
      'They are done with generic career advice that was built for a completely different world.',
    writerVoice:
      'PERSONA: A successful, warm, and direct older colleague who has walked this exact path. ' +
      'Someone who understands what it feels like to be talented and stuck simultaneously. ' +
      'Not a consultant. Not a corporate coach. A trusted person in your corner who tells you the truth. ' +

      'TONE: Confident. Warm. Direct. Occasionally sharp and witty. Never preachy. Never vague. ' +

      'LANGUAGE: Clean, professional English. Universally relatable across African countries. ' +
      'ZERO country-specific slang. ZERO imported Western career buzzwords. ' +
      'Write for the universal African young professional experience — ' +
      'the ambition, the structural barriers, and the transformation Ascentor enables. ' +

      'SPECIFICITY: Name the exact situations. Name the exact feelings. Make the reader feel seen immediately. ' +
      'Say "the meeting where your idea was ignored and then celebrated when someone senior said it" — not "workplace friction". ' +
      'Say "the review where you scored top marks but were passed over anyway" — not "performance issues". ' +

      'ASCENTOR CONFIDENCE: We speak from results and real data. ' +
      '"Here is what we have seen across hundreds of coaching sessions." ' +
      '"Professionals who do this get promoted 40% faster." ' +
      '"The data is clear — this is the move." ' +
      'NEVER: "maybe try", "you might consider", "some people find that..." ' +

      'ASCENTOR VALUE: Every piece must show — not just tell — that Ascentor closes the gap between ' +
      'where you are and where you deserve to be. The platform is confident, credible, and transformational. ' +

      'OPENING: Drop the reader into a specific moment or feeling they experienced THIS WEEK. Not a generic truth. ' +
      'CLOSE: One concrete action they can take this week — tied to how Ascentor accelerates the result.',

    fallbackPersona:
      'African professional, 25 years old, 3 years into their career at a financial services firm in a major African city. ' +
      'Consistently outperforms peers. Has been passed over for promotion without a clear explanation. ' +
      'Ambitious, slightly frustrated, and hungry for a mentor who actually gets their reality.',

    platformHooks: {
      linkedin:
        "You are working harder than the person who just got promoted. Here is the one thing that actually made the difference — and it was not competence.",
      twitter:
        "The career trap that catches every talented African professional in their 20s. And the way out nobody teaches you 🧵",
      instagram:
        "The thing no one tells you at your first job orientation that changes everything about your career 👇",
      email:
        "The promotion you were passed over for? Here is the real reason — and it has nothing to do with your performance",
    },
  },

  mid_career: {
    label: 'Mid-Career African Professional (29–38)',
    ageRange: '29–38',
    researchContext:
      'African professionals aged 29–38 in management or senior individual contributor roles. ' +
      'Navigating promotion to director or VP; managing teams; corporate politics at higher stakes; ' +
      'salary ceiling after years of loyalty; building executive presence in hierarchical organisations; ' +
      'the entrepreneurship vs. employment crossroads; building a personal brand after years of head-down work.',
    writerVoice:
      'PERSONA: A trusted peer who has navigated the politics, earned the scars, and figured out the code. ' +
      'TONE: Peer-to-peer. Warm. Direct. Hard-won wisdom shared without preaching. ' +
      'ASCENTOR AUTHORITY: "This is what we consistently see working at this level." ' +
      'Position Ascentor as the strategic partner for mid-career professionals who are done waiting.',
    fallbackPersona:
      'African manager, 33 years old, managing a team of 6 at a financial services firm. ' +
      'Passed over for promotion once. Work is excellent. Does not understand what senior leaders are actually evaluating.',
    platformHooks: {
      linkedin:
        "Eight years in. Manager title. But senior leadership still feels impossibly far. Here is what is actually blocking you — and it is not your performance.",
      twitter:
        "The skills that got you to manager are NOT the skills that get you to director. Most people find this out too late 🧵",
      instagram:
        "They promoted someone younger than you. Before you spiral, read this 👇",
      email:
        "The leadership quality African organisations reward most at senior level (it is not what your last training course covered)",
    },
  },

  executive: {
    label: 'Senior African Executive (39–50)',
    ageRange: '39–50',
    researchContext:
      'Senior African professionals at director, VP, or C-suite level. ' +
      'Building cultures that retain young talent; board dynamics; cross-border leadership; ' +
      'succession planning; legacy building; mentoring the generation below them.',
    writerVoice:
      'PERSONA: A respected peer at a leadership summit. Strategic, reflective, direct. ' +
      'Position Ascentor as the platform that lets senior leaders scale their mentorship impact ' +
      'and build the next generation of African professionals.',
    fallbackPersona:
      'African executive, 45 years old, C-suite at a major firm, managing 100+ people, ' +
      'focused on retaining young talent and developing the next generation of leaders.',
    platformHooks: {
      linkedin:
        "Africa's most effective leaders consistently do one thing that no leadership course teaches. Here is what the data shows.",
      twitter:
        "Why Africa's best young talent keeps leaving — and what the leaders who retain them actually do differently 🧵",
      instagram:
        "The leadership gap in African organisations nobody talks about openly (and exactly how to close it) 👇",
      email:
        "What separates Africa's top-tier executives from everyone else at the same level",
    },
  },

  general: {
    label: 'African Professional (21–45)',
    ageRange: '21–45',
    researchContext:
      'African professionals across career stages. Universal themes: career acceleration, leadership development, ' +
      'AI tools in the workplace, and the power of intentional mentorship and professional community. ' +
      'Anchor to the universal African professional experience — the ambition, the barriers, and the transformation.',
    writerVoice:
      'PERSONA: The voice of someone who deeply understands the African professional journey at every stage. ' +
      'Warm, inspiring, and immediately practical. ' +
      'No country-specific references — resonant and accessible across the continent.',
    fallbackPersona:
      'Ambitious African professional, 27 years old, working in a major city, ' +
      'talented and driven but navigating without a real mentor.',
    platformHooks: {
      linkedin:
        "The career playbook every African professional should have from day one. Nobody handed it to you. So here it is.",
      twitter:
        "What the most successful African professionals in the room have in common (it is not what you think) 🧵",
      instagram:
        "The career truth that actually applies to African professionals — not the imported version 👇",
      email:
        "What working with thousands of African professionals has taught us about what actually accelerates careers",
    },
  },
};

const PILLAR_ROTATION = ["career", "leadership", "ai", "coaching", "community"] as const;
type Pillar = typeof PILLAR_ROTATION[number];

const PILLAR_CONTEXT: Record<Pillar, string> = {
  career:
    "career acceleration for African professionals — promotions, salary negotiation, visibility strategies, " +
    "navigating African corporate culture, the effort-recognition gap, what actually drives momentum in African organisations",
  leadership:
    "leadership development for African professionals — building executive presence, managing teams, " +
    "navigating office politics, the individual-contributor-to-leader transition, developing the confidence to lead",
  ai:
    "AI tools transforming African workplaces — which tools are making the biggest real-world difference, " +
    "AI disruption in banking, consulting, and fintech, how to gain an AI-powered career edge before peers catch up",
  coaching:
    "mentorship and personal development for African professionals — why real mentors are scarce and hard to access, " +
    "what Ascentor coaching actually delivers, the ROI of intentional development, breakthrough patterns we see in sessions",
  community:
    "professional community and peer networks for African professionals — " +
    "why your circle determines your ceiling, how to build valuable professional relationships intentionally, " +
    "the power of peer accountability, what the most connected African professionals do differently",
};

// ── Research function ─────────────────────────────────────────
async function researchAndDiscover(
  pillar: Pillar,
  weekNumber: number,
  audience: AudiencePreset
): Promise<{ trends: string[]; news: { title: string; snippet: string }[]; summary: string; research: string }> {
  const audienceMeta = AUDIENCE_META[audience];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role: "user",
      content:
        `You are the research lead at Ascentor — an AI-powered mentorship platform for African professionals.\n\n` +
        `MISSION: Find what is ACTUALLY relevant this week in African professional life. ` +
        `Pan-African focus — trends that resonate across Nigeria, Ghana, Kenya, South Africa, and beyond.\n\n` +
        `Audience: ${audienceMeta.label} | Context: ${audienceMeta.researchContext}\n\n` +
        `Research pillar: "${PILLAR_CONTEXT[pillar]}"\n\n` +
        `Find:\n` +
        `- Career and workforce trends affecting young African professionals right now\n` +
        `- What African professionals are actively discussing on LinkedIn and social media this week\n` +
        `- AI and workplace tech shifts relevant to African careers\n` +
        `- Salary, promotion, talent retention data and stories across Africa\n` +
        `- Mentorship and leadership conversations in African professional circles\n\n` +
        `Return ONLY this JSON, no markdown:\n` +
        `{"trends":["pan-African trend 1","trend 2","trend 3"],` +
        `"news":[{"title":"headline relevant to African professionals","snippet":"one sentence with specifics"}],` +
        `"summary":"2 sentences — what is most relevant THIS WEEK for ${audienceMeta.ageRange}-year-old African professionals",` +
        `"research":"4-5 sentences with specific stats, named companies where available, real African professional context"}`,
    }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n").trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return { trends: parsed.trends || [], news: parsed.news || [], summary: parsed.summary || "", research: parsed.research || text };
  } catch {
    return { trends: [], news: [], summary: text.substring(0, 200), research: text.substring(0, 500) };
  }
}

// ── Brief builder ─────────────────────────────────────────────
async function buildBrief(params: {
  pillar: Pillar; weekNumber: number; trends: string[];
  news: { title: string; snippet: string }[]; summary: string; research: string; audience: AudiencePreset;
}) {
  const audienceMeta = AUDIENCE_META[params.audience];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{
      role: "user",
      content:
        `You are the content strategist at Ascentor — AI mentorship for African professionals.\n\n` +
        `MISSION: Build a brief that makes African ${audienceMeta.ageRange}-year-olds stop and say "this is EXACTLY my life right now."\n\n` +
        `Audience: ${audienceMeta.label} | Pillar: ${params.pillar} | Week: ${params.weekNumber}\n` +
        `Trends: ${params.trends.slice(0, 3).join(", ") || params.pillar}\n` +
        `Research: ${params.research.substring(0, 500)}\n\n` +
        `RULES:\n` +
        `1. Topic must resonate across ALL African countries — no country-specific slang or references\n` +
        `2. Every key message must position Ascentor as the platform that closes this gap — with confidence\n` +
        `3. Primary target is young professionals (21–28) — make it viscerally relatable to their daily experience\n` +
        `4. Ascentor speaks from results: "we have seen this", "professionals who do this get promoted 40% faster"\n\n` +
        `Return ONLY valid JSON:\n` +
        `{"chosenTopic":"punchy specific title max 12 words",` +
        `"angle":"our unique take rooted in African professional reality",` +
        `"pillar":"${params.pillar}",` +
        `"targetAudience":"ultra-specific: role, city type, exact frustration RIGHT NOW",` +
        `"keyMessages":["message showing Ascentor understands them","message showing Ascentor has the solution","confident result Ascentor delivers"],` +
        `"hooks":["linkedin hook","twitter hook","email subject"],` +
        `"instagramHook":"instagram caption opener",` +
        `"dataPoints":["specific stat or proof point"],` +
        `"seoKeywords":["primary","secondary","long-tail"],` +
        `"urgencyReason":"why this matters to African young professionals RIGHT NOW",` +
        `"africanProfessionalAngle":"the exact universal career truth this content addresses — specific, no slang"}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      chosenTopic: `The African professional ${params.pillar} playbook — ${month}`,
      angle: "Built for the real challenges of building a career on the African continent",
      pillar: params.pillar,
      targetAudience: audienceMeta.fallbackPersona,
      keyMessages: [
        "Generic career advice was not built for the African professional experience",
        "The professionals breaking through have a different playbook — Ascentor gives you that playbook",
        "Ascentor closes the gap between the career you have and the one you deserve",
      ],
      hooks: [audienceMeta.platformHooks.linkedin, audienceMeta.platformHooks.twitter, audienceMeta.platformHooks.email],
      instagramHook: audienceMeta.platformHooks.instagram,
      dataPoints: ["Africa has over 400 million working professionals under 35"],
      seoKeywords: [`African professional ${params.pillar}`, `career development Africa`, `professional growth Africa`],
      urgencyReason: "African professionals face a real mentorship gap — empowering content builds the trust that converts",
      africanProfessionalAngle: AFRICAN_PRO_CONTEXT.dailyPainPoints[
        Math.floor(Math.random() * AFRICAN_PRO_CONTEXT.dailyPainPoints.length)
      ],
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED CORE
// ═══════════════════════════════════════════════════════════
async function runResearch(params: {
  pillar?: Pillar; topicOverride?: string; audience?: AudiencePreset; triggeredBy?: string;
}) {
  const now = new Date();
  const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000));
  const pillar: Pillar = params.pillar ?? PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
  const audience: AudiencePreset = params.audience ?? 'young_professional';

  console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar} — audience: ${audience}`);

  const { trends, news, summary, research } = await researchAndDiscover(pillar, weekNumber, audience);
  const brief = await buildBrief({ pillar, weekNumber, trends, news, summary, research, audience });
  if (params.topicOverride?.trim()) brief.chosenTopic = params.topicOverride.trim();

  console.log(`[Researcher] Brief: "${brief.chosenTopic}"`);

  let savedBriefId: string | null = null;
  try {
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({ week_number: weekNumber, pillar, topic: brief.chosenTopic, angle: brief.angle,
        brief_data: { ...brief, audience }, trends_raw: trends, news_raw: news,
        research_raw: research, status: "ready", created_at: now.toISOString() })
      .select("id").single();
    if (error) console.error("[Researcher] Supabase error:", error.message);
    else savedBriefId = savedBrief?.id || null;
  } catch (err: any) {
    console.error("[Researcher] Supabase insert failed (non-fatal):", err.message);
  }

  const writerHandle = await tasks.trigger("content-writer-agent", {
    topic: brief.chosenTopic, pillar, week: weekNumber, audience,
    triggeredBy: params.triggeredBy ?? `researcher-agent:week-${weekNumber}`,
    briefId: savedBriefId, hooks: brief.hooks, instagramHook: brief.instagramHook,
    keyMessages: brief.keyMessages, dataPoints: brief.dataPoints,
    africanProfessionalAngle: brief.africanProfessionalAngle,
  });

  return {
    success: true, week: weekNumber, pillar, audience,
    topic: brief.chosenTopic, africanProfessionalAngle: brief.africanProfessionalAngle,
    trendsFound: trends.length, briefId: savedBriefId, contentWriterRunId: writerHandle.id,
  };
}

// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════
export const contentResearcherManual = task({
  id: "content-researcher-manual",
  maxDuration: 60,
  run: async (payload: { topic?: string; pillar?: Pillar; audience?: AudiencePreset }) => {
    console.log("[Researcher] Manual trigger:", payload);
    return runResearch({ pillar: payload.pillar, topicOverride: payload.topic,
      audience: payload.audience ?? 'young_professional', triggeredBy: "manual" });
  },
});

export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Monday 05:00 UTC = 06:00 WAT
  maxDuration: 60,
  run: async () => {
    console.log("[Researcher] Weekly pan-African research — young professional focus...");
    return runResearch({ audience: 'young_professional', triggeredBy: "schedule" });
  },
});
