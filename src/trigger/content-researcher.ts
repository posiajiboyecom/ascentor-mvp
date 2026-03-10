// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher — Ambitious Professional Edition
//
// AUDIENCE SEGMENTS:
//   Explorer  (30% of content) — students, graduates, early jobseekers,
//             anyone figuring out their direction
//   Builder   (50% of content) — early-career pros, first-time managers,
//             entrepreneurs, career switchers (0–7 yrs experience)
//   Climber   (20% of content) — mid-career leaders, senior managers,
//             directors, scaling founders, execs moving to board roles
//
// VOICE PHILOSOPHY:
//   Every post must make the target reader stop scrolling and say:
//   "This is exactly what I'm going through."
//   Written from lived experience — not from the outside looking in.
//   Zero generic career advice. Zero region-specific clichés.
//   Universal relatability. Ascentor's impact is the hero.
//
// CONFIDENCE PRINCIPLE:
//   Ascentor speaks with the authority of results.
//   Not "maybe try this" — "here is what works,
//   here is what we have seen across hundreds of sessions."
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

// ── Audience types ────────────────────────────────────────────
// Journey-stage segments (primary)
export type JourneyStage = 'explorer' | 'builder' | 'climber';

// Legacy age-based segments — kept for backwards compatibility
export type AudiencePreset =
  | 'young_professional'
  | 'mid_career'
  | 'executive'
  | 'general'
  | JourneyStage;

// ── CONTENT MIX GUIDE (for manual runs) ──────────────────────
// Target split per 10 pieces of content:
//   Explorer  → 3 pieces  (30%)
//   Builder   → 5 pieces  (50%)
//   Climber   → 2 pieces  (20%)
export const CONTENT_MIX: Record<JourneyStage, { share: string; target: number }> = {
  explorer: { share: "30%", target: 3 },
  builder:  { share: "50%", target: 5 },
  climber:  { share: "20%", target: 2 },
};

// ── UNIVERSAL PROFESSIONAL PAIN POINT LIBRARY ────────────────
export const PRO_CONTEXT = {

  explorer: [
    "Not knowing which career path to choose when everyone around you seems to have it figured out",
    "Graduating with a degree and realising no one told you how the job market actually works",
    "Applying to 50 jobs and hearing nothing back — with no idea what you are doing wrong",
    "Watching peers get opportunities that seem to come from connections you do not have",
    "Feeling behind because you are still exploring while others appear to have already arrived",
    "Getting advice from adults that was relevant 20 years ago but useless in today's world",
    "Not knowing how to write a CV, prepare for interviews, or build a professional network from scratch",
    "The paralysis of too many options — every path looks possible and none feels certain",
  ],

  builder: [
    "Working twice as hard as your peers but being consistently overlooked for promotion",
    "Having your idea dismissed in a meeting, only to watch it praised when someone senior restates it",
    "Delivering strong results for two years with no raise, no title change, and no explanation",
    "Being told you are not ready — with no guidance on what ready actually looks like",
    "Navigating every major career decision without a mentor because the successful people are always too busy",
    "Watching peers accelerate because they have the right relationships, not because they work harder",
    "Earning below your market value because you never learned how to negotiate",
    "Not knowing whether to stay and build or leave for something that actually matches your ambition",
    "Experiencing imposter syndrome in rooms where you are genuinely one of the most capable people present",
    "Promotion decisions driven more by relationships and politics than by the quality of your work",
    "Stepping into your first management role with zero training and zero support",
    "Building a business while holding down a job — exhausted, unclear on what to prioritise",
  ],

  climber: [
    "Being excellent at the technical work but struggling to make the leap to genuine leadership",
    "Managing people who are older or more experienced than you — with no playbook for earning their respect",
    "Hitting a director title but still feeling like you are faking it in the boardroom",
    "Building a team culture when the organisation around you rewards individual performance",
    "The loneliness of senior leadership — fewer peers to be honest with, higher stakes on every decision",
    "Knowing your next move needs to be strategic but having no one objective to think it through with",
    "Being passed over for a C-suite role you were clearly ready for — and not understanding why",
    "Scaling a business past early traction and discovering the skills that built it are not the skills that grow it",
    "Mentoring others while quietly having no one doing the same for you",
    "The performance review that measures what you delivered but ignores how you are actually leading",
  ],

  ascentorImpactProofs: [
    "Professionals who work with Ascentor get promoted 40% faster than their peers",
    "In our coaching sessions, we have seen one conversation shift what months of isolated effort could not",
    "The gap between where you are and where you want to be is almost always a clarity gap — not a capability gap",
    "Every breakthrough we have seen starts with one thing: someone finally asking the right question out loud",
    "Ascentor has worked with thousands of professionals worldwide — we know exactly what separates the ones who break through",
  ],
};

// Legacy alias
export const AFRICAN_PRO_CONTEXT = PRO_CONTEXT;

// ── AUDIENCE META ─────────────────────────────────────────────
export const AUDIENCE_META: Record<AudiencePreset, {
  label: string;
  ageRange: string;
  researchContext: string;
  writerVoice: string;
  fallbackPersona: string;
  platformHooks: { linkedin: string; twitter: string; instagram: string; email: string };
}> = {

  // ── JOURNEY STAGE SEGMENTS ───────────────────────────────

  explorer: {
    label: 'Explorer',
    ageRange: '16–24',
    researchContext:
      'Final-year secondary school students, university undergraduates, recent graduates, and young professionals in their first job. ' +
      'Also anyone at any age who is unsure which career path to take. ' +
      'Core tensions: overwhelming number of options with no framework to choose; ' +
      'pressure from family, peers, and society to "have a plan"; ' +
      'no one teaching them how careers actually work — CVs, interviews, networking, salary; ' +
      'feeling behind or lost while peers seem to be moving forward; ' +
      'needing clarity, direction, and someone to show them the first real steps. ' +
      'They are smart and motivated but lack the map. Ascentor gives them the map.',
    writerVoice:
      'PERSONA: A brilliant, approachable older sibling or young mentor who figured it out — and wants to share everything. ' +
      'Not a professor. Not a career counsellor. Someone who genuinely remembers what it felt like to not know. ' +

      'TONE: Encouraging. Clear. Energising. Zero condescension. ' +
      'Speak to their intelligence — they are capable, they just need direction. ' +

      'LANGUAGE: Accessible but never dumbed down. Avoid corporate jargon entirely. ' +
      'Use concrete examples — "here is exactly what to do" not "consider exploring options". ' +

      'SPECIFICITY: Name the exact confusion. ' +
      '"You have three tabs open — LinkedIn, job boards, and a master\'s application — and you have not moved in an hour." ' +
      'Make them feel understood before you give them anything actionable. ' +

      'ASCENTOR FRAMING: Position Ascentor as the guide they always needed but never had. ' +
      '"Sage walks you through this step by step — like having a mentor available at 2am before the deadline." ' +

      'CLOSE: One clear first step. Not a list. The single most important thing they can do today.',

    fallbackPersona:
      'A university final-year student, 21 years old. ' +
      'Hardworking and ambitious but paralysed by options. Applying for jobs without a strategy. Waiting for clarity that has not come.',

    platformHooks: {
      linkedin:
        "Nobody teaches you how careers actually work. Not your degree. Not your parents. Here is the playbook they should have given you on day one.",
      twitter:
        "The thing standing between you and your first real opportunity is not your grades. It is this 🧵",
      instagram:
        "Still figuring out what you want to do? You are not behind. You just need a better map 👇",
      email:
        "The career clarity nobody gave you — and the exact steps to find your direction",
    },
  },

  builder: {
    label: 'Builder',
    ageRange: '22–35',
    researchContext:
      'Early-career professionals with 0–7 years of experience, first-time managers stepping into leadership, ' +
      'entrepreneurs building their first venture, and professionals switching industries or roles. ' +
      'Core tensions: the gap between hard work and recognition; navigating office politics with no playbook; ' +
      'stepping into management with zero training; building a business while figuring everything out in real time; ' +
      'earning below market value because they never learned to negotiate; ' +
      'imposter syndrome in rooms they have earned their place in; ' +
      'wanting to move faster but not knowing which lever to pull. ' +
      'They are in execution mode — they know the direction, they need the edge.',
    writerVoice:
      'PERSONA: A successful, warm, and direct peer who is two or three steps ahead — and wants to close that gap for you. ' +
      'Not a consultant. Not a corporate coach. Someone in the arena who tells you the truth. ' +

      'TONE: Confident. Warm. Direct. Occasionally sharp. Never preachy. Never vague. ' +

      'LANGUAGE: Clean, professional English. Universally relatable across industries and cities. ' +
      'ZERO region-specific slang. ZERO buzzwords that mean nothing in practice. ' +

      'SPECIFICITY: Name the exact situations. ' +
      '"The meeting where your idea was ignored and then celebrated when someone senior said it." ' +
      '"The performance review where you scored top marks but were passed over anyway." ' +

      'ASCENTOR CONFIDENCE: Speak from results. ' +
      '"Professionals who do this get promoted 40% faster." ' +
      '"Here is what we have seen across hundreds of coaching sessions." ' +
      'NEVER: "maybe try", "you might consider". ' +

      'CLOSE: One concrete action they can take this week — tied to how Ascentor accelerates the result.',

    fallbackPersona:
      'A professional, 27 years old, 4 years into their career at a tech or financial services firm. ' +
      'Consistently strong performer. Passed over for promotion without clear explanation. ' +
      'Ambitious, slightly frustrated, and hungry for a mentor who actually gets their reality.',

    platformHooks: {
      linkedin:
        "You are working harder than the person who just got promoted. Here is the one thing that actually made the difference — and it was not competence.",
      twitter:
        "The career trap that catches every talented professional in their 20s and 30s. And the way out nobody teaches you 🧵",
      instagram:
        "The thing no one tells you at your first job orientation that changes everything about your career 👇",
      email:
        "The promotion you were passed over for? Here is the real reason — and it has nothing to do with your performance",
    },
  },

  climber: {
    label: 'Climber',
    ageRange: '32–50',
    researchContext:
      'Mid-career leaders and senior managers, department heads and directors, founders scaling past early traction, ' +
      'and executives transitioning to board or advisory roles. ' +
      'Core tensions: the skills that got them here are not the ones that get them to the next level; ' +
      'fewer trusted peers to be honest with as seniority increases; ' +
      'managing performance, culture, and politics simultaneously at higher stakes; ' +
      'succession planning, legacy, and how to make their next move count; ' +
      'scaling a team or business without losing what made it work; ' +
      'being seen as a leader by others before they fully see it in themselves. ' +
      'They are experienced and capable — they need strategic sharpness and a thinking partner.',
    writerVoice:
      'PERSONA: A respected peer at a leadership retreat — someone who has earned their scars and speaks from them. ' +
      'Strategic. Reflective. Direct. No performance, no theory. Hard-won clarity shared peer to peer. ' +

      'TONE: Measured. Authoritative. Warm but economical with words. ' +
      'Every sentence has earned its place. Nothing is obvious. Nothing is padded. ' +

      'LANGUAGE: Sophisticated but not academic. ' +
      'Speak to the complexity they actually navigate — boards, teams, investors, legacy. ' +

      'ASCENTOR AUTHORITY: "This is what we consistently see at this level." ' +
      '"The leaders who make this transition successfully do one thing differently." ' +
      'Position Ascentor as the strategic partner senior leaders deserve — not a coaching tool for beginners. ' +

      'CLOSE: One strategic question or action that reframes how they are thinking about the challenge.',

    fallbackPersona:
      'A director or senior manager, 38 years old, leading a team of 15–40 people. ' +
      'Strong track record. Clear on their ambition. Unclear on what is actually blocking the next move. ' +
      'Needs a thinking partner, not a training course.',

    platformHooks: {
      linkedin:
        "The most effective leaders consistently do one thing that no leadership course teaches. Here is what the data from our sessions actually shows.",
      twitter:
        "Why the best talent keeps leaving — and what the leaders who retain them do differently 🧵",
      instagram:
        "The leadership gap nobody at the senior level talks about openly (and exactly how to close it) 👇",
      email:
        "What separates the leaders who make the jump to the next level from the ones who plateau",
    },
  },

  // ── LEGACY AGE-BASED SEGMENTS (kept for backwards compatibility) ──

  young_professional: {
    label: 'Young Professional (21–28)',
    ageRange: '21–28',
    researchContext:
      'Professionals aged 21–28, 0–5 years into their career. ' +
      'Working in banking, consulting, fintech, tech, or FMCG across major cities worldwide. ' +
      'Core tensions: early-career salary pressure; lack of real mentorship; imposter syndrome; ' +
      'the visibility gap between hard work and recognition; navigating office politics with no playbook.',
    writerVoice:
      'PERSONA: A successful, warm, and direct older colleague who has walked this exact path. ' +
      'TONE: Confident. Warm. Direct. Occasionally sharp. Never preachy. ' +
      'LANGUAGE: Clean, professional English. Universally relatable. ZERO region-specific slang. ' +
      'ASCENTOR CONFIDENCE: Speak from results — "professionals who do this get promoted 40% faster."',
    fallbackPersona:
      'A professional, 25 years old, 3 years into their career. Outperforms peers. Passed over for promotion without explanation.',
    platformHooks: {
      linkedin: "You are working harder than the person who just got promoted. Here is the one thing that actually made the difference.",
      twitter: "The career trap that catches every talented professional in their 20s. And the way out nobody teaches you 🧵",
      instagram: "The thing no one tells you at your first job orientation that changes everything 👇",
      email: "The promotion you were passed over for? Here is the real reason.",
    },
  },

  mid_career: {
    label: 'Mid-Career Professional (29–38)',
    ageRange: '29–38',
    researchContext:
      'Professionals aged 29–38 in management or senior individual contributor roles. ' +
      'Navigating promotion to director or VP; managing teams; corporate politics at higher stakes; ' +
      'salary ceiling after years of loyalty; the entrepreneurship vs. employment crossroads.',
    writerVoice:
      'PERSONA: A trusted peer who has navigated the politics, earned the scars, and figured out the code. ' +
      'TONE: Peer-to-peer. Warm. Direct. Hard-won wisdom shared without preaching. ' +
      'ASCENTOR AUTHORITY: "This is what we consistently see working at this level."',
    fallbackPersona:
      'A manager, 33 years old, managing a team of 6. Passed over for promotion once. Does not understand what senior leaders are evaluating.',
    platformHooks: {
      linkedin: "Eight years in. Manager title. Senior leadership still feels impossibly far. Here is what is actually blocking you.",
      twitter: "The skills that got you to manager are NOT the skills that get you to director. Most find this out too late 🧵",
      instagram: "They promoted someone younger than you. Before you spiral, read this 👇",
      email: "The leadership quality organisations reward most at senior level (it is not what your last training covered)",
    },
  },

  executive: {
    label: 'Senior Executive (39–50)',
    ageRange: '39–50',
    researchContext:
      'Senior professionals at director, VP, or C-suite level. ' +
      'Building cultures that retain young talent; board dynamics; cross-border leadership; ' +
      'succession planning; legacy building; mentoring the generation below them.',
    writerVoice:
      'PERSONA: A respected peer at a leadership summit. Strategic, reflective, direct. ' +
      'Position Ascentor as the platform that lets senior leaders scale their mentorship impact.',
    fallbackPersona:
      'An executive, 45 years old, C-suite at a major firm, managing 100+ people, focused on retaining young talent.',
    platformHooks: {
      linkedin: "The most effective leaders consistently do one thing that no leadership course teaches. Here is what the data shows.",
      twitter: "Why the best young talent keeps leaving — and what the leaders who retain them do differently 🧵",
      instagram: "The leadership gap nobody talks about openly (and exactly how to close it) 👇",
      email: "What separates top-tier executives from everyone else at the same level",
    },
  },

  general: {
    label: 'Ambitious Professional (all stages)',
    ageRange: '16–50',
    researchContext:
      'Professionals across all journey stages. Universal themes: career clarity, skill-building, ' +
      'leadership development, AI tools, and the power of intentional mentorship.',
    writerVoice:
      'PERSONA: The voice of someone who deeply understands the professional journey at every stage. ' +
      'Warm, inspiring, and immediately practical. Resonant and accessible to professionals everywhere.',
    fallbackPersona:
      'An ambitious professional, working in a major city, talented and driven but navigating without a real mentor.',
    platformHooks: {
      linkedin: "The career playbook every professional should have from day one. Nobody handed it to you. So here it is.",
      twitter: "What the most successful professionals in the room have in common (it is not what you think) 🧵",
      instagram: "The career truth that actually applies to your life — not the recycled version 👇",
      email: "What working with thousands of professionals worldwide has taught us about what actually accelerates careers",
    },
  },
};

// ── Helper: resolve pain points for any segment ──────────────
function getPainPoints(audience: AudiencePreset): string[] {
  if (audience === 'explorer') return PRO_CONTEXT.explorer;
  if (audience === 'builder') return PRO_CONTEXT.builder;
  if (audience === 'climber') return PRO_CONTEXT.climber;
  if (audience === 'young_professional') return PRO_CONTEXT.builder;
  if (audience === 'mid_career') return PRO_CONTEXT.climber;
  if (audience === 'executive') return PRO_CONTEXT.climber;
  return [...PRO_CONTEXT.explorer, ...PRO_CONTEXT.builder, ...PRO_CONTEXT.climber];
}

const PILLAR_ROTATION = ["career", "leadership", "ai", "coaching", "community"] as const;
type Pillar = typeof PILLAR_ROTATION[number];

const PILLAR_CONTEXT: Record<Pillar, string> = {
  career:
    "career acceleration — promotions, salary negotiation, visibility strategies, " +
    "the effort-recognition gap, navigating corporate culture, what actually drives momentum",
  leadership:
    "leadership development — building executive presence, managing teams, " +
    "navigating office politics, the individual-contributor-to-leader transition, developing the confidence to lead",
  ai:
    "AI tools transforming workplaces — which tools are making the biggest real-world difference, " +
    "AI disruption across industries, how to gain an AI-powered career edge before peers catch up",
  coaching:
    "mentorship and personal development — why real mentors are scarce and hard to access, " +
    "what Ascentor coaching actually delivers, the ROI of intentional development, breakthrough patterns we see in sessions",
  community:
    "professional community and peer networks — " +
    "why your circle determines your ceiling, how to build valuable professional relationships intentionally, " +
    "the power of peer accountability, what the most connected professionals do differently",
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
        `You are the research lead at Ascentor — an AI-powered mentorship platform for ambitious professionals.\n\n` +
        `MISSION: Find what is ACTUALLY relevant this week for the audience segment below. ` +
        `Global focus — trends that resonate across industries, cities, and career stages.\n\n` +
        `Audience segment: ${audienceMeta.label}\n` +
        `Context: ${audienceMeta.researchContext}\n\n` +
        `Research pillar: "${PILLAR_CONTEXT[pillar]}"\n\n` +
        `Find:\n` +
        `- Career and workforce trends directly relevant to ${audienceMeta.label}s right now\n` +
        `- What ${audienceMeta.label}s are actively discussing on LinkedIn, Reddit, and social media this week\n` +
        `- AI and workplace tech shifts relevant to their specific stage\n` +
        `- Salary, promotion, and talent data relevant to their career level\n` +
        `- Mentorship and leadership conversations happening in their professional circles\n\n` +
        `Return ONLY this JSON, no markdown:\n` +
        `{"trends":["trend relevant to ${audienceMeta.label}s 1","trend 2","trend 3"],` +
        `"news":[{"title":"headline relevant to ${audienceMeta.label}s","snippet":"one sentence with specifics"}],` +
        `"summary":"2 sentences — what is most relevant THIS WEEK for ${audienceMeta.label}s",` +
        `"research":"4-5 sentences with specific stats, named companies where available, real professional context"}`,
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
  news: { title: string; snippet: string }[]; summary: string; research: string;
  audience: AudiencePreset; recentTopics: string[];
}) {
  const audienceMeta = AUDIENCE_META[params.audience];
  const painPoints = getPainPoints(params.audience);
  const stageLabel = audienceMeta.label;

  const avoidBlock = params.recentTopics.length > 0
    ? `\nDO NOT REPEAT — TOPICS ALREADY COVERED (last ${params.recentTopics.length}):\n` +
      params.recentTopics.map(t => `- "${t}"`).join("\n") +
      `\nChoose a FRESH angle, scenario, and insight that has not appeared in any of the above.\n`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{
      role: "user",
      content:
        `You are the content strategist at Ascentor — AI mentorship for ambitious professionals.\n\n` +
        `MISSION: Build a brief that makes a ${stageLabel} stop and say "this is EXACTLY my life right now."\n\n` +
        `Audience segment: ${stageLabel} | Pillar: ${params.pillar} | Week: ${params.weekNumber}\n` +
        `Trends: ${params.trends.slice(0, 3).join(", ") || params.pillar}\n` +
        `Research: ${params.research.substring(0, 500)}\n` +
        avoidBlock +
        `\nRULES:\n` +
        `1. Topic must speak directly to the ${stageLabel} stage — no generic career advice\n` +
        `2. Every key message must position Ascentor as the platform that closes this specific gap\n` +
        `3. Ascentor speaks from results: "we have seen this", "professionals who do this get promoted 40% faster"\n` +
        `4. Zero region-specific slang or references — universally relatable\n\n` +
        `Return ONLY valid JSON:\n` +
        `{"chosenTopic":"punchy specific title max 12 words",` +
        `"angle":"our unique take rooted in the ${stageLabel} reality",` +
        `"pillar":"${params.pillar}",` +
        `"targetAudience":"ultra-specific: who they are, their exact frustration RIGHT NOW",` +
        `"keyMessages":["message showing Ascentor understands them","message showing Ascentor has the solution","confident result Ascentor delivers"],` +
        `"hooks":["linkedin hook","twitter hook","email subject"],` +
        `"instagramHook":"instagram caption opener",` +
        `"dataPoints":["specific stat or proof point"],` +
        `"seoKeywords":["primary","secondary","long-tail"],` +
        `"urgencyReason":"why this matters to ${stageLabel}s RIGHT NOW",` +
        `"professionalAngle":"the exact career truth this content addresses — specific, no jargon"}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      chosenTopic: `The ${stageLabel} ${params.pillar} playbook — ${month}`,
      angle: `Built for the real challenges of a ${stageLabel}`,
      pillar: params.pillar,
      targetAudience: audienceMeta.fallbackPersona,
      keyMessages: [
        `Generic career advice was not built for where a ${stageLabel} actually is`,
        "The professionals breaking through have a different playbook — Ascentor gives you that playbook",
        "Ascentor closes the gap between the career you have and the one you deserve",
      ],
      hooks: [audienceMeta.platformHooks.linkedin, audienceMeta.platformHooks.twitter, audienceMeta.platformHooks.email],
      instagramHook: audienceMeta.platformHooks.instagram,
      dataPoints: ["Over 1 billion working professionals are navigating their careers without a real mentor"],
      seoKeywords: [`${stageLabel} career`, `professional ${params.pillar}`, `career development`],
      urgencyReason: `${stageLabel}s face a real mentorship gap — empowering content builds the trust that converts`,
      professionalAngle: painPoints[Math.floor(Math.random() * painPoints.length)],
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
  const audience: AudiencePreset = params.audience ?? 'builder';

  console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar} — segment: ${audience}`);

  // Fetch recent topics to avoid repetition
  let recentTopics: string[] = [];
  try {
    const { data: recentBriefs } = await supabase
      .from("research_briefs")
      .select("topic")
      .order("created_at", { ascending: false })
      .limit(20);
    recentTopics = (recentBriefs || []).map((r: any) => r.topic).filter(Boolean);
    if (recentTopics.length > 0) {
      console.log(`[Researcher] Loaded ${recentTopics.length} recent topics for deduplication`);
    }
  } catch (e) {
    console.warn(`[Researcher] Could not load recent topics (non-fatal):`, e);
  }

  const { trends, news, summary, research } = await researchAndDiscover(pillar, weekNumber, audience);
  const brief = await buildBrief({ pillar, weekNumber, trends, news, summary, research, audience, recentTopics });
  if (params.topicOverride?.trim()) brief.chosenTopic = params.topicOverride.trim();

  console.log(`[Researcher] Brief: "${brief.chosenTopic}" — segment: ${audience}`);

  let savedBriefId: string | null = null;
  try {
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({
        week_number: weekNumber, pillar, topic: brief.chosenTopic, angle: brief.angle,
        brief_data: { ...brief, audience }, trends_raw: trends, news_raw: news,
        research_raw: research, status: "ready", created_at: now.toISOString()
      })
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
    professionalAngle: brief.professionalAngle,
    africanProfessionalAngle: brief.professionalAngle, // legacy alias
  });

  return {
    success: true, week: weekNumber, pillar, audience,
    topic: brief.chosenTopic, professionalAngle: brief.professionalAngle,
    trendsFound: trends.length, briefId: savedBriefId, contentWriterRunId: writerHandle.id,
  };
}

// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════
export const contentResearcherManual = task({
  id: "content-researcher-manual",
  maxDuration: 60,
  run: async (payload: {
    topic?: string;
    pillar?: Pillar;
    audience?: AudiencePreset;
    stage?: JourneyStage; // convenience shorthand
  }) => {
    console.log("[Researcher] Manual trigger:", payload);
    // stage shorthand takes precedence if provided
    const resolvedAudience = payload.stage ?? payload.audience ?? 'builder';
    return runResearch({
      pillar: payload.pillar,
      topicOverride: payload.topic,
      audience: resolvedAudience,
      triggeredBy: "manual",
    });
  },
});

export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Monday 05:00 UTC
  maxDuration: 60,
  run: async () => {
    // Default scheduled run targets Builders (50% of content mix)
    console.log("[Researcher] Weekly scheduled research — Builder segment...");
    return runResearch({ audience: 'builder', triggeredBy: "schedule" });
  },
});
